# HANDOFF — R-197

## 1. Identificação

- Tarefa: editar preço e quantidade de itens do orçamento ligado à Ficha.
- Área: orçamento e vínculo clínico.
- Responsável anterior: Executor.
- Estado: `READY_FOR_REVIEW`.
- Commit/branch: `codex/baseline-producao-v2`, migration R182-EST-01 em `5e2c4e4`.
- Data: 2026-10-12.

## 2. Objetivo

Salvar preço e quantidade de itens existentes sem apagar seus IDs, vínculos,
aprovações ou histórico. Corrigir o bloqueio observado pela auditoria no Preview.

## 3. Contexto mínimo

`editarOrcamento` apaga/reinsere itens. A FK de `orcamento_eventos.item_id`
impede editar orçamento ligado à Ficha. O usuário rejeitou bloquear a edição.

## 4. Fonte de verdade utilizada

- Documento canônico e critérios: [R-197](../specs/R-197-edicao-valores-orcamento-vinculado.md).
- R-172 rege orçamentos aceitos/com financeiro; R-169b rege adição/retirada.

## 5. Decisões tomadas

1. Edição transacional por IDs e versão; orçamento vinculado ainda sem histórico financeiro.
2. Adicionar procedimentos à mesma Ficha por dentista B é item separado.
3. Orçamento por dentista, decidido pelo usuário para o fluxo de colaboração.
4. Histórico comercial/financeiro segue R-172 na tela e é rejeitado novamente pela RPC.

## 6. Fora de escopo

- Editar orçamento aceito, pagamentos, parcelas ou dados reais.
- Ampliar permissão de escrita clínica do dentista B nesta tarefa.

## 7. Arquivos alterados

- `supabase/migrations/20261012150833_r197_editar_valores_orcamento_vinculado.sql`
  - nova RPC transacional, permissões e trilha de auditoria.
- `src/app/dashboard/orcamentos/actions.ts`
  - Action validada e mapeamento de erros seguros da RPC.
- `src/app/dashboard/orcamentos/_components/orcamentos-client.tsx`
  - consumidor legado envia IDs/versão e atualiza apenas os mesmos itens com a resposta confirmada antes da recarga.
- `src/app/dashboard/pacientes/[id]/_components/paciente-detail-client.tsx`
  - consumidor do perfil encaminha histórico ao R-172 e usa a edição restrita com estado confirmado quando elegível.
- `src/app/dashboard/pacientes/[id]/_components/types.ts`
- `src/server/patients/get-patient-workspace-data.ts`
- `src/app/dashboard/pacientes/[id]/_components/use-orcamento-modal.ts`
  - expõem e preservam `ficha_id` para escolher o caminho correto.
- `src/app/dashboard/orcamentos/page.tsx`
  - mantém o contrato do cliente legado compatível com versão e origem.
- `scripts/test-r197-editar-valores-orcamento-vinculado.mjs`
  - gate isolado PGlite para a RPC.

## 8. Banco / schemas / APIs afetados

- Nova RPC `public.editar_valores_orcamento_vinculado(uuid, jsonb, timestamptz)`
  forward-only, `SECURITY DEFINER`, `search_path` fixo e grant exclusivo a `authenticated`.
- O estado pós-aplicação da RPC está registrado no gate da spec R-197; esta correção UI não alterou schema.

## 9. Critérios de aceite

- [x] PASSA — itens, IDs, vínculos, total e log em PGlite.
- [x] PASSA — conflito/payload inválido sem alteração parcial em PGlite.
- [x] PASSA — três identidades sem permissão não escrevem em PGlite.
- [x] PASSA — cinco formas de histórico comercial são recusadas sem alteração em PGlite.
- [x] PASSA — payload SQL nulo, item retirado e composição de grupo R-169b são recusados sem alteração em PGlite.
- [ ] NÃO TESTADO — interação visual pós-sucesso nos dois consumidores. O código aplica total/versão retornados aos IDs existentes antes da recarga; validar no Preview após aplicar a migration.
- [ ] NÃO TESTADO — Preview aplicado, recarga visual e duas contas autenticadas reais.

## 10. Testes executados

- [x] unitários/contrato transacional
- [x] integração isolada PGlite
- [ ] E2E
- [ ] manual
- [x] regressão de tipos/lint focal

Resultados:

- `ODONTO_PGLITE=... node scripts/test-r197-editar-valores-orcamento-vinculado.mjs`: 5 grupos PASS.
- `pnpm typecheck`: PASS.
- ESLint focal: 0 erros; 31 avisos preexistentes nos clientes grandes.

## 11. Problemas conhecidos

### Confirmados

- DELETE dos itens vinculados falha por FK no Preview.

### Suspeitos / sem evidência

- Renderização do modal e recuperação após uma rejeição excepcional da Action: nenhuma Promise rejeitada
  foi induzida em componente ou browser nesta rodada.

## 12. Riscos de regressão

- Os testes unitários e estáticos não substituem o gate UI em browser, a recarga visual nem uma rejeição
  de transporte induzida.

## 13. Próxima ação exata

O Auditor deve repetir somente o gate UI: abrir o perfil com fixture sintética para cada sinal de
histórico, confirmar a revisão R-172, e induzir uma rejeição da Action nas duas entradas para conferir
que o formulário é liberado com o rascunho preservado.

## 14. Não fazer

Não alterar dados reais, aplicar migration, commitar, dar push ou deploy no
despacho. Não reverter mudanças de outros chats no checkout compartilhado.

## 15. Estado da documentação

- [x] contrato do item atualizado com evidências
- [x] handoff salvo

## 16. Correção local R197-UI posterior ao gate

- `src/lib/orcamentos/exige-revisao-comercial.ts` e seu teste concentram os sete sinais que tornam a
  edição uma revisão R-172: item/status aprovado, valor acordado, plano, cobrança, pagamento e aceite.
- O modal e o handler do perfil usam a mesma regra, removendo o bloqueio do `R197-UI-01` para estados
  legados que antes não mostravam a confirmação.
- As duas chamadas a `editarValoresOrcamentoVinculado` usam `try/catch/finally`; em rejeição excepcional,
  liberam o botão e mantêm o rascunho com mensagem de recuperação.
- Verificado localmente: `pnpm exec tsx --test src/lib/orcamentos/exige-revisao-comercial.test.ts`
  (8/8), `pnpm typecheck` e ESLint focal (0 erros, 31 avisos preexistentes).
- Ainda não testado: componente/browser com cada sinal e Promise rejeitada injetada, recarga visual e
  persistência após a jornada. Não houve migration, escrita externa, commit, push ou deploy nesta correção.
