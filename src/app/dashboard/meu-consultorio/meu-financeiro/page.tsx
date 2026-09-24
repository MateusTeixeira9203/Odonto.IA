import { format } from 'date-fns';
import { redirect } from 'next/navigation';
import { Wallet } from 'lucide-react';

import { FinanceiroClient } from '@/app/dashboard/financeiro/_components/financeiro-client';
import { calcularHoraClinica, calcularSaldoMes, listarDespesas, listarPagamentosPagos, listarPagamentosPendentes, listarReceitas, listarUltimosMeses } from '@/app/dashboard/financeiro/actions';
import { UpsellPage } from '@/components/upsell-page';
import { getDentistaCached } from '@/lib/get-dentista';
import { temFeature } from '@/lib/planos';
import { createClient } from '@/lib/supabase/server';

export default async function MeuFinanceiroPage({ searchParams }: { searchParams: Promise<{ mes?: string }> }): Promise<React.JSX.Element> {
  const dentista = await getDentistaCached();
  if (!dentista) redirect('/login');
  if (dentista.role === 'secretaria' || dentista.role === 'protetico') redirect('/dashboard/meu-consultorio/financeiro-clinica');
  const auth = await createClient();
  const { data: { user } } = await auth.auth.getUser();
  const override = Boolean(process.env.PLAN_OVERRIDE_EMAIL && user?.email === process.env.PLAN_OVERRIDE_EMAIL);
  const plano = override ? 'CLINICA' : dentista.plano;
  if (!temFeature(plano, 'financeiro')) {
    return <UpsellPage featureName="Módulo Financeiro" featureDescription="Controle suas entradas, despesas e custo por hora clínica." benefits={['Entradas e saídas pessoais', 'Custo por hora clínica', 'Receitas dos orçamentos', 'Extrato mensal']} requiredPlan="CLINICA" icon={<Wallet className="size-8 text-teal" />} />;
  }
  const params = await searchParams;
  const mes = params.mes && /^\d{4}-(0[1-9]|1[0-2])$/.test(params.mes) ? params.mes : format(new Date(), 'yyyy-MM');
  const [despesas, receitas, saldo, chart, hora, pagos, pendentes] = await Promise.all([
    listarDespesas(mes),
    listarReceitas(mes),
    calcularSaldoMes(mes),
    listarUltimosMeses(6),
    calcularHoraClinica(mes),
    listarPagamentosPagos(mes),
    listarPagamentosPendentes(),
  ]);
  return <FinanceiroClient embedded key={mes} mesAtual={mes} despesasIniciais={despesas} receitasIniciais={receitas} saldoInicial={saldo} chartData={chart} horaClinica={hora} role={dentista.role} plano={plano} dentistaId={dentista.id} dentistasClinica={[]} pagamentosPagosIniciais={pagos} pagamentosPendentesIniciais={pendentes} />;
}
