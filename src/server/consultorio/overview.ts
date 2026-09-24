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
};

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
    client.from('orcamentos').select('id, total').eq('clinica_id', clinicaId).eq('status', 'enviado').lt('enviado_em', seteDiasAtras),
    client.from('pacientes').select('id', { count: 'exact', head: true }).eq('clinica_id', clinicaId).eq('followup_pendente', true),
    client.from('pagamentos').select('id, valor').eq('clinica_id', clinicaId).eq('status', 'pendente').lt('data_vencimento', hojeISO),
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
      pacientesParaReativar: followupsResult.count ?? 0,
      pagamentosVencidos: {
        quantidade: (overdueResult.data ?? []).length,
        valor: (overdueResult.data ?? []).reduce((sum, item) => sum + Number(item.valor ?? 0), 0),
      },
    },
  };
}
