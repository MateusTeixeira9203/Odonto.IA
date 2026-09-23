# R-172 — Revisão de orçamento aceito

> **SPEC** · **R-172** · 🔵 ativo
> **Aberto:** 2026-09-23 · **Fechado:** — · **Fase:** aprovada pelo usuário nesta conversa.

## 1. Problema

O modal oferece a mesma edição para orçamento rascunho e orçamento já aceito. A edição atual
apaga e recria `orcamento_itens`; por isso o servidor a bloqueia quando há item aprovado. No
caso da Neila, o orçamento passou de R$ 3.200 para R$ 8.200 por novos procedimentos, R$ 4.200
já foram recebidos e o Dr. Armando precisa registrar R$ 8.300 sem perder o combinado anterior.

## 2. Decisão

Orçamento sem item aprovado e sem recebimento continua em **Editar orçamento**.

Orçamento com item aprovado ou recebimento entra em **Revisar orçamento**. A revisão é uma
alteração explícita, com valores antes/depois, recebido preservado e confirmação de que o
paciente aceitou o novo combinado. Ela não apaga nem recria o orçamento ou seus pagamentos.

## 3. Objetivo

Permitir ao dentista corrigir valores/quantidades/descritivos e incluir procedimento manual em
uma proposta já aceita, calculando o novo total e saldo. O histórico do aceite já existente
permanece intacto; a revisão fica registrada no histórico do orçamento.

## 4. Contrato técnico

### Dados e escrita

- Não criar tabela nesta entrega. O aceite anterior já é snapshot imutável em
  `assinaturas.termos_snapshot`; a revisão registra o diff completo em `activity_logs` com ação
  `orcamento.editado` e metadata tipada.
- Nova action `revisarOrcamento(input)` substitui o uso de `editarOrcamento` quando existir item
  aprovado ou pagamento. Recebe os itens propostos e `valorAcordado` final.
- O servidor relê orçamento, itens e pagamentos escopados por `clinica_id`; nunca confia nos
  totais enviados pelo cliente.
- A operação é atômica em RPC: trava o orçamento, confere autorização do responsável, calcula
  recebido, recusa `valorAcordado < recebido`, atualiza itens por ID, insere itens novos e
  recalcula `orcamentos.total`.
- Itens existentes preservam o próprio `id`, `procedimento_id`, `composicao` e `aprovado`.
  Não há DELETE nesta entrega. Item novo nasce `aprovado = true` somente porque a confirmação
  explícita declara que o paciente aceitou a revisão; sem essa confirmação nada é gravado.
- Quando houver `valor_acordado` ou previsão pendente, a mesma transação atualiza
  `valor_acordado` e substitui exclusivamente as previsões `pendente`; pagamentos `pago` e
  `cancelado` nunca mudam. As datas pendentes existentes são preservadas e o último valor absorve
  os centavos.
- O log inclui `totalAnterior`, `totalNovo`, `valorAcordadoAnterior`, `valorAcordadoNovo`,
  `valorRecebido`, `itensAntes`, `itensDepois` e `confirmadoComoAceito: true`.

### Tipos e resultado

```ts
type ItemRevisaoOrcamento = {
  id?: string;
  descricao: string;
  quantidade: number;
  precoUnitario: number;
};

type RevisarOrcamentoInput = {
  orcamentoId: string;
  itens: ItemRevisaoOrcamento[];
  valorAcordado: number;
  confirmarAceitePaciente: true;
};

type RevisarOrcamentoResult =
  | { ok: true; total: number; valorAcordado: number; valorRecebido: number }
  | { ok: false; error: string };
```

Zod exige UUID, 1–100 itens, descrição de 1–500 caracteres, quantidade 1–99, dinheiro finito
com duas casas e confirmação literal. Um item existente deve pertencer ao orçamento e à clínica.

## 5. Comportamento

1. Abrir orçamento sem aprovação/pagamento mostra **Editar orçamento** atual.
2. Abrir orçamento aceito ou com recebido mostra **Revisar orçamento**.
3. A revisão carrega os itens atuais, permite editar e adicionar; não oferece remover nesta
   entrega, pois reduzir um acordo já recebido exige política de crédito/estorno própria.
4. O resumo mostra total anterior, alteração, novo total, recebido e saldo novo. Para Neila:
   R$ 8.200 → R$ 8.300; recebido R$ 4.200; saldo R$ 4.100.
5. O CTA fica bloqueado até o usuário marcar “Paciente já aceitou esta revisão”. Sem isso,
   fechar/cancelar não grava nada.
6. Salvar atualiza a lista, o acordo e somente as previsões futuras; exibe sucesso e refaz as
   leituras de paciente, orçamento e financeiro.
7. Se o novo acordo for menor que o recebido, se outro usuário alterou o orçamento ou se não
   houver permissão, nada é escrito e a tela mostra um erro acionável.

## 6. Referência visual

No modal existente, manter tokens atuais. Em revisão, trocar o título do botão por
**Revisar orçamento** e inserir, acima de salvar, um resumo compacto:

- Total anterior · Alteração · Novo total;
- Recebido — não será alterado · Novo saldo;
- checkbox de confirmação explícita do aceite.

Não criar nova rota, wizard ou modal de pagamento. O fluxo de inclusão clínica do R-169b segue
existindo; esta revisão cobre o ajuste comercial que ele não cobre.

## 7. Invariantes

1. Recebimento pago/cancelado nunca é apagado, editado ou redistribuído.
2. O snapshot e o PDF de aceite anteriores permanecem imutáveis.
3. Nenhuma revisão reduz o valor acordado abaixo do recebido.
4. Nenhum item aprovado é apagado ou recebe novo ID.
5. Toda leitura/escrita é isolada por `clinica_id` e autorização do responsável.
6. Sem confirmação explícita de aceite não existe escrita.

## 8. Gates de aceite

- [ ] Orçamento rascunho continua usando edição atual.
- [ ] Orçamento com item aprovado entra em revisão e salva R$ 8.200 → R$ 8.300, preservando
      R$ 4.200 recebido e exibindo R$ 4.100 de saldo.
- [ ] Previsões pendentes são redistribuídas; pagamento pago/cancelado é idêntico antes/depois.
- [ ] Cancelar revisão não muda banco nem estado local.
- [ ] Tentativa abaixo do recebido, sem checkbox, item de outro orçamento, clínica/role sem
      permissão e conflito não deixam escrita parcial.
- [ ] Duas contas de clínicas distintas: a segunda não lê nem revisa o orçamento da primeira.
- [ ] Activity mostra antes/depois após reload; aceite/PDF anteriores continuam acessíveis.

## 9. Fora de escopo

Nova assinatura manuscrita/PDF da revisão, remoção de item aprovado, crédito/devolução automática,
desconto por etapa e reforma do editor de orçamento. Esses itens exigem um recorte próprio.
