import { redirect } from 'next/navigation';
import { getDentistaCached } from '@/lib/get-dentista';
import { createClient } from '@/lib/supabase/server';
import { listarDespesas, listarReceitas, calcularSaldoMes, listarUltimosMeses, calcularHoraClinica, listarPagamentosPagos, listarPagamentosPendentes } from './actions';
import { FinanceiroClient } from './_components/financeiro-client';
import { PageTransition } from '@/components/layout/page-transition';
import { UpsellPage } from '@/components/upsell-page';
import { temFeature } from '@/lib/planos';
import { mesValido } from '@/lib/financeiro/calculos';
import { hojeBRT } from '@/lib/hora-brt';
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
  const mesAtual = mes && mesValido(mes) ? mes : hojeBRT().slice(0, 7);

  // Busca dentistas da clínica para o seletor da secretária
  let dentistasClinica: { id: string; nome: string }[] = [];
  let dentistaFiltro = '';
  if (dentista.role === 'secretaria') {
    const supabase = await createClient();
    const { data } = await supabase
      .from('dentistas')
      .select('id, nome')
      .eq('clinica_id', dentista.clinica_id)
      // R-94 — .neq('role','secretaria') sozinho deixaria 'protetico' entrar no
      // seletor de dentista do financeiro.
      .in('role', ['admin', 'dentista'])
      .eq('ativo', true)
      .order('nome', { ascending: true });
    dentistasClinica = data ?? [];
    dentistaFiltro = dentistasClinica.some((d) => d.id === dentistaParam) ? dentistaParam ?? '' : '';
  }

  const [despesas, receitas, saldo, chartData, horaClinica, pagamentosPagos, pagamentosPendentes] = await Promise.all([
    listarDespesas(mesAtual, dentistaFiltro || undefined),
    listarReceitas(mesAtual, dentistaFiltro || undefined),
    calcularSaldoMes(mesAtual, dentistaFiltro || undefined),
    listarUltimosMeses(6, mesAtual, dentistaFiltro || undefined),
    calcularHoraClinica(mesAtual, dentistaFiltro || undefined),
    listarPagamentosPagos(mesAtual, dentistaFiltro || undefined),
    listarPagamentosPendentes(dentistaFiltro || undefined),
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
        clinicaId={dentista.clinica_id}
        dentistasClinica={dentistasClinica}
        initialDentistaFiltro={dentistaFiltro}
        pagamentosPagosIniciais={pagamentosPagos}
        pagamentosPendentesIniciais={pagamentosPendentes}
      />
    </PageTransition>
  );
}
