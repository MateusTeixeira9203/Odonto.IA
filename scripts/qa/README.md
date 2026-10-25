# QA local · Odonto.IA

Execute no repositório principal. Os scripts só usam o **odonto-qa** (`uhuxteswtvgdnlixwrdu`), recusam produção e não mostram credenciais. Eles leem o ambiente apenas durante a execução; não abra nem cole arquivos `.env*` no chat. Logs e registros ficam em `.qa/`, ignorado pelo Git. Não há commit, push, deploy ou migração nestes comandos.

| Comando | Exemplo |
|---|---|
| Subir snapshot destacado | `npm run qa:snapshot-up -- --nome od017 --commit 5c0d8c3 --porta 3020` |
| Parar e remover snapshot limpo | `npm run qa:snapshot-down -- --porta 3020 --remover --nome od017` |
| Listar worktrees/portas/PIDs | `npm run qa:snapshot-list` |
| Verificações, sem esconder falhas conhecidas | `npm run qa:suite -- --dir od017 --com-build` (ou `npm run qa:suite` no principal, sem build) |
| Playwright, snapshot registrado no ar | `npm run qa:e2e -- --porta 3020 --pasta e2e/qa2 --escopo changed` |
| Ensaio de fixture, sem persistir | `npm run qa:fixture-apply -- --arquivo od017-smoke-seed.sql --ensaio` |
| Limpar a fixture | `npm run qa:fixture-clean -- --arquivo od017-smoke-cleanup.sql` |
| Conferir uma saída capturada | `npm run qa:checar-vazamento -- --saida .qa/saida.txt` |

Troque o SHA do exemplo pelo commit aprovado existente no seu clone e confirme uma porta livre com o Orquestrador. Mesmos nome/SHA/porta ativos retornam `JÁ NO AR`; não iniciam outro servidor. Portas aceitas: **3010–3029**; 3000, 3001 e 3002 são reservadas. `snapshot-down` sem `--remover` apenas encerra o servidor. Para remover: worktree destacado, limpo e pertencente ao clone; a junção é desfeita **sem recursão antes** de `git worktree remove`. Nunca use exclusão recursiva manual com `node_modules` dentro.

`qa:suite` sempre registra PASSOU/FALHOU nos cinco passos: tipos do app, tipos do e2e, lint, testes e descoberta Playwright. `--com-build` acrescenta build; não rode build do principal enquanto o servidor/equipe usa seu `.next`: use `--dir` para um snapshot. Exceções de lint/testes autorizadas continuam aparecendo como **FALHOU**; o operador compara o resultado ao contrato. Descoberta (`--list`) não é execução de testes.

`qa:e2e` define `QA_BASE_URL`, `MD_SCOPE` e contas fictícias em memória. Não habilita o guard `MD_RETEST_READY`: essa autorização continua com o operador. **Os roteiros devem ler porta de `QA_BASE_URL` e caminhos de variáveis/raiz do projeto.** O roteiro legado `e2e/qa2` ainda tem caminhos absolutos e portas 3012/3013 fixas; definir a variável não redireciona esse código. Combine a janela com o QA antes de executá-lo. A OD-017 não altera `e2e/**`. Saídas ficam mascaradas em `.qa/`; não são gravados cookies ou storageState pelos scripts.

Fixtures aceitam somente arquivos regulares de `supabase/tests/fixtures/`. Apply recusa `-cleanup.sql`; clean o exige. DDL, privilégios, SQL dinâmico e leitura de arquivos do servidor são recusados antes de conectar. Somente `QA_DB_URL` é lido da configuração de conexão; TLS verifica a identidade do servidor com `rejectUnauthorized: true` e a CA pública `supabase-ca.crt` (Supabase Root 2021 CA). Origem: [certificado público do Supabase](https://supabase-downloads.s3-ap-southeast-1.amazonaws.com/prod/ssl/prod-ca-2021.crt), SHA-256 `807025AD50D4ED219D2C9C7D299C004F824EB00CF7F65AFEF607D07B72E6CAFA`; não é uma chave privada. Para persistir o exemplo, repita sem `--ensaio`. Ensaio recusa arquivos com transação própria. Marcadores `<SENHA_QA_NOME>` exigem a variável `SENHA_QA_NOME` na sessão, substituída e escapada somente em memória.

Recusas têm saída **2** e código curto: FLAGS/NOME/COMMIT/PORTA (argumentos ou porta ocupada), HOST/ENV (ambiente incorreto), BRANCH/SUJO/JUNCAO (remoção insegura), SQL/FIXTURE/SENHA (fixture inválida). Falha de execução tem saída **1**; confira o log indicado. O detector de vazamento mostra somente a contagem e os nomes das variáveis; uma ocorrência também dá saída 1.

**Permissões do Codex:** o Cérebro configura fora do repositório as regras para os comandos nomeados `npm run qa:<nome>`. O texto `npm run qa:` é uma família de comandos, não uma garantia de que a política aceite esse prefixo parcial; o Cérebro deve conferir os oito nomes no ambiente. Scripts não editam permissões ou sandbox. [Node: spawn sem shell](https://nodejs.org/api/child_process.html#child_processspawncommand-args-options), [Node: unlink](https://nodejs.org/api/fs.html#fsunlinksyncpath), [pg: TLS](https://node-postgres.com/features/ssl).
