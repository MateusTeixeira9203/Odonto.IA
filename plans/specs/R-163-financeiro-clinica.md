# R-163 — Financeiro da clínica e responsabilidade dos recebimentos

> **SPEC** · **R-163** · 🔵 ativo
> **Aberto:** 2026-09-10 · **Fase:** implementação e validação · Migration aplicada em 23/09/2026.
> Depende de R-159/R-160; preserva o motor de orçamento/cobrança do R-145/R-157.

## 1. Problema

Hoje os valores são filtrados pelo dentista. Uma clínica gerida precisa distinguir a
quem pertence o recebimento, quem atendeu e quem operou o caixa; não pode usar o gestor
como dentista fictício nem somar receita do profissional e da clínica duas vezes.

## 2. Decisões de 21/09

- `responsavelClinico`, `atorFinanceiro` e `titularFinanceiro` são conceitos distintos.
  Todo orçamento é criado pelo dentista responsável; isto nunca define sozinho quem recebe.
- Na clínica colaborativa, cada dentista é titular dos próprios orçamentos, recebimentos e
  financeiro. A clínica não centraliza esses valores e cada profissional pode operar sua PJ.
- Nas clínicas geridas, com proprietário dentista ou não clínico, a clínica é titular dos
  recebimentos. O proprietário vê todos os orçamentos, quem os criou e o financeiro de cada
  dentista; o profissional conserva a autoria clínica e sua produção.
- O titular é definido pela modalidade da clínica, sem escolha manual por orçamento nesta
  entrega. Legado mantém o titular dentista original; nenhuma migração reatribui fatos passados.
- Aceite aprova proposta e cria previsão/conta a receber, mas não é caixa recebido. Para cartão,
  uma confirmação explícita única registra as parcelas nos meses corretos, sem baixa mensal.
  Acordo sem transação confirmada permanece previsão, mesmo se houver expectativa de pagamento.
- Repasses por percentual, mensalidade, diária ou outro contrato serão modelados depois como
  regra separada do recebimento do paciente; não calcular ou lançar repasse automático agora.
- Custos fixos devem poder ser configurados como recorrentes para formar a previsão mensal.
  Cada pagamento efetivo de despesa permanece um fato separado, para não apresentar previsão
  como saída de caixa.
- Na clínica gerida, o proprietário vê os indicadores e fatos financeiros da unidade. Dentista
  vê a situação de pagamento e produção dos próprios orçamentos. Gestor pode acumular atuação
  clínica, mas só vê o financeiro amplo quando receber essa permissão explicitamente.

## 3. Fluxo e estados do dinheiro

Tabela/ficha → proposta → itens aceitos pelo paciente → cobrança por etapa e acordo →
registro por pessoa com permissão → recebimento confirmado → saldo atualizado na ficha,
Meu Consultório e relatórios, usando as mesmas transações.

| Fato | Propostas | Contas a receber | Caixa recebido |
|---|---|---|---|
| Orçamento gerado 30 mil | 30 mil | 0 | 0 |
| Paciente aceita etapa superior 15 mil | Composição preservada | 15 mil | 0 |
| Registrado PIX 5 mil para essa etapa | Sem alterar itens | 10 mil restantes | 5 mil |
| Estorno integral desse PIX | Histórico preservado | 15 mil | Valor líquido 0, com estorno visível |

“Pendente” sempre tem contexto: proposta aguardando paciente, cobrança a receber ou
solicitação de desconto. Pagamento cancelado/estornado é histórico, não saldo positivo.
Mostrar recebido, estornado e líquido quando necessário; não apresentar cancelado e pago
como duas cobranças ativas equivalentes no resumo.

Acordo por cobrança: observação opcional preservada do R-157 (até 2000 caracteres),
vencimentos e recebimentos parciais independentes. Texto não confirma entrada de dinheiro.
Registrar valor, forma, data efetiva, etapa e observação; mostrar titular antes de confirmar.

## 4. Contrato técnico proposto

### Base real

- `src/app/dashboard/financeiro/actions.ts` lê despesas, receitas_manuais, pagamentos e cobranças.
- `src/lib/financeiro/{agregacao,calculos,cobrancas,schemas}.ts` concentra cálculos do R-157.
- `registrarRecebimento` delega a `registrarPagamento` de orçamento; não criar um INSERT paralelo.
- RPCs reais locais: `registrar_recebimento_orcamento`, `confirmar_previsao_orcamento`,
  `corrigir_recebimento_orcamento`, `estornar_recebimento_orcamento`, `reorganizar_parcelas_orcamento`.
- `calcularHoraClinica` usa despesas fixas e grade atual; é estimativa, não horas atendidas.
- `pagamentos` usa status pendente/pago/cancelado; tipo local `transferencia` é adaptado como
  outro no legado. Nova label não autoriza mudar CHECK em produção sem migration específica.

```ts
type TitularFinanceiro = { tipo: 'clinica' } | { tipo: 'dentista'; dentistaId: string };
type ModoRecebimento = 'clinica' | 'dentistas' | 'misto';
interface ContextoFinanceiro {
  clinicaId: string; titular: TitularFinanceiro; responsavelClinicoId: string;
}
interface ReceberInput {
  clinicaIdEsperada: string; cobrancaId: string; versaoEsperada: number;
  valorCentavos: number; formaPagamento: FormaPagamento; dataEfetiva: string;
  observacoes: string | null; chaveIdempotencia: string;
}
interface EstornarInput {
  clinicaIdEsperada: string; pagamentoId: string; versaoEsperada: number;
  motivo: string; chaveIdempotencia: string;
}
interface ResumoCaixa {
  recebidoCentavos: number; estornadoCentavos: number; liquidoRecebidoCentavos: number;
  despesasCentavos: number; saldoCentavos: number; aReceberCentavos: number;
}
```

FormaPagamento reutiliza a união real das actions; não duplicar valores permitidos.
Actions/RPCs expõem resultado discriminado R-159 e falhas SALDO_EXCEDIDO, TITULAR_INDEFINIDO,
SEM_ACEITE, VALOR_INFERIOR_RECEBIDO, CONTEXTO_ALTERADO e CONFLITO.
Zod: UUID, valor inteiro seguro positivo em centavos, data ISO válida, observações <=2000,
motivo de estorno 1–500; todos os IDs validados contra clínica/cobrança/paciente no servidor.
Titular, paciente e responsável são carregados da cobrança; não confiados ao formulário.

### Schema aditivo proposto

| Objeto | Campos/constraints |
|---|---|
| `clinica_politica_financeira` | clinica_id PK, modo_recebimento, titular_padrao_tipo/dentista_id nullable, versao. Validação do padrão contra modo. |
| `orcamento_titularidade` | clinica_id, orcamento_id único, tipo, titular_dentista_id nullable, definido_por_usuario_id, versao, created_at. CHECK tipo/ID; FKs compostas. |
| `financeiro_operacoes` | id, clinica_id, ator_usuario_id, pagamento_id/cobranca_id, tipo, chave_idempotencia, payload_hash, resultado, created_at; UNIQUE ator+clínica+chave. |
| `financeiro_lancamentos_clinica` | id, clinica_id, tipo receita_manual/despesa/transferencia, valor_centavos, data_efetiva, descricao, categoria, custo_tipo fixo/variavel nullable, origem_ref nullable, ator_usuario_id, reversao_de nullable, created_at; append-only. |

Pagamentos de pacientes continuam em `pagamentos`/cobranças; tabela de lançamentos da
clínica não duplica esses recebimentos. Fatos pessoais atuais continuam nas tabelas atuais.
Orçamento sem titularidade nova mantém interpretação pelo dentista original; nunca pelo
usuário atual. Não fazer backfill presumindo dinheiro da clínica.
Auditoria transacional e origem preservam quem registrou. Corrigir/estornar reutiliza a
transação existente e acrescenta metadados necessários; não manter dois motores de saldo.
Antes de integrar, conferir policies e nulabilidade reais, não tornar `dentista_id` opcional
em todas as tabelas como atalho para suportar gestores.

### Transação de recebimento

Resolver contexto/permissão → travar cobrança e versão → validar aceite/desconto/titular →
calcular saldo no banco → verificar idempotência/payload → gravar recebimento e auditoria →
retornar novo saldo → invalidar leituras da mesma unidade/titular. Concorrência não excede saldo.

- Registrar exige `recebimentos.registrar`; confirmar previsão também. Corrigir e estornar
  verificam permissões próprias, sem herdá-las de registrar. Operador pode ser não clínico.
- Excluir/cancelar cobrança com pagamento não apaga recebimento; resolver estorno explicitamente.
- Caixa não considera pagamentos pendentes ou cancelados como recebidos. Lista de histórico
  mostra motivo, ator e referência à correção, sem esconder que o dinheiro existiu.
- Repetição após timeout devolve resultado da mesma operação; payload diferente conflita.
- Valor final da cobrança nunca abaixo do já recebido sem tratamento explícito de devolução.
- Atualizar acordo, reorganizar parcela ou recebimento não concede desconto por caminho indireto.

### Métricas e escopos

- Período mensal na data efetiva, fuso BRT atual; tela, gráfico e CSV usam mesma agregação.
- Recebido: pagamentos confirmados + receita manual pertinente; nunca soma propostas.
- Despesa: fato de saída no escopo; orçamento, compra esperada e repasse previsto não são saída.
- A receber: saldo dos itens aceitos/cobranças ativas menos recebimentos líquidos, sem contar
  simultaneamente orçamento pai e etapas. Sem vencimento aparece separado, não “atrasado”.
- Visão Clínica mostra titular clínica; Meus atendimentos pode mostrar produção clínica,
  mas receita própria somente titular dentista. Rótulo informa a diferença.
- Consolidado soma fontes sem duplicar transferência interna/repasse. Sem vínculo entre
  lançamentos, mostrar pendência de conciliação; não declarar resultado consolidado líquido final.
- Não chamar saldo de caixa de lucro. Tributos, depreciação e apuração contábil não estão entregues.

### Hora clínica — o que será refinado

Exibir duas medidas separadas: custo fixo por hora de capacidade estimada e, futuramente,
horas efetivamente atendidas. Reutilizar R-157 para estimativa individual; grade atual não
reconstitui agenda histórica. Guardar a indicação da fonte/limitação na tela e no relatório.
Na unidade: cadastrar salas/cadeiras e capacidade configurada em minutos por período antes
de calcular custo fixo/hora clínica; somar agendas sobrepostas na mesma cadeira é incorreto.
Sem capacidade física configurada, mostrar indisponível para clínica; manter estimativa pessoal.
Custo clínico de procedimentos, ocupação por cadeira e rateio de despesas serão subrecorte
próprio após validar capacidade; não expor cálculo aparente usando soma simples de dentistas.

## 5. Comportamento

| Estado | Resultado |
|---|---|
| Vazio | Sem movimento no período; zeros apenas quando consulta completa confirmou ausência. |
| Carregando | Feedback preserva formulário e filtros, sem enviar duas operações. |
| Sucesso | Ficha, cobrança e caixa mostram mesmo saldo; quem recebeu e titular identificados. |
| Inválido | Campo/valor/data destacados; nada parcialmente lançado. |
| Sem acesso | Pode consultar pendência mínima se autorizado, mas não registrar/estornar. |
| Ausente/desatualizado | Cobrança mudou ou sumiu: revisar estado atual, sem sucesso falso. |
| Conflito | Duas pessoas recebem ao mesmo tempo: saldo protegido, tentativa rejeitada preservada. |
| Falha técnica | Não mostrar zero no lugar de erro; retry pela mesma chave. |

Exemplos: recepcionista sem permissão não registra PIX; gestor autorizado registra para
tratamento de outro dentista, mantendo esse dentista como responsável; trocar unidade com
modal aberto retorna CONTEXTO_ALTERADO; orçamento legado permanece no financeiro original.

## 6. Referência visual

Meu Consultório → Financeiro, atalhos da ficha abrem a mesma fonte. Rótulos de unidade,
titular e responsável; recebido e pendente separados; cancelados na trilha de histórico.
Preservar agrupamento, composição e observações R-157. Artefato ainda não aprovado.

Revisão aprovada em 23/09/2026:

- **Artefato vigente:** [R-163-financeiro-clinica-v2.html](../artefatos/R-163-financeiro-clinica-v2.html).
- **Rota alvo:** /dashboard/meu-consultorio/financeiro-clinica.
- Hierarquia: tendências → Caixa da clínica → Fluxo e previsão → Recebimentos por profissional
  → Extrato da clínica.
- Caixa confirmado, valores a receber e despesas previstas aparecem como grupos distintos.
  “Saldo de caixa” não recebe rótulo de lucro contábil.
- Resultado operacional estimado = recebido confirmado − despesas operacionais registradas.
  Margem operacional estimada = resultado operacional estimado ÷ recebido confirmado. O valor
  mostra “estimativa incompleta” se custos obrigatórios ainda não foram cadastrados.
- Fôlego de caixa = saldo de caixa ÷ média de despesas fixas mensais. Sem despesas fixas
  cadastradas, o indicador é indisponível; nunca retorna infinito, zero fictício ou recomendação
  de investimento.
- Fontes: DM Serif Display nos títulos, Outfit no corpo e DM Mono nos valores.

### Custos fixos recorrentes

- `despesas_recorrentes` é uma regra de previsão por clínica: descrição, categoria, valor
  mensal, dia de vencimento entre 1–28 e estado ativo. Não cria `despesas` automaticamente.
- Somente proprietário ou membro com `despesas.gerir` no escopo `clinica` cria/edita/pausa a
  regra. Quem só possui `financeiro.ler` pode ler o resumo, sem receber acesso de escrita.
- A RPC de leitura devolve as regras e `despesasFixasPrevistas`; fôlego usa saldo de caixa /
  despesas fixas previstas ativas. Sem regra ativa, fôlego é indisponível.
- O resultado operacional usa despesas já registradas. A tela mantém o rótulo “estimado” pois
  não infere tributos, depreciação, repasses ou custo que ainda não foi cadastrado.
- Tokens extraídos do Financeiro atual: teal #2f9c85, teal claro #5dbeb0, surface
  #111112, surface-alt #1c1c1e, texto #fafafa, texto secundário #a1a1aa,
  borda #27272a, coral #ef9a9a.

## 7. Invariantes

Sem receita por proposta, perda de pagamento, mudança de autor clínico, duplicidade por
etapa/repasse, estorno sem motivo, acesso por cargo ou histórico reatribuído ao proprietário.

## 8. Gates de aceite

Integração transacional e duas contas QA; comparação com dados sintéticos controlados.
- [ ] Cenário 30/15/5 mil da §3 bate na ficha, cobrança, caixa, gráfico e CSV.
- [ ] Dois recebimentos parciais separados preservam acordo e saldo por etapa.
- [ ] Mesma operação repetida não duplica; simultâneas não ultrapassam saldo.
- [ ] Permissões independentes de registrar/corrigir/estornar funcionam também por RPC.
- [ ] Clínica, dentista e operador diferentes não reatribuem autoria nem duplicam receita.
- [ ] Mudança de titular bloqueada depois de aceite/cobrança; legado não muda beneficiário.
- [ ] Pagamento cancelado/estornado aparece como histórico e não receita ativa duplicada.
- [ ] Zero capacidade difere de custo zero; clínica sem cadeira/grade não ganha número fictício.
- [ ] Mesma data/período/escopo produz mesmos totais; cada estado da §5 foi reproduzido.
- [ ] Reversão de código mantém fatos novos legíveis; comparações antes/depois preservam legados.

## 9. Fora de escopo

Contabilidade fiscal, lucro apurado, remessa bancária, percentuais automáticos de repasse,
aluguel por cadeira automatizado, contas de paciente entre unidades, reatribuição histórica.
