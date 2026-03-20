import { redirect } from 'next/navigation';
import { getDentistaCached } from '@/lib/get-dentista';
import { createClient } from '@/lib/supabase/server';
import { FichasClient } from './_components/fichas-client';
import type { FichaComPaciente } from './_components/fichas-client';

export default async function FichasPage() {
  const dentista = await getDentistaCached();
  if (!dentista) redirect('/login');

  const supabase = await createClient();

  const { data: fichas } = await supabase
    .from('fichas')
    .select('*, paciente:pacientes(id, nome)')
    .eq('clinica_id', dentista.clinica_id)
    .order('created_at', { ascending: false });

  return <FichasClient fichas={(fichas as unknown as FichaComPaciente[]) ?? []} />;
}
