import { redirect } from 'next/navigation';
import { getDentistaCached } from '@/lib/get-dentista';
import { hojeBRT } from '@/lib/hora-brt';
import { createClient } from '@/lib/supabase/server';
import { getCalendarConnectedMap } from '@/lib/calendar/google-provider';
import { AgendamentosClient } from './_components/agendamentos-client';
import { PageTransition } from '@/components/layout/page-transition';
import type { DentistaAgenda } from './_components/cor-dentista';
import {
  ehAncora,
  ehVisao,
  fimDoMesDaAncora,
  janelaDaVisao,
  VISAO_PADRAO,
  type VisaoAgenda,
} from './_components/date-helpers';

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

/** Agendamentos ativos depois do MÊS da âncora — o banner não segue a visão (spec §3.1). */
export type ForaDaJanela = {
  total: number;
  /** ISO do mais próximo. */
  proximaData: string;
  /** 'yyyy-MM-dd' do mais próximo, no fuso da clínica — vira a âncora do link. */
  proximaAncora: string;
};

interface PageProps {
  searchParams: Promise<{ v?: string; d?: string; novo?: string }>;
}

export default async function AgendamentosPage({ searchParams }: PageProps) {
  const dentista = await getDentistaCached();
  if (!dentista) redirect('/login');

  // A URL é a fonte única da janela visível: `?v=dia|semana|mes&d=yyyy-MM-dd`.
  // Antes era `?mes=yyyy-MM`, e a navegação por semana/dia acontecia só no estado do
  // cliente — nada avisava o servidor. Quem atravessava a virada do mês na visão de
  // Semana via a grade esvaziar, porque os dados do mês seguinte nunca foram buscados.
  const { v, d, novo } = await searchParams;
  const visao: VisaoAgenda = ehVisao(v) ? v : VISAO_PADRAO;
  const ancora: string = ehAncora(d) ? d : hojeBRT();

  const janela = janelaDaVisao(visao, ancora);
  const fimDoMes = fimDoMesDaAncora(ancora);

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
    .gte('data_hora', janela.de)
    .lt('data_hora', janela.ate)
    .order('data_hora', { ascending: true });

  if (!isSecretaria) {
    query.eq('dentista_id', dentista.id);
  }

  // Agendamentos ativos DEPOIS do mês da âncora.
  //
  // Foi assim que um retorno marcado em 28/04 para 14/05 passou 3 meses sem ninguém ver. O
  // toast de "Marcar retorno" avisa no instante da criação e some; isto é o que dá DESCOBERTA
  // depois, e importa: retorno de 30 dias cai no mês seguinte por definição.
  //
  // O horizonte é o MÊS mesmo quando a grade mostra uma semana ou um dia (spec §3.1). Amarrá-lo
  // à janela visível faria o banner disparar em quase toda semana — e aviso que aparece sempre
  // é aviso que a recepção aprende a ignorar.
  const proximosQuery = supabase
    .from('agendamentos')
    .select('data_hora')
    .eq('clinica_id', dentista.clinica_id)
    .in('status', ['scheduled', 'confirmed'])
    .gte('data_hora', fimDoMes)
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
          // Âncora no fuso da CLÍNICA. Com `format()` do date-fns isto sairia no fuso do
          // servidor: uma consulta às 21h BRT vira 00h UTC do dia seguinte, e o link levaria
          // pro dia errado.
          proximaAncora: hojeBRT(new Date(proximos[0].data_hora as string)),
        }
      : null;

  // Lista de dentistas + mapa de GCal conectado (apenas para secretária)
  //
  // Ordenado por created_at, não por nome: o slot de cor (spec §3.2) é a posição de
  // entrada na clínica. Renomear alguém ou um dentista novo entrar no meio do alfabeto
  // não pode embaralhar a cor que a recepção já decorou. A EXIBIÇÃO dos chips continua
  // alfabética — é o client que ordena uma cópia por nome na hora de desenhar.
  let dentistasClinica: DentistaAgenda[] = [];
  let calendarConnectedPerDentista: Record<string, boolean> = {};

  if (isSecretaria) {
    const { data } = await supabase
      .from('dentistas')
      .select('id, nome')
      .eq('clinica_id', dentista.clinica_id)
      .neq('role', 'secretaria')
      .eq('ativo', true)
      .order('created_at', { ascending: true });
    dentistasClinica = (data ?? []).map((d, i) => ({ id: d.id, nome: d.nome, slot: i }));
    calendarConnectedPerDentista = await getCalendarConnectedMap(
      dentistasClinica.map((d) => d.id),
    );
  }

  // Todos os dentistas podem gerenciar a própria agenda independente do plano.
  // Secretária cria em nome do dentista (status 'scheduled', pendente de confirmação).
  const canEdit = true;

  return (
    <PageTransition>
      {/* Sem `key` por âncora de propósito: remontar a cada seta zeraria o filtro por dentista
          da secretária — ela filtra o Renato, avança a semana e perde o filtro. O componente é
          controlado pelos props `visao`/`ancora`, então não precisa de remonte pra ficar em dia. */}
      <AgendamentosClient
        agendamentos={(agendamentosRaw ?? []) as unknown as AgendamentoRow[]}
        clinicaId={dentista.clinica_id}
        role={dentista.role}
        dentistaAtualId={dentista.id}
        dentistas={dentistasClinica}
        calendarConnectedPerDentista={calendarConnectedPerDentista}
        temSecretaria={temSecretaria}
        visao={visao}
        ancora={ancora}
        canEdit={canEdit}
        autoOpenNovo={novo === '1'}
        foraDaJanela={foraDaJanela}
      />
    </PageTransition>
  );
}
