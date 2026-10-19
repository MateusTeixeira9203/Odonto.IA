# Código — auditoria dirigida

Base: `a1722c47c346a4a80c84ad6cd5efd0ee42afbf08`, confirmada no deployment.
Método: leitura dos caminhos selecionados + testes locais sem rede/banco; posteriormente,
reprodução dirigida de COD-01 pela interface da clínica QA em produção.
Não é revisão linha a linha de todo o repositório.

## Achados

### COD-01 — Receita manual ausente da série financeira — média

**CONFIRMADO localmente e reproduzido na UI de produção com dados QA.** `calcularSaldoMes` soma `pagamentos`
e `receitas_manuais`; `listarUltimosMeses` consulta somente pagamentos e despesas.
A página fornece essa série ao gráfico “Receita” e a tendência compara a receita
do resumo com o ponto anterior da série, que tem outra composição.

- Local: `src/app/dashboard/financeiro/actions.ts:136` e `:248`;
  `src/app/dashboard/financeiro/page.tsx:66`;
  `src/app/dashboard/financeiro/_components/financeiro-client.tsx:386` e `:590`.
- Reprodução feita: funções originais transpiladas para uma VM, dependências de
  banco substituídas por consultas em memória, data fixa 18/10/2026. Pagamento 100,
  entrada manual 50, despesa 20: resumo receita 150/saldo 130, gráfico receita 100.
- Esperado: métricas com o mesmo nome e recorte devem usar a mesma composição ou
  explicitar a diferença. Efeito proibido em futura correção: alterar lançamentos.
- Evidência: [resultado](evidencias/repro-financeiro.json) e
  [harness de reprodução local](evidencias/repro-financeiro-harness.txt).
- Falso positivo considerado: não é cálculo morto; a página e o gráfico consomem a
  função. `listarUltimos7Dias` também omite receitas manuais, mas não foi encontrado
  consumidor atual dela; não foi contado como segundo defeito em uso.
- Reprodução adicional em produção: clínica QA inicialmente sem receitas; lançamento manual
  fictício de R$ 50 via PIX. Resumo e extrato mostram R$ 50, gráfico continua “Sem dados
  financeiros”, inclusive após recarga. Prints 70, 71 e 98; persistência em
  [qa-estado-final.json](evidencias/qa-estado-final.json). Nenhuma transferência ocorreu.
- Limite: demais combinações de pagamentos, despesas, períodos e filtros não foram
  homologadas em produção.

### COD-02 — Edição de orçamento avulso sem atomicidade — alta

**CONFIRMADO por inspeção; perda real NÃO OBSERVADA.** `editarOrcamento` lê itens,
apaga, insere nova lista e atualiza totais por operações separadas. Se o INSERT
falhar depois do DELETE confirmado, retorna erro sem restaurar os itens removidos.
Se a atualização final falhar, itens e total podem divergir.

- Local: `src/app/dashboard/orcamentos/actions.ts:1251`, especialmente `:1312–1353`.
- Caminho atual: perfil do paciente `paciente-detail-client.tsx:1194–1334` chama
  essa action no caso avulso; orçamentos vinculados à Ficha usam outra RPC, e
  histórico financeiro usa revisão comercial. A conclusão não se estende a eles.
- Proteções presentes: bloqueio de itens aprovados/retirados/com composição e
  verificação de zero linhas deletadas. Elas não tornam as três requisições atômicas.
- Reprodução futura segura: orçamento avulso sintético sem aprovações; falhar
  controladamente a inserção após exclusão em ambiente descartável; reler itens/total.
- Esperado: ou toda edição persiste ou os itens anteriores continuam íntegros.
- Impacto potencial: perda parcial da proposta e inconsistência de totais.
- Não houve injeção de falha em produção nem correção durante a auditoria.

## Controles encontrados no recorte

| Caminho | Evidência / limite |
| --- | --- |
| Contexto de clínica | `src/server/auth/clinic.ts:29`: autenticação, clínica ativa, membership com status ativo e perfil. Isso não substitui a checagem de RPCs. |
| Atualização de Ficha | `src/server/patients/salvar-ficha.ts:157`: schema Zod, clínica, rejeição de Ficha assinada e verificação de zero linhas. A lacuna do caminho direto está em DB-01. |
| Pagamento | `src/app/dashboard/orcamentos/actions.ts:802` e `:1546`: chamadas idempotentes; catálogo vivo conferido no relatório do banco. |
| PDF da Ficha | `src/app/api/fichas/[id]/pdf/route.ts`: perfil e filtro de clínica em Ficha/eventos. Exportação com assinatura e expiração não exercitada. |
| Campo Mágico | `src/app/api/dex/formatar-evolucao/route.ts:317`: ator, limite de requisições e saída estruturada com feature. Não foi executada extração paga ou avaliação do modelo. |
| Anexos de texto | `src/app/api/extrair-texto/route.ts`: sessão, extensões, tamanho e tratamento de texto vazio. Sem upload nesta auditoria. |
| Webhooks | Assinatura verificada antes de processar Stripe/Meta nos respectivos handlers. Credenciais/configuração e entregas reais não testadas. |

## Verificações locais

| Verificação | Resultado |
| --- | --- |
| 7 arquivos de testes dirigidos via `tsx --test` | PASSA: 44 testes, zero falhas. |
| Lint de 5 arquivos centrais, sem `--fix` | PASSA quanto a erros: zero; 2 warnings de variáveis `inicio`/`fim` sem uso no Financeiro. |
| Reprodução isolada COD-01 | NÃO PASSA o critério de consistência entre resumo/série; diferença demonstrada. |
| Typecheck integral sem emissão | NÃO TESTADO até o fim: processo encerrou por limite de heap, saída 134. |
| Build, suíte completa e integrações externas | NÃO TESTADO neste recorte. Escritas QA dirigidas estão em INTERFACE.md. |

Logs: [testes](evidencias/testes-dirigidos-tsx.txt),
[lint](evidencias/eslint-dirigido.txt), [typecheck](evidencias/typecheck.txt).
A primeira execução com Node puro falhou em dois imports sem extensão; o runner
configurado no projeto (`tsx`) resolveu isso. Não é falha funcional do produto.
Node não estava no PATH do shell; foi usado o runtime local fornecido pelo app
(v24.19.0), sem instalação de dependências. O log antigo foi preservado como diagnóstico.

Os testes cobrem agrupamento por dente, deduplicação de rascunho, extração determinística
endo, mesclagem endo, estado de orçamento, reconciliação de pagamentos e contrato estático
R-194. Teste de texto de migration não comprova aplicação ou segurança em runtime.

## Portabilidade para o novo ambiente

`.codex/hooks.json` ainda aponta para PowerShell e caminho absoluto de Windows.
É configuração do setup antigo, não bug da aplicação; revisar quando configurar o Maestri.
Não executar esse hook automaticamente no Linux nem transportar o caminho como requisito.

Não foram pesquisadas vulnerabilidades de todas as dependências, analisadas todas as
Server Actions ou homologados upload/download, restauração, convites e billing. A lista
completa de rotas está em [rotas.json](evidencias/rotas.json), com cobertura explícita.


## Correção de acesso autorizada após a auditoria

**Recorte explicitamente solicitado pelo usuário em 18/10/2026:** resolver o ciclo
Dashboard ↔ dentista agregado e permitir abrir o login para informar outra conta.
Transição de Auditor para Executor apenas neste defeito; demais achados não corrigidos.

Contrato: restaurar destino de entrada finito e formulário de login acessível; preservar
isolamento, sessão/cookies, critérios de assinatura, isenção, formação e bloqueio de
clínica. Fora: design, dados, preço/plano, ativação de membros, Stripe, schema e outros
achados. Nenhuma escrita sobre a conta real foi autorizada por esta correção.

Causa reproduzida: `requireClinicContext` exige vínculo ativo. O layout, depois dessa
checagem, mandava três estados de assinatura para uma página que só busca vínculos
pendentes/suspensos; sem encontrá-los, ela retorna ao Dashboard. Adicionalmente o proxy
redirecionava `/login` para o Dashboard quando já havia sessão, retirando a saída pelo
formulário. O estado exato da conta do usuário não foi consultado no banco para inferir
seu plano; a condição do ciclo foi demonstrada nos entry points com dependências isoladas.

Alterações locais (ainda NÃO PUBLICADAS):
- `src/proxy.ts`: `/login` acessível com ou sem sessão, preservando a resposta de
  renovação de cookies; rotas protegidas continuam protegidas.
- `src/app/dashboard/layout.tsx`: vínculo ativo sem liberação comercial vai a
  `/planos?billing=required`. Vínculo pendente/suspenso continua passando pelo gate
  existente de `requireClinicContext` para `/bem-vindo-agregado`, sem mudança nele.
- `src/access-navigation.test.ts`: regressão dos entry points reais transpilados,
  com dependências locais simuladas; nenhuma conexão a Auth/banco/Stripe.

| Critério | Estado inicial → ação → resultado / efeito proibido | Evidência local |
| --- | --- | --- |
| Troca de conta | Sessão existe → GET login → formulário permitido, sem redirecionar ao Dashboard nem apagar cookie | PASSA |
| Proteção anônima | Sem sessão → Dashboard → login com retorno, sem conteúdo privado | PASSA |
| Checkout incompleto | Vínculo ativo + cada um dos três estados → Dashboard → planos, sem voltar ao agregado ou liberar conteúdo | PASSA |
| Acesso já permitido | Assinatura válida/isento/formação autorizada → Dashboard → mantém acesso | PASSA |
| Acesso bloqueado | Sem assinatura/unpaid/suspended/canceled → Dashboard → planos, sem liberação indevida | PASSA |
| Clínica bloqueada | Assinatura válida + clínica bloqueada → Dashboard → configurações como antes | PASSA |
| Produção após publicação | Navegador com sessão do cenário → entrar/recarregar → destino finito e login disponível | Ver validação posterior abaixo: acesso QA PASSA; cenário comercial real NÃO TESTADO |

[Antes](evidencias/acesso-antes.txt): 4 falhas do recorte em 9 testes, com runtime do
harness ajustado antes de registrar esse resultado.
[Depois](evidencias/acesso-depois.txt): 16 testes aprovados, incluindo regressões
comerciais existentes. [Lint](evidencias/acesso-lint.txt) dos três arquivos.
Na rodada inicial a checagem integral de tipos esgotou heap. A rodada posterior
passou com heap de 6144 MB, conforme evidência no recorte abaixo. Não houve execução de checkout, cobrança ou alteração de membership.

Planejamento anterior à publicação (executada na seção final): publicação precisa ser seletiva: não misturar com as centenas de exclusões documentais
já preparadas pelo usuário. Depois de publicar, confirmar a nova SHA/alias e o fluxo
com sessão real antes de declarar resolvido no site. A auditoria visual interna foi concluída no recorte QA isento; isso não valida
a correção geral de login em produção. Esta seção é o único registro da correção; não cria nova spec
nem plano da atualização futura.

## Ajustes pontuais selecionados em 18/10/2026

**Autorização atual:** concluir login/loading do redirecionamento; adicionar olhinho no
login; nomear os botões de senha do cadastro; corrigir texto “Próxima sessão” e rótulo
de status mensal. Avaliar senhas vazadas/advisors. Usuário confirmou separadamente:
DB-01/DB-02 adiados e loading se refere ao login. Orçamento avulso, gráfico financeiro,
Aprovar tudo e redesign ficam fora. Responsável: Executor deste chat, sem delegação.

Preservar autenticação/cookies, critérios comerciais, papéis, dados clínicos/financeiros,
valores técnicos e callbacks da Agenda, cadastro e desenho existente. Sem migration,
configuração remota, commit, push ou deploy nesta etapa. Reversão local dos ajustes
visuais pode ser separada; não restaurar o ciclo de login como reversão de publicação.

Arquivos: `src/proxy.ts`, `src/app/dashboard/layout.tsx`, `src/access-navigation.test.ts`
(continuação do recorte acima); `src/app/(auth)/login/page.tsx`, formulário de cadastro,
`month-view.tsx` e `passo-ficha.tsx`. Consumidores diretos: acesso, cadastro e Agenda mensal.

| Critério | Estado inicial → ação → esperado; efeito proibido | Verificação |
| --- | --- | --- |
| Ciclo | Vínculo ativo nos três estados comerciais → Dashboard → Planos renderiza; não voltar ao agregado nem liberar acesso | PASSA local, teste dos entry points reais com dependências simuladas; autenticação real pós-publicação NÃO TESTADA. |
| Proteção anônima | Sem sessão → Dashboard → login com destino de retorno; sem conteúdo privado | PASSA no navegador local e testes. |
| Olhinho | Senha oculta → clique/Space → mostrar/ocultar; não submeter nem apagar conteúdo | PASSA no navegador local com texto fictício; preservação visual após alternâncias. |
| Cadastro acessível | Dois botões → leitura de nomes e acionamento → ações distintas e tipos alternados; não cadastrar | PASSA local, árvore acessível e inspeção de type. |
| Status | scheduled com seletor fechado → abrir e escolher Confirmado → rótulo português e callback confirmed; não alterar enum/regra | PASSA no MonthView real com fixture local sem banco. |
| Texto | Landing local → ler mockup → Próxima sessão; sem mudar layout | PASSA: 2 correspondências corretas, zero da expressão antiga no DOM. |
| Mobile do login | 390×844 → observar campo/botão → visíveis e largura de conteúdo 390; sem overflow horizontal | PASSA apenas neste estado local; print separado da auditoria. |

Testes desta rodada: **13 aprovados**, incluindo novo teste de destino final Planos.
Lint dos sete arquivos: **zero erros, um aviso preexistente** na navegação do cadastro.
Typecheck integral nesta rodada: **PASSA**, saída 0, heap de 6144 MB, sem emissão e
sem cache incremental. A falha de memória anterior não foi repetida. Build de produção
não executado neste recorte; compilação dev das páginas públicas e typecheck passaram.
[Resultado](evidencias/correcoes-locais/typecheck-resultado.json).
Evidências: [testes](evidencias/correcoes-locais/login-testes.txt),
[lint](evidencias/correcoes-locais/lint.txt),
[interface](evidencias/correcoes-locais/verificacao-interface.json),
[login](evidencias/correcoes-locais/login-senha-visivel.png) e
[Agenda](evidencias/correcoes-locais/agenda-callback.txt).

Os testes da Agenda foram isolados para evitar mudar agendamento real; não se apresentou
callback local como prova de escrita no banco. Não foi feita nova autenticação por senha,
chamada de IA ou alteração de cliente real. Destinação dos adiados em [Pendências](PENDENCIAS.md).

## Publicação seletiva e validação — 18/10/2026

Autorização explícita do usuário: publicar somente os ajustes selecionados e validar o login.
Deployment `dpl_HiZZiUFuWTtCVa5hawEfdrjp7WrN`, READY, production, promovido para
https://odontoia.app; resolução do domínio confirmada pela API Vercel após a promoção.
Build remoto aprovado. Fonte enviada por CLI: baseline `a1722c47c346a4a80c84ad6cd5efd0ee42afbf08`
mais seis arquivos corrigidos e um teste. **Não há uma nova SHA Git**: não houve commit/push.
Cópia isolada em `/tmp/odonto-release-20261018`; nenhuma exclusão documental foi enviada.
Manifesto de hashes e patch reprodutível: `evidencias/publicacao/fontes.json` e
`evidencias/publicacao/ajustes-publicados.patch`. Não republicar a SHA antiga sem o patch,
pois isso restauraria o defeito de acesso. A próxima entrega Git deve incorporar estes ajustes.

| Critério em produção | Resultado e evidência |
| --- | --- |
| Login com sessão QA ativa → abrir e recarregar | PASSA: formulário permanece em `/login`, sem redirecionamento forçado; `login-com-sessao.txt`, `login-publicado.png`. |
| Sessão preservada → Dashboard e recarga | PASSA: conta Dentista teste 1 e dados fictícios disponíveis; `dashboard-qa.txt`. Não foi necessário novo login. |
| Sem sessão → Dashboard | PASSA: navegador independente e HTTP 307 para `/login?redirectTo=%2Fdashboard`, sem conteúdo privado; `login-anonimo.txt`, `http-anonimo.txt`. |
| Mostrar/ocultar senha | PASSA: texto fictício, clique revela e Space oculta; tipo volta a password; sem envio de formulário; `login-senha-visivel.png`. |
| Cadastro: nomes distintos dos dois botões | PASSA: ambos alternam mostrar/ocultar; nenhuma conta criada; `cadastro-acessibilidade.txt`. |
| Agenda mensal: seletor fechado | PASSA: AGENDADO em português e nome acessível Status do agendamento; `agenda-status.txt/png`. Nenhum status gravado. |
| Texto da landing | PASSA: Próxima sessão no mockup; `landing-texto.txt`. |
| Novo login com e-mail/senha e troca efetiva de conta | NÃO TESTADO: senha da QA não fornecida; preenchimento automático de outra conta não foi submetido. |
| Três estados comerciais que causavam ciclo | PASSA local com dependências simuladas; NÃO TESTADO com conta correspondente em produção. A isenção da QA não prova esse cenário. |

Os 13 testes locais, lint (zero erros/um aviso preexistente) e typecheck integral aprovados
continuam sendo evidências separadas. Build remoto pula tipos; não substitui o typecheck local.
Sem migration, alteração de Auth/configuração, dados clínicos/financeiros, cobrança ou IA.
Itens adiados e proteção contra senhas vazadas permanecem exatamente como em PENDENCIAS.md.
Os 113 prints originais são da baseline anterior; novas capturas ficam em `evidencias/publicacao/`.
Entrega publicada e verificada neste recorte, com aceite do usuário e testes acima pendentes.
