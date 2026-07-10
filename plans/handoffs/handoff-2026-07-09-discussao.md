# Handoff de discussão — 2026-07-09

> **Modo da próxima sessão: DISCUSSÃO.** Este handoff é **raciocínio, não checklist** — abre os debates que a auditoria levantou, com os pontos de vista de cada lado. Nada de arquivos-a-tocar: nenhuma decisão de implementação foi tomada ainda. A discussão escolhe o rumo; o planejamento formaliza; a execução coda.
> **Insumo central:** [`plans/auditorias/auditoria-2026-07-09.md`](../auditorias/auditoria-2026-07-09.md) — diagnóstico read-only completo (segurança, deps, arquitetura, maturidade SaaS).
> **Contexto imediato:** a leva do loop clínico (spec-leva-semana-loop-clinico) foi **executada, commitada e pushada** nesta sessão.

---

## De onde viemos (recap factual, não é o assunto)

Duas coisas aconteceram nesta sessão:

1. **Execução da leva da semana** (#2, #5, #6, #7, #10, #11) — o loop clínico "menos cliques". Feita, tsc/eslint limpos, 2 commits (`ff7e63b` plans, `c4b5b11` código) **pushados** pra `origin/feat/fase1-onboarding-persona-loop`. Corrigi 1 bug real na revisão (off-by-one de data de retorno em BRT). **Ainda não foi dogfoodada no browser** — as telas exigem login Supabase, então o teste do fluxo (walk-in → consulta → ficha → assinar → orçamento → retorno) + `design-review` + `qa-web` seguem pendentes pro Mateus logado.
2. **Auditoria completa do SaaS** — a pedido, read-only. Salva em `plans/auditorias/`. É o insumo desta discussão.

O recap acima é só pra situar. **O assunto da próxima sessão são os debates abaixo.**

---

## Os debates que a auditoria abriu

### Debate 1 — WhatsApp: o pilar que está desligado (o mais importante)

**O achado:** `meta.ts` tem `sendText`/`sendFile`/`downloadMedia` como **stubs** — dão `console.log` e retornam sucesso falso. Todo o WhatsApp outbound é no-op silencioso. O `run-reminders` "envia" lembretes que nunca chegam, e o sistema *acha* que enviou.

**A tensão real:** o CLAUDE.md lista WhatsApp como **pilar de prioridade** (confirmação, lembrete, follow-up, recuperação, envio de orçamento). Mas ele não está ligado. Há um descompasso entre o que o produto *parece* fazer e o que *faz*.

**Pontos de vista:**
- **(A) Plugar Meta antes do teste.** Se a proposta de valor que a clínica vai testar inclui "o sistema fala com o paciente", WhatsApp mudo mina a impressão. Pró: entrega o pilar. Contra: integração Meta (WABA aprovado, credenciais, upload de mídia em 2 etapas) é trabalho não-trivial na véspera — exatamente o que a régua "mexer pouco, não desestabilizar" desaconselha.
- **(B) Comunicar honestamente que está off.** O teste desta leva foi sobre o **loop clínico** (consulta→ficha→orçamento→retorno), não sobre WhatsApp. Pró: zero risco de churn, honesto. Contra: perde-se um diferencial na demonstração; e há o risco de alguém confiar num lembrete que não sai.
- **(C) Adiar o canal como decisão de produto.** Talvez WhatsApp não seja pré-lançamento — talvez o MVP se sustente no loop clínico + orçamento premium, e WhatsApp seja fase 2. Isso é decisão de posicionamento, não de engenharia.

**O que fica pra decidir:** WhatsApp é *launch-critical* ou *fase 2*? A resposta muda tudo — se crítico, é o maior item de trabalho do próximo ciclo; se fase 2, o stub vira dívida documentada e o foco vai pra outro lugar. **Vale trazer o `business-strategist` ou `thinking-partner` pra pressionar o posicionamento antes de gastar semanas na Graph API.**

### Debate 2 — Risco de segurança pré-teste: o fail-open do webhook

**O achado:** `meta.ts:validateSignature` retorna `true` quando `WHATSAPP_APP_SECRET` está ausente. Se a secret não estiver em prod, o webhook aceita payload não assinado — e ele processa comprovante PIX (marca pagamento) e cria paciente.

**A tensão:** é um risco condicional (só se a secret faltar). E está atrelado ao Debate 1 — se WhatsApp está off e o número não está registrado, a superfície de ataque é teórica (a URL existe, mas ninguém a alcança pelo fluxo Meta).

**Pontos de vista:**
- **(A) Corrigir agora (fail-closed).** É uma mudança de 2 linhas, e "fail-open em validação de assinatura" é um cheiro que não se deixa passar, independente de exposição atual. O padrão certo já existe no `webhooks/abacatepay`.
- **(B) Só garantir a secret em prod e adiar o fail-closed.** Se a régua é não tocar código na véspera, e a secret resolve o risco prático, talvez o fail-closed entre no mesmo lote de endurecimento pós-teste.

**O que fica pra decidir:** isso é P0-corrigir-já ou "verificar config + agendar o fix"? Minha inclinação (pra pressionar, não pra fechar): fail-open em assinatura merece o fix imediato — é barato e o custo de errar é marcar pagamento falso. Mas quero ouvir se a régua "mexer pouco" pesa mais aqui.

### Debate 3 — A dívida de testes vs. a régua "não desestabilizar"

**O achado:** rede de segurança contra regressão é ~1 arquivo SQL de silo. Zero teste de unidade/integração no `src/`. Nenhuma malha pega uma regressão introduzida na véspera.

**A tensão:** essa é a maior lacuna de *fundação*, mas começar a escrever testes agora é churn na pior hora. E há ironia: sem testes, o próprio ato de "endurecer" (Debates 2, 4, 5) é arriscado.

**Pontos de vista:**
- **(A) Pós-teste, primeiro nas actions de dinheiro.** `criarOrcamento`, `registrarPagamento`, o webhook de billing — onde um bug custa R$. Depois e2e do loop clínico.
- **(B) Investir só quando doer.** Talvez o produto ainda mude tanto que testes agora sejam manutenção morta. Escrever teste sobre código que vai ser reescrito é desperdício.

**O que fica pra decidir:** quando a malha de testes deixa de ser "cedo demais" e passa a ser "tarde demais"? E o primeiro alvo é dinheiro ou o loop clínico?

### Debate 4 — Deps: bump do `next` agora ou depois

**O achado:** 1 crítica (`protobufjs` via `@google/genai`) + 7 high, incluindo `next` 16.1.6 com advisories reais (cache poisoning, CSRF em Server Actions com origin null) e `@xmldom/xmldom` (XML injection — relevante porque vocês parseiam `.docx` de upload).

**A tensão:** `npm audit fix` é seguro; bump de `next` numa linha major é churn que pode quebrar sutilmente na véspera.

**Pontos de vista:**
- **(A) `audit fix` agora, bump do `next` pós-teste.** O ganho de segurança do audit fix é barato; o bump do framework espera a janela sem teste iminente.
- **(B) Bump tudo já.** Os advisories do `next` (CSRF em Server Actions) tocam um SaaS autenticado — não é teórico.

**O que fica pra decidir:** appetite de risco pra churn de framework antes do teste. `@xmldom/xmldom` merece atenção à parte pelo vetor de upload.

### Debate 5 — A leitura macro: fundação forte, operação fraca

**O achado transversal:** o produto é mais maduro em *fundação* (multi-tenancy silo, billing, auth) do que em *operação* (observabilidade zero — sem Sentry, sem error boundary; testes ~zero; canais — WhatsApp — stub). É o inverso do protótipo típico: base séria esperando os canais e a malha.

**A pergunta estratégica que sobe disso:** qual o próximo grande investimento?
- **Terminar canais** (WhatsApp) — completa a promessa do produto.
- **Endurecer** (observabilidade + testes + segurança) — deixa produção confiável.
- **Mais features clínicas** — aprofunda o diferencial (o loop clínico já está ficando bom).

Os três competem pelo mesmo tempo. A régua "isso reduz atrito do dentista?" (filosofia do CLAUDE.md) e o resultado do teste real da semana deveriam informar a resposta — mas é decisão de produto, não de engenharia. **É o debate-mãe; os outros quatro são instâncias dele.**

---

## O que NÃO precisa debate (a auditoria já fechou)

Pra não gastar a discussão à toa — estes pontos a auditoria confirmou como sólidos ou seguros, não são assunto:
- Isolamento entre clínicas (RLS-silo + app-layer, defense-in-depth). Fechado.
- `billing_events` sem policy = deny-all intencional, seguro.
- `service_role` confinado; `.env` não versionado; zero `any`; `SUPER_USERS` vazio; `esc()` em todo HTML.
- A leva do loop clínico desta sessão — revisada, limpa, pushada. Só falta o dogfood do Mateus.

## Itens de endurecimento de baixo-debate (pro planejamento, não pra discussão)

Estes não têm dois lados fortes — são "quando", não "se". Entram no roadmap de endurecimento quando o Debate 5 definir a janela:
- `app/error.tsx` + `app/not-found.tsx` (skill `error-handling`).
- Zod `safeParse` nas server actions de escrita.
- `REVOKE EXECUTE ... FROM authenticated` nos helpers `SECURITY DEFINER` + `provision_secretaria`.
- Restringir listagem do bucket `avatars`; ligar proteção de senha vazada no Supabase Auth.
- Confirmar em prod: `UPSTASH_REDIS_REST_*` (senão rate-limit é decorativo) e gate de `typecheck` no CI.

---

## O que eu estava cogitando (não virou decisão)

- **A ironia dos endurecimentos:** vários deles (fail-closed, bump de deps, revoke de RPC) são mudanças que idealmente teriam teste pegando regressão — mas testes são justamente o que não existe (Debate 3). Talvez a ordem certa seja: uma malha mínima de smoke primeiro, depois o endurecimento em cima dela. Ou o inverso, se a malha demorar demais. Não resolvi.
- **WhatsApp pode ser o falso-diferencial:** o CLAUDE.md o trata como pilar, mas o que impressionou no design do loop clínico foi a *ficha estruturada + orçamento premium*. E se o diferencial real for esse, e WhatsApp for só higiene competitiva (todo mundo tem)? Isso reposicionaria o Debate 1 inteiro. Vale um debate de produto fundo, não uma decisão de engenharia.
- **O teste da clínica é, ele mesmo, um insumo que ainda não temos.** Boa parte destes debates (principalmente 1 e 5) fica mais fácil *depois* de ver a clínica usar. Talvez a discussão deva separar "o que decidir antes do teste" (pouco — só o risco do Debate 2 e a config de prod) de "o que o teste vai me dizer" (o resto).

## Como retomar

```bash
git checkout feat/fase1-onboarding-persona-loop
# ler, nesta ordem:
#   plans/auditorias/auditoria-2026-07-09.md   (o insumo — diagnóstico completo)
#   este handoff                                (os debates destilados)
# a sessão é DISCUSSÃO: abrir os 5 debates, não codar.
# se o Debate 1/5 pegar fogo, chamar business-strategist ou thinking-partner.
```

## Próxima sessão
- **Modo:** discussão.
- **Ler primeiro:** este handoff (os debates) + `plans/auditorias/auditoria-2026-07-09.md` (o diagnóstico que os fundamenta). Pro estado do código/loop clínico: `handoff-2026-07-07-execucao.md` + a spec da leva.
- **Objetivo da discussão:** decidir o rumo (Debate 5 é o mãe), não fechar implementação. Saída esperada: um handoff de discussão que aponte o que o planejamento deve especificar primeiro — provavelmente informado pelo resultado do teste com a clínica.
