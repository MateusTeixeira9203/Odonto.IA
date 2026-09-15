# R-163a — Clínica e resultados dos proprietários

> Contrato · 14/09/2026 · Execução autorizada por Mateus nesta conversa.
> Recorte de R163/R159. Candidato isolado; sem commit/push antes da conferência.

## Decisão e limites

Proprietário dentista: nome Clínica na barra; Meus resultados reaproveita o financeiro
pessoal; Resultados da clínica é uma leitura administrativa por unidade/período/profissional.
Proprietário não clínico entra em /clinica, sem criação de dentista e sem atalhos clínicos.
Dentista comum conserva Consultório. Ser admin legado não implica propriedade: verificar
governança de clínica gerida e vínculo ativo. Sem gestor delegado nesta entrega.
modelo_clinica é independente de modelo_estoque; migração única preserva o modelo já
configurado. Responsável técnico de uma colaborativa não vira proprietário.
Usuário escolheu recebimentos mistos por atendimento. Beneficiário fica no orçamento;
legado permanece do dentista original. Não reatribuir histórico nem calcular repasse automático.
Escolha clínica/dentista responsável antes de criar orçamento; suas cobranças e pagamentos
herdam a escolha. A UI não edita a escolha depois da criação; no banco, só rascunho sem
envio, aceite, plano, cobrança ou pagamento pode mudar. Item incluído depois mantém
o titular do orçamento. O responsável clínico e o operador permanecem nos campos atuais.

## Contrato técnico

- RPC obter_contexto_clinica(uuid): vínculo ativo e clínica esperada → clinicaId, nome,
  proprietario, dentistaId nullable, gestaoDisponivel. Não devolve dados de pacientes.
- RPC listar_resultados_clinica(uuid,text,uuid nullable): somente proprietário ativo.
  Retorna totais por mês BRT, caixa da clínica separado de recebimentos diretos dos
  profissionais, despesas próprias da clínica, saldo, recebíveis e desempenho por dentista.
  Filtro de profissional modifica produção/recebimentos; despesas fixas permanecem da unidade,
  não há rateio presumido. UI não subtrai despesas gerais de um dentista selecionado.
- Resultados financeiros só incluem pagos na data efetiva; cancelados/pendentes não são caixa.
  Contas a receber: cobranças abertas menos pagos por cobrança; orçamento sem cobrança usa
  itens aprovados/valor acordado menos pagos. Nunca somar pai e suas cobranças. Pagos
  sem etapa abatem uma única vez o agregado do orçamento, sem inventar alocação por etapa.
- Operação clínica: consultas realizadas/faltas/cancelamentos por data da agenda no mês;
  confirmações pendentes do dia seguinte BRT. Não ler evolução, documentos ou anamnese.
- Campos aditivos titular_recebimento em orcamentos/pagamentos/orcamento_cobrancas,
  CHECK dentista/clinica, default dentista para preservar legado. Trigger herda e valida
  origem composta clínica/orçamento/paciente/profissional/cobrança; dentista nulo legado
  deriva do orçamento. Novos orçamentos da clínica exigem responsável ativo; identidade financeira não muda durante correção/estorno.
- Wrapper criar_orcamento_com_titular recebe argumentos existentes + titular; delega aos
  motores reais de orçamento e define titular dentro da mesma transação. Guards existentes
  continuam responsáveis por ficha/eventos/aceite. Sem fonte paralela de pagamentos.
- Financeiro pessoal existente filtra titular dentista somente no piloto Free; caixa da
  clínica usa titular clínica. Produção não depende de colunas/migrations ainda não aplicadas.
- Resposta tipada {ok:true,data}|{ok:false,codigo,mensagem}; datas/UUIDs com Zod. Falha
  de consulta nunca vira zeros. Sem cache compartilhado entre usuários/clínicas.
- Rotas /clinica e /clinica/meus-resultados; última exige proprietário clínico. Shell
  existente recebe contexto de gestão e mantém barra inferior. Sem painel clínico fictício.
- Equipe/Estoque existentes continuam disponíveis por suas permissões. Procedimentos e
  configurações não clínicas ainda sem consumidor operacional não ganham link quebrado.

## Visual

Reusar PageContainer, PageTransition, tokens e fontes do Dashboard/Financeiro.
Título Clínica em font-heading 30/36px; Outfit corpo, mono nos valores. Abas existentes,
cards bg-card/border-border, texto text-foreground/text-muted-foreground, sem nova paleta.
Quatro indicadores financeiros, resumo operacional e tabela por profissional; no mobile
cards empilham e tabela mantém rótulos. Claro/escuro e teclado; motion discreto/reduzível.
Brief: ../design/R-163a-clinica-DESIGN.md. Sem redesenhar o financeiro pessoal aprovado.

## Casos de aceite

1. Proprietário dentista vê as duas visões; proprietário não clínico só gestão.
2. Dentista comum não acessa métricas alheias por URL/RPC; membro suspenso também não.
3. Duas clínicas novas sintéticas, cada uma com profissional/pacientes/consultas/orçamentos.
   Nenhum resultado, nome ou contador cruza unidades; testar duas sessões logadas.
4. Recebimento pessoal 300 e da clínica 700: pessoal 300, clínica 700, produção recebida
   do profissional 1000 sem confundir com caixa pessoal; proposta não paga não acrescenta caixa.
5. Cancelamento não soma; parcial deixa saldo correto; filtro/mês, indicadores e tabela usam os mesmos fatos.
6. RPC direta não muda titular após envio/aceite/plano/cobrança/pagamento; falha do wrapper não deixa orçamento parcial.
7. Navegação/login/retorno ao atendimento não geram ciclo. Owner sem perfil não recebe ficha.
8. Vazio, erro, carregando, sessão expirada, acesso negado, data inválida e mobile testados.
9. Agente Luna executa verificações; só testes no Free, nunca dados reais ou mensagens externas.

## Fora deste recorte

Repasses automáticos, lucro contábil, aluguel/cadeira, rateio, multiunidades consolidado,
editor completo de equipe, gestão de preços/configurações sem perfil clínico e ampliação
de recepção legada. Gate integrado Next deve ser identificado separadamente do harness.

## Conferência combinada em 14/09

Mateus limitou os testes de hoje à clínica de proprietário dentista já existente.
Duas clínicas, proprietário não clínico e isolamento entre sessões ficam para amanhã.
Esse adiamento não remove os gates 1–3 e 7, nem autoriza commit/push/liberação.
