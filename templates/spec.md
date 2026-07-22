# R-NN — {Título}

> **SPEC** · **R-NN** · 🔵 ativo
> **Aberto:** YYYY-MM-DD · **Fechado:** — · **Fase:** debate | plano | contrato | aprovada

<!-- Seções 1–3 nascem no debate/planejamento; 4–7 no contrato.
     Seção sem conteúdo fica com "—", não some: a ausência é informação. -->

## 1. Problema

Qual dor real, de quem, e por que agora. Sem solução aqui.

## 2. Decisão e alternativas descartadas

| Decisão | Alternativa descartada | Motivo |
|---|---|---|

## 3. Objetivo e como funciona

**Objetivo:** {resultado observável em uma linha}

{2–5 linhas de como funciona do ponto de vista de quem usa}

## 4. Contrato técnico

Só o que é específico desta feature — não redocumente o stack.
Conforme o caso: types TypeScript · schemas Zod · contratos de API (rota/body/response/erros)
· SQL + RLS · árvore de componentes com Server/Client.

## 5. Referência visual

> Só se a feature tem UI. Sem UI, escreva "—".

- **Artefato:** `plans/artefatos/R-NN-{slug}.html` — abrir no browser, nunca ler pro contexto
- **Rota alvo:** `/…` · **Componente alvo:** `src/…`
- **Tokens** (o que a implementação segue, em texto):

| Token | Valor |
|---|---|

## 6. Invariantes

Regras que a implementação nunca pode quebrar.

- [ ] {ex: usuário só acessa dados do próprio tenant}

## 7. Gates de aceite

Condições verificáveis que definem "pronto". Cada uma com um "como eu verifico" óbvio.

- [ ] {ex: POST /api/x com body válido devolve 201 + { id }}

## 8. Fora de escopo

O que esta spec deliberadamente não cobre.
