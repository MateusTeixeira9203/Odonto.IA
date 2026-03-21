import { redirect } from 'next/navigation';
import { getDentistaCached } from '@/lib/get-dentista';
import { createClient } from '@/lib/supabase/server';
import { AgendamentosClient } from './_components/agendamentos-client';

export type AgendamentoRow = {
  id: string;
  clinica_id: string;
  paciente_id: string;
  dentista_id: string;
  data_hora: string;
  duracao_minutos: number;
  status: string;
  observacoes: string | null;
  created_at: string;
  paciente: { id: string; nome: string } | null;
  dentista: { id: string; nome: string } | null;
};

export default async function AgendamentosPage() {
  const dentista = await getDentistaCached();
  if (!dentista) redirect('/login');

  const supabase = await createClient();

  // Busca todos os agendamentos da clínica com joins
  const { data: agendamentosRaw } = await supabase
    .from('agendamentos')
    .select(
      'id, clinica_id, paciente_id, dentista_id, data_hora, duracao_minutos, status, observacoes, created_at, paciente:pacientes(id, nome), dentista:dentistas(id, nome)'
    )
    .eq('clinica_id', dentista.clinica_id)
    .order('data_hora', { ascending: true });

  return (
    <AgendamentosClient
      agendamentos={(agendamentosRaw ?? []) as unknown as AgendamentoRow[]}
      clinicaId={dentista.clinica_id}
    />
  );
}
