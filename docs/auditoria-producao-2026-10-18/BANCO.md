# Banco — auditoria dirigida de produção

Projeto `zenfemoxvwerplrjgfqz`; catálogo/advisors consultados em 18/10/2026.
Somente SELECT de metadados e consultas de configuração. Nenhuma tabela clínica ou
financeira foi varrida em busca de dados de pacientes; nenhum registro foi alterado
durante essa coleta. Depois dela houve limpeza de contas e dados de teste por
autorização específica do usuário; resultado atual em [Estado](../../plans/ESTADO.md).

## Retrato verificado

| Objeto | Observação atual |
| --- | --- |
| Tabelas públicas | 78; todas com RLS habilitada. |
| Policies públicas | 89. |
| Funções públicas | 112, com assinaturas/configuração/grants inventariados. |
| Índices públicos | 305. |
| Triggers públicos de usuário | 72; excluídos os internos de FK. |
| Chaves estrangeiras públicas | 238. |
| View pública | `orcamentos_com_estado`, `security_invoker=true`. |
| Storage | 5 buckets privados: audios, radiografias, documentos, fichas, avatars; 22 policies em storage. |
| Ledger de migrations | 177 registros remotos; 186 arquivos locais. Não equivalem a instalação comprovada. |

Evidências: [catálogo](evidencias/catalogo-banco.json),
[estrutura](evidencias/estrutura-banco.json),
[funções selecionadas](evidencias/funcoes-dirigidas.sql),
[helpers/triggers](evidencias/helpers-e-triggers.sql).
Consultas reproduzíveis em `evidencias/consulta-catalogo.sql` e `consulta-estrutura.sql`.

## DB-01 — Imutabilidade da Ficha assinada ausente no caminho direto — alta

**Lacuna estrutural CONFIRMADA; exploração autenticada NÃO TESTADA.**
A Server Action `salvarFicha` rejeita `assinado_em != null`. No catálogo vivo:

- `authenticated` tem UPDATE na tabela `public.fichas`.
- Policy `fichas_write_own` autoriza dono na clínica ativa; `WITH CHECK` exige
  papel clínico e dono, sem condicionar a assinatura.
- Restritiva `commercial_write_fichas` verifica acesso comercial, não assinatura.
- Triggers da tabela: atualização de timestamp e limpeza após DELETE; não há
  trigger de imutabilidade da Ficha assinada no catálogo consultado.

Assim, a proteção encontrada na action não é uma proteção equivalente contra escrita
direta no banco/API por um dono autorizado. A presença de RLS não resolve essa diferença.

**Condição a validar:** dono ativo, acesso comercial permitido, Ficha sintética assinada;
tentar alteração diretamente pela API autenticada, fora da action. Esperado: rejeição e
conteúdo/assinatura intactos após recarga. Efeito proibido: modificar registro real.

**Impacto potencial:** alterar conteúdo associado a assinatura sem passar pelo bloqueio
da aplicação. Não há evidência de que isso tenha ocorrido. Confidence alta sobre
catálogo/action; comportamento de ponta a ponta permanece NÃO TESTADO.

**Falso positivo considerado:** a restritiva comercial pode impedir algumas contas;
isso não expressa imutabilidade para contas autorizadas. As proteções de eventos do
odontograma não foram confundidas com proteção da linha principal em `fichas`.

## DB-02 — RPC antiga de recebimento tem autorização mais fraca — alta

**Risco condicionado identificado por inspeção; NÃO EXPLORADO.**
`registrar_recebimento_orcamento` continua `SECURITY DEFINER`, executável por
`authenticated`, e é diferente de `registrar_recebimento_orcamento_idempotente`.

A antiga resolve `get_my_clinica_id`/`get_my_dentista_id` e valida
`can_act_as_dentista`. No ramo de dono, esse helper aceita igualdade com o perfil;
não exige membership ativo. `get_my_dentista_id` não filtra perfil ativo ou status
do vínculo. A função antiga também não consulta esses estados diretamente.
O trigger de INSERT em pagamentos (`private.definir_titular_financeiro`) confere
vínculo orçamento/clínica e titularidade, sem acrescentar essa validação de membership.

**Cenário condicionado:** sessão/token ainda válido, perfil e clínica ativa mantidos,
mas vínculo suspenso/removido. O caminho legado não contém a mesma barreira de vínculo
ativo das funções novas. Isso não comprova que exista hoje uma conta nesse estado.

**Impacto potencial:** registro financeiro por identidade cujo acesso operacional deveria
ter sido retirado. O caminho antigo também não recebe chave de operação; não presumir
idempotência só porque a UI usa a função nova.

**Reprodução futura segura:** duas identidades sintéticas e orçamento sintético, em
ambiente controlado; retirar vínculo, preservar sessão para o teste, chamar diretamente
cada caminho e comparar antes/depois. Não executar na base real sem escopo próprio.
**Esperado:** vínculo retirado não produz leitura/alteração financeira.

**Falso positivo considerado:** revogação do token, remoção do perfil ou alteração da
clínica ativa pode impedir o cenário. Esses fluxos não foram exercitados. Não foi
observada chamada atual da UI à RPC antiga; a preocupação é a superfície publicada.

## Controles presentes que devem ser preservados

- `gerar_parcelas_orcamento`: identidade, clínica ativa, vínculo ativo, consistência de
  papel/perfil e propriedade do orçamento antes do trabalho; lock do orçamento.
- `registrar_recebimento_orcamento_idempotente` e `registrar_pagamento_rapido_idempotente`:
  autenticação e vínculo ativo, lock, validação da repetição, saldo e grants sem anon.
- Índice `uq_pagamentos_clinica_operacao` único por clínica/operação, com filtro
  `operacao_id IS NOT NULL`, presente no catálogo vivo.
- Fichas/orçamentos/pagamentos têm policies com clínica e/ou autoria; existência e
  expressão foram conferidas. Isolamento com contas distintas continua NÃO TESTADO.
- View financeira invoker e buckets privados: não foram encontrados view pública
  definer nem bucket público neste catálogo. URLs assinadas não foram auditadas.

## Alertas automáticos: interpretação e não falsos bugs

[Segurança — saída completa](evidencias/security.json):

| Aviso | Quantidade | Interpretação nesta auditoria |
| --- | --- | --- |
| RLS sem policy | 29 | RLS sem policy bloqueia por padrão os papéis comuns; pode ser acesso via backend/RPC. Não é vazamento por si só. |
| search_path mutável | 2 | `normalizar_nome` e `trg_pacientes_nome_busca`; ambas invoker no catálogo. Hardening, sem exploração demonstrada. |
| definer executável por anon | 3 | Dois retornam trigger, não são RPCs normais; `can_act_as_dentista` depende de identidade resolvida. Não contar três vazamentos. |
| definer executável por authenticated | 74 | Superfície que exige guards internos; DB-02 é o recorte examinado, não acusação de 74 falhas. |
| Proteção de senha vazada desligada | 1 | Configuração confirmada pelo advisor. Habilitação depende de decisão/configuração da conta; não alterada. |

[Desempenho — saída completa](evidencias/performance.json): 83 FKs sem índice de
cobertura, 6 alertas de initplan em RLS, 44 índices sem uso observado, 75 ocorrências
de policies permissivas sobrepostas e 1 configuração de conexões Auth.
Não criar todos os índices nem apagar os “não usados”: faltam janela de estatística,
consultas lentas representativas e medição antes/depois. Sobreposição também pode
ser intencional. Não foi executado teste de carga ou EXPLAIN ANALYZE de dados reais.

Referências oficiais dos advisors:
[RLS/segurança da API](https://supabase.com/docs/guides/api/securing-your-api),
[linter de banco](https://supabase.com/docs/guides/database/database-linter),
[search_path](https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable),
[funções definer anônimas](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable),
[senhas vazadas](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection),
[FK sem índice](https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys).

## Divergência banco/código: regra para a transição

O schema vivo contém estruturas de gestão/estoque/repasses que não demonstram uma
interface entregue nesta baseline. Há migrations com timestamps diferentes entre o
ledger e o repositório e registros remotos posteriores ao commit da aplicação.
[Comparação literal](evidencias/comparacao-migration-ledger.json): 164 versões só na
lista local e 155 só na lista remota; muitos nomes/timestamps diferem. Não interpretar
isso como 164 migrations faltantes ou 155 funcionalidades extras.

Não aplicar a pasta local para “igualar” produção. Este catálogo é evidência dirigida,
não backup completo/restaurável: não inclui todos os corpos de funções privadas,
objetos de plataforma, arquivos armazenados, Auth nem os dados. Restauração e
reconstrução de ambiente fiel permanecem NÃO TESTADAS.

## Retomada com conta QA autorizada

Consultas finais foram restritas à clínica `eddc5fc6-62b0-4d01-8e6e-3f84f61e64e7`.
Confirmados um paciente, uma Ficha sem assinatura, um orçamento de R$ 100 em rascunho,
um encaixe, uma receita manual fictícia de R$ 50 e um bloco de apresentação. Zero
pagamentos de orçamento. [Estado QA](evidencias/qa-estado-final.json),
[evento clínico sintético](evidencias/qa-evento-persistido.json) e
[bloco](evidencias/qa-apresentacao-persistida.json). Escritas ocorreram pela UI autorizada;
essas consultas foram somente leitura. Não houve migration nem alteração de proteção.

A confirmação privilegiada de persistência não prova autorização de outro usuário.
DB-01/DB-02 continuam com os limites acima; nenhum ataque ou alteração em clientes reais.
