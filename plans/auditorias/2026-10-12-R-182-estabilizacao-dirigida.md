# R-182 — auditoria dirigida de estabilização

STATUS: R-197 PREVIEW PASSA; R-199 DESKTOP PASSA / 390×844 NÃO TESTADO; R-200 CORRIGIDO LOCAL / RUNTIME NÃO TESTADO
OWNER: Auditor — evidência; Coordenação — integração; Executor — correção após despacho
LAST_REVIEWED: 2026-10-12
CANONICAL_FOR: evidência desta execução dirigida do R-182 no candidato `2c52879`

## 1. Papel, contrato e limite

Atuação: **Auditor**. Contrato único: [R-182 — baseline verificável](../specs/R-182-baseline-verificavel.md).
Não houve correção de código, migration, alteração de ambiente, commit, push ou deploy. Foram
usados somente registros sintéticos da clínica `QA Odonto Clínica B 2026-10-01`; nenhum registro
real da Clindent ou de outra clínica operacional foi aberto ou alterado. O gate determinava parar
no primeiro S0/S1 confirmado; por isso a execução terminou durante M1 e não avançou para M2.

## 2. Reconciliação antes do teste

| Camada | Evidência | Estado |
| --- | --- | --- |
| Checkout candidato | `codex/baseline-producao-v2` em `2c52879ccb99d0621470a4891b1061eb1ecc064e`, igual a `origin/codex/baseline-producao-v2`; árvore limpa antes do ensaio. | **PASSA** |
| Preview candidato | Deployment `dpl_33JhdBVmK8Xfnh6ZZ9KSoR8MnuJL`, `READY`, branch e SHA acima, target preview. O navegador acessou essa URL por bypass temporário de proteção; a URL de bypass não é evidência compartilhável. | **PASSA** |
| Produção | `odontoia.app`, deployment `dpl_FBHKryftZvhHn7Nz7Sy22LdK7bos`, `READY`, `main@ba5b531164c2983b991de27a96f94668fbb7ebda`. Não foi usada para os fluxos desta execução. | **PASSA como identificação; funcional NÃO TESTADO** |
| Banco real usado pelo preview | Supabase `zenfemoxvwerplrjgfqz`, `ACTIVE_HEALTHY`, Postgres 17.6, `sa-east-1`. O preview candidato aponta para esse projeto publicado. | **PASSA** |
| Objetos financeiros atuais | Catálogo vivo contém R-184 (`20261012034818`), R-189 (`20261012034837`) e R-194 (`20261012034858`). As três funções focais estão `SECURITY DEFINER`; grants `anon=false`, `authenticated=true`. | **PASSA como catálogo; jornada NÃO TESTADO** |

Conclusão de baseline: preview, produção e checkout são versões distintas. Os resultados abaixo
pertencem ao **preview candidato `2c52879` com o schema vivo do Supabase publicado**.

## 3. Matriz da execução

| Critério / recorte | Estado | Ambiente, ação, esperado, proibido e observado |
| --- | --- | --- |
| AC-01 — versão e schema | **PASSA no recorte** | Checkout, deployment candidato, produção e catálogo real reconciliados antes de qualquer escrita. Proibido assumir equivalência entre preview e produção; nenhuma equivalência foi presumida. Restore continua fora deste recorte. |
| AC-03 — Ficha pelo Meu Dia | **PASSA** | Preview candidato; segundo dentista QA criou Ficha sintética pelo encaixe do Meu Dia. Esperado: paciente, autoria, origem e evolução persistirem sem duplicação. Observado: Ficha `e0727065-eb87-4afb-877b-0a645354acb2`, origem `modo_consulta`, autoria do segundo dentista, evolução `d7ee5c9e-4ad2-44fd-bc8f-b79d7528804f` e atendimento `41ff82b8-7b75-4cd8-a77c-c3ad8ffdef46`; perfil após recarga exibiu o marcador e `8` atendimentos. |
| AC-03 — Ficha pelo perfil | **PASSA** | Preview candidato; segundo dentista QA criou Ficha no perfil com procedimento sintético no dente 46. Esperado: vínculo, conteúdo e autoria persistirem; proibido sucesso apenas visual. Observado: Ficha `0ebca78b-fd0a-435f-8426-205ae9ed793b`, origem `manual`, evento `e3fd9b87-3ed8-465a-93eb-5dd77c1770b3`, autoria correta. A lista imediata ainda mostrou `8`; após recarga mostrou `9` e o cartão correto. |
| AC-03 — orçamento da Ficha nova | **PASSA** | Pela Ficha anterior, foi criado orçamento sintético de R$ 120. Esperado: paciente, Ficha, dentista e evento permanecerem ligados; proibido item órfão ou troca de paciente. Observado: orçamento `45aa233e-19e0-48d8-8062-75f3aa2a1902`, item `98a4abfb-5c2c-4a2e-8f2e-91bc7a6b50d3`, evento `e3fd9b87-3ed8-465a-93eb-5dd77c1770b3`, status `rascunho`, total R$ 120; persistiu na aba Orçamentos após recarga. |
| AC-02/03 — autor encaminha ao segundo dentista | **PASSA até a leitura do destinatário** | Autor QA encaminhou o evento `e1ac25c8-301b-4a67-ac1d-4df76bc83f23` ao segundo dentista. Esperado: manter autoria, fixar responsável e permitir conclusão pelo destinatário. Observado: autoria permaneceu `315c0226-005f-42e3-acf2-08d783b4242f`, destino `efd134ee-7b8e-4537-a674-1c66a1a53824`; a sessão independente do destinatário viu o alerta, a Ficha e somente o controle clínico do evento recebido. |
| AC-02/03 — destinatário altera status permitido | **NÃO PASSA — S1** | Mesma sessão/registro. Ao clicar `Realizado`, esperado: `status=realizado`, `realizado_em=2026-10-12`, autoria/destino intactos e estado persistente após recarga; proibido sucesso falso ou escrita parcial. Em duas reproduções o controle entrou em `Salvando` e voltou a `A fazer`. Banco permaneceu `status=indicado`, `realizado_em=null`, sem log de conclusão. Runtime registrou nas duas requisições: `new row for relation "odontograma_eventos" violates check constraint "odontograma_eventos_momento_coerente"`. |
| AC-02/03 — orçamento ligado ao procedimento encaminhado | **NÃO TESTADO** | Interrompido pelo S1 antes da criação. |
| AC-02 — secretária sem transferência clínica, UI + API + efeito zero | **NÃO TESTADO** | Interrompido pelo S1. |
| AC-02 — secretária pede laboratório, protético responde, retorno à clínica | **NÃO TESTADO** | Interrompido pelo S1. |
| AC-02/06 — negativa entre clínicas e efeito zero | **NÃO TESTADO** | Interrompido pelo S1. |
| M2 financeiro e UX | **NÃO TESTADO** | Não iniciado porque o contrato manda parar em S0/S1. |
| AC-10 — restauração/recuperação | **NÃO TESTADO** | Não houve ambiente isolado de restore nem código novo publicado; não inferir recuperabilidade. |

## 4. Achados confirmados

### R182-EST-01 — destinatário não consegue concluir procedimento encaminhado

- **Classificação:** CONFIRMED.
- **Severidade:** S1.
- **Confiança:** alta.
- **Onde:** preview `dpl_33JhdBVmK8Xfnh6ZZ9KSoR8MnuJL`, fluxo Paciente → Ficha → procedimento encaminhado; action `atualizarStatusEncaminhado` e RPC viva `public.concluir_evento_encaminhado(uuid[], text, date)`.
- **Como reproduzir:** (1) autor encaminha um evento `indicado`, não assinado e planejado para `proxima_sessao`; (2) destinatário abre a Ficha com sessão própria; (3) aciona `Realizado`; (4) aguarda e recarrega; (5) consulta evento e activity log.
- **Resultado esperado:** evento passa a `realizado`, recebe `realizado_em`, mantém `dentista_id` e `encaminhado_para`, cria rastreabilidade e permanece concluído após recarga.
- **Resultado observado:** duas tentativas retornaram visualmente a `A fazer`; o banco permaneceu `indicado`, sem data e sem activity log de conclusão.
- **Evidência:** runtime do deployment, requisições de `2026-10-12T13:07:48.031Z` e `13:08:10.150Z`, ambas com violação da constraint `odontograma_eventos_momento_coerente`; leitura posterior do evento confirmou efeito zero.
- **Causa sustentada pela evidência:** a constraint viva exige `momento_planejado='sessao_atual' OR status='indicado'`. O evento encaminhado mantém `momento_planejado='proxima_sessao'`; a RPC tenta mudar apenas `status` e `realizado_em`, então a atualização para `realizado` é rejeitada atomicamente.
- **Impacto:** bloqueia a conclusão clínica pelo profissional que recebeu a responsabilidade. Também impede fechar o gate de orçamento ligado após a conclusão e invalida o fluxo central de encaminhamento exercitado no M1.
- **Pode ser falso positivo?** Improvável. Identidade independente foi confirmada na UI, o evento aponta para esse destinatário, o controle autorizado foi exibido, duas requisições falharam com o mesmo erro e a leitura do banco mostrou ausência de alteração.
- **Teste que valida a hipótese:** falta regressão cobrindo `encaminhado_para=caller`, `momento_planejado='proxima_sessao'` e transição `indicado → realizado`, com reload e preservação de autoria/destino. O teste deve exercer a RPC/schema real, porque teste unitário da action não captura a constraint.

## 5. Achados não confirmados

### R182-EST-N01 — falha de resolução do Upstash no preview

- **Classificação:** NEEDS_EVIDENCE.
- **Evidência existente:** logs do preview registraram `ENOTFOUND` para o host do Upstash ao carregar alertas, seguido de fallback em memória.
- **Por que não é achado confirmado deste marco:** não houve falha observável no fluxo auditado nem teste dirigido de rate limit; investigar agora ampliaria o escopo depois do gate S1.

## 6. Falsos positivos e incidentes de QA

- **FALSE_POSITIVE evitado:** a primeira tentativa de troca de identidade no mesmo perfil do navegador manteve a sessão do autor. O menu revelou `QA Auditoria B`; essa observação não foi usada como teste do destinatário. O teste válido ocorreu em perfil Chrome isolado, identificado como `QA Dentista B2 20261011`.
- **Incidente sintético, sem impacto clínico:** uma tentativa de magic link usou um endereço QA inexistente e criou um usuário Auth sintético sem vínculo de clínica. Nenhum paciente, Ficha, orçamento ou papel foi associado. Como Auditor, não foi apagado; a Coordenação pode autorizar limpeza separada se considerar necessário.

## 7. Cobertura e efeitos

Auditado: baseline Git/deploy/schema; login independente do autor e segundo dentista; criação de
Ficha pelo Meu Dia e pelo perfil; orçamento vinculado à Ficha nova; encaminhamento e leitura pelo
destinatário; tentativa de mudança de status; resposta visual, persistência, recarga e logs.

Não auditado por parada S1: orçamento do evento encaminhado após conclusão; negativas da
secretária na UI/API; laboratório/protético; negativa entre clínicas; aprovação, parcelas,
recebimento, repetição, estorno; UX ampla; falha/retomada; restauração AC-10; qualquer jornada
funcional na produção `ba5b531`.

Efeitos deliberados no banco publicado: duas Fichas sintéticas, um evento sintético, um orçamento
sintético e um encaminhamento sintético na clínica QA B. As duas tentativas de conclusão tiveram
efeito zero por transação rejeitada. Nenhuma integração externa foi disparada.

## 8. Próxima ação explícita para o Executor

1. Abrir correção própria para R182-EST-01, sem incorporar os critérios restantes ao mesmo lote.
2. Definir a regra desejada ao concluir um encaminhamento que estava em `proxima_sessao`: atualizar
   coerentemente `momento_planejado` na mesma transação ou ajustar outra camada somente após decisão
   explícita; preservar autoria, destino, assinatura e rastreabilidade.
3. Adicionar regressão de integração no banco para a combinação que falhou e para reabertura, com
   antes/depois e recarga.
4. Após correção e novo deployment candidato identificado, repetir primeiro este caso. Somente se
   passar, retomar a fila interrompida: orçamento vinculado → secretária negativa UI/API → laboratório
   e protético → isolamento entre clínicas → M2 financeiro/UX.

Não publicar, migrar ou promover o candidato por causa deste relatório. Integração, publicação e
aceite do usuário permanecem estados separados.

## 9. Adendo pós-migration — revalidação do R182-EST-01 e retomada de M1

Este adendo registra o gate autorizado depois da aplicação da migration corretiva no Supabase
publicado. Ele preserva as seções anteriores como evidência histórica da falha e substitui somente
o estado operacional dos critérios reexecutados abaixo. Atuação: **Auditor**; não houve correção de
código, alteração de ambiente, commit, push, deploy ou escrita em dados reais durante esta etapa.

### 9.1 Baseline pós-aplicação

| Camada | Evidência | Estado |
| --- | --- | --- |
| Preview | Mesmo candidato `dpl_33JhdBVmK8Xfnh6ZZ9KSoR8MnuJL`, SHA `2c52879ccb99d0621470a4891b1061eb1ecc064e`. | **PASSA** |
| Banco | Supabase publicado `zenfemoxvwerplrjgfqz`; somente clínica sintética QA B. | **PASSA** |
| RPC viva | `public.concluir_evento_encaminhado(uuid[], text, date)`, MD5 `36c5d82cc75ae6b8eab807276ea2e414`, `SECURITY DEFINER`, `search_path=public`; `anon=false`, `authenticated=true`, `public=false`. A definição viva atualiza `momento_planejado='sessao_atual'` ao concluir. | **PASSA** |
| Ledger de migration | `supabase_migrations.schema_migrations` registra `20261012134222 / r182_estabilizar_conclusao_encaminhada`. O integrador alinhou o arquivo local para `20261012134222_r182_estabilizar_conclusao_encaminhada.sql`, sem alterar o SQL, e informou reexecução PGlite `8/8`. | **PASSA; divergência de versão reconciliada** |

### 9.2 Gate de uso do procedimento encaminhado

Registro exercitado: evento `e1ac25c8-301b-4a67-ac1d-4df76bc83f23`, Ficha
`242d3edb-791c-408e-873c-0853869d504c`, paciente sintético
`823604f0-ca7f-48fe-bac1-c89e4ffa2baf`, autor `QA Auditoria B`
(`315c0226-005f-42e3-acf2-08d783b4242f`) e destinatário `QA Dentista B2 20261011`
(`efd134ee-7b8e-4537-a674-1c66a1a53824`). Antes do gate: `status=indicado`,
`realizado_em=null`, `momento_planejado=proxima_sessao`, sem assinatura ou retirada.

| Critério | Estado | Evidência observável |
| --- | --- | --- |
| Destinatário conclui | **PASSA** | Pela UI do Preview, `Realizado` gravou `status=realizado`, `realizado_em=2026-10-12` e `momento_planejado=sessao_atual`, preservando clínica, paciente, autoria e destino. Log `odontograma_evento.marcado_realizado` às `13:44:34.609615+00`, ator B2 e metadados coerentes. |
| Persistência após recarga | **PASSA** | Após recarga completa, a Ficha exibiu `1/8`, `13%`, estado `Realizado` e última alteração pelo destinatário. Banco permaneceu coerente. |
| Destinatário reabre | **PASSA** | Pela UI, `A fazer` devolveu `status=indicado` e `realizado_em=null`; `momento_planejado` permaneceu `sessao_atual`, sem restaurar a combinação inválida. Log `odontograma_evento.reaberto` às `13:45:12.58544+00`. Após recarga, a Ficha voltou a `0/8`, `0%`. |
| Autoria, destino e trilha | **PASSA** | Estado final preservou autor e destinatário. A trilha contém exatamente, em ordem, `encaminhado`, `marcado_realizado` e `reaberto`; nenhuma tentativa negativa acrescentou log. |
| Outro dentista da clínica | **PASSA** | Cliente autenticado do autor/outro dentista tentou concluir o mesmo evento e recebeu `sem_permissao`; evento antes/depois idêntico e três logs antes/depois. |
| Secretária por API | **PASSA** | Cliente autenticado da secretária QA recebeu `sem_permissao`; efeito zero no evento e na trilha. |
| Secretária pela UI | **PASSA** | No perfil do mesmo paciente, a secretária viu somente Orçamentos, Arquivos e Agenda; não havia aba Prontuário nem controle de conclusão/encaminhamento. |
| Outra clínica | **PASSA** | Dentista autenticado da clínica QA A recebeu `sem_permissao`; efeito zero no evento e na trilha da clínica QA B. |
| Lote com Ficha assinada | **NÃO TESTADO** | Não existia evento encaminhado ao destinatário em Ficha já assinada na clínica QA B. Nenhuma assinatura sintética foi criada apenas para destravar o teste. O gate PGlite isolado informado pelo Executor cobre o contrato estático/dinâmico local, mas não substitui a jornada publicada. |

Conclusão do reteste: **R182-EST-01 continua CONFIRMED como falha histórica, mas a correção
aplicada PASSA no Preview candidato e remove o bloqueio S1 para este caso**. Produção não foi
exercitada nem declarada corrigida.

### 9.3 Retomada limitada de M1

#### Orçamento do procedimento encaminhado — PASSA

- O editor aberto a partir da Ficha original ofereceu exatamente `1` registro clínico ao
  destinatário: `Restauração — D14`. A própria UI informou que os outros `7` pertencem a
  `QA Auditoria B` e só podem ser orçados pelo responsável.
- Foi criado o rascunho sintético `924d9e1d-6581-413b-be3e-2c723f9a3201`, total R$ 130,00,
  Ficha `242d3edb-791c-408e-873c-0853869d504c`, dentista B2 e clínica QA B.
- `orcamento_eventos` contém uma única ligação, com o evento encaminhado
  `e1ac25c8-301b-4a67-ac1d-4df76bc83f23` e item
  `44654238-278f-4b09-bbc4-4590cccf8613`.
- Após recarga, a aba Orçamentos exibiu o rascunho de R$ 130,00 e o item `Restauração — D14`.
  Nenhum evento pertencente ao autor original foi incorporado.

#### Laboratório / protético — PASSA no recorte exercitado

- A secretária QA criou pedido sintético pelo agendamento
  `bb4daa3f-35bb-4370-9104-76ef16827ecc`, paciente QA B, entrega `2026-10-14`, descrição
  explicitamente marcada como QA e destinatário `QA Protetico B 20261011`.
- Banco confirmou pedido `e1076648-baa9-4a02-a434-31d6dfb76180`, clínica, paciente,
  agendamento e protético corretos, inicialmente `status=pendente` e `entregue_em=null`.
- Em sessão autenticada própria, o protético viu o pedido em 14/10, marcou `Entregue` e, após
  recarga completa, a agenda continuou exibindo `Entregue` e zero itens a entregar na semana.
- Banco confirmou `status=entregue`, `entregue_em=2026-10-12 13:56:47.768+00` e atualização às
  `13:56:47.855079+00`.
- A tela clínica do agendamento não apresenta o estado do pedido; por isso retorno adicional à
  secretária nessa superfície ficou **NÃO TESTADO**, sem inferir falha. Persistência e leitura pelo
  destinatário foram comprovadas.

M2 financeiro/UX permaneceu **NÃO TESTADO**, conforme o limite explícito deste adendo.

### 9.4 Achados confirmados adicionais

#### R182-EST-02 — cartão da Ficha permanece visualmente desatualizado até recarga

- **Classificação:** CONFIRMED.
- **Severidade:** S2.
- **Confiança:** alta.
- **Onde:** Ficha do procedimento encaminhado, logo após `Realizado` e logo após `A fazer`.
- **Como reproduzir:** acionar a mudança permitida, aguardar o toast de sucesso e observar o cartão
  aberto antes de recarregar; repetir na reabertura.
- **Esperado:** o cartão refletir imediatamente o estado persistido confirmado pelo toast.
- **Observado:** o toast confirmou sucesso, mas o cartão continuou mostrando o estado anterior;
  somente a recarga exibiu o novo estado.
- **Evidência:** aconteceu nas duas direções; em cada uma, leitura do banco e recarga provaram que a
  escrita estava correta e que a divergência era do estado visual local.
- **Impacto:** pode induzir repetição da ação e reduzir confiança em um registro clínico; existe
  recuperação segura por recarga e não houve perda de dados.
- **Pode ser falso positivo?** Improvável, pois houve sucesso persistido nas duas operações e
  reprodução simétrica antes/depois da recarga.
- **Teste indicado:** teste de componente/jornada que aguarda a resposta da action e valida a
  atualização imediata do cartão, separadamente da persistência após recarga.

#### R182-EST-03 — seletor do pedido ao protético exibe UUID no lugar do nome

- **Classificação:** CONFIRMED.
- **Severidade:** S2.
- **Confiança:** alta.
- **Onde:** Agenda → detalhe do agendamento → Enviar ao protético.
- **Como reproduzir:** abrir o formulário com protético ativo na clínica QA B.
- **Esperado:** identificar o destinatário por nome legível antes de enviar.
- **Observado:** o seletor mostrou `d19b107b-48be-4d4b-8683-05fc45fc423d`; o banco confirmou que o
  UUID corresponde a `QA Protetico B 20261011`.
- **Impacto:** com mais de um protético, a pessoa operadora não consegue distinguir destinos com
  segurança e pode encaminhar o pedido à pessoa errada. Neste ensaio havia um único protético e o
  destino foi conferido no banco.
- **Pode ser falso positivo?** Improvável; o texto visível foi capturado antes do envio e o nome
  legível estava disponível no cadastro vivo.
- **Teste indicado:** renderizar dois protéticos ativos e afirmar nome visível + ID enviado para o
  selecionado.

### 9.5 Cobertura, falsos positivos e próxima ação

Cobertura deste adendo: função e grants vivos; ledger; conclusão, recarga, reabertura, autoria,
destino e logs; negativas autenticadas de outro dentista, secretária e outra clínica com efeito
zero; orçamento do evento encaminhado; pedido e entrega pelo protético com persistência e recarga.

Continuam **NÃO TESTADOS**: lote publicado com Ficha assinada por falta de fixture segura; retorno
do laboratório em uma superfície clínica da secretária; M2 financeiro/UX; qualquer comportamento
funcional da produção `ba5b531`; restore AC-10. Não surgiu falso positivo novo além dos já
registrados na seção 6.

Fila explícita para o Executor/Coordenação:

1. Tratar R182-EST-01 como corrigido no candidato/schema exercitado, sem promover automaticamente
   essa conclusão para produção.
2. Abrir itens próprios para R182-EST-02 e R182-EST-03; não misturá-los com a migration clínica.
3. Se surgir fixture sintética assinada segura, executar somente o gate de lote pendente.
4. Decidir em item próprio se a clínica precisa acompanhar o estado do laboratório fora da agenda
   do protético; este adendo não inventa esse requisito.
5. Manter M2 fora desta entrega até despacho explícito.

## 10. Adendo M2 — orçamento, financeiro e UX do candidato

Este adendo registra o M2 autorizado depois do M1 pós-migration. Ele não converte evidências
anteriores em nova prova: o cenário parcial R-184 já existente foi usado como estado inicial e
recebeu somente as ações novas descritas abaixo. Atuação: **Auditor**. Não houve correção de código,
alteração de ambiente, migration, commit, push, deploy, uso de gateway ou escrita fora dos registros
sintéticos QA B.

### 10.1 Ambiente, estado inicial e objetos vivos

| Camada | Evidência | Estado |
| --- | --- | --- |
| Preview | Mesmo candidato `dpl_33JhdBVmK8Xfnh6ZZ9KSoR8MnuJL`, SHA `2c52879ccb99d0621470a4891b1061eb1ecc064e`. | **PASSA** |
| Banco | Supabase publicado `zenfemoxvwerplrjgfqz`; escritas limitadas aos pacientes e orçamentos QA B identificados neste adendo. | **PASSA** |
| RPC de parcelas | `gerar_parcelas_orcamento(uuid, smallint, date, numeric, numeric, text, text)`, `SECURITY DEFINER`, `search_path=public`, MD5 vivo `b2241bc8c9241d77831aa13e1efd0c01`. | **PASSA como catálogo** |
| RPC R-189 | `registrar_recebimento_orcamento_idempotente(uuid, uuid, numeric, text, date)`, `SECURITY DEFINER`, MD5 vivo `d08ec98dd66b457bf50944e6ae7b4f7b`. | **PASSA como catálogo e jornada** |
| RPC R-194 | `registrar_pagamento_rapido_idempotente(uuid, uuid, text, date)`, `SECURITY DEFINER`, MD5 vivo `060f0d9ec4ec08253bff05f9fb25b50e`. | **PASSA como catálogo; atalho UI NÃO TESTADO** |

Estados iniciais usados:

- orçamento novo `924d9e1d-6581-413b-be3e-2c723f9a3201`: um item de R$ 130,00, não aprovado,
  nenhum recebimento e nenhuma parcela;
- cenário R-184 preexistente `f42e89aa-8359-4823-82c2-3f52cd05a39e`: dois itens de R$ 100,00
  e R$ 200,00, somente o primeiro aprovado, desconto R$ 30,00, valor devido/acordado R$ 70,00,
  R$ 20,00 recebidos e duas previsões de R$ 25,00. A aprovação parcial e a criação histórica desse
  plano foram apenas reabertas e recarregadas; não são apresentadas como nova execução.

### 10.2 Matriz por critério

| Critério | Estado | Estado inicial, ação, esperado/proibido, resposta, persistência e recarga |
| --- | --- | --- |
| AC-04 — validação antes de aprovação | **PASSA** | No orçamento `924d9e1d...`, a chamada autenticada de parcelas antes da aprovação respondeu `orcamento_sem_aprovacao` e não criou pagamento. Esperado: rejeitar sem efeito; proibido plano parcial. |
| AC-04 — repetição segura R-189 | **PASSA** | O recebimento manual de R$ 5,00 criou pagamento `310698f1-93b5-4913-aaa1-a0f40eca9c6a` com operação `3a5ad5e0-8f85-4e35-a09e-d9a87bef5721`. A repetição autenticada com a mesma operação e payload retornou HTTP 200, o mesmo pagamento e `repetida=true`; permaneceu uma única linha para a operação, sem novo log e sem alterar R$ 50,00 recebidos naquele momento. Isso simula perda da primeira resposta sem induzir falha no banco. |
| AC-04 — plano duplicado | **PASSA** | No cenário R-184 com plano já definido, nova chamada respondeu `plano_ja_definido`; contagem e valores permaneceram inalterados. |
| AC-05 — aprovação, entrada, parcelas, recebimento e confirmação | **PASSA no recorte exercitado** | No `924d9e1d...`, aprovação por `Space`, entrada recebida de R$ 20,00 e duas parcelas persistiram; recebimento manual adicional de R$ 10,00 cancelou as duas previsões de R$ 55,00 e criou duas de R$ 50,00, mantendo o devido em R$ 130,00 e o recebido em R$ 30,00. No `f42e89aa...`, confirmação explícita mudou uma previsão de R$ 25,00 para paga, gerou um único log do ator e deixou recebido R$ 45,00/saldo R$ 25,00; depois, R-189 acrescentou R$ 5,00 e a secretária acrescentou R$ 1,00. O consumidor Financeiro, após recarga, exibiu as entradas de R$ 20,00, R$ 10,00, R$ 25,00, R$ 5,00 e R$ 1,00 e as previsões remanescentes. Escolha nativa de primeiro vencimento futuro ficou **NÃO TESTADA**; a aparente divergência inicial foi reclassificada como FALSE_POSITIVE em 10.5. |
| AC-06 — papéis autenticados e efeito zero | **PASSA no recorte** | Dentista dono executou os fluxos UI/API. Secretária da mesma clínica registrou R$ 1,00 via R-189, com `marcado_por_id` próprio. Protético recebeu `sem_permissao` e a operação `30851d62-2a7b-4f61-9c20-cab4bb095cbd` produziu zero pagamentos. As negativas de outro dentista e outra clínica permanecem evidência anterior da seção 9.2; não foram rebatizadas como nova prova. |
| AC-07 — teclado | **PASSA** | `Tab` moveu foco entre os dois checkboxes de aprovação; `Space` aprovou item e confirmou parcela; `Enter` criou cobrança e registrou recebimentos. Estados de loading desabilitaram campos e exibiram `Salvando...`. |
| AC-07 — 390 px | **NÃO PASSA — S2** | Em viewport 390×844, o diálogo financeiro mediu entre 1.197 e 1.247 px, com bordas fora do viewport (`left` entre -436 e -411; `right` entre 786 e 811) e sem largura horizontal rolável no documento. Os controles centrais ainda eram alcançáveis por teclado, mas conteúdo lateral ficava recortado; ver R182-EST-06. |
| AC-07 — light/dark | **PASSA no recorte visual** | O mesmo fluxo foi aberto nos dois temas em 390 px; tokens de fundo/texto alternaram entre `rgb(244,244,246)`/`rgb(9,9,11)` e `rgb(13,13,13)`/`rgb(250,250,250)`. Nenhum erro de console ou hidratação apareceu. A geometria móvel falhou nos dois temas. |
| AC-08 — erro e recuperação | **PASSA no recorte seguro** | Recebimento vazio exibiu `Informe um valor recebido.` e efeito zero. Não foi induzida falha no banco. A repetição R-189 comprovou recuperação idempotente; recarga completa reconciliou valores persistidos. |
| AC-09 — candidato sem S0/S1 | **PASSA no recorte** | Nenhum S0/S1 permaneceu confirmado depois da verificação discriminante de R182-EST-05. Os S2 deste relatório continuam abertos; produção não foi exercitada e este estado não autoriza publicação. |

Estado final dos registros após as escritas autorizadas:

- `924d9e1d...`: um item aprovado, valor devido R$ 130,00, valor pago R$ 30,00, duas previsões
  vigentes de R$ 50,00 e duas previsões anteriores canceladas;
- `f42e89aa...`: dois itens, um aprovado, valor devido R$ 70,00, valor pago R$ 51,00, uma
  previsão pendente de R$ 25,00 e quatro pagamentos realizados. Há três logs financeiros no
  orçamento; a repetição idempotente não acrescentou linha nem log.

### 10.3 Achados confirmados

#### R182-EST-04 — edição de orçamento ligado à Ficha falha por chave estrangeira

- **Classificação:** CONFIRMED.
- **Severidade:** S2.
- **Confiança:** alta.
- **Onde:** orçamento `924d9e1d...`, aberto pela Ficha, modo Editar procedimentos.
- **Como reproduzir:** alterar o item de R$ 130,00 para R$ 100,00, adicionar segundo item manual
  de R$ 200,00 e salvar.
- **Esperado:** substituir/atualizar os itens sem perder os vínculos clínicos; proibido apagar
  referência ainda usada ou persistir parcialmente.
- **Observado:** a UI retornou `update or delete on table "orcamento_itens" violates foreign key
  constraint "orcamento_eventos_item_id_fkey" on table "orcamento_eventos"`.
- **Evidência:** mensagem do servidor na UI e leitura posterior confirmando exatamente um item,
  total R$ 130,00 e vínculo original preservado; não houve escrita parcial.
- **Impacto:** impede editar procedimentos/valores de um rascunho criado a partir da Ficha.
- **Pode ser falso positivo?** Improvável; o erro cita a FK concreta e o estado persistente ficou
  idêntico ao inicial.
- **Teste indicado:** orçamento com `orcamento_eventos` ligado, edição de item e confirmação de
  preservação ou remapeamento atômico do vínculo.

#### R182-EST-06 — diálogo financeiro desktop fica recortado em 390 px

- **Classificação:** CONFIRMED.
- **Severidade:** S2.
- **Confiança:** alta.
- **Onde:** detalhe do orçamento parcial, em light e dark, viewport 390×844.
- **Como reproduzir:** abrir o orçamento `f42e89aa...` em 390 px e medir o diálogo.
- **Esperado:** conteúdo caber no viewport ou oferecer rolagem que alcance todas as regiões;
  proibido deixar colunas fora da área navegável.
- **Observado:** largura entre 1.197 e 1.247 px, bordas centenas de pixels fora do viewport e
  `documentElement.scrollWidth=375`, sem caminho de rolagem horizontal para as regiões cortadas.
- **Impacto:** revisão e conferência financeira ficam incompletas no celular, embora os controles
  centrais testados ainda aceitem teclado.
- **Pode ser falso positivo?** Improvável; medidas DOM e captura visual coincidiram nos dois temas.
- **Teste indicado:** viewport 390 px, ausência de recorte, foco visível e alcance de todos os
  controles e resumos sem rolagem horizontal da página.

#### R182-EST-07 — diálogo financeiro mantém valores anteriores após recebimento confirmado

- **Classificação:** CONFIRMED.
- **Severidade:** S2.
- **Confiança:** alta.
- **Onde:** detalhe do orçamento nos consumidores financeiros `CobrancasPorEtapa` e formulário
  legado de recebimento R-189.
- **Como reproduzir:** registrar recebimento sintético, aguardar toast/sucesso da action e observar
  recebido e saldo no diálogo antes da recarga; conferir banco e reabrir a página.
- **Esperado:** o diálogo refletir imediatamente o valor persistido confirmado pelo servidor;
  proibido manter o resumo anterior depois de anunciar sucesso.
- **Observado:** após R$ 10,00 persistirem, o diálogo continuou em R$ 20,00 recebidos/saldo
  R$ 110,00; a recarga mostrou R$ 30,00/saldo R$ 100,00. Um recebimento R-189 de R$ 5,00 repetiu
  o atraso visual até a recarga.
- **Evidência:** toast de sucesso, leitura do banco e recarga completa convergiram para os valores
  novos; somente o estado imediato do diálogo permaneceu antigo.
- **Impacto:** pode induzir repetição do recebimento e reduzir confiança no saldo financeiro, embora
  a persistência esteja correta e a recarga seja recuperação segura.
- **Pode ser falso positivo?** Improvável; houve reprodução em dois consumidores financeiros e a
  comparação separou resposta, persistência e recarga.
- **Limite causal:** o sintoma se parece com R182-EST-02, mas ocorre em componentes e domínio
  financeiro distintos. Este relatório não afirma causa compartilhada nem classifica como duplicata.
- **Teste indicado:** após sucesso da action, validar resumo e lista de pagamentos no mesmo render;
  depois validar banco e recarga separadamente.

### 10.4 Achados já conhecidos, não duplicados

- **R182-EST-02 — NÃO RETESTADO NO DOMÍNIO CLÍNICO:** permanece restrito ao cartão da Ficha
  descrito na seção 9.4. O achado financeiro deste adendo recebeu o ID próprio R182-EST-07.
- **R182-EST-03 — NÃO RETESTADO:** o seletor de protético não pertence aos fluxos M2; permanece
  confirmado pela seção 9.4, sem nova evidência neste adendo.

### 10.5 Achados não confirmados e falsos positivos

- **R182-EST-05 — FALSE_POSITIVE:** o primeiro ensaio usou `fill("2026-11-01")` no
  `input[type=date]`. A ferramenta alterou o valor DOM visível, mas não o estado React: ao iniciar
  `saving`, o re-render restaurou `hoje` e essa data válida foi enviada. A verificação discriminante,
  sem salvar, repetiu o mecanismo em outro formulário controlado: após `fill`, mudar o número de
  parcelas fez a data voltar ao estado anterior. O código mantém `primeiroVencimento` em `useState`
  e passa esse estado diretamente à action. Portanto banco e recarga com `12/10/2026` não provam
  que uma escolha real do usuário foi ignorada. A seleção nativa de data futura permanece
  **NÃO TESTADA** por limitação da interação automatizada. A verificação foi cancelada; pagamentos
  e logs permaneceram em `5` e `3` no orçamento usado como controle.
- **Atalho R-194 — NÃO TESTADO:** `/dashboard/orcamentos` redirecionou para
  `/dashboard/pacientes`; portanto a jornada do atalho rápido não ficou alcançável. A RPC viva e
  seus contratos de catálogo não substituem a jornada UI.
- **Falha de banco/rede — NÃO TESTADO:** nenhuma falha foi induzida no Supabase publicado. O replay
  R-189 cobriu perda de resposta de forma segura, sem afirmar resiliência a indisponibilidade.
- **Console/hidratação — FALSE_POSITIVE evitado:** não houve `error` ou `warn` no console durante
  os fluxos exercitados; o erro de FK apareceu como resposta de negócio na própria UI.

### 10.6 Cobertura e próxima ação explícita

Coberto: aprovação, criação de cobrança com entrada recebida, parcelas, recebimento manual,
reconciliação das previsões, confirmação explícita de parcela, repetição R-189, plano duplicado,
saldo, logs, Financeiro, dentista/secretária permitidos, protético negado com efeito zero, teclado,
loading, erro de formulário, recarga, 390 px, light/dark e console. Evidência anterior, sem nova
execução: aprovação parcial inicial, outro dentista e outra clínica negados.

Não coberto: atalho UI R-194; gateway; estorno; falha real de banco/rede; carga; restore AC-10;
produção `ba5b531`; auditoria de rotas fora dos fluxos financeiros afetados.

Fila para o Executor/Coordenação:

1. Corrigir R182-EST-04 preservando ou remapeando `orcamento_eventos.item_id` atomicamente; não
   remover a FK como atalho.
2. Tratar R182-EST-07 em item próprio, reconciliando o estado local financeiro
   depois da confirmação do servidor.
3. Adequar o diálogo a 390 px e testar alcance visual/teclado em light e dark.
4. Se a data futura entrar no gate seguinte, exercê-la com seleção nativa real e conferir
   action/RPC, pagamentos, Financeiro e recarga; não transformar este NÃO TESTADO em bug.
5. Decidir como tornar o atalho R-194 alcançável antes de exigir sua jornada UI.

Não publicar ou promover o candidato com base neste adendo. Integração, publicação e aceite do
usuário permanecem estados separados.

## 11. Gate local de auditoria — R-195 e R-196

Gate somente local no checkout compartilhado de 12/10/2026. Atuação: **Auditor**; nenhum código,
dado, commit, push ou deploy foi alterado. Contratos únicos: R-195 e R-196. A Coordenação continua
responsável pela integração.

### 11.1 Verificações executadas

| Contrato / critério | Estado | Evidência e limite |
| --- | --- | --- |
| R-195 — sucesso atualiza cartão e progresso | **PASSA local** | `statusLocalEncaminhado` só é atualizado depois de resposta sem erro; `dadosLocais` alimenta atendimentos, Fichas, boca, pendências e progresso. O teste focal confirmou `indicado → realizado`, `momento_planejado=sessao_atual`, progresso `1/1` e ausência de data clínica inventada. |
| R-195 — falha conserva estado | **PASSA estático; runtime NÃO TESTADO** | O retorno de erro ocorre antes de `setStatusLocalEncaminhado`; portanto não existe sucesso otimista nesse caminho. Não houve action real nem duas identidades neste gate local. |
| R-195 — reabertura e data clínica | **PASSA estático; teste focal incompleto** | Para `indicado`, a projeção local limpa `realizado_em`; para `realizado`, preserva a data recebida e não cria uma local. O teste existente não exerce `realizado → indicado`, mas o ramo foi conferido no diff. Persistência e recarga continuam dependentes do gate Preview. |
| R-195 — novas props após `router.refresh` | **PASSA local** | A projeção guarda a identidade de `dadosDeOrigem`; quando chega um objeto `dados` novo, `refletirStatusEncaminhadoLocal` devolve integralmente o payload do servidor. O teste focal cobre essa troca. |
| R-196 — nome de duas opções e fallback | **PASSA local** | O helper resolve cada ID para o nome correspondente, placeholder sem seleção e fallback explícito para ID ausente; teste focal com duas opções passou. |
| R-196 — ID enviado | **PASSA estático** | `onValueChange` continua gravando o ID em `pedidoProteticoForm.proteticoId`; `handleEnviarProtetico` envia exatamente esse campo para `criarPedidoProtetico`. O helper novo participa somente do rótulo visível. |
| R-196 — novas props após `router.refresh` | **PASSA local após correção focal** | O diff revalidado adiciona `useEffect(() => setProteticosAtivos(proteticos), [proteticos])`. Novas props agora substituem a lista local; seleção ainda válida resolve o nome novo e ID removido cai no fallback explícito, sem trocar silenciosamente o destino. Preview permanece NÃO TESTADO. |
| R-196 — renderizado, teclado, persistência e recarga | **NÃO TESTADO** | O teste existente cobre apenas o helper puro. Não monta o Select, não troca opção por teclado, não chama a Action e não confere banco. |

Comandos locais:

- `pnpm exec tsx --test` nos dois testes focais: **PASSA, 3/3**;
- `pnpm exec tsc --noEmit`: **PASSA**;
- a primeira tentativa sem o runtime empacotado falhou com `node: not found`; repetição com o Node
  fornecido pelo workspace executou os gates acima. Essa falha de ambiente não é achado do produto.

### 11.2 Achado revalidado após correção focal

#### R196-GATE-01 — lista e rótulo de protético não acompanham novas props

- **Classificação:** CONFIRMED na primeira leitura; **CORRIGIDO LOCAL / PASSA na reinspeção**.
- **Severidade:** S2.
- **Confiança:** alta.
- **Onde:** `AgendamentosClient`, estado `proteticosAtivos` e efeito de
  `listarProteticosAtivos`.
- **Como reproduzir em teste:** montar com lista A, manter o Client Component montado, rerenderizar
  com lista B como ocorre no merge de `router.refresh` e abrir o seletor.
- **Esperado:** opções e nome fechado refletirem a lista B, preservando o ID selecionado quando ele
  ainda existir e usando fallback quando não existir.
- **Observado inicialmente:** o estado conservava a lista A; `useEffect(..., [])` não rodava
  novamente e não havia sincronização com a prop `proteticos`.
- **Correção revalidada:** efeito dependente de `[proteticos]` atualiza `proteticosAtivos` sempre
  que o novo payload muda a prop. O helper continua resolvendo nome a partir dessa lista e o ID
  enviado permanece `pedidoProteticoForm.proteticoId`.
- **Impacto original:** cadastro/remoção/renomeação recebido pelo novo payload podia não aparecer
  até remount ou recarga completa; a sincronização focal remove esse estado obsoleto no diff local.
- **Risco residual:** seleção removida permanece no formulário até nova escolha, mas o rótulo
  explícito `Protético indisponível` evita nome enganoso e o servidor continua validando o ID.
- **Teste indicado:** rerender com novas props, duas opções, seleção por teclado, nome fechado e
  confirmação de que o ID enviado continua correspondendo ao nome visível.

### 11.3 Resultado e fila

- **R-195:** PASSA no gate local estático/focal; Preview, action real, banco e recarga permanecem
  **NÃO TESTADOS** para esta implementação.
- **R-196:** PASSA no gate local estático após a correção focal; helper, novas props e preservação do
  ID passam. Componente renderizado, teclado, Action, banco e recarga permanecem **NÃO TESTADOS**.

Fila explícita para Implementar/Coordenação:

1. Acrescentar teste de componente/rerender para novas props e seleção por teclado; o teste do
   helper puro não substitui esse gate.
2. Depois da integração, exercer R-195 e R-196 no Preview com UI imediata, banco e recarga antes de
   declarar os itens publicados.

## 12. Gate local de auditoria — R-197

Gate somente leitura no checkout compartilhado de 12/10/2026. Atuação: **Auditor**; nenhum código,
migration, dado real, commit, push ou deploy foi alterado. Contrato único:
`plans/specs/R-197-edicao-valores-orcamento-vinculado.md`. Foram conferidos a migration, a Action,
os dois consumidores, o teste focal, os contratos R-169b/R-172 e, por consultas agregadas e de
catálogo, os helpers e a baseline do Supabase publicado.

### 12.1 Resultado por critério

| Critério | Estado | Evidência e limite |
| --- | --- | --- |
| Atualizar quantidade/preço no lugar, preservar IDs/FK, aplicar desconto e criar um log | **PASSA local** | PGlite: dois itens mantiveram IDs e vínculos em `orcamento_eventos`; subtotal R$ 331, desconto R$ 25, total R$ 306 e um log com antes/depois. A migration usa `UPDATE`, sem DELETE/reinsert. Preview, PostgREST e recarga real não foram exercitados. |
| IDs exatos, versão antiga, omissão, duplicação e item alheio | **PASSA no gate focal** | O teste direto rejeitou os quatro casos e confirmou item/log intactos. O orçamento é travado antes dos itens em ordem de ID; R-169b e R-172 também começam pelo orçamento. Concorrência simultânea real não foi exercitada. |
| Autorização própria da `SECURITY DEFINER` | **PASSA local após segunda correção** | A RPC agora exige diretamente participação ativa `admin/dentista` e perfil ativo `admin/dentista` na mesma clínica, além de responsabilidade pelo orçamento. Outro dentista, secretária, outra clínica, perfil inativo e participação suspensa foram negados com efeito zero. Ver R197-AUD-01 e as reauditorias 12.5–12.6. |
| `search_path`, grants e exposição | **PASSA estático; runtime NÃO TESTADO** | `SECURITY DEFINER SET search_path = public`; `REVOKE` de `public, anon` e `GRANT` somente a `authenticated`. Em produção, `anon` e `authenticated` não têm `CREATE` no schema `public`, e a RPC R-197 ainda não existe. ACL efetiva após migration continua não testada. |
| Falha/rollback sem escrita parcial | **PASSA local** | Além dos negativos de versão/IDs/payload/histórico, uma trigger isolada forçou erro na inserção do log, depois dos `UPDATE`s. A chamada falhou e itens, total, `updated_at` e log voltaram integralmente ao estado anterior. |
| Preservação R-169b | **PASSA local** | Payload SQL nulo, item retirado e composição foram recusados sem log. Inclusão, retirada e renomeação continuam fora da RPC. A jornada incremental renderizada não foi exercitada. |
| Preservação R-172 e histórico comercial | **PASSA no banco focal; UI NÃO TESTADA** | Aprovação por item, valor acordado, assinatura, cobrança e pagamento foram recusados sem log. `status='aprovado'` e `plano_forma` têm guardas estáticas, mas não estão no script focal. O perfil do paciente encaminha histórico à R-172; a rota global legada redireciona para `/dashboard/pacientes`, portanto sua jornada não é alcançável. |
| Resposta confirmada, estado local e recarga nos consumidores | **PASSA estático após correção focal; runtime NÃO TESTADO** | Ambos os consumidores só atualizam total, versão e valores dos mesmos IDs depois de resposta válida e então chamam `router.refresh()`. O consumidor global agora também atualiza `orcamentos` e `selected`, removendo a versão obsoleta detectada na primeira leitura. Não houve browser, Action real nem reload. |
| Tipagem e lint focal | **PASSA** | `tsc --noEmit` terminou sem erro. ESLint dos três arquivos terminou com 0 erros e 31 avisos preexistentes nos dois clientes. |

Comando focal repetido pelo Auditor após a segunda correção:
`ODONTO_PGLITE=... node scripts/test-r197-editar-valores-orcamento-vinculado.mjs` — **7/7 grupos
PASSA**. O mock reproduz a ausência de filtro `ativo` em `get_my_dentista_id()` e o fallback real
de `get_my_role()`, cobrindo separadamente perfil inativo e participação suspensa.

### 12.2 Achado confirmado

#### R197-AUD-01 — revogação incompleta permitia alterar valores pela RPC direta

- **Classificação:** CONFIRMED nas duas primeiras versões; **CORRIGIDO LOCAL / PASSA** na segunda
  reauditoria.
- **Severidade original:** S0 — falha de autorização em função `SECURITY DEFINER` que altera dados
  financeiros. Não permanece S0 aberto no diff final revalidado.
- **Confiança:** alta.
- **Onde originalmente:** `20261012143433_r197_editar_valores_orcamento_vinculado.sql`, autorização
  inicial. A versão final revalidada consulta diretamente `clinica_usuarios` e `dentistas` antes do
  lock do orçamento.
- **Como reproduzir a falha anterior:** em banco isolado, usar as definições publicadas dos helpers;
  criar usuário autenticado com `active_clinica_id`, participação `dentista/suspenso`, perfil
  `dentistas.ativo=true` e um orçamento vinculado cujo `dentista_id` seja esse perfil; chamar a RPC
  com versão e lista válidas.
- **Esperado:** `sem_permissao`, itens/total/log intactos.
- **Observado antes da correção final:** a RPC retornou sucesso, total R$ 225 e nova versão; a leitura
  posterior confirmou total R$ 225 e um log. Sem participação ativa, `get_my_role()` publicado usa
  como fallback o papel do perfil ativo e satisfaz a nova guarda.
- **Correção revalidada:** o mesmo cenário agora retorna `sem_permissao`, preserva total R$ 250 e
  mantém zero log. Perfil inativo passa pelo mesmo negativo independente.
- **Evidência independente:** catálogo read-only confirmou helpers, índices e baseline; PGlite com
  a semântica publicada reproduziu primeiro a escrita indevida e, depois da correção final, o efeito
  zero. A RPC ainda não está publicada; não houve exposição desse candidato em produção.
- **Impacto:** uma sessão autenticada de profissional com participação suspensa pode continuar
  alterando quantidade, preço e total de orçamento do qual era responsável enquanto o perfil de
  dentista continuar ativo, contornando a suspensão pela chamada direta ao RPC.
- **Pode ser falso positivo?** O achado original não era falso positivo; foi reproduzido por chamada
  direta. A resolução também foi exercitada diretamente, sem depender da UI/Action.
- **Teste que valida a hipótese:** negativos independentes para (a) participação ativa + perfil
  inativo e (b) participação suspensa + perfil ativo, chamando a RPC como `authenticated` e
  conferindo antes/depois de itens, total e log. O mock deve reproduzir também o fallback real de
  `get_my_role()`.

### 12.3 Achados não confirmados e falsos positivos

- **Concorrência/lock real — NEEDS_EVIDENCE:** a ordem de locks é compatível por inspeção com
  R-169b/R-172, mas não houve duas transações simultâneas nem teste de timeout/deadlock.
- **Replay da mesma versão — NEEDS_EVIDENCE:** o `updated_at` retornado e o lock indicam que a
  repetição com versão antiga deve conflitar, porém o script não repete uma chamada já bem-sucedida.
- **Rollback após escrita parcial — PASSA local:** uma falha forçada na inserção do log reverteu
  itens, total e versão; nenhum log parcial permaneceu.
- **Preço zero na UI — NOT_A_BUG neste gate:** os consumidores filtram preço `<= 0`, enquanto a
  RPC aceita zero. A leitura agregada de produção encontrou zero item ativo de preço zero em
  orçamento vinculado; não houve fluxo válido afetado demonstrado.
- **Estado obsoleto do consumidor global — CORRIGIDO LOCAL:** a primeira leitura mostrou apenas
  `router.refresh()` sobre estado local persistente. A versão revalidada aplica a resposta
  confirmada a `orcamentos` e `selected` antes da recarga; não permanece achado aberto.

### 12.4 Cobertura e próxima ação explícita

Coberto: contrato/migration/Action/consumidores, autorização direta, escopo de clínica, grants e
`search_path`, IDs/FK, desconto, log, negativos de versão/lista/histórico, preservação R-169b/R-172,
estado local pós-resposta, typecheck e lint focal. A produção foi consultada somente por catálogo e
contagens agregadas; nenhuma escrita real ocorreu.

Não coberto: migration aplicada, ACL efetiva pós-migration, PostgREST, duas contas reais, browser,
duas entradas renderizadas, persistência/recarga no Preview, concorrência simultânea, replay após
sucesso, carga, commit, push ou deploy.

Fila explícita para o Executor/Coordenação:

1. A Coordenação pode considerar o gate local de R197-AUD-01 satisfeito e decidir separadamente a
   aplicação da migration em Preview; este relatório não concede essa autorização.
2. No Preview, validar API/RPC com duas contas, perfil inativo, participação suspensa, banco
   antes/depois e recarga dos consumidores.
3. Acrescentar, se exigidos para a promoção, os casos `status='aprovado'`, `plano_forma`, replay da
   versão já consumida e concorrência simultânea.

**Resultado atual do gate:** R-197 **PASSA local com limites**; R197-AUD-01 está corrigido no diff
revalidado. Preview, PostgREST, ACL efetiva, duas contas e recarga continuam **NÃO TESTADOS**. A
ausência da RPC em produção confirma que não houve publicação neste gate.

### 12.5 Reauditoria focal após a primeira correção de R197-AUD-01

Registro histórico da primeira correção, substituído quanto ao estado atual pela seção 12.6.
Estado revalidado no mesmo checkout em 12/10/2026, sem alteração de código ou banco pelo Auditor:

| Recorte | Estado | Evidência |
| --- | --- | --- |
| Perfil `dentistas.ativo=false` com orçamento próprio | **PASSA local** | A nova subquery em `dentistas` exige `ativo=true`; o teste focal alinhou `get_my_dentista_id()` ao helper publicado, recebeu `sem_permissao` e confirmou total R$ 250 e zero log. |
| Participação `clinica_usuarios.status='suspenso'` com perfil ainda ativo | **NÃO PASSA — S0** | Com o fallback real de `get_my_role()` para `dentistas.role`, a RPC retornou sucesso; total mudou de R$ 250 para R$ 225 e foi criado um log. |
| Script focal oficial | **PASSA 6/6, cobertura insuficiente para fechar o S0** | O mock de `get_my_role()` consulta apenas participação ativa e não inclui o fallback publicado; por isso transforma a suspensão em `NULL` e não representa o comportamento real deste caso. |
| TypeScript | **PASSA** | `pnpm exec tsc --noEmit` terminou sem erro depois da correção. |
| Preview/PostgREST/contas reais | **NÃO TESTADO** | A migration continua não aplicada e a RPC não existe em produção. Nenhuma escrita real foi executada. |

Conclusão da reauditoria: a primeira correção remove a variante de perfil inativo, mas não a
variante de participação suspensa. R197-AUD-01 permanece **CONFIRMED / S0** e o gate continua
**NÃO PASSA**.

### 12.6 Reauditoria final de autorização e atomicidade

Estado revalidado no mesmo checkout em 12/10/2026, sem alteração de código ou banco pelo Auditor:

| Recorte | Estado | Evidência |
| --- | --- | --- |
| Participação ativa e papel permitido na clínica | **PASSA local** | A RPC consulta diretamente `clinica_usuarios` por usuário, clínica, `status='ativo'` e papel `admin/dentista`; não usa o fallback de `get_my_role()` como prova de vínculo ativo. |
| Perfil ativo e papel permitido na clínica | **PASSA local** | A RPC exige o `v_actor_id` ligado ao mesmo usuário e clínica, com `dentistas.ativo=true` e papel `admin/dentista`, antes de carregar o orçamento. |
| Responsabilidade e isolamento | **PASSA local** | Depois das duas guardas, o orçamento ainda precisa pertencer à clínica ativa e ter `dentista_id=v_actor_id`. Outro dentista, secretária e outra clínica permanecem negativos com efeito zero. |
| Perfil inativo | **PASSA local** | `sem_permissao`; total R$ 250 e zero log. |
| Participação suspensa com fallback legado de papel | **PASSA local** | O teste confirmou primeiro que `get_my_role()` ainda retorna `dentista`; mesmo assim a consulta direta da RPC respondeu `sem_permissao`, com total R$ 250 e zero log. |
| Atomicidade sob falha tardia | **PASSA local** | Trigger isolada levantou `forced_late_failure` na inserção do log, depois dos updates. Itens, total e `updated_at` ficaram idênticos ao antes; nenhum log permaneceu. |
| Gate focal oficial | **PASSA 7/7** | Inclui sucesso, negativos de payload/versão, R-169b, três identidades, perfil inativo, participação suspensa e histórico R-172. |
| TypeScript | **PASSA** | `pnpm exec tsc --noEmit` terminou sem erro. |
| Schema vivo e terceira variante estrutural | **PASSA no recorte observado** | Há índice único para um perfil por `(clinica_id,user_id)` e índice único parcial para uma participação ativa por `(usuario_id,clinica_id)`. As consultas agregadas encontraram zero duplicidade e, entre 272 orçamentos vinculados, zero sem participação ativa permitida e zero com perfil inativo/papel negado. Nenhum terceiro bypass estrutural evidente foi encontrado. |
| Preview/PostgREST/contas reais | **NÃO TESTADO** | A migration continua não aplicada e a RPC não existe em produção; nenhuma escrita real ocorreu. |

Conclusão final: R197-AUD-01 fica **CORRIGIDO LOCAL / PASSA**. O gate do candidato R-197 passa no
recorte local de autorização e atomicidade. Aplicação em Preview, ACL efetiva, duas contas
autenticadas, browser e recarga permanecem etapas distintas e **NÃO TESTADAS**.

### 12.7 Gate pós-aplicação pela API autenticada

Este registro substitui apenas os limites de runtime das seções 12.1, 12.4 e 12.6. Em
12/10/2026, a migration `20261012150833` já estava aplicada no projeto Supabase
`zenfemoxvwerplrjgfqz`. O Auditor exerceu a função via PostgREST com fixtures novas e sintéticas
na clínica QA B (`53eefdac-401b-484c-8ad4-a6cdd78b1a69`), sem usar portaria da Clindent ou
registro clínico/financeiro real. Marcador da execução válida: `QA R197 POSTGREST b2c5f03c`.

| Critério | Estado | Evidência observada |
| --- | --- | --- |
| Objeto aplicado e superfície de execução | **PASSA** | Catálogo vivo: assinatura `editar_valores_orcamento_vinculado(uuid,jsonb,timestamptz)`, `SECURITY DEFINER`, `search_path=public`; `EXECUTE` presente para `postgres`, `authenticated` e `service_role`, ausente para `PUBLIC`/`anon`. |
| Identidade positiva autenticada | **PASSA** | Conta dentista QA criada para o ensaio autenticou por senha e chamou `/rest/v1/rpc/editar_valores_orcamento_vinculado`; HTTP 200, uma linha retornada, total final R$ 306 e nova versão persistida. |
| Secretária autenticada | **PASSA** | Segunda conta QA recebeu `sem_permissao`; snapshot de orçamento, itens, vínculos e logs permaneceu idêntico ao antes. |
| Participação suspensa com JWT ainda válido | **PASSA** | A participação do dentista QA foi suspensa após autenticação; a mesma sessão recebeu `sem_permissao` e efeito zero. A participação foi restaurada somente para concluir o caso positivo. |
| Lista exata de IDs | **PASSA** | Omissão, duplicação e item pertencente a outro orçamento retornaram, respectivamente, `itens_incompletos`, `item_duplicado` e `item_invalido`; cada tentativa preservou integralmente o snapshot. |
| IDs, FK, valores e desconto | **PASSA** | Dois itens permaneceram com os mesmos IDs; os dois registros de `orcamento_eventos` ficaram byte a byte iguais. Valores finais: 2 × R$ 125,50 e 1 × R$ 80,00; subtotal R$ 331, desconto R$ 25 e total R$ 306. |
| Log único | **PASSA** | Exatamente um `orcamento.editado`, com `alteracao=valores_itens_vinculados`, os dois IDs, `totalAnterior=225` e `totalNovo=306`. |
| Retry com versão consumida | **PASSA** | A repetição com o `updated_at` inicial retornou `conflito`; valores, vínculos e o único log permaneceram inalterados. |
| Limpeza das fixtures | **PASSA** | Depois do ensaio, contagens por prefixo/marcador foram zero em `auth.users`, `users`, `dentistas`, pacientes, fichas, eventos odontológicos e itens. O primeiro ensaio revelou uma dependência de limpeza em `clinica_acessos`; ela foi removida junto às duas identidades sintéticas antes da repetição válida. Isso foi falha do harness de limpeza, sem impacto funcional no produto. |
| Duas entradas de UI, recarga e estado renderizado | **NÃO TESTADO** | Este gate foi direto por PostgREST. Nenhum navegador ou consumidor React foi exercitado após a aplicação. As duas identidades QA eram descartáveis e foram removidas no cleanup; não há sessão ou credencial reutilizável. O gate de browser deverá provisionar novas identidades sintéticas autorizadas. |
| Histórico R-172 e concorrência simultânea | **NÃO TESTADO neste ambiente** | Permanecem cobertos somente pelo gate local focal; não foram criadas fixtures financeiras nem executadas chamadas concorrentes no projeto publicado. |

**Achados confirmados:** nenhum novo achado funcional no gate pós-aplicação. R197-AUD-01 não foi
reproduzido e permanece **CORRIGIDO / PASSA** no caso de participação suspensa.

**Achados não confirmados:** comportamento das duas entradas renderizadas após `router.refresh()`,
histórico R-172 no ambiente publicado e concorrência simultânea permanecem **NEEDS_EVIDENCE**.

**Falsos positivos:** nenhum novo. A falha inicial de limpeza foi isolada ao harness e não deve ser
registrada como defeito do produto.

**Cobertura:** RPC autenticada, duas identidades, suspensão, negativos de lista/versão, atomicidade
observável, IDs/FK, total, log e limpeza sintética. Não cobertos: browser, reload das duas entradas,
histórico financeiro publicado, carga e concorrência simultânea.

**Próxima ação para o Executor/Coordenação:** exercer no Preview as duas entradas de edição com o
mesmo orçamento sintético, conferir estado imediato e após reload, e manter os casos R-172 fora do
fluxo restrito. As contas deste gate não podem ser reaproveitadas; será necessário provisionar novas
identidades QA descartáveis. O gate de API pós-aplicação não bloqueia essa validação de UI.

### 12.8 Gate focal da Action e dos consumidores R-197

Auditoria local, somente leitura, feita depois da conclusão concorrente de R-200. Recorte: Action
`editarValoresOrcamentoVinculado`, consumidor legado `orcamentos-client`, perfil do paciente,
desvio R-172, preservação do rascunho e recarga. A RPC e o banco publicado não foram repetidos.

| Critério | Estado | Evidência e limite |
| --- | --- | --- |
| Action envia orçamento, versão e lista de IDs | **PASSA estático** | Zod exige UUID, versão com offset, quantidade/preço e IDs únicos; o RPC recebe `p_orcamento_id`, `p_versao_esperada` e `{id, quantidade, preco_unitario}`. |
| Consumidor no perfil envia IDs/versão e aplica somente resposta confirmada | **PASSA estático** | Usa `detalheOrc.id`, `detalheOrc.updated_at` e IDs persistidos; só depois de `total`/`updatedAt` válidos atualiza os mesmos itens, fecha a edição e chama `router.refresh()`. |
| Consumidor legado envia IDs/versão e reconcilia lista/detalhe | **PASSA estático** | Usa `selected.id`, `selected.updated_at` e IDs persistidos; atualiza `orcamentos` e `selected` antes de `router.refresh()`. A rota `/dashboard/orcamentos` redireciona para `/dashboard/pacientes`, portanto esse consumidor não é uma segunda entrada alcançável hoje. |
| Erro retornado pela Action preserva rascunho | **PASSA estático** | Nos dois consumidores, `result.error` apenas mostra a mensagem; não limpa itens nem fecha o modo de edição. |
| Histórico financeiro segue R-172 | **NÃO PASSA** | O handler do perfil classifica status aprovado, valor acordado, plano, cobrança, pagamento, aceite ou item aprovado como histórico. O modal só mostra a confirmação de revisão quando há item aprovado, valor pago ou aceite. O descompasso bloqueia estados legados válidos; ver R197-UI-01. |
| Rejeição excepcional da Server Action | **NEEDS_EVIDENCE** | As duas chamadas usam `await` depois de marcar `saving=true`, sem `try/finally`. Se a invocação rejeitar em vez de retornar `{error}`, o reset de `saving` não executa. Nenhuma falha de transporte foi induzida. |
| UI renderizada, recarga e persistência visual | **NÃO TESTADO** | Não há teste de componente para os consumidores e as contas QA descartáveis do gate PostgREST foram removidas. Nenhum browser foi usado nesta rodada. |
| TypeScript e lint focal | **PASSA** | `tsc --noEmit` sem erros; ESLint dos seis arquivos focais com zero erros e 31 avisos preexistentes nos dois clientes. |

Harness temporário fora do repositório: 20 asserções estáticas confirmaram shape da Action,
IDs/versão, ordem de reconciliação/refresh, preservação do rascunho em erro retornado, redirecionamento
da rota global e o descompasso dos predicados de revisão. Nenhum arquivo de teste foi adicionado.

#### R197-UI-01 — confirmação invisível bloqueia revisão R-172 em estados legados

- **Classificação:** CONFIRMED.
- **Severidade:** S2 — bloqueio funcional delimitado; sem escrita indevida, perda de dado ou bypass
  de autorização.
- **Confiança:** alta no caminho de código; browser e incidência no conjunto publicado não testados.
- **Onde:** `paciente-detail-client.tsx`, predicado `temHistoricoFinanceiro` e guarda de confirmação;
  `detalhe-orcamento-modal.tsx`, predicado menor `revisaoObrigatoria` que controla o checkbox.
- **Como reproduzir:** carregar no perfil um orçamento legado com `status='aprovado'`, sem item
  aprovado, pagamento recebido ou aceite; abrir **Editar**, alterar um valor e salvar.
- **Esperado:** a tela identificar revisão R-172, exibir a confirmação exigida e, depois da ação do
  usuário, chamar `revisarOrcamento`.
- **Observado no controle de fluxo:** `revisaoObrigatoria=false`, então o modal mostra “Novo total” e
  não renderiza o checkbox; o handler calcula `temHistoricoFinanceiro=true`, encontra
  `orcEditAceiteConfirmado=false` e retorna “Confirme que a paciente já aceitou esta revisão”. Não há
  controle visível capaz de tornar a condição verdadeira nessa abertura.
- **Evidência:** os dois predicados foram inspecionados e exercitados por fixture sintética no harness
  estático; o status legado é carregado do banco e faz parte explícita do contrato R-172/R-197.
- **Impacto:** a revisão comercial fica presa para orçamentos cuja evidência histórica está em
  `status`, `valor_acordado`, `plano_forma`, cobrança ou pagamento ainda não recebido, mas não nos
  três sinais usados pelo modal.
- **Pode ser falso positivo?** Apenas se houver uma invariante persistente que torne todos esses
  estados impossíveis sem item aprovado, pagamento recebido ou aceite. Nenhuma constraint ou guarda
  desse tipo foi encontrada; `status` é mantido como legado e continua carregado pelo perfil.
- **Teste que valida a hipótese:** teste de componente parametrizado por cada sinal de histórico,
  começando por `status='aprovado'`, que exige rótulo/checkbox de revisão e confirma chamada única a
  `revisarOrcamento` após a confirmação.

#### Achados não confirmados e falsos positivos

- **R197-UI-02 — PROBABLE:** uma rejeição excepcional de `editarValoresOrcamentoVinculado` pode
  deixar `editSaving`/`orcEditSaving` em `true`, com Salvar e Cancelar desabilitados. O código não usa
  `try/finally`, mas nenhuma falha de transporte foi reproduzida; precisa de teste de componente com
  Promise rejeitada antes de subir para CONFIRMED.
- **Consumidor global como segunda entrada — NOT_A_BUG no estado atual:** o código foi revisado por
  preservação, mas `/dashboard/orcamentos` redireciona para o perfil de pacientes e nenhuma outra
  montagem de `OrcamentosClient` foi encontrada. Não tratar a falta de browser nessa tela como falha
  atual de produção.
- **Erro retornado descarta rascunho — FALSE_POSITIVE:** nos dois consumidores, o ramo de erro mantém
  os itens editados e o modo de edição; só a hipótese excepcional R197-UI-02 permanece aberta.

**Cobertura:** Action, payload/versionamento, consumidores, estado local confirmado, erro retornado,
R-172, rota global, typecheck e lint. **Não coberto:** renderização, teclado, rejeição de transporte,
browser, reload real e persistência visual.

**Próxima ação explícita para o Executor:** alinhar a condição que renderiza a revisão/checkbox com a
mesma fonte de verdade usada por `temHistoricoFinanceiro`, sem alterar o contrato R-172; adicionar um
teste focal de componente para os sinais de histórico. Em correção separada, cobrir a Promise
rejeitada com `try/catch/finally`. Depois, o Auditor repete somente este gate UI; não repetir a RPC.

### 12.9 Reauditoria focal de R197-UI-01 e R197-UI-02

Revisão independente, somente leitura, após a correção local. A RPC, o banco publicado e os itens
R-199/R-200 ficaram fora do recorte.

| Recorte | Estado | Evidência e limite |
| --- | --- | --- |
| Fonte de verdade para histórico comercial | **PASSA local** | O helper `exigeRevisaoComercial` reúne os sete sinais contratuais: item aprovado, status legado aprovado, valor acordado, plano, cobrança, pagamento e aceite. |
| Handler e modal usam a mesma decisão | **PASSA local** | `paciente-detail-client` deriva `temHistoricoFinanceiro` pelo helper; `detalhe-orcamento-modal` deriva `revisaoObrigatoria` pelo mesmo helper. O checkbox, rótulo e chamada R-172 deixam de divergir. |
| Caso sem histórico permanece na R-197 | **PASSA local** | A fixture base retorna `false`, preservando a edição restrita de preço/quantidade para orçamento elegível. |
| R197-UI-01 | **CORRIGIDO LOCAL / PASSA** | Teste focal 8/8: caso base mais cada um dos sete sinais. O cenário original `status='aprovado'` agora exige revisão tanto no modal quanto no handler. |
| Rejeição da Action no consumidor do perfil | **PASSA estático; runtime NÃO TESTADO** | A chamada R-197 está em `try/catch/finally`; o `catch` só registra erro de rascunho preservado e o `finally` libera `orcEditSaving`. Não houve montagem de componente com Promise rejeitada. |
| Rejeição da Action no consumidor legado | **PASSA estático; runtime NÃO TESTADO** | Mesmo contrato com `editSaving`; o `catch` não fecha edição nem altera itens e o `finally` libera o estado. A rota continua redirecionada e não foi exercitada. |
| R197-UI-02 | **MITIGADO LOCAL / PASSA ESTÁTICO** | A condição estrutural que sustentava o achado provável foi removida nos dois consumidores. Sem teste renderizado de rejeição, a experiência observada permanece NÃO TESTADA. |
| TypeScript e lint focal | **PASSA** | `tsc --noEmit` sem erros; ESLint dos cinco arquivos focais com zero erros e os mesmos 31 avisos preexistentes nos dois clientes. |

Comandos/evidências: `tsx --test src/lib/orcamentos/exige-revisao-comercial.test.ts` — **8/8**;
harness temporário fora do repositório — **10/10** asserções de integração estática entre helper,
modal, handler e `try/catch/finally`; `tsc --noEmit` e ESLint focal passaram nos limites acima.

**Achados confirmados:** nenhum novo. R197-UI-01 permanece no histórico como defeito confirmado e
fica **CORRIGIDO LOCAL / PASSA** nesta reauditoria.

**Achados não confirmados:** R197-UI-02 não sobe para CONFIRMED; a causa estática foi mitigada. A
rejeição renderizada e o reload real continuam **NÃO TESTADOS**.

**Falsos positivos:** nenhum novo. A preservação do rascunho no `catch` e a liberação do estado no
`finally` estão explícitas nos dois consumidores.

**Cobertura:** sete sinais de histórico, ausência de histórico, uso compartilhado no modal/handler,
tratamento estático de rejeição, typecheck e lint. **Não coberto:** browser, componente montado,
Promise rejeitada em runtime, reload e persistência visual.

**Próxima ação:** R-197 está apta a seguir para o gate de browser/reload com novas identidades QA
sintéticas. Não repetir a RPC; R-199/R-200 seguem para auditoria separada.

### 12.10 Gate dirigido R-199 e R-200

Auditoria local, somente leitura, contra as specs R-199 e R-200 e o diff final compartilhado. Não
houve sessão renderizada, banco, escrita financeira, migration, commit, push ou deploy. R-197 ficou
fora deste recorte.

#### R-199 — diálogo financeiro móvel

| Critério | Estado | Evidência e limite |
| --- | --- | --- |
| Largura e altura móveis declaradas | **PASSA estático** | `w/max-w: calc(100vw - 2rem)` e `max-h: calc(100dvh - 2rem)` limitam o diálogo no breakpoint base. |
| Descendentes podem encolher | **PASSA estático** | Corpo, coluna clínica e coluna financeira têm `min-w-0`; abas mantêm overflow horizontal próprio. |
| Desktop preservado no CSS | **PASSA estático** | A partir de `sm`, permanecem `82vw`, máximo `1280px`, `90vh` e as bases 36%/64%. |
| 390×844 light/dark, toque, rolagem e teclado | **NÃO TESTADO** | Nenhuma sessão sintética ou renderização foi aberta nesta rodada; classes não provam alcance real. |
| Desktop renderizado antes/depois | **NÃO TESTADO** | Preservação foi verificada somente no código. |
| Ação financeira, persistência e reload | **NÃO TESTADO** | Nenhuma escrita foi executada; esse gate pertence ao Preview com fixture sintética. |

**Resultado R-199:** **PASSA no recorte estático**, sem achado confirmado. Gate visual e funcional
permanece **NÃO TESTADO**.

#### R-200 — resumo financeiro após recebimento

| Critério | Estado | Evidência e limite |
| --- | --- | --- |
| Lista autoritativa após R-189 | **PASSA estático** | Depois da RPC idempotente, a Action relê todos os pagamentos do orçamento na mesma clínica; o cliente substitui a lista somente quando ela existe. |
| Cabeçalho/resumo após R-189 | **PASSA local** | `orcamentosState.pagamentos` é a fonte de `deriveEstadoOrcamento` e do resumo financeiro; a reconciliação precede `router.refresh()`. Testes do helper/derivação passaram. |
| Retry R-189 conserva identidade | **PASSA estático** | `pagIntent` é criado uma vez, mantido em erro retryable/ausência de lista/exceção e reutilizado pela próxima chamada; só é limpo em sucesso ou erro definitivo. |
| Sucesso da cobrança por etapa sincroniza etapa e cabeçalho | **PASSA estático** | A Action exige o pagamento recém-criado na releitura da etapa e retorna também a lista completa do orçamento; o componente atualiza `cobrancas` local e o pai atualiza `orcamentosState`. |
| Resposta incerta não faz atualização falsa no mesmo mount | **PASSA estático** | Sem as duas listas confirmadas, não há reconciliação nem toast de sucesso; formulário e valores ficam preservados e o botão da etapa fica desabilitado. |
| Resposta incerta não permite duplicação | **NÃO PASSA — S1** | O bloqueio mora em `cobrancaResultadoDesconhecidoId`, estado local de `CobrancasPorEtapa`. Fechar o diálogo desmonta o componente e perde o bloqueio; reabrir habilita novo envio. A RPC não recebe chave idempotente e insere um novo pagamento em cada chamada válida. Ver R200-AUD-01. |
| Browser, banco antes/depois, UI imediata e reload | **NÃO TESTADO** | Nenhuma sessão QA ou escrita financeira foi usada. |
| Checks locais | **PASSA** | Testes focais e de derivação 12/12; harness independente 16/16; `tsc --noEmit`, ESLint focal e `git diff --check` sem erros. ESLint manteve 27 avisos preexistentes no cliente do paciente. |

#### R200-AUD-01 — fechar e reabrir remove o bloqueio de resultado incerto da etapa

- **Classificação:** CONFIRMED.
- **Severidade:** S1 — risco de duplicação de recebimento financeiro após resposta incerta.
- **Confiança:** alta no controle de fluxo e no contrato SQL; reprodução com banco/browser ficou
  impedida pelo limite desta rodada.
- **Onde:** estado `cobrancaResultadoDesconhecidoId` em `CobrancasPorEtapa`; `onClose` do detalhe
  remove `detalheOrcId` e desmonta o componente; RPC `registrar_recebimento_cobranca` não recebe
  operação idempotente e executa `INSERT` a cada chamada válida.
- **Como reproduzir:** em fixture sintética, registrar R$ 10 numa etapa de R$ 100; fazer a RPC
  persistir e a releitura posterior falhar; observar o botão bloqueado, fechar o diálogo, reabrir o
  mesmo orçamento e reenviar R$ 10.
- **Esperado:** resultado incerto continuar bloqueando qualquer reenvio da mesma intenção até uma
  releitura autoritativa, ou a operação ser reexecutável pela mesma chave idempotente.
- **Observado no código:** dentro do mesmo mount o botão é bloqueado; após desmontar/remontar,
  `useState(null)` apaga essa memória. O segundo envio não contém identidade da primeira operação.
  Com saldo suficiente, a RPC soma o primeiro recebimento e aceita/inserta o segundo.
- **Evidência:** inspeção independente do cliente e do SQL; harness fora do repositório confirmou o
  ciclo mount → resultado incerto → unmount → estado limpo e que 10 + 10 continua abaixo do teto 100.
- **Impacto:** saldo, recebido, caixa e log podem registrar duas entradas quando o usuário segue a
  orientação de fechar/reabrir ou simplesmente reabre o detalhe sem recarregar a fonte autoritativa.
- **Pode ser falso positivo?** Não quanto à perda do bloqueio e à ausência de idempotência. A
  duplicação exige a condição específica “RPC confirmou, releitura falhou” e saldo restante capaz de
  aceitar o segundo valor; por isso incidência real permanece não medida.
- **Teste que valida a hipótese:** teste de componente que simula `outcomeUnknown`, fecha/reabre o
  modal e garante que nenhuma segunda Action é habilitada; gate integrado posterior com RPC sintética
  deve confirmar uma única linha mesmo sob perda de resposta.

#### Achados não confirmados e falsos positivos

- **R-199 corrige o overflow observado — NEEDS_EVIDENCE:** as classes atacam largura/altura e mínimos
  intrínsecos, mas somente medidas DOM em 390×844 light/dark confirmam o efeito.
- **R-200 cabeçalho continua velho após sucesso — FALSE_POSITIVE no recorte local:** a lista
  autoritativa substitui `orcamentosState.pagamentos`, fonte direta do cabeçalho e do resumo.
  Renderização real continua NÃO TESTADA.
- **R-189 cria nova operação no retry — FALSE_POSITIVE:** o cliente preserva `pagIntent.operacaoId`
  nos três caminhos incertos e a reutiliza.
- **Cobrança por etapa faz retry automático — FALSE_POSITIVE:** não há retry automático. O defeito é
  a perda do bloqueio ao desmontar e reabrir, registrada separadamente como R200-AUD-01.

**Cobertura:** contrato responsivo estático, desktop estático, resposta autoritativa, dois
consumidores, derivação do resumo, retry R-189, erro/incerteza e contrato SQL da etapa. **Não
coberto:** DOM renderizado, light/dark, teclado/toque, banco antes/depois, reload, concorrência e
perda de resposta real.

**Próxima ação explícita para o Executor:** tornar o resultado incerto da cobrança por etapa
persistente fora do componente desmontável ou recarregar autoritativamente antes de habilitar novo
envio; a solução não pode reabrir o caminho de duplicação. Depois, repetir somente R200-AUD-01 e os
testes locais. O gate visual R-199 permanece separado para Preview.

### 12.11 Gate de browser no Preview — R-197 e R-199

Ambiente: Preview Vercel `dpl_GD2g32dDQSUnySRm64oRfDckX9pf`, estado `READY`, commit
`5cbd956a4f8c6c136d62fa819c0be236a7661dcf`. A execução usou uma identidade, um paciente e dois
orçamentos novos e sintéticos na clínica QA B. O orçamento R-197 não tinha histórico comercial; o
segundo existiu somente para abrir a superfície R-199. R-200 não foi exercido.

#### R-197 — perfil do paciente, resposta, persistência e conflito

| Critério | Estado | Evidência e limite |
| --- | --- | --- |
| Editar preço e quantidade no perfil | **PASSA** | No orçamento sintético `8d11b03c...`, ITEM A mudou de `1 × R$ 100,00` para `2 × R$ 125,50`; ITEM B, de `3 × R$ 50,00` para `1 × R$ 80,00`. O total renderizado mudou de R$ 225,00 para R$ 306,00, preservando desconto de R$ 25,00. |
| Estado imediato no modal e no cartão | **PASSA** | Após a resposta confirmada, o modal saiu da edição com os valores novos e o cartão do perfil passou a exibir R$ 306,00, `×2`, R$ 251,00 e R$ 80,00 antes da recarga. |
| Banco, IDs/FK e log | **PASSA** | Leitura administrativa delimitada confirmou os mesmos dois itens, dois vínculos `orcamento_eventos`, total 306 e exatamente um `orcamento.editado` com antes/depois. |
| Recarga completa | **PASSA** | Depois de reload do perfil, o cartão e o detalhe reapareceram com quantidade, preços e total novos. |
| Versão antiga e rascunho | **PASSA** | Uma segunda aba abriu a mesma versão, manteve rascunho `4 × 70` e `2 × 60` e tentou salvar depois da primeira. A UI mostrou “Este orçamento mudou em outra tela...” e preservou os campos; banco e log permaneceram no único sucesso. |
| Rejeição excepcional de transporte | **NÃO TESTADO** | O conflito funcional foi exercitado; não foi induzida queda de rede/Promise rejeitada. R197-UI-02 segue com evidência estática, não renderizada. |
| Entrada global `/dashboard/orcamentos` | **NÃO TESTADO** | A rota redireciona para o perfil e não foi usada como uma segunda superfície fictícia. |

**Resultado R-197:** **PASSA no Preview pela entrada real do perfil**, incluindo resposta imediata,
persistência, reload, conflito de versão, rascunho preservado e efeito único. Nenhum novo achado foi
confirmado.

#### R-199 — diálogo financeiro renderizado

| Critério | Estado | Evidência e limite |
| --- | --- | --- |
| Desktop dark | **PASSA** | Em 1280×720, diálogo `1037,3 × 492,66`, limites `left=113,75`, `right=1151,05`, `top=113,67`, `bottom=606,33`; `document.scrollWidth=1265 ≤ 1280`. Fundo/texto: `rgb(13,13,13)` / `rgb(250,250,250)`. |
| Desktop light | **PASSA** | Mesma geometria, sem recorte horizontal; fundo/texto: `rgb(244,244,246)` / `rgb(9,9,11)`. |
| Teclado no desktop | **PASSA no recorte** | `Tab` alcançou, com bounding box visível, aba Procedimentos, aprovação, Registrar recebimento, Editar etapa, Cancelar, Excluir, Revisar orçamento, switch e Fechar; não foi acionada operação financeira. |
| Console | **PASSA** | Zero warning/error capturado na sessão após abrir, alternar tema e percorrer os controles. |
| 390×844 light/dark, toque e rolagem | **NÃO TESTADO — verificação impedida** | O controle de viewport foi solicitado para 390×844, inclusive antes de nova aba e após reload, mas a página continuou reportando `innerWidth=1280` e `innerHeight=720`. O conector Chrome alternativo estava indisponível. Sem viewport real, não há medida válida do reparo móvel. |
| Ação financeira, persistência e reload | **NÃO TESTADO por limite do recorte** | Nenhuma ação de R-199/R-200 foi disparada; os três pagamentos sintéticos serviram somente para renderizar a etapa. |

**Resultado R-199:** desktop e teclado **PASSAM** no Preview, mas o critério central de 390×844
permanece **NÃO TESTADO**. A hipótese “R-199 corrige o overflow móvel” continua
`NEEDS_EVIDENCE`; a falha do controlador de viewport não é achado do produto.

#### Achados, falsos positivos, cobertura e limpeza

- **Achados confirmados:** nenhum novo em R-197 ou R-199.
- **Achados não confirmados:** R-199 em 390×844 permanece `NEEDS_EVIDENCE`; a rejeição excepcional
  de transporte de R-197 continua sem reprodução.
- **Falso positivo evitado:** não inferir viewport móvel a partir das classes nem da solicitação de
  emulação; a medição continuou 1280×720 e foi descartada.
- **Cobertura:** R-197 pelo perfil, estado imediato, banco, reload e conflito; R-199 desktop
  light/dark, geometria, teclado e console. Fora: entrada global redirecionada, transporte quebrado,
  390×844, toque, rolagem móvel e qualquer ação R-200.
- **Limpeza:** **PASSA** — zero paciente, orçamento, pagamento, cobrança, vínculo de usuário, perfil
  e usuário público sintéticos remanescentes; a conta Auth também foi removida.

**Próxima ação:** repetir apenas R-199 em um navegador que aplique viewport 390×844, nos dois temas,
medindo retângulo do diálogo, largura rolável, alcance por rolagem/toque e foco. R-197 não precisa de
novo replay salvo mudança posterior no consumidor ou no contrato.

### 12.12 Reauditoria focal de R200-AUD-01

Revisão somente leitura do código local final. O recorte foi o bloqueio de resultado incerto da
cobrança por etapa, sua duração ao fechar/reabrir o detalhe e durante `router.refresh`, os caminhos de
sucesso/erro e a ausência de retry automático. Não houve browser, banco, escrita financeira nem
alteração de código.

| Critério | Estado | Evidência e limite |
| --- | --- | --- |
| Estado fora do componente desmontável | **PASSA estático** | `cobrancasComResultadoIncerto` pertence a `PacienteDetailClient`; `CobrancasPorEtapa` recebe o conjunto e callback por props. Fechar o detalhe limpa `detalheOrcId` e estados do formulário, mas não limpa o conjunto. |
| Fechar e reabrir o mesmo orçamento | **PASSA estático** | O filho pode ser desmontado, porém o pai conserva o `Set`; ao reabrir, a mesma cobrança volta com `resultadoDesconhecido=true`. O botão externo fica desabilitado e exibe `Recarregue para confirmar`. |
| Persistência durante `router.refresh()` | **PASSA estático** | Não existe setter de limpeza no refresh. A documentação local do Next 16 confirma que `router.refresh()` mescla o novo payload RSC sem perder `useState` do Client Component não afetado. |
| Limpeza somente em reload completo | **PASSA estrutural** | O conjunto nasce de `useState(() => new Set())` e não possui caminho de reset. Um reload completo recria `PacienteDetailClient` e o estado vazio; close/reopen e `router.refresh()` não o recriam. |
| Todos os resultados incertos bloqueiam | **PASSA estático** | `outcomeUnknown`, ausência de uma das listas confirmadas e exceção da Action chamam `onCobrancaResultadoIncerto(cobrancaId)`. O formulário e o botão externo impedem novo `registrar` para a cobrança bloqueada. |
| Erro definitivo preserva retry permitido | **PASSA estático** | Erro retornado sem `outcomeUnknown` mostra a mensagem e preserva campos sem adicionar bloqueio; a RPC informou falha antes de qualquer confirmação autoritativa. |
| Sucesso confirmado | **PASSA local/estático** | Sucesso exige pagamento retornado nas listas da etapa e do orçamento; o cliente reconcilia as duas superfícies antes de limpar o formulário, emitir toast e chamar `router.refresh()`. |
| Ausência de retry automático | **PASSA estático** | `registrar` contém uma única chamada a `registrarRecebimentoCobranca`; não há laço, recursão ou segunda chamada. A Action contém uma única chamada à RPC `registrar_recebimento_cobranca`. |
| Botões após resultado incerto | **PASSA estático** | Tanto `Registrar` dentro do formulário quanto `Registrar recebimento` na etapa usam `disabled={... || resultadoDesconhecido}` e trocam o rótulo para `Recarregue para confirmar`; fora do formulário também há alerta com `role="alert"`. |
| Teste focal | **PASSA com limite** | 4/4: dois testes do helper de bloqueio e dois da reconciliação. O primeiro modela close/reopen reutilizando o mesmo conjunto; não monta pai/modal nem prova o evento React em runtime. |
| Tipos e lint focal | **PASSA** | `tsc --noEmit` passou; ESLint dos sete arquivos focais terminou com zero erros e 27 avisos preexistentes no cliente do paciente. |
| Componente, browser, banco e perda real de resposta | **NÃO TESTADO** | Nenhum componente foi montado e nenhuma RPC foi executada nesta reauditoria. Persistência de um único pagamento sob resposta perdida continua sem prova integrada. |

#### Reclassificação do achado

- **R200-AUD-01:** permanece no histórico como defeito **CONFIRMED S1**, agora
  **CORRIGIDO LOCAL / PASSA NO RECORTE ESTÁTICO**.
- **Confiança:** alta para propriedade do estado, props, botões e ausência de retry; média para o
  comportamento renderizado até existir teste de componente ou browser.
- **Pode ser falso positivo na reauditoria?** Não há caminho de limpeza em close/reopen ou
  `router.refresh`; a documentação do framework confirma a preservação de `useState`. Uma remontagem
  externa imprevista do `PacienteDetailClient` não foi exercitada e fica no limite de runtime.

#### Achados não confirmados e falsos positivos

- **`router.refresh()` apaga o bloqueio — NOT_A_BUG no código atual:** o estado mora no Client
  Component pai e o Next 16 preserva o `useState` não afetado durante a fusão do payload RSC.
- **Erro definitivo bloqueia uma tentativa segura — FALSE_POSITIVE:** somente os três caminhos de
  resultado incerto adicionam a cobrança ao conjunto.
- **O teste focal sozinho prova o fluxo React — FALSE_POSITIVE:** ele valida o helper e a
  reconciliação, mas não desmonta/remonta componentes reais; a conclusão estática depende também da
  inspeção das props, do `onClose` e dos dois botões.

**Cobertura:** propriedade e ciclo do estado, props, close/reopen, `router.refresh`, reload completo,
três caminhos incertos, erro definitivo, sucesso confirmado, dois botões, alerta, ausência de retry,
teste focal, tipos e lint. **Não coberto:** React montado, browser, RPC, persistência, reload real e
perda de resposta integrada.

**Próxima ação:** não há nova correção para o Executor neste recorte. Antes de considerar o S1
encerrado em runtime, adicionar ou executar teste de componente que monte o pai, force
`outcomeUnknown`, feche/reabra e faça `router.refresh`, verificando que nenhuma segunda Action fica
habilitada; depois, se autorizado, repetir com RPC e dados sintéticos sob perda controlada de
resposta.
