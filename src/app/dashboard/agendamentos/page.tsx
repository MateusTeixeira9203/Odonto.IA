import { redirect } from 'next/navigation';
import { getDentistaCached } from '@/lib/get-dentista';
import { createClient } from '@/lib/supabase/server';
import { AgendamentosClient } from './_components/agendamentos-client';
import type { Agendamento } from './_components/agendamentos-client';

export default async function AgendamentosPage() {
  const dentista = await getDentistaCached();
  if (!dentista) redirect('/login');

  const supabase = await createClient();

  const [{ data: agendamentosRaw }, { data: pacientesRaw }] = await Promise.all([
    supabase
      .from('agendamentos')
      .select('*, paciente:pacientes(id, nome), dentista:dentistas(id, nome)')
      .eq('clinica_id', dentista.clinica_id)
      .order('data_hora', { ascending: true }),
    supabase
      .from('pacientes')
      .select('id, nome')
      .eq('clinica_id', dentista.clinica_id)
      .order('nome', { ascending: true }),
  ]);

  return (
    <AgendamentosClient
      agendamentos={(agendamentosRaw as unknown as Agendamento[]) ?? []}
      pacientes={(pacientesRaw ?? []) as { id: string; nome: string }[]}
      clinicaId={dentista.clinica_id}
    />
  );
}
