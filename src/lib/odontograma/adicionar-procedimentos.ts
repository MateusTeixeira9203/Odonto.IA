import { z } from 'zod';
import { montarRowsEventos } from '@/lib/odontograma/montar-rows-eventos';
import type { OdontogramaEventoDraft } from '@/types/odontograma';

const uuidSchema = z.string().uuid();
const dataSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const ancoraSchema = z.object({
  nivel: z.enum(['geral', 'boca', 'arcada', 'quadrante', 'dente', 'face']),
  arcada: z.enum(['superior', 'inferior']).optional(),
  quadrante: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5), z.literal(6), z.literal(7), z.literal(8)]).optional(),
  dente: z.number().int().optional(),
  faces: z.array(z.enum(['O', 'M', 'D', 'V', 'L'])).optional(),
}).superRefine((ancora, contexto) => {
  const faces = ancora.faces ?? [];
  const semDente = ancora.arcada === undefined && ancora.quadrante === undefined && ancora.dente === undefined && faces.length === 0;
  const ancoraGeral = ancora.nivel === 'geral' || ancora.nivel === 'boca';
  if (ancoraGeral && !semDente) {
    contexto.addIssue({ code: z.ZodIssueCode.custom, message: 'A localização geral não pode conter dente, arcada ou face.' });
  }
  if (ancora.nivel === 'arcada' && (ancora.arcada === undefined || ancora.quadrante !== undefined || ancora.dente !== undefined || faces.length > 0)) {
    contexto.addIssue({ code: z.ZodIssueCode.custom, message: 'A arcada precisa de uma arcada e não aceita dente ou faces.' });
  }
  if (ancora.nivel === 'quadrante' && (ancora.quadrante === undefined || ancora.arcada !== undefined || ancora.dente !== undefined || faces.length > 0)) {
    contexto.addIssue({ code: z.ZodIssueCode.custom, message: 'O quadrante precisa de um quadrante e não aceita dente ou faces.' });
  }
  if (ancora.nivel === 'dente' && (ancora.dente === undefined || ancora.arcada !== undefined || ancora.quadrante !== undefined || faces.length > 0)) {
    contexto.addIssue({ code: z.ZodIssueCode.custom, message: 'O dente precisa de um número FDI e não aceita faces.' });
  }
  if (ancora.nivel === 'face' && (ancora.dente === undefined || ancora.arcada !== undefined || ancora.quadrante !== undefined || faces.length === 0)) {
    contexto.addIssue({ code: z.ZodIssueCode.custom, message: 'A face precisa de um dente e ao menos uma face.' });
  }
});

const eventoSchema = z.object({
  id: uuidSchema,
  tipo: z.enum([
    'carie_restauracao', 'exodontia', 'endodontia', 'lesao_periapical', 'implante', 'coroa',
    'ponte', 'selante', 'inclusao', 'esfoliacao', 'fratura', 'pino_nucleo', 'profilaxia',
    'raspagem', 'clareamento', 'fluor', 'exame_periodontal', 'outro',
  ]),
  procedimentoId: uuidSchema.nullable().optional(),
  procedimentoNome: z.string().trim().min(1).max(500).nullable().optional(),
  status: z.enum(['indicado', 'realizado']),
  origem: z.enum(['clinica', 'preexistente']),
  momento_planejado: z.enum(['sessao_atual', 'proxima_sessao']),
  ancora: ancoraSchema,
  grupo_id: uuidSchema.nullable(),
  papel_no_grupo: z.enum(['pilar', 'pontico']).nullable(),
  observacao: z.string().trim().max(4_000),
  detalhe: z.unknown().nullable().optional(),
  realizado_em: dataSchema.nullable(),
  encaminhadoParaId: uuidSchema.nullable().optional(),
}).superRefine((evento, contexto) => {
  if (evento.status === 'indicado' && evento.realizado_em !== null) {
    contexto.addIssue({ code: z.ZodIssueCode.custom, message: 'Um procedimento indicado não pode ter data de realização.' });
  }
  if (evento.status === 'realizado' && evento.momento_planejado !== 'sessao_atual') {
    contexto.addIssue({ code: z.ZodIssueCode.custom, message: 'Um procedimento realizado não pode ser planejado para outra sessão.' });
  }
  if (evento.tipo === 'outro' && !evento.procedimentoNome && !evento.observacao) {
    contexto.addIssue({ code: z.ZodIssueCode.custom, message: 'Informe o nome clínico do procedimento livre.' });
  }
});

export const adicionarProcedimentosFichaSchema = z.object({
  fichaId: uuidSchema,
  pacienteId: uuidSchema,
  capturaId: uuidSchema,
  eventos: z.array(eventoSchema).min(1, 'Adicione ao menos um procedimento.'),
}).superRefine((input, contexto) => {
  const ids = new Set<string>();
  for (const [indice, evento] of input.eventos.entries()) {
    if (ids.has(evento.id)) {
      contexto.addIssue({ code: z.ZodIssueCode.custom, path: ['eventos', indice, 'id'], message: 'Cada procedimento do lote precisa de um identificador próprio.' });
    }
    ids.add(evento.id);
  }
});

export type AdicionarProcedimentosFichaInput = z.infer<typeof adicionarProcedimentosFichaSchema>;

export type MutacaoFichaResult =
  | { ok: true; fichaId: string; eventoIds: string[] }
  | { ok: false; error: string; code: 'INVALIDO' | 'SEM_PERMISSAO' | 'ASSINADO' | 'CONFLITO' | 'INDISPONIVEL' };

function paraDraft(evento: AdicionarProcedimentosFichaInput['eventos'][number]): OdontogramaEventoDraft {
  return {
    id: evento.id,
    tipo: evento.tipo,
    procedimentoId: evento.procedimentoId ?? null,
    procedimentoNome: evento.procedimentoNome ?? null,
    status: evento.status,
    origem: evento.origem,
    momento_planejado: evento.momento_planejado,
    ancora: {
      nivel: evento.ancora.nivel,
      ...(evento.ancora.arcada ? { arcada: evento.ancora.arcada } : {}),
      ...(evento.ancora.quadrante ? { quadrante: evento.ancora.quadrante } : {}),
      ...(evento.ancora.dente !== undefined ? { dente: evento.ancora.dente } : {}),
      ...(evento.ancora.faces?.length ? { faces: evento.ancora.faces } : {}),
    },
    grupo_id: evento.grupo_id,
    papel_no_grupo: evento.papel_no_grupo,
    observacao: evento.observacao,
    detalhe: evento.detalhe ?? null,
    realizado_em: evento.realizado_em,
    encaminhadoParaId: evento.encaminhadoParaId ?? null,
  };
}

/** Payload achatado, com identidade e contexto preenchidos exclusivamente no servidor. */
export function montarPayloadAdicionarProcedimentos(
  eventos: AdicionarProcedimentosFichaInput['eventos'],
  contexto: { clinicId: string; pacienteId: string; dentistaId: string; fichaId: string },
) {
  return montarRowsEventos(eventos.map(paraDraft), contexto);
}
