# R-184 — Primeira previsão sobre aprovação parcial

> **SPEC** · **R-184** · 🔵 ativo
> **Aberto:** 2026-10-11 · **Fechado:** — · **Fase:** contrato

**Estado atual (12/10):** migration `20261012034818_r184_previsao_aprovacao_parcial.sql`
aplicada no Supabase de produção após conferir a guarda R-188. O gate direto com
orçamento sintético confirmou devido de R$ 70 e duas previsões de R$ 25, com negação
do protético sem escrita. A versão Vercel ainda é `ba5b531`; UI publicada e fluxo
R184-01–07 completo permanecem não verificados. Evidência consolidada em
[`2026-10-12-financeiro-migrations.md`](../auditorias/2026-10-12-financeiro-migrations.md).

**Gate local recortado, anterior à aplicação (12/10):** migration R-184 executou após R-188 em PGlite descartável;
fingerprint da guarda R-188 coincidiu com `b05d239c7cb52339e6fa7e3de33e22e8`.
Passaram cálculo com aprovação parcial/desconto/pago anterior (devido 70, parcelas 25+25),
ausência de aprovação, acordo explícito e negação de outra clínica, com contagem de efeitos.
Evidência reproduzível: `scripts/test-r184-r189-r194-db.mjs`. É um schema mínimo, não o
restore do catálogo vivo; R184-01–06 completos por API/UI, falha interna e regressão no
schema real seguem **NÃO TESTADO**. R184-07 depende da decisão de entrada.

## 1. Problema

### Fato verificado

Na primeira organização de parcelas, o perfil chama `gerarParcelas` sem
`valorAcordado`. A RPC viva `public.gerar_parcelas_orcamento` resolve então a base por
`coalesce(p_valor_acordado, orcamentos.valor_acordado, orcamentos.total)`. Isso ignora a
aprovação parcial e pode transformar itens ainda não aprovados em previsão de cobrança.

O M0 reproduziu o efeito com dados sintéticos: itens de R$ 100 e R$ 200, desconto global de
R$ 30, somente o item de R$ 100 aprovado e R$ 20 já recebidos. O devido canônico era R$ 70 e
o saldo R$ 50; a primeira previsão persistiu R$ 250 e `valor_acordado = 270`.

Em leitura do objeto vivo em 11/10/2026, após R-188, a guarda de autorização está ativa, mas
a expressão de cálculo acima permanece. A view `public.orcamentos_com_estado` e
`deriveEstadoOrcamento` já calculam o devido por fatos: acordo explícito, quando existe; senão,
soma dos itens aprovados menos o desconto aplicável.

### Lacuna

A fonte autoritativa do primeiro plano diverge da fonte usada pela UI e pelas leituras
financeiras. O resultado infla previsão, saldo e acordo persistido.

## 2. Decisão

Na primeira previsão, quando `p_valor_acordado` for `null`, a RPC deve obter no banco o
`valor_devido` canônico do orçamento no mesmo instante e sob a mesma transação. Esse valor passa
a ser o `valor_acordado` congelado pelo plano. O saldo parcelável é:

```text
saldo parcelável = valor devido canônico − recebimentos pagos − entrada informada
```

O cálculo fica no banco. O cliente não envia soma aprovada, desconto, total pago ou saldo.
`p_valor_acordado` explicitamente informado conserva a precedência atual; alterar a regra de
negociação explícita não pertence a R-184.

### Decisão financeira pendente

`p_entrada_valor` hoje reduz as parcelas sem criar, por si, uma linha `pago` ou `pendente`.
Ainda falta decidir se “entrada” representa dinheiro recebido, uma previsão separada ou apenas
termo comercial. R-184 **não resolve nem legitima essa semântica**: preserva o comportamento
vigente no ramo com entrada e conclui o gate principal com `entrada = null`. Mudar esse ramo
exige decisão do usuário e contrato próprio antes do código.

## 3. Objetivo e usuário

Dentista/admin responsável e secretária já autorizada devem organizar a primeira previsão
somente sobre o que o paciente aprovou e ainda deve, sem cobrar itens propostos. O item não cria
novo papel, não concede acesso ao dono não dentista e não muda quem pode editar ou aprovar itens.

Resultado observável: UI, view, parcelas e Financeiro exibem o mesmo devido e o mesmo saldo após
reload.

## 4. Contrato técnico

### Contrato preservado

```ts
interface GerarParcelasInput {
  orcamentoId: string;
  numeroParcelas: number;       // 2..24
  primeiroVencimento: string;   // data ISO
  valorAcordado?: number;       // negociação explícita; sem mudança neste item
  entradaValor?: number;        // semântica pendente; sem mudança neste item
  entradaForma?: FormaPagamento;
  parcelasForma?: FormaPagamento;
}

type GerarParcelasResult = {
  error?: string;
  parcelas?: ParcelaGerada[];
};
```

A assinatura SQL continua:

```sql
public.gerar_parcelas_orcamento(
  uuid, smallint, date, numeric, numeric, text, text
) returns setof public.pagamentos
```

Quando `p_valor_acordado is null`, a implementação consulta a fonte canônica do devido dentro da
transação e depois trava/persiste o plano. Não reimplementa no cliente a fórmula de itens,
descontos ou cobranças por etapa.

### Dependência obrigatória de R-188

A definição viva tem fingerprint MD5 de `pg_get_functiondef` igual a
`b05d239c7cb52339e6fa7e3de33e22e8` na leitura de 11/10/2026. O hash
`95afc940234d343135f3dcf574c64501` anotado antes veio de representação diferente
e não deve ser usado como guarda de aplicação. A migration de R-184 deve partir da
definição viva, preservando antes de qualquer
leitura/retorno/escrita:

- `auth.uid()`, clínica ativa, vínculo ativo e perfil ativo;
- papéis admitidos atualmente;
- correspondência entre o responsável e o orçamento para admin/dentista;
- permissão atual da secretária;
- grants somente para `authenticated`, nunca `anon` ou `PUBLIC`.

Uma migration baseada na função anterior ao R-188 **não pode ser aplicada**. O gate compara a
guarda antes/depois, além do cálculo.

### Possíveis arquivos e consumidores diretos

- migration nova, exclusiva de R-184, em `supabase/migrations/`;
- `src/app/dashboard/orcamentos/actions.ts`, somente se o contrato de retorno tipado exigir ajuste;
- `src/app/dashboard/pacientes/[id]/_components/paciente-detail-client.tsx` como jornada da
  primeira previsão;
- `src/lib/orcamentos/estado.ts` e `public.orcamentos_com_estado` como fontes de comparação, sem
  criar terceira fórmula;
- `/dashboard/financeiro` como consumidor do total pendente.

## 5. Comportamento e estados

| Estado inicial / ação | Resultado esperado | Efeito proibido |
| --- | --- | --- |
| Carregando/salvando | A ação permanece bloqueada até resposta definitiva. | Duplo envio ou previsão otimista persistida só no cliente. |
| Sem item aprovado | Erro `orcamento_sem_aprovacao`; zero alteração. | Criar plano a partir de `total`. |
| Primeira previsão válida | Congela o devido canônico e cria parcelas do saldo. | Incluir item não aprovado. |
| Acordo explícito | Mantém a precedência do valor informado e valida contra o já pago. | Substituí-lo silenciosamente pela soma aprovada. |
| Quitado ou saldo não positivo | Erro explícito; zero nova parcela. | Parcela negativa/zero ou reabertura implícita. |
| Plano já existente | `plano_ja_definido`; zero alteração. | Segundo plano concorrente. |
| Sem permissão | `sem_permissao`; nenhuma linha ou dado financeiro retornado. | Regressão da guarda R-188. |
| Falha durante a RPC | Plano e parcelas não persistem parcialmente. | `valor_acordado` sem todas as parcelas, ou parcelas sem plano. |
| Sucesso + reload | View, UI e Financeiro concordam com banco. | Saldo derivado de estado otimista antigo. |

### Exemplos calculáveis

1. Itens R$ 100 + R$ 200; desconto R$ 30; só R$ 100 aprovado; pago R$ 20; sem acordo:
   devido R$ 70, saldo R$ 50, duas parcelas de R$ 25 e `valor_acordado = 70`.
2. Mesmo caso sem pagamento: devido R$ 70; duas parcelas de R$ 35.
3. Os dois itens aprovados, desconto R$ 30 e R$ 20 pagos: devido R$ 270; saldo R$ 250.
   Este caso preserva o resultado antes correto.
4. Acordo explícito de R$ 60 e R$ 20 pagos: saldo R$ 40; a aprovação parcial não sobrescreve o
   acordo informado.
5. Saldo de R$ 100,01 em três parcelas: a soma deve ser exatamente R$ 100,01, com diferença de
   centavos em uma única parcela conforme o algoritmo vigente.

## 6. Referência visual

Não há redesign. Preservar componentes, textos, ordem, estados e tokens atuais. A única mudança
perceptível é o valor correto após sucesso e reload.

## 7. Permissões e invariantes

1. R-184 não altera a matriz de autorização consolidada por R-188.
2. Dono não dentista não ganha operação clínica/financeira por inferência.
3. Itens não aprovados nunca entram no devido implícito nem nas parcelas.
4. `status='pago'` é dinheiro; `status='pendente'` é previsão.
5. Recebimentos pagos/cancelados não são modificados pela criação do plano.
6. Plano, `valor_acordado` e parcelas são atômicos.
7. Soma das parcelas fecha o saldo em centavos.
8. Nenhum dado real é usado no gate; nenhuma integração externa é acionada.

## 8. Gates de aceite

| ID | Estado inicial e ação | Esperado | Verificação segura |
| --- | --- | --- | --- |
| R184-01 | Fixture 100+200, desconto 30, aprovado 100, pago 20; gerar 2 parcelas. | **PASSA** se devido=70, acordo=70 e pendentes somam 50; proibido 250/270. | Sessão autorizada, resposta, antes/depois e reload. |
| R184-02 | Mesma fixture, nenhum item aprovado. | **PASSA** se erro explícito e zero alteração em orçamento/pagamentos/logs. | Chamada direta + contagens antes/depois. |
| R184-03 | Todos os itens aprovados e pago 20. | **PASSA** se devido=270 e pendentes somam 250. | API/UI + reload do Financeiro. |
| R184-04 | Acordo explícito 60, pago 20. | **PASSA** se pendentes somam 40 e acordo permanece 60. | Chamada direta e persistência. |
| R184-05 | Ator permitido e ator negado exercitam a RPC atualizada. | **PASSA** se permitido conclui; negado recebe `sem_permissao`, sem retorno ou alteração. | Duas sessões autenticadas e fixture nova. |
| R184-06 | Falha controlada no meio da transação. | **PASSA** se não existe plano parcial; retry seguro cria um plano completo. | Banco isolado, nunca produção. |
| R184-07 | Caso com `entrada_valor`. | **NÃO TESTADO** como regra de produto até decisão; nenhuma alteração silenciosa aceita. | Decisão separada antes de ampliar o gate. |

Ambiente: M0 confirmou que não existe branch Supabase isolado pronto. Qualquer gate com escrita
aguarda ambiente isolado ou autorização específica para fixture sintética delimitada, sem gateway,
e-mail, WhatsApp ou dados reais.

## 9. Fora de escopo

- Resolver a semântica de entrada, negociação explícita ou cobrança por etapa.
- Corrigir idempotência de recebimento (R-189), autorização adicional ou outras RPCs.
- Provar concorrência entre criação de plano e recebimento; permanece **NÃO TESTADO** e exige
  recorte próprio se o gate dirigido encontrar efeito.
- Recalcular ou sanear planos históricos automaticamente.
- Alterar aprovação de itens, UI, PDF, gateway, fiscal ou conciliação.

## 10. Handoff para o Executor

- **1. Identificação:** R-184 · Financeiro/Orçamentos · Arquiteto → Coordenação/Executor ·
  `READY_FOR_REVIEW` · base `codex/baseline-producao-v2@ba5b531` · 2026-10-11.
- **2. Objetivo:** corrigir somente a base autoritativa da primeira previsão após aprovação
  parcial.
- **3. Contexto mínimo:** defeito S1 confirmado; guarda R-188 já viva; entrada ainda sem decisão.
- **4. Fontes:** esta spec; M0; AC-05; objeto vivo lido em 11/10/2026.
- **5. Decisões:** devido vem do banco; acordo explícito e permissões permanecem; entrada fica fora.
- **6. Fora:** §9.
- **7. Arquivos alterados nesta entrega:** somente esta spec. Arquivos possíveis de execução estão
  na §4 e devem ser redelimitados pelo integrador antes do código.
- **8. Banco/API:** mesma assinatura de `gerar_parcelas_orcamento`; migration exclusiva e posterior
  ao R-188.
- **9. Aceite:** gates R184-01 a R184-07.
- **10. Testes executados:** leitura de código e catálogo vivo; unitário, integração, E2E, manual
  com escrita e regressão funcional **NÃO TESTADO**.
- **11. Problemas:** confirmado cálculo pelo total; suspeita de corrida fica fora; entrada bloqueia
  ampliação do escopo.
- **12. Riscos:** sobrescrever a guarda R-188, divergir da view ou alterar planos históricos.
- **13. Próxima ação:** Coordenação apresenta a decisão pendente e o contrato ao usuário. Após
  aprovação, Executor confere a função viva, implementa o recorte e registra PASSA, NÃO PASSA ou
  NÃO TESTADO por gate, ambiente e versão.
- **14. Não fazer:** commit, push, deploy, escrita em produção, saneamento histórico, mudança de
  permissões ou implementação paralela à mesma RPC.
- **15. Documentação:** spec criada; nenhum índice, estado, relatório ou artefato foi alterado.

Reversão da futura execução: migration de avanço que restaure somente o cálculo anterior mantendo
integralmente a guarda R-188; nunca restaurar a função vulnerável anterior.

## Evidência de execução local — 2026-10-11

- **Arquivos sob responsabilidade:** criada somente a migration
  `supabase/migrations/20261012034818_r184_previsao_aprovacao_parcial.sql`; `actions.ts`, R-189,
  `entrada_valor`, permissões e dados históricos não foram alterados.
- **Fonte viva verificada em leitura:** o MD5 atual da função é
  `b05d239c7cb52339e6fa7e3de33e22e8`; o §4 agora explicita a diferença de representação
  do hash anterior. A leitura confirmou
  `auth.uid()`, clínica e vínculo ativos, perfil ativo, correspondência admin/dentista e grants
  (`anon=false`, `PUBLIC=false`, `authenticated=true`). A migration falha antes de substituir a
  função se o fingerprint ou esses trechos da guarda mudarem.
- **Implementação estática — PASSA:** quando `p_valor_acordado is null`, consulta
  `orcamentos_com_estado.valor_devido` na mesma transação; valor devido não positivo devolve
  `orcamento_sem_aprovacao`. Um acordo explícito segue a precedência do parâmetro, e o ramo de
  `p_entrada_valor` não mudou. A diff contra R-188 limita a alteração ao cálculo e aos grants
  explícitos.
- **Validações locais — PASSA:** `static-r184-contract` confirmou a guarda, o cálculo canônico,
  o erro sem aprovação e a remoção da fórmula pelo total; `git diff --check` passou.
- **Banco isolado — BLOQUEIO:** `npx supabase migration list --local` não conectou em
  `127.0.0.1:54322` (Postgres/Docker indisponível). A migration não foi aplicada em nenhum banco.
  R184-01 a R184-06 permanecem **NÃO TESTADOS**; R184-07 permanece **NÃO TESTADO** por decisão de
  produto. Não ampliar ou publicar até executar fixtures sintéticas em banco isolado.
- **Reversão:** migration de avanço que substitua apenas o cálculo R-184 pela versão anterior,
  preservando a guarda R-188 e os grants; nunca restaurar uma definição anterior à guarda.

### A01 — tradução do erro no consumidor direto — 2026-10-11

- **Implementação:** `gerarParcelas` traduz `orcamento_sem_aprovacao` para “Aprove ao menos um
  procedimento antes de organizar a cobrança.” antes do fallback genérico. Nenhuma migration,
  action financeira adjacente ou regra de cálculo foi alterada.
- **Validação:** checagem estática do ramo e `tsc --noEmit` passaram; não existe padrão de teste
  unitário focal para actions neste recorte. O caso RPC/UI permanece
  **NÃO TESTADO** até banco isolado e fixture sintética.
- **Reversão:** remover somente este ramo de mapeamento em `src/app/dashboard/orcamentos/actions.ts`.

## 11. Gate dirigido do Auditor — 2026-10-11

**Parecer:** **NÃO PASSA** para integração/publicação neste estado. A migration preserva a guarda
R-188 e corrige estaticamente a fonte do devido, mas o consumidor direto não traduz o novo erro de
ausência de aprovação e a criação concorrente de dois planos não devolve o erro de domínio previsto.

Ambiente e limites: revisão estática no checkout compartilhado e consultas somente leitura ao
catálogo do projeto vivo `zenfemoxvwerplrjgfqz`. Nenhuma migration foi aplicada; nenhuma RPC foi
executada; nenhum dado foi escrito; R-189 e os arquivos de código em edição paralela não foram
alterados.

### Achados confirmados

#### R184-A01 — erro de ausência de aprovação perde a causa no consumidor direto

- **Classificação / severidade / confiança:** `CONFIRMED` · **S2** · alta.
- **Onde:** a migration lança `orcamento_sem_aprovacao` quando o devido implícito é zero
  (`20261012034818_r184_previsao_aprovacao_parcial.sql`, linhas 116–124), mas `gerarParcelas`
  não trata esse token e cai no fallback genérico (`actions.ts`, linhas 574–581).
- **Como reproduzir:** depois de aplicar a migration em ambiente isolado, usar fixture autorizada
  sem item aprovado e chamar `gerarParcelas`, não a RPC diretamente.
- **Esperado:** R184-02 e §5 exigem erro explícito de orçamento sem aprovação e zero alteração.
- **Observado:** por fluxo de controle estático, a RPC produzirá o token correto, porém a action
  retornará `Não foi possível gerar as parcelas. Tente novamente.` e registrará o erro no console.
- **Evidência:** comparação direta entre o novo ramo SQL e a tabela de tradução da action; não houve
  execução porque o gate proíbe aplicar a migration ou escrever no banco.
- **Impacto:** a proteção financeira funciona, mas o usuário não recebe a causa nem a recuperação
  prevista — aprovar ao menos um procedimento antes de tentar novamente.
- **Pode ser falso positivo?** Baixa chance. Seria `NOT_A_BUG` apenas se o aceite fosse restrito à
  chamada SQL direta, o que conflita com o resultado observável por UI definido nesta spec.
- **Teste que valida:** fixture R184-02 pela action, conferindo mensagem e contagens antes/depois.
- **Menor correção sugerida:** acrescentar um único ramo para `orcamento_sem_aprovacao` na tabela de
  tradução de erros de `gerarParcelas`, depois que o R-189 liberar `actions.ts`; não mudar a RPC.

### Achados não confirmados

#### R184-A02 — chamada concorrente perde o erro de domínio, embora o banco evite duplicação

- **Classificação / severidade / confiança:** `PROBABLE` · **S2** · alta.
- **Onde:** as checagens de `plano_forma`/parcelas existentes ocorrem sem `FOR UPDATE`; a atualização
  posterior usa apenas `where id = p_orcamento_id` (migration, linhas 85–114 e 139–148).
- **Como reproduzir:** em banco isolado, sincronizar duas sessões autorizadas para chamar a RPC no
  mesmo orçamento ainda sem plano e liberar ambas após a leitura inicial.
- **Esperado:** uma chamada cria o plano; a outra retorna `plano_ja_definido`; nunca há segundo plano.
- **Observado:** não executado. Sob o `READ COMMITTED` vivo, ambas podem passar nas checagens. O índice
  único vivo `uq_pagamentos_orcamento_parcela_pendente` deve abortar integralmente a perdedora com
  violação `23505`, que a action traduz para erro genérico, em vez de `plano_ja_definido`.
- **Evidência:** ausência de lock/atualização condicional na função; isolamento vivo `read committed`;
  índice único parcial vivo em `(orcamento_id, parcela_numero)` para parcelas pendentes sem cobrança.
- **Impacto:** não há evidência de duplicação persistida, mas um duplo envio pode terminar com erro
  técnico e recuperação ambígua em um fluxo financeiro.
- **Pode ser falso positivo?** Sim. Falta o teste concorrente para observar o erro real e confirmar a
  ordem de bloqueios; por isso o achado não é `CONFIRMED`.
- **Teste que valida:** duas transações coordenadas em banco isolado, capturando SQLSTATE, resposta das
  duas sessões, orçamento e parcelas após commit.
- **Menor correção sugerida:** adquirir `FOR UPDATE` na linha do orçamento já na leitura inicial,
  antes das checagens de plano e do cálculo. A segunda chamada então relê o estado após o primeiro
  commit e retorna `plano_ja_definido`; o índice único continua como defesa adicional.

#### R184-A03 — consistência contra aprovação ou recebimento simultâneo

- **Classificação / severidade / confiança:** `NEEDS_EVIDENCE` · **S2** · média.
- **Onde:** devido, total pago e atualização do plano são instruções separadas sem snapshot repetível
  nem locks compartilhados com mutações de itens/pagamentos.
- **Como reproduzir:** exige teste coordenado de criação do plano contra aprovação/desaprovação de item
  e contra confirmação de recebimento.
- **Esperado:** congelar um devido e saldo coerentes com um único estado financeiro observável.
- **Observado:** **NÃO TESTADO**; a spec já deixa criação de plano versus recebimento fora do recorte.
- **Evidência:** estrutura multi-instrução da RPC e isolamento vivo `read committed`; isso demonstra a
  janela, não um resultado financeiro incorreto.
- **Impacto:** potencial acordo congelado a partir de fatos vistos em instantes distintos.
- **Pode ser falso positivo?** Sim; fluxos escritores podem possuir locks/invariantes não exercitados
  neste gate.
- **Teste que valida:** cenário concorrente isolado com barreiras e conferência antes/depois. Tratar em
  recorte próprio, sem ampliar silenciosamente R-184.

### Falsos positivos e não bugs registrados

- **`FALSE_POSITIVE` — regressão da guarda R-188:** a diff funcional preserva `auth.uid()`, clínica e
  vínculo ativos, perfil ativo, papéis, correspondência admin/dentista e permissão de secretária. O
  objeto vivo tem o MD5 esperado `b05d239c7cb52339e6fa7e3de33e22e8`, mesma assinatura, `SECURITY
  DEFINER`, `search_path=public`, `anon=false`, `PUBLIC=false` e `authenticated=true`.
- **`FALSE_POSITIVE` — duas grades de parcelas persistidas:** o índice único vivo deve abortar a
  segunda transação; a função não captura a exceção, então o update e inserts dessa chamada revertem.
  O problema provável de R184-A02 é o erro exposto e a recuperação, não duplicação confirmada.
- **`NOT_A_BUG` — uso de `valor_acordado` já existente:** a view viva dá precedência ao acordo e a
  fórmula TypeScript faz o mesmo. Isso pertence ao contrato canônico atual; o caso sem aprovação de
  R184-02 pressupõe também ausência de acordo explícito anterior.

### Cobertura e estado dos critérios

| Recorte | Estado | Evidência / limite |
| --- | --- | --- |
| Guarda R-188, assinatura e grants | **PASSA** | Diff contra R-188 + catálogo vivo; nenhuma chamada autenticada foi feita. |
| Fingerprint e compatibilidade com o objeto vivo | **PASSA** | MD5 e assinatura exatos; a guarda pré-DDL passaria no estado lido. A migration não foi aplicada. |
| Devido canônico da aprovação parcial | **PASSA** estático | Usa `orcamentos_com_estado.valor_devido`; view viva e `deriveEstadoOrcamento` aplicam a mesma precedência e desconto. |
| Ausência de aprovação dentro da RPC | **PASSA** estático | Devido implícito não positivo lança `orcamento_sem_aprovacao` antes de qualquer update/insert. |
| Ausência de aprovação pela action/UI | **NÃO PASSA** | R184-A01: token novo não é traduzido. |
| Ausência de mutação de aprovação | **PASSA** estático | A função não escreve em `orcamento_itens`, `aprovado_por_id` ou `aprovado_em`. |
| Atomicidade de uma chamada | **PASSA** estático | Plano e parcelas estão na mesma função sem captura de exceção; falha reverte a instrução inteira. |
| Duas criações simultâneas de plano | **NÃO PASSA** para o contrato | R184-A02; proteção de unicidade existe, mas o erro esperado não está garantido. |
| Plano versus aprovação/recebimento concorrente | **NÃO TESTADO** | R184-A03; requer recorte e banco isolado. |
| R184-01 a R184-06 ponta a ponta | **NÃO TESTADO** | Dependem de migration aplicada e escrita sintética isolada. |
| R184-07 (`entrada_valor`) | **NÃO TESTADO** | Decisão de produto continua pendente. |
| Formatação/diff | **PASSA** | `git diff --check` sem erros nos dois arquivos do recorte. |

### Próxima ação

1. Após liberar a responsabilidade paralela de `actions.ts` pelo R-189, o Executor deve acrescentar
   o ramo de `orcamento_sem_aprovacao` e cobrir R184-02 pela action.
2. Acrescentar `FOR UPDATE` à leitura inicial do orçamento, mantendo integralmente a guarda R-188;
   então executar o teste coordenado de R184-A02 em banco isolado.
3. Só depois executar R184-01 a R184-06 com fixtures sintéticas, registrando resposta, persistência,
   reload e ausência de efeitos indevidos. R184-A03 continua fora do item até decisão explícita.

### Integração após o gate — Coordenação, 11/10/2026

R184-A02 recebeu a menor correção local: a leitura inicial do orçamento na migration
agora usa `FOR UPDATE` antes de consultar plano, devido e parcelas. A proteção de
unicidade permanece. Isso **não é PASSA concorrente**: a migration não foi aplicada e
o teste com duas sessões segue **NÃO TESTADO**. R184-A01 continua **NÃO PASSA** na
Action até a tradução do erro, após o marco R-189 liberar o arquivo. A revisão do
Auditor acima descreve a versão anterior da migration e permanece como evidência do
achado que motivou a correção.
