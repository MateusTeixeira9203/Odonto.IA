import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { PlanosClient } from './_components/planos-client';

interface PlanosPageProps {
  searchParams: Promise<{ expired?: string }>;
}

export default async function PlanosPage({ searchParams }: PlanosPageProps) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const params = await searchParams;
  const expired = params.expired === '1';

  // Valores padrão para usuário não autenticado
  let trialUsed = false;
  let statusAssinatura: 'trial' | 'ativo' | 'inativo' = 'inativo';

  if (user) {
    const service = createServiceClient();

    const { data: dentista } = await service
      .from('dentistas')
      .select('clinica_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (dentista) {
      const { data: clinica } = await service
        .from('clinicas')
        .select('status_assinatura, trial_ends_at')
        .eq('id', dentista.clinica_id)
        .maybeSingle();

      if (clinica) {
        statusAssinatura = clinica.status_assinatura as 'trial' | 'ativo' | 'inativo';
        trialUsed = !!clinica.trial_ends_at;
      }
    }
  }

  return (
    <PlanosClient
      userId={user?.id ?? null}
      userEmail={user?.email ?? null}
      trialUsed={trialUsed}
      statusAssinatura={statusAssinatura}
      expired={expired}
    />
  );
}
