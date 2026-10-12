# HANDOFF — R-194, corrida entre ramos

## 1. Identificação

- Tarefa: resolver somente o impasse de contrato R194-01C/04.
- Área: pagamento rápido / idempotência financeira.
- Responsável anterior: Coordenação; destino: Arquiteto de Produto.
- Estado: `BLOCKED`; base `codex/baseline-producao-v2@ba5b531`, checkout compartilhado.
- Data: 2026-10-11.

## 2. Objetivo

Definir a menor regra transacional que faça a mesma `operacaoId` retornar o primeiro
pagamento confirmado, quer o vencedor tenha sido a parcela R-194, quer o recebimento
manual R-189. Resolver a corrida estática descrita no topo da spec R-194 antes de
qualquer aplicação de migration.

## 3–4. Contexto e fonte

Contrato único: [`R-194`](../specs/R-194-confirmacao-parcela-idempotente.md), em
dependência da [`R-189`](../specs/R-189-recebimento-idempotente.md). Candidato local
`supabase/migrations/20261011231702_r194_confirmacao_parcela_idempotente.sql` e
`src/app/dashboard/orcamentos/actions.ts`. A branch QA sem dados falhou no replay
de `001_core_tables.sql`; não existe banco isolado apto. Produção não recebeu R-189/R-194.

## 5–8. Decisões, limites e superfícies

Preservar autorização R-188, esquema de chave único de R-189 e os fluxos
`marcarPagamentoPago` explícito, estorno e cobrança por etapa. Não redesenhar UI,
reabrir R-184, escrever banco, aplicar migration, fazer commit, push ou deploy.
O Arquiteto edita somente a spec R-194; não editar Action ou SQL neste despacho.

## 9–12. Aceite, testes e riscos

- R194-01C: replay cruzado em ambos os sentidos retorna o mesmo pagamento, sem efeito novo.
- R194-04: duas chamadas concorrentes da mesma chave têm um único vencedor.
- Payload/ator/orçamento incompatível retorna conflito sem expor dados.

Revisão estática do candidato atual: **NÃO PASSA**. Banco, falha de transporte e
concorrência: **NÃO TESTADO**. Separar hipótese, prova e limite; não marcar aprovado
por raciocínio estático. Risco principal: comparação de valor feita por R-189 antes
de resolver a chave que a parcela R-194 já usou.

## 13–15. Próxima ação e documentação

Entregar alteração restrita da spec com decisão, invariantes e critério verificável;
explicitar arquivos mínimos para o Executor e dependência do banco isolado.
Não mexer no índice central `ESTADO.md` ou `ROADMAP.md`. A Coordenação integra.
