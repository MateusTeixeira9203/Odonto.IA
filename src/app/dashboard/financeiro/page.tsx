import { redirect } from 'next/navigation';
import { format } from 'date-fns';
import { getDentistaCached } from '@/lib/get-dentista';
import { createClient } from '@/lib/supabase/server';
import { listarDespesas, calcularSaldoMes, listarUltimosMeses } from './actions';
import { FinanceiroClient } from './_components/financeiro-client';
import { PageTransition } from '@/components/layout/page-transition';

interface PageProps {
  searchParams: Promise<{ mes?: string }>;
}

export default async function FinanceiroPage({ searchParams }: PageProps) {
  const dentista = await getDentistaCached();
  if (!dentista) redirect('/login');

  // Override para usuário específico ter acesso a features de plano superior
  const supabaseAuth = await createClient();
  const { data: { user } } = await supabaseAuth.auth.getUser();
  const isUserOverride = user?.email === 'clenio21@gmail.com';

  const { mes } = await searchParams;
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

  const [despesas, saldo, chartData] = await Promise.all([
    listarDespesas(mesAtual),
    calcularSaldoMes(mesAtual),
    listarUltimosMeses(6),
  ]);

  return (
    <PageTransition>
      <FinanceiroClient
        key={mesAtual}
        mesAtual={mesAtual}
        despesasIniciais={despesas}
        saldoInicial={saldo}
        chartData={chartData}
        role={dentista.role}
        plano={isUserOverride ? 'BASICO' : dentista.plano}
        dentistaId={dentista.id}
        dentistasClinica={dentistasClinica}
      />
    </PageTransition>
  );
}
