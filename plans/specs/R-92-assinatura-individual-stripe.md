# R-92 — Assinatura individual Stripe

> **SPEC** · **R-92** · 🟡 fluxo no ar; ciclo real controlado pendente
> **Aberto:** 2026-08-18 · **Replanejado:** 2026-08-20 · **Revisado:** 2026-09-03

## Emenda QA — 2026-10-11

O usuário autorizou liberar a clínica sintética QA B para testar com billing ativo.
`STRIPE_BILLING_QA_EXEMPT_CLINIC_ID` adiciona uma única clínica QA à isenção, sem
substituir `STRIPE_BILLING_EXEMPT_CLINIC_IDS`, cujo valor publicado é protegido como
segredo. Não criar assinatura fictícia, não desligar billing globalmente e não incluir
ID de clínica real nessa variável. Critérios: a clínica QA entra sem Checkout; as
isenções anteriores continuam; uma clínica sem isenção segue bloqueada sem assinatura.
Primeiro validar localmente com billing ligado; a versão publicada exige publicação
separada e verificação após o deploy. Nenhum dado/schema de produção muda neste item.

## Emenda de ativação — 2026-09-03

### Decisão de lançamento

- Duas contas já existentes, fornecidas pelo responsável, serão os primeiros pagamentos reais.
  Elas usam **Consultório** e escolhem mensal (R$ 200) ou anual (R$ 2.000) no Checkout.
- Essas duas contas não recebem outro trial: a assinatura deve cobrar no Checkout. Identidade
  pessoal não entra em código, commit ou migration; a exceção é uma configuração server-side
  por `usuario_id` + `clinica_id` e fica auditável no banco.
- Todo cadastro novo mantém cartão obrigatório e **7 dias gratuitos**. Não existe flag global
  temporária para desligar trial: isso poderia cobrar um novo usuário por engano.
- O plano escolhido no onboarding é persistido na clínica antes de abrir Checkout; o servidor
  continua sendo a única fonte de Price ID, valor, ciclo e oferta.
- Retorno de Checkout espera o webhook; quem já concluiu onboarding segue ao dashboard, e quem
  ainda não concluiu segue ao onboarding. A URL de retorno jamais comprova pagamento.

### Contrato adicional

```ts
type PoliticaTrialAssinatura = {
  clinica_id: string
  usuario_id: string
  dias_trial: 0 | 7
  motivo: string
  criado_em: string
}
```

- Ausência de política significa `TRIAL_DAYS` (7). `dias_trial: 0` faz o servidor **omitir**
  `subscription_data.trial_period_days`; a Stripe cobra a primeira fatura no Checkout. O valor
  `0` não é enviado à Stripe porque o parâmetro aceita no mínimo 1 dia.
- A tabela é RLS-enabled e não recebe policy de cliente. Somente service role lê a regra na criação
  de Checkout; nenhuma Server Action aceita dias de trial do browser.
- Antes da ativação em Production são obrigatórios: Price IDs live validados, signing secret do
  webhook em Production, `STRIPE_BILLING_ENABLED=true` somente após deploy, e Portal Stripe
  padrão com atualização de cartão, faturas e cancelamento ao fim do período. Troca de preço fica
  desabilitada neste lançamento.

### Gates adicionais

- [ ] As duas exceções geram Checkout sem trial e sem expor a identidade no repositório.
- [ ] Cadastro novo gera Checkout com 7 dias, cartão obrigatório e mesmo catálogo de preços.
- [ ] Conta legada com `clinicas.status_assinatura='trial'` e sem assinatura Stripe pode escolher
  um plano; o status legado não desabilita indevidamente o CTA.
- [ ] Webhook em Production sincroniza um pagamento real uma vez; retorno espera essa confirmação.
- [ ] Após o primeiro pagamento, usuário já onboarded cai no dashboard sem loop.

## 1. Problema

O corte local atual cria a assinatura Stripe assim que um dentista aceita um convite. Isso
contradiz o produto aprovado: Clínica só existe com 2–8 dentistas reais, ninguém deve pagar ou
perder dias de teste enquanto a equipe ainda está sendo formada e cada dentista paga a própria
assinatura. O modelo antigo também tem um único Price ID e não separa Consultório/Clínica nem
mensal/anual.

## 2. Decisões aprovadas

- **Consultório:** uma assinatura individual.
- **Clínica:** 2–8 dentistas com assinatura individual; convite sem aceite e cadastro sem cartão
  não contam.
- Formação da clínica dura **48 horas**. Antes do mínimo, não existe assinatura, cobrança nem
  início do teste.
- Cada dentista escolhe mensal ou anual e administra somente a própria cobrança.
- Trial de **7 dias**, cartão obrigatório e graça de **3 dias** após falha de renovação.
- Fundador: Consultório e Clínica custam R$200/mês ou R$2.000/ano por dentista. Os contratos
  Stripe são separados mesmo quando o valor coincide.
- Preço público futuro nasce em novos Price IDs; nunca se edita o Price fundador existente.
- ClinDent e VIP Odontologia permanecem gratuitas, fechadas e fora do gate.
- A isenção usa allowlist explícita de UUIDs em `STRIPE_BILLING_EXEMPT_CLINIC_IDS`; ausência de
  assinatura nunca isenta implicitamente uma clínica, e a allowlist também recusa Checkout.
- Clínica de teste só entra na mesma isenção quando estiver explicitamente na allowlist. Convite
  de dentista em clínica isenta cria vínculo **ativo** e segue para o onboarding, sem tela de
  ciclo, cartão, Checkout ou webhook Stripe. Vínculo isento legado que tenha ficado `pendente`
  é reparado de forma idempotente na rota de boas-vindas antes do redirecionamento.
- Sair da clínica é voluntário. Suspensão financeira bloqueia acesso, nunca apaga dados.

## 3. Arquitetura escolhida

### 3.1 Catálogo de preço no servidor

```ts
type PlanoAssinatura = 'CONSULTORIO' | 'CLINICA'
type CicloCobranca = 'mensal' | 'anual'
type OfertaPreco = 'fundador' | 'publico'

type ChavePreco = `${PlanoAssinatura}:${CicloCobranca}:${OfertaPreco}`
```

Um módulo server-only resolve `ChavePreco -> Stripe Price ID`. O browser envia apenas
`plano` e `ciclo`; aceitar `priceId`, valor ou oferta enviados pelo cliente é proibido.
Antes de abrir Checkout ou criar subscription, o servidor consulta o Price real e confere produto
ativo, BRL, valor e periodicidade. Divergência de ambiente bloqueia a cobrança.

Variáveis do primeiro lançamento:

```text
STRIPE_PRICE_FUNDADOR_CONSULTORIO_MENSAL
STRIPE_PRICE_FUNDADOR_CONSULTORIO_ANUAL
STRIPE_PRICE_FUNDADOR_CLINICA_MENSAL
STRIPE_PRICE_FUNDADOR_CLINICA_ANUAL
```

`STRIPE_BILLING_ENABLED=false` continua sendo o padrão até os testes em modo teste e a ativação
explícita. A variável antiga `STRIPE_PRICE_FUNDADOR` deixa de governar novos checkouts.

### 3.2 Estados persistidos

```ts
type StatusFormacaoClinica =
  | 'aguardando_equipe' | 'coletando_pagamento' | 'ativando'
  | 'ativa' | 'expirada' | 'cancelada'

type StatusElegibilidadeClinica =
  | 'regular' | 'recompondo_equipe' | 'decisao_pendente' | 'bloqueada'

type StatusAssinaturaDentista =
  | 'aguardando_formacao' | 'cartao_pronto' | 'trialing' | 'active'
  | 'past_due' | 'suspended' | 'canceled' | 'unpaid'

type FormacaoClinica = {
  id: string
  clinica_id: string
  criado_por_usuario_id: string
  status: StatusFormacaoClinica
  expires_at: string
  activated_at: string | null
}

type AssinaturaDentista = {
  id: string
  clinica_id: string
  usuario_id: string
  dentista_id: string
  formacao_id: string | null
  plano: PlanoAssinatura
  ciclo: CicloCobranca
  oferta: OfertaPreco
  stripe_customer_id: string | null
  stripe_setup_session_id: string | null
  stripe_payment_method_id: string | null
  stripe_subscription_id: string | null
  stripe_price_id: string
  status: StatusAssinaturaDentista
  trial_ends_at: string | null
  grace_ends_at: string | null
  current_period_ends_at: string | null
}
```

Migration forward-only:

1. cria `formacoes_clinica` com uma formação aberta por clínica;
2. amplia `assinaturas_dentista` com plano, ciclo, oferta, formação e dados de Setup;
3. mantém RLS sem policy client-side: leitura/escrita somente em services autenticados;
4. amplia `billing_events` para Stripe e `clinica_usuarios.status` para `suspenso`;
5. não cria linhas nem altera membros antigos.

A migration local `20260819020033_r92_assinatura_individual_stripe.sql` é um rascunho ainda não
publicado. Na execução, ela deve ser substituída pelo contrato acima antes de qualquer deploy;
não se empilha uma migration corretiva sobre schema que ainda não foi ao ar.

## 4. Fluxos

### 4.1 Consultório

1. Dentista escolhe Consultório e mensal/anual.
2. Checkout Stripe em `mode='subscription'`, cartão obrigatório e trial de 7 dias.
3. Apenas webhook autenticado em `trialing/active` libera o acesso.

### 4.2 Formação da Clínica

1. Criador escolhe Clínica, informa a clínica e envia ao menos um convite. O servidor cria a
   formação com `expires_at = now + 48h`; ainda não cria subscription.
2. Cada participante aceito escolhe mensal/anual e conclui Checkout em `mode='setup'`. O Stripe
   salva o meio de pagamento para uso futuro, sem cobrar e sem iniciar trial.
3. Quando 2–8 dentistas aceitos têm `cartao_pronto`, uma comparação atômica move a formação para
   `ativando`. Uma operação retomável cria as subscriptions com o mesmo `trial_end = now + 7 dias`,
   usando uma chave de idempotência Stripe por assinatura. Repetir o webhook ou cair no meio não
   duplica cobrança: a próxima tentativa continua apenas o que faltou.
4. A clínica só vira ativa quando os webhooks confirmam ao menos duas subscriptions
   `trialing/active`. Até lá, ninguém ganha acesso clínico pela URL de retorno.
5. Convites válidos + participantes aceitos nunca ultrapassam oito vagas.
6. Se 48h vencer antes de dois cartões prontos, a formação expira sem subscription. Os métodos
   salvos não são cobrados; o usuário pode reiniciar a formação ou seguir como Consultório.

O uso de Checkout `setup` segue o fluxo oficial para salvar pagamento futuro; o consentimento
para cobrança recorrente, preço, ciclo, trial e cancelamento deve aparecer antes do redirecionamento.

### 4.3 Entrada posterior em Clínica ativa

Depois que a clínica já está ativa, um novo dentista aceito conclui a própria assinatura
mensal/anual diretamente. O vínculo só ativa por webhook `trialing/active`; seu trial individual
começa nesse momento. O servidor mantém o teto de oito contando membros ativos e convites válidos.

### 4.4 Renovação e falha

| Evento Stripe | Resultado interno |
|---|---|
| `checkout.session.completed` de setup | salva Customer/PaymentMethod; nunca libera acesso |
| `customer.subscription.created/updated` trialing/active | sincroniza assinatura; ativa vínculo quando a formação alcança o mínimo |
| `invoice.paid` | limpa graça e garante o acesso daquele dentista |
| `invoice.payment_failed` | `past_due`, graça de 3 dias e aviso por e-mail/in-app |
| graça vencida, `unpaid` ou cancelamento | suspende somente aquele vínculo, sem apagar dados |

Webhook valida assinatura, registra `event.id` em `billing_events` como `pending` e só muda para
`processed` depois do efeito completo. Eventos em `error` são retomáveis; duplicata já processada
é ignorada. O modo test/live deve coincidir com a chave, o estado atual é reconciliado antes de
eventos fora de ordem e novas tentativas não ampliam a primeira graça de 3 dias. Portal Stripe
permite que cada dentista altere cartão, consulte fatura e cancele apenas a própria assinatura.

### 4.5 Clínica abaixo do mínimo depois de ativa

Se uma Clínica ativa cair para um dentista, começa uma janela de **48 horas** para recompor a
equipe. Durante a janela, o membro restante mantém acesso e plano, recebe o prazo real e pode
convidar outro dentista.

Se o prazo vencer sem recomposição, nenhuma migração acontece automaticamente. A tela bloqueante
oferece exatamente duas escolhas:

1. **Migrar para Consultório:** mantém mensal/anual e a oferta do usuário, troca para o Price de
   Consultório correspondente na próxima renovação, sem prorrateio nem cobrança imediata. O acesso
   operacional volta após a confirmação server-side da alteração.
2. **Continuar como Clínica:** fica bloqueada até alcançar novamente dois dentistas pagos. Durante
   o bloqueio, só permanecem acessíveis Configurações → Clínica, Plano, suporte e leitura/exportação
   dos prontuários; criação/edição clínica, agenda, orçamento e financeiro ficam indisponíveis.

Enquanto a opção Clínica estiver bloqueada, a cobrança recorrente do membro restante é pausada sem
acumular débito (`pause_collection.behavior='void'`). Ao atingir novamente dois pagantes, o servidor
remove a pausa para cobranças futuras e libera a operação por webhook, sem cobrar retroativamente o
período bloqueado. Faturas anteriores à pausa são tratadas separadamente e nunca apagadas por esse
fluxo.

## 5. Interfaces e regras de acesso

- A formação e seus estados aparecem em Configurações → Clínica (R-97).
- “Minha assinatura” permanece individual em Configurações → Plano.
- Secretária e protético não escolhem plano nem contam no mínimo/máximo.
- Agenda, orçamento e financeiro permanecem em silos individuais; pacientes e ficha seguem as
  regras colaborativas existentes.
- O guard do dashboard e a RLS exigem membership/perfil ativo; retorno do Checkout não basta.
- O bloqueio por equipe insuficiente preserva leitura/exportação; não pode sequestrar o prontuário.
- A rota `/dashboard/arquivo-clinico` expõe somente a lista e o PDF completo dos prontuários
  durante o bloqueio; nenhuma action clínica fica disponível ali.

## 6. Invariantes

- Nenhum pagamento ou trial começa antes de dois participantes com cartão pronto na formação.
- O efeito financeiro de um evento Stripe acontece no máximo uma vez e uma tentativa interrompida
  pode ser retomada com segurança.
- Um dentista nunca consulta ou gerencia a assinatura de outro.
- Price ID e valor nunca vêm do browser.
- Clínica não ativa com convite pendente, conta fantasma ou cartão ausente.
- Bloqueio financeiro revoga acesso, nunca prontuário, autoria ou documento.
- ClinDent/VIP não recebem backfill, Checkout ou gate.
- Nenhuma clínica presente na allowlist de isenção mostra preço, plano ou CTA de cartão para
  dentista convidado; ela também não pode ficar com membership pendente por causa do billing.
- Plano abaixo do mínimo nunca migra sozinho e não cobra enquanto permanecer bloqueado.

## 7. Gates de aceite

- [ ] Consultório mensal e anual usam os Price IDs corretos e trial de 7 dias.
- [ ] Formação com um dentista permanece sem subscription e sem trial.
- [ ] Aceite sem cartão não conta; cartão salvo por Setup não gera cobrança.
- [ ] Segundo cartão pronto cria as duas subscriptions com o mesmo `trial_end`.
- [ ] Retorno falso sem webhook não ativa ninguém.
- [ ] Price ID com valor, moeda, periodicidade ou modo Stripe incorreto recusa o Checkout.
- [ ] Evento antigo `invoice.payment_failed` não sobrescreve fatura paga nem amplia a graça.
- [ ] Formação expirada não cria assinatura e pode ser reiniciada.
- [ ] Nono participante é recusado contando ativos, aceitos e convites válidos.
- [ ] Abaixo de dois membros inicia 48h; recomposição dentro do prazo não altera preço.
- [ ] Prazo vencido exige escolha entre Consultório e Clínica bloqueada, sem default automático.
- [ ] Migrar preserva ciclo/oferta e troca Price somente na próxima renovação, sem prorrateio.
- [ ] Clínica bloqueada não cobra, não acumula dívida e mantém leitura/exportação dos prontuários.
- [ ] Segundo pagante remove a pausa e libera apenas após webhook válido.
- [ ] Falha abre graça de 3 dias; pagamento reativa sem tocar dados clínicos.
- [ ] Duas contas logadas não acessam assinatura uma da outra.
- [ ] ClinDent/VIP continuam entrando sem Stripe.
- [ ] Dentista convidado em clínica explicitamente isenta aceita o convite, recebe membership e
  perfil ativos e entra no onboarding sem visualizar `/bem-vindo-agregado` ou Stripe.

## 8. Fora de escopo

- ativar a flag em produção antes dos gates Stripe/teste e da confirmação explícita;
- preços públicos definitivos, cupom, indicação e cobrança de pacientes;
- WhatsApp e gestor burocrático da clínica;
- migrar automaticamente clínicas legadas.
