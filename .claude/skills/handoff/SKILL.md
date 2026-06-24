---
name: handoff
description: >
  Gera o handoff de fim de sessão e salva em plans/. Registra o que foi
  trabalhado, o que foi concluído, os erros encontrados E como eu estava pensando
  em resolvê-los, o que ficou pra próxima sessão, e o que eu estava planejando ou
  cogitando. Use SEMPRE ao final de uma sessão de desenvolvimento, ou quando o
  usuário disser "handoff", "fecha a sessão", "registra onde paramos", "salva o
  progresso", "vou dormir", "terminamos por hoje", "encerra", "fechar o dia",
  "boa noite vou dormir".
---

# Handoff de sessão

Fecha a sessão com um documento de continuidade. A regra do setup é: **toda sessão
termina com um handoff salvo em `plans/`.** A pasta `plans/` é a memória viva do
projeto — ela acumula um arquivo por sessão e nunca é apagada.

## 1. Coletar contexto

```bash
git diff --name-only HEAD
git diff --name-only --cached
git log --oneline --since="8 hours ago"
git status --short
```

Se não for repo git, liste os arquivos tocados na sessão a partir do que você editou.

## 2. Salvar em plans/

Crie `plans/` na raiz do projeto se não existir. Salve em:

```
plans/handoff-YYYY-MM-DD-HHmm.md
```

> Documentos de **plano de feature** (quando a gente planeja algo antes de codar)
> também vão pra `plans/`, como `plans/plan-<feature>-YYYY-MM-DD.md`. Handoff e
> plano vivem juntos — é o histórico de raciocínio do projeto.

## 3. Formato do handoff

```markdown
# Handoff — [Data e hora]

## O que trabalhamos
[2–5 bullets, do mais importante ao menos]

## O que concluímos
[O que está PRONTO e funcional — separe do que ficou pela metade]
**Status geral:** Completo | Parcial | Bloqueado

## Erros encontrados e como pensei em resolver
> A parte mais importante pra não repetir trabalho na próxima sessão.

| Erro / problema | Causa (ou hipótese) | Como eu estava pensando em resolver | Resolvido? |
|---|---|---|---|
| [sintoma] | [causa raiz ou suspeita] | [a abordagem que eu ia/fui seguir e o porquê] | sim / não / parcial |

## Arquivos alterados
| Arquivo | Mudança |
|---|---|

## O que ficou pra próxima sessão
Ordenado por prioridade:
1. **[CRÍTICO]** …
2. **[ALTO]** …
3. **[MÉDIO]** …

## O que eu estava planejando / cogitando
> Ideias e direções que estavam na minha cabeça mas não viraram decisão ainda.
> A próxima sessão começa daqui, não do zero.

- [Direção que eu estava considerando para X, e o trade-off que ainda não resolvi]
- [Abordagem alternativa para o erro Y que talvez seja melhor]
- [Decisão de produto/design em aberto que precisa de debate]

## Como retomar
```bash
[comando ou sequência exata pra voltar ao ponto]
```

## Dívidas técnicas registradas
- [ ] [dívida] — [arquivo:linha] — [quando resolver / por que é tolerável agora]
```

## 4. Resumo no chat

Depois de salvar, mostre só:
- O que concluímos (até 3 bullets)
- O próximo passo mais crítico
- Qualquer coisa bloqueada que precisa de atenção
- O caminho do arquivo salvo (`plans/handoff-…md`)

## Regras

- **Honestidade acima de tudo.** Se algo não foi testado, diga. Se um erro ficou
  sem solução, registre a hipótese, não invente que resolveu.
- O campo "como eu estava pensando em resolver" e "o que estava cogitando" não são
  opcionais — são o motivo do handoff existir. Capture o raciocínio, não só o resultado.
- Nunca apague handoffs antigos. `plans/` é append-only.
