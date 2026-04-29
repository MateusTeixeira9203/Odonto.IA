import { redirect } from 'next/navigation';
import { getDentistaCached } from '@/lib/get-dentista';
import { createClient } from '@/lib/supabase/server';
import { ConsultaClient } from './_components/consulta-client';

interface Props {
  params: Promise<{ agendamentoId: string }>;
}

export default async function ConsultaPage({ params }: Props) {
  const { agendamentoId } = await params;

  const dentista = await getDentistaCached();
  if (!dentista) redirect('/login');

  const supabase = await createClient();

  const { data: ag } = await supabase
    .from('agendamentos')
    .select('id, data_hora, observacoes, status, paciente:pacientes(id, nome, data_nascimento, telefone, observacoes)')
    .eq('id', agendamentoId)
    .eq('clinica_id', dentista.clinica_id)
    .maybeSingle();

  if (!ag) redirect('/dashboard/agendamentos');

  const paciente = ag.paciente as unknown as {
    id: string;
    nome: string;
    data_nascimento: string | null;
    telefone: string | null;
    observacoes: string | null;
  } | null;

  if (!paciente) redirect('/dashboard/agendamentos');

  const { data: fichas } = await supabase
    .from('fichas')
    .select('created_at, queixa_principal, anotacoes, dentes_afetados')
    .eq('paciente_id', paciente.id)
    .eq('clinica_id', dentista.clinica_id)
    .order('created_at', { ascending: false })
    .limit(5);

  const { data: orcamentos } = await supabase
    .from('orcamentos')
    .select('total, status, orcamento_itens(descricao)')
    .eq('paciente_id', paciente.id)
    .eq('clinica_id', dentista.clinica_id)
    .in('status', ['aprovado', 'enviado'])
    .order('created_at', { ascending: false })
    .limit(3);

  const hora = new Date(ag.data_hora as string).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const idadeStr = paciente.data_nascimento
    ? `${new Date().getFullYear() - new Date(paciente.data_nascimento).getFullYear()} anos`
    : null;

  const ultimaFicha = fichas?.[0] ?? null;

  return (
    <ConsultaClient
      agendamentoId={agendamentoId}
      paciente={{ ...paciente, idadeStr }}
      hora={hora}
      procedimento={null}
      observacoesAgendamento={(ag.observacoes as string | null) ?? null}
      ultimaQueixa={(ultimaFicha?.queixa_principal as string | null) ?? null}
      ultimasAnotacoes={(ultimaFicha?.anotacoes as string | null) ?? null}
      fichas={(fichas ?? []).map(f => ({
        data: new Date(f.created_at as string).toLocaleDateString('pt-BR'),
        queixa: (f.queixa_principal as string | null) ?? '',
        anotacoes: (f.anotacoes as string | null) ?? '',
        dentes: (f.dentes_afetados as number[]) ?? [],
      }))}
      orcamentos={(orcamentos ?? []).map(o => ({
        total: (o.total as number) ?? 0,
        status: o.status as string,
        itens: ((o.orcamento_itens as { descricao: string }[] | null) ?? []).map(i => i.descricao).filter(Boolean),
      }))}
      dentistaId={dentista.id}
      clinicaId={dentista.clinica_id}
    />
  );
}
