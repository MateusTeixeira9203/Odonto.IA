import { redirect } from 'next/navigation';
import { startOfMonth, endOfMonth, format, parseISO } from 'date-fns';
import { getDentistaCached } from '@/lib/get-dentista';
import { createClient } from '@/lib/supabase/server';
import { getCalendarConnectedMap } from '@/lib/calendar/google-provider';
import { AgendamentosClient } from './_components/agendamentos-client';
import { PageTransition } from '@/components/layout/page-transition';

export type AgendamentoRow = {
  id: string;
  clinica_id: string;
  paciente_id: string;
  dentista_id: string;
  data_hora: string;
  duracao_minutos: number;
  status: string;
  /** 'manual' | 'bot' | 'app' — origem do agendamento */
  origem: string;
  observacoes: string | null;
  created_at: string;
  paciente: { id: string; nome: string; observacoes: string | null } | null;
  dentista: { id: string; nome: string } | null;
  /** Quem criou o agendamento — null se o próprio dentista ou bot */
  criador: { id: string; nome: string } | null;
};

/** Agendamentos ativos além do mês exibido — a agenda filtra por mês e os esconderia. */
export type ForaDaJanela = {
  total: number;
  /** ISO do mais próximo. */
  proximaData: string;
  /** 'yyyy-MM' do mais próximo — destino do link. */
  proximoMes: string;
};

interface PageProps {
  searchParams: Promise<{ mes?: string; novo?: string }>;
}

export default async function AgendamentosPage({ searchParams }: PageProps) {
  const dentista = await getDentistaCached();
  if (!dentista) redirect('/login');

  // Determinar o mês sendo visualizado (default: mês atual)
  const { mes, novo } = await searchParams;
  const mesDate =
    mes && /^\d{4}-\d{2}$/.test(mes) ? parseISO(`${mes}-01`) : new Date();
  const mesAtual = format(mesDate, 'yyyy-MM');
  const inicioMes = startOfMonth(mesDate).toISOString();
  const fimMes = endOfMonth(mesDate).toISOString();

  const supabase = await createClient();
  const isSecretaria = dentista.role === 'secretaria';

  // Secretária: vê todos os agendamentos da clínica
  // Dentista/admin: vê apenas seus próprios
  // Ambos: filtrado pelo mês selecionado
  const query = supabase
    .from('agendamentos')
    .select(
      'id, clinica_id, paciente_id, dentista_id, data_hora, duracao_minutos, status, origem, observacoes, created_at, paciente:pacientes(id, nome, observacoes), dentista:dentistas!agendamentos_dentista_id_fkey(id, nome), criador:dentistas!agendamentos_created_by_fkey(id, nome)'
    )
    .eq('clinica_id', dentista.clinica_id)
    .gte('data_hora', inicioMes)
    .lte('data_hora', fimMes)
    .order('data_hora', { ascending: true });

  if (!isSecretaria) {
    query.eq('dentista_id', dentista.id);
  }

  // Agendamentos ativos DEPOIS da janela exibida.
  //
  // A agenda mostra um mês por vez, então tudo que cai fora fica invisível — foi assim que um
  // retorno marcado em 28/04 para 14/05 passou 3 meses sem ninguém ver. O toast de "Marcar
  // retorno" avisa no instante da criação e some; isto é o que dá DESCOBERTA depois, e importa
  // mais do que parece: retorno de 30 dias cai no mês seguinte por definição.
  const proximosQuery = supabase
    .from('agendamentos')
    .select('data_hora')
    .eq('clinica_id', dentista.clinica_id)
    .in('status', ['scheduled', 'confirmed'])
    .gt('data_hora', fimMes)
    .order('data_hora', { ascending: true });

  if (!isSecretaria) {
    proximosQuery.eq('dentista_id', dentista.id);
  }

  // Dados em paralelo: agendamentos + contagem de secretárias + o que está fora da janela
  const [{ data: agendamentosRaw }, { count: secretariaCount }, { data: proximosRaw }] =
    await Promise.all([
      query,
      supabase
        .from('dentistas')
        .select('id', { count: 'exact', head: true })
        .eq('clinica_id', dentista.clinica_id)
        .eq('role', 'secretaria')
        .eq('ativo', true),
      proximosQuery,
    ]);

  const temSecretaria = (secretariaCount ?? 0) > 0;

  const proximos = proximosRaw ?? [];
  const foraDaJanela: ForaDaJanela | null =
    proximos.length > 0
      ? {
          total: proximos.length,
          proximaData: proximos[0].data_hora as string,
          proximoMes: format(parseISO(proximos[0].data_hora as string), 'yyyy-MM'),
        }
      : null;

  // Lista de dentistas + mapa de GCal conectado (apenas para secretária)
  let dentistasClinica: { id: string; nome: string }[] = [];
  let calendarConnectedPerDentista: Record<string, boolean> = {};

  if (isSecretaria) {
    const { data } = await supabase
      .from('dentistas')
      .select('id, nome')
      .eq('clinica_id', dentista.clinica_id)
      .neq('role', 'secretaria')
      .eq('ativo', true)
      .order('nome', { ascending: true });
    dentistasClinica = data ?? [];
    calendarConnectedPerDentista = await getCalendarConnectedMap(
      dentistasClinica.map((d) => d.id),
    );
  }

  // Todos os dentistas podem gerenciar a própria agenda independente do plano.
  // Secretária cria em nome do dentista (status 'scheduled', pendente de confirmação).
  const canEdit = true;

  return (
    <PageTransition>
      <AgendamentosClient
        key={mesAtual}
        agendamentos={(agendamentosRaw ?? []) as unknown as AgendamentoRow[]}
        clinicaId={dentista.clinica_id}
        role={dentista.role}
        dentistaAtualId={dentista.id}
        dentistas={dentistasClinica}
        calendarConnectedPerDentista={calendarConnectedPerDentista}
        temSecretaria={temSecretaria}
        mesAtual={mesAtual}
        canEdit={canEdit}
        autoOpenNovo={novo === '1'}
        foraDaJanela={foraDaJanela}
      />
    </PageTransition>
  );
}
