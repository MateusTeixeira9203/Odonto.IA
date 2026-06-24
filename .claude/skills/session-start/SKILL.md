---
name: session-start
description: >
  Abre uma nova sessão de trabalho retomando de onde paramos. Lê o handoff mais
  recente em plans/ e faz um recap acionável (o que ficou, erros em aberto, o que
  eu estava cogitando) antes de começar. Use quando o usuário cumprimentar pra
  começar o dia: "bom dia", "boa tarde", "boa noite", "tudo bem Claude", "oi Claude",
  "começar sessão", "nova sessão", "vamos continuar", "onde paramos".
---

# Abertura de sessão

O usuário cumprimentou pra começar a trabalhar. Não comece do zero — **retome de
onde a última sessão parou.**

## 1. Achar o último handoff

```bash
ls -t plans/handoff-*.md 2>/dev/null | head -1
```

- Se existir, leia o arquivo mais recente.
- Se a pasta `plans/` estiver vazia ou não existir, é a primeira sessão: cumprimente
  de volta, diga que não há handoff anterior, e pergunte no que vamos trabalhar.

## 2. Recap acionável (não despeje o arquivo inteiro)

Cumprimente de volta em uma linha e entregue:

- **Onde paramos:** o que foi concluído na última sessão (1–2 bullets).
- **Próximo passo crítico:** o item de maior prioridade que ficou pendente.
- **Erros em aberto:** se houver, qual era e **como eu estava pensando em resolver**.
- **O que estava cogitando:** as direções/decisões em aberto que a última sessão deixou.

Feche perguntando: **"Continuamos por aqui ou mudou alguma coisa?"** — não saia
implementando antes de confirmar o rumo (regra 2 do setup: discutir antes de codar).

## 3. Desambiguação

"Boa noite" pode ser saudação (chegando à noite) **ou** despedida (indo dormir).
Se o usuário disser "boa noite, vou dormir" ou claramente estiver encerrando, NÃO
abra sessão — acione a skill `handoff` em vez desta.

## Regra

Esta skill só lê e resume. Não altera código nem a pasta `plans/`. O objetivo é
fazer a próxima sessão começar com contexto, não da estaca zero.
