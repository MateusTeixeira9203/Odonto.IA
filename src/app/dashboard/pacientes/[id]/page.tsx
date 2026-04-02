import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getDentistaCached } from '@/lib/get-dentista';
import { PacienteDetailClient } from './_components/paciente-detail-client';
import type { Paciente } from '@/types/database';

type AgendamentoProximo = {
  id: string;
  data_hora: string;
  duracao_minutos: number;
  status: string;
  observacoes: string | null;
  dentista: { nome: string } | null;
};

type OrcamentoComItens = {
  id: string;
  status: 'rascunho' | 'enviado' | 'aprovado' | 'recusado';
  total: number | null;
  created_at: string;
  validade_dias: number;
  condicoes_pagamento: string | null;
  itens: Array<{
    id: string;
    descricao: string | null;
    preco_total: number | null;
    quantidade: number;
  }>;
  pagamentos: Array<{
    id: string;
    valor: number;
    status: string;
    forma_pagamento: string | null;
  }>;
};

export default async function PacienteDetalhePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const dentista = await getDentistaCached();
  if (!dentista) redirect('/login');

  const supabase = await createClient();

  const [
    { data: pacienteRaw },
    { data: agendamentoRaw },
    { data: orcamentosRaw },
  ] = await Promise.all([
    supabase
      .from('pacientes')
      .select('*')
      .eq('id', id)
      .eq('clinica_id', dentista.clinica_id)
      .maybeSingle(),
    supabase
      .from('agendamentos')
      .select('id, data_hora, duracao_minutos, status, observacoes, dentista:dentistas(nome)')
      .eq('paciente_id', id)
      .eq('clinica_id', dentista.clinica_id)
      .gte('data_hora', new Date().toISOString())
      .order('data_hora', { ascending: true })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('orcamentos')
      .select('id, status, total, created_at, validade_dias, condicoes_pagamento, itens:orcamento_itens(id, descricao, preco_total, quantidade), pagamentos(id, valor, status, forma_pagamento)')
      .eq('paciente_id', id)
      .eq('clinica_id', dentista.clinica_id)
      .order('created_at', { ascending: false }),
  ]);

  if (!pacienteRaw) notFound();

  return (
    <PacienteDetailClient
      paciente={pacienteRaw as Paciente}
      agendamentoProximo={(agendamentoRaw as AgendamentoProximo | null) ?? null}
      orcamentos={(orcamentosRaw as unknown as OrcamentoComItens[]) ?? []}
      clinicaId={dentista.clinica_id}
      dentistaId={dentista.id}
      role={dentista.role}
    />
  );
}
