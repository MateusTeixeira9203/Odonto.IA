# Spec — Workstream A: Onboarding novo (persona → aha → plano) + fiação E

> Filha de `plans/roadmap/plano-fase1-retencao.md` §A e §E. Contrato técnico do rebuild.
> Status: **rascunho para aprovação** (2026-06-28). Não codar antes do "ok".

## 1. Objetivo
Trocar a máquina de passos do onboarding (`plano → form → procedimentos → sucesso`)
pela ordem que entrega valor antes da decisão comercial:
`identidade+persona → aha (demo) → plano → procedimentos → sucesso`, e fiar a camada
de persona (`foco_principal`) já existente (`src/lib/persona.ts`).

## 2. Contratos

### 2.1 Máquina de passos — `onboarding-client.tsx`
```ts
type OnboardingStep = 'identidade' | 'aha' | 'plano' | 'procedimentos' | 'sucesso';
```
- **initial** vem de `page.tsx` (`initialStep`): `'plano'` se `?step=plano` (retorno da demo), senão `'identidade'`.
- `identidade`: form enxugado (nome, cro, especialidade, nomeConsultorio) **+ 2 cards de persona**
  (`economizar_tempo` | `crescer`, textos de `PERSONAS`). Submit válido → `iniciarOnboarding()` → `'aha'`.
- `aha`: reusa `DexGuide` (intro do DEX) + CTA → navega para `/consulta/demo?from=onboarding`.
- `plano`: cards SOLO/CLINICA → `definirPlano()` → `'procedimentos'`.
- `procedimentos`: passo atual intacto; nas 3 saídas chama `marcarOnboardingCompleto()` antes de `'sucesso'`.
- `sucesso`: copy por persona via `getPersona(foco).sucesso` (foco vem de `page.tsx` → prop `focoInicial`).

### 2.2 Actions — `onboarding/actions.ts`
```ts
// cria clínica+dentista cedo (pra demo rodar), grava persona, dispara D0
iniciarOnboarding(input: {
  nome: string; cro: string;
  especialidade: Especialidade; nomeConsultorio: string;
  foco: FocoPrincipal;            // 'economizar_tempo' | 'crescer'
}): Promise<{ success: boolean; alreadyOnboarded?: boolean; error?: string }>;

// atualiza só o plano escolhido no passo 'plano'
definirPlano(plano: PlanoClinica): Promise<{ error?: string }>;

// seta clinicas.onboarding_completo = true (fim do passo procedimentos)
marcarOnboardingCompleto(): Promise<{ error?: string }>;

definirProcedimentosPendente(pendente: boolean): Promise<{ error?: string }>; // mantido
```
- `iniciarOnboarding` chama a RPC `complete_onboarding` com **`p_plano: 'SOLO'` (provisório)**, reaproveitando
  toda a transação atômica + guard `ALREADY_ONBOARDED` (→ `{ alreadyOnboarded: true }`, client manda pro /dashboard).
- `enviarEmailD0` **migra** de `completeOnboarding` pro fim de `iniciarOnboarding`.
- `completeOnboarding` antiga é **removida** (substituída por iniciar + definirPlano + marcar).

### 2.3 `page.tsx`
- Lê `searchParams.step`; resolve `initialStep` (`'plano'` | `'identidade'`).
- Após `iniciarOnboarding`, carrega `foco_principal` do dentista e passa `focoInicial` (pra copy do sucesso).
- **Para de exigir/propagar `?plano`** (plano agora é escolhido no fluxo).

### 2.4 Guard — `onboarding/layout.tsx`
- Hoje: `dentista existe → redirect /dashboard`. **Errado no fluxo novo** (dentista é criado no meio).
- Novo: resolve `active_clinica_id` → `clinicas.onboarding_completo`. Redireciona **só se `=== true`**.

### 2.5 Fiação E — `lib/get-dentista.ts`
- Adicionar `foco_principal` ao `select` de `dentistas`, ao `DentistaCache` (`foco_principal: FocoPrincipal | null`) e ao retorno.

### 2.6 Round-trip da demo — `consulta/demo/page.tsx` + `consulta-client.tsx`
- `demo/page.tsx`: lê `?from=onboarding` → passa `retornoOnboarding: boolean` ao `ConsultaClient`.
- `consulta-client.tsx`: quando `isDemo && retornoOnboarding && saved`, exibe CTA "Continuar configuração" →
  `router.push('/onboarding?step=plano')`. (Hoje não existe retorno; é adição nova.)

### 2.7 Bugs reportados
- **#1** Cadastro mostra plano antes de escolher: `cadastro-form.tsx`/`cadastro/page.tsx` param de revisão — remover
  exibição/propagação de plano; pós-signup redireciona pra `/onboarding` (sem `?plano`).
- **#2** Badge "POPULAR" atrás do ✓: no card de plano, separar posições (badge `top-left` / ✓ `top-right`, ou ✓ desloca o badge).

## 3. Decisão aberta (precisa do seu ok)
**Como gravar `foco_principal`:**
- **(A) Recomendado** — adicionar `p_foco_principal text DEFAULT NULL` à RPC `complete_onboarding` e setar no INSERT do dentista.
  Atômico, ignora RLS (SECURITY DEFINER). Custo: migração **081** que faz `DROP` + `CREATE` da função (mudar assinatura cria overload; precisa dropar a antiga e reajustar GRANT).
- **(B) Mais leve** — `UPDATE dentistas SET foco_principal` após a RPC, usando o `dentista_id` retornado.
  Sem migração, mas **depende de policy RLS de UPDATE do próprio dentista** (a verificar; se não existir, cai no A).

## 4. Invariantes
- `iniciarOnboarding` idempotente (guard `ALREADY_ONBOARDED` da RPC).
- `onboarding_completo` só vira `true` no fim de `procedimentos`.
- `foco_principal ∈ {economizar_tempo, crescer}` (CHECK da 079).
- Toda query de clínica escopada por `active_clinica_id` (multi-tenant).
- Demo (`/consulta/demo`) acessível no meio do onboarding (dentista já existe pós-`iniciarOnboarding`).

## 5. Arquivos tocados
`onboarding-client.tsx`, `onboarding/actions.ts`, `onboarding/page.tsx`, `onboarding/layout.tsx`,
`lib/get-dentista.ts`, `consulta/demo/page.tsx`, `consulta-client.tsx`, `cadastro-form.tsx` (+`cadastro/page.tsx`),
e (se decisão A) migração `081`.

## 6. Verificação (do plano §181)
E2E nas 2 personas (ordem + copy por persona), round-trip da demo, guard via `onboarding_completo`,
bugs #1/#2 corrigidos, `npm run typecheck` + `lint` limpos. F (identidade/roteiro do DEX) e B (recompensa) ficam pros próximos workstreams.
