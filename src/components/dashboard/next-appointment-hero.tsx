'use client';

import Link from 'next/link';
import { format, parseISO, differenceInMinutes } from 'date-fns';
import { Clock, AlertCircle, FileText, ArrowRight } from 'lucide-react';
import { motion } from 'motion/react';
import { ConsultaCtaButton } from './consulta-cta-button';

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

// ── Countdown Ring ─────────────────────────────────────────────────────────────
function CountdownRing({ mins, state }: { mins: number; state: FilledState }) {
  const isActive = state === 'active';
  const isWaiting = state === 'waiting';
  const isCritical = state === 'critical';
  const isNear = state === 'near';
  const useAmber = state === 'approaching' || isNear;
  const isImminent = state === 'imminent';

  const size = 132;
  const sw = 6;
  const r = (size - sw) / 2;
  const circ = 2 * Math.PI * r;

  // Fill: 0 min → 100%, 120+ min → 0%
  const clampedMins = Math.max(0, Math.min(120, mins));
  const fillPct = isActive || isWaiting ? 1 : 1 - clampedMins / 120;
  const dashOffset = circ * (1 - fillPct);

  const ringColor =
    isCritical ? '#ef4444' :
    isNear     ? '#f59e0b' :
    useAmber   ? '#f59e0b' :
    '#2f9c85';
  const trackColor =
    isCritical ? 'rgba(239,68,68,0.14)' :
    useAmber   ? 'rgba(245,158,11,0.14)' :
    'rgba(47,156,133,0.12)';
  const ringOpacity = isActive ? 1 : isCritical ? 1 : isImminent ? 0.92 : useAmber ? 0.78 : 0.52;

  const centerNum = mins < 60 ? String(Math.max(0, mins)) : String(Math.floor(mins / 60));
  const centerUnit = mins < 60 ? 'min' : mins % 60 > 0 ? `h ${mins % 60}m` : 'h';

  return (
    <div className="hidden md:flex flex-col items-center justify-center shrink-0 select-none">
      <div className="relative" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          style={{ display: 'block', transform: 'rotate(-90deg)' }}
        >
          {/* Track */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            style={{ stroke: trackColor }}
            strokeWidth={sw}
          />
          {/* Progress arc */}
          {fillPct > 0 && (
            <circle
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={ringColor}
              strokeWidth={sw}
              strokeDasharray={circ}
              strokeDashoffset={dashOffset}
              strokeLinecap="round"
              opacity={ringOpacity}
            />
          )}
        </svg>

        {/* Center content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {isActive ? (
            <span
              className="text-[10px] font-bold uppercase tracking-[0.2em] text-center leading-[1.5]"
              style={{ color: ringColor }}
            >
              EM
              <br />
              CURSO
            </span>
          ) : isWaiting ? (
            <span
              className="text-[10px] font-bold uppercase tracking-[0.2em] text-center leading-[1.5]"
              style={{ color: ringColor }}
            >
              AGUARD
              <br />
              ANDO
            </span>
          ) : (
            <>
              <span
                className="font-mono font-bold leading-none tabular-nums"
                style={{
                  fontSize: mins < 60 ? '2.25rem' : '1.875rem',
                  color: isCritical ? '#ef4444' : useAmber ? '#f59e0b' : 'var(--color-text-primary)',
                }}
              >
                {centerNum}
              </span>
              <span
                className="text-xs font-semibold mt-0.5"
                style={{
                  color: isCritical
                    ? 'rgba(239,68,68,0.65)'
                    : useAmber
                    ? 'rgba(245,158,11,0.65)'
                    : 'var(--color-text-secondary)',
                }}
              >
                {centerUnit}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Label below */}
      <p
        className="mt-2 text-[10px] font-bold uppercase tracking-[0.18em]"
        style={{
          color: isCritical
            ? 'rgba(239,68,68,0.55)'
            : useAmber
            ? 'rgba(245,158,11,0.45)'
            : 'rgba(47,156,133,0.4)',
        }}
      >
        {isActive ? 'ao vivo' : isWaiting ? 'aguardando' : 'restantes'}
      </p>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export function NextAppointmentHero({ agendamento, now, allConcluded, orcamentosAbertos, planejamentoAtivo }: NextAppointmentHeroProps) {
  // ── Empty / concluded states ──────────────────────────────────────────────
  if (!agendamento?.paciente) {
    const concluded = !!allConcluded;

    const containerBorder = concluded ? 'border-teal/25' : 'border-border';
    const containerShadow = concluded
      ? '0 16px 48px -16px rgba(47,156,133,0.18)'
      : '0 16px 48px -16px rgba(0,0,0,0.06)';
    const accentGradient = concluded
      ? 'linear-gradient(90deg, #2f9c85 0%, rgba(47,156,133,0.35) 55%, transparent 100%)'
      : 'linear-gradient(90deg, rgba(113,113,122,0.18) 0%, transparent 60%)';

    return (
      <div
        className={`mb-8 md:mb-10 rounded-3xl overflow-hidden border ${containerBorder}`}
        style={{ boxShadow: containerShadow }}
      >
        <div className="h-[2px]" style={{ background: accentGradient }} />
        <div
          className="hero-glass p-8 md:p-12"
          style={{
            backgroundImage: concluded
              ? 'radial-gradient(ellipse 100% 80% at 50% 120%, rgba(47,156,133,0.05) 0%, transparent 60%)'
              : 'none',
          }}
        >
          <div className="flex flex-col md:flex-row md:items-center gap-8">
            {/* Content */}
            <div className="flex-1 min-w-0">
              <p
                className={`text-xs font-bold uppercase tracking-[0.25em] mb-4 ${
                  concluded ? 'text-teal/60' : 'text-text-secondary/40'
                }`}
              >
                {concluded ? 'Todos Concluídos' : 'Dia Tranquilo'}
              </p>
              <h2 className="font-heading font-bold text-4xl md:text-5xl text-text-primary tracking-tight mb-3">
                {concluded ? 'Bom trabalho hoje.' : 'Agenda livre hoje'}
              </h2>
              <p className="text-base text-text-secondary leading-relaxed mb-1.5">
                {concluded
                  ? 'Todos os atendimentos foram finalizados.'
                  : 'Nenhum atendimento agendado.'}
              </p>
              <p className="text-sm" style={{ color: 'var(--color-text-secondary)', opacity: 0.6 }}>
                {concluded
                  ? 'Você pode revisar pendências restantes.'
                  : 'Bom momento para organizar seu dia.'}
              </p>
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-3 shrink-0">
              <Link
                href="/dashboard/agendamentos"
                className="btn-glow inline-flex items-center justify-center gap-2.5 px-8 py-4 rounded-2xl text-[15px] font-bold text-white transition-all hover:-translate-y-0.5 active:scale-[0.98]"
                style={{
                  background: 'linear-gradient(135deg, #2f9c85 0%, #1d7a65 100%)',
                  boxShadow:
                    '0 8px 32px rgba(47,156,133,0.38), inset 0 1px 0 rgba(255,255,255,0.14)',
                }}
              >
                {concluded ? 'Revisar pendências' : 'Ver agenda'}
                <ArrowRight className="w-4 h-4" />
              </Link>
              {!concluded && (
                <Link
                  href="/dashboard/agendamentos"
                  className="inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-2xl text-sm font-semibold text-text-secondary border border-border hover:bg-surface-alt hover:text-text-primary transition-all"
                >
                  Novo agendamento
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Filled state ──────────────────────────────────────────────────────────
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
  const showPulse = isActive || isWaiting || isCritical || isNear || isImminent || isApproaching;
  const useAmber = isApproaching || isNear;
  const useRed = isCritical;

  const containerBorder = isActive
    ? 'border-teal/50'
    : isCritical
    ? 'border-red-500/50'
    : isNear
    ? 'border-amber-500/40'
    : isImminent
    ? 'border-teal/40'
    : useAmber
    ? 'border-amber-500/25'
    : 'border-teal/[0.18]';

  const containerShadow = isActive
    ? '0 16px 48px -16px rgba(47,156,133,0.30)'
    : isCritical
    ? '0 16px 48px -16px rgba(239,68,68,0.30)'
    : isNear
    ? '0 16px 48px -16px rgba(245,158,11,0.20)'
    : isImminent
    ? '0 16px 48px -16px rgba(47,156,133,0.25)'
    : useAmber
    ? '0 16px 48px -16px rgba(245,158,11,0.12)'
    : '0 16px 48px -16px rgba(47,156,133,0.14)';

  const accentBarGradient = isActive
    ? 'linear-gradient(90deg, #2f9c85 0%, #2f9c85 25%, rgba(47,156,133,0.55) 65%, transparent 100%)'
    : isCritical
    ? 'linear-gradient(90deg, #ef4444 0%, rgba(239,68,68,0.75) 55%, transparent 100%)'
    : isNear
    ? 'linear-gradient(90deg, #f59e0b 0%, rgba(245,158,11,0.65) 55%, transparent 100%)'
    : isImminent
    ? 'linear-gradient(90deg, #2f9c85 0%, rgba(47,156,133,0.75) 55%, transparent 100%)'
    : useAmber
    ? 'linear-gradient(90deg, #f59e0b 0%, rgba(245,158,11,0.5) 55%, transparent 100%)'
    : 'linear-gradient(90deg, #2f9c85 0%, rgba(47,156,133,0.35) 55%, transparent 100%)';

  const dotColor = useRed ? 'bg-red-500' : useAmber ? 'bg-amber-500' : 'bg-teal';
  const labelColor = useRed
    ? 'text-red-500 dark:text-red-400'
    : useAmber
    ? 'text-amber-600 dark:text-amber-400'
    : 'text-teal';

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

  const timeBadgeClass =
    isActive || isImminent
      ? 'bg-teal/10 text-teal'
      : isWaiting
      ? 'bg-teal/10 text-teal'
      : isCritical
      ? 'bg-red-500/10 text-red-600 dark:text-red-400'
      : isNear || useAmber
      ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
      : 'bg-surface-alt text-text-secondary';

  const alertas = paciente.observacoes
    ? paciente.observacoes
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean)
    : [];

  return (
    <div
      className={`mb-8 md:mb-10 rounded-3xl overflow-hidden border ${containerBorder}`}
      style={{ boxShadow: containerShadow }}
    >
      {/* Accent top bar */}
      <div
        className={isActive || isCritical || isNear || isImminent ? 'h-[3px]' : 'h-[2px]'}
        style={{ background: accentBarGradient }}
      />

      <div
        className="hero-glass p-8 md:p-12 flex flex-col md:flex-row md:items-center gap-8"
        style={{
          backgroundImage:
            isActive || isImminent
              ? 'radial-gradient(ellipse 100% 80% at 50% 120%, rgba(47,156,133,0.06) 0%, transparent 60%)'
              : isCritical
              ? 'radial-gradient(ellipse 100% 80% at 50% 120%, rgba(239,68,68,0.07) 0%, transparent 60%)'
              : useAmber
              ? 'radial-gradient(ellipse 100% 80% at 50% 120%, rgba(245,158,11,0.05) 0%, transparent 60%)'
              : 'radial-gradient(ellipse 100% 80% at 50% 120%, rgba(47,156,133,0.03) 0%, transparent 60%)',
        }}
      >
        {/* Info side */}
        <div className="flex-1 min-w-0">
          {/* State label with pulse dot */}
          <div
            className={`text-xs font-bold uppercase tracking-[0.2em] mb-4 flex items-center gap-2 ${labelColor}`}
          >
            <span className="relative flex h-2 w-2">
              {showPulse && (
                <span
                  className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-60 ${dotColor}`}
                />
              )}
              <span className={`relative inline-flex h-2 w-2 rounded-full ${dotColor}`} />
            </span>
            {STATE_LABEL[state]}
          </div>

          {/* Patient name */}
          <h2 className="font-heading font-bold text-4xl md:text-5xl text-text-primary mb-3 truncate leading-tight tracking-tight">
            {nomeFormatado}
          </h2>

          {/* Time row */}
          <div className="flex items-center gap-3 text-text-secondary mb-4 flex-wrap">
            <Clock className="w-4 h-4 shrink-0" />
            <span className="font-mono text-2xl font-bold text-text-primary tracking-tight">
              {hora}
            </span>
            {observacoes && (
              <>
                <span className="w-px h-4 bg-border shrink-0" />
                <span className="text-sm text-text-secondary">{observacoes}</span>
              </>
            )}
          </div>

          {/* Time badge */}
          <div
            className={`inline-flex items-center text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg mb-5 ${timeBadgeClass}`}
          >
            {timeBadgeText}
          </div>

          {/* Alert chips */}
          {alertas.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {alertas.map((alerta, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                >
                  <AlertCircle className="w-3 h-3 shrink-0" />
                  {alerta}
                </span>
              ))}
            </div>
          )}

          {/* Last ficha */}
          {ultimaFichaQueixa && (
            <div className="flex items-center gap-2 text-text-secondary text-sm">
              <FileText className="w-3.5 h-3.5 shrink-0" />
              <span>
                Último:{' '}
                <span className="text-text-primary font-medium">{ultimaFichaQueixa}</span>
              </span>
            </div>
          )}

          {/* Context chips */}
          {((orcamentosAbertos ?? 0) > 0 || planejamentoAtivo) && (
            <div className="flex flex-wrap gap-2 mt-2">
              {planejamentoAtivo && (
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full bg-teal/10 text-teal border border-teal/20">
                  <FileText className="w-3 h-3" />
                  {planejamentoAtivo}
                </span>
              )}
              {(orcamentosAbertos ?? 0) > 0 && (
                <span
                  className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full"
                  style={{ background: 'rgba(59,130,246,0.09)', color: '#3b82f6', border: '1px solid rgba(59,130,246,0.2)' }}
                >
                  <AlertCircle className="w-3 h-3" />
                  {orcamentosAbertos} orçamento{(orcamentosAbertos ?? 0) > 1 ? 's' : ''} em aberto
                </span>
              )}
            </div>
          )}
        </div>

        {/* Countdown ring — desktop only */}
        <CountdownRing mins={mins} state={state} />

        {/* CTA side */}
        <div className="flex flex-col gap-3 shrink-0">
          <motion.div
            animate={isCritical ? { scale: [1, 1.03, 1] } : {}}
            transition={{ duration: 1.0, repeat: Infinity }}
          >
            <ConsultaCtaButton agendamentoId={agendamento.id} />
          </motion.div>
          <Link
            href={`/dashboard/pacientes/${paciente.id}`}
            className="text-center text-xs font-semibold text-text-secondary hover:text-text-primary transition-colors"
          >
            Ver perfil do paciente →
          </Link>
        </div>
      </div>
    </div>
  );
}
