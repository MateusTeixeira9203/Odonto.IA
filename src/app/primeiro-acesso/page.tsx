import { redirect } from 'next/navigation';
import { requireUser } from '@/server/auth/user';
import { createServiceClient } from '@/lib/supabase/service';
import { PrimeiroAcessoClient } from './_components/primeiro-acesso-client';
import { NeuralBackground } from '@/components/layout/NeuralBackground';
import { OdontoIALogo } from '@/components/ui/dent-ia-logo';

export default async function PrimeiroAcessoPage() {
  const { user } = await requireUser();
  const db = createServiceClient();

  const { data: secretaria } = await db
    .from('secretarias')
    .select('must_change_password')
    .eq('usuario_id', user.id)
    .maybeSingle();

  // Se não é secretária com must_change_password, não deveria estar aqui
  if (!secretaria?.must_change_password) {
    redirect('/dashboard');
  }

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

      <div className="relative z-10 w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-teal text-white mb-4 shadow-lg">
            <OdontoIALogo className="w-7 h-7" />
          </div>
          <h1 className="font-heading font-bold text-3xl text-text-primary mb-2">Primeiro acesso</h1>
          <p className="text-text-secondary text-sm">
            Defina sua senha para continuar. Essa senha será usada em todos os seus próximos acessos.
          </p>
        </div>

        <div className="bg-surface rounded-3xl border border-border shadow-sm p-8">
          <PrimeiroAcessoClient />
        </div>
      </div>
    </div>
  );
}
