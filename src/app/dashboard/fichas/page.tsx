import { redirect } from 'next/navigation';
import { getDentistaCached } from '@/lib/get-dentista';
import { createClient } from '@/lib/supabase/server';
import { FichasClient } from './_components/fichas-client';

export type FichaRow = {
  id: string;
  created_at: string;
  status: 'aberta' | 'concluida';
  queixa_principal: string | null;
  anotacoes: string | null;
  paciente_id: string;
  paciente: { nome: string } | null;
  dentista: { nome: string } | null;
};

export default async function FichasPage() {
  const dentista = await getDentistaCached();
  if (!dentista) redirect('/login');

  const supabase = await createClient();
  const { data: fichasRaw } = await supabase
    .from('fichas')
    .select(
      'id, created_at, status, queixa_principal, anotacoes, paciente_id, paciente:pacientes(nome), dentista:dentistas(nome)'
    )
    .eq('clinica_id', dentista.clinica_id)
    .order('created_at', { ascending: false })
    .limit(100);

  const fichas = (fichasRaw ?? []) as unknown as FichaRow[];

  return <FichasClient fichas={fichas} />;
}
