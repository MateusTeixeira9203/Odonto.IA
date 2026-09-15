import { z } from 'zod';

const UuidSchema = z.string().uuid().transform((value) => value.toLowerCase());
const VersionSchema = z.number().int().min(0).max(2_147_483_647);
const PositiveVersionSchema = VersionSchema.refine((value) => value > 0);
const TemplateSchema = z.string().trim().min(1).max(2_000);

export const PendenciaTipoSchema = z.enum(['confirmar_presenca', 'reativar_paciente']);
export type PendenciaTipo = z.infer<typeof PendenciaTipoSchema>;

export const PendenciaStatusSchema = z.enum(['a_contatar', 'esperando_resposta', 'resolvido']);
export type PendenciaStatus = z.infer<typeof PendenciaStatusSchema>;

export const PendenciaFailureCodeSchema = z.enum([
  'INVALIDO', 'SEM_ACESSO', 'NAO_ENCONTRADO', 'CONFLITO', 'CONTEXTO_ALTERADO', 'INDISPONIVEL',
]);
export type PendenciaFailureCode = z.infer<typeof PendenciaFailureCodeSchema>;

const CapabilitiesSchema = z.strictObject({
  podeVerContato: z.boolean(),
  podeAbrirWhatsApp: z.boolean(),
  podeGerirAcompanhamento: z.boolean(),
  podeRegistrarEnvio: z.boolean(),
  podeConfirmarAgenda: z.boolean(),
  podeCancelarAgenda: z.boolean(),
  podeConcluirAgendamento: z.boolean(),
});

export const PendenciaCardSchema = z.strictObject({
  id: UuidSchema,
  tipo: PendenciaTipoSchema,
  status: PendenciaStatusSchema,
  pacienteId: UuidSchema,
  pacienteNome: z.string().min(1).max(200),
  temTelefone: z.boolean(),
  dentistaId: UuidSchema,
  dentistaNome: z.string().min(1).max(200),
  agendamentoId: UuidSchema.nullable(),
  dataHora: z.string().datetime({ offset: true }).nullable(),
  duracaoMinutos: z.number().int().positive().max(1_440).nullable(),
  ultimaVisitaEm: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  responsavelUsuarioId: UuidSchema,
  envioConfirmado: z.boolean(),
  adiadoAte: z.string().datetime({ offset: true }).nullable(),
  resolucao: z.string().max(80).nullable(),
  versao: PositiveVersionSchema,
  // O modelo tem até 2.000 caracteres, mas os valores dos marcadores podem ampliar
  // a mensagem renderizada. Não rejeitar o board por causa dessa expansão.
  mensagem: z.string().min(1).max(6_000),
  capabilities: CapabilitiesSchema,
});
export type PendenciaCard = z.infer<typeof PendenciaCardSchema>;

export const ModeloPendenciaSchema = z.strictObject({
  dentistaId: UuidSchema,
  dentistaNome: z.string().min(1).max(200),
  tipo: PendenciaTipoSchema,
  ativo: z.boolean(),
  template: TemplateSchema,
  /** Zero representa o modelo padrão ainda não persistido pela clínica. */
  versao: VersionSchema,
  podeEditar: z.boolean(),
});
export type ModeloPendencia = z.infer<typeof ModeloPendenciaSchema>;

export const PendenciasBoardSchema = z.strictObject({
  clinicaId: UuidSchema,
  clinicaNome: z.string().min(1).max(200),
  items: z.array(PendenciaCardSchema).max(500),
  modelos: z.array(ModeloPendenciaSchema).max(500),
});
export type PendenciasBoard = z.infer<typeof PendenciasBoardSchema>;

export type PendenciasResult<T> =
  | { ok: true; data: T }
  | { ok: false; codigo: PendenciaFailureCode; mensagem: string };

const AgendaSideEffectSchema = z.strictObject({
  tipo: z.enum(['confirmado', 'cancelado']),
  googleEventId: z.string().min(1).max(500).nullable(),
  dentistaId: UuidSchema,
}).nullable();

const OperacaoDataSchema = z.strictObject({
  pendenciaId: UuidSchema,
  versao: PositiveVersionSchema,
  // Percent-encoding UTF-8 pode multiplicar substancialmente o tamanho da URL.
  whatsappUrl: z.string().url().max(25_000).nullable(),
  mensagem: z.string().min(1).max(6_000).nullable(),
  agendaSideEffect: AgendaSideEffectSchema,
});
export type OperacaoPendenciaData = z.infer<typeof OperacaoDataSchema>;

export const ListarPendenciasSchema = z.strictObject({
  clinicaIdEsperada: UuidSchema,
});

const BaseOperacao = {
  clinicaIdEsperada: UuidSchema,
  pendenciaId: UuidSchema,
  versaoEsperada: PositiveVersionSchema,
};

export const OperarPendenciaSchema = z.discriminatedUnion('acao', [
  z.strictObject({ acao: z.literal('preparar_abertura'), ...BaseOperacao, mensagem: TemplateSchema }),
  z.strictObject({ acao: z.literal('registrar_envio'), ...BaseOperacao }),
  z.strictObject({ acao: z.literal('nao_enviei'), ...BaseOperacao }),
  z.strictObject({ acao: z.literal('adiar'), ...BaseOperacao, adiadoAte: z.string().datetime({ offset: true }) }),
  z.strictObject({ acao: z.literal('resolver'), ...BaseOperacao }),
  z.strictObject({
    acao: z.literal('confirmar_agendamento'), ...BaseOperacao,
    agendamentoId: UuidSchema, dataHoraEsperada: z.string().datetime({ offset: true }),
  }),
  z.strictObject({
    acao: z.literal('cancelar_agendamento'), ...BaseOperacao,
    agendamentoId: UuidSchema, dataHoraEsperada: z.string().datetime({ offset: true }),
    confirmarCancelamento: z.literal(true),
  }),
  z.strictObject({ acao: z.literal('concluir_agendamento'), ...BaseOperacao, agendamentoId: UuidSchema }),
]);
export type OperarPendenciaInput = z.infer<typeof OperarPendenciaSchema>;

export const SalvarModeloSchema = z.strictObject({
  clinicaIdEsperada: UuidSchema,
  dentistaId: UuidSchema,
  tipo: PendenciaTipoSchema,
  ativo: z.boolean(),
  template: TemplateSchema,
  versaoEsperada: VersionSchema,
});

export const OperacaoResultSchema = z.discriminatedUnion('ok', [
  z.strictObject({ ok: z.literal(true), data: OperacaoDataSchema }),
  z.strictObject({ ok: z.literal(false), codigo: PendenciaFailureCodeSchema, mensagem: z.string().min(1) }),
]);

export const BoardResultSchema = z.discriminatedUnion('ok', [
  z.strictObject({ ok: z.literal(true), data: PendenciasBoardSchema }),
  z.strictObject({ ok: z.literal(false), codigo: PendenciaFailureCodeSchema, mensagem: z.string().min(1) }),
]);

export const ModeloResultSchema = z.discriminatedUnion('ok', [
  z.strictObject({ ok: z.literal(true), data: ModeloPendenciaSchema }),
  z.strictObject({ ok: z.literal(false), codigo: PendenciaFailureCodeSchema, mensagem: z.string().min(1) }),
]);
