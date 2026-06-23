# Handoff — Correção do Fluxo de Convites + Setup de Produção

**Data:** 2026-06-22
**Branch base:** `main` (repo `MateusTeixeira9203/Odonto.IA`)
**Contexto:** Dentista parceiro testando o sistema relatou que convites não chegavam — nem por e-mail (pessoa sem conta) nem por notificação in-app (pessoa com conta). Sessão dedicada a achar e corrigir TODOS os problemas do fluxo de convite e deixar a produção 100% para os testes.

---

## 1. Resumo executivo

O fluxo de convite tinha **vários bugs independentes** que se somavam, e a infra de produção estava parcialmente configurada. Tudo foi corrigido e está no ar. A causa raiz do "e-mail não chega" era o **domínio nunca ter sido verificado no Resend** (estava `not_started`, operando em sandbox).

**Status final: convite funcional ponta a ponta.** ✅

---

## 2. Problemas reportados (originais)

1. Convite para pessoa **com conta** (solo) → não recebia **notificação** in-app.
2. Convite para pessoa **sem conta** → não recebia **e-mail**.
3. (Descobertos durante a sessão) cancelamento que voltava no refresh; tela de sucesso confusa; e-mail marcado como "enviado" sem ter sido.

---

## 3. Bugs encontrados e corrigidos (código)

### 3.1 Notificação in-app nunca casava com o filtro do sininho
- **Arquivo:** `src/server/services/invites.ts` (`criarConvite`)
- **Causa:** a notificação era inserida com `para_dentista_id = users.id` (id de auth) e `para_role = 'dentista'`. Mas `/api/dex/alerts` filtra por `para_dentista_id = dentistas.id` (PK da tabela `dentistas`) e `para_role = <role real>`. Um solo é `admin` do próprio consultório → dupla incompatibilidade → notificação filtrada fora.
- **Fix:** busca a linha `dentistas` do convidado na clínica ativa dele e usa a **PK** + **role real**.
- **Commit:** `f11d7d8`

### 3.2 Aceite via `/auth/callback` deixava o convidado fora da clínica
- **Arquivo:** `src/app/auth/callback/route.ts`
- **Causa:** o caminho de aceite via confirmação de e-mail / login Google criava só a linha em `dentistas`, **sem** `clinica_usuarios` nem `users.active_clinica_id`. Como `requireClinicContext` exige ambos, o convidado era jogado pra `/onboarding` com o convite já consumido → preso fora da clínica.
- **Fix:** callback agora cria o **estado canônico completo** (upsert `users` com `active_clinica_id`, insert idempotente em `clinica_usuarios`, dentista escopado por `clinica_id`) e filtra o convite por `status='pendente'`. Converge com o `aceitarConvite`.
- **Commit:** `444cb09`

### 3.3 Tela de sucesso dava destaque excessivo ao link (parecia manual)
- **Arquivo:** `src/app/dashboard/configuracoes/usuarios/_components/usuarios-client.tsx`
- **Fix:** quando o e-mail é enviado → "Convite enviado!" como protagonista + reforço de que é automático; link vira ação secundária discreta. Quando falha → link em destaque com aviso âmbar.
- **Commits:** `e8b9e8e` (redesign), `f11d7d8` (link copiável inicial)

### 3.4 Cancelamento "sumia e voltava no refresh"
- **Arquivos:** `src/app/dashboard/configuracoes/usuarios/page.tsx`, `src/app/api/convite/route.ts`, `usuarios-client.tsx`
- **Causa 1:** a query da listagem **não filtrava `status`** → trazia cancelados/aceitos de volta (e contava vagas errado).
- **Causa 2:** a UI inseria o convite otimista com `id` aleatório (`crypto.randomUUID`) em vez do id real → cancelar na mesma sessão batia em id inexistente.
- **Fix:** query filtra `status='pendente'`; API retorna `inviteId`; UI usa o id real.
- **Commit:** `3b506f7`
- **Observação:** convites de teste antigos/expirados foram **apagados do banco** via SQL (incluindo um órfão `aceito` do `mateusteixeira834@gmail.com` que não saía da lista).

### 3.5 `emailEnviado` era falso-positivo
- **Arquivo:** `src/server/services/invites.ts`
- **Causa:** o SDK do Resend **não lança** em erro de API — retorna `{ data, error }`. O código fazia `await send(...); emailEnviado = true` sem checar `error` → tela dizia "enviado" mesmo quando recusado.
- **Fix:** captura `{ error }`, só marca enviado se `error` for nulo, e loga o erro real (JSON) pros logs da Vercel.
- **Commit:** `de1ff4b`

### 3.6 Anti-spam + remetente
- E-mail de convite passa a enviar **versão texto puro** junto do HTML (`src/lib/email/templates/convite.ts` → `conviteEmailText`). E-mail só-HTML é gatilho de spam. **Commit:** `3b506f7`
- Remetente unificado de `no-reply@` → **`equipe@dentia.app.br`** em convite + onboarding (`invites.ts`, `onboarding-emails.ts`). **Commit:** `6bb15d1`

---

## 4. CAUSA RAIZ do "e-mail não chega" (a principal)

O domínio `dentia.app.br` no Resend estava com status **`not_started`** — **nunca verificado**, apesar dos registros DNS corretos. Em sandbox, o Resend só envia pro dono da conta e **recusa terceiros**.

**Resolução:** verificação disparada via API do Resend nesta sessão →
`not_started` → `pending` → **`verified`** (confirmado 03:18 BRT, 2026-06-22).

- Domain ID no Resend: `e4b78d8a-6a0e-4854-b4c8-e442bf58be82`
- Região: `sa-east-1`
- **Não exige código nem redeploy** — é estado da conta Resend.

> Lição: ter os registros DNS no provedor **não basta** — precisa a verificação concluir no painel/API do Resend (status `verified`).

---

## 5. Infra de produção (configurada/confirmada nesta sessão)

| Item | Estado |
|------|--------|
| Domínio app `https://dentia.app.br` (apex A → `76.76.21.21`) servido pela Vercel, SSL ok | ✅ |
| Domínio adicionado no projeto Vercel como **Production** (www removido) | ✅ |
| Env vars Vercel: `NEXT_PUBLIC_SITE_URL` e `NEXT_PUBLIC_APP_URL` = `https://dentia.app.br` + redeploy | ✅ |
| Supabase Auth → Redirect URLs allowlist com `https://dentia.app.br/**` | ✅ (usuário fez) |
| Resend domínio verificado | ✅ |
| Git remote atualizado para `Odonto.IA.git` (era `Dent_IA.git`) | ✅ |

---

## 6. Commits desta sessão (todos na `main`, já no ar)

```
de1ff4b fix(convite): checa erro do Resend (emailEnviado deixa de ser falso-positivo)
6bb15d1 fix(email): remetente único equipe@dentia.app.br (era no-reply@)
3b506f7 fix(convite): cancelamento persistente + melhora entregabilidade (anti-spam)
e8b9e8e fix(convite): tela de sucesso prioriza envio automático de e-mail
444cb09 fix(convite): aceite via /auth/callback cria estado canônico completo
f11d7d8 fix(convite): notificação in-app, status de e-mail e link copiável
```

---

## 7. ⚠️ Pendências e follow-ups

1. **Commits de outra feature foram pushados junto (sem querer):** `fa19c1c` e `1ff27f6` ("emitir documentos clínicos", de uma sessão paralela) estavam na `main` local não-pushada e foram pro ar no push do `de1ff4b`.
   - **Impacto:** compila (build OK) e está **dormente** — a ligação na UI (`paciente-detail-client.tsx`) está **sem commit** (working tree), e a **migration `20260622000001_078_paciente_documentos_tipo.sql` NÃO foi aplicada**. Não renderiza nem roda. Não quebra nada.
   - **Ação:** deixar a outra sessão concluir; **não aplicar** a migration 078 em prod até a feature terminar.

2. **Upstash Redis caiu (rate-limit):** o host `frank-sponge-87179.upstash.io` **não existe mais** (`ENOTFOUND` — banco do plano grátis expirou). O código cai em **fallback em memória** → AI/Dex endpoints seguem funcionando, mas rate-limit fica por-instância. **Não afeta convite.**
   - **Ação (não urgente):** criar novo Redis no Upstash e atualizar `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` na Vercel + `.env.local`. Ou deixar no fallback.

3. **Spam (reputação de domínio novo):** e-mails podem cair no spam no começo. Mitigação: destinatários marcarem "não é spam" + adicionar `equipe@dentia.app.br` aos contatos. Melhora organicamente com o tempo. SPF/DKIM/DMARC já corretos.

4. **`mateusteixeira834@gmail.com`:** o convite aceito-órfão dele foi apagado. Se ele precisa ser membro de alguma clínica de verdade, refazer o convite (agora o fluxo está correto).

5. **Layout da tela de sucesso:** o usuário comentou que "uma parte está errada" mas não detalhou — **revisar quando ele apontar o que incomoda** (agora que o e-mail funciona, a tela mostra a variante verde "Convite enviado!").

6. **Plano dos dentistas de teste:** decidido **manter todos em CLINICA** por ora (host precisa ser CLINICA pra convidar; SOLO tem limite 1 e não consegue convidar).

7. **Google Calendar OAuth:** se for usar no domínio novo, adicionar `https://dentia.app.br/api/calendar/auth/callback` nas redirect URIs do Google Console (não bloqueia nada agora).

---

## 8. Como testar (ponta a ponta)

1. Host (plano CLINICA) → Configurações → Usuários → convidar um e-mail.
2. Tela deve mostrar **"Convite enviado!"** (verde) — e-mail sai automático.
3. Conferir caixa de entrada (e spam na 1ª vez → marcar "não é spam").
4. Abrir o link em aba anônima → tela de aceite → criar conta / logar.
5. Deve cair **direto no dashboard da clínica** (não no onboarding).
6. Se o convidado já tinha conta logada → conferir o **sininho** dele.
7. Cancelar um convite pendente → some na hora e **não volta** no refresh.

---

## 9. Comandos/diagnósticos úteis (referência)

**Checar status do domínio Resend (read-only):**
```bash
KEY=$(grep '^RESEND_API_KEY=' .env.local | cut -d= -f2)
curl -s -H "Authorization: Bearer $KEY" https://api.resend.com/domains
```
**Disparar verificação do domínio:**
```bash
curl -s -X POST -H "Authorization: Bearer $KEY" \
  https://api.resend.com/domains/e4b78d8a-6a0e-4854-b4c8-e442bf58be82/verify
```
**Supabase MCP (project `zenfemoxvwerplrjgfqz`)** foi usado para inspecionar/limpar a tabela `convites`.

**Arquitetura do fluxo de convite (referência rápida):**
- Criar: `usuarios-client.tsx` → `POST /api/convite` → `criarConvite` (`invites.ts`)
- Aceitar (logado, botão): `aceitarConviteAction` → `aceitarConvite` (cria estado canônico completo)
- Aceitar (callback / confirmação e-mail / Google): `src/app/auth/callback/route.ts` (agora também cria estado canônico)
- Cancelar/renovar: `DELETE/PATCH /api/convite/[id]` → `cancelarConvite`/`renovarConvite`
- Fontes de verdade: `users.active_clinica_id` (clínica ativa) + `clinica_usuarios` (membership) + `dentistas` (perfil clínico)
- Notificação lida por: `/api/dex/alerts` (filtra por `clinica_id` + `para_role` + `para_dentista_id`=PK dentistas)

---

## 10. Estado final

| Área | Status |
|------|--------|
| Notificação in-app do convite | ✅ |
| Aceite (todos os caminhos) cria estado canônico | ✅ |
| Tela de sucesso honesta (enviado vs falhou) | ✅ |
| Cancelamento persistente | ✅ |
| E-mail de convite (domínio verificado) | ✅ |
| Anti-spam (texto puro + remetente único) | ✅ |
| Infra (domínio, envs, Supabase, Resend, git remote) | ✅ |
| Upstash rate-limit | ⚠️ fallback (não urgente) |
| Feature "documentos" dormente em prod | ⚠️ acompanhar sessão paralela |
