import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getDentistaCached } from '@/lib/get-dentista';
import { PacientesTable } from '@/components/pacientes/pacientes-table';

export async function PacientesList() {
  const dentista = await getDentistaCached();
  if (!dentista) redirect('/login');

  const supabase = await createClient();
  const { data: pacientes } = await supabase
    .from('pacientes')
    .select('id, nome, email, telefone, created_at, data_nascimento')
    .eq('clinica_id', dentista.clinica_id)
    .order('nome', { ascending: true });

  return <PacientesTable pacientes={pacientes ?? []} />;
}
