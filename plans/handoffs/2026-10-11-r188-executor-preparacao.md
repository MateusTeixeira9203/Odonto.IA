# HANDOFF — R-188 / preparação local da correção

STATUS: ACTIVE
OWNER: Coordenação → chat Implementar, após aval de delegação
LAST_REVIEWED: 2026-10-11
REPLACES: despacho histórico de 10/10 no acervo preservado, conciliado com o M0
CANONICAL_FOR: passagem da preparação local R-188; contrato no item

## 1. Identificação

- Tarefa: R-188, guarda de autorização em RPC financeira.
- Área: Executor; Coordenação integra; Auditor já entregou M0.
- Estado: READY_FOR_REVIEW — preparação local entregue, gate funcional pendente.
- Checkout compartilhado: `/home/mtx/Documentos/Odonto.IA`.
- Branch: `codex/baseline-producao-v2`, HEAD `ba5b531164c2983b991de27a96f94668fbb7ebda`.
- Data: 11/10/2026. Modelo recomendado pelo mapa 16: GPT-5.6 Terra; escalar só impasse específico.

## 2. Objetivo

Preparar localmente uma migration restrita à guarda da função de parcelas e o alinhamento
da Server Action, preservando cálculo/assinatura/retorno. Entregar código revisável e
evidência do que pôde ser verificado sem alterar o banco em uso.

## 3. Contexto mínimo

Usuário rejeitou suspender a RPC para todos. M0 confirmou função vulnerável publicada
com fingerprint `e21635ef4526004ad5cb1c26e0191e98`; exploit sintético anterior e
catálogo atual estão no relatório. O banco vivo não coincide com a fonte reconstruível da main.
O corpo ativo foi lido via `pg_get_functiondef` em 11/10 e corresponde à migration 123 na
parte relevante; reconferir ao preparar o SQL e antes de eventual aplicação autorizada.

## 4. Fonte de verdade utilizada

- Contrato único: [R-188](../specs/R-188-autorizacao-financeira-rpc.md).
- Evidência atual: [M0](../auditorias/2026-10-11-R-182-M0-conciliacao.md).
- Regras: [AGENTS](../../AGENTS.md), [00](../../00_FONTE_DA_VERDADE.md),
  [05](../../05_AUDITORIA_E_ESTRESSE.md), [07](../../07_REGRESSAO_E_TESTES.md).
- Referência técnica de origem: `supabase/migrations/20260730161500_123_gerar_parcelas_considera_ja_pago.sql`.
- Nenhum artefato visual.

## 5. Decisões tomadas

Guardar autorização na RPC antes de leitura de plano, escrita ou retorno. Admin/dentista
somente orçamento próprio; secretária ativa pode operar na clínica conforme regra vigente.
Membership e perfil devem estar ativos. Não ampliar permissões da futura clínica gerida.

## 6. Fora de escopo

R-184 cálculo, R-189 retry, outros helpers/RLS, mudança de schema de tabelas, novas regras
de produto, redesign, dados reais e execução de migration em qualquer banco. Sem commit,
push, deploy, chamadas pagas ou escrita de QA neste despacho.

## 7. Posse de arquivos

- Executor: nova migration específica R-188 em `supabase/migrations/`;
  `src/app/dashboard/orcamentos/actions.ts`; testes focais proporcionais; resultados no R-188.
- Coordenação: `plans/ESTADO.md`, índices, integração e revisão do handoff.
- Auditor: relatório M0 existente, somente referência; não editar.

Não está sozinho no checkout. Preservar documentos e edições de outros; não limpar, resetar
ou copiar a branch de preservação em lote. Se precisar de outro arquivo, justificar antes.

## 8. Banco / schemas / APIs

Assinatura a manter: `gerar_parcelas_orcamento(uuid,smallint,date,numeric,numeric,text,text)`;
retorno `SETOF public.pagamentos`, negativa `sem_permissao`. Manter grants intencionais.
O PATH padrão não contém `node`, `psql`, `docker` ou Supabase CLI. Runtime empacotado:
`/home/mtx/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node`.
Verificar o CLI e usar `supabase migration new` antes de nomear a migration. Não aplicar SQL
ao banco para contornar ausência de ferramenta.

## 9. Critérios de aceite

Usar os critérios do R-188, sem checklist concorrente. A guarda deve negar terceiro da
mesma clínica, outra clínica, vínculo/perfil inativo e papel indevido sem revelar dados ou
alterar parcelas. Titular e secretária autorizados preservam o comportamento vigente.

## 10. Testes executados

Preparação do handoff: leitura do SQL publicado e catálogo, sem teste mutante.
Executor informa por critério PASSA/NÃO PASSA/NÃO TESTADO, ambiente, evidência e limites.
O gate de duas identidades com fixture nova não está autorizado neste despacho e exigirá
ambiente/efeitos delimitados. Typecheck não prova autorização.

## 11. Problemas conhecidos

Não há branch Supabase isolado; fixtures antigas já têm plano. Schema drift impede assumir
que migrations antigas reconstroem o banco atual. Chamada de `npm exec` no PATH padrão falhou
porque `node` não foi encontrado; isso não demonstra indisponibilidade do runtime empacotado.

## 12. Riscos de regressão

Bloquear titular ou secretária, alterar cálculo R-184, mudar grants amplamente, aceitar
papel pelo cliente ou devolver `plano_ja_definido` antes da negativa a orçamento alheio.
Rollback não pode restaurar o corpo vulnerável. O R-146 já sofreu uma tentativa local
com regressão e segue congelado; não retomar esse item por proximidade. Se a guarda R-188
falhar num requisito central ou o mesmo defeito reaparecer, preservar a reprodução, parar
após no máximo duas tentativas automáticas e devolver hipótese/decisão, sem remendos em loop.

## 13. Próxima ação exata

Chat Implementar lê R-188 e verifica runtime/CLI. Compara a função ativa com a
origem local; cria migration restrita, ajusta Action e testes focais. Entrega diff, verificação
local e impedimentos para gate. Para antes de aplicar no banco ou ampliar escopo; a
Coordenação decide o próximo passo com base no resultado.

## 14. Não fazer

Não executar a suspensão rejeitada, não aplicar migrations antigas em lote, não enviar
mensagens a outros chats, não alterar Estado, não tratar exploração antiga como gate novo.

## 15. Estado da documentação

R-188 reconciliado no checkout atual. Implementar entregou migration e ajuste focal na
Action; resultados e limites estão na spec. A Coordenação revisou o diff, confirmou ordem
da guarda e preservação do cálculo, conferiu por leitura agregada que não há divergência
atual entre papéis de vínculo/perfil ativos, e retirou somente a alteração temporária
`supabase/.temp/cli-latest` causada pela CLI. `git diff --check` passou. Nenhum gate
autenticado foi feito: a correção está preparada localmente, não aplicada nem verificada.
