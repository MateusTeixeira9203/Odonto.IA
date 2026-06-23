# Design: DEX Tour Refatorado

**Data:** 2026-04-14  
**Status:** Aprovado  

---

## Problema

O tour DEX atual navega entre páginas de forma travada e rápida, exibindo apenas tooltips que apontam para elementos. O dentista termina o tour sem entender como o sistema funciona na prática. O step INTRO bloqueia a UI com um overlay preto de 90% de opacidade — a "tela estática" que o usuário quer remover.

---

## Solução

Evoluir o `DexOnboarding` existente (sem reescrever) para:
1. Substituir o INTRO bloqueante por um vignette radial suave
2. Tornar as transições entre páginas cinematográficas (1.4s, fade out/in)
3. Injetar componentes de simulação visual por página — dados falsos, sem tocar no banco

---

## Arquitetura

### Arquivos

```
src/components/onboarding/
  dex-onboarding.tsx        ← refatorar
  sim-agendamento.tsx       ← criar
  sim-ficha.tsx             ← criar
  sim-orcamento.tsx         ← criar
```

Nenhuma dependência nova. Nenhuma mudança em `DashboardShell`, `DexWidget` ou lógica de `localStorage`.

---

## Mudanças no `dex-onboarding.tsx`

### 1. INTRO sem overlay pesado
- **Antes:** `background: rgba(0,0,0,0.90)` cobrindo 100% da tela
- **Depois:** `radial-gradient` escurecendo nas bordas (máx 0.65 opacidade), DEX centralizado, UI do dashboard visível por baixo com blur leve

### 2. Transições cinematográficas
- **Antes:** `router.push` após 850ms com overlay genérico
- **Depois:** 1400ms, `fade out` da página atual → DEX voa pelo overlay escuro → `fade in` na chegada

### 3. Suporte a simulações
- Cada step ganha campo opcional `simulacao: 'agendamento' | 'ficha' | 'orcamento'`
- Ao chegar na página, o componente de simulação renderiza imediatamente
- DEX tooltip aparece 800ms depois (simulação começa primeiro)

---

## Componentes de Simulação

Todos são overlays fixos (`position: fixed`) com `zIndex: 9994` (abaixo do spotlight 9995 e DEX 9999). Dados 100% hardcoded — zero chamadas ao banco.

### `SimAgendamento` — `/dashboard/agendamentos`
Renderiza um modal fake com o mesmo visual do modal real de agendamento.

**Sequência de animação (total ~5.5s):**
1. Modal entra com spring (0–0.5s)
2. Campo "Paciente" digita: `"Ana Souza"` (0.5–1.5s)
3. Campo "Data/Hora" digita: `"15/05 às 14:30"` (1.5–2.5s)
4. Campo "Procedimento" digita: `"Limpeza + Avaliação"` (2.5–3.5s)
5. Botão "Salvar" pulsa em teal (3.5–4.5s)
6. Modal fecha com fade out (4.5–5.5s)

### `SimFicha` — `/dashboard/pacientes/demo`
Renderiza um painel de evolução clínica fake sobreposto.

**Sequência de animação (total ~6s):**
1. Painel entra com slide-up (0–0.5s)
2. Texto digita no campo de evolução: `"Paciente relata dor ao mastigar no lado direito. Verificado desgaste em 46 com necessidade de restauração..."` (0.5–3.5s)
3. Odontograma ilumina dente 46 com brilho teal (3.5–4.5s)
4. Badge `"IA pronta para gerar orçamento"` aparece (4.5–6s)

### `SimOrcamento` — `/dashboard/orcamentos`
Renderiza um card de orçamento fake com itens aparecendo progressivamente.

**Sequência de animação (total ~5.5s):**
1. Card entra com spring (0–0.5s)
2. Item 1 slide-in: `"Limpeza – R$ 150,00"` (0.5–1.5s)
3. Item 2 slide-in: `"Restauração – R$ 320,00"` (1.5–2.5s)
4. Item 3 slide-in: `"Avaliação – R$ 80,00"` (2.5–3.5s)
5. Total incrementa como contador: `R$ 0 → R$ 550,00` (3.5–4.5s)
6. Badge `"Gerado por IA"` pulsa (4.5–5.5s)

---

## Fluxo Completo do Tour

| # | Step ID | Página | Simulação | Tooltip DEX |
|---|---|---|---|---|
| 1 | INTRO | `/dashboard` | — | "Olá, Dr(a) [nome]! Eu sou o DEX, seu assistente clínico. Vou te mostrar o sistema em 1 minuto." |
| 2 | AGENDA | `/dashboard/agendamentos` | SimAgendamento | "Aqui você gerencia sua agenda. O bot do WhatsApp também agenda consultas direto aqui." |
| 3 | FICHA | `/dashboard/pacientes/demo` | SimFicha | "Você fala ou digita a evolução — eu transcrevo e já separo os procedimentos pra gerar o orçamento." |
| 4 | ORCAMENTO | `/dashboard/orcamentos` | SimOrcamento | "Orçamento gerado em segundos pela IA, com os preços da sua tabela. Pronto para enviar ao paciente." |
| 5 | FINALE | `/dashboard` | — | DEX voa para o FAB. "Estou aqui sempre que precisar. Pode me chamar!" |

---

## O Que Não Muda

- `localStorage` keys: `dex_onboarding_v1_{id}`, `dex_tour_v2_step_{id}`
- Spotlight + setas curvas animadas — mantidos
- Lógica de role (admin/dentista/secretária) — mantida
- `DexWidget`, `DashboardShell`, `DexIcon`, `FloatingDex` — sem alteração
- Página `/dashboard/pacientes/demo` já criada — não precisa de mudança

---

## Durações

| Elemento | Antes | Depois |
|---|---|---|
| Transição entre páginas | 850ms | 1400ms |
| SimAgendamento | — | 5500ms |
| SimFicha | — | 6000ms |
| SimOrcamento | — | 5500ms |
| DEX tooltip delay após simulação | — | 800ms |
