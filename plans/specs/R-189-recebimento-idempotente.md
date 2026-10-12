# R-189 — Recebimento repetido idempotente

> **SPEC** · **R-189** · 🔵 ativo
> **Aberto:** 2026-10-11 · **Fechado:** — · **Fase:** contrato

**Estado atual (12/10):** migration `20261012034837_r189_recebimento_idempotente.sql`
aplicada no Supabase de produção; coluna, índice e RPC confirmados no catálogo. Testes
diretos com contas sintéticas passaram para replay, conflito entre atores/payloads e
duas intenções iguais distintas. No localhost, o formulário gravou R$ 50 uma vez e
mostrou R$ 250/R$ 300 após recarga. **A Vercel ainda está em `ba5b531` e chama a
RPC antiga**, que deve permanecer para não quebrar a versão publicada; a proteção de
retry ainda não cobre essa interface. Concorrência real e falha de transporte seguem
NÃO TESTADO. [Evidência consolidada](../auditorias/2026-10-12-financeiro-migrations.md).

**Gate local recortado, anterior à aplicação (12/10):** migration R-189 aplicou em PGlite descartável após R-188/R-184.
Passaram replay com mesmo ID e um log, duas intenções idênticas distintas, conflito de chave
entre atores, excesso de saldo sem escrita e reversão total quando o log falha, seguida de retry.
Evidência: `scripts/test-r184-r189-r194-db.mjs`. Não há duas conexões concorrentes, API/UI,
restore do schema completo ou revogação final da RPC antiga; R189-01–08 completos continuam
**NÃO TESTADO**. O catálogo publicado em 12/10 não tem a coluna `operacao_id` nem a nova RPC.

## 1. Problema

### Fato verificado

`registrarPagamento` chama `public.registrar_recebimento_orcamento(uuid,numeric,text,date)` sem
identificador da intenção. A RPC viva trava o orçamento, valida o saldo e insere sempre uma nova
linha `pagamentos.status='pago'`. A tabela tem unicidade para `external_payment_id`, destinada a
provedores externos, mas o recebimento manual não preenche esse campo nem possui chave própria.

No ensaio sintético de 06/10, duas chamadas sequenciais iguais da mesma intenção retornaram IDs
distintos e persistiram dois recebimentos. M0 confirmou o mecanismo no objeto atual. Concorrência
ampla continua **NÃO TESTADO**.

### Lacuna

Depois de timeout, perda da resposta, retry do framework ou clique repetido, o sistema não distingue
“repetir a mesma intenção” de “registrar um segundo recebimento legítimo do mesmo valor”. Deduplicar
por valor/data/forma seria incorreto: dois PIX de R$ 100 no mesmo dia podem ser reais.

## 2. Decisão

Cada intenção manual de recebimento recebe `operacaoId: UUID`, criado pelo cliente uma vez e
reutilizado somente enquanto o resultado daquela intenção for desconhecido. A idempotência é por
`(clinica_id, operacao_id)`, validada dentro da RPC e protegida por índice único.

- Mesma chave + mesmo ator + mesmo orçamento/valor/forma/data: retorna o mesmo `pagamentoId`, com
  `repetida=true`; não cria pagamento, log ou notificação adicionais.
- Mesma chave com payload ou ator diferente: `chave_idempotencia_reutilizada`; zero alteração e
  nenhum dado da operação original na resposta.
- Chaves diferentes permitem recebimentos idênticos legítimos, desde que o saldo comporte ambos.
- Duas chaves concorrentes no mesmo orçamento obedecem ao lock e ao saldo recalculado.

### Decisão de UI aprovada pelo usuário em 11/10/2026

Manter a chave até resposta definitiva; em timeout/resultado desconhecido,
`Tentar novamente` reutiliza a mesma operação. Para iniciar outro recebimento, a tela
primeiro recarrega/reconcilia o orçamento e só então cria nova chave. Dois pagamentos
iguais intencionais continuam possíveis com chaves distintas. Não persistir a chave
indefinidamente nem deduplicar por conteúdo.

## 3. Objetivo e usuários

Dentista/admin responsável e secretária já autorizada podem registrar um recebimento manual uma
única vez apesar de retry. Duas intenções reais continuam possíveis. O item não concede operação ao
dono não dentista, não muda quem aprova orçamento e não altera leitura financeira.

Resultado observável: resposta original, retry, banco, histórico, notificações, UI e reload apontam
para o mesmo pagamento; total pago e saldo mudam uma vez.

## 4. Contrato técnico

### Tipos de aplicação

```ts
interface RegistrarPagamentoInput {
  operacaoId: string;           // UUID criado no início da intenção
  orcamentoId: string;
  pacienteId: string;
  valor: number;                // positivo, até 2 casas
  formaPagamento: FormaPagamento;
  data: string;                 // data ISO
  dentistaId?: string;          // compatibilidade atual; não autoriza a operação
}

type RegistrarPagamentoResult =
  | { ok: true; pagamentoId: string; repetida: boolean; autoAprovado?: boolean }
  | { ok: false; error: string; retryable: boolean };
```

Erro de validação/autorização/conflito é definitivo para aquela submissão. Timeout ou falha de
transporte é indeterminado e preserva `operacaoId` para retry.

### Persistência proposta

Adicionar a `public.pagamentos`:

```sql
operacao_id uuid null
```

e índice único parcial:

```sql
unique (clinica_id, operacao_id) where operacao_id is not null
```

O campo é anulável para manter linhas históricas e fluxos ainda fora deste recorte. Não reutilizar
`external_payment_id`: ele identifica uma cobrança/evento do provedor, não uma intenção manual.

### RPC idempotente

Contrato alvo:

```sql
public.registrar_recebimento_orcamento_idempotente(
  p_operacao_id uuid,
  p_orcamento_id uuid,
  p_valor numeric,
  p_forma text,
  p_data date
) returns table (
  pagamento_id uuid,
  dentista_id uuid,
  repetida boolean
)
```

Ordem transacional obrigatória:

1. validar identidade, clínica, ator, entrada e permissão vigentes;
2. travar o orçamento com `FOR UPDATE`;
3. consultar novamente `(clinica_id, operacao_id)` já sob a serialização;
4. se existir, comparar ator e payload canônico e retornar replay ou conflito;
5. recalcular devido e total pago no banco;
6. inserir um pagamento e um log na mesma transação;
7. retornar o ID persistido e `repetida=false`.

O índice único é a última contenção de corrida, não substitui a segunda consulta sob lock. A RPC
mantém `SECURITY DEFINER`, `search_path` seguro e `EXECUTE` somente para `authenticated`. Como
RLS não protege uma `SECURITY DEFINER`, a nova função valida internamente `auth.uid()`, clínica
ativa, vínculo ativo, perfil ativo, papel admitido e relação do ator com o orçamento, seguindo a
guarda já consolidada no R-188. Isso não cria papel novo nem amplia o alcance atual.

### Compatibilidade e ordem de release

Não pode haver janela em que o código novo chama uma função inexistente, nem declarar o item
concluído enquanto a RPC antiga continuar como caminho autenticado sem chave.

1. migration aditiva: coluna, índice e nova RPC, preservando o caminho publicado;
2. código: todos os consumidores passam `operacaoId` e usam somente a nova RPC;
3. gate na versão candidata;
4. migration final separada revoga `authenticated` da RPC antiga de quatro argumentos;
5. gate direto confirma que o caminho antigo não aceita novos recebimentos.

Publicação de cada etapa requer autorização. A Coordenação pode optar por janela de manutenção se
não aceitar a coexistência temporária; a spec não presume essa decisão operacional.

### Consumidores e possíveis arquivos

- migrations novas em `supabase/migrations/`;
- `src/app/dashboard/orcamentos/actions.ts`: `registrarPagamento` e
  `registrarPagamentoRapido`;
- `src/app/dashboard/financeiro/actions.ts`: delegação para a action canônica;
- `src/app/dashboard/pacientes/[id]/_components/paciente-detail-client.tsx`;
- `src/app/dashboard/orcamentos/_components/orcamentos-client.tsx`;
- `src/app/dashboard/financeiro/_components/financeiro-client.tsx`;
- testes focais de domínio/RPC e de retry.

## 5. Fluxo, estados e exemplos

| Estado | Comportamento | Efeito proibido |
| --- | --- | --- |
| Vazio/edição | Nenhuma chave ativa antes de submeter. | Reusar chave de intenção concluída. |
| Enviando | Botão bloqueado; chave criada uma vez. | Segundo submit com chave nova. |
| Sucesso novo | Mostra o pagamento retornado e encerra a intenção. | Estimar ID no cliente. |
| Sucesso repetido | Mesmo ID, total e saldo; mensagem de sucesso normal. | Segundo log/notificação/linha. |
| Timeout/erro de transporte | Estado “resultado desconhecido”; retry usa a mesma chave. | Tratar como falha definitiva e gerar chave nova automaticamente. |
| Erro de validação/saldo | Erro explícito, zero alteração; nova tentativa corrigida é nova intenção. | Consumir saldo ou criar log parcial. |
| Chave conflitante | Erro `chave_idempotencia_reutilizada`; zero alteração. | Retornar dados da operação original a outro ator. |
| Sem permissão | `sem_permissao`; zero leitura sensível e zero alteração. | Idempotência virar atalho de autorização. |
| Reload | Lista e totais vêm do banco. | Duplicar o item pelo estado otimista. |

### Exemplos calculáveis

1. Devido R$ 300, pago R$ 0; `op-A` registra PIX R$ 100. Retry de `op-A` retorna o mesmo ID;
   total pago R$ 100 e saldo R$ 200.
2. Mesmo cenário, `op-A` e depois `op-B`, ambos PIX R$ 100 no mesmo dia: dois IDs legítimos;
   total pago R$ 200 e saldo R$ 100.
3. `op-A` primeiro com R$ 100 e depois com R$ 120: conflito de chave; permanece R$ 100.
4. Saldo R$ 100; duas chaves concorrentes de R$ 80: uma pode concluir e a outra deve falhar por
   saldo; total pago nunca ultrapassa R$ 100.
5. A transação confirma `op-A`, mas a resposta é perdida. Retry devolve o ID já persistido e não
   repete `activity_logs` nem notificação.

## 6. Referência visual

Sem redesign. Preservar formulários e tokens. Adicionar somente o estado textual para resultado
desconhecido e a ação `Tentar novamente` conforme a decisão aprovada. Loading e bloqueio de
duplo clique continuam visíveis, mas não são a garantia de integridade.

## 7. Permissões e invariantes

1. A chave garante idempotência; nunca concede autorização.
2. Preservar a permissão atual: responsável admin/dentista sobre o próprio orçamento e secretária
   sobre profissional ativo da mesma clínica; nenhum papel novo entra neste item.
   Se o gate encontrar comportamento legado diferente, a execução para e volta ao planejamento;
   não incorpora a diferença silenciosamente.
3. Dono não dentista não recebe acesso financeiro operacional por inferência.
4. Uma intenção confirmada produz exatamente um `pagamentos.pago`, um log e no máximo uma
   notificação funcional.
5. `sum(pago) <= valor_devido` no instante serializado da escrita.
6. Chaves diferentes não são deduplicadas por conteúdo.
7. Linhas históricas com `operacao_id null` permanecem inalteradas.
8. Previsões `pendente`, estornos, correções, cobranças por etapa e gateway externo não mudam.
9. Nenhum teste usa dinheiro, paciente ou usuário real; integrações externas ficam desligadas.

## 8. Gates de aceite

| ID | Estado inicial e ação | Esperado | Verificação segura |
| --- | --- | --- | --- |
| R189-01 | Orçamento sintético com saldo; chamar duas vezes, sequencialmente, com a mesma chave/payload. | **PASSA** se o ID é o mesmo e existe 1 pago, 1 log e no máximo 1 notificação. | Duas chamadas autenticadas, contagens antes/depois e reload. |
| R189-02 | Repetir a chave mudando valor, forma, data, orçamento ou ator. | **PASSA** se conflito explícito e zero alteração/retorno sensível. | Chamadas diretas com duas identidades. |
| R189-03 | Duas chaves e payloads iguais, saldo suficiente. | **PASSA** se existem 2 pagamentos distintos e saldo correto. | API direta + UI/reload. |
| R189-04 | Simular commit seguido de perda da resposta; retry com mesma chave. | **PASSA** se retorna o mesmo ID sem repetir efeitos. | Ambiente isolado; descartar a primeira resposta de propósito. |
| R189-05 | Duas chaves concorrentes que, somadas, excedem o saldo. | **PASSA** se uma falha e total pago nunca excede devido. | Dois clientes no mesmo orçamento sintético; sem carga em produção. |
| R189-06 | Falha controlada depois do insert e antes do fim da RPC. | **PASSA** se a transação inteira reverte; retry posterior cria uma única operação completa. | Hook/fixture apenas em banco isolado. |
| R189-07 | Chamar a assinatura antiga após a etapa final. | **PASSA** se `authenticated` não consegue registrar por ela. | Chamada direta; zero alteração. |
| R189-08 | Percorrer Paciente, Orçamentos, Financeiro e pagamento rápido. | **PASSA** se todos usam chave e mostram os mesmos totais após reload. | Navegador + persistência por superfície. |

Concorrência além desses casos permanece **NÃO TESTADO**. M0 registrou ausência de branch Supabase;
os gates com falha e corrida aguardam ambiente isolado. Produção não recebe teste de carga ou falha.

## 9. Fora de escopo

- Idempotência de `confirmar_previsao_orcamento`, cobranças por etapa, correção, estorno, plano,
  webhooks ou gateway; achado confirmado nessas rotas vira item separado.
- Mudar cálculo R-184, regras de aprovação, permissões ou titularidade financeira.
- Deduplicar ou estornar automaticamente lançamentos históricos.
- Redesign, conciliação bancária, fiscal e integração de pagamento.

## 10. Handoff para o Executor

- **1. Identificação:** R-189 · Financeiro/Orçamentos · Arquiteto → Coordenação/Executor ·
  `PLANNED` para implementação local · base `codex/baseline-producao-v2@ba5b531` · 2026-10-11.
- **2. Objetivo:** tornar idempotente somente o recebimento manual confirmado.
- **3. Contexto mínimo:** retry sequencial duplica; corrida ampla não foi provada; ambiente isolado
  ainda indisponível.
- **4. Fontes:** esta spec; M0; AC-05; objetos vivos lidos em 11/10/2026.
- **5. Decisões:** chave por intenção; conflito por reuso; conteúdo igual com chave diferente é
  permitido; ciclo da chave na UI aprovado em 11/10.
- **6. Fora:** §9.
- **7. Arquivos alterados nesta entrega:** somente esta spec. Consumidores possíveis estão na §4 e
  devem ser atribuídos sem sobreposição antes do código.
- **8. Banco/API:** `pagamentos.operacao_id`, índice único parcial, nova RPC e retirada posterior da
  assinatura antiga; nenhuma mudança aplicada agora.
- **9. Aceite:** gates R189-01 a R189-08.
- **10. Testes executados:** leitura de código e catálogo vivo; unitário, integração, E2E, manual
  com escrita, falha e concorrência **NÃO TESTADO**.
- **11. Problemas:** duplicação sequencial confirmada; concorrência adicional e idempotência de
  outras RPCs permanecem sem evidência.
- **12. Riscos:** janela entre schema/código, chave nova em retry, notificação duplicada, restaurar
  caminho antigo sem idempotência.
- **13. Próxima ação:** Coordenação delimita o ambiente isolado; depois o Executor segue a
  ordem da §4 e registra cada gate. Sem ambiente seguro, só preparar código local.
- **14. Não fazer:** commit, push, deploy, migration/banco real, correção histórica, uso de
  `external_payment_id`, deduplicação por valor/data ou expansão para outras RPCs.
- **15. Documentação:** spec criada; nenhum índice, estado, relatório ou artefato foi alterado.

Reversão da futura execução: código só volta ao caminho anterior enquanto a assinatura antiga ainda
estiver disponível; migrations não apagam `operacao_id` nem pagamentos. Depois da revogação, qualquer
reversão mantém idempotência e nunca restaura a falha.

## Evidência de execução local — 2026-10-11

### Marco entregue: banco e contrato aditivo

- **Arquivo criado:** `supabase/migrations/20261012034837_r189_recebimento_idempotente.sql`.
  Não altera R-184, R-188, a RPC antiga, permissões existentes, dados históricos ou qualquer
  consumidor de UI.
- **Persistência/RPC:** adiciona `pagamentos.operacao_id` anulável, índice único parcial por
  `(clinica_id, operacao_id)` e `registrar_recebimento_orcamento_idempotente`. A RPC nova valida
  identidade, clínica, vínculo, perfil e papel; trava o orçamento; compara replay canônico; usa
  `orcamentos_com_estado.valor_devido`; e insere pagamento e log apenas na primeira execução.
  Conflito de chave não devolve dados da operação original.
- **Compatibilidade:** a RPC antiga continua intacta e acessível durante a janela de migração.
  Nenhum consumidor ainda chama a RPC nova, portanto não há janela de código apontando para uma
  função inexistente nem falsa alegação de idempotência nas telas atuais.
- **Fonte viva em leitura:** RPC antiga com MD5 `7dd39fba701e71ba8365231769fbc816`, grants
  `anon=false`, `PUBLIC=false`, `authenticated=true`; `pagamentos.operacao_id` ainda não existe
  no ambiente vivo. Nenhuma escrita foi feita.
- **Validação estática — PASSA:** `static-r189-contract` confirmou coluna anulável, índice parcial,
  guarda interna, lock, replay/conflito, contenção de `unique_violation`, cálculo canônico, log e
  grant exclusivo para `authenticated`; `git diff --check` passou.
- **Gates:** R189-01 a R189-08 estão **NÃO TESTADOS**. O banco local não está disponível em
  `127.0.0.1:54322`, e não foi criado banco isolado. Não aplicar esta migration nem testar falha,
  concorrência ou escrita sobre dados reais.

### Limite e próxima etapa

O ciclo da chave aprovado para Paciente, Orçamentos, Financeiro e pagamento rápido não foi iniciado:
ele precisa migrar os quatro consumidores juntos para preservar a mesma `operacaoId` em timeout e
retry. Esse é o próximo marco, seguido do gate em banco isolado e somente depois da revogação final
da RPC antiga em migration separada.

**Reversão deste marco:** migration de avanço pode revogar a nova RPC e remover o índice somente
depois de confirmar que nenhum consumidor a usa; não remover `operacao_id` nem alterar pagamentos
históricos.

## Evidência de execução local — marco 2, consumidores — 2026-10-11

- **Consumidores migrados juntos:** `registrarPagamento`, delegação de Financeiro, Paciente,
  Orçamentos e pagamento rápido enviam `operacaoId` para
  `registrar_recebimento_orcamento_idempotente`. Nenhum caminho de recebimento manual em `src/`
  continua chamando a RPC antiga diretamente.
- **Ciclo da chave:** cada superfície cria UUID ao primeiro envio, preserva-o após exceção de
  transporte e mostra `Tentar novamente`; a nova chamada usa a mesma chave. Resposta definitiva
  de validação/conflito limpa a chave; sucesso também a encerra. A action só cria notificação de
  secretária quando `repetida=false`, evitando efeito duplicado no replay.
- **Pagamento rápido:** continua fechando previsão quando ela existe, como antes; quando delega
  ao recebimento manual do saldo, passa a mesma chave por intenção. R-189 não altera a RPC de
  confirmação de previsão.
- **Validações locais — PASSA:** `pnpm exec tsc --noEmit`, `static-r189-consumers` e
  `git diff --check`. ESLint focal concluiu sem erros e manteve 35 avisos preexistentes nos
  arquivos de tela/action.
- **Gates R189-01 a R189-08:** continuam **NÃO TESTADOS** ponta a ponta. A migration não foi
  aplicada e não há banco isolado local para testar replay, conflito, perda de resposta, log,
  notificação, concorrência ou reload. Não publicar sem os gates sintéticos da §8.

### Correção do gate de UI — 2026-10-11

- **Replay tabular:** `registrarPagamento` trata o retorno de `RETURNS TABLE` como lista e valida
  a primeira linha antes de ler `pagamento_id`.
- **Snapshot imutável:** Paciente, Orçamentos e Financeiro guardam o payload inteiro junto da
  `operacaoId` no primeiro envio. Retry usa esse snapshot, mesmo se valor, forma, data ou seleção
  visual forem alterados depois do resultado desconhecido.
- **Transporte:** a action classifica erros de domínio conhecidos como definitivos; demais erros de
  RPC/transporte retornam `retryable=true`, preservando intenção e exibindo `Tentar novamente`.
- **Pagamento rápido com previsão pendente — BLOQUEIO:** o retry pode chamar
  `confirmar_previsao_orcamento` sobre a próxima parcela após uma resposta perdida. Essa RPC está
  fora do escopo do R-189 (§9), portanto este marco não declara R189-08 PASSA e não tenta fingir
  proteção com `operacaoId`. É necessário item/contrato próprio para idempotência da confirmação
  de previsão antes de afirmar recuperação segura desse atalho.
- **Validações locais — PASSA:** `pnpm exec tsc --noEmit`, `static-r189-retry-contract` e
  `git diff --check`. Os gates de banco/UI publicados continuam **NÃO TESTADOS**.

### Ajuste de precedência do snapshot — 2026-10-11

- Retry agora consulta a intenção congelada antes de validar paciente, orçamento ou valor visuais;
  limpar/alterar o formulário após resultado indeterminado não bloqueia a repetição segura.
- O estado otimista de Orçamentos usa valor, forma e data do snapshot, nunca os campos visuais.
- Retorno RPC vazio sem erro é indeterminado (`retryable=true`) e mantém a chave.
- **Validação local — PASSA:** `pnpm exec tsc --noEmit` e `git diff --check`. Banco, replay e
  reload seguem **NÃO TESTADOS** até fixture isolada.

## 11. Gate dirigido do Auditor — marco 2 — 2026-10-11

**Parecer:** **NÃO PASSA** para integração/publicação. A RPC proposta passa na inspeção estática
de autorização, replay, conflito, saldo e serialização entre chamadas novas, mas os consumidores
não preservam o contrato observável em caso de sucesso ou resultado indeterminado.

Ambiente e limites: revisão estática do checkout compartilhado, documentação oficial do Supabase
para funções que retornam conjuntos e consultas somente leitura ao catálogo vivo
`zenfemoxvwerplrjgfqz`. A migration não foi aplicada, nenhuma RPC foi chamada e nenhum dado foi
escrito. Somente esta spec foi editada pelo Auditor.

### Achados confirmados

#### R189-A01 — resposta tabular é tratada como objeto e um pagamento confirmado vira erro

- **Classificação / severidade / confiança:** `CONFIRMED` · **S1** · alta.
- **Onde:** a RPC declara `RETURNS TABLE` e usa `RETURN QUERY` (migration, linhas 10–20, 103 e
  160), enquanto `registrarPagamento` converte `data` diretamente em um objeto e lê
  `pagamento.pagamento_id` (`actions.ts`, linhas 797–809), sem selecionar a primeira linha nem usar
  `.single()`.
- **Como reproduzir:** em banco isolado com a migration aplicada, registrar um recebimento válido
  por qualquer um dos consumidores do marco 2 e comparar resposta, pagamento e log persistidos.
- **Esperado:** a action extrai a única linha, retorna `{ id, repetida }` e a UI conclui a intenção.
- **Observado:** por contrato PostgREST/Supabase, função que retorna conjunto entrega uma coleção. O
  cast TypeScript não altera a forma em runtime; `pagamento_id` fica ausente, a action devolve erro
  após o commit e os formulários normais limpam `operacaoId` como se fosse falha definitiva.
- **Evidência:** duas validações independentes: definição SQL local; documentação oficial Supabase
  de funções que retornam data set, que usa `.single()` para obter uma linha. O caminho local não
  indexa `data[0]` nem encadeia `.single()`.
- **Impacto:** recebimento e log podem existir enquanto Paciente, Orçamentos e Financeiro mostram
  falha. Em pagamento parcial, nova tentativa com chave nova pode registrar um segundo recebimento.
- **Pode ser falso positivo?** Baixa chance. Só seria falso se este endpoint PostgREST tivesse uma
  transformação singular não declarada; não há `Accept: application/vnd.pgrst.object+json` nem
  `.single()` no cliente.
- **Teste que valida:** R189-01 pela action e pelas três superfícies, conferindo forma da resposta,
  mesmo ID, uma linha paga e uma chave preservada no retry.
- **Menor correção sugerida:** tratar `data` como array de uma linha e validar exatamente um item, ou
  ajustar o builder tipado para usar `.single()` antes de montar o resultado da action.

#### R189-A02 — o payload pode mudar enquanto a mesma chave representa resultado desconhecido

- **Classificação / severidade / confiança:** `CONFIRMED` · **S2** · alta.
- **Onde:** Paciente mantém apenas `pagOperacaoId` no catch (client, linhas 826–856), mas valor, data
  e forma continuam editáveis no modal (modal, linhas 1600–1647). Orçamentos faz o mesmo (client,
  linhas 473–529 e 1713–1756), inclusive permite trocar de orçamento sem limpar ou congelar a
  intenção. Financeiro preserva `recOperacaoId` (linhas 200–227), mas permite trocar paciente,
  orçamento, valor, data e forma (linhas 1015–1138). Fechar as superfícies também não reconcilia a
  intenção antes de reutilizar ou abandonar a chave.
- **Como reproduzir:** provocar uma exceção de transporte, alterar qualquer campo ou orçamento e
  pressionar `Tentar novamente`.
- **Esperado:** retry envia exatamente o payload original com a mesma chave; outra intenção só nasce
  após recarga/reconciliação.
- **Observado:** o estado guarda a chave, não o snapshot do payload. O retry envia valores atuais e
  a RPC responde `chave_idempotencia_reutilizada` se a primeira chamada foi confirmada.
- **Evidência:** setters dos campos permanecem ativos quando `ResultadoDesconhecido=true`; não existe
  snapshot `{ operacaoId, orcamentoId, valor, forma, data }` nem reset/reconciliação ao fechar ou
  trocar o contexto.
- **Impacto:** o botão prometido como retry deixa de reconciliar a operação original, produz conflito
  definitivo e força recuperação manual sem informar se o dinheiro já foi registrado.
- **Pode ser falso positivo?** Baixa chance; todos os handlers constroem o payload novamente a partir
  do estado mutável no clique seguinte.
- **Teste que valida:** teste de componente por superfície: lançar na primeira chamada, editar um
  campo e conferir que a segunda chamada ainda recebe o snapshot original ou que a edição fica
  bloqueada até reconciliar.
- **Menor correção sugerida:** persistir a intenção completa junto da chave e usar esse snapshot no
  retry; enquanto indeterminada, bloquear campos, troca/fechamento de contexto e oferecer uma ação
  explícita de recarga antes de descartar a intenção.

#### R189-A03 — pagamento rápido fica preso após exceção e não expõe retry

- **Classificação / severidade / confiança:** `CONFIRMED` · **S2** · alta.
- **Onde:** `handlePagamentoRapido` não possui `try/catch/finally` (Orçamentos client, linhas
  811–829). Uma rejeição interrompe antes de `setPagRapidoSaving(false)`; os botões ficam desabilitados
  pelas linhas 1226–1229/1822–1827. Um resultado `{ error }` resolvido também não é mostrado.
- **Como reproduzir:** no caminho rápido sem previsão aberta, fazer `registrarPagamentoRapido`
  rejeitar uma vez e observar os botões; alternativamente retornar erro de domínio.
- **Esperado:** estado de resultado desconhecido, botão `Tentar novamente`, mesma chave e mensagem de
  erro determinística quando aplicável.
- **Observado:** por fluxo estático, exceção mantém `pagRapidoSaving=true`; erro resolvido é ignorado.
  Não há estado ou texto de recuperação para esse atalho.
- **Evidência:** handler e propriedades `disabled`/label dos dois botões; não existe setter de estado
  indeterminado do pagamento rápido.
- **Impacto:** o atalho pode ter confirmado o recebimento, mas fica travado sem permitir reconciliar
  ou repetir com segurança até remontar a tela.
- **Pode ser falso positivo?** Baixa chance para rejeição. O efeito de commit perdido ainda depende do
  teste de transporte, mas o loading preso é determinístico.
- **Teste que valida:** mock da action rejeitando após a submissão; verificar loading encerrado,
  mensagem, chave preservada e retry com o mesmo UUID.
- **Menor correção sugerida:** envolver o handler em `try/catch/finally`, exibir o erro/estado
  indeterminado e manter a chave somente para o retry daquela intenção.

#### R189-A04 — retry do pagamento rápido pode quitar a parcela seguinte com a mesma intenção

- **Classificação / severidade / confiança:** `CONFIRMED` · **S1** · alta.
- **Onde:** quando existem parcelas pendentes, `registrarPagamentoRapido` seleciona a primeira e chama
  `marcarPagamentoPago`/`confirmar_previsao_orcamento` sem enviar `operacaoId` (`actions.ts`, linhas
  1402–1428). A chave só é usada no ramo sem parcela aberta, nas linhas 1441–1448.
- **Como reproduzir:** preparar duas parcelas pendentes, acionar pagamento rápido, deixar a primeira
  confirmação commitar e perder a resposta; repetir com a mesma `operacaoId`.
- **Esperado:** o retry reconcilia a mesma parcela e não produz outro efeito financeiro.
- **Observado:** por fluxo estático, a segunda execução relê o banco, encontra a segunda parcela como
  a primeira ainda pendente e a confirma. A mesma chave nunca chega à RPC desse ramo.
- **Evidência:** seleção renovada de `abertas[0]` a cada chamada; `marcarPagamentoPago` chama
  `confirmar_previsao_orcamento` apenas com pagamento, forma e data (`actions.ts`, linhas 673–693).
  O índice de `operacao_id` da migration protege inserts da RPC nova, não updates nessa RPC antiga.
- **Impacto:** uma única intenção pode virar dois recebimentos confirmados e reduzir o saldo duas
  vezes. É perda financeira direta e contraria R189-08.
- **Pode ser falso positivo?** Baixa chance. Depende apenas de haver ao menos duas previsões abertas e
  de a primeira resposta se perder depois do commit, cenário que R189 declara necessário suportar.
- **Teste que valida:** duas previsões sintéticas, fault injection depois do primeiro commit e retry
  com a mesma chave; conferir que somente a parcela original muda.
- **Menor correção sugerida:** este ramo também precisa de idempotência persistida vinculando a chave
  à parcela confirmada. Como §9 exclui `confirmar_previsao_orcamento`, há conflito de escopo: ou o
  planejamento inclui um wrapper/contrato idempotente para esse update, ou pagamento rápido com
  previsão sai formalmente de R189-08. Um `try/catch` apenas não corrige o duplo efeito.

### Achados não confirmados

#### R189-A05 — erro de transporte do PostgREST pode ser tratado como falha definitiva

- **Classificação / severidade / confiança:** `NEEDS_EVIDENCE` · **S1** · média.
- **Onde:** o contrato implementado por `registrarPagamento` não contém `ok`/`retryable`; qualquer
  `error` devolvido por `supabase.rpc` vira `{ error }` (actions, linhas 797–806). Os três formulários
  limpam a chave quando recebem esse resultado e só a preservam se a própria Server Action rejeitar.
- **Como reproduzir:** em ambiente isolado, confirmar o commit da RPC e interromper a resposta entre
  PostgREST e a Server Action, distinguindo esse caso da perda da resposta entre Next.js e navegador.
- **Esperado:** resultado indeterminado preserva chave e payload para replay.
- **Observado:** **NÃO TESTADO**. A forma de erro depende da camada onde a conexão for interrompida.
- **Evidência:** ausência do discriminante `retryable` previsto no §4 e tratamento uniforme de todo
  `error` retornado pelo cliente Supabase.
- **Impacto:** se a biblioteca devolver erro estruturado após commit, a UI descarta a chave e uma
  nova tentativa pode duplicar um pagamento parcial.
- **Pode ser falso positivo?** Sim; algumas falhas de rede podem rejeitar a Server Action e cair no
  catch que preserva a chave.
- **Teste que valida:** R189-04 com proxy/fault injection em cada fronteira de transporte.

### Falsos positivos e não bugs registrados

- **`FALSE_POSITIVE` — autorização depende da RLS:** a nova função é `SECURITY DEFINER`, mas valida
  `auth.uid()`, clínica ativa, vínculo ativo, perfil ativo, papel e relação com o orçamento antes de
  consultar replay ou dados financeiros. `search_path=''` e nomes de relações qualificados reduzem o
  risco de resolução indevida.
- **`FALSE_POSITIVE` — replay cria segundo log ou segunda notificação:** a RPC insere log somente
  depois do insert novo; replay retorna antes. A action chama `inserirNotificacao` apenas quando
  `repetida=false`. Isso **PASSA estaticamente**, sem prova de execução.
- **`FALSE_POSITIVE` — duas chaves novas ultrapassam o saldo entre si:** a linha do orçamento é
  travada antes do replay e do recálculo; duas chamadas desta RPC para o mesmo orçamento ficam
  serializadas. Concorrência com escritores de outros fluxos permanece **NÃO TESTADO**.
- **`NOT_A_BUG` — RPC antiga ainda executável neste marco:** a coexistência é a ordem de release
  aprovada. R189-07 só pode passar depois da migration final separada e autorizada.

### Cobertura e estado dos critérios

| Recorte | Estado | Evidência / limite |
| --- | --- | --- |
| Coluna anulável e índice `(clinica_id, operacao_id)` | **PASSA** estático | Migration linhas 3–8; não aplicada. |
| Autorização `SECURITY DEFINER` | **PASSA** estático | Identidade, clínica/vínculo/perfil ativos, papéis e responsável antes de replay. |
| Replay igual e conflito sem vazamento | **PASSA** estático | Compara ator, orçamento, valor em centavos, forma e data sob lock. |
| Saldo e duas chaves concorrentes na RPC nova | **PASSA** estático | `FOR UPDATE` no orçamento e recálculo posterior; execução concorrente não realizada. |
| Pagamento + log atômicos | **PASSA** estático | Mesma função/transação, sem captura que preserve insert parcial. |
| Notificação no máximo uma vez | **PASSA** estático | Condicionada a `repetida=false`; entrega funcional não foi testada. |
| Forma da resposta na action | **NÃO PASSA** | R189-A01: coleção tratada como objeto. |
| Chave e payload em resultado indeterminado | **NÃO PASSA** | R189-A02 e R189-A05. |
| Nova intenção após recarga/reconciliação | **NÃO PASSA** | As superfícies permitem alterar/abandonar contexto mantendo só a chave, sem snapshot/reconciliação. |
| Paciente | **NÃO PASSA** | Resposta incorreta e payload mutável durante retry. |
| Orçamentos | **NÃO PASSA** | Mesmos dois defeitos; pagamento rápido também falha em recuperação. |
| Financeiro | **NÃO PASSA** | Mesmos dois defeitos por delegar à action canônica e manter formulário editável. |
| Pagamento rápido | **NÃO PASSA** | R189-A03 e R189-A04; o ramo de previsão ignora a chave e conflita com R189-08/§9. |
| Preservação R-188 | **PASSA** estático | Migration R-189 não toca `gerar_parcelas_orcamento`; catálogo vivo mantém MD5 `b05d239c7cb52339e6fa7e3de33e22e8`. |
| Preservação R-193 | **PASSA** estático | Alterações de teclado permanecem no checkout; nenhum fluxo foi exercitado neste gate. |
| Compatibilidade viva | **PASSA** para o marco aditivo | Vivo ainda não possui coluna/RPC nova; RPC antiga mantém MD5 `7dd39fba701e71ba8365231769fbc816` e somente `authenticated` entre os papéis públicos consultados. |
| R189-01 a R189-08 ponta a ponta | **NÃO TESTADO** | Migration ausente no banco e nenhuma escrita autorizada. |
| Typecheck independente do Auditor | **NÃO TESTADO** | `pnpm exec tsc --noEmit` não iniciou porque `node` não está no PATH deste processo. |
| Formatação/diff | **PASSA** | `git diff --check` sem erros no recorte. |

### Próxima ação

1. Corrigir primeiro R189-A01 e cobrir a forma real da resposta com teste da action; sem isso, todo
   recebimento novo é confirmado no banco e reportado como falha.
2. Modelar a intenção indeterminada como snapshot imutável nas três superfícies e adicionar
   recuperação equivalente ao pagamento rápido; tratar separadamente erro definitivo e transporte.
3. Depois executar R189-01 a R189-06 e R189-08 em banco isolado, incluindo perda de resposta. A
   revogação da RPC antiga e R189-07 continuam como etapa final separada e autorizada.

### Integração após a revisão — Coordenação, 11/10/2026

O parecer acima descreve o diff lido pelo Auditor antes das correções seguintes. No
checkout atual, a Action lê a primeira linha do array da RPC (`R189-A01`), classifica
erros de domínio versus resultado indeterminado (`R189-A05` em nível de contrato), e
Paciente, Orçamentos e Financeiro conservam o snapshot completo no retry (`R189-A02`).
Validação posterior: `pnpm typecheck` **PASSA**, teste focal `hora-brt` **PASSA**,
ESLint nos consumidores **PASSA sem erros** (35 avisos no recorte), `git diff --check`
**PASSA**. Nenhum desses checks prova replay ou persistência; R189-01–08 permanecem
**NÃO TESTADO** ponta a ponta.

`R189-A04` segue **NÃO PASSA**: o pagamento rápido com parcela pendente usa a RPC de
confirmação sem chave; o risco de confirmar a parcela seguinte no retry foi separado
em [R-194](R-194-confirmacao-parcela-idempotente.md). A contenção desse ramo antes de
publicar permanece pendente. O teste de transporte de `R189-A05` e o gate funcional
dos demais ajustes também continuam **NÃO TESTADO** sem banco isolado. Não aplicar a
migration R-189 nem publicar consumidores como se o fluxo inteiro estivesse aprovado.
