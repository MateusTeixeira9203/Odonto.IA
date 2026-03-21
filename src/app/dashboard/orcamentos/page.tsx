import { redirect } from 'next/navigation';
import { getDentistaCached } from '@/lib/get-dentista';
import { createClient } from '@/lib/supabase/server';
import { OrcamentosClient } from './_components/orcamentos-client';

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
  paciente: { id: string; nome: string } | null;
  dentista: { id: string; nome: string } | null;
  itens: OrcamentoItemRow[];
  pagamentos: PagamentoRow[];
};

export default async function OrcamentosPage() {
  const dentista = await getDentistaCached();
  if (!dentista) redirect('/login');

  const supabase = await createClient();

  // Busca orçamentos com joins de paciente e dentista
  const { data: orcamentosRaw } = await supabase
    .from('orcamentos')
    .select(
      'id, created_at, status, total, validade_dias, condicoes_pagamento, paciente:pacientes(id, nome), dentista:dentistas(id, nome)'
    )
    .eq('clinica_id', dentista.clinica_id)
    .order('created_at', { ascending: false });

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

  return <OrcamentosClient orcamentos={orcamentos} clinicaId={dentista.clinica_id} />;
}
