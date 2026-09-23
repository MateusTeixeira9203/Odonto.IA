'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import {
  registrarAtendimentoClinico,
  type RegistrarAtendimentoClinicoResult,
} from '@/server/patients/registrar-atendimento-clinico';
import { ortoManutencaoSchema } from '@/lib/especialidades/orto';
import {
  confirmarUsos,
  corrigirUso,
  declararUsos,
  listarUsosDaFicha,
  previsualizarConfirmacaoUsos,
} from '@/app/dashboard/meu-consultorio/estoque/actions';
import type {
  CorrecaoUsoResultData,
  KitUsageResult,
  PrevisualizacaoConfirmacaoUsosResultData,
  UsosListResultData,
  UsosResultData,
} from '@/server/estoque/kit-usage-contracts';
import type { OdontogramaEventoDraft, OrtoManutencaoInfo } from '@/types/odontograma';

const tipoRegistroSchema = z.enum([
  'carie_restauracao', 'exodontia', 'endodontia', 'lesao_periapical', 'implante', 'coroa',
  'ponte', 'selante', 'inclusao', 'esfoliacao', 'fratura', 'pino_nucleo', 'profilaxia',
  'raspagem', 'clareamento', 'fluor', 'exame_periodontal', 'outro',
]);

const ancoraClinicaSchema = z.object({
  nivel: z.enum(['geral', 'boca', 'arcada', 'quadrante', 'dente', 'face']),
  arcada: z.enum(['superior', 'inferior']).optional(),
  quadrante: z.number().int().min(1).max(8).optional(),
  dente: z.number().int().min(11).max(85).optional(),
  faces: z.array(z.enum(['O', 'M', 'D', 'V', 'L'])).max(5).optional(),
});

const eventoOdontogramaSchema = z.object({
  id: z.string().uuid(),
  tipo: tipoRegistroSchema,
  procedimentoId: z.string().uuid().nullable().optional(),
  procedimentoNome: z.string().trim().max(500).nullable().optional(),
  status: z.enum(['indicado', 'realizado']),
  origem: z.enum(['clinica', 'preexistente']),
  momento_planejado: z.enum(['sessao_atual', 'proxima_sessao']),
  ancora: ancoraClinicaSchema,
  grupo_id: z.string().uuid().nullable(),
  papel_no_grupo: z.enum(['pilar', 'pontico']).nullable(),
  observacao: z.string().max(5_000),
  realizado_em: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  detalhe: z.unknown().nullable().optional(),
  evidencia_status: z.enum(['execucao_explicita', 'indicacao_explicita', 'negacao', 'historico', 'ambiguo']).optional(),
  revisar_status: z.boolean().optional(),
  assinaturaId: z.string().uuid().nullable().optional(),
  fonteFluxo: z.enum(['planejado', 'novo']).optional(),
  encaminhadoParaId: z.string().uuid().nullable().optional(),
  chaveCaptura: z.string().max(200).optional(),
  registrado_em: z.string().datetime().optional(),
  created_at: z.string().datetime().optional(),
  endo_revisao: z.object({
    origemPorCampo: z.record(z.string(), z.enum(['deterministico', 'ia', 'manual'])),
    duvidas: z.array(z.object({
      campo: z.string().max(120),
      trecho: z.string().max(1_000),
      motivo: z.enum(['sem_canal', 'fora_da_faixa', 'resolucao_invalida', 'conflito']),
    })).max(30),
  }).optional(),
}).superRefine((evento, ctx) => {
  if (evento.status === 'realizado' && evento.momento_planejado !== 'sessao_atual') {
    ctx.addIssue({ code: 'custom', path: ['momento_planejado'], message: 'Procedimento realizado não pode ficar para próxima sessão.' });
  }
  if (evento.status === 'indicado' && evento.realizado_em != null) {
    ctx.addIssue({ code: 'custom', path: ['realizado_em'], message: 'Procedimento indicado não tem data de realização.' });
  }
});

const registrarProntuarioSchema = z.object({
  visitaKey: z.string().uuid(),
  fichaId: z.string().uuid().optional(),
  pacienteId: z.string().uuid(),
  textoVisita: z.string().trim().max(5_000),
  eventosDraft: z.array(eventoOdontogramaSchema).max(200),
  alertaNovo: z.string().trim().max(500).nullable(),
  ortoManutencao: ortoManutencaoSchema.nullable(),
  destinoNovos: z.object({ fichaId: z.string().uuid().nullable() }),
});

/**
 * R-140c — mesma orquestração de visita do Meu Dia, mas sem criar nem concluir agenda.
 * A identidade, clínica e permissão são sempre resolvidas no servidor.
 */
export async function salvarAtendimentoDoProntuario(input: {
  visitaKey: string;
  fichaId?: string;
  pacienteId: string;
  textoVisita: string;
  eventosDraft: OdontogramaEventoDraft[];
  alertaNovo: string | null;
  ortoManutencao: OrtoManutencaoInfo | null;
  destinoNovos: { fichaId: string | null };
}): Promise<RegistrarAtendimentoClinicoResult> {
  const parsed = registrarProntuarioSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Dados clínicos inválidos. Revise o registro antes de salvar.' };

  const result = await registrarAtendimentoClinico({
    visitaKey: parsed.data.visitaKey,
    fichaId: parsed.data.fichaId,
    pacienteId: parsed.data.pacienteId,
    textoVisita: parsed.data.textoVisita,
    eventosDraft: parsed.data.eventosDraft as OdontogramaEventoDraft[],
    alertaNovo: parsed.data.alertaNovo,
    ortoManutencao: parsed.data.ortoManutencao,
    destinoNovos: parsed.data.destinoNovos,
    origemAtendimento: 'ficha',
  });

  if (result.ok && !result.eventosFalharam) {
    revalidatePath(`/dashboard/pacientes/${parsed.data.pacienteId}`);
  }
  return result;
}

/** A ficha continua salvável separadamente; estas ações só registram ou conciliam o estoque. */
export async function declararMateriaisDaFicha(input: unknown): Promise<KitUsageResult<UsosResultData>> {
  return declararUsos(input);
}

export async function confirmarMateriaisDaFicha(input: unknown): Promise<KitUsageResult<UsosResultData>> {
  return confirmarUsos(input);
}

export async function corrigirMaterialDaFicha(input: unknown): Promise<KitUsageResult<CorrecaoUsoResultData>> {
  return corrigirUso(input);
}

export async function listarMateriaisDaFicha(input: unknown): Promise<KitUsageResult<UsosListResultData>> {
  return listarUsosDaFicha(input);
}

export async function previsualizarConfirmacaoMateriaisDaFicha(
  input: unknown,
): Promise<KitUsageResult<PrevisualizacaoConfirmacaoUsosResultData>> {
  return previsualizarConfirmacaoUsos(input);
}
