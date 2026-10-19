# Auditoria dirigida da produção — 18/10/2026

STATUS: PACOTE DIRIGIDO ENTREGUE — código, catálogo e capturas QA documentados; limites e verificações pendentes explícitos.
CANONICAL_FOR: evidências desta auditoria, não plano de implementação.

## Comece aqui

Este pacote registra o produto publicado para a transição ao Maestri. Leia primeiro
[Produto](../PRODUTO.md), este resumo e apenas o relatório da área da tarefa.
Não carregar todos os JSONs/SQLs/prints no contexto de cada agente.

**Depois da auditoria:** [Pendências e ajustes selecionados](PENDENCIAS.md) registra
o que foi publicado, os limites de validação e o que o usuário adiou. Os
113 prints continuam documentando a produção auditada, anterior a esses ajustes.

| Área | Documento | Cobertura entregue |
| --- | --- | --- |
| Código | [CODIGO.md](CODIGO.md) | Revisão dirigida de autenticação, Ficha, orçamento/Financeiro, extração e webhooks; 44 testes locais e lint dirigido. |
| Banco | [BANCO.md](BANCO.md) | Catálogo vivo, RLS, grants, Storage, funções selecionadas, índices, triggers e advisors. |
| Design e navegação | [INTERFACE.md](INTERFACE.md) | Telas públicas e internas, abas, formulários, modais e estados com dados fictícios; limites de papel/plano/mobile registrados. |
| Prints | [PRINTS.md](PRINTS.md) | 113 capturas reais, índice por área e galeria local. Nenhum print de paciente real. |

## Versão efetivamente observada

- Domínio: https://odontoia.app.
- Vercel: `dpl_HxR3nH6QiVZaZUpSuPBBe3Mhdyfa`, `READY`, target `production`.
- SHA: `a1722c47c346a4a80c84ad6cd5efd0ee42afbf08`, branch `main`.
- Alias e deployment consultados nesta auditoria; checkout na mesma SHA.
- Banco: Supabase `zenfemoxvwerplrjgfqz`, `ACTIVE_HEALTHY`, PostgreSQL 17.
- O banco não é congelado pelo commit da aplicação. O catálogo foi consultado
  em 18/10/2026; há objetos/migrations posteriores ao deployment.
- Atualização posterior: republicação autorizada da mesma SHA para ativar isenção QA.
  Alias atual confirmado em `dpl_HxR3nH6QiVZaZUpSuPBBe3Mhdyfa`, READY. Print 11
  confirma cortesia permanente na clínica de testes. Correção local de login não publicada.

## Resultado que importa para a próxima equipe

| ID | Prioridade / certeza | Resultado |
| --- | --- | --- |
| DB-01 | Alta; lacuna estrutural confirmada, teste autenticado pendente | A tabela Fichas não apresenta bloqueio de alteração por assinatura nas policies/triggers examinadas; a Server Action possui esse bloqueio. |
| DB-02 | Alta; risco condicionado, não explorado | RPC financeira legada continua executável e não valida vínculo ativo como as versões idempotentes novas. |
| COD-01 | Média; reproduzido localmente e na UI de produção QA | Receita manual de R$ 50 persiste no resumo/extrato, mas gráfico permanece sem dados após recarga. |
| COD-02 | Alta; fragilidade confirmada por inspeção, falha não injetada | Edição de orçamento avulso faz DELETE/INSERT/UPDATE em requisições separadas, sem transação conjunta. |
| UI-01 | Média; confirmado no DOM de produção | Dois botões de mostrar senha no cadastro não têm nome acessível. |
| UI-02 | Baixa; observado em produção | Âncora “Como funciona” deixa parte do título atrás da navegação fixa. |
| UI-03 | Baixa; confirmado em produção/código | Mockup público diz “Próxima seção” no contexto de sessão clínica. |
| UI-04 | Alta; ciclo confirmado, correção local autorizada | Dashboard/agregado redirecionam em ciclo em uma condição comercial; login com sessão também impedia trocar de conta. Ver correção local em CODIGO.md. |
| UI-05 | Baixa; confirmado visualmente | Agenda mensal mostra status técnico SCHEDULED para o encaixe QA. |

DB-01/02 exigem validação com contas e dados sintéticos antes de afirmar exploração.
Não houve prova de vazamento, perda de registro ou exploração por terceiros.
Ausência de exploração observada não certifica segurança.

## O que foi verificado sem encontrar o problema procurado

- Nenhuma das 78 tabelas públicas consultadas estava com RLS desligada.
- Nenhum dos cinco buckets consultados era público.
- A única view pública estava com `security_invoker=true`.
- As RPCs novas de recebimento idempotente e geração de parcelas têm controles
  internos de identidade/clínica/vínculo; índice único de operação presente.
- Dashboard sem sessão redirecionou para login no navegador separado.
- 44 testes locais do recorte passaram; lint dirigido: zero erros, dois avisos.

Esses resultados têm o limite descrito nos relatórios. RLS ligada, build ou print
não equivalem a isolamento e fluxos financeiros homologados.

## Pacote visual e validação comportamental

[Índice dos 113 prints](PRINTS.md) · [Galeria local](GALERIA.html).
Dashboard, Meu Dia, Agenda, Pacientes, Ficha, Orçamento, Apresentar, documentos,
Financeiro, Configurações e perfil capturados com a conta QA. Detalhes e critérios
PASSA/NÃO PASSA/NÃO TESTADO em [INTERFACE.md](INTERFACE.md).

Cobertura não é universal: mobile sem captura válida por falha da ferramenta;
recepção/protético dependem de outro papel; WhatsApp depende de plano. Assinatura,
IA, integrações e testes de isolamento com duas identidades continuam não testados.
Uma tela aberta não comprova todos os seus efeitos.

## Limites e uso das evidências

A coleta original da auditoria ocorreu com leitura intencional em produção, sem
submits ou comandos de escrita. Posteriormente, o usuário autorizou separadamente
a exclusão das contas e dos dados de teste identificados. Essa limpeza foi concluída;
resultado e verificações atuais em [Estado](../../plans/ESTADO.md). Não interpretar
os dados de teste encontrados antes da limpeza como ainda existentes em produção.
Após o usuário autorizar o conserto do loop, dois arquivos de aplicação e um teste
foram alterados localmente, separados da baseline auditada. Não houve migration,
commit ou push. Houve depois apenas o redeploy da mesma SHA para ativar a isenção QA,
autorizado separadamente. Testes locais usaram funções puras/contratos e
uma simulação isolada em memória. Não houve chamadas pagas de IA nem envio de mensagens.

`evidencias/` contém objetos de catálogo, não um dump restaurável nem dados de pacientes.
As evidências ficam separadas dos relatórios curtos. `rotas.json` inventaria 31 páginas
+ 42 handlers; não representa 73 fluxos testados. O plano futuro continua externo,
como decidido pelo usuário. Estes achados não autorizam correções automaticamente.

## Resultado da coleta original (antes da publicação)

Foram mantidos registros sintéticos identificados na clínica QA, listados em
INTERFACE.md. Nenhuma cobrança real, assinatura, mensagem ou chamada paga de IA.
Código/design/schema não alterados: 772 arquivos de src/migrations idênticos aos
hashes do início desta retomada. A correção local de login anterior permanece separada.
Sem novo deploy, commit ou push. Próxima equipe deve ler Produto → este resumo →
relatório e prints apenas da área em que vai trabalhar; não carregar o pacote inteiro
no contexto de cada tarefa. O plano de atualização continua externo.

## Atualização publicada

Ajustes seletivos publicados no deployment `dpl_HiZZiUFuWTtCVa5hawEfdrjp7WrN`, domínio `odontoia.app` confirmado.
Login com sessão/recarga, Dashboard QA, proteção anônima, olhinho, nomes acessíveis,
texto e status conferidos. Novo login por senha e cenário comercial real seguem NÃO TESTADOS.
[Resultado e identidade das fontes](CODIGO.md#publicação-seletiva-e-validação--18102026).
A baseline e os 113 prints acima são históricos; as capturas novas estão em `evidencias/publicacao/`.
