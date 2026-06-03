import { redirect } from 'next/navigation';
import { requireClinicContext } from '@/server/auth/clinic';
import { ConsultaClient } from './_components/consulta-client';

interface Props {
  params: Promise<{ agendamentoId: string }>;
}

export default async function ConsultaPage({ params }: Props) {
  const { agendamentoId } = await params;
  const { supabase, clinicId } = await requireClinicContext();

  const { data: ag } = await supabase
    .from('agendamentos')
    .select('id, data_hora, observacoes, status, paciente:pacientes(id, nome, data_nascimento, telefone, observacoes)')
    .eq('id', agendamentoId)
    .eq('clinica_id', clinicId)
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

  const [{ data: fichas }, { data: orcamentos }, { data: planejamentoRaw }] = await Promise.all([
    supabase
      .from('fichas')
      .select('created_at, queixa_principal, anotacoes, dentes_afetados, alergias, historico_medico, medicamentos_em_uso, historico_dental')
      .eq('paciente_id', paciente.id)
      .eq('clinica_id', clinicId)
      .order('created_at', { ascending: false })
      .limit(5),
    supabase
      .from('orcamentos')
      .select('total, status, orcamento_itens(descricao)')
      .eq('paciente_id', paciente.id)
      .eq('clinica_id', clinicId)
      .in('status', ['aprovado', 'enviado'])
      .order('created_at', { ascending: false })
      .limit(3),
    supabase
      .from('planejamentos')
      .select('id, titulo, status, planejamento_etapas(id, titulo, dente, descricao_simples, status, ordem)')
      .eq('paciente_id', paciente.id)
      .eq('clinica_id', clinicId)
      .in('status', ['rascunho', 'apresentado', 'aprovado'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const hora = new Date(ag.data_hora as string).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  let idadeStr: string | null = null;
  if (paciente.data_nascimento) {
    const hoje = new Date();
    const nasc = new Date(paciente.data_nascimento);
    let idade = hoje.getFullYear() - nasc.getFullYear();
    const m = hoje.getMonth() - nasc.getMonth();
    if (m < 0 || (m === 0 && hoje.getDate() < nasc.getDate())) idade--;
    idadeStr = `${idade} anos`;
  }

  const ultimaFicha = fichas?.[0] ?? null;
  const alertasClinicos: string[] = [];
  const alergiasSeen = new Set<string>();
  const medicamentosSeen = new Set<string>();
  const histMedSeen = new Set<string>();

  for (const f of fichas ?? []) {
    const alergia = (f.alergias as string | null)?.trim();
    const med = (f.medicamentos_em_uso as string | null)?.trim();
    const histMed = (f.historico_medico as string | null)?.trim();

    if (alergia && !alergiasSeen.has(alergia)) {
      alergiasSeen.add(alergia);
      alertasClinicos.push(`⚠️ Alergia: ${alergia}`);
    }
    if (med && !medicamentosSeen.has(med)) {
      medicamentosSeen.add(med);
      alertasClinicos.push(`💊 Medicamentos: ${med}`);
    }
    if (histMed && !histMedSeen.has(histMed)) {
      histMedSeen.add(histMed);
      // Fix: truncar a 150 chars para não inflar o payload de props do servidor
      const histMedResumido = histMed.length > 150 ? `${histMed.slice(0, 147)}...` : histMed;
      alertasClinicos.push(`🏥 Histórico: ${histMedResumido}`);
    }
  }

  return (
    <ConsultaClient
      agendamentoId={agendamentoId}
      paciente={{ ...paciente, idadeStr }}
      hora={hora}
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
      agendamentoStatus={(ag.status as string)}
      alertasClinicos={alertasClinicos}
      planejamento={planejamentoRaw ? {
        id: (planejamentoRaw as {id: string}).id,
        titulo: (planejamentoRaw as {titulo: string}).titulo,
        etapas: ((planejamentoRaw as {planejamento_etapas: unknown[]}).planejamento_etapas ?? [])
          .map((e: unknown) => {
            const etapa = e as { id: string; titulo: string; dente: string | null; descricao_simples: string | null; status: string; ordem: number };
            return etapa;
          })
          .sort((a: { ordem: number }, b: { ordem: number }) => a.ordem - b.ordem),
      } : null}
    />
  );
}
