import { redirect } from 'next/navigation';
import { getMemberContext } from '@/server/auth/member-context';
import { obterContextoClinica } from '@/server/clinica/operations';
import { mesValido } from '@/lib/financeiro/calculos';
import { FinanceiroContent } from '@/app/dashboard/financeiro/_components/financeiro-content';
import { requirePersonalConsultorio } from '@/server/auth/personal-consultorio';

export const metadata = { title: 'Financeiro · Consultório · Odonto.IA' };

export default async function ConsultorioFinanceiroPage({ searchParams }: {
  searchParams: Promise<{ mes?: string; dentista?: string }>;
}) {
  await requirePersonalConsultorio();
  const member = await getMemberContext();
  const owner = member.ok ? await obterContextoClinica({ clinicaIdEsperada: member.data.clinicaId }) : null;
  if (owner?.ok && owner.data.proprietario) {
    const { mes } = await searchParams;
    redirect(`/clinica/meus-resultados${mes && mesValido(mes) ? `?mes=${mes}` : ''}`);
  }
  return (
    <FinanceiroContent
      searchParamsPromise={searchParams}
      basePath="/dashboard/meu-consultorio/financeiro"
    />
  );
}
