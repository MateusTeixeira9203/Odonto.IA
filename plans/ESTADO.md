# Estado — Odonto.IA

> **ESTADO** · atualizado 2026-07-23 · sessão de execução do R-01 (Fatia 0 + Fatia 1 + gates)
> **Item ativo:** R-01 · **Modo da sessão:** execução

## Agora

**R-01 — Ficha: o registro como unidade de salvamento. Todos os gates (G1–G11) fechados.**

- Schemas tolerantes (endo/implante), id estável + upsert (migration 107, aplicada em prod),
  campo do endo trocado (CT→Lima inicial), card do registro clicável, scroll+destaque ao
  tocar o dente (G11) — tudo verificado ao vivo ou por medição direta nesta sessão.
- **Bug achado e corrigido, mesma raiz do item:** a RPC antiga nunca gravava `detalhe` — toda
  tabela de endo/implante salva entre 21/07 e 23/07 tinha sido descartada em silêncio.
- **Bug de alinhamento achado por você** (print do card salvo): colunas numéricas da tabela
  de endo flutuavam à esquerda em vez de alinhar sob o cabeçalho — corrigido em `endo-card.tsx`
  e `endo-form.tsx` (mesma causa nos dois).
- G9 (comparação com o artefato) e G10 (contraste) rodados via medição direta (JS/computed
  style), não no olho — ver spec para os números.

**Dois achados fora do escopo do R-01, não mexidos:**
- Fontes `Outfit`/`DM Mono` aparecem `unloaded` nesta sessão de dev — página inteira cai pro
  fallback do navegador. Não é código meu; provável efeito dos vários restart+clear `.next`
  de hoje. **Conferir num browser normal antes de tratar como bug real.**
- `--color-text-muted` no escuro dá **1.82:1** contra `--color-surface` (falha AA feia) —
  usado no `ToothDetailPanel`, pré-existente, é exatamente o escopo do **R-12** (já na fila).

Commits feitos: migration (`5920f94`), código do R-01 (`1f01bba`), docs (`4837c40`), fix de
alinhamento (`0e236d8`). Nada pushado.

## Travado

Nada travado.

## Esperando você

- [ ] **Fechar o R-01?** Todos os gates passam. Fechar move a spec + artefato pro `_arquivo/`
      e marca ✅ no roadmap — confirma se é isso ou se quer segurar mais uma sessão.
- [ ] Itens antigos ainda abertos (não mexi neles nesta sessão): resíduo de dado de 14/07 na
      Clindent, pergunta pra Portaria sobre o mapa de carga da agenda, chips de duração no
      agendamento — detalhe no handoff de 22/07.

## Próximo da fila

Depois do R-01 fechar: `R-14` (fuso do dashboard da secretária, bug em prod, peso P) e `R-03`
(assinatura por procedimento — já depende do id estável que o R-01 acabou de entregar). Fila
completa em `plans/ROADMAP.md`.
