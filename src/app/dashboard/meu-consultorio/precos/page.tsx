import { requirePersonalConsultorio } from '@/server/auth/personal-consultorio';
import { requirePermission } from '@/server/authorization/guards';
import { PageContainer } from '@/components/layout/page-container';
import { PageTransition } from '@/components/layout/page-transition';
import { ProcedimentosCatalogo } from '@/app/dashboard/configuracoes/_components/procedimentos-catalogo';
import type { Procedimento } from '@/types/database';

export const metadata = { title: 'Procedimentos · Consultório · Odonto.IA' };

export default async function ConsultorioPrecosPage() {
  await requirePersonalConsultorio();
  const { supabase, clinicId, dentistaId } = await requirePermission('configuracoes');
  const { data, error } = await supabase.from('procedimentos').select('*')
    .eq('clinica_id', clinicId).eq('dentista_id', dentistaId)
    .order('categoria', { ascending: true });
  if (error) throw new Error('Não foi possível carregar seus procedimentos. Tente novamente.');
  const procedimentos = (data ?? []) as Procedimento[];

  return (
    <PageTransition>
      <PageContainer variant="wide">
        <header className="mb-6">
          <h2 className="font-heading text-2xl font-bold text-foreground">Procedimentos</h2>
          <p className="mt-1 text-sm text-muted-foreground">Cadastre seus procedimentos e defina os valores usados nos orçamentos.</p>
        </header>
        <ProcedimentosCatalogo
          key={`${clinicId}:${dentistaId}`}
          procedimentosIniciais={procedimentos}
        />
      </PageContainer>
    </PageTransition>
  );
}
