import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Building2, Package, ShieldCheck } from 'lucide-react';

import { createClient } from '@/lib/supabase/server';
import { getGovernanceContext } from '@/server/auth/governance-context';
import { getMemberContext } from '@/server/auth/member-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageContainer } from '@/components/layout/page-container';

export default async function ConsultorioPage(): Promise<React.JSX.Element> {
  const member = await getMemberContext();
  if (!member.ok) redirect('/onboarding');
  if (member.data.perfilClinico) redirect('/dashboard');

  const [governanca, client] = await Promise.all([getGovernanceContext(member.data.clinicaId), createClient()]);
  const { data: clinica } = await client.from('clinicas').select('nome')
    .eq('id', member.data.clinicaId).maybeSingle<{ nome: string }>();
  const nomeClinica = clinica?.nome ?? 'Sua clínica';
  const proprietario = governanca.ok && governanca.data.papeis.includes('proprietario');

  return (
    <main className="min-h-screen bg-bg">
      <PageContainer className="max-w-3xl py-10 sm:py-16">
        <div className="mb-8 flex items-center gap-3">
          <span className="flex size-11 items-center justify-center rounded-xl bg-teal-pale text-teal-ink"><Building2 className="size-5" /></span>
          <div><p className="text-xs font-bold uppercase tracking-widest text-text-secondary">Minha Clínica</p><h1 className="font-heading text-3xl text-text-primary">{nomeClinica}</h1></div>
        </div>
        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-heading text-xl"><ShieldCheck className="size-5 text-teal" />{proprietario ? 'A clínica está criada' : 'Seu acesso à clínica está ativo'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-6 text-text-secondary">
            <p>{proprietario ? 'Acompanhe as áreas operacionais da sua clínica a partir daqui.' : 'Aguarde a configuração das permissões da equipe para acessar as áreas disponíveis para você.'}</p>
          </CardContent>
        </Card>
        <Card className="mt-4 max-w-2xl transition-colors hover:border-teal/40">
          <CardContent className="flex items-center justify-between gap-4 p-5">
            <div className="flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-xl bg-teal-pale text-teal-ink"><Package className="size-5" /></span>
              <div><p className="font-semibold text-text-primary">Estoque</p><p className="mt-0.5 text-sm text-text-secondary">Materiais, kits e movimentações da clínica.</p></div>
            </div>
            <Link href="/estoque" className="inline-flex min-h-11 items-center rounded-lg border border-border px-4 text-sm font-semibold text-text-primary hover:bg-surface-alt">Abrir</Link>
          </CardContent>
        </Card>
      </PageContainer>
    </main>
  );
}
