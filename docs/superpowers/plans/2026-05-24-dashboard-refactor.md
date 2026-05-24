# Dashboard Refactor — Odonto.IA
**Data:** 2026-05-24  
**Spec:** `docs/superpowers/specs/2026-05-24-dashboard-refactor-design.md`

---

## Goal

Refatorar o dashboard de dentista/admin para central operacional clínica com: header contextual, 3 métricas operacionais, hero com próximo atendimento, agenda de hoje e painel de atenção.

## Architecture

- **Server-first**: todos os novos componentes são Server Components puros, exceto `ConsultaCtaButton` (client island mínimo)
- **Composição**: `DentistaDashboard` faz todas as queries e passa props para os sub-componentes
- **Suspense/streaming**: preservado — skeleton atualizado para o novo layout
- **SecretariaDashboard**: intocado

## Stack

Next.js 16 App Router · TypeScript strict · Supabase SSR · Tailwind CSS v4 · shadcn/ui tokens · lucide-react · date-fns · sonner (toast)

---

## File Map

### Created
- `src/components/dashboard/dashboard-header.tsx`
- `src/components/dashboard/metrics-cards.tsx`
- `src/components/dashboard/consulta-cta-button.tsx`
- `src/components/dashboard/next-appointment-hero.tsx`
- `src/components/dashboard/today-agenda.tsx`
- `src/components/dashboard/attention-panel.tsx`

### Modified
- `src/app/dashboard/_components/dentista-dashboard.tsx` — refatorar queries + composição
- `src/app/dashboard/page.tsx` — remover header estático, atualizar chamada do skeleton

---

## Task 1: Criar `dashboard-header.tsx`

**File:** `src/components/dashboard/dashboard-header.tsx`

**Steps:**

1. Criar o arquivo com o seguinte conteúdo:

```tsx
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface DashboardHeaderProps {
  nome: string;
  totalHoje: number;
  proximoAtendimento: { data_hora: string } | null;
  now: Date;
}

function getHoraSaudacao(now: Date): string {
  const hour = now.getHours();
  if (hour < 12) return 'Bom dia';
  if (hour < 18) return 'Boa tarde';
  return 'Boa noite';
}

function getSubtitulo(
  totalHoje: number,
  proximoAtendimento: { data_hora: string } | null,
): string {
  if (totalHoje === 0) {
    return 'Você não possui atendimentos agendados hoje.';
  }
  if (proximoAtendimento) {
    const hora = format(parseISO(proximoAtendimento.data_hora), 'HH:mm');
    return `Hoje você tem ${totalHoje} atendimento${totalHoje !== 1 ? 's' : ''}. Próximo: às ${hora}.`;
  }
  return 'Todos os atendimentos de hoje foram concluídos.';
}

export function DashboardHeader({
  nome,
  totalHoje,
  proximoAtendimento,
  now,
}: DashboardHeaderProps) {
  const primeiroNome = nome.split(' ')[0];
  const saudacao = getHoraSaudacao(now);
  const subtitulo = getSubtitulo(totalHoje, proximoAtendimento);
  const dataFormatada = format(now, "EEEE, dd 'de' MMMM", { locale: ptBR });

  return (
    <div className="mb-8 md:mb-10">
      <p className="text-[11px] font-bold text-text-secondary uppercase tracking-[0.2em] mb-1 font-mono capitalize">
        {dataFormatada}
      </p>
      <h1 className="font-heading text-3xl md:text-4xl text-text-primary">
        {saudacao}, Dr. {primeiroNome}.
      </h1>
      <p className="text-text-secondary text-sm font-medium mt-1">{subtitulo}</p>
    </div>
  );
}
```

2. Commit: `git commit -m "feat(dashboard): DashboardHeader — saudação contextual"`

---

## Task 2: Criar `metrics-cards.tsx`

**File:** `src/components/dashboard/metrics-cards.tsx`

**Steps:**

1. Criar o arquivo:

```tsx
import { Stethoscope, CalendarDays, CalendarCheck2 } from 'lucide-react';

interface MetricsCardsProps {
  consultasHoje: number;
  agendaSemana: number;
  concluidosHoje: number;
}

interface MetricCardProps {
  icon: React.ElementType;
  label: string;
  value: number;
  sublabel: string;
  highlight: boolean;
}

function MetricCard({ icon: Icon, label, value, sublabel, highlight }: MetricCardProps) {
  return (
    <div className="bg-surface p-6 rounded-3xl border border-border shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all relative overflow-hidden group">
      <div className="absolute top-0 right-0 p-4 opacity-[0.04] group-hover:opacity-[0.07] transition-opacity pointer-events-none">
        <Icon className="w-20 h-20 text-text-primary" />
      </div>
      <div className="text-[10px] font-bold text-text-secondary uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
        <div className="w-1.5 h-1.5 rounded-full bg-teal" />
        {label}
      </div>
      <div className="font-mono text-4xl md:text-5xl font-medium text-text-primary tracking-tight">
        {value}
      </div>
      <div
        className={`text-[10px] mt-4 font-bold uppercase tracking-wider flex items-center gap-1 w-fit px-2 py-1 rounded-md ${
          highlight && value > 0
            ? 'bg-teal/10 text-teal'
            : 'bg-surface-alt text-text-secondary'
        }`}
      >
        {sublabel}
      </div>
    </div>
  );
}

export function MetricsCards({
  consultasHoje,
  agendaSemana,
  concluidosHoje,
}: MetricsCardsProps) {
  return (
    <div
      id="dex-tour-metrics"
      className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4 mb-8 md:mb-10"
    >
      <MetricCard
        icon={Stethoscope}
        label="Consultas hoje"
        value={consultasHoje}
        sublabel={consultasHoje === 1 ? 'Agendada' : 'Agendadas'}
        highlight
      />
      <MetricCard
        icon={CalendarDays}
        label="Agenda da semana"
        value={agendaSemana}
        sublabel="Esta semana"
        highlight={false}
      />
      <MetricCard
        icon={CalendarCheck2}
        label="Concluídos hoje"
        value={concluidosHoje}
        sublabel={concluidosHoje === 1 ? 'Atendimento' : 'Atendimentos'}
        highlight
      />
    </div>
  );
}
```

2. Commit: `git commit -m "feat(dashboard): MetricsCards — 3 cards operacionais"`

---

## Task 3: Criar `consulta-cta-button.tsx` (client island)

**File:** `src/components/dashboard/consulta-cta-button.tsx`

**Steps:**

1. Criar o arquivo:

```tsx
'use client';

import { toast } from 'sonner';
import { Stethoscope } from 'lucide-react';

export function ConsultaCtaButton() {
  return (
    <button
      onClick={() => toast.info('Modo consulta será implementado em breve')}
      className="inline-flex items-center gap-2.5 px-6 py-3.5 rounded-2xl text-sm font-bold text-white transition-all hover:opacity-90 hover:-translate-y-0.5 active:scale-95"
      style={{
        background: '#2f9c85',
        boxShadow: '0 4px 20px rgba(47,156,133,0.35)',
      }}
    >
      <Stethoscope className="w-4 h-4" />
      Entrar no Modo Consulta
    </button>
  );
}
```

2. Commit: `git commit -m "feat(dashboard): ConsultaCtaButton — client island com toast placeholder"`

---

## Task 4: Criar `next-appointment-hero.tsx`

**File:** `src/components/dashboard/next-appointment-hero.tsx`

**Steps:**

1. Criar o arquivo:

```tsx
import Link from 'next/link';
import { format, parseISO } from 'date-fns';
import { Clock, Calendar, AlertCircle, FileText } from 'lucide-react';
import { ConsultaCtaButton } from './consulta-cta-button';

interface NextAppointmentHeroProps {
  agendamento: {
    id: string;
    data_hora: string;
    observacoes: string | null;
    paciente: { id: string; nome: string; observacoes: string | null } | null;
    ultimaFichaQueixa: string | null;
  } | null;
}

export function NextAppointmentHero({ agendamento }: NextAppointmentHeroProps) {
  if (!agendamento?.paciente) {
    return (
      <div className="mb-8 md:mb-10 bg-surface rounded-3xl border border-border p-8 md:p-10 flex flex-col items-center justify-center text-center min-h-[180px]">
        <Calendar className="w-10 h-10 text-border mb-4" />
        <p className="font-heading text-xl text-text-primary mb-1">
          Nenhum atendimento pendente
        </p>
        <p className="text-sm text-text-secondary mb-4">
          Sua agenda está vazia ou todos os atendimentos foram concluídos.
        </p>
        <Link
          href="/dashboard/agendamentos"
          className="text-teal text-sm font-semibold hover:underline"
        >
          Ver agenda completa →
        </Link>
      </div>
    );
  }

  const { paciente, data_hora, observacoes, ultimaFichaQueixa } = agendamento;
  const hora = format(parseISO(data_hora), 'HH:mm');

  // Quebra observacoes clínicas do paciente por linha, ignora linhas vazias
  const alertas = paciente.observacoes
    ? paciente.observacoes
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean)
    : [];

  return (
    <div
      className="mb-8 md:mb-10 rounded-3xl border border-border/60 overflow-hidden"
      style={{
        background:
          'linear-gradient(135deg, var(--surface) 0%, color-mix(in srgb, var(--surface) 92%, #2f9c85) 100%)',
      }}
    >
      <div className="p-6 md:p-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
        {/* Info */}
        <div className="flex-1 min-w-0">
          {/* Label com pulso */}
          <div className="text-[10px] font-bold text-teal uppercase tracking-[0.2em] mb-3 flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal/50" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-teal" />
            </span>
            Próximo atendimento
          </div>

          {/* Nome */}
          <h2 className="font-heading text-3xl md:text-4xl text-text-primary mb-2 truncate">
            {paciente.nome}
          </h2>

          {/* Horário e tipo */}
          <div className="flex items-center gap-2 text-text-secondary mb-4 flex-wrap">
            <Clock className="w-4 h-4 shrink-0" />
            <span className="font-mono text-lg font-bold text-text-primary">{hora}</span>
            {observacoes && (
              <>
                <span className="text-border">·</span>
                <span className="text-sm text-text-secondary">{observacoes}</span>
              </>
            )}
          </div>

          {/* Alertas clínicos (só se existir) */}
          {alertas.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
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

          {/* Última ficha (só se existir) */}
          {ultimaFichaQueixa && (
            <div className="flex items-center gap-2 text-text-secondary text-sm">
              <FileText className="w-3.5 h-3.5 shrink-0" />
              <span>
                Último:{' '}
                <span className="text-text-primary font-medium">
                  {ultimaFichaQueixa}
                </span>
              </span>
            </div>
          )}
        </div>

        {/* CTA */}
        <div className="flex flex-col gap-3 shrink-0">
          <ConsultaCtaButton />
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
```

2. Commit: `git commit -m "feat(dashboard): NextAppointmentHero — hero dominante com dados reais"`

---

## Task 5: Criar `today-agenda.tsx`

**File:** `src/components/dashboard/today-agenda.tsx`

**Steps:**

1. Criar o arquivo:

```tsx
import Link from 'next/link';
import { format, parseISO } from 'date-fns';
import { Calendar, ArrowRight } from 'lucide-react';

export type AgendamentoHojeItem = {
  id: string;
  data_hora: string;
  status: string;
  paciente: { id: string; nome: string } | null;
};

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  scheduled:   { label: 'Aguardando',     color: 'bg-surface-alt text-text-secondary' },
  confirmed:   { label: 'Confirmado',     color: 'bg-teal/10 text-teal' },
  checked_in:  { label: 'Na Recepção',    color: 'bg-teal/20 text-teal font-bold' },
  in_progress: { label: 'Em Atendimento', color: 'bg-teal text-white' },
  completed:   { label: 'Realizado',      color: 'bg-surface-alt text-text-secondary' },
  no_show:     { label: 'Faltou',         color: 'bg-coral/10 text-coral' },
  cancelled:   { label: 'Cancelado',      color: 'bg-coral/10 text-coral' },
};

// Status que indicam atendimento encerrado
const DONE_STATUSES = new Set(['completed', 'no_show', 'cancelled']);
// Status que indicam atendimento ativo agora
const ACTIVE_STATUSES = new Set(['in_progress', 'checked_in']);

interface TodayAgendaProps {
  agendamentos: AgendamentoHojeItem[];
}

export function TodayAgenda({ agendamentos }: TodayAgendaProps) {
  if (agendamentos.length === 0) {
    return (
      <div className="bg-surface rounded-2xl border border-border shadow-sm p-10 text-center">
        <Calendar className="w-8 h-8 text-border mx-auto mb-3" />
        <p className="text-text-secondary text-sm font-medium">
          Nenhum atendimento agendado para hoje.
        </p>
      </div>
    );
  }

  // Índice do primeiro agendamento que não está encerrado nem ativo = "próximo"
  const nextIdx = agendamentos.findIndex(
    (a) => !DONE_STATUSES.has(a.status) && !ACTIVE_STATUSES.has(a.status),
  );

  return (
    <div className="bg-surface rounded-2xl border border-border shadow-sm overflow-hidden">
      <div className="divide-y divide-border">
        {agendamentos.map((apt, idx) => {
          const hora = format(parseISO(apt.data_hora), 'HH:mm');
          const cfg = STATUS_CONFIG[apt.status] ?? STATUS_CONFIG.scheduled;
          const isDone = DONE_STATUSES.has(apt.status);
          const isActive = ACTIVE_STATUSES.has(apt.status);
          const isNext = idx === nextIdx && nextIdx !== -1;

          return (
            <div
              key={apt.id}
              className={[
                'flex items-center justify-between px-4 py-3.5 transition-colors border-l-2',
                isActive ? 'bg-teal/[0.04] border-l-teal' : '',
                isNext && !isActive ? 'bg-surface-alt/30 border-l-teal/60' : '',
                !isActive && !isNext ? 'border-l-transparent' : '',
                isDone ? 'opacity-50' : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              <div className="flex items-center gap-3 min-w-0">
                <span
                  className={`font-mono text-sm font-bold shrink-0 w-11 text-center ${
                    isActive || isNext ? 'text-teal' : 'text-text-secondary'
                  }`}
                >
                  {hora}
                </span>
                <div
                  className={`w-px h-8 rounded-full shrink-0 ${
                    isActive || isNext ? 'bg-teal' : 'bg-border'
                  }`}
                />
                {apt.paciente ? (
                  <span
                    className={`font-semibold text-sm truncate ${
                      isDone ? 'text-text-secondary' : 'text-text-primary'
                    }`}
                  >
                    {apt.paciente.nome}
                  </span>
                ) : (
                  <span className="text-sm text-text-secondary">Paciente</span>
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0 ml-2">
                <span
                  className={`font-mono text-[10px] uppercase tracking-wider px-2.5 py-1 rounded-lg ${cfg.color}`}
                >
                  {cfg.label}
                </span>
                {apt.paciente && !isDone && (
                  <Link
                    href={`/dashboard/pacientes/${apt.paciente.id}`}
                    className="text-[10px] font-bold uppercase tracking-wider text-teal hover:text-teal transition-colors flex items-center gap-0.5 px-2 py-1 rounded-lg hover:bg-teal/5"
                  >
                    Abrir <ArrowRight className="w-3 h-3" />
                  </Link>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

2. Commit: `git commit -m "feat(dashboard): TodayAgenda — lista server-first com estados por status"`

---

## Task 6: Criar `attention-panel.tsx`

**File:** `src/components/dashboard/attention-panel.tsx`

**Steps:**

1. Criar o arquivo:

```tsx
import Link from 'next/link';
import { Bell, CheckCircle2, AlertCircle, Clock } from 'lucide-react';

interface AttentionPanelProps {
  semConfirmacao: number;
  orcamentosAguardando: number;
}

interface AttentionItemProps {
  icon: React.ElementType;
  label: string;
  count: number;
  href: string;
  colorClass: string;
}

function AttentionItem({
  icon: Icon,
  label,
  count,
  href,
  colorClass,
}: AttentionItemProps) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between p-4 rounded-2xl border border-border bg-surface hover:bg-surface-alt transition-colors"
    >
      <div className="flex items-center gap-3">
        <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${colorClass}`}>
          <Icon className="w-4 h-4" />
        </div>
        <span className="text-sm font-medium text-text-primary">{label}</span>
      </div>
      <span
        className={`font-mono text-sm font-bold px-2.5 py-1 rounded-lg shrink-0 ${colorClass}`}
      >
        {count}
      </span>
    </Link>
  );
}

export function AttentionPanel({
  semConfirmacao,
  orcamentosAguardando,
}: AttentionPanelProps) {
  const hasItems = semConfirmacao > 0 || orcamentosAguardando > 0;

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <Bell className="w-4 h-4 text-text-secondary" />
        <h2 className="font-heading text-xl text-text-primary">Atenção hoje</h2>
      </div>

      {hasItems ? (
        <div className="space-y-3">
          {semConfirmacao > 0 && (
            <AttentionItem
              icon={AlertCircle}
              label={`${semConfirmacao} sem confirmação`}
              count={semConfirmacao}
              href="/dashboard/agendamentos"
              colorClass="bg-amber-500/10 text-amber-600 dark:text-amber-400"
            />
          )}
          {orcamentosAguardando > 0 && (
            <AttentionItem
              icon={Clock}
              label={`${orcamentosAguardando} orçamento${orcamentosAguardando !== 1 ? 's' : ''} aguardando`}
              count={orcamentosAguardando}
              href="/dashboard/orcamentos"
              colorClass="bg-surface-alt text-text-secondary"
            />
          )}
        </div>
      ) : (
        <div className="bg-surface rounded-2xl border border-border p-6 text-center">
          <CheckCircle2 className="w-8 h-8 text-teal mx-auto mb-2" />
          <p className="text-sm font-medium text-text-primary">Tudo em ordem hoje.</p>
          <p className="text-xs text-text-secondary mt-1">Nenhuma pendência acionável.</p>
        </div>
      )}
    </div>
  );
}
```

2. Commit: `git commit -m "feat(dashboard): AttentionPanel — pendências acionáveis com empty state"`

---

## Task 7: Refatorar `dentista-dashboard.tsx`

**File:** `src/app/dashboard/_components/dentista-dashboard.tsx`

**Steps:**

1. Substituir o conteúdo completo do arquivo:

```tsx
import {
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
} from 'date-fns';
import { createClient } from '@/lib/supabase/server';
import type { DentistaCache } from '@/lib/get-dentista';
import { DashboardHeader } from '@/components/dashboard/dashboard-header';
import { MetricsCards } from '@/components/dashboard/metrics-cards';
import { NextAppointmentHero } from '@/components/dashboard/next-appointment-hero';
import { TodayAgenda, type AgendamentoHojeItem } from '@/components/dashboard/today-agenda';
import { AttentionPanel } from '@/components/dashboard/attention-panel';

// ── Tipo local para as rows brutas do Supabase ────────────────────────────────

type AtendimentoRaw = {
  id: string;
  data_hora: string;
  status: string;
  observacoes: string | null;
  paciente: { id: string; nome: string; observacoes: string | null } | null;
};

// ── Status que encerram o atendimento ─────────────────────────────────────────

const DONE = new Set(['completed', 'no_show', 'cancelled']);

// ── Server Component principal ────────────────────────────────────────────────

export async function DentistaDashboard({ dentista }: { dentista: DentistaCache }) {
  const supabase = await createClient();
  const now = new Date();
  const todayStart = startOfDay(now).toISOString();
  const todayEnd = endOfDay(now).toISOString();
  const weekStart = startOfWeek(now, { weekStartsOn: 1 }).toISOString();
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 }).toISOString();

  const [
    { count: consultasHoje },
    { count: concluidosHoje },
    { count: agendaSemana },
    { count: semConfirmacao },
    { count: orcamentosAguardando },
    { data: atendimentosHojeRaw },
  ] = await Promise.all([
    // Consultas hoje (não canceladas/no-show)
    supabase
      .from('agendamentos')
      .select('*', { count: 'exact', head: true })
      .eq('clinica_id', dentista.clinica_id)
      .eq('dentista_id', dentista.id)
      .not('status', 'in', '(cancelled,no_show)')
      .gte('data_hora', todayStart)
      .lte('data_hora', todayEnd),

    // Concluídos hoje
    supabase
      .from('agendamentos')
      .select('*', { count: 'exact', head: true })
      .eq('clinica_id', dentista.clinica_id)
      .eq('dentista_id', dentista.id)
      .eq('status', 'completed')
      .gte('data_hora', todayStart)
      .lte('data_hora', todayEnd),

    // Agenda da semana
    supabase
      .from('agendamentos')
      .select('*', { count: 'exact', head: true })
      .eq('clinica_id', dentista.clinica_id)
      .eq('dentista_id', dentista.id)
      .not('status', 'in', '(cancelled,no_show)')
      .gte('data_hora', weekStart)
      .lte('data_hora', weekEnd),

    // Sem confirmação hoje (status 'scheduled' = aguardando qualquer ação)
    supabase
      .from('agendamentos')
      .select('*', { count: 'exact', head: true })
      .eq('clinica_id', dentista.clinica_id)
      .eq('dentista_id', dentista.id)
      .eq('status', 'scheduled')
      .gte('data_hora', todayStart)
      .lte('data_hora', todayEnd),

    // Orçamentos aguardando retorno
    supabase
      .from('orcamentos')
      .select('*', { count: 'exact', head: true })
      .eq('clinica_id', dentista.clinica_id)
      .in('status', ['rascunho', 'enviado']),

    // Lista de atendimentos hoje com dados do paciente
    supabase
      .from('agendamentos')
      .select('id, data_hora, status, observacoes, paciente:pacientes(id, nome, observacoes)')
      .eq('clinica_id', dentista.clinica_id)
      .eq('dentista_id', dentista.id)
      .gte('data_hora', todayStart)
      .lte('data_hora', todayEnd)
      .not('status', 'in', '(cancelled,no_show)')
      .order('data_hora', { ascending: true }),
  ]);

  const atendimentosHoje = (atendimentosHojeRaw ?? []) as unknown as AtendimentoRaw[];

  // Próximo = primeiro atendimento não encerrado
  const nextApt = atendimentosHoje.find((a) => !DONE.has(a.status)) ?? null;

  // Última ficha — executa apenas se houver próximo atendimento com paciente
  let ultimaFichaQueixa: string | null = null;
  if (nextApt?.paciente?.id) {
    const { data: ficha } = await supabase
      .from('fichas')
      .select('queixa_principal')
      .eq('paciente_id', nextApt.paciente.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    ultimaFichaQueixa =
      (ficha as { queixa_principal: string | null } | null)?.queixa_principal ?? null;
  }

  // Props tipadas para o hero
  const heroAgendamento = nextApt
    ? {
        id: nextApt.id,
        data_hora: nextApt.data_hora,
        observacoes: nextApt.observacoes,
        paciente: nextApt.paciente,
        ultimaFichaQueixa,
      }
    : null;

  // Props para a agenda (sem campo observacoes — não exibido na lista)
  const agendaItems: AgendamentoHojeItem[] = atendimentosHoje.map((a) => ({
    id: a.id,
    data_hora: a.data_hora,
    status: a.status,
    paciente: a.paciente,
  }));

  return (
    <>
      <DashboardHeader
        nome={dentista.nome}
        totalHoje={consultasHoje ?? 0}
        proximoAtendimento={nextApt}
        now={now}
      />

      <MetricsCards
        consultasHoje={consultasHoje ?? 0}
        agendaSemana={agendaSemana ?? 0}
        concluidosHoje={concluidosHoje ?? 0}
      />

      <NextAppointmentHero agendamento={heroAgendamento} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6 mb-8 md:mb-10">
        <div className="lg:col-span-2">
          <h2 className="font-heading text-xl text-text-primary mb-4">Agenda de Hoje</h2>
          <TodayAgenda agendamentos={agendaItems} />
        </div>
        <div>
          <AttentionPanel
            semConfirmacao={semConfirmacao ?? 0}
            orcamentosAguardando={orcamentosAguardando ?? 0}
          />
        </div>
      </div>
    </>
  );
}

// ── Skeleton (fallback do Suspense) ───────────────────────────────────────────

export function DashboardSkeleton() {
  return (
    <div className="animate-pulse">
      {/* Header skeleton */}
      <div className="mb-8 md:mb-10 space-y-2">
        <div className="h-3 w-32 bg-surface-alt rounded" />
        <div className="h-10 w-72 bg-surface-alt rounded-xl" />
        <div className="h-4 w-96 bg-surface-alt rounded" />
      </div>

      {/* Metrics skeleton */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4 mb-8 md:mb-10">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="bg-surface border border-border rounded-3xl p-6 h-[152px] flex flex-col justify-between"
          >
            <div className="h-2.5 w-24 bg-surface-alt rounded-full" />
            <div className="h-12 w-16 bg-surface-alt rounded-xl" />
            <div className="h-6 w-32 bg-surface-alt rounded-md" />
          </div>
        ))}
      </div>

      {/* Hero skeleton */}
      <div className="mb-8 md:mb-10 bg-surface border border-border rounded-3xl p-8 md:p-10 flex items-center justify-between gap-6">
        <div className="flex-1 space-y-3">
          <div className="h-3 w-32 bg-surface-alt rounded" />
          <div className="h-9 w-64 bg-surface-alt rounded-xl" />
          <div className="h-5 w-28 bg-surface-alt rounded" />
          <div className="flex gap-2">
            <div className="h-7 w-32 bg-surface-alt rounded-full" />
            <div className="h-7 w-24 bg-surface-alt rounded-full" />
          </div>
        </div>
        <div className="shrink-0">
          <div className="h-12 w-52 bg-surface-alt rounded-2xl" />
        </div>
      </div>

      {/* Agenda + Atenção skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
        <div className="lg:col-span-2">
          <div className="h-6 w-36 bg-surface-alt rounded mb-4" />
          <div className="bg-surface border border-border rounded-2xl overflow-hidden">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="flex items-center gap-4 px-4 py-3.5 border-b border-border last:border-0"
              >
                <div className="w-11 h-5 bg-surface-alt rounded shrink-0" />
                <div className="w-px h-8 bg-surface-alt shrink-0" />
                <div className="flex-1 h-4 bg-surface-alt rounded" />
                <div className="w-20 h-6 bg-surface-alt rounded-lg shrink-0" />
              </div>
            ))}
          </div>
        </div>
        <div className="space-y-3">
          <div className="h-6 w-32 bg-surface-alt rounded" />
          <div className="h-28 bg-surface border border-border rounded-2xl" />
        </div>
      </div>
    </div>
  );
}
```

2. Commit: `git commit -m "feat(dashboard): refatorar DentistaDashboard — novas queries + composição"`

---

## Task 8: Atualizar `page.tsx`

**File:** `src/app/dashboard/page.tsx`

**Steps:**

1. Fazer as seguintes alterações:
   - Remover o import de `Sparkles` e `Link` (não mais usados no header estático)
   - Remover a constante `canEdit` (não mais passada ao skeleton)
   - Remover o `<header>` estático (header agora é contextual dentro do Suspense)
   - Atualizar a chamada do `DashboardSkeleton` (não recebe mais `canEdit`)

2. O arquivo resultante:

```tsx
import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { getDentistaCached } from '@/lib/get-dentista';
import { createClient } from '@/lib/supabase/server';
import { PageTransition } from '@/components/layout/page-transition';
import { DentistaDashboard, DashboardSkeleton } from './_components/dentista-dashboard';
import { SecretariaDashboard } from './_components/secretaria-dashboard';
import type { AgendamentoHoje, DentistaItem } from './_components/secretaria-dashboard';

// ── Dashboard para Secretária ─────────────────────────────────────────────────

async function SecretaryDashboardServer({
  clinicaId,
  nome,
}: {
  clinicaId: string;
  nome: string;
}) {
  const supabase = await createClient();
  const now = new Date();

  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(now);
  endOfDay.setHours(23, 59, 59, 999);

  const todayStr = now.toISOString().split('T')[0];
  const endOfWeekDate = new Date(now);
  endOfWeekDate.setDate(endOfWeekDate.getDate() + 7);
  const endOfWeekStr = endOfWeekDate.toISOString().split('T')[0];

  const [
    { data: agendamentosRaw },
    { data: dentistasRaw },
    { data: orcamentosRaw },
    { data: pagamentosVencendoRaw },
  ] = await Promise.all([
    supabase
      .from('agendamentos')
      .select(
        'id, data_hora, status, observacoes, paciente:pacientes(id, nome), dentista:dentistas!agendamentos_dentista_id_fkey(id, nome)',
      )
      .eq('clinica_id', clinicaId)
      .gte('data_hora', startOfDay.toISOString())
      .lte('data_hora', endOfDay.toISOString())
      .neq('status', 'cancelled')
      .order('data_hora', { ascending: true })
      .limit(50),
    supabase
      .from('dentistas')
      .select('id, nome')
      .eq('clinica_id', clinicaId)
      .neq('role', 'secretaria')
      .eq('ativo', true)
      .order('nome', { ascending: true }),
    supabase
      .from('orcamentos')
      .select('total')
      .eq('clinica_id', clinicaId)
      .in('status', ['rascunho', 'enviado']),
    supabase
      .from('pagamentos')
      .select('data_vencimento, valor')
      .eq('clinica_id', clinicaId)
      .eq('status', 'pendente')
      .not('data_vencimento', 'is', null)
      .gte('data_vencimento', todayStr)
      .lte('data_vencimento', endOfWeekStr),
  ]);

  const agendamentos = (agendamentosRaw ?? []) as unknown as AgendamentoHoje[];
  const dentistas = (dentistasRaw ?? []) as DentistaItem[];
  const aReceber = (orcamentosRaw ?? []).reduce(
    (sum, o) => sum + (Number(o.total) || 0),
    0,
  );

  const pagamentosVencendo = (pagamentosVencendoRaw ?? []) as {
    data_vencimento: string;
    valor: number;
  }[];
  const venceHoje = pagamentosVencendo.filter(
    (p) => p.data_vencimento === todayStr,
  ).length;
  const venceSemana = pagamentosVencendo.filter(
    (p) => p.data_vencimento > todayStr,
  ).length;

  const totalHoje = agendamentos.length;
  const confirmados = agendamentos.filter((a) =>
    ['confirmed', 'checked_in', 'in_progress', 'completed'].includes(a.status),
  ).length;
  const aguardando = agendamentos.filter((a) => a.status === 'scheduled').length;

  return (
    <PageTransition>
      <SecretariaDashboard
        nome={nome}
        agendamentos={agendamentos}
        dentistas={dentistas}
        metricas={{ totalHoje, confirmados, aguardando, aReceber, venceHoje, venceSemana }}
      />
    </PageTransition>
  );
}

// ── Page principal ────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  const dentista = await getDentistaCached();
  if (!dentista) redirect('/login');

  if (dentista.role === 'secretaria') {
    return (
      <SecretaryDashboardServer
        clinicaId={dentista.clinica_id}
        nome={dentista.nome}
      />
    );
  }

  return (
    <PageTransition>
      <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto w-full">
        <Suspense fallback={<DashboardSkeleton />}>
          <DentistaDashboard dentista={dentista} />
        </Suspense>
      </div>
    </PageTransition>
  );
}
```

3. Commit: `git commit -m "feat(dashboard): page.tsx — remover header estático, skeleton sem canEdit"`

---

## Verificação final

Após todas as tasks, rodar:

```bash
npm run typecheck
```

Saída esperada: sem erros de tipo.

Checklist visual (abre `http://localhost:3000/dashboard`):
- [ ] Saudação contextual com nome do dentista e estado correto da agenda
- [ ] 3 cards de métricas visíveis e responsivos
- [ ] Hero mostra próximo paciente com dados reais disponíveis
- [ ] CTA dispara `toast.info(...)` ao clicar
- [ ] Agenda lista atendimentos com highlight no próximo
- [ ] Link "Abrir" navega para `/dashboard/pacientes/{id}`
- [ ] Attention panel mostra empty state quando sem pendências
- [ ] Skeleton exibe durante o streaming (testável via `loading.tsx` ou `React.lazy`)
- [ ] Dark mode sem cores hardcoded quebradas
- [ ] SecretariaDashboard intocado
