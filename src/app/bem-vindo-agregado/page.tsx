import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { NeuralBackground } from '@/components/layout/NeuralBackground';
import { OdontoIALogo } from '@/components/ui/dent-ia-logo';
import { AgregadoWelcomeClient } from './_components/agregado-welcome-client';

interface Props {
  searchParams: Promise<{ clinica?: string }>;
}

export default async function BemVindoAgregadoPage({ searchParams }: Props) {
  const { clinica: clinicId } = await searchParams;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login');
  if (!clinicId) redirect('/dashboard');

  // Confirma que o usuário é membro ativo desta clínica (segurança)
  const db = createServiceClient();
  const [{ data: membership }, { data: clinicaData }, { data: dentistaData }] = await Promise.all([
    db
      .from('clinica_usuarios')
      .select('role')
      .eq('usuario_id', user.id)
      .eq('clinica_id', clinicId)
      .eq('status', 'ativo')
      .maybeSingle(),
    db
      .from('clinicas')
      .select('nome')
      .eq('id', clinicId)
      .maybeSingle<{ nome: string }>(),
    db
      .from('dentistas')
      .select('nome')
      .eq('user_id', user.id)
      .eq('clinica_id', clinicId)
      .maybeSingle<{ nome: string }>(),
  ]);

  // Se não for membro ou não for dentista (agregado), vai pro dashboard
  if (!membership || membership.role !== 'dentista') {
    redirect('/dashboard');
  }

  // Nome do dentista: perfil clínico > metadata auth > fallback genérico
  const nomeDentista =
    dentistaData?.nome ??
    (user.user_metadata?.nome as string | undefined) ??
    '';

  return (
    <div
      className="relative min-h-screen bg-bg flex flex-col items-center justify-center p-4"
      style={{
        '--color-bg': '#f5f3ef',
        '--color-surface': '#ffffff',
        '--color-surface-alt': '#eceae4',
        '--color-border': '#d4d1ca',
        '--color-text-primary': '#0d0d0d',
        '--color-text-secondary': '#8a8a8a',
      } as React.CSSProperties}
    >
      <NeuralBackground />

      <div className="relative z-10 w-full max-w-lg">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-teal text-white mb-4 shadow-lg">
            <OdontoIALogo className="w-7 h-7" />
          </div>
          <p className="text-text-secondary text-sm font-medium font-mono uppercase tracking-widest">
            Odonto.IA
          </p>
        </div>

        <AgregadoWelcomeClient
          clinicaNome={clinicaData?.nome ?? 'a clínica'}
          nomeDentista={nomeDentista}
          userId={user.id}
          userEmail={user.email ?? ''}
        />
      </div>
    </div>
  );
}
