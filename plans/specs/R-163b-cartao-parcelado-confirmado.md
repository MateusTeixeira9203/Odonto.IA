# R163b — cartão parcelado confirmado por mês

15/09/2026 · Contrato da decisão de Mateus, execução autorizada na conversa.
Candidato/teste Free, sem commit/push. Integração bancária não faz parte.
Pausa em 15/09 para planejamento solicitado pelo usuário: SQL local revisado, não aplicado no Free.
Typecheck focado das actions passou; QA autenticado/visual do cartão ainda não executado.

## Regra
Cartão de crédito parcelado: confirmação única ao salvar o parcelamento. Cada parcela nasce
paga/confirmada, com data_pagamento igual à data mensal programada. Não concentrar o total
no mês da venda e não exigir baixa mensal. Crédito confirmado não é confirmação bancária.
A UI avisa o comportamento antes de salvar. PIX, dinheiro, boleto e acordo direto mantêm
previsões pendentes. Cartão de débito não é parcelamento. Não converter contratos antigos.

Reusar parcelas e cálculos existentes, sem cron, tabela paralela ou serviço externo.
Entrada explícita conserva seu fluxo; este recorte confirma as parcelas selecionadas.
Centavos fecham o total, resto na última parcela; meses usam a data inicial como âncora:
31/01/2027 → 28/02/2027 → 31/03/2027.

## Contrato
- gerar_parcelas_cartao: mesmos parâmetros de gerar_parcelas_orcamento (forma obrigatoriamente
  cartao_credito); gera e confirma as novas parcelas na mesma transação.
- reorganizar_parcelas_cartao: mesmos parâmetros de reorganizar_parcelas_orcamento;
  confirma apenas as previsões geradas nessa reorganização, preservando pagamentos anteriores.
- criar_cobranca_cartao: mesmos parâmetros da criação de etapa; exige 2–24 parcelas,
  cria a etapa e confirma as parcelas correspondentes atomicamente.
- Wrappers definer com search_path vazio e validação explícita de usuário/vínculo ativo,
  clínica ativa e can_act_as_dentista. Helpers sem EXECUTE para authenticated/anon/public.
  Gerador legado passa pelo mesmo lock antes de ler o plano para evitar concorrência com cartão.
  Sem ampliar políticas RLS ou acesso entre profissionais/clínicas.
- Helper privado confirma IDs retornados, clínica e orçamento coerentes; exige valor positivo,
  data e parcela válidos. Auditoria registra origem cartão/programação mensal.
- Erro retorna rollback; retry não duplica recebimentos (pode responder plano já definido).
- status/data/forma reais voltam no DTO de parcelas; UI não inventa pendente após sucesso.
- Rotas/actions só escolhem wrappers no piloto Free. Fora dele mantêm comportamento atual.

## UI
Reusar formulários existentes. Novo orçamento: escolha já existente Cartão de Crédito e aviso.
Organizar cobrança geral/etapa: opção Parcelamento no cartão / Acordo com o paciente.
Acordo é padrão; cartão selecionado confirma ao salvar, sem diálogo extra mensal.
Manter tokens/controles atuais, sem redesign. Datas exibidas como primeiro lançamento para cartão.

## Aceite
1. 100 em 3x: 33,33 + 33,33 + 33,34, todos pagos, nos três meses corretos.
2. Nenhum pendente dessas parcelas. Somatório mensal pessoal/clínica não soma total na venda.
3. Boleto/acordo continuam pendentes. Pagamentos antigos não mudam.
4. Mesma chamada repetida não duplica; forma/data/valores inválidos revertem tudo.
5. Outro responsável sem autorização e outra clínica são negados.
6. Etapa com cartão mantém vínculo; estorno/correção usam operações existentes e têm efeito
   explícito no saldo (estorno não reaprova cartão automaticamente).
7. UI mostra aviso/confirmadas; testes focados e HTTP autenticado no Free.
8. QA integrado Next e reconciliação com main são gates antes de publicação, não cobertos pelo harness.

Fora: conexão PJ, taxas, antecipação automática, confirmação bancária, cron, conversão retroativa,
baixa de material/kits e correção dos comprovantes externos sem etapa (item separado).
