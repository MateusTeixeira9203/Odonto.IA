import { createClient } from '@/lib/supabase/server';
import type { ClinicRole } from '@/server/auth/clinic';

export type TimelineEventType =
  // Operacionais — visíveis para todos os roles
  | 'appointment_created'
  | 'appointment_rescheduled'
  | 'appointment_cancelled'
  | 'budget_created'
  | 'payment_registered'
  | 'patient_updated'
  // Clínicos — visíveis apenas para dentista/admin
  | 'consultation_created'
  /** R-46c (I3) — ficha origem='importado' nunca se apresenta como atendimento. */
  | 'history_imported';

export type TimelineEvent = {
  id: string;
  type: TimelineEventType;
  timestamp: string;
  title: string;
  description: string | null;
  actor?: string | null;
};

const OPERATIONAL_TYPES: TimelineEventType[] = [
  'appointment_created',
  'appointment_rescheduled',
  'appointment_cancelled',
  'budget_created',
  'payment_registered',
  'patient_updated',
];

const CLINICAL_TYPES: TimelineEventType[] = [
  'consultation_created',
  'history_imported',
];

/**
 * Retorna eventos de timeline de um paciente filtrados por role.
 * Secretária recebe apenas eventos operacionais.
 * Dentista/admin recebe todos os eventos visíveis na clínica.
 *
 * Filtragem ocorre server-side — nunca expõe dados clínicos ao client antes do filtro.
 */
export async function getVisibleTimelineEvents({
  patientId,
  clinicId,
  role,
  limit = 20,
  offset = 0,
}: {
  patientId: string;
  clinicId: string;
  role: ClinicRole;
  limit?: number;
  offset?: number;
}): Promise<TimelineEvent[]> {
  const supabase = await createClient();
  const isClinical = role === 'admin' || role === 'dentista';

  // Queries paralelas por fonte de eventos
  const [agendamentosResult, orcamentosResult, pagamentosResult, fichasResult] =
    await Promise.all([
      // Agendamentos → appointment_created / rescheduled / cancelled
      supabase
        .from('agendamentos')
        // R-67: FK nomeada. `agendamentos` chega em `dentistas` por dentista_id e por
        // created_by -- embed ambiguo derruba a query e a timeline nunca mostra consulta.
        .select('id, created_at, status, observacoes, dentista:dentistas!agendamentos_dentista_id_fkey(nome)')
        .eq('paciente_id', patientId)
        .eq('clinica_id', clinicId)
        .order('created_at', { ascending: false })
        .limit(limit),

      // Orçamentos → budget_created
      supabase
        .from('orcamentos')
        // R-67: `orcamentos` tem TRES caminhos pra `dentistas` (dentista_id,
        // aprovado_por_id, plano_definido_por_id). O autor e o dentista_id.
        .select('id, created_at, status, total, dentista:dentistas!orcamentos_dentista_id_fkey(nome)')
        .eq('paciente_id', patientId)
        .eq('clinica_id', clinicId)
        .order('created_at', { ascending: false })
        .limit(limit),

      // Pagamentos → payment_registered
      supabase
        .from('pagamentos')
        .select('id, created_at, valor, status, forma_pagamento')
        .eq('paciente_id', patientId)
        .eq('clinica_id', clinicId)
        .eq('status', 'pago')
        .order('created_at', { ascending: false })
        .limit(limit),

      // Fichas — apenas para dentista/admin
      isClinical
        ? supabase
            .from('fichas')
            // R-46c (I3) — `origem` decide o type/título; sem isso toda ficha vira
            // "Consulta realizada" hardcoded, mentindo sobre histórico transcrito (achado 3).
            .select('id, data_atendimento, queixa_principal, origem, dentista:dentistas!fichas_dentista_id_fkey(nome)')
            .eq('paciente_id', patientId)
            .eq('clinica_id', clinicId)
            .order('data_atendimento', { ascending: false })
            .limit(limit)
        : Promise.resolve({ data: null, error: null }),
    ]);

  const events: TimelineEvent[] = [];

  // Agendamentos
  for (const a of agendamentosResult.data ?? []) {
    const agendamento = a as unknown as {
      id: string;
      created_at: string;
      status: string;
      observacoes: string | null;
      dentista: { nome: string } | null;
    };

    let type: TimelineEventType = 'appointment_created';
    if (agendamento.status === 'cancelled') type = 'appointment_cancelled';
    else if (agendamento.status === 'rescheduled') type = 'appointment_rescheduled';

    events.push({
      id: `apt_${agendamento.id}`,
      type,
      timestamp: agendamento.created_at,
      title: type === 'appointment_cancelled'
        ? 'Consulta cancelada'
        : type === 'appointment_rescheduled'
          ? 'Consulta reagendada'
          : 'Consulta agendada',
      description: agendamento.observacoes,
      actor: (agendamento.dentista as { nome: string } | null)?.nome ?? null,
    });
  }

  // Orçamentos
  for (const o of orcamentosResult.data ?? []) {
    const orc = o as unknown as {
      id: string;
      created_at: string;
      status: string;
      total: number | null;
      dentista: { nome: string } | null;
    };

    const total = orc.total
      ? orc.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
      : null;

    events.push({
      id: `orc_${orc.id}`,
      type: 'budget_created',
      timestamp: orc.created_at,
      title: 'Orçamento criado',
      description: total ? `Total: ${total}` : null,
      actor: (orc.dentista as { nome: string } | null)?.nome ?? null,
    });
  }

  // Pagamentos
  for (const p of pagamentosResult.data ?? []) {
    const pag = p as {
      id: string;
      created_at: string;
      valor: number;
      forma_pagamento: string | null;
    };

    const valor = Number(pag.valor).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });
    const forma = pag.forma_pagamento
      ? { pix: 'PIX', dinheiro: 'Dinheiro', cartao_credito: 'Cartão de Crédito', cartao_debito: 'Cartão de Débito', boleto: 'Boleto', outro: 'Outro' }[pag.forma_pagamento] ?? pag.forma_pagamento
      : null;

    events.push({
      id: `pay_${pag.id}`,
      type: 'payment_registered',
      timestamp: pag.created_at,
      title: 'Pagamento registrado',
      description: forma ? `${valor} via ${forma}` : valor,
      actor: null,
    });
  }

  // Fichas (apenas dentista/admin)
  if (isClinical) {
    for (const f of fichasResult.data ?? []) {
      const ficha = f as unknown as {
        id: string;
        data_atendimento: string;
        queixa_principal: string | null;
        origem: 'modo_consulta' | 'manual' | 'importado';
        dentista: { nome: string } | null;
      };

      const importado = ficha.origem === 'importado';
      events.push({
        id: `fic_${ficha.id}`,
        type: importado ? 'history_imported' : 'consultation_created',
        timestamp: ficha.data_atendimento,
        title: importado ? 'Histórico importado' : 'Consulta realizada',
        description: ficha.queixa_principal,
        actor: (ficha.dentista as { nome: string } | null)?.nome ?? null,
      });
    }
  }

  // Ordena por timestamp desc, aplica offset + limit para paginação
  return events
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    .slice(offset, offset + limit);
}

/** Lista de tipos de evento visíveis por role — usar para validação client-side */
export function getVisibleEventTypes(role: ClinicRole): TimelineEventType[] {
  return role === 'secretaria' ? OPERATIONAL_TYPES : [...OPERATIONAL_TYPES, ...CLINICAL_TYPES];
}
