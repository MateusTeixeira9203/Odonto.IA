# Dashboard Refactor — Odonto.IA
**Data:** 2026-05-24  
**Status:** Aprovado — pronto para implementação

---

## Objetivo

Refatorar o dashboard de dentista/admin para funcionar como central operacional clínica — não painel administrativo.

---

## Escopo

- Afeta: `src/app/dashboard/page.tsx`, `src/app/dashboard/_components/dentista-dashboard.tsx`
- Cria: `src/components/dashboard/` (5 componentes)
- Preserva: `SecretariaDashboard`, `DashboardSkeleton`, padrão Suspense/streaming

---

## Layout

```
[Header contextual — full width]
[Metrics: 3 cards — grid-cols-3]
[Hero: Próximo Atendimento — full width, dominante]
[Agenda de Hoje (2/3) | Atenção Hoje (1/3)]
```

---

## Componentes novos — `src/components/dashboard/`

### `dashboard-header.tsx` — Server Component
Props: `{ nome: string; totalHoje: number; proximoAtendimento: { data_hora: string } | null; now: Date }`

Estados:
- `totalHoje === 0` → "Você não possui atendimentos agendados hoje."
- `proximoAtendimento !== null` → "Hoje você tem N atendimentos. Próximo: às HH:MM."
- `proximoAtendimento === null && totalHoje > 0` → "Todos os atendimentos de hoje foram concluídos."

Saudação via `getHoraSaudacao(now)`:
- `< 12h` → "Bom dia"
- `12–17h` → "Boa tarde"
- `≥ 18h` → "Boa noite"

Exibição de hora formatada server-side com `format(parseISO(data_hora), 'HH:mm', { locale: ptBR })`.

---

### `metrics-cards.tsx` — Server Component
Props: `{ consultasHoje: number; agendaSemana: number; concluidosHoje: number }`

Três cards:
1. **Consultas hoje** — count não-cancelado do dia
2. **Agenda da semana** — count não-cancelado da semana
3. **Concluídos hoje** — count `status === 'completed'` hoje

Visual: mesmo padrão dos cards atuais (`bg-surface rounded-3xl border shadow-sm hover:-translate-y-0.5`).

---

### `next-appointment-hero.tsx` — Server Component + Client island para CTA

Props:
```ts
interface NextAppointmentHeroProps {
  agendamento: {
    id: string;
    data_hora: string;
    observacoes: string | null;
    paciente: { id: string; nome: string; observacoes: string | null } | null;
    ultimaFichaQueixa: string | null; // null se não houver ficha
  } | null;
}
```

Regra de dados (mostra se existir, omite se não):
- Sempre: nome do paciente + horário
- Se existir: `agendamento.observacoes` → tipo/motivo da consulta
- Se existir: `paciente.observacoes` → alertas clínicos em badges
- Se existir: `ultimaFichaQueixa` → "Último: {queixa}"

CTA — Client island `<ConsultaCtaButton>`:
```ts
'use client';
onClick={() => toast.info("Modo consulta será implementado em breve")
```

Fallback (sem próximo): estado vazio elegante + link "Ver agenda →" para `/dashboard/agendamentos`.

---

### `today-agenda.tsx` — Server Component majoritário

Props: `{ agendamentos: AgendamentoHojeItem[]; }` (sem `now` — estado baseado em status)

Determinação de estado visual por **status** (timezone-safe):
- `in_progress` | `checked_in` → **atual** (bg teal/5, badge pulsando)
- `completed` | `no_show` | `cancelled` → **passado** (opacity 50%, texto muted)
- `scheduled` | `confirmed` → primeiro = **próximo** (border-l teal highlight), demais = **aguardando**

Ação rápida: Link para `/dashboard/pacientes/{paciente.id}` (rota real existente).

Se `agendamentos.length === 0`: estado vazio com `Calendar` icon + mensagem.

---

### `attention-panel.tsx` — Server Component

Props: `{ semConfirmacao: number; orcamentosAguardando: number }`

- "Sem confirmação" = `status === 'scheduled'` (enum real: `StatusAgendamento`)
- Sempre renderiza (não desaparece)
- Se ambos zerados: empty state elegante ("Tudo em ordem hoje.")
- Se > 0: item acionável com link e contagem

---

## Queries refatoradas no `DentistaDashboard`

### Removidas
- `totalPacientes` (métrica administrativa, não operacional)
- `orcamentosStatsRaw` / `taxaFechamento` (movido para fora do dashboard)

### Mantidas/adaptadas
- `atendimentosHoje` — adiciona `pacientes(id, nome, observacoes)` no select
- `orcamentosPendentes` → insumo do `AttentionPanel`

### Novas
```ts
// Consultas hoje (não-canceladas)
supabase.from('agendamentos').select('*', { count: 'exact', head: true })
  .eq('dentista_id', dentista.id)
  .not('status', 'in', '(cancelled,no_show)')
  .gte('data_hora', todayStart).lte('data_hora', todayEnd)

// Concluídos hoje
supabase.from('agendamentos').select('*', { count: 'exact', head: true })
  .eq('dentista_id', dentista.id)
  .eq('status', 'completed')
  .gte('data_hora', todayStart).lte('data_hora', todayEnd)

// Agenda da semana
supabase.from('agendamentos').select('*', { count: 'exact', head: true })
  .eq('clinica_id', dentista.clinica_id)
  .eq('dentista_id', dentista.id)
  .not('status', 'in', '(cancelled,no_show)')
  .gte('data_hora', weekStart).lte('data_hora', weekEnd)

// Sem confirmação hoje
supabase.from('agendamentos').select('*', { count: 'exact', head: true })
  .eq('dentista_id', dentista.id)
  .eq('status', 'scheduled')
  .gte('data_hora', todayStart).lte('data_hora', todayEnd)

// Última ficha — só executa se nextApt existir
supabase.from('fichas').select('queixa_principal')
  .eq('paciente_id', nextApt.paciente.id)
  .order('created_at', { ascending: false })
  .limit(1).maybeSingle()
```

---

## Timezone

- `now = new Date()` criado uma vez no `DentistaDashboard` e passado como prop
- Comparações de intervalo (todayStart/End, weekStart/End) usam `date-fns` com `startOfDay`/`endOfDay`
- Exibição de horas no header: `format(parseISO(data_hora), 'HH:mm')` — server-side
- Exibição de horas na agenda: client island mínimo `<HoraAgendamento>` que formata no browser se necessário (evita discrepância UTC)

---

## Constraints respeitados

- Sem novas dependências
- `SecretariaDashboard` intocado
- `DashboardSkeleton` atualizado para refletir novo layout
- TypeScript strict, sem `any`
- Dark/light mode via tokens existentes (`bg-surface`, `text-text-primary`, etc.)
