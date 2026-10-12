# R-182 — baseline verificável e encerramento da estabilização do core

STATUS: REFERENCE_ONLY — fase encerrada operacionalmente; verificações residuais 🧊 congeladas
OWNER: Coordenação — integração; Auditor — evidências por marco após despacho
LAST_REVIEWED: 2026-10-12
REPLACES: recorte de planejamento do R-182 de 03/10/2026; evidências históricas preservadas no Git
CANONICAL_FOR: registro histórico da R-182 e contrato de referência dos testes adiados

## 1. Objetivo e autoridade

**Decisão atual, 12/10:** o usuário encerrou a fase de estabilização agora e fará
os testes restantes com mais tempo. O encerramento é operacional; os cenários
listados na auditoria §12.20 continuam **NÃO TESTADOS** no recorte indicado.
Não marcar esta spec como DONE nem usar o encerramento como prova de estabilidade
integral. Retomar apenas o teste focal escolhido pelo usuário; defeito novo vira
item próprio. A evidência desta spec fica preservada como referência.

**Gate concluído, 12/10:** usuário autorizou seguir testes seguros. AC-10 lógico,
resultado incerto R-200, data futura e estorno por etapa passaram no laboratório;
ver [auditoria §§12.19–12.20](../auditorias/2026-10-12-R-182-estabilizacao-dirigida.md).
Os despachos/resultados datados abaixo são históricos e não substituem a
decisão atual de adiar verificações residuais.

**Autorização de 11/10/2026:** usuário aprovou encaminhar somente M0 ao chat Auditor.
M0 cobre conciliação em leitura; M1–M5 e correções continuam propostos, sem autorização
por este despacho. [Handoff de M0](../handoffs/2026-10-11-despacho-auditor-m0.md).

Preparar um core verificável para uso diário, preservando dados e jornadas existentes e
reduzindo atritos de entrada de dados e operação. O usuário decidiu priorizar essa fase antes
da expansão de gestão. Este contrato detalha o recorte para revisão; não declara estabilidade
alcançada, auditoria concluída ou autorização de publicação.

Origem: contrato anterior consultado por `git show
f27419bb074912a7a5545e38c32682acaf9d9ac1:plans/specs/R-182-baseline-verificavel.md`.
Seus testes e autorizações datados não são transportados como resultados ou permissões atuais.
O caminho do item foi retomado para evitar uma segunda spec concorrente.

Fontes: [PRODUTO](../../docs/PRODUTO.md), [baseline](../../01_BASELINE_E_ESTABILIDADE.md),
[auditoria](../../05_AUDITORIA_E_ESTRESSE.md), [regressão](../../07_REGRESSAO_E_TESTES.md).

## 2. Escopo e preservação

Dentro: inventário do comportamento atual, evidências de segurança/integridade, jornadas
completas do core, compatibilidade de registros suportados, falhas/retomada e usabilidade.
Refinamentos devem eliminar atrito observado: preenchimento, validação, feedback, navegação,
legibilidade e recuperação. Identificar consumidores de componentes compartilhados.

Preservar: modo consulta → Ficha → planejamento → orçamento; agenda e contexto do paciente;
financeiro e histórico existentes; autoria e permissões; Clindent colaborativa e Dra. Léia solo.
Um fluxo existente não pode ser retirado por não corresponder à futura oferta comercial.

Fora: novos módulos de gestão, mudança de planos/onboarding comercial, migração do legado,
redesign global, refatoração estética, integrações novas, saneamento de dados reais e carga
em produção. Mudanças de regra, schema/API ou autorização exigem contrato específico.

Auditor reúne evidências, não corrige. Cada correção usa seu item existente ou um novo recorte
aprovado; este documento aponta para o resultado sem duplicar seus critérios internos.
No máximo duas tentativas por defeito antes de rever hipótese e recorte conforme AGENTS.

## 3. Marcos propostos e dependências

| Marco | Cobertura | Entrega observável / dependência |
| --- | --- | --- |
| M0 — base e riscos conhecidos | Deployment/SHA, objetos reais necessários, evidências antigas, ambiente e fixtures de QA. | Manifesto atual; riscos reclassificados; condições de teste e cobertura declaradas antes de escritas. |
| M1 — acesso e contexto | Entrada, sessão, vínculos, papéis, isolamento, paciente/clínica corretos na navegação. | Positivas e negativas por servidor com identidades distintas; depende do ambiente M0. |
| M2 — núcleo clínico | Pacientes, agenda/Meu Dia, captura, Ficha/prontuário, planejamento e orçamento. | Jornada ponta a ponta com revisão, salvamento, recarga e formatos antigos/novos suportados; depende de M1. |
| M3 — dinheiro e efeitos | Aprovação, parcelas, recebimento, estorno, totais, repetição e concorrência relevante. | Antes/depois e recarga consistentes, sem efeito financeiro duplicado; riscos financeiros podem antecipar M2. |
| M4 — usabilidade do core | Formulários, feedback, estados vazios/erro, navegação, mobile, teclado, light/dark. | Atritos reproduzidos e priorizados; refinamento aprovado e gate funcional separado do visual. |
| M5 — fechamento | Regressão integrada, recuperação operacional, documentação e revisão do usuário. | Critérios abaixo demonstrados, pendências classificadas e evidência vinculada à versão final. |

M4 pode coletar observações junto de M1–M3; isso não autoriza misturar redesign e correção.
Se surgir risco S0/S1 confirmado, o recorte de contenção precede melhorias de uso.
Evidência antiga só é reaproveitada se versão, contrato, ambiente e cenário forem reconciliados.

## 4. Critérios observáveis — proposta de aceite

Todos obrigatórios para o recorte aplicável. Registrar por caso: ambiente, SHA/schema relevante,
pré-condição, ação, resultado esperado/observado, efeito proibido e evidência. A cobertura real
de rotas/papéis será inventariada em M0; ausência de teste não equivale a aprovação.

| ID | Estado inicial e ação | Esperado / efeito proibido | Verificação segura |
| --- | --- | --- | --- |
| AC-01 | Checkout e deploy identificados; comparar versão e objetos necessários aos fluxos. | Divergências explicitadas; proibir assumir equivalência por branch ou ledger de migrations. | Leitura do deploy/Git e catálogo efetivo; manifesto com data e limites. |
| AC-02 | Identidades de mesma clínica e clínicas distintas, com papéis/vínculos válidos e inválidos; chamar UI e servidor diretamente. | Ação permitida mantém escopo; negativa não revela dados nem modifica registros; proprietário não ganha poderes clínicos implícitos. | Duas sessões autenticadas, APIs/RPCs com identidade própria, resposta e antes/depois sintéticos. |
| AC-03 | Registro sintético novo e equivalente a formato antigo suportado; percorrer atendimento até orçamento, editar e recarregar. | Dados revisados, autoria e relações persistem no paciente/clínica corretos; sem perda silenciosa ou duplicação. | UI + resposta + persistência + reload; comparação com conteúdo esperado e consumidores diretos. |
| AC-04 | Formulário preenchido/parcial e validações conhecidas; enviar válido, inválido, duplicado e repetir após falha controlada. | Erro identificável e recuperação possível; impedir escrita inválida, sucesso falso, perda silenciosa do trabalho ou efeito repetido. | Fixtures isoladas, falha simulada, leitura antes/depois e retomada; critérios específicos do formulário no item de correção. |
| AC-05 | Orçamento sintético e plano financeiro conhecido; aprovar, receber, repetir e estornar nos casos suportados. | Totais/parcelas/saldos coerentes com regra vigente; sem cobrança, parcela ou recebimento indevido. | Casos calculáveis, API/UI e antes/depois; concorrência apenas em ambiente delimitado, sem gateway real. |
| AC-06 | Pacientes/clínicas distintos abertos e sessão com ciclo conhecido; navegar, voltar, recarregar, abrir abas e expirar sessão. | Contexto e permissões revalidados, retorno previsível; sem painel de outro paciente ou escrita sob contexto errado. | Jornadas sintéticas no navegador e chamadas diretas nos pontos de autorização. |
| AC-07 | Jornadas centrais e dispositivos definidos; executar por teclado e em viewport mobile registrado, nos dois temas. | Campos/ações alcançáveis, erro e progresso compreensíveis, nenhuma ação essencial inacessível; sem regressão funcional após refino. | Inspeção renderizada, tarefas manuais e comparação antes/depois; artefato aprovado quando houver redesign. |
| AC-08 | Dependência indisponível ou salvamento interrompido em teste isolado; recuperar e repetir a ação. | Estado final consistente e orientação de retomada; sem confirmação falsa, operação duplicada ou perda clínica/financeira silenciosa. | Falhas simuladas, persistência e recarga; integrações sem envio externo ou uso pago nesta preparação. |
| AC-09 | Falhas corrigidas e versão candidata identificada; repetir casos e regressões relacionadas. | Todas as obrigatórias passam; sem S0/S1 aberto nem achado confirmado de perda, exposição ou corrupção pendente. | Evidência por critério e consumidor; compilação/teste unitário sozinho não fecha o gate. |
| AC-10 | Procedimento de recuperação e ambiente isolado disponíveis; exercitar restauração representativa e contenção. | Dados/fluxos recuperáveis demonstrados; proibir rollback que reintroduza vulnerabilidade ou restauração sobre produção. | Ensaio isolado, dados sintéticos e procedimento registrado; não declarar backup recuperável sem teste. |

**AC-10 — resultado em 12/10/2026:** PASSA no ensaio representativo local de
recuperação lógica, com schema exportado e dados sintéticos. Evidências e limites
no [§12.19 da auditoria](../auditorias/2026-10-12-R-182-estabilizacao-dirigida.md).
Não cobre backup físico real, arquivos Storage ou login/UI; não encerra a R-182.

AC-04/08 cobrem também revisão e reexecução da IA quando aplicável. Se prompt clínico mudar,
o contrato da correção exige eval antes/depois; não executar chamadas pagas por esta preparação.
No gate AC-03, percorrer duas entradas distintas com contas e pacientes sintéticos: criar Ficha
pelo Meu Dia e pelo perfil do paciente; em ambas, lançar orçamento, salvar, recarregar e conferir
paciente, atendimento, autoria, conteúdo e efeitos. Decisão do usuário em 11/10/2026.
No gate AC-02/03, usar também secretária, segundo dentista e protético sintéticos na clínica QA B:
o dentista autor encaminha procedimentos ao segundo dentista, que acessa o procedimento
encaminhado, altera o status permitido e gera o orçamento vinculado. A secretária não pode
encaminhar responsabilidade clínica; testar a negativa. Ela pode enviar pedido interno ao
protético e conferir a resposta dele sob a sessão própria. Conferir antes/depois sem usar
registros da Clindent. Decisão e esclarecimento do usuário em 11/10/2026.
Desempenho: medir condições e tempos dos fluxos; só criar correção e meta após evidência de
gargalo. Não inventar limiar ou bloquear fechamento por otimização especulativa.

## 5. O que significa encerrar

Proposta: todos os critérios obrigatórios demonstrados, sem S0/S1 ou risco confirmado de
integridade/segurança aberto. S2 que impeça jornada coberta bloqueia. S2 fora desse efeito,
S3 e S4 remanescentes precisam ser apresentados com impacto e decisão explícita do usuário;
não varrer pendências para o backlog silenciosamente. NÃO TESTADO obrigatório mantém o marco aberto.

Encerramento local = candidato verificado para revisão. Encerramento da versão em uso exige
publicação autorizada, identificação do artefato/schema efetivos e repetição dos fluxos afetados
no ambiente publicado com condições seguras. Revisão/aceite do usuário é etapa separada.
Não prometer ausência futura de bugs; manter regressões reproduzíveis e procedimento de triagem.

## 6. Situação inicial e evidências históricas

Snapshot da preparação anterior ao M0 e à aplicação R-188; usar §§8–9 para o estado posterior.

- HEAD local: `ba5b531164c2983b991de27a96f94668fbb7ebda`, branch `codex/baseline-producao-v2`.
  Código não alterado nesta preparação. A identificação publicada está no documento 01;
  não houve nova consulta ao deployment/schema nesta etapa.
- Acervo preservado: `/home/mtx/.codex/worktrees/odonto-preservacao-v2/Odonto.IA`.
- R-188 registra exploit financeiro e autorização posterior específica; aplicação não está
  comprovada no material consultado. Reconciliar estado efetivo e despacho antes de agir;
  não reaplicar migration nem declarar vulnerabilidade atual por inferência.
- R-184, R-189, R-190, R-191 e R-192 possuem recortes preservados: valores financeiros,
  repetição, salvamento, atomicidade e reprodução de schema. Sua existência não prova falha atual.
- R-146 contém regressão de tentativa local congelada; não atribuir à produção.
- Há testes locais de domínio e comandos test/typecheck/lint/build; não foram executados aqui.

## 7. Estado dos gates e responsabilidade

AC-01: identificação de versão e catálogo **PASSA**; equivalência da fonte com o schema
**NÃO PASSA**; restore **NÃO TESTADO**. AC-02 a AC-10: **NÃO TESTADO**. Inventário
documental e metadados não são gate funcional.
Coordenação integra; Auditor registra evidência na spec/relatório do item, Executor corrige
somente o recorte aprovado, Curador atualiza apontadores. Somente M0 foi autorizado para
delegação ao chat Auditor em 11/10/2026; demais papéis não foram acionados.

Antes de execução dependente: conferir ambiente de QA, identidades e efeitos permitidos;
produção com dados reais somente leitura. Escritas sintéticas em produção, integrações reais,
migration, commit, push e deploy dependem de autorização específica vigente. A autorização
histórica de uma fixture não autoriza testes amplos. Avançar nas verificações independentes.

Despacho autorizado: **M0, somente inventário/conciliação de leitura**, sem correção.
Auditor possui somente esta spec (resultados de M0), o relatório
`plans/auditorias/2026-10-11-R-182-M0-conciliacao.md` e anexos sanitizados em
`plans/auditorias/evidencias-2026-10-11-R-182-M0/`. A Coordenação mantém Estado e índices.
Critérios de entrega de M0: versão/banco reconciliados ou acesso impedido explicitado;
achados anteriores classificados com fonte/data e limite da evidência; condições de QA
e efeitos permitidos identificados; próximo recorte recomendado. Registrar PASSA/NÃO PASSA/
NÃO TESTADO por parte do AC-01. Não executar os gates funcionais AC-02 a AC-10 neste marco.

## 8. Resultado do M0 — 11/10/2026

Snapshot do M0. A conclusão sobre R-188 foi superada pela aplicação e gate focal descritos
no §9 e na spec R-188; não usar o achado antigo como estado atual da RPC.

[Relatório e evidências](../auditorias/2026-10-11-R-182-M0-conciliacao.md). Inspeção somente
leitura; zero RPC de negócio, escrita, fixture, commit, push, deploy ou migration.

- **PASSA:** `odontoia.app` aponta para o deployment `dpl_FBHKryftZvhHn7Nz7Sy22LdK7bos`,
  `READY`, região `iad1`, branch `main`, SHA `ba5b531164c2983b991de27a96f94668fbb7ebda`.
  `origin/main` e HEAD base coincidem com esse SHA. `/` e `/login` responderam HTTP 200.
- **PASSA:** Supabase `zenfemoxvwerplrjgfqz` acessível, `ACTIVE_HEALTHY`, Postgres 17.6,
  `sa-east-1`; catálogo efetivo lido: 78 tabelas públicas, 109 funções, 89 policies,
  72 triggers de usuário, 304 índices e 1 view.
- **NÃO PASSA:** a `main` não contém fonte suficiente para o schema efetivo. O ledger remoto
  possui migrations ausentes do repositório e há objetos vivos sem SQL de criação nessa base.
  Um restore limpo continua **NÃO TESTADO**.
- **NÃO PASSA:** não há branch Supabase isolado. As contas QA conhecidas existem, mas o vínculo
  temporário usado no R-188 está removido/inativo e os três orçamentos antigos já têm plano;
  portanto não há fixture fresca nem autorização de escrita neste marco.
- **CONFIRMED, S1:** R-188 permanece ativo. `gerar_parcelas_orcamento` mantém exatamente o
  fingerprint vulnerável `e21635ef4526004ad5cb1c26e0191e98`, `SECURITY DEFINER` e EXECUTE
  para `authenticated`, sem comparar o chamador com `orcamentos.dentista_id`.
- **CONFIRMED, S1:** R-184 e R-189 permanecem sustentados pela versão atual: as funções têm os
  mesmos fingerprints do ensaio de 06/10 e os caminhos de código relevantes não mudaram.
- **CONFIRMED, S1:** o fallback original do R-146 continua no SHA publicado: `ag` fora dos slots
  de hoje é descartado e o cliente seleciona outro slot. A regressão da tentativa local retirada
  não foi atribuída à produção.
- **PROBABLE:** R-190 e R-191 mantêm os riscos estruturais de save parcial e DELETE/INSERT;
  efeitos funcionais continuam não exercitados. AC-02 a AC-10 permanecem **NÃO TESTADO**.

Próximo recorte recomendado: contenção exclusiva do R-188, com autorização operacional
reconfirmada, migration restrita e gate de duas identidades sobre fixture nova. Em seguida,
R-184 e R-189 separados. R-146 exige nova decisão de arquitetura; R-192 exige restore isolado.

## 9. Evidência posterior integrada pela Coordenação — 11/10/2026

O usuário autorizou depois do M0 a migration R-188 e o ensaio sintético M1 específico da
RPC; isso não delega M1–M5 inteiros ao Auditor. A função corrigida foi confirmada no banco
publicado. Com A/B autenticados na mesma clínica QA, AC-02 **PASSA no recorte da RPC**:
B recebeu `sem_permissao` e não mudou linhas; A criou duas parcelas pendentes de R$ 40,
recarregadas em outra sessão. B voltou ao vínculo removido e à clínica QA original.
Demais papéis, APIs e jornadas de AC-02 continuam **NÃO TESTADO**. AC-05 também permanece
**NÃO TESTADO** fora da criação desse plano: aprovação, recebimento, repetição e estorno
não foram exercitados.

Na navegação publicada com conta QA B, Agenda e Pacientes reproduziram `React #418`
somente com navegador em fuso BRT; diagnóstico local encontrou textos de data/hora
divergentes entre servidor UTC e cliente. AC-07 **NÃO PASSA no recorte de hidratação**;
teclado, demais estados e quatro combinações por tela continuam **NÃO TESTADO**. Achado
HID-01 foi vinculado ao item existente [R-129a](R-129a-performance-hidratacao.md), sem
correção nesta auditoria. [Matriz e evidências](../auditorias/2026-10-11-auditoria-ampla-inicio.md).

## 10. Gate M2/M4 de leitura e integração local — 11/10/2026

[Auditor, conta QA B publicada](../auditorias/2026-10-11-R-182-M2-leitura.md):
paciente → Ficha → procedimento/planejamento → orçamento existente abriram em leitura;
dois pacientes sintéticos mantiveram contexto em voltar/reload. AC-03/04 **NÃO TESTADO**
para escrita/persistência nova; AC-06 passou só no recorte de leitura, sem negativa de
API ou expiração. AC-07 **NÃO PASSA**: ações centrais de Pacientes, Agenda semanal e
cartão de Orçamento não recebem foco por teclado, achado **CONFIRMED S1 M2-C01**,
encaminhado ao [R-193](R-193-acesso-teclado-acoes-centrais.md). O candidato de travamento
do botão de orçamento concluiu após carregamento; **FALSE_POSITIVE**.

HID-01 passou apenas no [gate local com QA B e dois fusos](../auditorias/evidencias-2026-10-11-auditoria-ampla/hid-01-local-gate.json)
após correção; publicado ainda falha. Typecheck passou após regeneração de tipos Next
obsoletos. [R-193 passou no gate local de teclado e ponteiro](R-193-acesso-teclado-acoes-centrais.md)
em 1280 px light e 390 px dark, mas o achado M2-C01 continua na versão publicada até
deploy autorizado e repetição do gate. Não promover R-182 a concluído por esses recortes.

A [branch QA sem dados reais](../auditorias/2026-10-11-qa-branch-schema.md) autorizada
em 11/10 chegou a `ACTIVE_HEALTHY`, mas veio com zero tabelas públicas e nenhuma
migration; foi apagada sem SQL ou fixture. Os gates financeiros isolados seguem
**NÃO TESTADO** até reconstrução de schema-only confiável. Saúde de infraestrutura
não prova que a baseline de dados da aplicação foi reproduzida.

## 11. Preparação de identidades QA — 11/10/2026

Por pedido explícito do usuário, na clínica sintética `QA Odonto Clínica B 2026-10-01`
(`53eefdac-401b-484c-8ad4-a6cdd78b1a69`), foram criadas três contas exclusivas de teste:
secretária `15257803-1ec9-4ec2-aeca-9899c3f73616`, segundo dentista
`b04acb1e-7dc2-4e02-9d4b-430422618f52` e protético
`519badc2-7b77-4e58-807a-169800ebcb74`. Cada uma tem Auth, `users`, vínculo ativo,
perfil ativo com papel correspondente e login por senha verificado. Endereços reservados
`example.invalid`, sem convite enviado. Credenciais ficam fora do repositório em arquivo
local de modo `0600`: `/home/mtx/.local/share/odontoia-qa/2026-10-11-qa-b-roles.json`.
A secretária também recebeu a linha operacional em `secretarias` com
`must_change_password=false`, pois usa senha exclusiva de QA. As senhas das três
contas foram giradas após um envio nativo do formulário no servidor local expor uma
senha QA em log; o arquivo seguro foi substituído sem imprimir os novos valores.

Em 12/10/2026, foi criado outro dentista exclusivo de QA para encaminhamento
entre duas sessões sintéticas, sem usar contas da Clindent:
`12cea711-42cf-4030-b0cd-d7cff4087cc6` na mesma clínica. Login por senha
verificado; credenciais fora do repositório em arquivo `0600`:
`/home/mtx/.local/share/odontoia-qa/2026-10-12-qa-b-dentista-a.json`.

Fotografia anterior ao ensaio M3 na clínica QA B: vínculos/perfis `1 → 4`;
pacientes `2 → 2`, fichas `5 → 5`, orçamentos `2 → 2`. Nesse momento, ainda não havia
ação clínica ou financeira dessas contas. O ensaio posterior e seus limites estão em
[M3](../auditorias/2026-10-11-R-182-M3-papeis-clinicos.md).

No site publicado, secretária QA entrou em Pacientes e Agenda, mas Meu Dia voltou ao
painel conforme o papel; protético QA abriu `/dashboard/protetico` e foi redirecionado
ao tentar Pacientes. O segundo dentista QA foi enviado a `/planos?billing=required`,
portanto sua jornada publicada está **NÃO TESTADO por bloqueio comercial**. No
localhost com billing desligado apenas nesse processo, o segundo dentista abriu Meu Dia
e Pacientes; o início de atendimento exibiu a busca da paciente QA. Esta foi a
verificação inicial de acesso; o ensaio posterior de Ficha, orçamento,
encaminhamento entre dentistas e protético está em
[M3](../auditorias/2026-10-11-R-182-M3-papeis-clinicos.md).

## 12. Resultado integrado de papéis e entrada — 11/10/2026

O [M3](../auditorias/2026-10-11-R-182-M3-papeis-clinicos.md) exercitou fichas
por Meu Dia e perfil, orçamento ligado a procedimento encaminhado, negativa da
secretária para encaminhamento clínico e pedido/entrega do protético com contas
sintéticas. Ficha e orçamento foram escritos pelo localhost contra o banco
publicado; protético foi exercitado no site publicado. O dentista QA ainda não
entra no site publicado por billing; a isenção local validada não está no deploy.

O [recorte de entrada](../auditorias/2026-10-11-R-182-entrada-isolamento.md) confirmou negativa
de leitura direta entre duas clínicas e ao protético, três validações de entrada
sem escrita e um cadastro sintético persistido após recarga na clínica QA B.
O aviso de nome repetido permanece **NÃO TESTADO conclusivamente**: não apareceu
em duas tentativas, mas só há uma linha; a consulta autenticada por `nome_busca`
funcionou. Não inferir ausência de proteção nem declarar o fluxo aprovado.

**Veredito do marco R-182: NÃO PASSA para encerramento.** AC-02/03/04 têm recortes
aprovados, não cobertura completa. AC-05/08/10 continuam sem gate isolado; AC-07
falha na versão publicada por R-193 e HID-01. R-184/R-189/R-194 não foram
aplicadas nem passaram em banco isolado. A cadeia local de migrations não
reproduz o schema publicado. Não promover a versão em uso a estável ou o item
a ✅ até cumprir os critérios da seção 5.

## 13. R182-EST-01 — contenção da conclusão de encaminhamento

**Despacho de 12/10/2026:** corrigir somente a RPC
`public.concluir_evento_encaminhado` para que, ao marcar como `realizado` um evento
encaminhado em `proxima_sessao`, ela grave `momento_planejado = 'sessao_atual'` na
mesma atualização. A restrição real `odontograma_eventos_momento_coerente` exige essa
combinação. Ao reabrir, preservar `sessao_atual`, conforme o fluxo comum existente.

Preservar autorização de destinatário, ficha não assinada, clínica, autoria
(`dentista_id`), destino (`encaminhado_para`), paciente, data e `activity_logs`; manter
grants da RPC. Fora: UI, outras RPCs, regra clínica nova, dados reais, aplicação de
migration, commit, push e deploy. Consumidores diretos: `atualizarStatusEncaminhado`,
`FichasTab` e `ProntuarioTab`.

Aceite dirigido: o destinatário conclui e recarrega com status/data/momento corretos e
campos preservados; reabre com data nula e sem voltar a `proxima_sessao`; outro dentista
e outra clínica recebem `sem_permissao` sem alteração; lote com ficha assinada não altera
nenhum evento. Evidência local isolada: `scripts/test-r182-est-01-encaminhamento.mjs`,
que cria o `CHECK` real e executa a migration contra identidades e dados sintéticos.
