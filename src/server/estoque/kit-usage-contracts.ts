import { z } from 'zod';
import {
  type EstoqueFailureCode,
  type EstoqueResult,
  PositiveDecimalSchema,
  TitularEstoqueSchema,
} from './contracts';

const UuidSchema = z.string().uuid().transform((value) => value.toLowerCase());
const PositiveVersionSchema = z.number().int().positive().max(2_147_483_647);
const ContextoSchema = {
  clinicaIdEsperada: UuidSchema,
  chaveIdempotencia: UuidSchema,
};

const ComponenteKitSchema = z.strictObject({
  itemId: UuidSchema,
  quantidadeBase: PositiveDecimalSchema,
});

export const CadastrarKitSchema = z.strictObject({
  ...ContextoSchema,
  titular: TitularEstoqueSchema,
  nome: z.string().trim().min(1).max(120),
  componentes: z.array(ComponenteKitSchema).min(1).max(50),
}).superRefine((input, context) => {
  const itemIds = input.componentes.map((componente) => componente.itemId);
  if (new Set(itemIds).size !== itemIds.length) {
    context.addIssue({ code: 'custom', path: ['componentes'], message: 'Não repita um material no kit.' });
  }
});

export const EditarKitSchema = z.strictObject({
  ...ContextoSchema,
  kitId: UuidSchema,
  versaoEsperada: PositiveVersionSchema,
  nome: z.string().trim().min(1).max(120),
  componentes: z.array(ComponenteKitSchema).min(1).max(50),
}).superRefine((input, context) => {
  const itemIds = input.componentes.map((componente) => componente.itemId);
  if (new Set(itemIds).size !== itemIds.length) {
    context.addIssue({ code: 'custom', path: ['componentes'], message: 'Não repita um material no kit.' });
  }
});

export const UsoDeclaradoSchema = z.strictObject({
  linhaOrigemId: UuidSchema,
  itemId: UuidSchema,
  loteId: UuidSchema,
  quantidade: PositiveDecimalSchema,
  kitVersaoId: UuidSchema.nullable(),
});

export const DeclararUsosSchema = z.strictObject({
  ...ContextoSchema,
  atendimentoId: UuidSchema,
  linhas: z.array(UsoDeclaradoSchema).min(1).max(50),
}).superRefine((input, context) => {
  const linhaIds = input.linhas.map((linha) => linha.linhaOrigemId);
  if (new Set(linhaIds).size !== linhaIds.length) {
    context.addIssue({ code: 'custom', path: ['linhas'], message: 'Cada linha da ficha só pode ser declarada uma vez.' });
  }
});

const DivergenciaAceitaSchema = z.strictObject({
  usoId: UuidSchema,
  versaoItemEsperada: PositiveVersionSchema,
});

export const ConfirmarUsosSchema = z.strictObject({
  ...ContextoSchema,
  atendimentoId: UuidSchema,
  usoIds: z.array(UuidSchema).min(1).max(50),
  divergenciasAceitas: z.array(DivergenciaAceitaSchema).max(50),
}).superRefine((input, context) => {
  if (new Set(input.usoIds).size !== input.usoIds.length) {
    context.addIssue({ code: 'custom', path: ['usoIds'], message: 'Não repita um uso.' });
  }
  const divergencias = input.divergenciasAceitas.map((item) => item.usoId);
  if (new Set(divergencias).size !== divergencias.length || divergencias.some((id) => !input.usoIds.includes(id))) {
    context.addIssue({ code: 'custom', path: ['divergenciasAceitas'], message: 'A divergência precisa pertencer ao uso confirmado.' });
  }
});

export const CorrigirUsoSchema = z.strictObject({
  ...ContextoSchema,
  atendimentoId: UuidSchema,
  usoId: UuidSchema,
  revisaoEsperada: PositiveVersionSchema,
  substituicao: z.strictObject({
    itemId: UuidSchema,
    loteId: UuidSchema,
    quantidade: PositiveDecimalSchema,
    kitVersaoId: UuidSchema.nullable(),
    versaoItemEsperada: PositiveVersionSchema,
  }),
  aceitarDivergencia: z.boolean(),
});

export const KitResultDataSchema = z.strictObject({
  kitId: UuidSchema,
  kitVersaoId: UuidSchema,
  versao: PositiveVersionSchema,
});
export type KitResultData = z.infer<typeof KitResultDataSchema>;

const EstadoUsoSchema = z.enum(['pendente_autorizacao', 'confirmado', 'confirmado_divergente']);
export const UsosResultDataSchema = z.strictObject({
  usos: z.array(z.strictObject({
    usoId: UuidSchema,
    linhaOrigemId: UuidSchema.optional(),
    movimentoId: UuidSchema.optional(),
    estado: EstadoUsoSchema,
  })).min(1).max(50),
});
export type UsosResultData = z.infer<typeof UsosResultDataSchema>;

export const CorrecaoUsoResultDataSchema = z.strictObject({
  usoId: UuidSchema,
  revisao: PositiveVersionSchema,
  movimentoId: UuidSchema,
  reversaoId: UuidSchema,
  estado: z.enum(['confirmado', 'confirmado_divergente']),
});
export type CorrecaoUsoResultData = z.infer<typeof CorrecaoUsoResultDataSchema>;

export const ListarKitsSchema = z.strictObject({ clinicaIdEsperada: UuidSchema, titular: TitularEstoqueSchema });
export const ListarUsosSchema = z.strictObject({ clinicaIdEsperada: UuidSchema, atendimentoId: UuidSchema });
export const PrevisualizarConfirmacaoUsosSchema = z.strictObject({
  clinicaIdEsperada: UuidSchema,
  atendimentoId: UuidSchema,
  usoIds: z.array(UuidSchema).min(1).max(50),
}).superRefine((input, context) => {
  if (new Set(input.usoIds).size !== input.usoIds.length) {
    context.addIssue({ code: 'custom', path: ['usoIds'], message: 'Não repita um uso.' });
  }
});
export const KitsResultDataSchema = z.strictObject({ kits: z.array(z.strictObject({ kitId: UuidSchema, kitVersaoId: UuidSchema, nome: z.string().min(1).max(120), versao: PositiveVersionSchema, componentes: z.array(z.strictObject({ itemId: UuidSchema, nome: z.string().min(1).max(120), unidade: z.enum(['unidade', 'g', 'ml']), quantidade: PositiveDecimalSchema })).max(50) })).max(100) });
export const UsosListResultDataSchema = z.strictObject({ usos: z.array(z.strictObject({ usoId: UuidSchema, linhaOrigemId: UuidSchema, revisao: PositiveVersionSchema, material: z.string().min(1).max(120), quantidade: PositiveDecimalSchema, unidade: z.enum(['unidade', 'g', 'ml']), itemId: UuidSchema, loteId: UuidSchema, kitVersaoId: UuidSchema.nullable(), estado: z.enum(['pendente_autorizacao', 'confirmado', 'confirmado_divergente', 'substituido', 'cancelado']), movimentoId: UuidSchema.nullable() })).max(200) });
export const PrevisualizacaoConfirmacaoUsosResultDataSchema = z.strictObject({
  insuficientes: z.array(z.strictObject({ usoId: UuidSchema, versaoItemEsperada: PositiveVersionSchema })).max(50),
});
export type KitsResultData = z.infer<typeof KitsResultDataSchema>;
export type UsosListResultData = z.infer<typeof UsosListResultDataSchema>;
export type PrevisualizacaoConfirmacaoUsosResultData = z.infer<typeof PrevisualizacaoConfirmacaoUsosResultDataSchema>;

export type KitUsageResult<TData> = EstoqueResult<TData>;
export type KitUsageFailureCode = EstoqueFailureCode;
