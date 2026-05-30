import { requirePermission } from '@/server/authorization/guards';
import { ConfiguracoesClient } from './_components/configuracoes-client';
import type { ConfiguracaoClinica, HorarioDisponivel, Procedimento } from '@/types/database';
import { PageTransition } from '@/components/layout/page-transition';

export default async function ConfiguracoesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const { supabase, user, clinicId } = await requirePermission('configuracoes');

  const params = await searchParams;
  const abaInicial = params.aba ?? 'clinica';

  const { data: dentistaPerfil } = await supabase
    .from('dentistas')
    .select('id, nome, cro, clinica:clinicas(nome)')
    .eq('user_id', user.id)
    .eq('clinica_id', clinicId)
    .maybeSingle();

  const [{ data: configRaw }, { data: horariosRaw }, { data: procedimentosRaw }] =
    await Promise.all([
      supabase
        .from('configuracoes_clinica')
        .select('*')
        .eq('clinica_id', clinicId)
        .maybeSingle(),
      supabase
        .from('horarios_disponiveis')
        .select('*')
        .eq('dentista_id', dentistaPerfil?.id ?? '')
        .order('dia_semana', { ascending: true }),
      supabase
        .from('procedimentos')
        .select('*')
        .eq('clinica_id', clinicId)
        .order('categoria', { ascending: true }),
    ]);

  return (
    <PageTransition>
      <ConfiguracoesClient
        dentista={{
          id: dentistaPerfil?.id ?? '',
          nome: (dentistaPerfil?.nome as string) ?? '',
          cro: (dentistaPerfil?.cro as string | null) ?? null,
          clinica: (dentistaPerfil?.clinica as unknown as { nome: string } | null)?.nome ?? '',
        }}
        config={(configRaw as ConfiguracaoClinica | null) ?? null}
        horarios={(horariosRaw as HorarioDisponivel[]) ?? []}
        procedimentos={(procedimentosRaw as Procedimento[]) ?? []}
        abaInicial={abaInicial}
      />
    </PageTransition>
  );
}
