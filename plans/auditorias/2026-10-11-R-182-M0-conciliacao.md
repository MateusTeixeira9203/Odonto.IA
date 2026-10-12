# R-182 M0 — conciliação de versão, riscos e condições de QA

**Data:** 11/10/2026, leitura concluída às 17:27 BRT. **Escopo:** somente M0 e AC-01.
Nenhuma correção, RPC de negócio, escrita no banco, fixture, commit, push, deploy ou migration.

## Resultado do marco

O deployment efetivo de `odontoia.app`, a `main` remota e o código base do checkout coincidem
no SHA `ba5b531164c2983b991de27a96f94668fbb7ebda`. O deployment
`dpl_FBHKryftZvhHn7Nz7Sy22LdK7bos` está `READY`, em `iad1`, e `/` e `/login` responderam
HTTP 200. Isso identifica o artefato; não certifica jornadas autenticadas.

O Supabase `zenfemoxvwerplrjgfqz` está `ACTIVE_HEALTHY`, Postgres 17.6, em `sa-east-1`.
O catálogo real foi lido diretamente. Ele não é reproduzível pelo conteúdo atual da `main`:
o ledger contém migrations sem SQL correspondente no repositório e há objetos vivos de
governança, estoque e apoio financeiro sem criação disponível nessa base.

| Parte de AC-01 | Estado | Evidência e limite |
| --- | --- | --- |
| Alias, deployment, região e SHA efetivos | **PASSA** | Vercel autenticada + alias; manifesto anexo. |
| `origin/main`, HEAD base e deployment comparados | **PASSA** | Todos em `ba5b531…`; checkout tem documentação alheia preservada. |
| Catálogo real e objetos centrais lidos | **PASSA** | 78 tabelas, 109 funções, 89 policies, 72 triggers, 304 índices e 1 view. |
| Equivalência `main` ↔ schema efetivo | **NÃO PASSA** | Drift de fonte confirmado; ledger não substitui SQL reproduzível. |
| Ambiente isolado pronto para M1/M3 | **NÃO PASSA** | Nenhum branch Supabase; fixtures antigas do R-188 não são reutilizáveis. |
| Jornadas autenticadas e persistência atuais | **NÃO TESTADO** | Fora do M0; nenhuma operação de negócio foi chamada. |

## Achados confirmados

### M0-C01 — R-188 permanece ativo na RPC de parcelas

1. **Onde:** `public.gerar_parcelas_orcamento(uuid,smallint,date,numeric,numeric,text,text)`.
2. **Como reproduzir:** em ambiente autorizado, orçamento sintético novo de A e B autenticado
   como outro dentista ativo da mesma clínica; B chama a RPC diretamente com o ID de A.
3. **Esperado:** `sem_permissao`, nenhuma linha financeira retornada e zero alteração.
4. **Observado:** em 08/10, B recebeu HTTP 200, duas parcelas de A e alterou o plano. Em 11/10,
   a função ativa tem exatamente o mesmo fingerprint `e21635ef…` e os mesmos grants.
5. **Evidência:** relatório R-188 de 08/10, antes/depois preservado, catálogo atual e anexo.
6. **Impacto:** leitura e alteração financeira indevidas entre profissionais da mesma clínica.
7. **Severidade:** **S1**.
8. **Confiança:** alta; exploração anterior + identidade byte a byte do objeto efetivo.
9. **Pode ser falso positivo:** improvável. Não houve reexecução porque M0 proíbe escrita; uma
   alteração externa equivalente teria mudado o fingerprint ou a guarda do corpo.
10. **Teste:** existe reprodução autenticada de 08/10; falta o gate pós-correção com fixture nova.

Classificação: **CONFIRMED**. A autorização histórica de correção não é evidência de aplicação.

### M0-C02 — R-184 continua calculando a primeira previsão pelo total/acordo antigo

1. **Onde:** mesma RPC, expressão `coalesce(p_valor_acordado, valor_acordado, total)`; o perfil
   do paciente chama `gerarParcelas` sem `valorAcordado` na primeira previsão.
2. **Como reproduzir:** fixture sintética 100+200, desconto 30, item aprovado 100 e pago 20;
   criar a primeira previsão sem plano anterior.
3. **Esperado:** previsão total 50 e devido 70.
4. **Observado:** em 06/10, previsão 250 e acordo 270. O corpo da RPC e os chamadores relevantes
   do deployment atual são os mesmos do ensaio.
5. **Evidência:** auditoria de 06/10, fingerprint atual `e21635ef…`, diff Git vazio nesses caminhos.
6. **Impacto:** previsão e saldo financeiro inflados e persistidos.
7. **Severidade:** **S1**.
8. **Confiança:** alta; resultado persistido anterior + mecanismo atual inalterado.
9. **Pode ser falso positivo:** somente se a regra de produto mudou para cobrar itens não aprovados,
   o que contradiz o contrato e a UI atuais.
10. **Teste:** há jornada histórica com reload; falta repetição pós-correção na versão candidata.

Classificação: **CONFIRMED**.

### M0-C03 — R-189 mantém retry de recebimento sem chave idempotente

1. **Onde:** `public.registrar_recebimento_orcamento` e Server Action `registrarPagamento`.
2. **Como reproduzir:** repetir a mesma operação sintética de recebimento com a mesma intenção.
3. **Esperado:** mesmo resultado/ID, sem segundo lançamento.
4. **Observado:** em 06/10, duas chamadas iguais geraram dois IDs pagos; o objeto atual mantém
   fingerprint `7dd39fba…`, idêntico ao snapshot reproduzido.
5. **Evidência:** auditoria e catálogo de 06/10 comparados ao catálogo de 11/10.
6. **Impacto:** receita e saldo podem ser duplicados por retry/reenvio.
7. **Severidade:** **S1**.
8. **Confiança:** alta para retry sequencial; concorrência ampla ainda não foi provada.
9. **Pode ser falso positivo:** uma segunda intenção legítima é permitida, mas o cenário histórico
   repetiu a mesma operação sem chave capaz de distinguir intenção de retry.
10. **Teste:** existe reprodução sequencial; corrida com dois clientes permanece não testada.

Classificação: **CONFIRMED** para retry repetido; **NEEDS_EVIDENCE** para corridas adicionais.

### M0-C04 — R-146 continua descartando `ag` explícito e escolhendo outro paciente

1. **Onde:** `meu-dia/page.tsx:55` e `meu-dia-client.tsx:165-175`.
2. **Como reproduzir:** abrir Meu Dia com `?ag=` passado/futuro ou fora dos slots de hoje quando
   existe outro slot elegível.
3. **Esperado:** destino exato ou erro explícito, sem fallback.
4. **Observado:** o servidor remove o ID e o cliente seleciona atendimento/em espera/próximo slot.
   A auditoria anterior reproduziu troca de paciente; os arquivos não mudaram entre o SHA
   histórico `b63775f…` e o deployment atual.
5. **Evidência:** código publicado, diff Git por caminho e auditoria R-182 de 03/10.
6. **Impacto:** painel clínico de paciente diferente do agendamento explicitamente aberto.
7. **Severidade:** **S1**.
8. **Confiança:** alta para o fallback; qualquer escrita sob contexto errado não foi reexecutada.
9. **Pode ser falso positivo:** não para seleção; o comportamento é determinístico no código.
10. **Teste:** reprodução histórica existe; gate completo R-146 foi local, reprovado e retirado.

Classificação: **CONFIRMED** para seleção incorreta; efeitos de gravação atuais **NEEDS_EVIDENCE**.

### M0-C05 — a fonte de migrations da `main` não representa o schema vivo

1. **Onde:** `supabase/migrations/`, ledger remoto e catálogo do projeto.
2. **Como reproduzir:** comparar nomes do ledger, SQL versionado e objetos vivos.
3. **Esperado:** toda migration necessária ao schema efetivo disponível e ordenável na `main`.
4. **Observado:** o ledger possui entradas R-181 ausentes da `main`; objetos correspondentes e
   outras tabelas de governança/estoque/financeiro estão vivos sem seu SQL de criação nessa base.
5. **Evidência:** listagem remota de migrations, catálogo real e busca no SHA publicado.
6. **Impacto:** recuperação, ambiente limpo e investigação de drift não são reproduzíveis pela main.
7. **Severidade:** **S2** operacional; sobe se recuperação for necessária durante incidente.
8. **Confiança:** alta para a ausência da fonte; restauração completa não foi ensaiada.
9. **Pode ser falso positivo:** não para o drift. Pode haver fonte fora do repositório, mas ela não
   torna a `main` reproduzível.
10. **Teste:** comparação passa; restore em banco vazio continua não testado.

Classificação: **CONFIRMED** para drift; capacidade real de restore **NEEDS_EVIDENCE**.

## Achados não confirmados

### M0-N01 — R-190, save de Ficha pode terminar parcialmente

1. **Onde:** `salvarFicha` atualiza/cria Ficha e finaliza eventos em passos separados.
2. **Como reproduzir:** falha controlada após Ficha e antes/durante eventos, seguida de retry.
3. **Esperado:** uma Ficha, estado explícito e retomada sem duplicação/perda.
4. **Observado:** estrutura não atômica no código; duplicação após falha não foi exercitada.
5. **Evidência:** código atual e relatório de 06/10.
6. **Impacto:** possível sucesso parcial ou Ficha duplicada.
7. **Severidade:** potencial **S1**.
8. **Confiança:** média.
9. **Pode ser falso positivo:** sim; controles de retry podem impedir o efeito em alguns caminhos.
10. **Teste:** inexistente para falha pós-commit; requer ambiente isolado.

Classificação: **PROBABLE**.

### M0-N02 — R-191, edição de orçamento tem janela DELETE/INSERT

1. **Onde:** `editarOrcamento`, delete em `orcamento_itens` seguido de insert e update.
2. **Como reproduzir:** falhar o segundo passo em orçamento sintético editável.
3. **Esperado:** composição anterior integral.
4. **Observado:** passos independentes; o caminho destrutivo não foi executado.
5. **Evidência:** código atual inalterado desde o levantamento de 06/10.
6. **Impacto:** possível orçamento vazio/parcial e vínculos inconsistentes.
7. **Severidade:** potencial **S1**.
8. **Confiança:** média-alta no risco estrutural, baixa no efeito observado.
9. **Pode ser falso positivo:** sim, se outra contenção externa sempre reparar a falha.
10. **Teste:** ausente; exige banco isolado e falha controlada.

Classificação: **PROBABLE**.

### M0-N03 — cobertura de papéis, sessão revogada e isolamento completo

1. **Onde:** M1/M3, RLS, handlers e RPCs do core.
2. **Como reproduzir:** duas sessões reais por papel e clínica, positivas/negativas diretas.
3. **Esperado:** acesso mínimo e zero efeito em negativas.
4. **Observado:** catálogo mostra RLS nas tabelas amostradas, sem prova da correção das policies.
5. **Evidência:** somente metadados e cobertura histórica parcial.
6. **Impacto:** exposição ou escrita cruzada pode permanecer em superfícies não exercitadas.
7. **Severidade:** potencial **S1**.
8. **Confiança:** indeterminada.
9. **Pode ser falso positivo:** sim; ausência de teste não prova vulnerabilidade.
10. **Teste:** não existe cobertura atual completa.

Classificação: **NEEDS_EVIDENCE**.

## Falsos positivos e alegações descartadas

- **NOT_A_BUG atual:** a regressão transitória “painel B sob URL A” pertenceu a uma tentativa
  local do R-146, foi retirada e não está no SHA publicado. Não confundir com o fallback original,
  que permanece confirmado.
- **NOT_A_BUG atual:** R-185 foi um defeito real, mas o deployment atual inclui o commit
  `2ff31a1`; o gate dirigido publicado em 06/10 passou. Isso não certifica toda a Ficha.
- **FALSE_POSITIVE como prova:** `READY`, HTTP 200, RLS habilitada ou uma migration listada não
  demonstram estabilidade funcional, autorização correta nem reconstrução do banco.

## Condições de QA

Não há branch Supabase isolado. As duas contas QA e o paciente sintético conhecido existem,
mas o vínculo temporário da conta B na clínica A está `removido` e o perfil temporário está
inativo. Os três orçamentos do ensaio R-188 permanecem, todos com plano; nenhum serve para
repetir o exploit porque `plano_ja_definido` mascararia a guarda.

Qualquer próximo gate com escrita precisa de autorização própria, fixture nova e efeitos
delimitados. Deve usar duas sessões autenticadas, resposta + antes/depois + reload, sem
`service_role` como prova e sem envio de e-mail/WhatsApp, gateway ou IA paga.

## Cobertura

Auditado: alias/deployment/SHA, `origin/main`, catálogo e fingerprints das funções centrais,
RLS/policy presence em 15 tabelas, ledger/migrations, disponibilidade de branch e condições
das fixtures sintéticas conhecidas. Não auditado: jornadas autenticadas atuais, conteúdo de
policies, todos os papéis/RPCs, storage/PDF, mobile, integrações externas, concorrência,
restauração e AC-02 a AC-10.

## Próxima ação para o Executor

1. Abrir recorte exclusivo R-188 a partir da `main` atual, reconfirmar autorização operacional
   e aplicar a contenção dentro da RPC antes de qualquer outra jornada financeira.
2. Preparar fixture nova e gate com duas identidades; não reutilizar os três orçamentos antigos.
3. Depois do R-188, executar R-184 e R-189 como recortes separados. R-146 precisa de nova decisão
   de arquitetura antes de outra tentativa. R-192 precisa de ambiente isolado para restore.

Anexos: [manifesto](evidencias-2026-10-11-R-182-M0/manifesto.json),
[catálogo sanitizado](evidencias-2026-10-11-R-182-M0/catalogo-sanitizado.json) e
[condições de QA](evidencias-2026-10-11-R-182-M0/condicoes-qa.json).
