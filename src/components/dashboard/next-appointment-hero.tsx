'use client';

import Link from 'next/link';
import { format, parseISO, differenceInMinutes } from 'date-fns';
import { Clock, AlertCircle, FileText, ArrowRight, CalendarClock } from 'lucide-react';

import { AbrirMeuDiaButton } from './abrir-meu-dia-button';
import { MarkAttendedButton } from './mark-attended-button';

type HeroState = 'empty' | 'concluded' | 'active' | 'waiting' | 'critical' | 'near' | 'imminent' | 'approaching' | 'distant';
type FilledState = Exclude<HeroState, 'empty' | 'concluded'>;

interface NextAppointmentHeroProps {
  agendamento: {
    id: string;
    data_hora: string;
    status: string;
    observacoes: string | null;
    paciente: { id: string; nome: string; observacoes: string | null } | null;
    ultimaFichaQueixa: string | null;
  } | null;
  now: Date;
  allConcluded?: boolean;
  orcamentosAbertos?: number;
  planejamentoAtivo?: string | null;
}

function toTitleCase(name: string): string {
  return name
    .toLowerCase()
    .split(' ')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function getHeroState(status: string, minutesUntil: number): FilledState {
  if (status === 'in_progress') return 'active';
  if (status === 'checked_in')  return 'waiting';
  if (minutesUntil <= 5)  return 'critical';
  if (minutesUntil < 10)  return 'near';
  if (minutesUntil < 30)  return 'imminent';
  if (minutesUntil < 120) return 'approaching';
  return 'distant';
}

function fmtMins(mins: number): string {
  if (mins <= 0) return 'agora';
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

const STATE_LABEL: Record<FilledState, string> = {
  active:      'EM ATENDIMENTO',
  waiting:     'PACIENTE CHEGOU',
  critical:    'INICIAR AGORA',
  near:        'COMEÇA EM BREVE',
  imminent:    'EM BREVE',
  approaching: 'PRÓXIMO',
  distant:     'PRÓXIMO ATENDIMENTO',
};

const principal = 'inline-flex h-10 items-center justify-center gap-2 rounded-[8px] border border-teal-ink bg-teal-pale px-[13px] text-[13px] font-semibold text-teal-ink hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal/20';
const secundario = 'inline-flex h-10 items-center justify-center gap-2 rounded-[8px] border border-border px-[13px] text-[13px] text-text-secondary hover:bg-teal-pale hover:text-teal-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal/20';

export function NextAppointmentHero({ agendamento, now, allConcluded, orcamentosAbertos, planejamentoAtivo }: NextAppointmentHeroProps) {
  if (!agendamento?.paciente) {
    const concluded = !!allConcluded;
    return (
      <section data-dashboard-hero aria-labelledby="proximo-atendimento-titulo" className="mb-6 overflow-hidden rounded-[12px] border border-border bg-surface px-6 py-[25px]">
        <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,340px)] items-center gap-[30px] max-[600px]:grid-cols-1 max-[600px]:gap-5">
          <div className="min-w-0">
            <p className="mb-2 text-[12.5px] uppercase tracking-wider text-text-secondary">{concluded ? 'Todos Concluídos' : 'Dia Tranquilo'}</p>
            <h2 id="proximo-atendimento-titulo" className="mb-2 font-heading text-[27px] font-normal leading-tight text-text-primary">{concluded ? 'Bom trabalho hoje.' : 'Agenda livre hoje'}</h2>
            <p className="text-[15px] text-text-secondary">{concluded ? 'Todos os atendimentos foram finalizados.' : 'Nenhum atendimento agendado.'}</p>
            <p className="mt-1.5 text-[15px] text-text-secondary">{concluded ? 'Você pode revisar pendências restantes.' : 'Bom momento para organizar seu dia.'}</p>
          </div>
          <div className="flex min-w-0 flex-col gap-2">
            <Link href="/dashboard/meu-dia" className={principal}><CalendarClock className="h-4 w-4 shrink-0" aria-hidden="true" />Ver meu dia</Link>
            <Link href="/dashboard/agendamentos" className={secundario}>{concluded ? 'Revisar pendências' : 'Ver agenda'}<ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
            {!concluded && <Link href="/dashboard/agendamentos" className={secundario}>Novo agendamento</Link>}
          </div>
        </div>
      </section>
    );
  }

  const { paciente, data_hora, status, observacoes, ultimaFichaQueixa } = agendamento;
  const nomeFormatado = toTitleCase(paciente.nome);
  const hora = format(parseISO(data_hora), 'HH:mm');
  const mins = differenceInMinutes(parseISO(data_hora), now);
  const state = getHeroState(status, mins);
  const isActive = state === 'active';
  const isWaiting = state === 'waiting';
  const isCritical = state === 'critical';
  const isNear = state === 'near';
  const isImminent = state === 'imminent';
  const isApproaching = state === 'approaching';
  const labelColor = isCritical ? 'text-coral-ink' : isNear ? 'text-warning-ink' : 'text-teal-ink';
  const dotColor = isCritical ? 'bg-coral' : isNear ? 'bg-warning' : 'bg-teal';
  const timeBadgeClass = isCritical ? 'bg-coral-pale text-coral-ink' : isNear ? 'bg-warning-pale text-warning-ink' : 'bg-teal-pale text-teal-ink';
  const timeBadgeText = isActive
    ? 'Em andamento'
    : isWaiting
    ? 'Paciente aguardando'
    : isCritical
    ? `Iniciar agora — ${fmtMins(mins)}`
    : isNear
    ? `Começa em ${fmtMins(mins)}`
    : isImminent
    ? `Começa em ${fmtMins(mins)}`
    : isApproaching
    ? `Em ${fmtMins(mins)}`
    : `Próximo em ${fmtMins(mins)}`;
  const alertas = paciente.observacoes
    ? paciente.observacoes.split('\n').map((l) => l.trim()).filter(Boolean)
    : [];

  return (
    <section data-dashboard-hero aria-labelledby="proximo-atendimento-titulo" className="mb-6 overflow-hidden rounded-[12px] border border-border bg-surface px-6 py-[25px]">
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,340px)] items-center gap-[30px] max-[600px]:grid-cols-1 max-[600px]:gap-5">
        <div className="min-w-0">
          <p className={`mb-2 flex items-center gap-2 text-[12.5px] uppercase tracking-wider ${labelColor}`}><span className={`h-2 w-2 shrink-0 rounded-full ${dotColor}`} aria-hidden="true" />{STATE_LABEL[state]}</p>
          <h2 id="proximo-atendimento-titulo" className="mb-2 break-words font-heading text-[27px] font-normal leading-tight text-text-primary">{nomeFormatado}</h2>
          <p className="mb-3 flex flex-wrap items-center gap-x-2 text-[15px] text-text-secondary"><Clock className="h-4 w-4 shrink-0" aria-hidden="true" /><span>{hora}</span>{observacoes && <span className="min-w-0 break-words">· {observacoes}</span>}</p>
          <span className={`inline-flex rounded-[4px] px-1.5 py-0.5 text-[12px] ${timeBadgeClass}`}>{timeBadgeText}</span>
          {alertas.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{alertas.map((alerta, i) => <span key={i} className="inline-flex min-w-0 items-center gap-1.5 rounded-[4px] bg-warning-pale px-1.5 py-0.5 text-[12px] text-warning-ink"><AlertCircle className="h-3 w-3 shrink-0" aria-hidden="true" /><span className="break-words">{alerta}</span></span>)}</div>}
          {ultimaFichaQueixa && <p className="mt-3 flex items-start gap-2 text-[13px] text-text-secondary"><FileText className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" /><span className="min-w-0 break-words">Último: <span className="text-text-primary">{ultimaFichaQueixa}</span></span></p>}
          {((orcamentosAbertos ?? 0) > 0 || planejamentoAtivo) && <div className="mt-2 flex flex-wrap gap-2">
            {planejamentoAtivo && <span className="inline-flex min-w-0 items-center gap-1.5 rounded-[4px] bg-slate-pale px-1.5 py-0.5 text-[12px] text-slate-ink"><FileText className="h-3 w-3 shrink-0" aria-hidden="true" /><span className="break-words">{planejamentoAtivo}</span></span>}
            {(orcamentosAbertos ?? 0) > 0 && <span className="inline-flex items-center gap-1.5 rounded-[4px] bg-slate-pale px-1.5 py-0.5 text-[12px] text-slate-ink"><AlertCircle className="h-3 w-3 shrink-0" aria-hidden="true" />{orcamentosAbertos} orçamento{(orcamentosAbertos ?? 0) > 1 ? 's' : ''} em aberto</span>}
          </div>}
        </div>
        <div className="group/acoes flex min-w-0 flex-col gap-2">
          <AbrirMeuDiaButton agendamentoId={agendamento.id} pacienteNome={nomeFormatado} horario={hora} />
          <MarkAttendedButton agendamentoId={agendamento.id} />
          <Link href={`/dashboard/pacientes/${paciente.id}`} className="inline-flex min-h-10 items-center justify-center px-[9px] text-[13px] text-teal-ink hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal/20">Ver perfil do paciente →</Link>
        </div>
      </div>
    </section>
  );
}
