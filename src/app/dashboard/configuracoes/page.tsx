import { requirePermission } from '@/server/authorization/guards';
import { ConfiguracoesClient } from './_components/configuracoes-client';
import type { ConfiguracaoClinica, HorarioDisponivel, Procedimento, DentistaRole } from '@/types/database';
import { PageTransition } from '@/components/layout/page-transition';
import type { PlanoId } from '@/lib/planos';

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
    .select('id, nome, cro, role, clinica:clinicas(nome)')
    .eq('user_id', user.id)
    .eq('clinica_id', clinicId)
    .maybeSingle();

  const [
    { data: configRaw },
    { data: horariosRaw },
    { data: procedimentosRaw },
    { data: usuariosRaw },
    { data: convitesRaw },
    { data: clinicaRaw },
  ] = await Promise.all([
    supabase.from('configuracoes_clinica').select('*').eq('clinica_id', clinicId).maybeSingle(),
    supabase.from('horarios_disponiveis').select('*').eq('dentista_id', dentistaPerfil?.id ?? '').order('dia_semana', { ascending: true }),
    supabase.from('procedimentos').select('*').eq('clinica_id', clinicId).order('categoria', { ascending: true }),
    supabase.from('dentistas').select('id, nome, email, role, ativo, created_at').eq('clinica_id', clinicId).order('created_at', { ascending: true }),
    supabase.from('convites').select('id, email, role, expires_at, created_at').eq('clinica_id', clinicId).gt('expires_at', new Date().toISOString()).order('created_at', { ascending: false }),
    supabase.from('clinicas').select('limite_dentistas, plano').eq('id', clinicId).single(),
  ]);

  const limiteDentistas = (clinicaRaw as { limite_dentistas: number; plano?: string } | null)?.limite_dentistas ?? 5;
  const planoClinica = ((clinicaRaw as { limite_dentistas: number; plano?: string } | null)?.plano ?? 'SOLO') as PlanoId;
  const dentistasAtivos = ((usuariosRaw ?? []) as Array<{ role: string; ativo: boolean }>).filter(
    (u) => u.role !== 'secretaria' && u.ativo
  ).length;
  const convitesDentistasPendentes = ((convitesRaw ?? []) as Array<{ role: string }>).filter(
    (c) => c.role !== 'secretaria'
  ).length;
  const convitesRestantes = Math.max(0, limiteDentistas - dentistasAtivos - convitesDentistasPendentes);

  const meuRole = ((dentistaPerfil as unknown as { role?: DentistaRole } | null)?.role) ?? 'dentista';

  return (
    <PageTransition>
      <ConfiguracoesClient
        plano={planoClinica}
        dentista={{
          id: dentistaPerfil?.id ?? '',
          nome: (dentistaPerfil?.nome as string) ?? '',
          cro: (dentistaPerfil?.cro as string | null) ?? null,
          role: meuRole as DentistaRole,
          clinica: (dentistaPerfil?.clinica as unknown as { nome: string } | null)?.nome ?? '',
        }}
        config={(configRaw as ConfiguracaoClinica | null) ?? null}
        horarios={(horariosRaw as HorarioDisponivel[]) ?? []}
        procedimentos={(procedimentosRaw as Procedimento[]) ?? []}
        abaInicial={abaInicial}
        equipe={{
          usuarios: (usuariosRaw as Array<{ id: string; nome: string; email: string | null; role: DentistaRole; ativo: boolean; created_at: string }>) ?? [],
          convitesPendentes: (convitesRaw as Array<{ id: string; email: string; role: DentistaRole; expires_at: string; created_at: string }>) ?? [],
          meuId: dentistaPerfil?.id ?? '',
          meuRole: meuRole as DentistaRole,
          limiteDentistas,
          convitesRestantes,
        }}
      />
    </PageTransition>
  );
}
