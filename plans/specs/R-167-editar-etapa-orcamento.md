# R-167 — Editar etapa do orçamento

> **SPEC** · **R-167** · ⏳ fila
> **Aberto:** 2026-09-11 · **Fechado:** — · **Fase:** aprovada

## 1. Problema

A etapa de cobrança fica presa quando alguém escolhe apenas parte dos procedimentos ou informa
o valor negociado no campo de desconto. Se já houver recebimento, cancelar a etapa deixa de ser
permitido. O dentista também relata que a exclusão do orçamento deixa de estar disponível quando
há registro financeiro, embora a regra existente diga que pagamento deve gerar aviso, não bloqueio.

## 2. Decisão e alternativas descartadas

| Decisão | Alternativa descartada | Motivo |
|---|---|---|
| Editar a etapa aberta, incluindo procedimentos e valor final negociado | Cancelar e recriar sempre | Etapa com recebimento não pode ser cancelada sem perder a relação financeira |
| Pedir o valor final como campo principal e derivar o desconto | Pedir desconto como entrada principal | A operação conhece o combinado com o paciente; a subtração é mecânica |
| Preservar todos os recebimentos confirmados | Recriar os pagamentos ao salvar | Dinheiro recebido é histórico e não pode mudar por efeito colateral |
| Permitir excluir ao dentista responsável mesmo com pagamento, com aviso reforçado | Bloquear orçamento com registro | A regra vigente já atribui essa decisão ao responsável e usa exclusão atômica em cascata |

## 3. Objetivo e como funciona

**Objetivo:** permitir que uma etapa aberta seja corrigida sem refazer o orçamento nem apagar
recebimentos já registrados.

No cartão da etapa, `Editar` abre os procedimentos aprovados do orçamento e o valor final
negociado. O usuário adiciona o procedimento que ficou de fora, remove um procedimento indevido
ou corrige o valor final. O sistema recalcula subtotal, desconto derivado, previsões e saldo.
O botão `Excluir orçamento` continua disponível ao dentista responsável; pagamentos apenas
mudam o texto da confirmação.

## 4. Contrato técnico

### Server action

```ts
type EditarCobrancaEtapaInput = {
  cobrancaId: string;
  pacienteId: string;
  itemIds: string[];
  valorFinal: number;
};

type EditarCobrancaEtapaResult = { error?: string };

editarCobrancaEtapa(input: EditarCobrancaEtapaInput): Promise<EditarCobrancaEtapaResult>;
```

Zod exige UUIDs, ao menos um `itemId` sem repetição e `valorFinal` finito, maior ou igual a zero,
com no máximo duas casas decimais. A action segue `criarCobrancaEtapa`: contexto de clínica,
RPC tipada e revalidação de paciente, Orçamentos e Financeiro.

### RPC

```sql
public.editar_cobranca_orcamento(
  p_cobranca_id uuid,
  p_item_ids uuid[],
  p_valor_final numeric
) returns public.orcamento_cobrancas
```

A RPC trava orçamento, etapa e itens durante a alteração. Aceita somente etapa `aberta` e ator
que passe pela mesma autorização de `criar_cobranca_orcamento`. Todos os itens precisam estar
aprovados, pertencer ao mesmo orçamento e à clínica ativa. Um item ligado ativamente a outra
etapa é rejeitado.

O subtotal é a soma de `orcamento_itens.preco_total` dos itens escolhidos. A RPC rejeita
`valorFinal > subtotal` e `valorFinal < soma dos pagamentos pagos da etapa`. Em uma transação,
ela atualiza os vínculos ativos e seus snapshots, grava `subtotal`,
`desconto = subtotal - valorFinal`, `valor_final`, recompõe apenas previsões pendentes e registra
`cobranca.etapa_editada` com antes/depois. Pagamentos `pago` ou `cancelado` não são reescritos.

Erros funcionais: `sem_permissao`, `cobranca_indisponivel`, `itens_invalidos`,
`item_nao_aprovado`, `item_ja_cobrado`, `subtotal_invalido`, `valor_final_invalido`,
`valor_final_abaixo_recebido` e `conflito_cobranca`.

### Interface existente

`CobrancasPorEtapa`, em `detalhe-orcamento-modal.tsx`, ganha o estado de edição dentro do cartão.
Os checkboxes mostram os itens atuais mais os aprovados que não estejam em outra etapa aberta.
O formulário contém `Valor final negociado`; subtotal e desconto calculado são somente leitura.
Parcelamento, vencimento e edição/estorno de recebimento continuam nos fluxos existentes.

A visibilidade de `Excluir orçamento` continua restrita ao dentista responsável. A presença de
pagamento ou aceite nunca esconde nem desabilita o botão. O servidor e a RLS permanecem como
fonte final de autorização.

## 5. Comportamento — o alvo funcional

### Estados

| Estado | Quando acontece | O que a tela mostra | O que a função faz |
|---|---|---|---|
| Vazio | N/A; etapa sempre tem ao menos um item | — | rejeita lista vazia |
| Carregando | Salvamento em andamento | Botões desabilitados e indicador no `Salvar` | aguarda uma única chamada |
| Sucesso | RPC confirma a edição | Card atualizado, toast e novo saldo | revalida paciente, Orçamentos e Financeiro |
| Erro de validação | Campo inválido ou valor fora dos limites | Mensagem junto ao formulário | não grava |
| Sem permissão | Outro responsável/clínica | Mensagem acionável | não grava e não expõe dados de outra clínica |
| Não encontrado/desatualizado | Etapa cancelada ou removida após abrir o formulário | Solicita atualizar a tela | não grava |
| Conflito | Item passou a integrar outra etapa | Informa que o procedimento já foi cobrado | não faz alteração parcial |

### Caminho principal

```text
Editar no cartão da etapa
  → selecionar procedimentos e informar o valor final
  → validar no cliente e na server action
  → RPC valida clínica, responsável, etapa, itens e total já recebido
  → atualizar etapa e vínculos numa única transação
  → recompor previsões pendentes e registrar atividade
  → atualizar o cartão e o Financeiro
```

### Exemplos concretos

| Dado/situação | Ação | Resultado esperado |
|---|---|---|
| Etapa de R$4.400 com um item e R$500 recebidos | Adicionar item de R$6.000 e informar final R$1.500 | Subtotal R$10.400, desconto derivado R$8.900, recebido R$500, saldo R$1.000 |
| Mesma etapa | Informar final R$400 | Salvar é rejeitado porque há R$500 recebidos |
| Etapa quitada em R$1.500 | Aumentar final para R$2.000 | Recebido permanece R$1.500 e saldo passa a R$500 |
| Item removido da etapa | Salvar | Item volta a ficar disponível para outra etapa; pagamento permanece |
| Orçamento do responsável com pagamento | Clicar `Excluir` | Modal avisa que o recebido sairá do financeiro e permite confirmar |

## 6. Referência visual

- **Artefato:** —; extensão do cartão existente, sem tela ou direção visual nova.
- **Rota alvo:** `/dashboard/pacientes/[id]`
- **Componente alvo:** `src/app/dashboard/pacientes/[id]/_components/modals/detalhe-orcamento-modal.tsx`
- **Tokens:** reutilizar integralmente os tokens, campos, checkboxes, feedback e geometria do
  formulário `Nova cobrança` dentro do mesmo componente.

## 7. Invariantes

- [x] Toda leitura/escrita usa `clinica_id` da sessão; IDs do cliente não definem clínica.
- [x] Recebimentos confirmados nunca são apagados ou alterados ao editar a etapa.
- [x] O valor final nunca fica abaixo do total recebido nem acima do subtotal selecionado.
- [x] Um item só pode pertencer a uma etapa aberta; etapa editada mantém ao menos um item.
- [x] Canceladas permanecem como histórico imutável e não podem ser editadas.
- [x] Qualquer falha deixa etapa, vínculos e previsões no estado anterior.
- [x] O orçamento real usado no diagnóstico não é alterado por desenvolvimento ou QA.
- [x] Exclusão com pagamento continua restrita ao dentista responsável e mostra as consequências.

## 8. Gates de aceite

- [x] Teste SQL no Supabase Free cobre adicionar/remover item, desconto derivado e recomposição.
- [x] Teste SQL prova rejeição abaixo do recebido, item duplicado, outra clínica e etapa cancelada.
- [x] Teste A/B com duas contas prova isolamento de clínica e ausência de mutação indevida.
- [x] QA de UI no código cobre edição com pagamento, erro e novo saldo; validação visual em produção fica pendente da entrega.
- [x] QA logado como dentista responsável prova exclusão com etapa e pagamento; outro dentista não exclui pela RLS existente.
- [x] Typecheck e lint dos arquivos alterados passam.
- [x] Atividade registra antes/depois da etapa sem copiar dados pessoais do paciente.

## 9. Fora de escopo

- Alterar, estornar ou criar recebimentos dentro do formulário de edição da etapa.
- Editar etapa cancelada ou recuperar orçamento já excluído.
- Mudar procedimentos clínicos ou preços dos itens do orçamento.
- Corrigir automaticamente registros reais existentes.
