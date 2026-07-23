# Estado — Odonto.IA

> **ESTADO** · atualizado 2026-07-23 · sessão de execução do R-01 (Fatia 0 + Fatia 1)
> **Item ativo:** R-01 · **Modo da sessão:** execução

## Agora

**R-01 — Ficha: o registro como unidade de salvamento.** Fatia 0 e Fatia 1 code-complete:

- Schemas tolerantes (endo/implante) — `ToothDetailPanel` para de usar `safeParse` como gate.
- Campo trocado a pedido seu (22/07): tabela de endo perde **CT**, ganha **Lima inicial**
  (mantendo Lima final). `endo.ts`, `endo-form.tsx`, `endo-card.tsx`.
- Card do registro na criação agora abre a tabela com **1 clique** ("Detalhes"), sem precisar
  voltar no odontograma — pedido seu, 22/07. Duas entradas (painel do dente + card), mesmo
  estado — emendado na spec (P1).
- Id estável (`crypto.randomUUID()`) em todo lugar que cria draft; upsert por id via
  **migration 107** (`salvar_eventos_odontograma`), aplicada em prod por você.
- **Bug achado ao vivo, mesma raiz do item:** a RPC antiga (`regravar_odontograma_eventos`,
  migration 104) nunca gravava a coluna `detalhe` — toda tabela de endo/implante salva entre
  21/07 e 23/07 foi descartada em silêncio. A migration 107 já corrige (upsert inclui
  `detalhe`); confirmado que passou a persistir.

**Gates:** G1–G8 fechados. G1–G3 ao vivo no browser; G4–G6 direto contra a RPC (preview travou
no meio do caminho); **G7 fechado sem teste de 2 contas** — decisão do Mateus 23/07, a write
policy não mudou nesta migration (mesma da 104). G11 (rola até o card + destaca) **implementado**
mas não verificado ao vivo. **G9–G10 (comparação visual com artefato, contraste) bloqueados** —
preview local preso num Suspense boundary que nunca resolve (servidor sempre 200, é client-side).

Nada commitado ainda — é o próximo passo.

## Travado

| O quê | Trava o quê | Hipótese / próximo passo |
|---|---|---|
| Preview local preso em Suspense que nunca resolve | G9, G10 e reverificar G11 ao vivo | Restart + limpar `.next` + aba nova + esperar não resolveu desta vez. Servidor sem erro nos logs — client-side, mesmo bug de sessões anteriores |

## Esperando você

- [ ] **G9/G10 quando o preview normalizar** — comparação visual do endo com o artefato
      (claro/escuro) e varredura de contraste. Sem isso o item não fecha 100%, mas não bloqueia
      commitar o que já está pronto e verificado.
- [ ] Itens antigos ainda abertos (não mexi neles nesta sessão): resíduo de dado de 14/07 na
      Clindent, pergunta pra Portaria sobre o mapa de carga da agenda, chips de duração no
      agendamento — detalhe no handoff de 22/07.

## Próximo da fila

Depois do R-01 fechar: `R-14` (fuso do dashboard da secretária, bug em prod, peso P) e `R-03`
(assinatura por procedimento — já depende do id estável que o R-01 acabou de entregar). Fila
completa em `plans/ROADMAP.md`.
