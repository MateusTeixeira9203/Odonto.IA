# Modo Consulta — Tela de Copiloto (redesign da captura)

**Data:** 2026-06-16
**Objetivo:** Tirar o Modo Consulta da cara de "bloco de notas" e transformá-lo num **copiloto clínico premium**: presença do DEX com o logo oficial, detecção ao vivo do que o DEX está captando, e o sidebar mostrando o **progresso do tratamento** (já que a ficha É o tratamento e evolui).

---

## Decisões fechadas (design aprovado)

- **Layout 2 colunas mantido:** sidebar (copiloto/resumo) | área de captura.
- **Logo oficial do DEX:** **bolinha AZUL com olhos retangulares verticais** (não é o ◆ nem o ícone `Bot` — esses são versões antigas inconsistentes). Criar um componente canônico `DexAvatar`.
- **Captura vira canvas de copiloto:** presença do DEX no topo + textarea + **detecção ao vivo** (chips de dentes/procedimentos) + voz + "Organizar com Dex".
- **Sidebar ganha progresso do tratamento:** "Falta" (pendentes) + "Feito" (concluídos), com os dentes + barra.
- **Tudo factível sem infra nova** (ver "Reuso de dados").

---

## Reuso de dados (nada novo no backend)

- **Falta / Feito:** o `ConsultationSidebar` **já recebe** `planejamento.etapas` (com `titulo`, `dente`, `status`). Hoje só mostra "Pendências" — estender pra Falta (status≠concluido) + Feito (status=concluido) + barra de progresso.
- **Detecção de dentes (ao vivo):** **regex no cliente** sobre `textoLivre` — FDI `/\b([1-4][1-8])\b/g`. Instantâneo, grátis, sem API.
- **Detecção de procedimentos (ao vivo):** reaproveitar o **debounce do DEX que já existe** (`/api/sugerir-orcamento`, mesmo padrão do FichasTab) — debounce generoso (~2s de pausa) pra custo baixo.
- **Logo:** novo componente local (sem asset externo).

---

## Arquivos

| Arquivo | Ação |
|---|---|
| `src/components/ui/dex-avatar.tsx` | **criar** — logo oficial (bolinha azul + olhos verticais) |
| `src/app/consulta/[agendamentoId]/_components/consulta-client.tsx` | modificar — presença DEX + detecção ao vivo + botão Organizar |
| `src/app/consulta/[agendamentoId]/_components/consultation-sidebar.tsx` | modificar — progresso do tratamento (Falta/Feito + barra) |

---

## Incrementos (cada um com checkpoint `tsc`)

### 1 — `DexAvatar` (logo oficial)
- Criar `src/components/ui/dex-avatar.tsx`: **círculo azul** com **dois olhos = retângulos arredondados verticais** brancos. Prop `size`. Opção `blink`/pulse sutil (reusar a animação do `DexFace`, mas em círculo azul).
- **Confirmar o azul exato** com o usuário antes de fixar (o sistema é teal; o DEX é azul — preciso do hex certo). Default provisório: um azul de marca.
- (Opcional/consistência) apontar o `DexFace` do onboarding pra esse mesmo avatar — padroniza o DEX no app. Fora do escopo imediato, anotar.

### 2 — Presença do DEX na captura
- No `consulta-client.tsx`, no topo da área de captura (antes da textarea): faixa com `<DexAvatar />` + **"Dex · Copiloto"** + subtítulo "Fale ou digite — eu monto a ficha".
- Substitui o cabeçalho atual simples.

### 3 — Detecção ao vivo (chips)
- **Dentes:** estado derivado de `textoLivre` via regex FDI (client-side), atualizado a cada digitação.
- **Procedimentos:** hook de debounce (~2s) chamando `/api/sugerir-orcamento` (padrão do FichasTab) → nomes detectados.
- Render: bloco "**◆→DexAvatar Detectando ao vivo**" com chips teal (dente · procedimento) + chip âmbar (queixa, se simples de derivar — senão omitir na v1).
- Só aparece quando há texto suficiente (ex.: >20 car.), pra não poluir vazio.

### 4 — Progresso do tratamento na sidebar
- No `consultation-sidebar.tsx`, transformar a seção "Pendências" em **"Tratamento"** com:
  - Barra de progresso (`concluídas / total` das etapas).
  - **Falta:** etapas `status≠concluido` → dente badge âmbar + título.
  - **Feito:** etapas `status=concluido` → check teal + título riscado.
- Estado vazio (paciente sem planejamento): mostrar algo leve ("Tratamento ainda não iniciado") em vez de seção vazia.

### 5 — Botão "Organizar com Dex"
- Trocar o ícone do botão hero por `<DexAvatar size="sm" />` (consistência da marca).

### 6 — Verificação
- `tsc` limpo + lint dos arquivos.
- Manual (logado): abrir Modo Consulta → presença DEX correta (bolinha azul + olhos) → digitar → dentes aparecem instantâneo, procedimentos após pausa → sidebar mostra Falta/Feito → Organizar funciona igual.

---

## Invariantes (não quebrar)
- O fluxo de captura/`Organizar com DEX`/`handleFormatar`/`handleSalvar` continua idêntico — a detecção ao vivo é **aditiva** (não substitui o Organizar).
- A animação de processamento do DEX (overlay) já existente permanece.
- Modo demo (`isDemo`) + o coach guiado continuam funcionando.

## Riscos
- **Custo do debounce de procedimentos:** mitigado com pausa de ~2s + mínimo de caracteres. Dentes são grátis (regex).
- **Cor do logo:** preciso do hex do azul oficial (provisório até confirmar).

## Aberto pra confirmar no início da execução
- **Qual o azul exato** do DEX (hex)?
