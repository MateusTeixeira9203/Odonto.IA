# R-182 — diagnóstico de schema-only reproduzível

STATUS: EVIDENCE
OWNER: Curador de Documentação
LAST_REVIEWED: 2026-10-11
CANONICAL_FOR: diagnóstico de drift e sequência proposta para um ambiente schema-only descartável

## Escopo e limite

Leitura do repositório, do ledger e catálogo do projeto publicado `zenfemoxvwerplrjgfqz`.
Nenhuma migration, branch, fixture, restauração, código, dado ou configuração foi alterado.
Este documento não autoriza reconstrução nem substitui o contrato [R-182](../specs/R-182-baseline-verificavel.md).

## Fatos verificados

| Item | Resultado | Evidência |
| --- | --- | --- |
| Schema vivo | 78 tabelas públicas, 109 funções, 89 policies, 72 triggers de usuário, 304 índices, 1 view; a leitura complementar contou 238 chaves estrangeiras públicas. | Catálogo M0: `evidencias-2026-10-11-R-182-M0/catalogo-sanitizado.json:11-17`; consulta somente leitura de 11/10. |
| Ledger vivo | 171 migrations registradas, de `001/core_tables` a `20261011210438/r188_guardar_autorizacao_gerar_parcelas`. | `list_migrations` somente leitura de 11/10. |
| Fonte local | Há 183 arquivos em `supabase/migrations/`. A quantidade maior não demonstra equivalência: nomes e versões não são uma relação um-para-um com o ledger. | Inventário local de 11/10. |
| Lacuna objetiva | As seis migrations vivas `r181_*` (`20260925120000` a `20260925125000`) não têm arquivo correspondente em `supabase/migrations/`. | Ledger vivo e busca local por `r181`. |
| Dependências faltantes | O catálogo vivo contém objetos de governança, estoque e apoio financeiro sem SQL criador suficiente na `main`; R-181 é prova pontual, não uma lista exaustiva. | [M0-C05](2026-10-11-R-182-M0-conciliacao.md#M0-C05--a-fonte-de-migrations-da-main-não-representa-o-schema-vivo):103-116. |
| Tentativa QA | A branch `qa-r182-financeiro-20261011` chegou saudável, mas tinha zero tabelas públicas e ledger vazio; foi apagada sem SQL, dados ou fixtures. | [Tentativa QA](2026-10-11-qa-branch-schema.md):8-27. |

## Por que a branch sem dados não serviu

**Fato:** excluir dados não deveria excluir DDL. A branch ficou sem tabelas, funções-base, view e ledger; portanto ela não recebeu o schema/histórico necessário à aplicação. Saúde de compute e funções não demonstra clone de schema.

**Hipótese mais forte, após consultar a documentação oficial em 11/10:** o replay do histórico de migrations não reconstruiu o schema vivo. A Supabase explica que Branching 2.0 cria a branch a partir das migrations, não de um dump do schema, e que histórico incompleto ou falha no replay pode deixar a branch vazia ou parcial. A divergência entre migrations e catálogo vivo neste projeto é fato; a etapa exata que falhou na branch apagada não foi observada. Ver [branches vazias](https://supabase.com/docs/guides/troubleshooting/new-branch-doesnt-copy-database) e [MIGRATIONS_FAILED](https://supabase.com/docs/guides/troubleshooting/branch-in-migrations-failed-status).

**Não verificado:** os logs do workflow da branch apagada não foram preservados; não há prova da statement ou etapa exata que falhou. Não repetir a criação como diagnóstico sem antes escolher o caminho schema-only abaixo e seus critérios de equivalência. A orientação da Supabase para `migration repair` altera o histórico remoto; não executá-la como atalho sem reconciliar o schema e revisar seus efeitos.

### Segunda branch diagnóstica — 11/10/2026

Com a autorização vigente para branch temporária sem dados reais, foi criada
`qa-r182-schema-diagnostico-20261011` (ID `7e1d1cba-eaa5-4f8c-9316-cd8ea56c0306`,
ref `spliogdjbaktvzusipkt`, `with_data=false`). **Fato confirmado:** status
`MIGRATIONS_FAILED`. O log Postgres da branch em `2026-10-11T23:22:06.432Z` mostra a
primeira migration `001_core_tables.sql` tentando executar
`CREATE POLICY clinicas_select_policy ... SELECT clinica_id FROM dentistas ...` antes de
criar `dentistas`; erro `relation "dentistas" does not exist`. O arquivo local
`supabase/migrations/001_core_tables.sql` mantém a mesma ordem (política nas linhas 27–29,
tabela `dentistas` a partir da linha 39). Esta é a causa imediata demonstrada do replay
interrompido. Migrations posteriores podem ter outras lacunas; nenhuma foi testada.
Nenhum SQL, fixture ou dado de produção foi aplicado à branch.
A branch foi removida após capturar a evidência; `list_branches` voltou a mostrar somente `main`.

## Sequência mínima proposta — somente após autorização própria

1. Capturar do banco publicado um artefato **somente de definição** em modo leitura: tabelas, tipos, constraints/FKs, índices, funções, views, triggers, RLS/policies, grants e extensões necessárias. Não incluir linhas, Storage, secrets, tokens ou dados de `auth`.
2. Congelar o artefato com checksum e manifesto de origem (projeto, horário, versão de Postgres e catálogo). Ele é baseline de recuperação; não falsifica nem reescreve o ledger histórico de produção.
3. Em projeto descartável novo, aplicar esse baseline schema-only uma vez, em sequência controlada de dependências. Não aplicar a pasta atual de migrations até a reconciliação, pois ela não reproduz o schema vivo.
4. Comparar o alvo vazio ao manifesto: catálogo completo e fingerprints/definições dos objetos críticos, RLS/policies e grants. Contagens iguais são gate necessário, mas insuficiente; qualquer diferença deve virar uma lacuna explícita.
5. Só após equivalência, inserir fixtures sintéticas mínimas e executar R-184/R-189/R-194. Não copiar pacientes, financeiro, autenticação ou dados clínicos reais. Repetir os gates por API/UI e persistência; o ambiente schema-only não prova produção.
6. Converter a reconciliação validada em fonte versionada separada, com decisão explícita sobre estratégia de histórico (baseline único para bootstrap ou reconstrução cronológica). Não registrar a snapshot como se cada migration histórica tivesse sido reproduzida.

## Critérios antes de chamar o ambiente de reproduzível

- PASSA: baseline aplica num banco vazio sem ajustes manuais; catálogo e objetos críticos coincidem com o manifesto; RLS/policies/grants foram comparados; não há dado real.
- NÃO PASSA atual: a cadeia local de migrations não gera o schema vivo, e a branch QA anterior estava vazia.
- NÃO TESTADO: aplicação de snapshot schema-only, comparação de definições completa, fixtures sintéticas e os gates financeiros isolados.

## Riscos a preservar

Um `pg_dump`/export de schema é um artefato de recuperação, não prova que políticas, owners, grants ou funcionalidades foram restaurados corretamente; esses aspectos exigem comparação dirigida. Nunca aplicar o baseline schema-only no projeto publicado nem marcar migrations antigas como executadas para “alinhar” o ledger. A criação de um novo projeto/branch pode ter custo recorrente e exige autorização específica.
