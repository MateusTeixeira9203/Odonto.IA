import { z } from 'zod';

const MICRO_UNITS = BigInt(1_000_000);
const CANONICAL_DECIMAL_PATTERN = /^(?:0|[1-9]\d{0,11})(?:\.\d{0,5}[1-9])?$/;
const POSITIVE_CANONICAL_DECIMAL_PATTERN = /^(?:[1-9]\d{0,11})(?:\.\d{0,5}[1-9])?$|^0\.\d{0,5}[1-9]$/;
const SIGNED_DECIMAL_PATTERN = /^(?:0|[1-9]\d{0,11}(?:\.\d{0,5}[1-9])?|0\.\d{0,5}[1-9]|-(?:[1-9]\d{0,11}(?:\.\d{0,5}[1-9])?|0\.\d{0,5}[1-9]))$/;
const SIGNED_NON_ZERO_DECIMAL_PATTERN = /^(?:[1-9]\d{0,11}(?:\.\d{0,5}[1-9])?|0\.\d{0,5}[1-9]|-(?:[1-9]\d{0,11}(?:\.\d{0,5}[1-9])?|0\.\d{0,5}[1-9]))$/;
const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

const UuidSchema = z.string().uuid().transform((value) => value.toLowerCase());
const PositiveVersionSchema = z.number().int().positive().max(2_147_483_647);
const MotivoSchema = z.string().trim().min(1).max(500);

function isCalendarDate(value: string): boolean {
  const match = ISO_DATE_PATTERN.exec(value);
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;
}

function saoPauloCalendarDate(): string {
  // Auxilia o formulário; a RPC compara a mesma data civil e continua sendo a autoridade.
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const part = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((current) => current.type === type)?.value ?? '';

  return `${part('year')}-${part('month')}-${part('day')}`;
}

function decimalToMicrounits(value: string): bigint {
  const [whole, fraction = ''] = value.split('.');
  return BigInt(whole) * MICRO_UNITS + BigInt(fraction.padEnd(6, '0'));
}

function isEquivalentPackageConversion(
  quantidadeBase: string,
  quantidadeEmbalagens: string,
  quantidadePorEmbalagem: string,
): boolean {
  const product = decimalToMicrounits(quantidadeEmbalagens)
    * decimalToMicrounits(quantidadePorEmbalagem);

  return product % MICRO_UNITS === BigInt(0)
    && product / MICRO_UNITS === decimalToMicrounits(quantidadeBase);
}

/** Decimal canônico compatível com NUMERIC(18,6), sem autoridade em float. */
export const DecimalSchema = z.string().regex(CANONICAL_DECIMAL_PATTERN);
export const PositiveDecimalSchema = z.string().regex(POSITIVE_CANONICAL_DECIMAL_PATTERN);
/** Saldo pode divergir temporariamente em fatos clínicos futuros; zero continua canônico. */
export const SignedDecimalSchema = z.string().regex(SIGNED_DECIMAL_PATTERN);
/** Quantidade de fato persistido: sinal é parte do fato, nunca um float. */
export const SignedNonZeroDecimalSchema = z.string().regex(SIGNED_NON_ZERO_DECIMAL_PATTERN);
export const IsoCalendarDateSchema = z.string().refine(isCalendarDate, {
  message: 'Informe uma data ISO válida.',
});

export const UnidadeBaseSchema = z.enum(['unidade', 'g', 'ml']);

export const TitularEstoqueSchema = z.discriminatedUnion('tipo', [
  z.strictObject({ tipo: z.literal('clinica') }),
  z.strictObject({ tipo: z.literal('dentista'), dentistaId: UuidSchema }),
]);

export type TitularEstoque = z.infer<typeof TitularEstoqueSchema>;

const ContextoOperacaoShape = {
  clinicaIdEsperada: UuidSchema,
  chaveIdempotencia: UuidSchema,
};

export const ContextoOperacaoEstoqueSchema = z.strictObject(ContextoOperacaoShape);

const NovoLoteSchema = z.strictObject({
  codigoFabricante: z.string().trim().min(1).max(120).nullable(),
  validadeISO: IsoCalendarDateSchema.nullable(),
});

const EmbalagemConferidaSchema = z.strictObject({
  quantidadeEmbalagens: PositiveDecimalSchema,
  quantidadePorEmbalagem: PositiveDecimalSchema,
  unidadeBase: UnidadeBaseSchema,
});

export const CadastrarItemSchema = z.strictObject({
  ...ContextoOperacaoShape,
  titular: TitularEstoqueSchema,
  nome: z.string().trim().min(1).max(120),
  unidadeBase: UnidadeBaseSchema,
  comportamento: z.literal('consumivel'),
  controlaLote: z.boolean(),
  minimo: DecimalSchema,
});

export type CadastrarItemInput = z.infer<typeof CadastrarItemSchema>;

export const EditarItemSchema = z.strictObject({
  ...ContextoOperacaoShape,
  itemId: UuidSchema,
  versaoEsperada: PositiveVersionSchema,
  nome: z.string().trim().min(1).max(120),
  minimo: DecimalSchema,
  ativo: z.boolean(),
  motivo: MotivoSchema,
});

export type EditarItemInput = z.infer<typeof EditarItemSchema>;

const ReceberMaterialBaseShape = {
  ...ContextoOperacaoShape,
  itemId: UuidSchema,
  versaoEsperada: PositiveVersionSchema,
  quantidadeBase: PositiveDecimalSchema,
  embalagemConferida: EmbalagemConferidaSchema.optional(),
  aceitarVencido: z.literal(true).optional(),
  motivoVencido: MotivoSchema.optional(),
};

export const ReceberMaterialSchema = z.union([
  z.strictObject({
    ...ReceberMaterialBaseShape,
    loteId: UuidSchema,
  }),
  z.strictObject({
    ...ReceberMaterialBaseShape,
    novoLote: NovoLoteSchema,
  }),
]).superRefine((input, context) => {
  if ((input.aceitarVencido === true) !== (input.motivoVencido !== undefined)) {
    context.addIssue({
      code: 'custom',
      path: ['motivoVencido'],
      message: 'O recebimento vencido exige confirmação e motivo.',
    });
  }

  if ('novoLote' in input && input.novoLote.validadeISO !== null
    && input.novoLote.validadeISO < saoPauloCalendarDate()
    && (input.aceitarVencido !== true || input.motivoVencido === undefined)) {
    context.addIssue({
      code: 'custom',
      path: ['aceitarVencido'],
      message: 'Recebimento de lote vencido exige confirmação e motivo.',
    });
  }

  if (!input.embalagemConferida) return;

  const { quantidadeEmbalagens, quantidadePorEmbalagem } = input.embalagemConferida;
  const baseValida = PositiveDecimalSchema.safeParse(input.quantidadeBase).success;
  const embalagensValidas = PositiveDecimalSchema.safeParse(quantidadeEmbalagens).success;
  const quantidadePorEmbalagemValida = PositiveDecimalSchema.safeParse(quantidadePorEmbalagem).success;
  if (!baseValida || !embalagensValidas || !quantidadePorEmbalagemValida) return;

  if (!isEquivalentPackageConversion(
    input.quantidadeBase,
    quantidadeEmbalagens,
    quantidadePorEmbalagem,
  )) {
    context.addIssue({
      code: 'custom',
      path: ['embalagemConferida'],
      message: 'A conversão da embalagem deve corresponder à quantidade base.',
    });
  }
});

export type ReceberMaterialInput = z.infer<typeof ReceberMaterialSchema>;

const MovimentoMaterialShape = {
  ...ContextoOperacaoShape,
  itemId: UuidSchema,
  loteId: UuidSchema,
  versaoEsperada: PositiveVersionSchema,
  quantidade: PositiveDecimalSchema,
  motivo: MotivoSchema,
};

export const ConsumirMaterialSchema = z.strictObject(MovimentoMaterialShape);
export const DescartarMaterialSchema = z.strictObject(MovimentoMaterialShape);

export type ConsumirMaterialInput = z.infer<typeof ConsumirMaterialSchema>;
export type DescartarMaterialInput = z.infer<typeof DescartarMaterialSchema>;

export const AjustarContagemSchema = z.strictObject({
  ...ContextoOperacaoShape,
  itemId: UuidSchema,
  loteId: UuidSchema,
  versaoEsperada: PositiveVersionSchema,
  quantidadeContada: DecimalSchema,
  motivo: MotivoSchema,
});

export type AjustarContagemInput = z.infer<typeof AjustarContagemSchema>;

export const TipoMovimentoCorrecaoSchema = z.enum(['entrada', 'consumo', 'descarte']);
export const CorrigirMovimentoSchema = z.strictObject({
  ...ContextoOperacaoShape,
  itemId: UuidSchema,
  movimentoId: UuidSchema,
  versaoEsperada: PositiveVersionSchema,
  motivo: MotivoSchema,
  aceitarVencido: z.literal(true).optional(),
  motivoVencido: MotivoSchema.optional(),
  substituicao: z.strictObject({
    tipo: TipoMovimentoCorrecaoSchema,
    quantidade: PositiveDecimalSchema,
  }),
}).superRefine((input, context) => {
  if ((input.aceitarVencido === true) !== (input.motivoVencido !== undefined)) {
    context.addIssue({
      code: 'custom',
      path: ['motivoVencido'],
      message: 'A correção de lote vencido exige confirmação e motivo.',
    });
  }
});

export type CorrigirMovimentoInput = z.infer<typeof CorrigirMovimentoSchema>;

export const EstoqueFiltroSchema = z.enum(['todos', 'baixo', 'validade', 'divergente', 'arquivados']);
const ItemCursorSchema = z.strictObject({ nome: z.string().trim().min(1).max(120), id: UuidSchema });
const MovimentoCursorSchema = z.strictObject({
  ocorridoEm: z.string().datetime({ offset: true }),
  id: UuidSchema,
});

export const ListarEstoqueSchema = z.strictObject({
  clinicaIdEsperada: UuidSchema,
  titular: TitularEstoqueSchema,
  busca: z.string().trim().max(120).default(''),
  filtro: EstoqueFiltroSchema.default('todos'),
  cursor: ItemCursorSchema.nullable().default(null),
  limite: z.number().int().min(1).max(50).default(25),
});

export type ListarEstoqueInput = z.infer<typeof ListarEstoqueSchema>;

export const DetalharEstoqueSchema = z.strictObject({
  clinicaIdEsperada: UuidSchema,
  itemId: UuidSchema,
  cursor: MovimentoCursorSchema.nullable().default(null),
  limite: z.number().int().min(1).max(50).default(25),
});

export type DetalharEstoqueInput = z.infer<typeof DetalharEstoqueSchema>;

export const ItemResumoSchema = z.strictObject({
  id: UuidSchema,
  nome: z.string().trim().min(1).max(120),
  unidadeBase: UnidadeBaseSchema,
  titular: TitularEstoqueSchema,
  controlaLote: z.boolean(),
  minimo: DecimalSchema,
  saldo: SignedDecimalSchema,
  ativo: z.boolean(),
  versao: PositiveVersionSchema,
  validadeProxima: IsoCalendarDateSchema.nullable(),
});

export type ItemResumo = z.infer<typeof ItemResumoSchema>;

export const LoteResumoSchema = z.strictObject({
  id: UuidSchema,
  codigoFabricante: z.string().trim().min(1).max(120).nullable(),
  validadeISO: IsoCalendarDateSchema.nullable(),
  semIdentificacao: z.boolean(),
  saldo: SignedDecimalSchema,
});

export type LoteResumo = z.infer<typeof LoteResumoSchema>;

export const TipoMovimentoEstoqueSchema = z.enum([
  'entrada',
  'consumo',
  'descarte',
  'ajuste',
  'reversao',
]);

export const MovimentoResumoSchema = z.strictObject({
  id: UuidSchema,
  loteId: UuidSchema,
  tipo: TipoMovimentoEstoqueSchema,
  quantidade: SignedNonZeroDecimalSchema,
  motivo: z.string().trim().min(1).max(500),
  ocorridoEm: z.string().datetime({ offset: true }),
  atorUsuarioId: UuidSchema,
  atorNome: z.string().trim().min(1).max(200),
  reversaoDe: UuidSchema.nullable(),
  corrigido: z.boolean(),
});

export type MovimentoResumo = z.infer<typeof MovimentoResumoSchema>;

export const CadastroItemResultDataSchema = z.strictObject({
  itemId: UuidSchema,
  versao: PositiveVersionSchema,
});

export type CadastroItemResultData = z.infer<typeof CadastroItemResultDataSchema>;

export const MutacaoEstoqueResultDataSchema = z.strictObject({
  itemId: UuidSchema,
  loteId: UuidSchema,
  movimentoId: UuidSchema.nullable(),
  saldo: SignedDecimalSchema,
  versao: PositiveVersionSchema,
});

export type MutacaoEstoqueResultData = z.infer<typeof MutacaoEstoqueResultDataSchema>;

export const CorrecaoMovimentoResultDataSchema = z.strictObject({
  ...MutacaoEstoqueResultDataSchema.shape,
  movimentoId: UuidSchema,
  reversaoId: UuidSchema,
});

export type CorrecaoMovimentoResultData = z.infer<typeof CorrecaoMovimentoResultDataSchema>;

export const ListarEstoqueResultDataSchema = z.strictObject({
  itens: z.array(ItemResumoSchema).max(50),
  proximoCursor: ItemCursorSchema.nullable(),
  total: z.number().int().nonnegative(),
});

export type ListarEstoqueResultData = z.infer<typeof ListarEstoqueResultDataSchema>;

export const DetalharEstoqueResultDataSchema = z.strictObject({
  item: ItemResumoSchema,
  lotes: z.array(LoteResumoSchema),
  movimentos: z.array(MovimentoResumoSchema).max(50),
  proximoCursor: MovimentoCursorSchema.nullable(),
});

export type DetalharEstoqueResultData = z.infer<typeof DetalharEstoqueResultDataSchema>;

export const EstoqueFailureCodeSchema = z.enum([
  'INVALIDO',
  'SEM_ACESSO',
  'NAO_ENCONTRADO',
  'CONFLITO',
  'CONTEXTO_ALTERADO',
  'SALDO_INSUFICIENTE',
  'INDISPONIVEL',
]);

export type EstoqueFailureCode = z.infer<typeof EstoqueFailureCodeSchema>;
export type EstoqueResult<TData> =
  | { ok: true; data: TData }
  | { ok: false; codigo: EstoqueFailureCode; mensagem: string };

export function createEstoqueResultSchema<TData extends z.ZodType>(
  dataSchema: TData,
): z.ZodDiscriminatedUnion<[
  z.ZodObject<{ ok: z.ZodLiteral<true>; data: TData }, z.core.$strict>,
  z.ZodObject<{
    ok: z.ZodLiteral<false>;
    codigo: typeof EstoqueFailureCodeSchema;
    mensagem: z.ZodString;
  }, z.core.$strict>,
], 'ok'> {
  return z.discriminatedUnion('ok', [
    z.strictObject({ ok: z.literal(true), data: dataSchema }),
    z.strictObject({
      ok: z.literal(false),
      codigo: EstoqueFailureCodeSchema,
      mensagem: z.string().min(1),
    }),
  ]);
}
