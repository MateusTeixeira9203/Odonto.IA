# Spec Fase 1 · #4 — Simplificação da tela da secretária (G2)

> **Status:** PRONTA para execução. Criada 2026-07-12.
> **Modelo:** **Sonnet 5** (`/model claude-sonnet-5`) — edição de UI num componente + enxugar a query do server. **Gate:** `design-review` (o fundador pediu 2×: "sem perder o padrão de design").
> **Origem:** `roadmap-3-fases-2026-07.md` G2 · decisão do fundador (12/07): tirar da tela dela o que não serve (ex. dinheiro a receber), manter o essencial, reforçar ações rápidas.
> **Escopo:** só o **dashboard da secretária** (`secretaria-dashboard.tsx` + a fatia de dados dela em `dashboard/page.tsx`). A **reorg profunda** (agenda, perfil) fica pra Fase 3 (X2), informada pelo teste — aqui é enxugar o óbvio.

---

## 1. Problema

O dashboard da secretária mistura **métrica de dono** (previsão de dinheiro) com o que ela realmente opera. O fundador quer a tela **mais simples e intuitiva**, mantendo o que é dela: ver o paciente do dia (→ ficha), o financeiro pra lançar/registrar recebimento, e ações rápidas — **sem perder o design system**.

**Hoje** (`src/app/dashboard/_components/secretaria-dashboard.tsx`), de cima pra baixo:
1. Header (saudação + "Sistema Online") · 2. **4 métricas** (Consultas hoje, Confirmadas, Aguardando, **A receber**) · 3. banner **"Pagamentos vencendo"** · 4. "Atenção necessária" (pendências) · 5. grid: Agenda de Hoje + Ações Rápidas + "Dentistas hoje".

---

## 2. Decisões (o que é dela vs ruído)

| Bloco | Decisão | Motivo |
|---|---|---|
| Métrica **"A receber"** (`:338-343`) | **Remover** | Previsão de faturamento = concern de dono, não da secretária. Nomeado pelo fundador |
| Banner **"Pagamentos vencendo"** (`:346-379`) | **Remover** | Mesma natureza (previsão de dinheiro); redundante com a pendência "pagamento vencido" que já aparece na lista de Atenção |
| Métricas **Consultas hoje / Confirmadas / Aguardando** | **Manter** (vira grid de 3) | Operacional — é o dia dela |
| **"Atenção necessária"** (pendências) | **Manter** | Acionável e centrado no paciente (follow-up, vencido) — tarefa dela. **Se** o teste mostrar ruído, trimar por tipo fica pra Fase 3 |
| **Agenda de Hoje** + status inline + Assinar | **Manter intacto** | Núcleo do trabalho dela |
| **Ações Rápidas** | **Manter + reforçar** (§4) | O que ela mais usa |
| **"Dentistas hoje"** (`:602-637`) | **Manter** | Filtro útil por dentista |

---

## 3. Remoções (código)

### 3.1 UI — `secretaria-dashboard.tsx`
- **Métrica "A receber":** remover o 4º `<MetricCard>` (`:338-343`). Ajustar o grid (`:317`) de `lg:grid-cols-4` → `lg:grid-cols-3`. Remover `aReceber` do type `metricas` (`:68`).
- **Banner "Pagamentos vencendo":** remover o bloco condicional inteiro (`:346-379`). Remover `venceHoje`/`venceSemana` do type `metricas` (`:69-70`).

### 3.2 Server — `src/app/dashboard/page.tsx` (`SecretaryDashboardServer`)
Parar de computar o que a UI não usa mais (menos query = mais rápido no PC da clínica):
- Remover a query `orcamentosRaw` (`:61-65`) e o cálculo `aReceber` (`:97-100`).
- Remover as queries `pagamentosVencendoRaw` (`:66-73`) e a derivação `venceHoje`/`venceSemana` (`:102-111`).
- Ajustar o objeto `metricas` passado ao componente (`:167`) pra `{ totalHoje, confirmados, aguardando }`.
- **Manter** `pagamentosVencidosRaw` (`:74-83`) e `followupsRaw` — alimentam a lista de pendências (que fica).

---

## 4. Ações Rápidas — reforçar (`:536-599`)

Hoje: Novo Agendamento · Novo Paciente · Lançar Pagamento · Pacientes.
O fundador quer **mais botões de ação rápida** e destacou "o financeiro pra lançar e **registrar recebimento**".

**Proposta (mesma anatomia de Link+ícone já existente — reuso de padrão, tokens teal):**
1. **Novo Agendamento** (mantém) → `/dashboard/agendamentos`
2. **Novo Paciente** (mantém) → `/dashboard/pacientes/novo`
3. **Registrar Recebimento** (renomeia/clarifica o "Lançar Pagamento") → `/dashboard/financeiro` — ícone `Wallet`, o gesto de dinheiro que É dela (registrar o que o paciente pagou)
4. **Pacientes** (mantém) → `/dashboard/pacientes`

> **Único item de confirmação visual** (eyeball com o Mateus): quais botões extras entram além desses 4. Candidatos que servem o balcão: "Buscar paciente", "Agenda de amanhã", atalho de assinatura pendente. **Não** incluir "Atender agora"/walk-in — entra no Modo Consulta, que é bloqueado pra secretária (spec #1/B7). Definir o conjunto final no `design-review`, sem quebrar o grid `[1fr_220px]`.

---

## 5. Invariantes
1. **Zero mudança de lógica** na agenda, status inline, assinatura de recepção ou pendências — só remoção de blocos de métrica/banner e ajuste de ações rápidas.
2. **Design system intacto:** reusar `MetricCard` e o padrão `Link` das ações rápidas; só tokens (`bg-surface`, `text-*`, `teal`, `border-border`); dark/light corretos; nada hardcoded.
3. A tela da secretária **não** mostra previsão de faturamento (A receber / vencendo).
4. `SecretaryDashboardServer` não roda mais as queries de orçamento/vencendo (menos trabalho, mesmo resultado visual).
5. Nada muda no dashboard do **dentista** (`DentistaDashboard`) — esta spec é só o ramo secretária.
6. `tsc` + `eslint` limpos; `design-review` aprova.

---

## 6. Gates de aceite
- [ ] Dashboard da secretária sem "A receber" e sem banner "Pagamentos vencendo".
- [ ] 3 métricas operacionais alinhadas (grid de 3, sem buraco).
- [ ] Pendências, agenda, status inline, "Assinar" e "Dentistas hoje" funcionando igual.
- [ ] Ações rápidas reforçadas (≥4, com "Registrar Recebimento" claro), grid intacto.
- [ ] Dark e light corretos; `design-review` sem apontamento de quebra de padrão.
- [ ] Dashboard do dentista inalterado.

---

## 7. Fora de escopo (Fase 3 · X2)
- Reorg profunda da agenda/perfil da secretária (informada pelo teste presencial).
- Trimar as pendências por tipo, se a lista soar ruidosa no uso real.
- Qualquer mudança no financeiro em si (só linka pra ele).
