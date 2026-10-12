# R-188 — contenção da autorização na RPC de parcelas

STATUS: ACTIVE
OWNER: Coordenação — decisão e integração; Executor — correção após despacho
LAST_REVIEWED: 2026-10-11
REPLACES: contrato R-188 do acervo preservado, conciliado com o M0 atual
CANONICAL_FOR: contrato da correção local de autorização de parcelas; aplicação separada

## Problema confirmado

O [M0](../auditorias/2026-10-11-R-182-M0-conciliacao.md) encontrou no banco publicado
a mesma função `public.gerar_parcelas_orcamento(uuid,smallint,date,numeric,numeric,text,text)`
explorada em 08/10: `SECURITY DEFINER`, execução por `authenticated`, sem comparar o
chamador a `orcamentos.dentista_id`. Na reprodução anterior, outro dentista da mesma
clínica criou e recebeu parcelas do orçamento alheio. A função não foi reexecutada no M0.

Este contrato recupera somente o recorte R-188; não transporta autorização histórica de
aplicação nem mistura cálculo R-184 ou repetição R-189. A nova direção de clínicas geridas
não amplia as permissões financeiras atuais.

## Suspensão temporária rejeitada neste ciclo — referência de contingência

Se a prioridade for interromper a exposição antes da correção completa, suspender
temporariamente a execução da RPC para `authenticated` no banco publicado:

```sql
revoke execute on function public.gerar_parcelas_orcamento(
  uuid, smallint, date, numeric, numeric, text, text
) from authenticated;
```

O M0 confirmou que `anon` já não executa a função. **Impacto:** todos os usuários deixam de
gerar novos parcelamentos, inclusive os legítimos; o botão atual poderá exibir erro. Os planos
e pagamentos já gravados não são apagados por esse `REVOKE`. Não afirmar que outras
operações financeiras ficam suspensas. Não executar sem autorização expressa para esta pausa.

Antes da operação, conferir assinatura, grants e fingerprint efetivos; registrar os valores.
Depois, conferir `has_function_privilege('authenticated',
'public.gerar_parcelas_orcamento(uuid,smallint,date,numeric,numeric,text,text)', 'EXECUTE')`
como falso e exercitar apenas uma chamada negativa segura, sem escrita, se ambiente permitir.
Não restaurar `EXECUTE` para o corpo vulnerável como rollback. Se a pausa não for aprovada,
preparar a guarda diretamente; a exposição permanece até aplicação e gate da correção.

## Correção definitiva — recorte único

Preparar migration que substitua somente o corpo da função, preservando assinatura,
retorno, cálculo, grants intencionais e efeito para usuários autorizados. A guarda deve
executar **antes** de checar plano existente, escrever ou retornar pagamentos:

1. Identificar `auth.uid()` e a clínica ativa sem aceitar IDs de autor/clínica fornecidos
   pelo cliente como autorização.
2. Confirmar vínculo ativo e perfil ativo na clínica do orçamento. Não tomar perfil como
   substituto de vínculo nem confiar só nos helpers atuais.
3. Para admin/dentista, exigir que o perfil do chamador seja o `orcamentos.dentista_id`.
   Preservar acesso operacional da secretária ativa da mesma clínica conforme contrato vigente.
   Negar demais papéis e clínicas.
4. Negar com `sem_permissao`, sem dados do orçamento nem mutação. Usar a mesma negativa
   para orçamento alheio com e sem plano.
5. Alinhar a Server Action `gerarParcelas` à regra; a guarda no banco continua obrigatória
   porque a RPC pode ser chamada diretamente.

A função efetiva deve ser capturada antes de editar, porque o schema vivo difere da fonte
reconstruível na `main`. Não reaplicar migrations antigas em lote. Em caso de dúvida sobre
perfis/vínculos reais, pausar implementação e revisar o contrato, sem adivinhar colunas.

## Gate antes de reabrir a execução

Ambiente e dados sintéticos delimitados, duas contas autenticadas com JWT próprio:
titular autorizado; outro profissional da mesma clínica; outra clínica; secretária
autorizada; perfis e vínculos inativos; sessão revogada; papel desconhecido. Para cada caso,
resposta, linhas antes/depois e recarga. Negativas: nenhum retorno sensível e zero mutação.
Positivos: apenas orçamento e parcelas do titular esperado. Fixture **nova**, pois os três
orçamentos anteriores já têm plano e mascarariam a falha. `service_role` não prova
autorização. Preservar visual e fluxo de parcelamento para titulares legítimos.

Sem branch de banco isolado e sem autorização de escrita de QA neste despacho; essas
condições precisam ser resolvidas antes do gate mutante. Revisão de SQL, contenção e
reversão devem preceder eventual aplicação. Depois do gate e da autorização de publicação,
reconferir objeto/grants em produção e executar fluxo representativo seguro. Se a função
foi suspensa, `GRANT EXECUTE` só após verificar o corpo corrigido. Nunca restaurar o
corpo vulnerável para voltar atrás.

## Estado

Usuário decidiu **não suspender** a função em produção e preparar a correção primeiro.
Plano e SQL de pausa ficam registrados apenas como alternativa não autorizada. A preparação
local está autorizada; aplicação no banco, escrita de QA, commit, push e deploy permanecem
fora deste despacho. [Handoff proposto ao Executor](../handoffs/2026-10-11-r188-executor-preparacao.md).

### Preparação local — 11/10

- Criada pela CLI Supabase a migration
  `20261011210438_r188_guardar_autorizacao_gerar_parcelas.sql`. Ela preserva assinatura,
  cálculo, retorno e grants da RPC; exige usuário autenticado, clínica ativa, membership
  ativo, perfil ativo e papel coincidente antes de consultar plano, escrever ou retornar.
  Admin/dentista ficam limitados ao próprio orçamento; secretária ativa permanece autorizada.
- `gerarParcelas` passou a recusar localmente perfil inativo, papel fora de
  `admin`/`dentista`/`secretaria` e divergência entre membership e perfil. A RPC continua
  sendo a fronteira obrigatória para chamadas diretas.
- **PASSA (estático):** `git diff --check`, ESLint da Action e verificação estrutural da
  migration (assinatura, guards e ordem antes de `plano_ja_definido`).
- **NÃO TESTADO:** gate autenticado de duas contas, persistência antes/depois e reload;
  requer fixture nova e autorização própria para escrita de QA.
- **NÃO TESTADO (ambiente):** lint do banco não conectou, pois não há Postgres local em
  `127.0.0.1:54322`; typecheck completo está bloqueado por artefatos `.next/types` já
  obsoletos, que referenciam rotas ausentes fora deste item.

Na entrega do Executor, nenhuma migration havia sido aplicada e nenhum dado, commit,
push ou deploy havia sido alterado.

### Revisão da alternativa de aplicação direta — 11/10

O usuário prefere dispensar um branch de QA e considerar a aplicação direta após revisão,
desde que o risco de perda de dados ou travamento seja delimitado. Leitura atual confirmou
fingerprint `e21635ef4526004ad5cb1c26e0191e98`, assinatura, retorno, defaults e grants
da função publicada iguais aos pressupostos da migration. O SQL contém apenas
`CREATE OR REPLACE FUNCTION`: não migra nem apaga linhas e preserva os grants existentes.
Nos vínculos ativos, 8 admins, 6 dentistas e 1 secretária têm perfil ativo com papel
coincidente; não há duplicidade de vínculo/perfil ativo para a mesma conta e clínica.
O escopo próprio de admin/dentista e o escopo operacional da secretária concordam com
`src/server/authorization/finance.ts`. `git diff --check` passou.

Risco residual: erro no corpo ou regra de autorização pode impedir temporariamente a
geração legítima de parcelas; `CREATE OR REPLACE FUNCTION` também pode aguardar chamadas
concorrentes. A revisão estática não prova o gate de duas contas. Sem branch isolado, a
aplicação no banco precederia o gate funcional; começar por verificação de objeto/grants
e chamadas negativas sem escrita, depois pedir autorização específica para fixture
sintética e fluxo positivo. Não restaurar o corpo vulnerável em caso de falha.

### Aplicação autorizada em produção — 11/10

O usuário autorizou por voz a migration R-188 diretamente no banco, após a revisão, sem
autorizar commit, push, deploy ou escrita de QA. `apply_migration` retornou sucesso para
`r188_guardar_autorizacao_gerar_parcelas`. Leitura posterior confirmou projeto
`ACTIVE_HEALTHY`, fingerprint novo `b05d239c7cb52339e6fa7e3de33e22e8`, mesma
assinatura e grants (`authenticated` executa; `anon` não), e guardas de autenticação e
titularidade antes do primeiro `UPDATE`. **PASSA:** publicação e estrutura da guarda.
**NÃO TESTADO:** chamada autenticada com duas contas, positivo do titular/secretária,
negativa do outro dentista, persistência/recarga e efeito na UI. A Action local ainda não
está publicada; a RPC corrigida protege também o caller atualmente publicado.
O ledger registrou a versão `20261011210438`; o arquivo local foi renomeado para essa
mesma versão, sem alterar o SQL, para não deixar uma migration pendente duplicada no Git.
O usuário determinou que o gate funcional use somente contas criadas para teste; a
sessão real da portaria da Clindent não serve para validar o papel dentista nem deve ser
utilizada nos próximos testes.

### Gate parcial com contas QA — 11/10

A e B foram autenticados separadamente pela API publicada com JWT próprio, sem envio de
e-mail. B, ativo na sua clínica QA mas removido da clínica de A, recebeu
`P0001/sem_permissao` ao chamar a RPC com um orçamento sintético antigo de A. A recebeu
`P0001/plano_ja_definido` para o mesmo orçamento. As linhas de orçamento, pagamentos,
cobranças e eventos ficaram idênticas antes/depois. **PASSA:** negativa entre clínicas
e ausência de mutação nesse ensaio. **NÃO TESTADO:** negativo para outro dentista ativo
na mesma clínica, positivo num orçamento novo, secretária QA, vínculos inativos e
persistência/recarga de plano novo. A conta A é barrada no dashboard publicado pelo
gate comercial; no localhost com billing desligado só no processo, painel, pacientes e
financeiro foram abertos em leitura. Evidência e limites na
[auditoria ampla em andamento](../auditorias/2026-10-11-auditoria-ampla-inicio.md).

### Ensaio M1 autorizado e executado — 11/10

Usar exclusivamente A e B nas clínicas QA já existentes. Na clínica QA de A, criar um
orçamento sintético de R$ 80 para o paciente sintético já identificado, com um item
aprovado, sem plano, cobrança, contato ou envio. Reativar temporariamente o vínculo e
perfil de B como dentista nessa clínica e apontar sua clínica ativa para ela; guardar
o estado anterior para restauração. Confirmar B com JWT próprio: `sem_permissao`, sem
linhas sensíveis e sem alteração. Confirmar A com JWT próprio: duas parcelas pendentes
de R$ 40, sem recebimento; conferir resposta, banco e recarga. Restaurar B à sua
clínica QA original e deixar vínculo/perfil temporário removido/inativo. Preservar o
orçamento e as parcelas sintéticas como evidência, com IDs e efeitos documentados.
Se um passo de preparo ou verificação falhar, parar e registrar o estado; não variar a
solução nem tocar Clindent, gateway, e-mail ou WhatsApp.

**Resultado:** PASSA para o núcleo da RPC. O orçamento QA novo
`72a8172b-b605-437d-82dc-6ecb331f52aa` começou com um item sintético de R$ 80 e
zero parcelas. B, temporariamente dentista ativo da mesma clínica, recebeu
`P0001/sem_permissao` e zero linhas na leitura normal; hashes de orçamento, itens,
pagamentos, cobranças e eventos permaneceram iguais. A gerou duas parcelas pendentes
de R$ 40, retornadas pela RPC e persistidas. Outra sessão de A releu o plano de R$ 80
e as duas parcelas. B foi restaurado à clínica QA original, com vínculo `removido` e
perfil inativo na clínica de A. Zero recebimentos, cobranças externas ou envios; fixture
nova preservada como evidência. **NÃO TESTADO:** UI de geração publicada, secretária QA,
sessão revogada e demais papéis. A Action ajustada continua local; sem commit, push ou
deploy. [Matriz da auditoria](../auditorias/2026-10-11-auditoria-ampla-inicio.md).
