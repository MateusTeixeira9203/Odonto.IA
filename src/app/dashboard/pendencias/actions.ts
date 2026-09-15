'use server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { isTeamWorkspaceEnabled } from '@/server/auth/team-workspace-pilot';
import { listarPendencias as listOperation, operarPendencia as operation, salvarModelo as modelOperation } from '@/server/pendencias/operations';
import { OperarPendenciaSchema, type ModeloPendencia, type OperacaoPendenciaData, type PendenciasBoard, type PendenciasResult } from '@/server/pendencias/contracts';
import { criarAgendamento, atualizarAgendamento } from '@/app/dashboard/agendamentos/actions';
import { deleteGoogleCalendarEvent } from '@/lib/calendar/google-provider';
import { agendarPendenciaComoSecretaria } from '@/server/agenda/pendencias-bridge';

function unavailable<T>(): PendenciasResult<T> { return { ok: false, codigo: 'SEM_ACESSO', mensagem: 'Esta área não está disponível.' }; }
export async function listarContatos(input: unknown): Promise<PendenciasResult<PendenciasBoard>> {
  if (!isTeamWorkspaceEnabled()) return unavailable();
  return listOperation(input);
}
export async function operarContato(input: unknown): Promise<PendenciasResult<OperacaoPendenciaData>> {
  if (!isTeamWorkspaceEnabled()) return unavailable();
  const parsed = OperarPendenciaSchema.safeParse(input);
  if (!parsed.success) return { ok: false, codigo: 'INVALIDO', mensagem: 'Revise os dados antes de continuar.' };
  const result = await operation(parsed.data);
  if (result.ok) {
    const effect = result.data.agendaSideEffect;
    if (effect?.tipo === 'cancelado' && effect.googleEventId) {
      try { await deleteGoogleCalendarEvent(effect.dentistaId, effect.googleEventId); }
      catch { result.data.mensagem = 'Consulta cancelada na agenda. Não foi possível sincronizar o cancelamento com o Google Calendar.'; }
    }
    revalidatePath('/dashboard/agendamentos');
    revalidatePath('/dashboard/pendencias');
    revalidatePath('/pendencias');
  }
  return result;
}
export async function salvarModeloContato(input: unknown): Promise<PendenciasResult<ModeloPendencia>> {
  if (!isTeamWorkspaceEnabled()) return unavailable();
  return modelOperation(input);
}
const ScheduleSchema = z.strictObject({
  clinicaIdEsperada: z.string().uuid(), pendenciaId: z.string().uuid(), versaoEsperada: z.number().int().positive(),
  dataHora: z.string().datetime({ offset: true }), duracaoMinutos: z.number().int().min(5).max(480),
});
export async function agendarContato(input: unknown): Promise<PendenciasResult<OperacaoPendenciaData>> {
  if (!isTeamWorkspaceEnabled()) return unavailable();
  const parsed = ScheduleSchema.safeParse(input);
  if (!parsed.success || Date.parse(parsed.data.dataHora) <= Date.now()) return { ok: false, codigo: 'INVALIDO', mensagem: 'Revise a data, o horário e a duração.' };
  const data = parsed.data;
  const bridge = await agendarPendenciaComoSecretaria(data);
  if (bridge.handled) {
    if (!bridge.result.ok) return bridge.result;
    const completion = await operation({ acao: 'concluir_agendamento', clinicaIdEsperada: data.clinicaIdEsperada, pendenciaId: data.pendenciaId, versaoEsperada: data.versaoEsperada, agendamentoId: bridge.result.data.agendamentoId });
    revalidatePath('/dashboard/agendamentos');
    revalidatePath('/dashboard/pendencias');
    revalidatePath('/pendencias');
    if (!completion.ok) return { ok: false, codigo: completion.codigo, mensagem: 'O horário foi salvo na agenda, mas a pendência precisa ser atualizada. Atualize a lista antes de tentar novamente.' };
    return completion;
  }
  // A leitura RPC revalida vínculo, escopo e origem; não aceita paciente/dentista fornecido pelo browser.
  const board = await listOperation({ clinicaIdEsperada: data.clinicaIdEsperada });
  if (!board.ok) return board;
  const item = board.data.items.find(p => p.id === data.pendenciaId);
  if (!item?.capabilities.podeConcluirAgendamento) return unavailable();
  if (item.versao !== data.versaoEsperada || item.status !== 'esperando_resposta' || !item.envioConfirmado) return { ok: false, codigo: 'CONFLITO', mensagem: 'Este contato mudou. Atualize a lista antes de agendar.' };
  let id = item.agendamentoId;
  if (id) {
    const result = await atualizarAgendamento(id, { dataHora: data.dataHora, duracaoMinutos: data.duracaoMinutos, status: 'scheduled', dataHoraEsperada: item.dataHora ?? undefined, statusEsperado: 'scheduled' });
    if (result.error) return { ok: false, codigo: 'INVALIDO', mensagem: result.error };
  } else {
    const result = await criarAgendamento({ pacienteId: item.pacienteId, dentistaId: item.dentistaId, dataHora: data.dataHora, duracaoMinutos: data.duracaoMinutos, observacoes: null });
    if (result.error || !result.id) return { ok: false, codigo: 'INVALIDO', mensagem: result.error ?? 'Não foi possível confirmar o agendamento.' };
    id = result.id;
  }
  const completion = await operation({ acao: 'concluir_agendamento', clinicaIdEsperada: data.clinicaIdEsperada, pendenciaId: item.id, versaoEsperada: item.versao, agendamentoId: id });
  revalidatePath('/dashboard/agendamentos');
  revalidatePath('/dashboard/pendencias');
  revalidatePath('/pendencias');
  if (!completion.ok) return { ok: false, codigo: completion.codigo, mensagem: 'O horário foi salvo na agenda, mas a pendência precisa ser atualizada. Atualize a lista antes de tentar novamente.' };
  return completion;
}
