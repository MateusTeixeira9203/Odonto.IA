# Spec — Workstream K (demo estende) + L (elevar Apresentar)

> Pai: `plans/roadmap/plano-fase1-retencao.md` §⭐ "Estado atual + Sprint hoje→amanhã".
> Status: **rascunho para aprovação** (2026-06-30). Não codar antes do "ok" + design-brief (regra 4).
> Irmã de `plans/specs/spec-A-onboarding-persona.md` — **A não muda**; aquela máquina de passos continua igual.

## 1. Objetivo
- **K** — a demo de onboarding deixa de parar em "ficha organizada". Estende pra mostrar o end-state (a ficha morando no prontuário) e o **2º aha** (Apresentar). A simulação ensina; **sem slides**.
- **L** — elevar o "Apresentar" (hoje 3 cliques fundo, `FichasTab.tsx:1382`) a 2 momentos de alta intenção, com **seletor de fichas** quando aberto fora do contexto de uma ficha.

> **Ordem:** L primeiro (a demo de K cai no Apresentar elevado → L é dependência de K).

---

## 2. Workstream L — contratos

### 2.1 Apresentar no header do perfil do paciente
- **Local:** header do `PacienteDetailClient` (`paciente-detail-client.tsx`). Já recebe `orcamentos: OrcamentoComItens[]` e `fichasRecentesSSR: FichaRecente[]`.
- **Condição de exibição (prominência condicional):**
  ```ts
  const temAlgoParaApresentar = (fichasRecentesSSR?.length ?? 0) > 0;
  ```
  Sem isso → **não renderiza** o botão (não abrir painel vazio).
- **Ação:** abre o **seletor de fichas** (2.2), não vai direto ao painel.

### 2.2 Seletor de fichas (novo) — espelha o padrão de orçamentos
- **Componente:** estender `ApresentarPaciente` com `mode: 'picker' | 'direct'` (default `direct`), ou novo `ApresentarSeletorModal`. Decisão no detalhamento.
- **Input:** lista de fichas do paciente. Reusa `FichaRecente` (`id, created_at, queixa_principal, anotacoes, dentista`). Se "recentes" não cobrir tudo, buscar a lista completa — flag de detalhe.
- **UX:** lista clicável (data · queixa · dentista), mesma lógica de selecionar um orçamento. Selecionar → abre `ApresentarPanel` com aquele `fichaId`.
- **Invariante:** `ApresentarPanel` **nunca abre sem `fichaId` resolvido** (do seletor ou do contexto).

### 2.3 Apresentar na tela "Ficha salva!" (Modo Consulta)
- **Local:** `consulta-client.tsx`, branch `saved && !isDemo` (hoje só oferece assinatura + emitir documento).
- **Novo:** CTA primário **"Montar e apresentar o plano"**.
- **Wiring:** usa `savedFichaId` (já existe no estado) → abre `ApresentarPanel` **direto** (já tem contexto, sem seletor). A IA rascunha o plano da ficha recém-salva via `usePlanejamentoPaciente(...).generateFullPlanWithAI`.

### 2.4 Contextual — manter
- O botão `compact` na `FichasTab` (`mode: 'direct'`, apresenta a ficha expandida) **continua sem mudança de contrato**.

---

## 3. Workstream K — contratos (demo estendida)

### 3.1 Máquina de estados pós-save na demo
- **Local:** `consulta-client.tsx`, branch `saved && isDemo` (hoje terminal: "Você viu o DEX em ação").
- **Novo estado:**
  ```ts
  type DemoPostFicha = 'reveal' | 'assinatura' | 'indo_perfil';
  ```
  - `reveal` — "A ficha foi estruturada." + bifurcação: **[Ver o que acontece com a ficha]** / **[Pular]**.
  - `assinatura` — assinatura **mock** (3.2). Não grava.
  - Os dois caminhos (assinar **ou** pular) → `router.push('/dashboard/pacientes/demo?from=demo')`.

### 3.2 Assinatura mock
- **Invariante:** em demo **nada grava no banco** (não há `fichaId` real).
- **Abordagem (preferida):** prop `isDemo` no `ConsultaAssinaturaModal` → no submit simula sucesso (setTimeout) sem chamar a action. Alternativa: tela leve própria. Confirmar no detalhamento.
- **Remover** toda copy de "falta verificação" / estado pendente na demo.

### 3.3 Perfil demo com a ficha + Apresentar destacado (aha 2)
- `/dashboard/pacientes/demo` (já existe — "Maria da Silva (Demonstração)") precisa:
  1. **mostrar a ficha que a demo organizou** — hoje os dados do perfil demo são mock fixos; adicionar a ficha coerente com o relato. Fonte: ficha **canned** OU ler de `sessionStorage` o que foi organizado na demo. Decisão a detalhar.
  2. **o Apresentar do header (L) em destaque** — é o gatilho do aha 2.

### 3.4 Apresentar mockado na demo
- Paciente `'demo'` não tem dados reais → `usePlanejamentoPaciente` recebe **`mockSections`** quando `patientId === 'demo'`. **Conteúdo enlatado, dentista conduzindo, sem IA ao vivo.**

---

## 4. Invariantes (todos os workstreams)
1. **Demo nunca grava no banco** (assinatura, ficha, plano).
2. Apresentar do header **só aparece com algo pra apresentar**.
3. `ApresentarPanel` **nunca abre sem `fichaId` resolvido**.
4. Dark/light + `prefers-reduced-motion` respeitados.
5. **A máquina de passos do onboarding (spec-A) NÃO muda.**

## 5. Bugs do sprint (corrigir junto)
- **Badge POPULAR** (tela de planos): aplicar estilo de pill (fundo + borda + radius), não só texto âmbar.
- **Saudação "Dr. Dr."**: normalizar o split do nome pra não duplicar o prefixo "Dr.".

## 6. Pendente de design-brief (regra 4 — vem DEPOIS do "ok" desta spec)
- Visual do seletor de fichas (lista vs cards).
- Transições da demo estendida (`reveal → assinatura → perfil`).
- Peso visual do Apresentar no header (e o estado condicional).
- Conteúdo enlatado do Apresentar na demo (quais seções, qual caso clínico).

## 7. Fora de escopo
- C (régua de e-mails), D (relatório de valor), Parte 2 (G/H/I/J), billing.
- Qualquer mudança na máquina de passos do onboarding.
