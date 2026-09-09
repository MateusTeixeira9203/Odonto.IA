# R-157 — Financeiro consistente e orçamento por grupos

> **SPEC** · **R-157** · 🔵 ativo
> **Aberto:** 2026-09-09 · **Fechado:** — · **Fase:** contrato
> Usuário solicitou spec completa e execução hoje nesta conversa. Execução autorizada;
> decisões técnicas abaixo explicitadas sem marcar aprovação formal da spec em seu nome.

## 1. Resultado e limites

O dentista negocia grupos de procedimentos com preço fechado, registra o acordo escrito
na cobrança e recebe cada parte conforme o tratamento avança. Financeiro, extrato, gráficos,
previsões e Ficha devem concordar sobre os valores e o responsável.
Caso de referência: R$ 30.000; arcada superior R$ 15.000 e inferior R$ 15.000.

Entra: correção dos defeitos enumerados abaixo, agrupamento durante montagem do orçamento,
preço por grupo, composição persistida, observação por cobrança, recebimento por etapa,
PDF/aceite coerentes e regressão dos fluxos individuais.
Não entra: Meu Consultório, nova matriz de papéis, estoque, webhook, recorrência contábil,
rateio de custos da clínica, integração bancária, alterações do prontuário ou catálogo.
Hora clínica neste recorte é estimativa com a grade atual, explicitamente identificada;
histórico de capacidade e apuração de horas efetivamente atendidas exigem contrato próprio.

## 2. Evidências e causas a corrigir

| Defeito confirmado por leitura | Causa | Correção e evidência exigida |
|---|---|---|
| Receitas manuais ausentes em gráficos | Consultas usam só pagamentos e despesas | Mesma base e janela, teste com entrada manual e pagamento |
| Comparativo errado em mês passado | Últimos meses ancorados no mês atual | Janela termina no mês escolhido |
| Saldo fica antigo após refresh | Props recebidas, estado inicial não sincronizado | Derivar do resultado vigente, atualizar após mutations |
| Filtro da secretária incompleto | Seletor usado nos formulários, não em consultas/export | Mesmo filtro server-side em listas, saldo, gráficos, hora e CSV |
| Recebimento não baixa a etapa | Financeiro chama RPC do orçamento inteiro | Escolher cobrança ativa e usar registrar_recebimento_cobranca |
| Só oito pendências visíveis | slice sem continuação | Mostrar mais, mantendo total e lista conferíveis |
| Ocultar valores deixa tooltip exposto | Gráfico não respeita privacidade | Ocultar números também no gráfico/tooltip |
| Lançamento manual mal validado | Confiança em form e alvo informado | Zod no servidor e alvo ativo da clínica |
| Exclusão pode responder sucesso sem excluir | UPDATE/DELETE sem conferir linha afetada | Escopo individual e retorno conferido |
| Hora clínica bruta | Almoço não descontado, escopo impreciso e rótulo trabalhadas | Grade líquida por responsável, sem sobreposição, estimativa explícita |
| Orçamento exige preço por procedimento | Validação barra zero antes do valor final | Grupo tem um preço; composição não exige preços individuais |
| Falta observação do combinado | Condições automáticas não são campo livre de etapa | Campo específico, persistido e mostrado após reabrir |

Fontes: código atual de financeiro/actions, page e client; use-orcamento-modal;
conversas “Refinar financeiro e hora clínica” e “Revisar financeiro e hora clínica”.
Achados de leitura devem passar por teste comportamental; não equivalem à validação em produção.

## 3. Invariantes

1. Toda consulta/mutação usa clínica ativa; admin/dentista veem seus valores, secretária tem
   escopo operacional existente. Escolher filtro não concede nova permissão.
2. Valor recebido = somente pagamentos pagos + receitas manuais; previsto não é recebido.
   Histórico cancelado não soma; saldo de caixa não é lucro contábil.
3. Grupo é uma unidade comercial com preço fechado e lista de procedimentos incluídos.
   Procedimentos e seus eventos clínicos continuam intactos na Ficha.
4. Nenhum preço fictício ou rateio automático entre procedimentos do grupo.
5. Aprovação/cobrança do grupo é integral nesta entrega. Para remover componente, desfazer
   agrupamento antes de salvar. Alterar pacote aceito/cobrado requer renegociação posterior,
   não edição silenciosa; edição de composição persistida fica fora deste recorte.
6. Parcela é vencimento; grupo é composição comercial; cobrança é obrigação registrada.
   Criar orçamento ou escrever observação não cria receita nem comprova pagamento.
7. Cada evento só pode ser orçado uma vez conforme guarda existente. Grupo não contorna
   paciente, Ficha, dentista, catálogo ou autorização da RPC atual.
8. Receber na superior não baixa a inferior. Corrigir/estornar mantém vínculo e histórico.
9. Falha de persistência não fecha formulário nem perde texto. Cliques enquanto salvando ficam
   bloqueados; não prometer idempotência de rede além da garantia transacional comprovada.
10. Usuário autorizou explicitamente usar o Supabase online atual em 09/09. Migração aditiva
    atômica; nenhum dado de cliente é apagado/reescrito. QA usa apenas dados fictícios na clínica de teste.

## 4. Contratos de dados

```ts
interface ComponenteGrupoOrcamento {
  descricao: string; // 1..500
  quantidade: number; // inteiro 1..99
  procedimentoId: string | null;
  eventoIds: string[]; // UUID, clínicos, mesma Ficha/responsável
}
interface GrupoNaMontagem {
  nome: string; // 1..120
  valor: number; // positivo, centavos
  componentes: ComponenteGrupoOrcamento[]; // 2..100
}
interface CriarCobrancaEtapaInput {
  orcamentoId: string; pacienteId: string; itemIds: string[];
  desconto: number; numeroParcelas: number; primeiroVencimento: string;
  observacoes?: string; // até 2000; trim; vazio = null
}
```

Persistência mínima: grupo usa uma linha de `orcamento_itens` já existente, quantidade 1,
preco_unitario/preco_total iguais ao preço do grupo, descricao = nome;
novo `composicao jsonb null` guarda os componentes sem atribuir preço individual.
Itens individuais continuam com composicao=null e comportamento anterior.
Os eventos de todos os componentes passam pela validação e vínculo `orcamento_eventos` já existente.
`etapa_id` legado não será reaproveitado como se fosse agrupamento financeiro.

`orcamento_cobrancas.observacoes text null`, limite 2000; texto do acordo é independente
 de `orcamentos.condicoes_pagamento`, que hoje pode ser gerado automaticamente.
Colunas aditivas; nenhuma nova tabela/role/policy. RPCs existentes recebem campo aditivo
em p_itens via entradas _r157 (falham explicitamente se banco não migrado) e observação opcional em criar_cobranca_orcamento; chamadas antigas continuam válidas.
Aplicação online autorizada nesta conversa; conferir definições atuais, guardas e reversão antes.

Contratos Financeiro: leituras aceitam dentistaFiltro opcional, validado na clínica ativa;
listarUltimosMeses recebe mês de referência opcional, default atual para demais chamadores.
Lista de recebimento traz cobrancaId quando etapa, saldo correto e responsável do orçamento,
nunca inferido do dono do cadastro do paciente. Legado sem cobranças continua disponível.
Actions retornam erro de validação/sem permissão/indisponível; falha de banco não vira lista vazia.

## 5. Experiência e estados

### Montagem de orçamento
- Manter modal atual, seleção para incluir/excluir e fluxo Ficha → orçamento.
- Seleção explícita separada para agrupar: escolher componentes, nome e preço fechado.
- Mostrar composição expandida/consultável; permitir desfazer grupo antes de persistir.
- Em grupos, negociar o preço no próprio grupo; desconto/vencimentos adicionais são definidos
  na cobrança. Não combinar desconto/plano global legado com grupos nem adicionar grupo a
  orçamento já negociado por esse modelo (desconto, valor acordado ou pagamentos legados).
- Documento mostra o preço fechado de cada grupo mesmo com valores individuais ocultos.
- Grupos de itens ainda sem evento clínico precisam passar pelo checkpoint já existente antes
  de agrupar; não transformar pacote comercial em um procedimento clínico fictício.
- Vazio: orientação para selecionar ao menos dois procedimentos; erro: perto do campo.
- Carregando: botão bloqueado e estado perceptível; conflito: preservar rascunho e orientar recarga.
- Itens não agrupados continuam aceitando preço do catálogo. Quantidade do grupo sempre 1.

### Cobrança e acordo
- Criar cobrança com seleção de um ou mais itens/grupos aprovados, desconto e vencimentos.
- Campo “Observação do acordo”, exemplo “Superior no início; inferior quando iniciarmos a fase”.
- Identificar como texto visível para equipe autorizada; se incluído em documento do paciente,
  tornar esse compartilhamento explícito. Não reaproveitar notas clínicas.
- Mostrar observação após salvar/reabrir e junto da etapa correta. Não interpretar texto como data
  ou disparador automático de cobrança; primeiro vencimento continua explícito.
- Receber da etapa selecionada no Financeiro usa a mesma transação da Ficha.

### Financeiro e hora clínica
- Mês e responsável visíveis, filtros persistem na URL/exportação.
- Receita, despesa e saldo mudam juntos após a gravação; forms preservam erro e não fecham em falha.
- Pendências são de todos os vencimentos, rotuladas assim; extrato e indicadores respeitam o mês.
- Privacidade cobre números em cartões, extrato e gráficos, inclusive tooltip.
- Custo fixo/hora = despesas fixas do escopo no mês / capacidade líquida estimada no mês.
  Descontar interseção do almoço com a jornada, unir turnos sobrepostos por dia/dentista;
  não descontar intervalo_minutos de cada slot como se fosse pausa (é tamanho do agendamento).
- Zero capacidade: indisponível, não custo zero. Não chamar estimativa de horas trabalhadas.
  Histórico de agenda não disponível: informar “estimativa com a grade atual”.

### Referência visual
Alteração funcional dentro dos modais e Financeiro atuais, sem redesign da navegação.
Referências de design existentes: plans/design/R-135-orcamento-claro-DESIGN.md e R-136-financeiro-orcamento-DESIGN.md.
Reutilizar componentes de campo, Input, Textarea, botão e Sheet existentes; tokens
bg-background/bg-card/text-foreground/text-muted-foreground/border-border, spacing 2/3/4/6,
campos min-h-11, texto base sm, labels explícitos. Conferir mobile 390px, desktop, light e dark.
Nenhum artefato visual novo aprovado nesta conversa; não replicar redesenho de outra frente.

## 6. Implementação e divisão

A — Financeiro: actions/page/client e helpers puros de datas, agregação e hora clínica.
B — Orçamento: tipos, montagem/agrupamento, actions, RPCs, detalhe/cobrança, composição PDF/aceite.
C — Integração: recebimentos por etapa, regressão e migração local. Root integra as duas frentes.
Spec vem antes de produção; alterar este contrato antes de qualquer desvio necessário.
Não misturar alterações locais R-155, retorno ou outras frentes em commit/release.

## 7. Gates de aceite

1. R$ 15 mil superior + R$ 15 mil inferior sem preço nos componentes = proposta R$ 30 mil;
   composição e eventos intactos ao reabrir; PDF e aceite descrevem o contratado.
2. Aprovar só superior = aprovado R$ 15 mil; inferior não cobrada. Criar etapa superior,
   registrar R$ 5 mil = pago 5 mil/saldo 10 mil; repetir inferior não altera superior.
3. Observação com acentos/quebra de linha preservada após reabrir; vazio permitido,
   >2000 rejeitado no servidor/banco; texto não cria recebimento automático.
4. Recebimento da secretária baixa a mesma etapa da Ficha; orçamento legado continua funcionando.
5. Receita manual 100 + pagamento pago 200 - despesa 50 = saldo 250, gráfico e CSV coerentes;
   cancelado 500 não soma; trocar para mês passado ancora a série naquele mês.
6. Filtrar dentista A não inclui B na lista, total, gráfico, hora ou exportação. Duas contas
   logadas para guarda de isolamento; sem mutações em clínica real.
7. Lançamento com valor inválido/data inválida/responsável externo é rejeitado; excluir ID
   inexistente ou de outro responsável não responde sucesso.
8. Hora 08–18, almoço 12–13 = 9h/dia; sem grade = indisponível; sobreposição não duplica hora.
9. Após salvar/receber/excluir, cartões e extrato concordam sem reload manual; >8 pendências acessíveis.
10. Grupo não perde vínculo de Ficha; erro de backend conserva rascunho; privacidade e mobile conferidos.

## 8. Testes e entrega

Unitários sobre agregação/centavos/janelas/horas/grupo e schemas; testes de actions com contratos
reais; SQL local transacional para agrupamento/acordo/isolamento/cobrança/correção/estorno.
Typecheck e lint nos arquivos alterados; build somente após testes, sequencial para limitar RAM.
QA navegador em localhost conectado ao Supabase online, clínica de teste autorizada. Provas pendentes ficam identificadas, nunca “100%”
por compilar. Migration/schema, código financeiro, código orçamento e docs em commits separados
quando revisados. Publicação é etapa posterior; rollback do app preserva colunas aditivas.

Evidências da execução e pendências de validação: [registro local de 09/09](../auditorias/2026-09-09-r157-validacao-local.md).
