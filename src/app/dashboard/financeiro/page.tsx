import { redirect } from 'next/navigation';
import { format } from 'date-fns';
import { getDentistaCached } from '@/lib/get-dentista';
import { createClient } from '@/lib/supabase/server';
import { listarDespesas, listarReceitas, calcularSaldoMes, listarUltimosMeses, calcularHoraClinica, listarPagamentosPagos, listarPagamentosPendentes } from './actions';
import { FinanceiroClient } from './_components/financeiro-client';
import { PageTransition } from '@/components/layout/page-transition';
import { UpsellPage } from '@/components/upsell-page';
import { temFeature } from '@/lib/planos';
import { Wallet } from 'lucide-react';

interface PageProps {
  searchParams: Promise<{ mes?: string; dentista?: string }>;
}

export default async function FinanceiroPage({ searchParams }: PageProps) {
  const dentista = await getDentistaCached();
  if (!dentista) redirect('/login');

  // Override para usuário específico ter acesso a features de plano superior
  const supabaseAuth = await createClient();
  const { data: { user } } = await supabaseAuth.auth.getUser();
  const isUserOverride = !!process.env.PLAN_OVERRIDE_EMAIL && user?.email === process.env.PLAN_OVERRIDE_EMAIL;

  const planoEfetivo = isUserOverride ? 'CLINICA' : dentista.plano;

  if (!temFeature(planoEfetivo, 'financeiro')) {
    return (
      <PageTransition>
        <UpsellPage
          featureName="Módulo Financeiro"
          featureDescription="Controle receitas, despesas e o fluxo de caixa da sua clínica com privacidade, entradas manuais e custo por hora clínica."
          benefits={[
            'Lançamento de saídas fixas e variáveis por categoria',
            'Entradas manuais: PIX avulso, dinheiro físico, convênios',
            'Receitas automáticas geradas pelos pagamentos de orçamentos',
            'Custo por hora clínica calculado com base na agenda',
            'Modo privacidade para proteger valores sensíveis',
          ]}
          requiredPlan="CLINICA"
          icon={<Wallet className="w-8 h-8" style={{ color: '#2f9c85' }} />}
        />
      </PageTransition>
    );
  }

  const { mes, dentista: dentistaParam } = await searchParams;
  const mesAtual = mes && /^\d{4}-\d{2}$/.test(mes) ? mes : format(new Date(), 'yyyy-MM');

  // Busca dentistas da clínica para o seletor da secretária
  let dentistasClinica: { id: string; nome: string }[] = [];
  if (dentista.role === 'secretaria') {
    const supabase = await createClient();
    const { data } = await supabase
      .from('dentistas')
      .select('id, nome')
      .eq('clinica_id', dentista.clinica_id)
      .neq('role', 'secretaria')
      .eq('ativo', true)
      .order('nome', { ascending: true });
    dentistasClinica = data ?? [];
  }

  const [despesas, receitas, saldo, chartData, horaClinica, pagamentosPagos, pagamentosPendentes] = await Promise.all([
    listarDespesas(mesAtual),
    listarReceitas(mesAtual),
    calcularSaldoMes(mesAtual),
    listarUltimosMeses(6),
    calcularHoraClinica(mesAtual),
    listarPagamentosPagos(mesAtual),
    listarPagamentosPendentes(),
  ]);

  return (
    <PageTransition>
      <FinanceiroClient
        key={mesAtual}
        mesAtual={mesAtual}
        despesasIniciais={despesas}
        receitasIniciais={receitas}
        saldoInicial={saldo}
        chartData={chartData}
        horaClinica={horaClinica}
        role={dentista.role}
        plano={planoEfetivo}
        dentistaId={dentista.id}
        dentistasClinica={dentistasClinica}
        initialDentistaFiltro={dentistaParam ?? ''}
        pagamentosPagosIniciais={pagamentosPagos}
        pagamentosPendentesIniciais={pagamentosPendentes}
      />
    </PageTransition>
  );
}
