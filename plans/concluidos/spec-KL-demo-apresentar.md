# Spec — Workstream K (demo estende) + L (elevar Apresentar)

> Pai: `plans/roadmap/plano-fase1-retencao.md` §⭐ "Estado atual + Sprint hoje→amanhã".
> Status: **APROVADA** (2026-06-30). Próximo gate: design-brief de K+L antes de codar (regra 4).
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

### 2.3 Gerar plano na tela "Ficha salva!" (Modo Consulta)
- **Local:** `consulta-client.tsx`, branch `saved && !isDemo` (hoje só oferece assinatura + emitir documento).
- **Momento:** paciente ainda na cadeira, consulta recém-encerrada — não há tempo pra montar nada à mão. O movimento certo é **um clique → plano pronto**.
- **Novo:** CTA primário **"Gerar plano de tratamento"** (geração com IA, não montagem manual).
- **Wiring:** usa `savedFichaId` (já existe no estado) → dispara `usePlanejamentoPaciente(...).generateFullPlanWithAI` da ficha recém-salva → abre `ApresentarPanel` **direto** (já tem contexto, sem seletor) **já com o rascunho carregado, em estado de revisão**.
- **Invariante (anti-alucinação):** o clique **não** cai em apresentação full-screen. Abre em **revisão** — o dentista bate o olho / ajusta em ~10s e só então dispara **"Apresentar ao paciente"** (2º gesto). CLAUDE.md: a IA não inventa diagnóstico/procedimento; nenhum plano gerado vai aos olhos do paciente sem o aval do dentista. A IA carrega o esforço pesado; o dentista valida.

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
- **Contexto onboarding (decidido 2026-06-30):** quando o demo veio do onboarding
  (`retornoOnboarding`), o perfil demo recebe a flag (`&onboarding=1`) e seu CTA volta pra
  `/onboarding?step=plano` ("Continuar configuração"). Assim o usuário **vê o aha 2 E termina
  o cadastro** — o loop do onboarding (spec-A) não quebra. No demo standalone, o CTA do perfil
  é "Fazer minha primeira consulta real".

### 3.2 Assinatura mock
- **Invariante:** em demo **nada grava no banco** (não há `fichaId` real).
- **Abordagem (preferida):** prop `isDemo` no `ConsultaAssinaturaModal` → no submit simula sucesso (setTimeout) sem chamar a action. Alternativa: tela leve própria. Confirmar no detalhamento.
- **Remover** toda copy de "falta verificação" / estado pendente na demo.

### 3.3 Perfil demo com a ficha + Apresentar destacado (aha 2)
- `/dashboard/pacientes/demo` (já existe — "Maria da Silva (Demonstração)") precisa:
  1. **mostrar a ficha coerente com a Maria da Silva** — **decidido 2026-06-30: ficha `canned`**
     (enlatada, escrita por nós). Descartado o sessionStorage (mais risco/variação pra ganho marginal).
  2. **o Apresentar do header (L) em destaque** — é o gatilho do aha 2.

### 3.4 Apresentar mockado na demo
- Paciente `'demo'` não tem dados reais → `usePlanejamentoPaciente` recebe **`mockSections`** quando `patientId === 'demo'`. **Conteúdo enlatado, dentista conduzindo, sem IA ao vivo.**
- **Reforça o aha:** o usuário novo clica **"Gerar plano de tratamento"** e vê um plano completo aparecer sozinho (mock) — materializa o "um clique e tá pronto" que vende o momento da cadeira (2.3).

---

## 4. Invariantes (todos os workstreams)
1. **Demo nunca grava no banco** (assinatura, ficha, plano).
2. Apresentar do header **só aparece com algo pra apresentar**.
3. `ApresentarPanel` **nunca abre sem `fichaId` resolvido**.
4. **Plano gerado por IA nunca vai aos olhos do paciente sem revisão do dentista** — "Gerar" abre em revisão; "Apresentar ao paciente" é gesto separado (2.3).
5. Dark/light + `prefers-reduced-motion` respeitados.
6. **A máquina de passos do onboarding (spec-A) NÃO muda.**

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
