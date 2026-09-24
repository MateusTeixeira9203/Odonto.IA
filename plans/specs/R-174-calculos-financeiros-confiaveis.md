# R-174 — Cálculos financeiros confiáveis

**Fase:** contrato técnico para aprovação.  
**Depende de:** R-163, R-164 e R-173 integrados à base.  
**Não redesenha:** as superfícies aprovadas do Meu Consultório.

## Problema

O painel já separa caixa da clínica, financeiro pessoal e repasses, mas três
fatos ainda não fecham o ciclo: custo recorrente não vira obrigação mensal,
saída pessoal é sempre variável e o estoque não guarda custo de aquisição.
Mostrar margem, fôlego ou hora clínica com essas lacunas daria um número
aparentemente preciso e operacionalmente falso.

## Resultado esperado

- Cada valor exibido informa se é **realizado**, **previsto** ou
  **indisponível por falta de base**.
- Uma despesa recorrente é cadastrada uma vez, ganha uma competência por mês e
  reduz o caixa somente quando o pagamento for confirmado.
- O custo/h pessoal usa os custos próprios da competência e as horas do
  profissional. O custo/h da clínica usa os custos da unidade e as horas
  configuradas da unidade.
- A alocação de custo compartilhado para cada profissional usa horas
  disponíveis configuradas, nunca a quantidade de dentistas.
- Compra de estoque entra uma vez no caixa; consumo de material só pode virar
  custo clínico quando existir custo unitário no lote. Não há dupla despesa.

## Definições e fórmulas

| Indicador | Fórmula e regra |
|---|---|
| Caixa realizado da clínica | Pagamentos de pacientes `pago` + receitas manuais da clínica − despesas da clínica `pago` − repasses `pago`. Não representa saldo bancário sem conciliação. |
| Projeção de caixa | Caixa realizado do período + recebíveis abertos no período − competências recorrentes ainda não pagas. Não soma receita aprovada como recebimento. |
| Produção aprovada | Soma de orçamentos aceitos no período comercial. É demanda contratada, não caixa. |
| Recebido vinculado | Pagamentos confirmados ligados ao profissional. Em clínica gerida pertence ao caixa da clínica; em colaborativa pertence ao dentista. |
| Resultado pessoal | Entradas pessoais realizadas (repasses pagos + receitas manuais próprias) − despesas pessoais realizadas. |
| Custo próprio/h | `(despesa recorrente pessoal da competência + despesas pessoais realizadas classificadas como custo) ÷ horas disponíveis do dentista no mês`. Sem horários, exibir `—`. |
| Custo operacional/h da unidade | `(custos recorrentes da clínica da competência + despesas clínicas realizadas classificadas como custo) ÷ horas disponíveis totais da clínica no mês`. Sem base completa, exibir `—`. |
| Custo atribuído ao profissional | `custo operacional da unidade × (horas disponíveis do profissional ÷ horas disponíveis totais)`. É uma alocação, identificada como tal. |
| Margem realizada da unidade | `(receita realizada − despesas realizadas − repasses pagos) ÷ receita realizada`. Sem receita realizada, exibir `—`. |
| Ponto de equilíbrio | `custos fixos da competência ÷ margem de contribuição`, somente quando a margem de contribuição e a classificação de custos estiverem completas. |
| Fôlego de caixa | `saldo bancário conciliado ÷ média de despesas realizadas dos últimos 3 meses`; sem conciliação, exibir `—`. |

## Modelo de dados

### Recorrências e competências

`despesas_recorrentes` passa a ter titularidade explícita:

- `titular_financeiro`: `clinica` ou `dentista`.
- `dentista_id`: obrigatório somente para o titular `dentista`.
- `vigente_desde` e `vigente_ate` para preservar histórico.

Nova tabela `despesas_recorrentes_competencias`:

- uma linha por recorrência e mês, com unicidade `(recorrencia_id, competencia)`;
- valor e vencimento copiados da recorrência no momento da geração;
- estados `previsto`, `pago`, `cancelado`;
- vínculo opcional com uma única linha de `despesas` quando paga;
- o pagamento é idempotente: repetir a ação não cria segunda despesa.

O cadastro e as alterações de recorrência materializam competências futuras.
Editar uma regra não muda competências já pagas. Cancelar preserva fatos, apenas
impede as próximas competências.

### Despesas e receitas avulsas

- Lançamento de clínica: somente proprietário/gestor com `despesas.gerir`.
- Lançamento pessoal: somente o próprio dentista, sempre com `dentista_id` e
  `titular_financeiro = dentista`.
- A tela escolhe a natureza da saída: `fixo` ou `variável`. O RPC recebe e
  valida essa escolha; não a converte silenciosamente em variável.
- Cada despesa tem estado de caixa `previsto` ou `pago`. Apenas `pago` entra
  em caixa realizado; ambas entram na projeção do mês correspondente.

### Estoque e custo

O R-174 não atribui custo aos materiais usados. Hoje `estoque_lotes` não guarda
custo de aquisição. A evolução posterior deve adicionar custo unitário ao lote
e criar uma alocação de consumo por uso confirmado, sem criar uma segunda saída
de caixa. Até ela existir, o estoque informa quantidade e rastreabilidade,
enquanto sua compra é registrada como despesa clínica.

## Contratos de leitura

- `obter_meu_financeiro_gerido` retorna campos com sufixos explícitos para
  realizado e previsto, além da base usada no custo/h.
- `obter_financeiro_clinica_painel` retorna caixa, projeção, custos por
  competência e desempenho por profissional sem misturar produção, recebimento
  e repasse.
- Nenhuma RPC preenche com zero um indicador cuja base está ausente. Retorna
  `null` e a razão estruturada.
- A leitura de outra clínica ou de outro dentista é recusada no banco, mesmo se
  a chamada vier de uma rota autenticada.

## Regras por modalidade

- **Colaborativa:** orçamento, pagamento e receita clínica do dentista seguem
  `titular_financeiro = dentista`; a clínica não recebe um caixa agregado
  fictício.
- **Gerida:** pagamentos de pacientes compõem o caixa da clínica. O dentista
  recebe somente seu repasse pago e suas receitas pessoais avulsas.
- **Proprietário dentista:** aparece como profissional no desempenho da equipe
  e possui seu Meu Financeiro; custos da unidade continuam no caixa da clínica.

## Verificação obrigatória

1. Migrar em banco isolado e confirmar constraints, grants e RLS por objeto.
2. Dois usuários em duas clínicas: cada um lê e altera apenas suas próprias
   recorrências, despesas e agregados.
3. Clínica gerida com dois dentistas: pagamento do paciente entra uma vez no
   caixa clínico; repasse só entra no pessoal após marcado como pago.
4. Repetir a confirmação de uma competência e comprovar uma única despesa.
5. Conferir um mês sem horários, sem custos e sem receita: cards usam `—`, não
   `R$ 0` como se fosse cálculo concluído.
6. Conferir que uma compra de estoque não é duplicada depois do uso de kit.

## Fora deste recorte

- Conciliação bancária e Open Finance.
- Custo unitário, média de custo e alocação automática do estoque ao uso.
- Relatórios fiscais, DRE contábil e folha de pagamento.
