// R-46a — "/dashboard/meu-dia": rail do dia + coluna de contexto, só leitura.
// Spec: plans/specs/R-46-meu-dia.md. Porta: CTA no hero do dashboard (next-appointment-hero.tsx).
// R-46g — aceita ?ag= pra pré-selecionar o slot que a porta clicada já sabia qual era
// (spec R-46g-porta-modo-consulta.md §6.1). Nunca busca agendamento por esse id — só
// pré-seleciona um slot que já veio do fetch escopado por clínica+dentista; se não casar
// com nada, cai no default de sempre (in_progress/checked_in, senão o 1º).

import { redirect } from 'next/navigation';
import { getDentistaCached } from '@/lib/get-dentista';
import { getMeuDiaData } from '@/server/dashboard/get-meu-dia';
import { dataExtensaBRT } from '@/lib/hora-brt';
import { PageContainer } from '@/components/layout/page-container';
import { MeuDiaClient } from './_components/meu-dia-client';
import { createClient } from '@/lib/supabase/server';
import { obterOuCriarProgressoOnboarding } from '@/server/services/onboarding-primeiro-valor';
import type { ProgressoOnboarding } from '@/types/onboarding';
import { obterAcessoFormacaoClinica } from '@/server/services/formacao-clinica';

interface MeuDiaPageProps {
  searchParams: Promise<{ ag?: string }>;
}

export default async function MeuDiaPage({ searchParams }: MeuDiaPageProps) {
  const dentista = await getDentistaCached();
  if (!dentista) redirect('/login');
  // Meu dia é o dia do dentista em atendimento (D2 da spec) — agendamentos são silo por
  // dentista_id (RLS, migration 099); pra secretaria isso seria sempre vazio.
  if (dentista.role === 'secretaria') redirect('/dashboard');

  const { ag } = await searchParams;
  const now = new Date();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { slots, contextoPorPaciente, catalogoProcedimentos, destinosEncaminhar, meuDentistaId, primeiraSessao } =
    await getMeuDiaData({
      clinicId: dentista.clinica_id,
      dentistaId: dentista.id,
      now,
    });

  const [progressoPersistido, acessoFormacao] = user
    ? await Promise.all([
        obterOuCriarProgressoOnboarding(user.id),
        obterAcessoFormacaoClinica({ userId: user.id, clinicId: dentista.clinica_id }),
      ])
    : [null, { liberado: false, expiresAt: null }];
  // A migration pode ainda não ter sido aplicada no ambiente. Nesse intervalo, o produto
  // continua utilizável e a orientação degrada para um estado efêmero, sem bloquear o dentista.
  const progressoOnboarding: ProgressoOnboarding | null = primeiraSessao
    ? (progressoPersistido ?? {
        etapa: 'intro', caminho: null, primeiraFichaEm: null, podeRetomar: true,
      })
    : progressoPersistido;

  const agendamentoInicialId = ag && slots.some((s) => s.agendamentoId === ag) ? ag : undefined;

  return (
    <PageContainer variant="wide" className="max-w-[1800px]! px-[30px]! py-6! max-[600px]:px-2.5! max-[600px]:py-[18px]!">
      <header className="mb-0">
        <p className="mb-1 text-[12.5px] uppercase tracking-wider text-text-secondary">
          {dataExtensaBRT(now)}
        </p>
        <h1 className="font-heading text-[32px] leading-tight text-text-primary">
          Meu Dia
        </h1>
      </header>

      <MeuDiaClient
        profissionalNome={dentista.nome}
        slots={slots}
        contextoPorPaciente={contextoPorPaciente}
        agendamentoInicialId={agendamentoInicialId}
        catalogoProcedimentos={catalogoProcedimentos}
        destinosEncaminhar={destinosEncaminhar}
        meuDentistaId={meuDentistaId}
        clinicaId={dentista.clinica_id}
        primeiraSessao={primeiraSessao}
        progressoOnboarding={progressoOnboarding}
        emFormacaoClinica={acessoFormacao.liberado}
      />
    </PageContainer>
  );
}
