# R-202 — resumo técnico de publicação

STATUS: ACTIVE
OWNER: Coordenação
LAST_REVIEWED: 2026-10-15
CANONICAL_FOR: registro público sanitizado da publicação R-202; não substitui o contrato local

## Alteração e preservação

O salvamento do odontograma podia exceder o limite de oito segundos após a Ficha
persistir. Duas consultas de `salvar_eventos_odontograma` percorriam eventos em
excesso sob RLS: a checagem de conflito e o UPDATE do encaminhamento, inclusive
quando `encaminhado_para` era explicitamente null.

A migration `20261015234425_r202_otimizar_guard_eventos_odontograma.sql` restringe
essas consultas aos IDs recebidos. Preserva assinatura, owner, SECURITY INVOKER,
search_path, ACL, RLS e regras de negócio. Não executa DML durante a aplicação.
SHA256: `eaf78fa9824782830c7040910eff281c311684b43a334d7f562b5a8e03d0c064`.

Não houve mudança da aplicação. A migration foi aplicada isoladamente em produção
em15/10/2026, antes deste registro Git; não reaplicar indiscriminadamente todas as
migrations pendentes. Definição publicada foi comparada à candidata revisada.

## Verificação e limites

- Laboratório schema-only PostgreSQL17.11, GoTrue/PostgREST locais e dados sintéticos.
  Duas identidades e clínicas distintas; nenhum dado real copiado.
- Auditor independente: PASSA para RPC completa com12.004 eventos (89,480ms),
  atualização com encaminhamento null (458,951ms), Perfil, Meu Dia, falha parcial,
  retry, recarga, edição, negativas, isolamento, concorrência e catálogo.
- Duas chamadas concorrentes com mesmos IDs mantiveram uma Ficha e um evento.
  Fichas assinadas, eventos retirados e contextos incompatíveis foram rejeitados
  sem efeito parcial. Anônimo não executou a função.
- Harness SQL cobriu sincronização e preservação de eventos retirados. Rodar
  `scripts/run-r202-salvar-eventos-odontograma.sh` somente em laboratório descartável
  com schema equivalente, nunca em produção ou QA compartilhada.
- Pós-publicação com conta sintética: salvar HTTP204 em179,86ms e retry HTTP204
  em204,68ms; uma Ficha/um evento e conteúdo preservado na releitura. Logs confirmaram
  ambos204. Limpeza delimitada confirmada com zero resíduos.
- Comparação antes/depois preservou os registros reais examinados, ACL e policies.
  Isso não significa recuperação de conteúdo que nunca foi gravado.
- UI foi exercida no laboratório; produção teve gate representativo da RPC.
  Sem mudança TypeScript; typecheck do executor não rodou por ausência de tsc local.

Evidências detalhadas foram preservadas localmente. Este repositório é público:
prints clínicos, identificadores de pacientes, narrativas e credenciais não integram
este lote. Não se declara cobertura de todos os fluxos ou de qualquer carga futura.

## Decisão do usuário e passagem

Correção publicada e verificada. Em15/10, usuário autorizou commit/push e decidiu
que a dentista completará manualmente os registros em16/10. Nenhuma recuperação
automática, recriação de Ficha ou lançamento financeiro integra esta entrega.

Coordenação integrou Implementar e Auditor. Testes sintéticos e migration ficam
versionados separadamente deste resumo. Trabalhos de produto/design permanecem
fora do lote. A definição anterior foi preservada localmente para investigação;
não restaurar automaticamente o gargalo conhecido como reversão.
