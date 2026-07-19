# Spec Fase 1 · #1 — Estabilização (desativações + fixes + higiene)

> **Status:** PRONTA para execução. Criada 2026-07-12.
> **Modelo:** execução em **Sonnet 5** (`/model claude-sonnet-5`) — tudo aqui é edição mapeada `arquivo:linha`, sem decisão ambígua. Nenhum spike de Opus.
> **Origem:** `roadmap-3-fases-2026-07.md` blocos A + B + F · `diagnostico-2026-07-12-tres-papeis.md` (B4/B5/B7/B8/B11) · auditoria 09/07 (CI, deps).
> **Branch:** `main` (working tree limpa; branch de feature nova por item ou uma `fix/fase1-estabilizacao`).
> **Princípio:** o teste é presencial e o Mateus está junto → tirar o fluxo guiado, deixar as funcionalidades redondas, não desestabilizar o dinheiro.

---

## 1. Objetivo

Deixar o sistema pronto pro teste presencial: sem teatro de onboarding, sem guia flutuante, com os atritos do loop clínico e da agenda fechados, e com uma rede mínima (CI + audit fix) pra não introduzir regressão na véspera.

**Fora desta spec:** IA (spec #2), DEX/motion (spec #3), secretária (spec #4), trial/pagamento (Fase 2).

---

## 2. Bloco A — Desativações (reversíveis: código fica, comportamento sai)

### A1 — Onboarding curto: `identidade → dashboard`

**Decisão do fundador (12/07):** o teatro (aha/demo/DEX/plano) sai **temporariamente** (vai ser reescrito na Fase 3). O catálogo **não** precisa do passo de procedimentos — o cadastro na hora do orçamento (fluxo #7, já implementado e testado) cobre isso.

**Estado atual** — `src/app/onboarding/_components/onboarding-client.tsx`:
- `onSubmitIdentidade` (`:141`) chama `iniciarOnboarding(...)` e no sucesso faz `setStep('aha')` (`:164`).
- Máquina de passos: `identidade → aha → plano → procedimentos → sucesso`.

**Mudança:**
- Em `onSubmitIdentidade`, no ramo `result.success` (`:162-164`): trocar `setStep('aha')` por → `await marcarOnboardingCompleto()` seguido de `router.replace('/dashboard')`. Manter o ramo `alreadyOnboarded` (`:158`) como está (já vai pro dashboard — agora é o comportamento canônico, não o bug B1).
- **Manter** a captura da persona (`foco`) no passo identidade — alimenta a recompensa pós-ficha (que funciona). Sem mexer no form.
- **Não** deletar os passos `aha`/`plano`/`procedimentos`/`sucesso` do componente nem as actions `definirPlano`/`definirProcedimentosPendente` — ficam no código, órfãos temporários (comentário `// FASE 3: reescrever o teatro do onboarding — ver roadmap-3-fases R3`). Plano fica `SOLO` (default da RPC); catálogo nasce vazio e enche no orçamento.

**Guard** — `src/app/onboarding/layout.tsx`: já redireciona quando `onboarding_completo === true`. Como agora marcamos completo logo após identidade, o guard passa a valer normalmente. **Sem mudança** (confirmar ao testar).

### A2 — DexGuide desligado + card "Primeiros passos" oculto

- `src/components/layout/dashboard-shell.tsx:138` — `{role !== 'secretaria' && <DexGuide .../>}`: **não montar** o `DexGuide` (comentar a linha com `// FASE 1: guia desativado — ver roadmap-3-fases A2`). Não deletar o componente (será reescrito).
- `src/app/dashboard/page.tsx:200` — `<PrimeirosPassosCard .../>`: **não renderizar** (mesmo comentário). É scaffolding de onboarding e seu CTA principal aponta pra demo (que está fora). Reversível.
- **Não** tocar em `/consulta/demo` (rota fica acessível; só ninguém linka mais pra ela). Não tocar no `useDexGuide` (hook fica).

**Invariante A:** nenhum arquivo deletado; tudo por curto-circuito comentado e reversível numa linha.

---

## 3. Bloco B — Fixes de funcionalidade

### B4 — "Agendar retorno" na visão expandida (D12) da ficha
**Arquivo:** `src/components/pacientes/FichasTab.tsx`.
Hoje o botão só existe na visão colapsada (`:1163-1171`). A visão expandida D12 renderiza o retorno como **texto puro** (`:1234-1239`: `<span>...Retorno: {evo.retornoSugerido}</span>`).
**Mudança:** ao lado do texto de retorno na D12, renderizar o mesmo botão `Agendar retorno` (mesmo `onAgendarRetorno(evo.id, evo.retornoSugerido)`, mesma condição `onAgendarRetorno && evo.retornoSugerido`, mesmo estilo do `:1164-1170`). Sem novo handler — reusa o que já existe e já funciona no pai.

### B5 — Conflito de agenda ignora atendimento em curso
**Arquivo:** `src/app/dashboard/agendamentos/actions.ts`.
`criarAgendamento` (`:62`) filtra conflitos só com `scheduled|confirmed|completed` — **falta** `checked_in` e `in_progress`. Dá pra marcar em cima de consulta acontecendo agora. O `criarEncaixe` (`:506`) já inclui os dois — alinhar.
**Mudança:**
- `:62` — trocar `.or('status.eq.scheduled,status.eq.confirmed,status.eq.completed')` por `.in('status', ['scheduled','confirmed','checked_in','in_progress','completed'])`.
- `criarEncaixe` (`:477`) — adicionar a mesma validação de paciente-da-clínica que o `criarAgendamento` tem (`:36,40`): confirmar que `pacienteId` pertence ao `clinicId` antes do insert (`:524`). Risco real baixo (UUID+RLS), mas fecha a inconsistência entre as irmãs.
**Dívida anotada (NÃO nesta spec):** a janela de dia usa UTC (`${dateOnly}T00:00:00.000Z`), então consultas 21h+ BRT caem no dia UTC seguinte e escapam da checagem. Correção maior (timezone) — registrar como dívida no handoff, não corrigir agora.

### B7 — Guard de papel na rota do Modo Consulta
**Arquivo:** `src/app/consulta/[agendamentoId]/page.tsx`.
Hoje qualquer papel renderiza a tela; a secretária consegue rodar o pipeline de IA (custa token) e só é barrada no salvar. Viola "secretária não atende".
**Mudança:** após `requireClinicContext()` (`:12`) e `getDentistaCached()` (`:13`), se `dentista?.role === 'secretaria'` → `redirect('/dashboard')`. 3 linhas, antes de qualquer fetch pesado.

### B8 — Auto-redirect pós-ficha mata os CTAs
**Arquivo:** `src/app/consulta/[agendamentoId]/_components/consulta-client.tsx`.
A tela "Ficha salva!" mostra recompensa + 3 CTAs (Gerar plano / Assinatura / Emitir documento) mas dispara `router.push` pro perfil em 5s (`saveCountdown`, `:145`; efeito de navegação `:378-382`). O countdown compete com o momento de alta intenção.
**Decisão (fundador 12/07):** **remover o auto-redirect** — o dentista clica o que quer.
**Mudança:**
- Remover o efeito de countdown que decrementa `saveCountdown` e o efeito `:378-382` que navega quando chega a 0.
- Trocar a linha de status (`:735`) `Redirecionando em {saveCountdown}s` por um CTA/link explícito **"Voltar ao perfil do paciente"** (mesmo destino `/dashboard/pacientes/${paciente.id}`).
- Manter `showSignature` e os 3 CTAs intactos. `saveCountdown`/`countdownRef` podem ser removidos se ficarem órfãos (confirmar no `tsc`).

### B11 — Copy / consistência (trivial)
- `src/app/dashboard/configuracoes/usuarios/_components/usuarios-client.tsx` — "Limite de 1 dentista**s**": pluralização condicional (`dentista${n > 1 ? 's' : ''}`).
- Modal de agendamento (detalhe) — botão "Iniciar consulta" quando o status já é `in_progress` deveria ser **"Continuar atendimento"**. Localizar no componente do modal de detalhe do agendamento (`agendamentos-client.tsx`) e rotular por status.
- `src/app/dashboard/orcamentos/page.tsx:30` — tipo `OrcamentoRow.status` ainda lista `'pago'` (órfão, o resto do código já removeu). Tirar `| 'pago'`.

---

## 4. Bloco F — Higiene que protege o teste

### F1 — CI mínimo (GitHub Actions)
**Confirmado:** remote `origin` = `github.com/MateusTeixeira9203/Odonto.IA.git`; scripts `lint`, `typecheck`, `build` existem.
**Novo arquivo:** `.github/workflows/ci.yml` — em `push` e `pull_request`: `npm ci` → `npm run typecheck` → `npm run lint` → `npm run build`. Node 20. Fecha o buraco do `ignoreBuildErrors: true` (que faz o `next build` pular tsc). **Gate:** o job falha se qualquer passo falhar.
> Nota: `npm run lint` hoje tem 33 errors pré-existentes (ver diagnóstico §1.4). Pra o CI não nascer vermelho: rodar o `eslint --fix` no que for auto-corrigível e, no que sobrar, ou corrigir ou marcar o step `lint` como `continue-on-error: true` **temporariamente** com TODO (typecheck+build são o gate duro). Decisão de execução — preferir corrigir os baratos.

### F2 — `npm audit fix`
Rodar `npm audit fix` (sem `--force`). Fecha o `@xmldom/xmldom` HIGH. Depois: `npm run typecheck` + `npm run build` pra confirmar que nada quebrou. **Não** bump de `next` (Fase 3, precisa de CI verde antes).

### F3 — Proteção de senha vazada (AÇÃO MANUAL — não é código)
Mateus: Supabase Dashboard → Authentication → Password Security → ligar HaveIBeenPwned. Registrado aqui pra fechar o item; **não** bloqueia a execução do resto.

---

## 5. Invariantes
1. Onboarding: toda conta nova sai de `identidade` direto pro dashboard com `onboarding_completo = true` e plano `SOLO`.
2. Nenhum componente do teatro (DexGuide, passos aha/plano/procedimentos, PrimeirosPassosCard) é **deletado** — só não montado. Reverter é descomentar.
3. Secretária nunca renderiza `/consulta/[id]`.
4. Marcar consulta em cima de `checked_in`/`in_progress` passa a acusar conflito.
5. Regras de permissão e fluxo de dinheiro **inalterados** (nenhuma action de orçamento/pagamento tocada aqui).
6. `tsc` + `eslint` (ao menos typecheck) + `build` limpos; CI verde.

---

## 6. Gates de aceite
- [ ] Criar conta nova → cai no dashboard direto, sem aha/demo/plano; catálogo vazio; `onboarding_completo=true` no banco.
- [ ] Dashboard do dentista sem card "Primeiros passos" e sem balão do DEX.
- [ ] Ficha expandida (D12) com `retorno_sugerido` mostra "Agendar retorno" e ele abre a Nova Consulta pré-preenchida.
- [ ] Tentar agendar em cima de uma consulta `in_progress` → erro de conflito.
- [ ] Logar como secretária → `/consulta/<id>` redireciona pro dashboard.
- [ ] "Ficha salva!" não redireciona sozinho; os 3 CTAs + "Voltar ao perfil" funcionam.
- [ ] Copy: "Limite de 1 dentista" (singular), "Continuar atendimento" quando `in_progress`.
- [ ] CI roda em push e falha se typecheck/build quebrar; `npm audit` sem o xmldom HIGH.

---

## 7. Ordem sugerida
A2 (2 linhas, aquece) → B11 (copy) → B7 (guard) → B4 (retorno) → B5 (conflito) → B8 (redirect) → A1 (onboarding) → F2 (audit) → F1 (CI, por último pra o pipeline já pegar tudo). Dogfood do loop + `design-review` do que mudou visualmente (card de ficha D12) antes de fechar.
