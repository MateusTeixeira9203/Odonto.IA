import { endOfMonth, startOfMonth, subDays } from 'date-fns';
import { z } from 'zod';

import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { getClinicHubContext } from './context';

const MonthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);

export type ClinicOverviewData = {
  novosPacientes: number;
  pacientesComOrcamento: number;
  pacientesComAprovacao: number;
  retornosAgendados: number;
  orcamentosSemRetorno: { quantidade: number; valor: number };
  pacientesParaReativar: number;
  pagamentosVencidos: { quantidade: number; valor: number };
  filas: {
    reativacao: QueuePatient[];
    orcamentosSemRetorno: QueueBudget[];
    pagamentosVencidos: QueuePayment[];
  };
};

export type QueuePatient = { id: string; nome: string; telefone: string | null };
export type QueueBudget = QueuePatient & { orcamentoId: string; valor: number };
export type QueuePayment = QueuePatient & { pagamentoId: string; valor: number; vencimento: string | null };

export type ClinicOverviewResult =
  | { ok: true; data: ClinicOverviewData }
  | { ok: false; mensagem: string };

export async function getClinicOverview(clinicaId: string, mes: string): Promise<ClinicOverviewResult> {
  if (!z.string().uuid().safeParse(clinicaId).success || !MonthSchema.safeParse(mes).success) {
    return { ok: false, mensagem: 'Período ou clínica inválidos.' };
  }
  const [year, month] = mes.split('-').map(Number);
  const reference = new Date(year, month - 1, 1);
  const inicio = startOfMonth(reference).toISOString();
  const fim = endOfMonth(reference).toISOString();
  const hoje = new Date();
  const seteDiasAtras = subDays(hoje, 7).toISOString();
  const hojeISO = hoje.toISOString().slice(0, 10);
  const context = await getClinicHubContext();
  if (!context.ok || context.data.member.clinicaId !== clinicaId) {
    return { ok: false, mensagem: 'Sem acesso aos indicadores desta clínica.' };
  }
  const readsWholeClinic = context.data.governanca?.papeis.some((role) => role === 'proprietario' || role === 'gestor') === true;
  const client = readsWholeClinic ? createServiceClient() : await createClient();

  const [patientsResult, budgetsResult, staleBudgetsResult, followupsResult, overdueResult] = await Promise.all([
    client.from('pacientes').select('id').eq('clinica_id', clinicaId).gte('created_at', inicio).lte('created_at', fim),
    client.from('orcamentos').select('paciente_id, status').eq('clinica_id', clinicaId).gte('created_at', inicio).lte('created_at', fim),
    client.from('orcamentos').select('id, paciente_id, total').eq('clinica_id', clinicaId).eq('status', 'enviado').lt('enviado_em', seteDiasAtras).limit(100),
    client.from('pacientes').select('id, nome, telefone').eq('clinica_id', clinicaId).eq('followup_pendente', true).limit(100),
    client.from('pagamentos').select('id, paciente_id, valor, data_vencimento').eq('clinica_id', clinicaId).eq('status', 'pendente').lt('data_vencimento', hojeISO).limit(100),
  ]);

  const firstError = patientsResult.error ?? budgetsResult.error ?? staleBudgetsResult.error ?? followupsResult.error ?? overdueResult.error;
  if (firstError) {
    console.error('[consultorio/overview] consulta falhou:', firstError.message);
    return { ok: false, mensagem: 'Não foi possível carregar os indicadores da clínica agora.' };
  }

  const newPatientIds = new Set((patientsResult.data ?? []).map((item) => item.id as string));
  const budgetPatients = new Set<string>();
  const approvedPatients = new Set<string>();
  for (const budget of budgetsResult.data ?? []) {
    const patientId = budget.paciente_id as string;
    if (!newPatientIds.has(patientId)) continue;
    budgetPatients.add(patientId);
    if (budget.status === 'aprovado') approvedPatients.add(patientId);
  }

  let returns = 0;
  if (approvedPatients.size > 0) {
    const appointments = await client.from('agendamentos').select('paciente_id')
      .eq('clinica_id', clinicaId)
      .in('paciente_id', [...approvedPatients])
      .gte('data_hora', hoje.toISOString())
      .not('status', 'in', '(cancelled,no_show,cancelado,faltou)');
    if (appointments.error) {
      console.error('[consultorio/overview] retornos falharam:', appointments.error.message);
      return { ok: false, mensagem: 'Não foi possível carregar os indicadores da clínica agora.' };
    }
    returns = new Set((appointments.data ?? []).map((item) => item.paciente_id as string)).size;
  }

  const followupCandidates = (followupsResult.data ?? []).map((item) => ({ id: item.id as string, nome: String(item.nome ?? 'Paciente'), telefone: item.telefone == null ? null : String(item.telefone) }));
  const queuePatientIds = [...new Set([
    ...followupCandidates.map((item) => item.id),
    ...(staleBudgetsResult.data ?? []).map((item) => item.paciente_id as string),
    ...(overdueResult.data ?? []).map((item) => item.paciente_id as string),
  ])];
  const patientDetails = queuePatientIds.length === 0
    ? { data: [], error: null }
    : await client.from('pacientes').select('id, nome, telefone').eq('clinica_id', clinicaId).in('id', queuePatientIds);
  if (patientDetails.error) {
    console.error('[consultorio/overview] filas falharam:', patientDetails.error.message);
    return { ok: false, mensagem: 'Não foi possível carregar os indicadores da clínica agora.' };
  }
  const patientById = new Map((patientDetails.data ?? []).map((item) => [item.id as string, { id: item.id as string, nome: String(item.nome ?? 'Paciente'), telefone: item.telefone == null ? null : String(item.telefone) }]));
  const futureAppointments = followupCandidates.length === 0
    ? { data: [], error: null }
    : await client.from('agendamentos').select('paciente_id').eq('clinica_id', clinicaId).in('paciente_id', followupCandidates.map((item) => item.id)).gte('data_hora', hoje.toISOString()).not('status', 'in', '(cancelado,faltou,cancelled,no_show)');
  if (futureAppointments.error) {
    console.error('[consultorio/overview] retornos de fila falharam:', futureAppointments.error.message);
    return { ok: false, mensagem: 'Não foi possível carregar os indicadores da clínica agora.' };
  }
  const scheduledPatientIds = new Set((futureAppointments.data ?? []).map((item) => item.paciente_id as string));
  const reactivationQueue = followupCandidates.filter((item) => !scheduledPatientIds.has(item.id));
  const staleBudgetQueue = (staleBudgetsResult.data ?? []).flatMap((item) => {
    const patient = patientById.get(item.paciente_id as string);
    return patient ? [{ ...patient, orcamentoId: item.id as string, valor: Number(item.total ?? 0) }] : [];
  });
  const overdueQueue = (overdueResult.data ?? []).flatMap((item) => {
    const patient = patientById.get(item.paciente_id as string);
    return patient ? [{ ...patient, pagamentoId: item.id as string, valor: Number(item.valor ?? 0), vencimento: item.data_vencimento == null ? null : String(item.data_vencimento) }] : [];
  });

  return {
    ok: true,
    data: {
      novosPacientes: newPatientIds.size,
      pacientesComOrcamento: budgetPatients.size,
      pacientesComAprovacao: approvedPatients.size,
      retornosAgendados: returns,
      orcamentosSemRetorno: {
        quantidade: (staleBudgetsResult.data ?? []).length,
        valor: (staleBudgetsResult.data ?? []).reduce((sum, item) => sum + Number(item.total ?? 0), 0),
      },
      pacientesParaReativar: reactivationQueue.length,
      pagamentosVencidos: {
        quantidade: (overdueResult.data ?? []).length,
        valor: (overdueResult.data ?? []).reduce((sum, item) => sum + Number(item.valor ?? 0), 0),
      },
      filas: { reativacao: reactivationQueue, orcamentosSemRetorno: staleBudgetQueue, pagamentosVencidos: overdueQueue },
    },
  };
}
