import { redirect } from 'next/navigation';
import { getDentistaCached } from '@/lib/get-dentista';
import { createClient } from '@/lib/supabase/server';
import { ConfigTabs } from './_components/config-tabs';
import type { ConfiguracaoClinica, HorarioDisponivel, Procedimento } from '@/types/database';

export default async function ConfiguracoesPage(): Promise<React.JSX.Element> {
  const dentista = await getDentistaCached();
  if (!dentista) redirect('/login');

  const supabase = await createClient();

  // Busca configurações, horários e procedimentos em paralelo
  const [{ data: configuracao }, { data: horarios }, { data: procedimentos }] = await Promise.all([
    supabase
      .from('configuracoes_clinica')
      .select('*')
      .eq('clinica_id', dentista.clinica_id)
      .maybeSingle(),
    supabase
      .from('horarios_disponiveis')
      .select('*')
      .eq('dentista_id', dentista.id)
      .order('dia_semana'),
    supabase
      .from('procedimentos')
      .select('*')
      .eq('clinica_id', dentista.clinica_id)
      .order('categoria')
      .order('nome'),
  ]);

  return (
    <div className="p-8 max-w-5xl mx-auto w-full">
      <header className="mb-8">
        <h1 className="font-serif text-4xl text-text-primary">Configurações</h1>
        <p className="text-text-secondary text-sm font-medium mt-1">
          Gerencie as configurações da sua clínica
        </p>
      </header>

      <ConfigTabs
        configuracao={(configuracao as ConfiguracaoClinica | null) ?? null}
        horarios={(horarios ?? []) as HorarioDisponivel[]}
        procedimentos={(procedimentos ?? []) as Procedimento[]}
      />
    </div>
  );
}
