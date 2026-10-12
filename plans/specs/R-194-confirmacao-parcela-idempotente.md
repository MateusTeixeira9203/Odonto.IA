# R-194 — Pagamento rápido idempotente em uma transação

STATUS: DRAFT
OWNER: Arquitetura de Produto / Financeiro
LAST_REVIEWED: 2026-10-12
REPLACES: contrato anterior da R-194 com reconciliação e escolha de ramo na Action
CANONICAL_FOR: idempotência e decisão parcela/saldo do pagamento rápido

> **SPEC** · **R-194** · 🔵 ativo
> **Fase:** migration aplicada; integração e publicação pendentes

**Estado atual (12/10):** migration `20261012034858_r194_confirmacao_parcela_idempotente.sql`
aplicada no Supabase de produção. Gates diretos com contas sintéticas passaram para
confirmação de previsão, replay, saldo pela secretária e notificação única. No localhost,
a confirmação **explícita** de uma parcela passou com recarga e saldo zero. O atalho
`registrarPagamentoRapido` está em `/dashboard/orcamentos`, rota que redireciona para
pacientes; por isso o fluxo rápido na UI é NÃO TESTADO e não foi reativado. Código
novo não está no deploy `ba5b531`; concorrência e perda de resposta seguem NÃO TESTADO.
[Evidência consolidada](../auditorias/2026-10-12-financeiro-migrations.md).

**Gate local recortado, anterior à aplicação (12/10):** migration R-194 executou sobre R-189 em PGlite descartável.
Passaram conversão da primeira previsão sem pagar a segunda no replay, saldo por secretária
com uma notificação, negação de outra clínica, falha da notificação registrada como `falhou`
sem desfazer o pagamento e falha do log revertendo a conversão. Os cinco testes contratuais da
Action/RPC também passaram. Evidência: `scripts/test-r184-r189-r194-db.mjs` e
`src/lib/orcamentos/r194-pagamento-rapido-contract.test.ts`. Concorrência com dois clientes,
schema Supabase completo, RLS/API, transporte, UI e reload seguem **NÃO TESTADO**. A RPC não
existe no catálogo publicado em 12/10.

## 1. Problema e evidência

### Fatos verificados

- O candidato local agora faz `registrarPagamentoRapido` chamar somente
  `registrar_pagamento_rapido_idempotente`; a Action já não lê parcelas, calcula saldo nem escolhe
  entre duas RPCs.
- A RPC candidata trava o orçamento, reconcilia a chave e escolhe previsão ou saldo na mesma
  transação. Esse desenho substituiu o preflight e os dois ramos anteriores.
- Antes dessa troca, o ramo sem parcela delegava a `registrarPagamento`. Quando a secretária
  registrava saldo para outro dentista, a Action criava uma notificação `pagamento_confirmado`.
- O ramo com parcela chamava `marcarPagamentoPago` e não criava essa notificação. A R-194 deve
  preservar essa diferença, sem passar a notificar confirmações de parcela.
- A primeira revisão do candidato encontrou a perda da notificação no ramo saldo e a recriação
  indevida de `uq_pagamentos_clinica_operacao`. A correção local posterior moveu a tentativa de
  notificação para a RPC e retirou o DDL duplicado; a segunda revisão confirmou ambos
  **PASSA estaticamente**. O efeito real no banco permanece não testado.
- R-189 e R-194 não foram aplicadas em produção. Não há banco isolado apto para os gates de escrita,
  perda de resposta ou concorrência.

### Classificação

- **PASSA estático no candidato:** há um único endpoint para o atalho; replay e escolha do ramo
  ocorrem depois do lock do orçamento.
- **PASSA estático após correção:** o ramo saldo da secretária tenta `pagamento_confirmado` uma
  vez; replay e parcela não tentam. A R-194 depende do índice R-189 sem recriá-lo.
- **NÃO TESTADO:** primeiro vencedor, persistência, notificação, log, reload, falha de transporte e
  concorrência em banco.

## 2. Problema, usuário e resultado

O pagamento rápido precisa transformar uma intenção em no máximo um efeito financeiro, mesmo quando
a resposta se perde, o estado do orçamento muda ou duas chamadas usam a mesma chave ao mesmo tempo.

Usam o fluxo somente os papéis já autorizados hoje. A R-194 não concede operação ao dono não
dentista, não muda responsável do orçamento e não amplia leitura financeira.

Resultado desejado: a primeira transação confirmada com `operacaoId` define o pagamento. Todo retry
compatível retorna o mesmo `pagamentoId`, tenha o primeiro efeito confirmado uma previsão existente
ou criado um recebimento pelo saldo. Nenhuma segunda parcela, linha manual, atividade ou notificação
é produzida pela mesma intenção; quando o ramo saldo exigir aviso, o primeiro efeito tenta emiti-lo
uma única vez.

## 3. Decisão mínima

O pagamento rápido terá **uma única RPC pública e uma única transação**. A própria RPC reconcilia a
chave, trava o orçamento, escolhe o ramo com o estado já serializado e grava o efeito.

```sql
public.registrar_pagamento_rapido_idempotente(
  p_operacao_id uuid,
  p_orcamento_id uuid,
  p_forma text,
  p_data date
) returns table (
  pagamento_id uuid,
  repetida boolean
)
```

Não entram `p_pagamento_id` nem `p_valor`. Eles são derivados dentro da transação. Isso preserva a
regra do produto de “próxima parcela; sem parcela, saldo” e impede que um snapshot externo escolha
um ramo com estado obsoleto.

A Action chama essa RPC uma vez. Ela não faz preflight, não seleciona `abertas[0]` e não delega o
ramo sem parcela à RPC R-189. A RPC R-189 continua canônica para o formulário de recebimento manual;
ela não é um segundo endpoint do pagamento rápido.

A notificação necessária também pertence à primeira execução da RPC. Criá-la na Action com base em
`repetida=false` pode perdê-la se a resposta da RPC não chegar; criá-la em todo replay pode
duplicá-la. Sem tabela ou índice novo, a fronteira segura é a mesma transação que já decide o efeito.

### Contra-argumento considerado

Reusar as duas RPCs atuais parece menor, mas exige um árbitro persistente comum antes de qualquer
efeito. Sem ele, o intervalo entre preflight e escrita permanece. Criar tabela de operações apenas
para coordená-las adicionaria schema e estados sem benefício: o wrapper transacional único resolve
o mesmo problema reutilizando `pagamentos.operacao_id` e o índice único de R-189.

## 4. Regra transacional obrigatória

Dentro da mesma chamada e transação:

1. validar entrada, `auth.uid()`, clínica ativa, vínculo, perfil, papel e autorização atual sobre
   `p_orcamento_id`; `SECURITY DEFINER` não depende de RLS;
2. travar o orçamento com `FOR UPDATE`; todas as escritas financeiras desses dois ramos mantêm a
   ordem comum **orçamento → pagamento**;
3. sob o lock, procurar `(clinica_id, operacao_id)`;
4. se existir, comparar ator, orçamento, forma e data; se coincidem, retornar o mesmo pagamento com
   `repetida=true`, sem nova escrita;
5. se a chave pertencer a outro ator, orçamento ou payload, responder
   `chave_idempotencia_reutilizada`, sem devolver IDs ou dados do vencedor;
6. sem replay, reler no banco a primeira previsão `pendente` pela ordenação vigente
   `coalesce(data_vencimento, created_at), parcela_numero` e travá-la;
7. se existir previsão, validar devido e saldo e atualizar exatamente essa linha para `pago`,
   gravando `operacao_id`, ator, forma e data;
8. se não existir previsão, recalcular devido e total pago sob o mesmo lock; saldo positivo cria
   exatamente um recebimento `pago` por esse saldo; saldo não positivo retorna
   `orcamento_quitado` sem efeito;
9. somente quando o primeiro efeito for `saldo`, o ator for `secretaria` e o destinatário for o
   dentista responsável diferente do ator, tentar inserir uma notificação `pagamento_confirmado`
   dirigida a esse dentista, com paciente, valor, forma e link já usados pelo fluxo anterior;
10. a tentativa é idempotente por pertencer apenas ao caminho novo, antes do retorno. Replay não
    insere nem tenta reparar notificação. Se o insert falhar, capturar a falha em bloco local e
    preservar o comportamento best-effort: o pagamento não é desfeito e o estado `falhou` fica no
    metadata do único `activity_log`;
11. no ramo `previsao`, para admin/dentista ou quando não houver destinatário diferente, não
    inserir notificação e registrar `nao_aplicavel` no metadata;
12. gravar exatamente um `activity_log` na mesma transação, incluindo
    `notificacao_pagamento_confirmado = emitida | falhou | nao_aplicavel`, e retornar
    `repetida=false`;
13. manter o índice único `(clinica_id, operacao_id)` da R-189 como contenção final, sem recriá-lo
    na migration R-194. Em colisão, revalidar autorização e payload do vencedor; retornar replay
    compatível ou conflito sem vazamento.

O ramo vencedor é o escolhido dentro da primeira transação confirmada. Alterar parcelas ou saldo
depois desse commit não altera o replay. A implementação pode compartilhar funções internas, mas
não pode expor novamente a escolha entre duas transações à Action.

## 5. Fluxo e estados

1. A UI cria uma vez `{ operacaoId, orcamentoId, formaPagamento, data }`.
2. A Action valida a forma do payload e chama a RPC única.
3. A RPC autoriza, serializa, reconcilia e decide o efeito.
4. Sucesso encerra a intenção.
5. Resposta perdida preserva o snapshot; `Tentar novamente` envia os mesmos quatro campos.
6. Erro definitivo encerra a submissão; nova intenção exige nova chave.

| Estado | Resultado observável | Efeito proibido |
| --- | --- | --- |
| Enviando | Snapshot bloqueado até resposta. | Gerar outra chave ou mudar o payload. |
| Sucesso novo | Um pagamento e um log; notificação tentada somente quando aplicável; `repetida=false`. | Segundo efeito financeiro ou aviso de parcela. |
| Resultado desconhecido | Snapshot preservado e retry disponível. | Escolher ramo no cliente. |
| Replay | Mesmo ID; `repetida=true`. | Recalcular ramo, gravar log ou reinserir notificação. |
| Quitado sem replay | Erro definitivo e zero escrita. | Criar recebimento de valor zero. |
| Chave conflitante | Erro definitivo e zero alteração. | Expor o pagamento vencedor. |
| Sem permissão | Erro genérico e zero leitura financeira. | Chave contornar autorização. |

Loading, vazio e dados incompletos mantêm o comportamento visual de R-189. Não há redesign.

## 6. Permissões e invariantes

1. A chave garante idempotência; nunca concede autorização.
2. Preservar exatamente os papéis e o vínculo com o orçamento consolidados pela R-188/R-189.
3. Uma chave produz no máximo um `pagamentos.pago`, um log e uma notificação funcional.
   A notificação só se aplica ao ramo saldo iniciado por secretária para outro dentista.
4. A origem pode ser previsão ou saldo, mas nunca ambas para a mesma chave.
5. O total pago nunca ultrapassa o devido no instante serializado da escrita.
6. Chaves diferentes continuam representando intenções distintas.
7. Linhas históricas com `operacao_id null` não são migradas nem deduplicadas.
8. `marcarPagamentoPago` explícito por ID, formulário manual R-189, estorno, correção, cobrança por
   etapa, gateway, fiscal e regras de aprovação permanecem fora deste recorte.
9. Dados, identidades e orçamentos de teste são sintéticos; integrações externas ficam desligadas.

## 7. Critérios de aceite

| ID | Estado inicial e ação | Resultado esperado | Efeito proibido | Verificação segura |
| --- | --- | --- | --- | --- |
| R194-01 | P1 e P2 pendentes; confirmar com `op-A`, descartar a resposta e repetir. | Mesmo ID de P1; P2 pendente; um log. | P2 paga ou segundo log. | Banco isolado, antes/depois, fault injection e reload. |
| R194-01B | Apenas P1 pendente; confirmar, perder resposta e repetir após P1 deixar de ser elegível. | Mesmo ID de P1, `repetida=true`. | “Quitado” ou recebimento pelo saldo. | Banco isolado, resposta perdida após commit. |
| R194-01C | (a) previsão vence e antes do retry não há previsão elegível; (b) saldo vence e antes do retry uma mudança controlada torna uma previsão elegível. Repetir a mesma chave. | Nos dois sentidos, mesmo ID e efeito original preservado. | Trocar de ramo ou criar segundo efeito. | Duas fixtures sintéticas, antes/depois e reload. |
| R194-02 | Depois de concluir `op-A`, enviar `op-B`. | Nova intenção pode produzir o próximo efeito permitido. | `op-A` atuar como intenção nova. | API, persistência e reload. |
| R194-03 | Reusar a chave mudando orçamento, ator, forma ou data. | Conflito explícito; zero alteração e zero dado do vencedor. | Retorno de ID de outro contexto. | Duas sessões e dois orçamentos sintéticos. |
| R194-04 | Duas chamadas simultâneas com a mesma chave e orçamento. | Mesmo ID nas duas; um pagamento e um log. | Uma chamada em cada ramo. | Dois clientes no banco isolado, sem carga. |
| R194-04B | Mesma chave simultânea em orçamentos diferentes. | Um vencedor no máximo; a outra chamada conflita sem vazamento. | IDs cruzados ou dois pagamentos. | Dois clientes, contagens antes/depois. |
| R194-04C | Chaves diferentes simultâneas no mesmo orçamento. | Serialização pelo orçamento; cada chamada usa o estado deixado pela anterior e respeita saldo. | Total acima do devido. | Dois clientes e saldo calculável. |
| R194-05 | Falha controlada antes do commit e retry posterior. | Primeira chamada deixa zero efeito; retry produz uma operação completa. | Estado ou log parcial. | Hook apenas no banco isolado. |
| R194-06 | Identidade permitida e identidade negada chamam a RPC diretamente. | Permitida conclui; negada tem zero leitura/escrita. | RLS ou UUID substituir autorização. | Duas contas autenticadas sintéticas. |
| R194-07 | Usar confirmação explícita por ID e formulário manual R-189. | Fluxos preservados e seus contratos próprios continuam válidos. | Atalho mudar permissão ou semântica deles. | Regressão dirigida por API e UI. |
| R194-08 | Secretária usa pagamento rápido sem parcela para orçamento de outro dentista; commit ocorre e a resposta se perde; repetir a mesma chave. | Um pagamento saldo, um log, uma notificação `pagamento_confirmado` ao responsável e mesmo ID no retry. | Notificação ausente após insert bem-sucedido, duplicada no replay ou enviada a outro destinatário. | Banco isolado, contagens e payload antes/depois, perda de resposta e reload do destinatário. |
| R194-08B | No mesmo cenário, injetar falha somente no insert da notificação. | Pagamento e log confirmam uma vez; zero notificação; metadata registra `falhou`; retry retorna o mesmo pagamento sem nova tentativa. | Tratar pagamento como falho, duplicá-lo ou esconder a falha no log. | Banco isolado com falha delimitada e integrações externas desligadas. |
| R194-08C | Secretária confirma uma previsão existente pelo pagamento rápido; repetir após resposta perdida. | Um pagamento e um log; zero `pagamento_confirmado`. | Passar a notificar parcela, alterando o gatilho histórico. | Banco isolado, contagem por tipo/destinatário e reload. |

### Estado dos gates

- **PASSA estático no candidato corrigido:** fronteira transacional de R194-01C/04, ausência de
  escolha de ramo na Action, gatilho e falha best-effort da notificação R194-08/08B, zero
  notificação na parcela R194-08C e propriedade do índice preservada na R-189. A segunda
  revisão independente confirmou esses pontos por leitura; cinco testes contratuais passaram.
- **NÃO TESTADO:** R194-01 a R194-08C no contrato revisado. Não há banco isolado funcional; build,
  typecheck ou inspeção não substituem esses gates.
- Um Executor pode marcar **PASSA estático** apenas para assinatura, ordem de locks, autorização,
  replay anterior à escolha, unicidade, ausência de dois endpoints e gatilho de notificação por
  origem. Persistência, concorrência, transporte, reload e regressão continuam **NÃO TESTADO** até
  execução sintética.

## 8. Escopo de execução e arquivos

### Dentro

- manter `supabase/migrations/20261012034858_r194_confirmacao_parcela_idempotente.sql` com a
  regra de notificação na RPC única e sem recriação do índice R-189;
- preservar `registrarPagamentoRapido` em `src/app/dashboard/orcamentos/actions.ts` com uma
  chamada à RPC única, sem notificação pós-RPC na Action;
- testes focais da RPC/Action e gates sintéticos desta spec;
- ajustar tipos gerados apenas se o repositório os versionar e a RPC exigir.

### Fora

- modificar a RPC ou o formulário manual R-189;
- alterar UI, helper geral de notificações, cálculo R-184, autorização R-188 ou schema além da função
  R-194; `pagamentos.operacao_id` e seu índice continuam propriedade exclusiva da R-189;
- revogar RPC antiga, sanear histórico, mexer em gateway/fiscal ou publicar.

Dependência: migration aditiva R-189 aplicada antes da R-194. O candidato R-194 ainda não pode ser
aplicado por falta de banco isolado e gates funcionais. Se ele já tiver sido aplicado em algum ambiente não registrado, a Coordenação deve parar
a execução e reconciliar o objeto real antes de preparar `CREATE OR REPLACE` ou reversão.

## 9. Handoff para Coordenação e Executor

- **Objetivo:** uma intenção do pagamento rápido, uma transação, um efeito.
- **Decisão:** a RPC única escolhe previsão ou saldo sob lock; a Action não escolhe ramo.
- **Preservar:** R-188, R-189 manual, R-184, confirmação explícita, estorno e cobrança por etapa.
- **Arquivos mínimos:** migration R-194 e testes focais. `actions.ts` só entra se a assinatura
  mudar; a regra aprovada não pede notificação pós-RPC.
- **Aceite obrigatório:** R194-01, 01B, 01C, 02, 03, 04, 04B, 04C, 05, 06, 07, 08, 08B e 08C.
- **Revisão antes de integrar:** conferir base/versões, diff dos dois consumidores, ordem de locks,
  conflito com R-189 e evidência por critério.
- **Publicação:** integração local, migration, deploy e aceite do usuário são estados distintos;
  nenhum deles foi autorizado por esta spec.
- **Reversão segura:** desabilitar o pagamento rápido se a RPC única não puder operar. Não restaurar
  a seleção não idempotente na Action nem remover `operacao_id` de históricos.

Estado integrado: spec, migration, Action e teste focal são candidatos locais. Nenhum banco recebeu
R-189/R-194; não houve commit, push ou deploy. A revisão estática passou, enquanto os critérios
persistentes e a aceitação do usuário continuam pendentes.
