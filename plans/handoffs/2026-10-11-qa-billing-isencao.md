# HANDOFF — isenção de billing para clínica QA B

STATUS: ACTIVE
OWNER: Coordenação do Odonto.IA
LAST_REVIEWED: 2026-10-11
CANONICAL_FOR: aplicação isolada da isenção QA de R-92

## 1. Identificação

- Tarefa: R-92, emenda QA de 11/10/2026.
- Área: acesso comercial de contas sintéticas.
- Responsável anterior: Coordenação; próximo responsável: usuário/aplicador.
- Estado: `READY_FOR_REVIEW` local; não publicado.
- Branch/base: `codex/baseline-producao-v2`, base `ba5b531164c2983b991de27a96f94668fbb7ebda`.

## 2. Objetivo e contexto

Liberar apenas a clínica `QA Odonto Clínica B 2026-10-01`
(`53eefdac-401b-484c-8ad4-a6cdd78b1a69`) para o teste autenticado no site
com Stripe billing ativo. A allowlist de isenções existentes na Vercel é segredo não
legível; substituí-la perderia isenções atuais. O código local adiciona uma variável
independente, sem alterar o valor da variável antiga.

## 3. Fonte, decisão e limite

- Spec: [R-92](../specs/R-92-assinatura-individual-stripe.md), emenda QA.
- Código: `src/lib/billing/exemptions.ts` e exemplo `.env.example`.
- Fora de escopo: desligar Stripe globalmente, criar assinatura fictícia, tocar em
  schema ou dados reais, aplicar R-184/R-189/R-194.
- Não publicar o checkout misto atual: há outras mudanças locais e migrations não
  aprovadas. Levar apenas o ajuste de isenção a um checkout limpo da baseline.

## 4. Aceite e evidência

- **PASSA local:** typecheck e ESLint do arquivo alterado, `git diff --check`.
- **PASSA local:** com `STRIPE_BILLING_ENABLED=true` e
  `STRIPE_BILLING_QA_EXEMPT_CLINIC_ID=53eefdac-401b-484c-8ad4-a6cdd78b1a69`,
  login do dentista QA abriu `/dashboard` e `/dashboard/meu-dia` sem Checkout.
- **PASSA estático:** a lista anterior `STRIPE_BILLING_EXEMPT_CLINIC_IDS` continua
  sendo lida no mesmo código, sem edição de seu valor.
- **PASSA configuração:** em 11/10, a nova variável apareceu na lista de Production
  da Vercel; as chaves antigas continuam cadastradas. O conector não revela o valor
  da variável, então conferir o UUID inserido no painel antes de publicar.
- **NÃO TESTADO publicado:** deploy ativo ainda é `ba5b531` sem o novo código;
  não houve commit, push ou deploy deste ajuste.
- **NÃO TESTADO:** clínica sintética distinta sem isenção no novo build; conferir
  antes de declarar regressão de billing fechada.

## 5. Aplicação pelo usuário

Observação da tela enviada às 21:14 de 11/10: o editor aberto era da chave global
`STRIPE_BILLING_ENABLED`; a lista mostrava `true`, enquanto o campo de edição
continha `false`. A imagem não comprova que `false` foi salvo. Não salvar esse valor;
manter a chave global em `true` e usar **Create New** para a chave QA separada.

1. Revisar o [patch isolado](2026-10-11-qa-billing-isencao.patch), que contém
   somente `src/lib/billing/exemptions.ts` e `.env.example`. Ele é aplicável à
   baseline `ba5b531` e passou em `git apply --check --reverse` no checkout editado.
2. Publicar **somente esses dois arquivos** a partir da baseline de produção, em
   commit isolado. Não incluir o restante do checkout nem migrations financeiras.
3. Na Vercel do projeto `odonto.ia`, confirmar que a nova variável server-side de
   Production `STRIPE_BILLING_QA_EXEMPT_CLINIC_ID` tem o valor
   `53eefdac-401b-484c-8ad4-a6cdd78b1a69`. Não editar
   `STRIPE_BILLING_EXEMPT_CLINIC_IDS` nem `STRIPE_BILLING_ENABLED`.
4. Fazer um novo deploy da versão com esse ajuste. A variável não muda o deployment
   já existente. Conferir SHA/READY e login da conta dentista QA no site publicado.
5. Verificar que a clínica QA entra sem Checkout e uma clínica sintética sem isenção
   continua no gate; não usar contas reais para o teste negativo.

## 6. Reversão

Remover a variável QA no ambiente e publicar novamente a versão, ou reverter apenas
o commit isolado. As isenções permanentes não devem ser modificadas. Após a auditoria,
decidir com o usuário se a isenção QA deve permanecer ativa.
