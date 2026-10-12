# HANDOFF — R-199

## 1. Identificação

- Tarefa: diálogo financeiro alcançável em 390 px.
- Área: UI de detalhe de orçamento.
- Responsável anterior: Coordenação; executor: R-199; estado: `READY_FOR_REVIEW` local.
- Branch: `codex/baseline-producao-v2`; data: 2026-10-12.

## 2. Objetivo

Corrigir o recorte lateral medido no Preview, preservando layout desktop e
todas as ações/valores financeiros.

## 3. Contexto mínimo

Auditoria R-182, R182-EST-06: diálogo mede 1.197–1.247 px em viewport 390×844,
sem rolagem até regiões cortadas. Dados sintéticos apenas.

## 4. Fonte de verdade utilizada

- Contrato e aceite: [R-199](../specs/R-199-dialogo-financeiro-mobile.md).
- Evidência: [auditoria R-182](../auditorias/2026-10-12-R-182-estabilizacao-dirigida.md).

## 5. Decisões tomadas

1. Correção responsiva focal, sem alterar regra financeira.
2. Visual light/dark e teclado são gates separados de typecheck.

## 6. Fora de escopo

- R-197, R-200, schema/RPC, dados reais, redesign geral.

## 7. Arquivos alterados

- `src/app/dashboard/pacientes/[id]/_components/modals/detalhe-orcamento-modal.tsx`
  - largura/altura móveis explícitas e limites por `dvh`;
  - regras desktop mantidas em `sm`;
  - `min-w-0` no corpo e na coluna financeira.
- `plans/specs/R-199-dialogo-financeiro-mobile.md`
- `plans/handoffs/2026-10-12-r199-dialogo-financeiro-mobile.md`

Não tocar nos arquivos do R-197 em edição.

## 8. Banco / schemas / APIs afetados

- Nenhum.

## 9. Critérios de aceite

- Ver tabela única da spec R-199; registrar PASSA/NÃO PASSA/NÃO TESTADO.

## 10. Testes executados

- [x] typecheck — `pnpm typecheck` sem erro.
- [x] lint focal — ESLint do modal sem erro.
- [x] integridade — `git diff --check` sem saída.
- [ ] manual/E2E 390×844, light/dark, teclado, desktop.
- [ ] resposta, persistência e recarga de ação financeira sintética.

Resultado por aceite: limites e encolhimento no código **PASSA (estático)**;
gates renderizados e de persistência **NÃO TESTADOS**. O checkout local iniciou,
mas não tem sessão sintética. A leitura do Preview auditado foi bloqueada pela
política do navegador; não houve contorno nem escrita financeira.

## 11. Problemas conhecidos

### Confirmados

- Diálogo recortado em 390 px, light/dark.

### Verificação impedida

- A causa exata da medida de 1.197–1.247 px não foi observada novamente no
  Preview, pois a navegação de leitura foi bloqueada pela política do navegador.
- A comparação visual light/dark, teclado e desktop aguarda ambiente autenticado
  com dados sintéticos.

## 12. Riscos de regressão

- Conteúdo escondido por `overflow-hidden`, foco fora da tela e mudança desktop.

## 13. Próxima ação exata

Em ambiente autenticado com o orçamento sintético, abrir o detalhe em 390×844
light/dark, medir `data-slot="dialog-content"`, percorrer controles por toque e
teclado, comparar desktop e exercer uma única ação já permitida com resposta,
persistência e recarga separadas.

## 14. Não fazer

Não alterar finanças, migration, dados, commit, push ou deploy. Não reverter edits
alheios no checkout compartilhado.

## 15. Estado da documentação

- [x] contrato e handoff atualizados com implementação e limites de verificação.
