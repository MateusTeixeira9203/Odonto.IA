# R-163c — Operações financeiras por capacidade

15/09/2026 · Contrato do primeiro sublote de R163, execução autorizada por Mateus.
Depende do helper operacional R159c; banco Free somente. QA manual pelo usuário.

## Escopo e reuso

Habilitar recebimento, confirmação, correção e estorno para proprietário e membros
explicitamente autorizados, sem perfil clínico fictício. Reusar as cinco RPCs R145
já corrigidas por R166/R169; não escrever outro cálculo de saldo nem alterar cartão.
Financeiro pessoal conserva o comportamento do dentista responsável. Caixa próprio
da clínica e apresentação das operações completam o sublote seguinte; não declarar
R163 inteiro concluído ao entregar somente autorização e transações.

## Contrato

- `private.financeiro_clinica_ativa()` resolve auth.uid, users.active_clinica_id e
  membership ativo (admin/dentista/secretaria/gestor); protético e suspenso negados.
  Não modificar get_my_clinica_id/get_my_dentista_id nem can_act_as_dentista globais.
- `private.financeiro_pode_operar(clinica, dentista, permissao)` exige contexto atual.
  Profissional ativo opera seu próprio financeiro; proprietário explícito de clínica
  gerida opera a unidade; demais atores exigem concessão de ação e leitura da cobrança.
  Conceder registrar não concede corrigir/estornar. Governança colaborativa não cria dono.
- Clonar privadamente as RPCs registrar_recebimento_orcamento/cobranca,
  confirmar_previsao_orcamento, corrigir_recebimento_orcamento e
  estornar_recebimento_orcamento; nelas substituir somente resolução clínica e
  autorização financeira. As RPCs públicas legadas mantêm `can_act_as_dentista`,
  para que uma concessão não contorne CAS/idempotência chamando-as diretamente.
  Preservar R169 (retirados), descontos, triggers de titular, recomposição da etapa
  e todos os valores históricos.
- Operador não clínico tem actor_id/marcado_por_id clínico nulo e auth.uid identificado
  no metadata da auditoria; nunca usar o dentista atendente como operador.
- A nova action operacional resolve IDs pelo banco; não aceita paciente/titular/ator
  fornecido pelo cliente como autoridade. Sem service role.
- `operar_recebimento_clinica(clinicaEsperada,acao,payload,chave)` oferece ações registrar
  (orcamento ou cobranca), confirmar, corrigir, estornar; schemas Zod estritos, UUID,
  centavos inteiros positivos seguros, forma vigente, data ISO, motivo 1–500.
- Idempotência clínica+ator+chave e hash de payload com trava transacional. Repetição
  idêntica retorna resultado; chave reaproveitada com payload diferente conflita.
  Confirmação/correção/estorno exigem `atualizadoEm` (updated_at) anterior para detectar
  alteração concorrente. Travar orçamento → cobrança → pagamento e revalidar leitura.
  O adaptador público é SECURITY DEFINER, executa somente o envelope privado e não dá
  `EXECUTE` authenticated às cinco clones internas.
- Ledger de operações sem acesso direto tem RLS e nenhuma escrita direta authenticated/anon.
  Resultado mínimo: pagamentoId, orcamentoId, pacienteId, titular, valor/status.
  Nenhum campo clínico ou dados de outro orçamento sai na resposta.
- Resultado `{ok:true,data}|{ok:false,codigo,mensagem}` com INVALIDO, SEM_ACESSO,
  CONTEXTO_ALTERADO, CONFLITO, SALDO_EXCEDIDO, INDISPONIVEL. Erro interno não vaza SQL.
- Mudança não habilita caixa para secretária por cargo nem abre prontuário ao owner.

## Verificação

1. Mesma pessoa em outra clínica negada; removido/suspenso negado com sessão existente.
2. Receber autorizado, corrigir/estornar negados sem concessão própria.
3. Proprietário não clínico opera sem dentista fictício e auditoria identifica usuário.
4. Pessoal/comum/titular e responsável não mudam com operador diferente.
5. Repetição sem duplicação; exceder saldo negado; correção desatualizada conflita.
6. Falha de auditoria reverte operação inteira; registros concorrentes acima do saldo
   deixam apenas uma operação efetiva.
7. O fixture PGlite cobre dois chamadores em paralelo; dois logins no Preview e conferência
   manual continuam o gate de concorrência entre sessões antes de produção.

## Fora deste primeiro sublote

Integração bancária/PJ, repasses, regras novas de preço, assinatura do software,
reinterpretação histórica e refinamento do orçamento já concluído pelo usuário.

## Sublinote 2 — leitor operacional de recebimentos (15/09)

Rota operacional fora de `/clinica`, que permanece reservada ao proprietário. Reusa os
tokens de Financeiro: `PageContainer wide`, título em `font-heading`, cards `bg-card
border-border`, valores em `font-mono` e ações com `Button` existente. O leitor recebe
somente cobrança, paciente, profissional, saldo canônico e recebimentos; não calcula saldo
no cliente nem expõe dados clínicos. A navegação é orientativa; a RPC do sublote 1 mantém
a autorização transacional.
