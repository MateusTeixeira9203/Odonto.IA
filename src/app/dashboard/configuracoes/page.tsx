import { redirect } from 'next/navigation';
import { getDentistaCached } from '@/lib/get-dentista';
import { createClient } from '@/lib/supabase/server';
import { ConfiguracoesClient } from './_components/configuracoes-client';
import type { ConfiguracaoClinica, HorarioDisponivel, Procedimento } from '@/types/database';

export default async function ConfiguracoesPage() {
  const dentista = await getDentistaCached();
  if (!dentista) redirect('/login');
  if (dentista.role === 'secretaria') redirect('/dashboard');

  const supabase = await createClient();

  // Busca dados reais da clínica, horários e procedimentos em paralelo
  const [
    { data: configRaw },
    { data: horariosRaw },
    { data: procedimentosRaw },
  ] = await Promise.all([
    supabase
      .from('configuracoes_clinica')
      .select('*')
      .eq('clinica_id', dentista.clinica_id)
      .maybeSingle(),
    supabase
      .from('horarios_disponiveis')
      .select('*')
      .eq('dentista_id', dentista.id)
      .order('dia_semana', { ascending: true }),
    supabase
      .from('procedimentos')
      .select('*')
      .eq('clinica_id', dentista.clinica_id)
      .order('categoria', { ascending: true }),
  ]);

  return (
    <ConfiguracoesClient
      dentista={{ id: dentista.id, nome: dentista.nome, clinica: dentista.clinica }}
      config={(configRaw as ConfiguracaoClinica | null) ?? null}
      horarios={(horariosRaw as HorarioDisponivel[]) ?? []}
      procedimentos={(procedimentosRaw as Procedimento[]) ?? []}
    />
  );
}
