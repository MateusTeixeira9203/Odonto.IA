# Estado — Odonto.IA

> **ESTADO** · atualizado 2026-07-22 22:00 · sessão longa (R-13 planejamento → execução → fechamento)
> **Item ativo:** nenhum · **Modo da última sessão:** execução (fechamento)

## Agora

*(Sem item ativo. R-13 fechou nesta sessão — ver `plans/ROADMAP.md` → Concluído, spec e artefato
em `plans/_arquivo/`. Detalhe do que foi feito e como foi verificado:
`plans/handoffs/handoff-2026-07-22-1700.md`.)*

Pra retomar: escolher o próximo item da fila (ver abaixo) e rodar `/planejar` ou `/executar`
conforme o caso — R-01 já tem spec pronta, só falta aprovação.

## Travado

Nada travado.

| O quê | Trava o quê | Hipótese / próximo passo |
|---|---|---|
| Preview local às vezes trava (`v=dia`/`v=mes` presos no esqueleto do layout pai) | Verificação visual ao vivo em sessões futuras | Causa real não identificada — confirmado que não é bug de código (rota intocada travava igual). Se voltar: reiniciar processo + limpar `.next` + aba nova. Detalhe completo no handoff |

## Esperando você

- [ ] **Aprovar a spec do R-01** — pronta desde 21/07, cedeu a vez pro R-13 sem perder nada.
- [ ] **Resíduo de dado:** 1 agendamento de 14/07 na Clindent com `dentista_id` = Portaria em vez
      de dentista. Sobra de bug já corrigido. Consertar é escrita em produção: só com seu ok.
- [ ] **Perguntar pra Portaria:** o mapa de carga da agenda mostra o dia num número só — não
      distingue "4 espalhadas" de "4 grudadas de manhã". Se fizer falta, a barra vira por turno.
- [ ] **Chips do formulário de agendamento** — pedido antigo era tirar chips de horário, mas hora
      já é campo livre. Os únicos chips são de **duração**. São esses, ou outra tela?

## Próximo da fila

`R-01` (ficha: registro como unidade de salvamento — spec pronta) e `R-14` (fuso do dashboard da
secretária, peso P). Fila completa e ordem em `plans/ROADMAP.md`.
