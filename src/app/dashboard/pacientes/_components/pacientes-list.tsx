import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getDentistaCached } from '@/lib/get-dentista';
import { PacientesTable } from '@/components/pacientes/pacientes-table';

export async function PacientesList({ canCreate }: { canCreate: boolean }) {
  const dentista = await getDentistaCached();
  if (!dentista) redirect('/login');

  const supabase = await createClient();

  // Dentista vê apenas os seus pacientes (+ sem vínculo por compatibilidade).
  // Admin e secretária vêem todos da clínica.
  const isDentista = dentista.role === 'dentista';

  let query = supabase
    .from('pacientes')
    .select(`
      id, nome, email, telefone, created_at, data_nascimento,
      dentista:dentistas(nome)
    `)
    .eq('clinica_id', dentista.clinica_id);

  if (isDentista) {
    // Filtro estrito: Dentistas convidados veem apenas os próprios pacientes
    query = query.eq('dentista_id', dentista.id);
  }

  const { data: pacientes } = await query.order('nome', { ascending: true });

  return <PacientesTable pacientes={pacientes ?? []} canCreate={canCreate} />;
}
