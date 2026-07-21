import { createClient } from '@/lib/supabase/server';
import type { ClinicRole } from '@/server/auth/clinic';
import type { Paciente } from '@/types/database';
import { getVisibleTimelineEvents, type TimelineEvent } from './get-visible-timeline-events';

export type FichaRecente = {
  id: string;
  created_at: string;
  data_atendimento: string;
  queixa_principal: string | null;
  anotacoes: string | null;
  dentista: { nome: string } | null;
};

export type AgendamentoProximo = {
  id: string;
  data_hora: string;
  duracao_minutos: number;
  status: string;
  observacoes: string | null;
  dentista: { nome: string } | null;
};

export type OrcamentoItem = {
  id: string;
  descricao: string | null;
  preco_total: number | null;
  quantidade: number;
};

export type Pagamento = {
  id: string;
  valor: number;
  status: string;
  forma_pagamento: string | null;
  data_pagamento: string | null;
  data_vencimento: string | null;
  parcela_numero: number | null;
  total_parcelas: number | null;
  marcado_por: { nome: string } | null;
};

export type OrcamentoComItens = {
  id: string;
  status: 'rascunho' | 'enviado' | 'aprovado' | 'recusado';
  total: number | null;
  created_at: string;
  validade_dias: number;
  condicoes_pagamento: string | null;
  dentista_id: string | null;
  itens: OrcamentoItem[];
  pagamentos: Pagamento[];
  aprovado_por: { nome: string } | null;
  aprovado_em: string | null;
};

export type PatientWorkspaceData = {
  paciente: Paciente;
  agendamentoProximo: AgendamentoProximo | null;
  orcamentos: OrcamentoComItens[];
  fichasRecentes: FichaRecente[];
  timeline: TimelineEvent[];
};

/**
 * Carrega dados do workspace do paciente com filtragem server-side por role.
 * Fichas clínicas são retornadas apenas para admin/dentista.
 * Retorna null se o paciente não pertencer à clínica.
 */
export async function getPatientWorkspaceData({
  patientId,
  clinicId,
  role,
}: {
  patientId: string;
  clinicId: string;
  role: ClinicRole;
}): Promise<PatientWorkspaceData | null> {
  const supabase = await createClient();
  const isClinical = role === 'admin' || role === 'dentista';

  const [[pacienteResult, agendamentoResult, orcamentosResult, fichasResult], timeline] =
    await Promise.all([
      Promise.all([
        supabase
          .from('pacientes')
          .select('*')
          .eq('id', patientId)
          .eq('clinica_id', clinicId)
          .maybeSingle(),

        supabase
          .from('agendamentos')
          .select(
            'id, data_hora, duracao_minutos, status, observacoes, dentista:dentistas(nome)'
          )
          .eq('paciente_id', patientId)
          .eq('clinica_id', clinicId)
          .gte('data_hora', new Date().toISOString())
          .order('data_hora', { ascending: true })
          .limit(1)
          .maybeSingle(),

        supabase
          .from('orcamentos')
          .select(
            'id, status, total, created_at, validade_dias, condicoes_pagamento, dentista_id, aprovado_em, aprovado_por:dentistas!orcamentos_aprovado_por_id_fkey(nome), itens:orcamento_itens(id, descricao, preco_total, quantidade), pagamentos(id, valor, status, forma_pagamento, data_pagamento, data_vencimento, parcela_numero, total_parcelas, marcado_por:dentistas!pagamentos_marcado_por_id_fkey(nome))'
          )
          .eq('paciente_id', patientId)
          .eq('clinica_id', clinicId)
          .order('created_at', { ascending: false }),

        // Fichas clínicas: apenas para admin/dentista — secretária não acessa
        isClinical
          ? supabase
              .from('fichas')
              .select(
                'id, created_at, data_atendimento, queixa_principal, anotacoes, dentista:dentistas(nome)'
              )
              .eq('paciente_id', patientId)
              .eq('clinica_id', clinicId)
              .order('data_atendimento', { ascending: false })
              .limit(5)
          : Promise.resolve({ data: null, error: null }),
      ]),

      // Timeline filtrada server-side — corre em paralelo com as queries acima
      getVisibleTimelineEvents({ patientId, clinicId, role, limit: 20 }),
    ]);

  if (!pacienteResult.data) return null;

  return {
    paciente: pacienteResult.data as Paciente,
    agendamentoProximo: (agendamentoResult.data as AgendamentoProximo | null) ?? null,
    orcamentos: (orcamentosResult.data as unknown as OrcamentoComItens[]) ?? [],
    fichasRecentes: isClinical
      ? ((fichasResult.data as unknown as FichaRecente[]) ?? [])
      : [],
    timeline,
  };
}
