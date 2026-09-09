import type { ComponenteGrupoOrcamento } from '@/lib/orcamentos/grupos';
import { createClient } from '@/lib/supabase/server';
import type { ClinicRole } from '@/server/auth/clinic';
import type { Paciente } from '@/types/database';
import type { AceiteOrcamento, TermosSnapshot } from '@/types/orcamento';
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
  composicao?: ComponenteGrupoOrcamento[] | null;
  id: string;
  descricao: string | null;
  preco_total: number | null;
  quantidade: number;
  /** R-114 — o paciente aprovou este item? Item não aprovado continua visível (esmaecido);
   *  só não conta no devido nem sai no PDF. */
  aprovado: boolean;
};

export type Pagamento = {
  id: string;
  cobranca_id: string | null;
  valor: number;
  status: string;
  forma_pagamento: string | null;
  data_pagamento: string | null;
  data_vencimento: string | null;
  parcela_numero: number | null;
  total_parcelas: number | null;
  marcado_por: { nome: string } | null;
};

export type CobrancaEtapa = {
  observacoes?: string | null;
  id: string;
  subtotal: number;
  desconto: number;
  valor_final: number;
  numero_parcelas: number;
  primeiro_vencimento: string;
  situacao: 'aberta' | 'cancelada';
  created_at: string;
  itens: { orcamento_item_id: string; preco_total_snapshot: number }[];
  pagamentos: Pagamento[];
};

export type OrcamentoComItens = {
  id: string;
  status: 'rascunho' | 'enviado' | 'aprovado' | 'recusado';
  total: number | null;
  /** R-114/R-130 — quando definido, é o valor negociado e portanto o devido. */
  valor_acordado: number | null;
  plano_forma?: string | null;
  desconto: number | null;
  created_at: string;
  validade_dias: number;
  condicoes_pagamento: string | null;
  /** R-38 — false esconde preço por item e Subtotal no PDF. Default true. */
  mostrar_valor_por_item: boolean;
  dentista_id: string | null;
  itens: OrcamentoItem[];
  pagamentos: Pagamento[];
  cobrancas: CobrancaEtapa[];
  aprovado_por: { nome: string } | null;
  aprovado_em: string | null;
  /** R-03c-1 — aceite assinado pelo paciente. null = ainda não coletado. */
  aceite: AceiteOrcamento | null;
};

/** Shape bruto de `assinaturas` embedado na query — 1 linha no máximo (índice único parcial
 * garante isso), mas o PostgREST sempre devolve array em relação reversa por FK. */
type AssinaturaOrcamentoRaw = {
  id: string;
  assinado_por: string;
  cro_no_ato: string | null;
  assinatura_ref: string;
  assinado_em: string;
  termos_snapshot: TermosSnapshot | null;
};

export type PatientWorkspaceData = {
  paciente: Paciente;
  agendamentoProximo: AgendamentoProximo | null;
  orcamentos: OrcamentoComItens[];
  /** A proposta continua visível quando a relação financeira complementar falha. */
  orcamentosAviso: string | null;
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
            // R-67: FK nomeada — `agendamentos` embeda `dentistas` por dentista_id
            // e por created_by; sem escolher, o embed e ambiguo e a lista volta vazia.
            'id, data_hora, duracao_minutos, status, observacoes, dentista:dentistas!agendamentos_dentista_id_fkey(nome)'
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
            // R-114 — valor_acordado entra pro devido derivado (I1); itens ganham `aprovado`.
            'id, status, total, valor_acordado, plano_forma, desconto, created_at, validade_dias, condicoes_pagamento, mostrar_valor_por_item, dentista_id, aprovado_em, aprovado_por:dentistas!orcamentos_aprovado_por_id_fkey(nome), itens:orcamento_itens(id, descricao, preco_total, quantidade, aprovado, composicao), pagamentos(id, cobranca_id, valor, status, forma_pagamento, data_pagamento, data_vencimento, parcela_numero, total_parcelas, marcado_por:dentistas!pagamentos_marcado_por_id_fkey(nome)), aceite:assinaturas!assinaturas_orcamento_id_fkey(id, assinado_por, cro_no_ato, assinatura_ref, assinado_em, termos_snapshot)'
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

  if (orcamentosResult.error) {
    console.error('[patient-workspace] falha ao carregar orçamento-base', {
      code: orcamentosResult.error.code,
      message: orcamentosResult.error.message,
    });
    throw new Error('Não foi possível carregar os orçamentos do paciente.');
  }

  // O embed reverso por FK (assinaturas ← orcamentos) sempre vem como array no PostgREST,
  // mesmo com o índice único parcial (migration 113) garantindo no máximo 1 linha — a
  // constraint é condicional (`where tipo='orcamento'`), e o PostgREST só infere to-one a
  // partir de unique constraint incondicional. Achata pra objeto|null aqui.
  type OrcamentoRaw = Omit<OrcamentoComItens, 'aceite' | 'cobrancas'> & {
    aceite: AssinaturaOrcamentoRaw[] | null;
  };
  const orcamentosRaw = (orcamentosResult.data as unknown as OrcamentoRaw[]) ?? [];
  const orcamentoIds = orcamentosRaw.map((orcamento) => orcamento.id);
  type CobrancaRaw = CobrancaEtapa & { orcamento_id: string };
  let cobrancasPorOrcamento = new Map<string, CobrancaEtapa[]>();
  let orcamentosAviso: string | null = null;

  if (orcamentoIds.length > 0) {
    const { data, error } = await supabase
      .from('orcamento_cobrancas')
      .select(
        'id, orcamento_id, observacoes, subtotal, desconto, valor_final, numero_parcelas, primeiro_vencimento, situacao, created_at, itens:orcamento_cobranca_itens!orcamento_cobranca_itens_cobranca_id_fkey(orcamento_item_id, preco_total_snapshot), pagamentos:pagamentos!pagamentos_cobranca_id_fkey(id, cobranca_id, valor, status, forma_pagamento, data_pagamento, data_vencimento, parcela_numero, total_parcelas, marcado_por:dentistas!pagamentos_marcado_por_id_fkey(nome))'
      )
      .eq('clinica_id', clinicId)
      .in('orcamento_id', orcamentoIds);

    if (error) {
      console.error('[patient-workspace] falha ao carregar cobranças do orçamento', {
        code: error.code,
        message: error.message,
      });
      orcamentosAviso = 'Os orçamentos foram carregados, mas os detalhes das cobranças não. Recarregue a página.';
    } else {
      cobrancasPorOrcamento = (data as unknown as CobrancaRaw[] ?? []).reduce(
        (porOrcamento, cobranca) => {
          const existentes = porOrcamento.get(cobranca.orcamento_id) ?? [];
          const detalhe: CobrancaEtapa = cobranca;
          porOrcamento.set(cobranca.orcamento_id, [...existentes, detalhe]);
          return porOrcamento;
        },
        new Map<string, CobrancaEtapa[]>(),
      );
    }
  }

  const orcamentos: OrcamentoComItens[] = orcamentosRaw.map((orc) => {
    const raw = orc.aceite?.[0] ?? null;
    return {
      ...orc,
      cobrancas: cobrancasPorOrcamento.get(orc.id) ?? [],
      aceite: raw && raw.termos_snapshot
        ? {
            id: raw.id,
            assinadoPor: raw.assinado_por,
            croNoAto: raw.cro_no_ato,
            assinadoEm: raw.assinado_em,
            assinaturaRef: raw.assinatura_ref,
            termos: raw.termos_snapshot,
          }
        : null,
    };
  });

  return {
    paciente: pacienteResult.data as Paciente,
    agendamentoProximo: (agendamentoResult.data as AgendamentoProximo | null) ?? null,
    orcamentos,
    orcamentosAviso,
    fichasRecentes: isClinical
      ? ((fichasResult.data as unknown as FichaRecente[]) ?? [])
      : [],
    timeline,
  };
}
