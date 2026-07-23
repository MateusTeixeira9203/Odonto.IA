# Estado — Odonto.IA

> **ESTADO** · atualizado 2026-07-23 01:15 · sessão longa (visão do cockpit + R-01 completo)
> **Item ativo:** nenhum · **Modo da última sessão:** execução (fechamento)

## Agora

*(Sem item ativo. R-01 fechou nesta sessão — ver `plans/ROADMAP.md` → Concluído, spec e
artefato em `plans/_arquivo/`. Raciocínio completo, decisões e os 2 bugs achados/corrigidos:
`plans/handoffs/handoff-2026-07-23-0115.md`.)*

Pra retomar: escolher o próximo item da fila (ver abaixo) e rodar `/planejar` ou `/executar`
conforme o caso.

## Travado

Nada travado.

| O quê | Trava o quê | Hipótese / próximo passo |
|---|---|---|
| Preview local ainda trava às vezes (Suspense boundary que não resolve, servidor sempre 200) | Verificação visual ao vivo em sessões futuras | Recorrente — mesma classe já registrada em handoffs anteriores. Se voltar: restart + `.next` limpo + aba nova; às vezes recupera sozinho depois de um tempo, sem causa raiz identificada |

## Esperando você

- [ ] **Conferir num browser normal** se `Outfit`/`DM Mono` carregam certo — nesta sessão de dev
      apareceram `unloaded` (app inteiro caindo pro fallback do navegador). Suspeita forte é
      efeito dos vários `rm -rf .next` que rodei tentando destravar o preview, não código.
- [ ] **Resíduo de dado:** 1 agendamento de 14/07 na Clindent com `dentista_id` = Portaria em vez
      de dentista. Sobra de bug já corrigido. Consertar é escrita em produção: só com seu ok.
- [ ] **Perguntar pra Portaria:** o mapa de carga da agenda mostra o dia num número só — não
      distingue "4 espalhadas" de "4 grudadas de manhã". Se fizer falta, a barra vira por turno.
- [ ] **Chips do formulário de agendamento** — pedido antigo era tirar chips de horário, mas hora
      já é campo livre. Os únicos chips são de **duração**. São esses, ou outra tela?

## Próximo da fila

`R-14` (fuso do dashboard da secretária, bug em prod com usuário real, peso P) e `R-03`
(assinatura por procedimento — já depende do id estável que o R-01 acabou de entregar). Fila
completa e ordem em `plans/ROADMAP.md`.
