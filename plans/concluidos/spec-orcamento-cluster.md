# Spec — Cluster de Orçamento (#13 valor, #14 status, #15 scroll)

**Status:** Aprovada (planejamento 2026-07-03). Decisões travadas via AskUserQuestion. **Execução** implementa isto — não re-escopar.
Roadmap: `plans/roadmap/roadmap-polimento.md` (itens 13/14/15). **Sem mudança de banco em nenhum dos três.**

---

## #13 — Input de valor corrompe ao editar (Opção B)

**Sintomas:** zero grudado ("0,00" não limpa); valor muda sozinho ao editar (ex. 250→289).
**Raiz:** input mostra formatado mas re-parseia a string — `value={formatCents(item.preco_unitario)}` + onChange `e.target.value.replace(/\D/g,'')`. Editar no meio de "250,00" embaralha os centavos. Modelo dígitos=centavos faz "250" virar R$2,50.
**Decisão (B):** input **decimal normal** — digita "250" = R$250 (ou "250,50"), **normaliza no blur**, guarda **número**. Mata os 3 problemas.

**Mudanças em `src/app/dashboard/orcamentos/_components/orcamentos-client.tsx`:**
- Input do preço no **editar** (~linhas 1220–1233) e no **novo orçamento** (~1869–1875): trocar `value=formatCents(...)` + `replace(/\D/g,'')` por um input decimal que aceita o valor real e parseia no `onBlur` (aceitar `.` e `,`; formatar como moeda ao sair).
- Retirar/substituir os helpers `centsToFloat`/`floatToCents`/`formatCents` (linhas 86–89) por um par `parseValorBR(str)→number` / `formatCurrency(number)` robusto.
- Estado dos itens passa a guardar **número** (ou string decimal parseável), não dígito-centavo: `editItens[].preco_unitario` (linha 175), `novoOrcItens[].preco` (linha 110).
- Ajustar quem consome: `handleOpenEdit` (566, tirar `floatToCents`), `handleSalvarEdicao` (585/595), `handleCriarOrcamento` (510/536), total (302).
- **Alinhar** com o input de pagamento (`pagForm.valor`, linha 429 — já usa parse simples) e **verificar** o input de item do `paciente-detail-client.tsx` (parece já usar `preco: number` — confirmar que não tem o mesmo bug).

**Invariante:** valor salvo == valor que o usuário vê. Zero round-trip com deriva.

---

## #14 — Status do orçamento: 'pago' órfão + falha silenciosa (Opção A)

**Sintomas:** não muda pra 'pago' nem 'recusado'; sensação de bugado sem feedback.
**Raiz:** constraint `orcamentos_status_check` só aceita `rascunho|enviado|aprovado|recusado` (**'pago' não existe no banco**), mas o type TS lista 'pago' (órfão); o pagamento seta `aprovado`, nunca 'pago'; e `handleStatusChange` (linha 416) **engole o erro** (sem toast).
**Decisão (A):** **duas dimensões separadas** — Status do orçamento = funil comercial (4 valores); "Pago" = dimensão financeira **derivada de `pagamentos`** (o selo "Quitado" já existe, linha 1087+).

**Mudanças:**
- `src/app/dashboard/orcamentos/actions.ts:17` — `StatusOrcamento` remove `'pago'` → `"rascunho"|"enviado"|"aprovado"|"recusado"`.
- Auditar e remover refs órfãs a orçamento-'pago' na UI (`STATUS_MAP` linha 71, filtros linha 780, switches). **NÃO** tocar em `pagamentos.status='pago'` (legítimo, fica).
- UI (`orcamentos-client.tsx`): rotular claramente **"Status do orçamento"** (seletor de 4, linha 1068 — já correto) vs **"Pagamento"** (Pendente/Parcial/**Quitado**, já derivado). Separação explícita.
- **Consertar falha silenciosa:** `handleStatusChange` (416) → `toast.error(result.error)` no erro.
- **Verificar 'recusado' ao vivo** (constraint permite — o caminho está correto; se falhar, investigar).

**Invariante:** pagamento nunca escreve orçamento.status='pago' (mantém 'aprovado'); "pago/quitado" sempre derivado de `pagamentos`.

---

## #15 — Scroll travado (apresentação + novo orçamento)

**Sintomas:** scroll engasgado no modal de novo orçamento e no painel de apresentação (IA); apresentação com "aspecto de largada".
**Raiz (apresentação — lead concreto):** em `src/components/pacientes/ApresentarPanel.tsx`, o container dos slides é `overflow-hidden` (linha 472); **um tipo de slide** tem `overflow-y-auto` (480), **outro** é `absolute inset-0 flex ... justify-center` **sem scroll** (513). Slide alto + `justify-center` sem overflow → não chega no topo/fim.

**Mudanças:**
- **Apresentação:** unificar o container de scroll dos slides — todo slide num wrapper `overflow-y-auto` com `min-h-full flex flex-col justify-center` (conteúdo curto centraliza, alto rola). Adicionar `overscroll-behavior: contain`.
- **Novo orçamento:** confirmar o container do modal (detalhe vs novo) e garantir **um** scroll container (header fixo + `flex-1 overflow-y-auto`), checar o body-scroll-lock brigando com o interno. **Empírico** — reproduzir no browser (DevTools) e ajustar.
- **Polish visual** da apresentação ("aspecto de largada") → **NÃO é este spec**, dobra no **F3** (design-review no Apresentar).

**Sem mudança de banco.**

---

## Verificação (execução)
- `tsc` + `eslint` limpos.
- **#13:** editar um valor digitando "250" → vira R$250 (sem zero grudado, sem deriva); reabrir e o valor é o mesmo.
- **#14:** mudar status pra **recusado** funciona; erro de status mostra **toast**; registrar pagamento mostra **Quitado** (e o status do orçamento NÃO vira 'pago').
- **#15:** rolar a apresentação (todos os slides) e o modal de novo orçamento sem travar.
