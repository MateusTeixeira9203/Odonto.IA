# R-157 — validação local, 09/09/2026

Contrato: [spec R-157](../specs/R-157-financeiro-orcamento-por-grupos.md).
Este registro não é auditoria completa nem aprovação para produção.

## Evidências concluídas

- TypeScript completo (`tsc --noEmit --incremental false`) passou. O build pula typecheck
  pela configuração já existente; por isso o comando foi executado separadamente.
- ESLint nos arquivos alterados de financeiro/orçamento passou; `git diff --check` limpo.
- Build Next webpack passou (64 páginas estáticas; rotas dinâmicas compiladas).
- 16 testes unitários de financeiro/orçamento passaram: caixa 100 manual + 200 pago − 50 = 250,
  cancelado 500 excluído, centavos, grupos, composição/documento, schemas, meses e hora estimada.
- `scripts/tests/r157-grupos-sql.mjs` aplica SQL real em PostgreSQL local via PGlite:
  dois grupos 15 mil, total 30 mil, eventos únicos e composição íntegra; criação/adicionar grupo;
  erro não deixa orçamento parcial; fonte de outra Ficha/catalogo rejeitada; quantidade/preço
  inválidos rejeitados; aprovação, nota Unicode/quebra de linha e limite de 2000 caracteres;
  receber 5000 superior deixa 10000 e preserva inferior15000; sobrepagamento rejeitado;
  correção para4000 recompõe11000; estorno recompõe15000; snapshot inclui componentes.
- Mesmo teste SQL exercita permissões por contexto de clínica/dentista/secretária **simulado**.
  Não usa logins reais, policies completas, PostgREST nem todos os triggers da produção.
- NovoOrcamentoModal real em fixture local: seleção inválida, montar superior/inferior,
  preço único, total30000, desfazer sem perder componentes, composição visível e rascunho
  mantido diante de erro simulado. Light/dark,390/1440px; modal dentro do viewport estabilizado.
- Componente CobrancasPorEtapa extraído do código atual para fixture: observação existente
  renderizada; nova nota enviada com item inferior; falha de rede mantém campos e libera botão.
- FinanceiroClient real com props/actions simulados:12 pendências visíveis, saldo/extrato
  atualizados por novas props, valores/gráfico ocultos em privacidade,390px light/dark.
  Exercitado nos perfis dentista e secretária. Overflow dos controles foi encontrado e corrigido.

## Como repetir os testes mantidos no projeto

```sh
node node_modules/tsx/dist/cli.mjs --test src/lib/financeiro/*.test.ts src/lib/orcamentos/*.test.ts
PGLITE_MODULE_PATH=/caminho/@electric-sql/pglite/dist/index.js node scripts/tests/r157-grupos-sql.mjs
node node_modules/typescript/bin/tsc --noEmit --incremental false
node node_modules/next/dist/bin/next build --webpack
```

PGlite0.5.8 foi instalado somente em `/tmp/r157-qa`, sem dependência nova do produto.
Fixtures de navegador e capturas desta execução ficam em `/tmp/r157-browser` (temporárias).
Dados fictícios; servidor local3187. As actions foram simuladas; não equivalem a E2E autenticado.

## Supabase online — autorização e preservação, 09/09

Usuário autorizou o ambiente online atual e dados fictícios na clínica de teste, por não ter
homologação. Reforçou a proibição de perda de dados de usuários.
Migração `20260909030656_r157_grupos_acordo_cobranca.sql` aplicada atomicamente (DO, lock timeout3s).
Objetos conferidos no schema, não apenas histórico de migrations; novas colunas são nullable.
Contagem e hash de todos os campos preexistentes ficaram idênticos imediatamente antes/depois:
Orçamentos, itens, cobranças, pagamentos, fichas e pacientes foram conferidos.
Isso antecede as inserções fictícias da QA; não significa que a contagem continuará igual após testes.
Definições antigas das funções conferidas antes da aplicação. Reversão funcional preservando dados:
`scripts/tests/r157-reverter-funcoes.sql` (preparada, não executada). Nenhuma policy/role alterada.
Advisors mantêm alertas preexistentes; duas novas RPCs autenticadas aparecem como exposição
security-definer esperada, dependente das guardas internas verificadas nos testes de autorização.

Clínica QA autorizada, três contas fictícias A/B/S,
dois pacientes e oito eventos fictícios. Nenhuma clínica de cliente foi usada para mutações.
Credenciais temporárias em arquivo privado fora do repositório; não há envio de email/WhatsApp.
App em localhost3100, Supabase real; isenção de billing restrita à clínica QA no processo local.

Evidências autenticadas já concluídas:
- Três logins reais via anon SDK; A/B não leem orçamento um do outro, secretária lê ambos.
- UI Ficha A: montar dois grupos15mil; salvar e reabrir preserva os quatro componentes.
- Aprovar somente superior e criar cobrança15000 com nota Unicode/quebra de linha persistida.
- Secretária no Financeiro registra5000 nessa cobrança: extrato5000, saldo da etapa10000.
- Documento real mostra grupo aprovado, componentes e preço15000 com preço individual oculto.
- QA encontrou seleção de responsável do formulário alterando filtro sem refazer a consulta;
  corrigido e repetido no novo build: filtro continua “Todos os dentistas” após trocar responsável
  e fechar formulário. Seletores agora mostram nomes; campos financeiros têm nomes acessíveis.
- Recebimento B:5000 → correção4000 → estorno; saldo volta7500 e motivo/histórico preservados.
  Legado B separado aparece junto da etapa no seletor; recebimento legado200 pela UI funciona.
- A→B e B→A com IDs válidos retornam sem_permissao; outra clínica QA retorna zero linhas;
  RPC_r157 sem login é negada. Nota2001 chars rejeitada sem alterar composição/eventos.
- Aceite fictício B: snapshot contém apenas grupo aprovado e composição de2 procedimentos.
- UI secretária cria entrada100 e saída50 para A: extrato5000+100−50=5050 sem reload manual.
  Filtro B mostra só pagamento legado200; estornado4000 não entra. Reabrir Ficha A mostra
  etapa parcial5000/saldo10000 e observação original. Eventos continuam na Ficha.
- Actions reais via HTTP autenticado: CSV A/B isolado; A receita5100/despesa50/saldo5050,
  B receita200/despesa0; série termina no mês selecionado (incluindo agosto).
  Receita com valor0/data inválida/responsável externo rejeitada; exclusão de ID inexistente
  retorna erro; sem grade retorna custo/hora indisponível. Nenhuma exclusão válida executada.
- Build webpack final, tsc e lint passaram após ajustes;16 testes unitários passam.
  Navegador sem erros de console no trecho final; light/dark e privacidade do extrato conferidos.
- Limite: viewport390 solicitado ao navegador integrado não foi aplicado (DOM permaneceu972px).
  Mobile390 tem evidência de fixture anterior, não E2E online desta sessão.

## Pendências que impedem declarar pronto para produção

1. Conferência final mobile390 no app integrado (fixture já testada); auditoria dos reviewers
   exigidos pelo projeto antes de commit/merge. Terra revisou pontualmente a correção de filtro.
2. Publicação autorizada em recorte isolado; aplicação das colunas não equivale a deploy do app.

Roteiros online desta sessão (temporários, sem credenciais no repositório):
`/tmp/r157-online/api-checks.cjs`, `receipt-checks.cjs`, `server-checks.cjs`.
Resultados/API IDs em `receipt-results.json`; CSVs de teste em `csv-A.csv` e `csv-B.csv`.
Métricas QA restritas ao roteiro exercitado: achado de filtro HIGH corrigido, seletor UUID MEDIUM
corrigido; pontuação78→100/A apenas nesse roteiro, não estabilidade global nem gate de release.

Aplicativo R-157 ainda não publicado. Outras frentes do checkout não foram validadas por este
relatório. Não promover R-157 a concluído/no ar por esses testes.

## Candidato de preview

Usuário autorizou commit/push apenas preview. Branch `codex/r157-financeiro-orcamento-preview`,
base `19ad94f` (mesma versão do app atualmente em produção). Recorte isolado de R-157;
223 testes da suíte passaram nesta base. Segredos/fixtures de login não entram nos commits.
A migração já está aplicada no banco compartilhado; nenhuma nova aplicação remota neste push.

Revisões técnica/UX concluídas, sem CRITICAL/HIGH restantes no recorte. A revisão técnica achou
terminadores ausentes no script de reversão; corrigidos antes do commit. O teste PGlite agora
executa o rollback e compara integralmente propostas, itens, cobranças, pagamentos e assinaturas:
sem diferenças de dados. Typecheck com heap4GB e build63rotas passaram no candidato isolado.
Smoke autenticado no candidato3200: Ficha abre, orçamento por grupos e nota são carregados.
A auditoria UX usou diff e capturas; limitações de mobile integrado permanecem explícitas.
