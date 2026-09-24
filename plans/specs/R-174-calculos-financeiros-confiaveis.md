# R-174 — Cálculos financeiros confiáveis

**Fase:** contrato técnico para aprovação.  
**Depende de:** R-163, R-164 e R-173 integrados à base.  
**Referência visual em revisão:** `plans/artefatos/R-164-financeiro-e-gestao-v7.html`.

## Problema

O painel já separa caixa da clínica, resultado profissional e repasses, mas
o caixa ainda não materializa custos recorrentes, não possui saldo informado
datado e parte das métricas consulta fatos antigos da agenda. Mostrar margem,
fôlego ou hora clínica com essas lacunas daria um número aparentemente preciso
e operacionalmente falso.

## Resultado esperado

- Cada valor exibido informa se é **realizado**, **previsto** ou
  **indisponível por falta de base**.
- Uma despesa recorrente é cadastrada uma vez, ganha uma competência por mês e
  reduz o caixa somente quando o pagamento for confirmado.
- A hora clínica de cada profissional é o recebido vinculado dividido pelas
  horas de atendimentos concluídos. Ela não rateia gastos da clínica.
- Compra de estoque entra uma vez no caixa; o consumo de material apenas
  registra rastreabilidade. Não há dupla despesa.

## Referência visual

- **Artefato:** `R-164-financeiro-e-gestao-v7.html` · rota
  `/dashboard/meu-consultorio` · Hub financeiro.
- **Tokens:** fundo `#111112`; card `#1c1c1e`; borda `#303034`; texto `#fafafa`;
  texto secundário `#a1a1aa`; ação/resultado positivo `#2f9c85`; alerta
  `#e57373`; previsto `#d7b46a` com marcação tracejada.
- **Tipografia:** títulos `DM Serif Display, Georgia, serif`; interface
  `Outfit, system-ui, sans-serif`; cards com raio de `16px` e padding de `24px`.
- **Hierarquia obrigatória:** Visão geral mostra ações; Meu Resultado mostra o
  desempenho do profissional; Financeiro da clínica separa caixa realizado,
  previsão, equipe e repasses. DRE por competência permanece indisponível.
- **Ajuste pendente de aprovação:** ticket médio aprovado e recebido permanecem
  no Meu Resultado, como leitura de produção do profissional. A Visão geral
  ganha um bloco operacional com agenda ocupada, horas livres, faltas e
  cancelamentos, sempre no escopo que a persona pode enxergar. Conversão
  comercial e repasses não entram nesse bloco diário.

## Definições e fórmulas

| Indicador | Fórmula e regra |
|---|---|
| Caixa realizado da clínica | Pagamentos de pacientes `pago` + receitas manuais da clínica − despesas da clínica `pago` − repasses `pago`. Não representa saldo bancário sem conciliação. |
| Projeção de caixa | Caixa realizado do período + recebíveis abertos no período − competências recorrentes ainda não pagas. Não soma receita aprovada como recebimento. |
| Produção aprovada | Soma de orçamentos aceitos no período comercial. É demanda contratada, não caixa. |
| Recebido vinculado | Pagamentos confirmados ligados ao profissional. Em clínica gerida pertence ao caixa da clínica; em colaborativa pertence ao dentista. |
| Resultado do profissional | Leitura de produção, recebido vinculado, ticket e ocupação do profissional. Não cria caixa pessoal nem rateia despesas da clínica por dentista. |
| Hora clínica do profissional | `recebido vinculado ÷ horas de agenda concluídas`. Sem horas, exibir `—`. |
| Margem realizada da unidade | `(receita realizada − despesas realizadas − repasses pagos) ÷ receita realizada`. Sem receita realizada, exibir `—`. |
| Ponto de equilíbrio | `custos fixos da competência ÷ margem de contribuição`, somente quando a margem de contribuição e a classificação de custos estiverem completas. |
| Fôlego de caixa | `saldo informado da conta ÷ média de despesas realizadas dos últimos 3 meses`; sem saldo informado datado, exibir `—`. |

### Escopo por modalidade de clínica

- **Clínica gerida:** recebimentos e despesas pertencem ao caixa da clínica.
  Pagamentos de paciente ficam vinculados ao dentista responsável para compor
  produção, recebido e hora clínica do profissional.
- **Clínica colaborativa:** preserva o financeiro individual existente. Cada
  dentista registra os próprios custos e recebimentos; estoque pessoal e
  estoque compartilhado continuam independentes.

### Área da secretária

Em todos os modelos, a secretária usa a **Visão geral existente**, filtrada por
permissão. Ela vê pacientes para reativar, pagamentos vencidos e **Orçamentos
pendentes**, com atalhos de WhatsApp, agendamento e acompanhamento. Não há tela
paralela nem segundo dashboard. Orçamentos pendentes agrupa, em listas separadas,
atendimento sem orçamento, orçamento enviado sem decisão e orçamento aprovado
sem cobrança.

O lançamento limitado de recebimentos e despesas fica disponível no Financeiro
da clínica, sem expor margem, repasses, acordos ou configurações. Mensagens de
WhatsApp são modelos configurados pela clínica; saem em nome da clínica e o
encaminhamento ao dentista é feito quando a pendência exigir atendimento.

### Métricas aprovadas para esta fase

| Métrica | Fórmula | Estado exibido |
|---|---|---|
| Conversão de orçamento | Orçamentos enviados no mês que estão aprovados na data da consulta ÷ orçamentos enviados no mês. Pendentes e recusados aparecem ao lado; não são escondidos. | Coorte aberta, até o mês atual. |
| Produção aprovada | Soma de `valor_acordado` ou `total` dos orçamentos cujo `aprovado_em` está no período. | Comercial, não é caixa. |
| Recebido vinculado | Soma de pagamentos `pago` por `data_pagamento`, vinculados ao profissional. | Realizado. |
| Recebido por hora | Recebido vinculado ÷ horas de agenda `realizado`. | Realizado; `—` sem horas. |
| Ticket aprovado | Produção aprovada ÷ quantidade de orçamentos aprovados no período. | Comercial. |
| Ticket recebido por paciente | Pagamentos confirmados ÷ pacientes distintos com pagamento confirmado no período. | Realizado. |
| Comparativo mensal | Valor do período versus o mesmo indicador do mês imediatamente anterior. | Sem percentual quando a base anterior for zero. |
| Aging de inadimplência | Saldo pendente das cobranças vencidas, em 1–7, 8–30, 31–60 e 61+ dias. | Em atraso. |
| Previsão 7/30/60/90 | Recebíveis com vencimento na janela − despesas, competências e repasses com vencimento na janela. | Previsto; vira saldo projetado somente com saldo conciliado. |

## Modelo de dados

### Recorrências e competências

`despesas_recorrentes` pertence à clínica. A regra ativa gera competências
do mês corrente e dos próximos onze meses.

Nova tabela `despesas_recorrentes_competencias`:

- uma linha por recorrência e mês, com unicidade `(recorrencia_id, competencia)`;
- valor e vencimento copiados da recorrência no momento da geração;
- estados `previsto`, `pago`, `cancelado`;
- vínculo opcional com uma única linha de `despesas` quando paga;
- o pagamento é idempotente: repetir a ação não cria segunda despesa.

O cadastro e as alterações de recorrência materializam competências futuras.
Editar uma regra não muda competências já pagas. Cancelar preserva fatos, apenas
impede as próximas competências.

### Fatos adicionais para previsões e comparativos

- `orcamentos.aprovado_em` já existe e é a única data aceita para produção
  aprovada. Uma trigger futura preenche a data em toda transição para
  `aprovado`; orçamento legado sem esta data não entra em série histórica.
- `despesas` recebe `situacao` (`previsto`, `pago`, `cancelado`),
  `competencia`, `data_vencimento` e `pago_em`. Linhas existentes migram como
  `pago`, preservando sua data atual como fato histórico.
- `acordos_repasse` recebe `dia_vencimento`. O repasse gerado grava o seu
  `data_vencimento`; sem esse dado ele não compõe a previsão e a interface pede
  configuração, em vez de assumir fim de mês.
- Enquanto não houver Open Finance, o proprietário ou gestor pode registrar um
  **saldo informado da conta**, sempre com data, usuário e confirmação. Ele não
  é tratado como saldo ao vivo nem reconciliação completa; apenas ancora a
  projeção e mostra a data da informação. Sem saldo informado, o painel mostra
  apenas o caixa calculado pelos lançamentos e não exibe fôlego de caixa.

### Despesas e receitas avulsas

- Toda entrada e saída financeira pertence à clínica. Não existe lançamento de
  gasto pessoal ou custo atribuído a dentista nesta fase.
- Recebimento de paciente exige paciente/orçamento; o dentista responsável é
  derivado do orçamento e só pode ser corrigido por gestor. Outros recebimentos
  podem ser avulsos e informam claramente que não compõem produção profissional.
- Recebimento manual pode ser atribuído a dentista quando registra paciente,
  profissional, valor, data e motivo. Ele entra em `recebido vinculado`, mas
  não inventa orçamento aprovado ou produção aprovada.
- Secretária recebe uma permissão limitada de lançamento: registra recebimento
  de paciente e despesa clínica, sem alterar acordos, repasses, margens,
  projeções, recorrências históricas ou conciliações.
- Proprietário/gestor configura recorrências, confirma repasses e concilia
  saldo bancário. O dentista consulta os próprios indicadores, sem precisar de
  um formulário financeiro pessoal.
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

- `obter_meu_financeiro_gerido` retorna produção, recebido, tickets, horas,
  ocupação e hora clínica com a data-base explícita.
- `obter_financeiro_clinica_painel` retorna caixa, projeção, custos por
  competência e desempenho por profissional sem misturar produção, recebimento
  e repasse.
- Nenhuma RPC preenche com zero um indicador cuja base está ausente. Retorna
  `null` e a razão estruturada.
- A leitura de outra clínica ou de outro dentista é recusada no banco, mesmo se
  a chamada vier de uma rota autenticada.
- A leitura retorna blocos independentes: `resultadoPessoal`, `capacidade`,
  `producaoERecebimento`, `ticketsEConversao`, `aging`, `previsao` e
  `comparativoMensal`. Cada bloco informa a base e o estado de dado.

## Regras por modalidade

- **Colaborativa:** orçamento, pagamento e receita clínica do dentista seguem
  `titular_financeiro = dentista`; a clínica não recebe um caixa agregado
  fictício.
- **Gerida:** pagamentos de pacientes compõem o caixa da clínica. O dentista
  consulta resultado profissional e repasses, sem criar caixa pessoal.
- **Proprietário dentista:** aparece como profissional no desempenho da equipe
  e possui seu Meu Financeiro; custos da unidade continuam no caixa da clínica.

## Regras de apresentação

- O proprietário dentista integra o desempenho da equipe uma única vez. Sua
  produção não cria repasse a si mesmo por padrão. Pró-labore e distribuição
  ao sócio são fluxos posteriores e não entram na margem operacional.
- Produção aprovada, atendimento realizado, recebimento, repasse previsto e
  repasse pago permanecem indicadores separados em qualquer tela.
- Valores posteriores ao mês selecionado usam o estado visual `previsto`; não
  se apresentam como histórico realizado.
- Cada repasse expõe memória de cálculo auditável: recebimentos elegíveis,
  ajustes/estornos, regra aplicada, devido, pago e saldo pendente.
- A Visão geral abre listas filtradas e apresenta impacto financeiro recuperável
  quando houver valor mensurável. A ordenação inicial será determinística por
  vencimento e valor; nenhuma probabilidade será inventada sem histórico.

## Métricas por fase

**Entra no R-174:** ocupação do profissional, horas disponíveis e atendidas,
produção aprovada, recebido vinculado, hora clínica, tickets, repasse
devido/pago, contas vencidas e previsões que tenham vencimentos reais.

**Exige recorte posterior:** DRE por competência de receita (depende de regra
de reconhecimento do tratamento), margem por procedimento (depende de custo
unitário e consumo por lote), ocupação por cadeira (não há cadastro de cadeiras),
metas/benchmark, capital de giro conciliado e recomendações da IA. Esses itens
não devem preencher cards enquanto as fontes não existirem.

### Métricas candidatas revisadas em 24/09

| Métrica | Decisão | Base necessária |
|---|---|---|
| Ocupação por profissional | R-174 | Agenda concluída e horas configuradas. |
| Hora clínica | R-174 | Recebimentos vinculados e horas concluídas. |
| Ticket médio aprovado e recebido | R-174, em detalhe | Denominador visível: orçamento aceito ou paciente pagante. |
| Conversão de orçamento | R-174, coorte simples | Orçamentos emitidos e aceitos no mesmo período; coorte completa é posterior. |
| Produção versus recebido | R-174 como `aprovada versus recebida` | Orçamento aprovado e pagamento confirmado. Produção realizada exige preço por procedimento executado e fica posterior. |
| Repasse devido, pago e pendente | R-174 | Memória de cálculo do acordo e estados de repasse. |
| Cancelamento e falta | R-174 como operação | Status da agenda. Retrabalho é posterior porque não há fato clínico próprio. |
| Receita recebida versus competência | Posterior | Regra de reconhecimento da receita. |
| Margem de contribuição e operacional | Parcial no R-174 | Classificação completa de custos; contribuição final depende de custo variável por procedimento. |
| Ponto de equilíbrio em reais/horas | Posterior | Margem de contribuição fechada e, para cadeira, cadastro de cadeiras. |
| Aging de inadimplência | R-174 | Saldo aberto por cobrança, vencimento e pagamento parcial. |
| Previsão 7/30/60/90 | R-174 | Vencimentos de recebíveis, competências recorrentes e repasses previstos. |
| Ocupação por cadeira | Posterior | Cadastro e vínculo de cadeira na agenda. |
| Receita/margem por procedimento | Posterior | Alocação de recebimento e custo por lote/material. |
| Fôlego de caixa | R-174 com saldo manual datado | Saldo informado da conta e média de despesas. |
| Real versus mês anterior | R-174 | Série mensal do mesmo indicador. |
| Real versus meta | Posterior | Metas por clínica, profissional e período. |

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
7. Aprovar orçamento, editar seu valor depois e conferir que a produção continua
   no mês de `aprovado_em`; orçamento legado sem essa data não é inventado.
8. Criar cobrança vencida e outra parcialmente paga: o aging usa somente o
   saldo pendente nas quatro faixas.
9. Criar recebíveis, competência de despesa e repasse com vencimentos distintos;
   as janelas 7/30/60/90 incluem cada fato uma única vez.
10. Informar saldo em duas datas e conferir que o fôlego usa a última
    informação sem apagar o histórico anterior.

## Fora deste recorte

- Open Finance e conciliação bancária transacional completa.
- Estornos, descontos e devoluções de pagamento.
- Depreciação e custo por ciclo de materiais reutilizáveis.
- Relatórios fiscais, DRE contábil e folha de pagamento.
