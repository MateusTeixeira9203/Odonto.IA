# HANDOFF

## 1. Identificação

- Tarefa: R-198 — Ficha colaborativa por profissional
- Área: Prontuário, Ficha e orçamento
- Responsável anterior: Arquiteto de Produto
- Estado: `READY_FOR_REVIEW`
- Commit/branch: checkout compartilhado; sem commit
- Data: 2026-10-12

## 2. Objetivo

Entregar ao Executor o contrato para B acrescentar procedimentos próprios à Ficha de A
quando houver encaminhamento ativo, com autoria por evento, agrupamento por responsável e
orçamentos separados por dentista.

## 3. Contexto mínimo

A UI atual já oferece “Adicionar procedimentos” a B quando há evento encaminhado ativo,
mas `adicionar_procedimentos_ficha` exige que o chamador seja o autor da Ficha. A decisão de
produto é uma Ficha agrupada e orçamento por dentista. R-197 permanece restrita à edição de
preço e quantidade.

## 4. Fonte de verdade utilizada

- Documento canônico: `00_FONTE_DA_VERDADE.md`
- Especificação: `plans/specs/R-198-ficha-colaborativa-por-profissional.md`
- Artefato de design: não existe; mudança visual maior exige artefato aprovado
- Outros: R-169b e R-173; comportamento atual de `ProntuarioTab.tsx` e da RPC R-169

## 5. Decisões tomadas

1. Uma Ficha compartilhada, com autoria imutável por evento.
2. Responsável segue `encaminhado_para → autor do evento → autor da Ficha`.
3. Orçamentos separados por responsável; orçamento misto fica fora do produto decidido.
4. Execução em dois lotes: autorização transacional e depois agrupamento/apresentação.

## 6. Fora de escopo

- Edição de preço/quantidade da R-197.
- Mudança de assinatura, pagamento, repasse ou permissão clínica geral.
- Publicação ou escrita em dados reais.

## 7. Arquivos alterados

- `plans/specs/R-198-ficha-colaborativa-por-profissional.md`
  - mudança: novo contrato de produto e critérios observáveis.
  - motivo: separar colaboração clínica da correção financeira R-197.
- `plans/handoffs/2026-10-12-r198-arquiteto-produto.md`
  - mudança: handoff ao Executor.
  - motivo: registrar limites, decisões e próxima ação.

## 8. Banco / schemas / APIs afetados

- RPC `public.adicionar_procedimentos_ficha`: autorização por encaminhamento ativo.
- Nenhuma tabela nova prevista no contrato.
- Formação/adição de orçamento deve preservar `orcamentos.dentista_id` por responsável.

## 9. Critérios de aceite

- [ ] B autorizado adiciona eventos próprios e a recarga preserva autoria e mesma Ficha.
- [ ] Conta sem encaminhamento, outra clínica e Ficha assinada têm efeito zero.
- [ ] A Ficha agrupa por responsável sem perder o autor original.
- [ ] A e B formam orçamentos distintos, sem item misto ou duplicado.
- [ ] Assinatura, retirada, edição clínica e R-169b/R-173 não regridem.

## 10. Testes executados

- [ ] unitários
- [ ] integração
- [ ] E2E
- [ ] manual
- [ ] regressão

Resultados: contrato produzido em leitura; implementação e testes não autorizados nesta etapa.

## 11. Problemas conhecidos

### Confirmados

- A UI oferece a ação a B, mas a RPC atual rejeita B por não ser autor da Ficha.

### Suspeitos / sem evidência

- Nenhum além dos gates ainda não executados.

## 12. Riscos de regressão

- Transformar encaminhamento em edição ampla dos eventos de A.
- Autorizar por estado lido fora da transação.
- Misturar itens de A e B no mesmo orçamento.
- Duplicar uma proposta por retry ou duplo clique; não confundir essa proteção com
  unicidade vitalícia de orçamento por Ficha e dentista.
- Alterar assinatura, pagamentos ou RLS além do recorte.

## 13. Próxima ação exata

Após revisão do contrato, o Executor deve inventariar os consumidores da RPC e entregar
primeiro o lote de autorização, com teste direto usando A, B, conta negativa e outra clínica.

## 14. Não fazer

- Não implementar R-197 neste item.
- Não mudar autoria, assinatura, pagamentos, repasses ou dados reais.
- Não iniciar redesign maior sem artefato aprovado.
- Não executar commit, push, deploy ou migration em produção sem autorização específica.

## 15. Estado da documentação

- [x] atualizada
- [ ] artefatos antigos marcados
- [x] handoff salvo
