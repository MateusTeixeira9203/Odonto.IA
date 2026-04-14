import { redirect } from 'next/navigation';
import { getDentistaCached } from '@/lib/get-dentista';
import { createClient } from '@/lib/supabase/server';
import { OrcamentosClient } from './_components/orcamentos-client';
import { PageTransition } from '@/components/layout/page-transition';

export type OrcamentoItemRow = {
  id: string;
  orcamento_id: string;
  descricao: string | null;
  quantidade: number;
  preco_unitario: number | null;
  preco_total: number | null;
};

export type PagamentoRow = {
  id: string;
  orcamento_id: string;
  valor: number;
  status: string;
  forma_pagamento: string | null;
  data_pagamento: string | null;
};

export type OrcamentoRow = {
  id: string;
  created_at: string;
  status: 'rascunho' | 'enviado' | 'aprovado' | 'recusado';
  total: number | null;
  validade_dias: number;
  condicoes_pagamento: string | null;
  paciente: { id: string; nome: string; telefone: string | null } | null;
  dentista: { id: string; nome: string } | null;
  itens: OrcamentoItemRow[];
  pagamentos: PagamentoRow[];
};

export default async function OrcamentosPage() {
  const dentista = await getDentistaCached();
  if (!dentista) redirect('/login');

  const supabase = await createClient();

  // Verifica se há secretária na clínica
  const { count: secretariaCount } = await supabase
    .from('dentistas')
    .select('id', { count: 'exact', head: true })
    .eq('clinica_id', dentista.clinica_id)
    .eq('role', 'secretaria');
  const temSecretaria = (secretariaCount ?? 0) > 0;

  // Busca orçamentos com joins de paciente e dentista
  const { data: orcamentosRaw } = await supabase
    .from('orcamentos')
    .select(
      'id, created_at, status, total, validade_dias, condicoes_pagamento, paciente:pacientes(id, nome, telefone), dentista:dentistas(id, nome)'
    )
    .eq('clinica_id', dentista.clinica_id)
    .order('created_at', { ascending: false });

  // Busca dentistas da clínica para as abas da secretária
  let dentistasClinica: { id: string; nome: string }[] = [];
  if (dentista.role === 'secretaria') {
    const { data } = await supabase
      .from('dentistas')
      .select('id, nome')
      .eq('clinica_id', dentista.clinica_id)
      .neq('role', 'secretaria')
      .eq('ativo', true)
      .order('nome', { ascending: true });
    dentistasClinica = data ?? [];
  }

  // Busca itens e pagamentos em paralelo
  const [{ data: itensRaw }, { data: pagamentosRaw }] = await Promise.all([
    supabase
      .from('orcamento_itens')
      .select('id, orcamento_id, descricao, quantidade, preco_unitario, preco_total')
      .eq('clinica_id', dentista.clinica_id),
    supabase
      .from('pagamentos')
      .select('id, orcamento_id, valor, status, forma_pagamento, data_pagamento')
      .eq('clinica_id', dentista.clinica_id),
  ]);

  const itens = (itensRaw ?? []) as unknown as OrcamentoItemRow[];
  const pagamentos = (pagamentosRaw ?? []) as unknown as PagamentoRow[];

  // Associa itens e pagamentos a cada orçamento
  const orcamentos: OrcamentoRow[] = (orcamentosRaw ?? []).map((o) => ({
    ...(o as unknown as Omit<OrcamentoRow, 'itens' | 'pagamentos'>),
    itens: itens.filter((i) => i.orcamento_id === o.id),
    pagamentos: pagamentos.filter((p) => p.orcamento_id === o.id),
  }));

  // Solo: dentista cria orçamentos manualmente. BASICO/CLINICA: cria via perfil do paciente.
  const canEdit = dentista.plano === 'SOLO';

  return (
    <PageTransition>
      <OrcamentosClient 
        orcamentos={orcamentos} 
        clinicaId={dentista.clinica_id} 
        role={dentista.role} 
        temSecretaria={temSecretaria} 
        canEdit={canEdit} 
        dentistas={dentistasClinica}
      />
    </PageTransition>
  );
}
