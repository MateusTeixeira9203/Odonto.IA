# Estado — Odonto.IA

STATUS: ACTIVE
OWNER: Coordenação do Odonto.IA
LAST_REVIEWED: 2026-10-12
REPLACES: estado de 24/09/2026 trazido pela baseline Git
CANONICAL_FOR: foco atual, bloqueios e decisões pendentes

## Agora

Prioridade: estabilizar o core antes de ampliar gestão. [Produto](../docs/PRODUTO.md),
[governança](../00_FONTE_DA_VERDADE.md) e [README](../README.md) estão alinhados.
Branch candidata `codex/baseline-producao-v2` nasceu de `ba5b531`, SHA conciliado
com deploy/main no M0. Código, migrations e evidências foram separados em commits;
isso não é merge nem deploy. O schema vivo ainda não é reproduzível pela fonte local.

[R-188](specs/R-188-autorizacao-financeira-rpc.md): migration autorizada aplicada
em produção; RPC passou com dois usuários QA e preservou dados na negativa. Action
e UI continuam locais/não testadas no site publicado.

[R-182](specs/R-182-baseline-verificavel.md) permanece **aberto**. Na
[auditoria ampla](auditorias/2026-10-11-auditoria-ampla-inicio.md), leitura direta
isolou duas clínicas e o protético; [entrada QA](auditorias/2026-10-11-R-182-entrada-isolamento.md)
validou erros básicos e cadastro persistido, mas o aviso de nome repetido ficou
inconclusivo na UI. [Jornadas clínicas QA](auditorias/2026-10-11-R-182-M3-papeis-clinicos.md)
passaram nos recortes de Ficha por Meu Dia/perfil, encaminhamento entre dentistas,
orçamento e pedido/entrega protética. O dentista QA ainda não percorreu o site
publicado por bloqueio de billing; localhost usa o banco de produção.

[R-193](specs/R-193-acesso-teclado-acoes-centrais.md) e
[HID-01/R-129a](specs/R-129a-performance-hidratacao.md) passaram em gates locais,
mas a versão publicada ainda falha teclado/hidratação. A
[isenção QA de billing](handoffs/2026-10-11-qa-billing-isencao.md) passou localmente
com billing ligado e a variável foi criada na Vercel Production; o deploy ativo
ainda não inclui esse código. Preservar a allowlist secreta existente.

[R-184](specs/R-184-previsao-aprovacao-parcial.md),
[R-189](specs/R-189-recebimento-idempotente.md) e
[R-194](specs/R-194-confirmacao-parcela-idempotente.md): migrations **aplicadas no
Supabase de produção** em 12/10, nas versões `20261012034818`, `20261012034837` e
`20261012034858`. Gates diretos com contas/dados sintéticos passaram para aprovação
parcial, replay, conflito de chave, confirmação de previsão e saldo pela secretária.
No localhost, recebimento manual e confirmação explícita passaram com persistência e
recarga. [Evidências e limites](auditorias/2026-10-12-financeiro-migrations.md).
O deploy Vercel `ba5b531` ainda usa o código antigo: o formulário publicado não envia
`operacao_id`, e a RPC antiga de recebimento permanece executável para compatibilidade.
O atalho R-194 está em rota que redireciona, sem gate de UI navegável. Concorrência
real, falha de transporte e restore completo seguem **NÃO TESTADO**. R-146 segue
congelado; R-190/R-191 são riscos prováveis, sem ensaio funcional.

## Bloqueios e próximos gates

- Primeiro gate amanhã: auditoria de uso com QA B para Ficha por Meu Dia/perfil,
  orçamento, secretária → dentista → protético, recebimentos, reload, negativas,
  teclado e mobile. Registrar PASSA/NÃO PASSA/NÃO TESTADO por ambiente. Sem deploy,
  o site publicado continuará sem as correções locais de UI/Action.
- Testes clínicos usam só contas/dados sintéticos da clínica QA B; nunca a
  portaria real da Clindent. Nenhum teste destrutivo, de carga ou falha em produção.
- [Branch QA sem dados](auditorias/2026-10-11-qa-branch-schema.md) falhou no replay
  de `001_core_tables.sql` (policy referencia `dentistas` antes da tabela).
  Foi apagada. [Diagnóstico schema-only](auditorias/2026-10-11-schema-only-diagnostico.md)
  propõe uma baseline de definições, sem dados reais, para testar restauração;
  o restore completo ainda segue NÃO TESTADO apesar dos gates dirigidos no banco vivo.
  A conexão local não contém senha do banco, e o usuário não a tem agora;
  não redefinir a senha para destravar QA.
- Para fechar R-182: cumprir AC-02–10 completos, corrigir S1 e regressões,
  publicar versão autorizada e repetir os fluxos afetados no site, demonstrar
  recuperação/restore e colher revisão do usuário. Mudança local não comprova
  a estabilidade da versão em uso.

## Preservação e integração

Worktree anterior `codex/preservacao-pre-baseline-v2@41d0a83` em
`/home/mtx/.codex/worktrees/odonto-preservacao-v2/Odonto.IA`: preservar e
reconciliar por item; não reaplicar o lote. Governança, README, produto, specs e
auditorias V2 estão na branch candidata. Coordenação integra os chats `arquiteto`,
`Implementar`, `Auditor` e `Curador`, que compartilham o checkout.
