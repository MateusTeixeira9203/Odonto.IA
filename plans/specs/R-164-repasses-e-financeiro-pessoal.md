# R-164 — Financeiro pessoal, financeiro da clínica e repasses V2

> **SPEC** · **R-164** · 🔵 ativo
> **Aberto:** 2026-09-23 · **Fase:** contrato V2, aguardando aprovação visual
> R-163 e R-164 V1 estão publicados no banco principal; esta versão substitui a apresentação e
> completa as leituras com dados reais. Não altera fatos financeiros já registrados.

## 1. Problema

O V1 separou corretamente o caixa da clínica dos repasses, mas exibiu acordo e histórico de
repasses no **Meu Financeiro**. Isso confundiu três perguntas diferentes:

1. Quanto o dentista produziu, recebeu para si, gastou e quanto custa sua hora clínica?
2. Como está o caixa, a cobrança, os custos e o resultado da unidade?
3. Quanto a clínica ainda deve ou já pagou a cada profissional?

Também faltam listas acionáveis para reativação, cobranças vencidas e orçamentos sem retorno.
O gestor não consegue comparar uma equipe sem aproximar margem por profissional quando o custo
direto ainda não existe.

## 2. Decisões fechadas

| Decisão | Regra |
|---|---|
| Três leituras no hub | **Visão geral**, **Meu Financeiro** e **Financeiro da Clínica** respondem a perguntas distintas dentro do Meu Consultório. |
| Visão geral para todo consultório | Solo, clínica colaborativa e clínica gerida recebem filas de reativação, cobrança e orçamento sem retorno. Gestor não atende vê apenas a visão de gestão. |
| Meu Financeiro é pessoal | Preserva o card aprovado de **Custo por Hora Clínica** para o dentista, além de entradas, custos pessoais, resultado, orçamentos aprovados, atendimentos, horas e o fluxo de caixa. Não exibe administração de acordos ou repasses. |
| Financeiro da Clínica é de gestão | Exibe caixa, previsão, tendências de receita e despesas, margem, custo/hora de cada dentista, desempenho, acordos e repasses. Só proprietário/gestor ou permissões equivalentes acessam dados agregados. |
| Valor sem fonte não é estimativa escondida | Margem, resultado por profissional, ponto de equilíbrio e hora só aparecem quando a base necessária existe. Ausência é mostrada como `—` com a orientação do dado que falta. |
| Fluxo mensal | Usa colunas verticais agrupadas: recebimentos confirmados e despesas pagas por mês. Não usa linhas ou barras horizontais. |
| Profissional clicável | A comparação abre o histórico filtrado do profissional, sem tirar o gestor do contexto da clínica. |
| Custos recorrentes | Entram na previsão mensal automaticamente. Só um lançamento de despesa confirmado reduz o caixa. |
| Registro no caixa da clínica | Botões visíveis **Registrar entrada** e **Registrar saída** abrem os formulários já existentes em `ClinicTransactionActions`; ficam no topo do Financeiro da Clínica, acima dos indicadores. |

## 3. Mapa de navegação e arquitetura visual

Artefato a aprovar: `plans/artefatos/R-164-financeiro-e-gestao-v5.html`.

```
Meu Consultório
├── Visão geral
│   ├── Pacientes para reativar       → lista filtrada + WhatsApp preparado
│   ├── Pagamentos vencidos            → lista de cobranças
│   └── Orçamentos sem retorno         → lista de acompanhamento
├── Meu Financeiro                     → leitura do próprio dentista
└── Financeiro da Clínica (gestão)
    ├── Caixa e previsão               → fluxo mensal e próximos 30 dias
    ├── Desempenho da equipe            → comparação e histórico individual
    └── Repasses e custos               → acordos, previsto/pago e recorrências
```

### Visão geral

- Mantém os três cartões de fila, a continuidade do período e o resumo financeiro curto.
- Um retorno futuro agendado remove o paciente da reativação. `followup_pendente` não é a única
  fonte da fila.
- Clique abre painel/lista filtrado no hub; o WhatsApp apenas preenche destinatário e mensagem.
  Nenhuma mensagem é enviada automaticamente.
- Para dentista solo, a mesma visão fica disponível junto do Meu Financeiro. Sem equipe, o
  artefato não mostra a aba de gestão multi-profissional nem controles de repasse.

### Meu Financeiro

- O primeiro card preserva o modelo aprovado: **Custo por Hora Clínica** em destaque,
  base visível de custos fixos atribuídos e horas disponíveis configuradas; entradas, custos
  próprios e resultado pessoal ao lado. Não substituir por receita/hora ou resultado/hora.
- Abaixo: **orçamentos aprovados**, atendimentos realizados e horas atendidas. Horas realizadas
  são diferentes das horas disponíveis usadas no cálculo do custo da hora.
- Preservar o gráfico aprovado de fluxo de caixa pessoal (linhas/área), com navegação mensal
  de janelas de seis meses; atalhos para registrar entrada e custo pessoais.
- Acordos, regra percentual, repasse previsto, repasse pago e histórico de repasse não vivem
  nesta tela. Um valor de repasse efetivamente recebido pode ser lido como entrada pessoal,
  nunca como pagamento do paciente.

### Financeiro da Clínica

- Cabeçalho: recebido, despesas pagas e **saldo do período**; a receber fica na previsão.
  O saldo do período não é saldo bancário; não usá-lo para calcular fôlego.
- Quatro indicadores: movimento líquido registrado, margem operacional, fôlego e ponto de equilíbrio.
  Cada indicador declara sua base e fica indisponível se os dados estiverem incompletos.
  Tendências de receita e despesas pertencem à seção Caixa e previsão.
- **Caixa e previsão:** gráfico mensal de colunas verticais agrupadas e previsão dos próximos
  30 dias. Cobranças, recorrências e repasses previstos ficam fora do saldo confirmado.
- **Desempenho da equipe:** gráfico de colunas por profissional e tabela com atendimentos,
  horas atendidas/disponíveis, orçamentos aprovados, recebimento vinculado, custo direto e
  **Custo por Hora Clínica** de cada dentista. O histórico individual detalha a taxa de
  aprovação de orçamentos, que não ocupa a tabela principal. O proprietário que atende aparece como `Você · proprietário`. Custo
  direto, contribuição e margem individual ficam `—` sem atribuição real de custo.
- **Repasses e custos:** uma área única com acordo, valor vinculado, previsto e pago por
  profissional; abaixo, custos recorrentes. Não duplicar "acompanhamento" e "repasses".
- **Lançamentos:** entrada manual é receita avulsa da unidade (valor, data, descrição e forma);
  saída é despesa pontual (valor, data, descrição e categoria). Pagamento de paciente continua
  no orçamento/ficha e entra no caixa automaticamente, sem novo lançamento manual. Custos fixos
  são configurados em Repasses e custos; o pagamento confirmado gera uma única despesa.

## 4. Contrato de domínio

### Fatos existentes que permanecem verdadeiros

- Em clínica gerida, recebimento do paciente é da clínica (`titular_financeiro = 'clinica'`).
- Orçamento aprovado é aceite comercial, não atendimento realizado, receita nem repasse.
- Repasse previsto é obrigação; só `repasse.status = pago` cria uma única `despesas` da clínica.
- Percentual incide sobre `pagamentos.status = 'pago'` elegíveis. Diária exige registro explícito;
  mensal fixo tem uma competência única por acordo.
- Acordo alterado não reescreve repasse já gerado. Pagamento de R$ 10.000 vinculado a um
  dentista aumenta caixa e recebimento vinculado; só reduz caixa outra vez ao pagar o repasse.
- Na colaborativa, o financeiro individual vigente continua proprietário dos recebimentos do
  dentista; esta versão não reatribui o legado.

### Leituras agregadas

```ts
type Monetary = number | null;

interface ActionQueueItem {
  id: string;
  pacienteId: string;
  nomePaciente: string;
  telefone: string | null;
  motivo: 'reativacao' | 'pagamento_vencido' | 'orcamento_sem_retorno';
  valor: number | null;
  dataReferencia: string;
}

interface PersonalFinancialData {
  entradasPessoais: number;
  custosProfissionais: number;
  resultadoPessoal: number;
  horasAtendidas: number | null;
  horasDisponiveisConfiguradas: number | null;
  custosFixosProprios: number | null;
  custosFixosEstruturaAtribuidos: number | null;
  custoPorHoraClinica: Monetary;
  orcamentosAprovados: number;
  atendimentosRealizados: number;
  serieMensal: Array<{ mes: string; entradas: number; custos: number }>;
}

interface ProfessionalPerformance {
  dentistaId: string;
  nome: string;
  atendimentos: number;
  horasAtendidas: number | null;
  horasDisponiveis: number | null;
  orcamentosAprovados: number;
  recebidoVinculado: number;
  custoDireto: Monetary;
  contribuicao: Monetary;
  custoPorHoraClinica: Monetary;
  repassePrevisto: number;
  repassePago: number;
}

interface ClinicManagementFinancialData {
  recebido: number;
  aReceber: number;
  despesasPagas: number;
  saldoPeriodo: number;
  saldoBancarioConciliado: Monetary;
  resultado: Monetary;
  margem: Monetary;
  baseDeCustosValidada: boolean;
  folegoMeses: Monetary;
  pontoEquilibrio: Monetary;
  fluxoMensal: Array<{ mes: string; recebido: number; despesas: number }>;
  previsao30Dias: { cobrar: number; custosRecorrentes: number; repassesPrevistos: number; saldoProjetado: Monetary };
  profissionais: ProfessionalPerformance[];
}
```

- `null` é obrigatório para cálculo sem base; nunca substituir por `0`, porcentagem arbitrária ou
  texto de estimativa oculto.
- Resultado da unidade é `recebido + receitas manuais da clínica − despesas pagas da clínica`.
- Margem = `resultado / recebido`, somente com recebimento e base de custos do período
  validada; despesas parcialmente lançadas não autorizam mostrar lucro/margem definitivos.
- Fôlego = `saldo bancário conciliado / custos recorrentes mensais`; sem saldo inicial
  conciliado, saldo atual verificável ou recorrências completas, é `null`.
- Ponto de equilíbrio só é calculado quando existir modelo de custo e regra aprovada na próxima
  migration; até lá permanece indisponível, sem meta inventada.
- Custo por Hora Clínica do dentista = `(custos fixos próprios + custos fixos da estrutura
  explicitamente atribuídos) / horas disponíveis configuradas para esse dentista no mês`.
  Solo assume a estrutura própria; na clínica compartilhada, a parcela atribuída depende da
  ocupação ou acordo registrado. Nunca dividir custos pelo número de dentistas.
- Horas atendidas são exibidas separadamente das horas disponíveis. Materiais variáveis entram
  no custo direto do atendimento, fora dessa hora fixa. Custo atribuído da clínica não reduz o
  `resultadoPessoal`, que considera somente entradas e despesas pessoais.
- O cálculo atual de `calcularHoraClinica` soma despesas fixas e horários da unidade inteira;
  não pode ser apresentado como valor individual. Sem custos atribuídos ou horários confiáveis,
  `custoPorHoraClinica` é `null`.
- Tendências da clínica comparam recebimentos e despesas pagas com o mês anterior; sem base no
  mês anterior, exibem `—` e nunca crescimento percentual artificial.
- Orçamento aprovado é aceite comercial, atendimento realizado é produção clínica e pagamento
  confirmado é recebimento. A interface não intercambia esses três fatos.
- Contribuição profissional = recebido vinculado − custo direto atribuído. Não ratear aluguel ou
  materiais globais por quantidade de dentistas.

### Fontes e fronteira de acesso

| Leitura | Fonte autorizada | Consumidor |
|---|---|---|
| Caixa, fluxo, recorrências e extrato | `obter_financeiro_clinica` evoluída | gestão da clínica |
| Acordos e repasses | `obter_repasses_clinica` | gestão; dentista lê apenas a própria visão restrita |
| Meu Financeiro | nova RPC `obter_financeiro_pessoal` | dentista autenticado; sem linhas de outros profissionais |
| Desempenho da equipe | nova RPC `obter_desempenho_profissionais` | proprietário, gestor ou `financeiro.clinica.ler` |
| Filas acionáveis | nova RPC `obter_filas_consultorio` | escopo permitido para paciente/cobrança/orçamento |
| Entrada e saída manuais da clínica | `createClinicTransaction` existente | secretaria, proprietário e gestor na clínica gerida; RLS e `titular_financeiro` garantem caixa da unidade |

Todas as RPCs recebem `clinica_id` esperado, verificam clínica ativa e aplicam autorização antes
da agregação. O navegador nunca soma lançamentos de vários profissionais. `saldoPeriodo` é resultado do
período, sem saldo inicial bancário; fôlego e saldo projetado ficam `null` até existir
conciliação/saldo inicial confiável.

## 5. Modelo de custos e estoque

Esta é a ligação que R-164 consome, mas a escrita no estoque é item próprio:

| Evento | Caixa da clínica | Custo operacional | Regra |
|---|---:|---:|---|
| Compra/entrada de material | reduz ao confirmar a despesa | não duplicar no consumo | custo unitário fica no lote/entrada |
| Consumo de descartável em atendimento | não cria nova saída de caixa | custo direto quando houver lote/custo | associa paciente, data e profissional |
| Uso de reutilizável esterilizável | não cria saída | apenas rastreabilidade | descarte ou quebra registra perda |
| Descarte/quebra | não cria segunda saída de compra | perda operacional pelo custo conhecido | sem custo conhecido, exibe ausência de base |
| Custo fixo | só reduz quando pagamento é confirmado | compõe previsão mensal | recorrência não duplica lançamento |

R-164 V2 não cria custo de estoque fictício. O cadastro inicial com quantidade e custo unitário,
e a atribuição por consumo, entram no escopo de estoque seguinte e então alimentam
`custoDireto` de forma verificável.

## 6. Autorização

- Proprietário e gestor, ou quem receber `repasses.gerir`, administram acordo, geração e
  pagamento de repasses.
- Quem possuir leitura financeira clínica vê a unidade e desempenho agregado no escopo autorizado.
- Dentista vê somente `PersonalFinancialData` próprio e o histórico pessoal permitido; não abre
  acordo de terceiros, caixa completo ou valores da equipe. Recebe o custo/hora agregado próprio,
  mas não o detalhamento de custos compartilhados da clínica sem permissão de gestão. Se também
  for proprietário, aparece como profissional no desempenho da clínica.
- Secretaria opera filas e caixa apenas nas permissões já concedidas; não ganha acesso a dados
  pessoais de dentistas, repasses ou margem individual por consequência.

## 7. Segurança de redesign e tokens

- Rotas: `/dashboard/meu-consultorio`, `/meu-financeiro` e `/financeiro-clinica` existentes.
  Navegação continua interna ao hub; não trocar fluxos externos nem schema durante o redesign.
- Base visual: financeiro atual aprovado, Dashboard, Meu Dia e Ficha. Manter títulos em
  `DM Serif Display`, corpo Outfit e valores DM Mono.
- Tokens do artefato: fundo `#111112`, superfície `#1c1c1e`, borda `#303034`, texto `#fafafa`,
  secundário `#a1a1aa`, teal `#2f9c85`, teal claro `#5dbeb0`, raio `16px`.
  Implementação usa apenas os tokens semânticos equivalentes nos temas claro e escuro.
- Não criar fundo quadriculado. As poucas seções do hub ocupam a largura disponível, com ícone,
  rótulo e estado ativo claros.

## 8. Gates de aceite

- [ ] Solo vê a Visão geral e abre as três filas; retorno futuro exclui reativação.
- [ ] Gestor vê caixa, fluxo de colunas, tendências, previsão, equipe com horas
  atendidas/disponíveis e custo/hora de cada dentista, além de uma área de repasses/custos.
- [ ] Dentista não vê acordo ou histórico de repasse dentro de Meu Financeiro.
- [ ] Meu Financeiro mantém o Custo por Hora Clínica do próprio dentista, com custos atribuídos
  e horas disponíveis à vista; sem base, mostra `—`.
- [ ] Proprietário dentista aparece como `Você · proprietário` e o gestor vê custo/hora de cada
  profissional no desempenho da equipe.
- [ ] Pagamento confirmado de R$ 10.000 aparece em caixa e recebido vinculado; não aparece como
  repasse pago até a confirmação desse repasse.
- [ ] Margem, contribuição, ponto de equilíbrio e hora nunca usam valor inventado quando falta
  custo ou horas. Margem permanece `—` enquanto a base de custos do período não estiver validada.
- [ ] Cliques das filas abrem lista filtrada e WhatsApp preparado, sem disparo automático.
- [ ] Profissional abre histórico próprio; outra clínica, outro dentista e secretaria não recebem
  dados fora de seu escopo em teste manual de duas contas.
- [ ] Recorrência aparece na previsão sem reduzir o saldo; pagamento confirmado reduz uma vez.
- [ ] Entrada avulsa e saída pontual são registradas no Financeiro da Clínica e aparecem no
  extrato da unidade; não entram no Meu Financeiro do dentista que realizou o lançamento.
- [ ] Pagamento de paciente lançado no orçamento/ficha chega à clínica uma vez e não é
  repetido por "Registrar entrada".
- [ ] Compra de material reduz caixa uma vez; uso no atendimento atribui custo direto, sem
  nova despesa financeira. Fôlego e saldo projetado exibem `—` sem saldo conciliado.
- [ ] Typecheck, lint, testes relevantes, build e verificação visual dos dois temas passam antes
  de preview. Migration, se necessária, é isolada e aplicada antes do código dependente.

## 9. Fora de escopo

Folha trabalhista, contabilidade fiscal, imposto, conciliação Open Finance, extração de regra de
PDF, rateio arbitrário de custo, custo clínico por cadeira sem horas reais e mensagem automática
por WhatsApp.

## Histórico V1

A migration `20260923183000_r164_repasses_financeiro_pessoal.sql` já existe no banco principal:
`acordos_repasse`, `repasses`, snapshots e RPCs de geração/pagamento. Ela permanece como fonte
de fatos de repasse. A implementação V2 apenas reposiciona sua leitura no Financeiro da Clínica
e corrige os contratos de agregação e apresentação acima.
