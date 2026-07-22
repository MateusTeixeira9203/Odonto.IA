# Estado — Odonto.IA

> **ESTADO** · atualizado 2026-07-22 · **Item ativo:** nenhum · **Modo:** execução (fechando)

## Agora

Nenhum item ativo. **R-13 fechou hoje** — janela de busca corrigida, cor por dentista, coluna no
Dia, mapa de carga + grade cheia na Semana, clique no vazio abrindo o drawer pré-preenchido.
Todos os 11 gates (G1–G11 + G3b) confirmados ao vivo pelo Mateus em 22/07 — parte com clique meu
na sessão (G4, G8, filtro sobrevivendo à navegação), parte testado por ele diretamente (G5–G7,
G9–G11, G3b), auditoria feita por ele mesmo. Spec e artefato arquivados em `plans/_arquivo/`.

Achado e corrigido no meio do caminho: bug de alinhamento no mapa de carga (grid+gap vs. flex do
cabeçalho nunca alinham por compensação manual — reescrito pra flex, mesma classe `w-36` nos 3
lugares que precisam bater; medido 0px de diferença ao vivo) e um respiro de padding no nome do
dentista. Detalhe completo no commit e na spec arquivada.

**Falta**

- [ ] Nada do R-13. Escolher o próximo item da fila.

## Travado

Nada travado. Alerta pra próxima sessão: **o preview local às vezes trava** (visto hoje em
`v=dia`/`v=mes`, inclusive em rota nunca tocada — não é bug de código, é o streaming do
React/Next engasgando na infra do preview). Uma vez travada, a aba fica travada; aba nova ajuda
às vezes. Também: `preview_stop` não mata o processo Node de verdade no Windows — matei 4 órfãos
manualmente nesta sessão.

## Esperando você

- [ ] **Aprovar a spec do R-01** — pronta desde 21/07, cedeu a vez pro R-13 sem perder nada.
- [ ] **Resíduo:** 1 agendamento de 14/07 na Clindent com `dentista_id` = Portaria em vez de
      dentista. Sobra de bug já corrigido. Consertar é escrita em produção: só com seu ok.
- [ ] **Perguntar pra Portaria:** o mapa de carga mostra o dia num número só — não distingue
      "4 espalhadas" de "4 grudadas de manhã". Se fizer falta, a barra vira por turno.
- [ ] **Chips do formulário** — o pedido era tirar chips de horário, mas hora já é campo livre.
      Os únicos chips são de **duração**. São esses, ou outra tela?

## No ar sem verificação 🟡

Nada pendente.

## Próximo da fila

`R-01` (ficha, spec pronta) e `R-14` (fuso do dashboard da secretária, peso P). Fila completa em
`plans/ROADMAP.md`.
