# Handoff — 2026-06-22 — Emitir Documentos Clínicos

## Objetivo final
Permitir que o dentista **emita receita / atestado / pedido de exame** em poucos cliques, com tudo pré-preenchido (paciente + dentista + CRO + clínica), gerando um **PDF** salvo na aba **Arquivos** do paciente, com opção de **imprimir** e (futuro) **enviar por WhatsApp**. Arquitetura `tipo → modelo → 2-3 campos → PDF`, modelos como dados (registry tipado, extensível sem telas novas).

Plano completo: [docs/superpowers/plans/2026-06-22-emitir-documentos-clinicos.md](../superpowers/plans/2026-06-22-emitir-documentos-clinicos.md)

## Status: NÚCLEO COMPLETO ✅ (Tasks 0-5, 7, 8). Task 6 PARADA (depende de decisão WhatsApp).

### Arquivos criados
- `supabase/migrations/20260622000001_078_paciente_documentos_tipo.sql` — coluna `tipo_documento` (APLICADA no Supabase `zenfemoxvwerplrjgfqz` + `NOTIFY pgrst`).
- `src/lib/documentos/modelos.ts` — registry de modelos (receita simples; atestado comparecimento/afastamento; pedido panorâmica/periapical/tomografia/doc. orto).
- `src/lib/pdf/documento.ts` — gerador PDF `@react-pdf/renderer` (suporta 2 vias).
- `src/app/dashboard/pacientes/[id]/documentos-actions.ts` — server action `emitirDocumento` (sem `enviarDocumentoWhatsApp` ainda — é a Task 6).
- `src/components/pacientes/EmitirDocumentoModal.tsx` — modal composer.

### Arquivos modificados
- `src/app/dashboard/pacientes/[id]/_components/paciente-detail-client.tsx` — botão FilePlus "Emitir documento" no header (só `canWriteClinical`) + render do modal.
- `src/components/pacientes/DocumentosTab.tsx` — filtro "Emitidos" + `clinica_id` no fetch (defesa em profundidade).
- `src/app/consulta/[agendamentoId]/_components/consulta-client.tsx` — link discreto "Emitir documento" no pós-consulta + render do modal.

### Verificação
- `npm run typecheck`: **0 erros nos arquivos da feature**. Erros pré-existentes (NÃO nossos): `screenshots-sprint2-bloco2/` (playwright) e `(auth)/cadastro/page.tsx` (searchParams precisa ser `Promise` no Next 16 — surge via `.next/types` após build; build passa por `ignoreBuildErrors:true`).
- `npm run build`: **sucesso** (53 rotas).
- Code review (opus, olhos frescos): **APROVADO COM RESSALVAS**, nenhum Critical/High. Correções já aplicadas: revalidação server-side de campos obrigatórios, limpeza de PDF órfão se insert falhar, cor `#2f9c85`→token `bg-teal`, `clinica_id` no fetch da DocumentosTab.

### Commits (na main) — JÁ PUSHADO / EM DEPLOY ✅
- `fa19c1c` Tasks 0-2 · `1ff27f6` Tasks 3-4 · `07e4068` Tasks 5,7,8 · `f7fd0aa` review fixes.
- **PUSH FEITO** em 2026-06-22 (`de1ff4b..f7fd0aa main -> main`) → deploy automático Vercel (dentia.app.br). Feature de documentos completa em produção.
- Migration 078 aplicada no Supabase. **069/076 (WhatsApp) seguem NÃO aplicadas** (decisão: organizar WhatsApp depois).

## ⚠️ Nota de git (importante)
Criei a branch `feat/emitir-documentos-clinicos`, mas durante a sessão houve **commits paralelos do usuário** na main (`fix(email): remetente único`, `fix(convite): checa erro do Resend`) e o working tree acabou **na main com meus commits da feature já integrados** (interleaved com os do usuário). Working tree limpo. Se quiser histórico isolado, era tarde — já está tudo na main local (sem push).

## 🔴 DECISÃO PENDENTE: migrations de WhatsApp (bloqueia Task 6)
Descoberto: as migrations **069 (whatsapp_official_api)** e **076 (clinicas_whatsapp_meta)** estão **commitadas mas NUNCA aplicadas** ao banco. Aplicadas hoje: 074, 075, 077, 078.
- Consequência: `clinicas.whatsapp_phone_number_id` e os campos de `bot_config` não existem → **o envio de orçamento por WhatsApp já está QUEBRADO em produção** (`send-pdf.ts` referencia colunas inexistentes). Não é regressão nossa.
- Ambas são **aditivas/idempotentes** (`ADD COLUMN IF NOT EXISTS`, sem drops) → seguras de aplicar.

## Próximos passos (o que eu ia fazer a seguir)
1. **Aguardar decisão do usuário** sobre aplicar 069+076 (recomendo aplicar — seguras, consertam prod, desbloqueiam Task 6).
2. Se aplicadas → **implementar Task 6** (`enviarDocumentoWhatsApp` na action + botão "Enviar por WhatsApp" no modal). Código completo já está na Task 6 do plano. Confirmar assinatura de `sendFile` em `src/lib/whatsapp/provider.ts` (esperado `sendFile(phoneNumberId, to, base64, filename, caption, mime)`).
3. **Decisão de deploy**: push da main? (feature commitada, não pushada).
4. **Follow-ups Low da review** (opcionais): passar `onEmitted` ao modal pra recarregar a aba Arquivos automaticamente após emitir (hoje precisa recarregar a página).
5. **Pré-existente, fora de escopo**: corrigir `searchParams` async em `(auth)/cadastro/page.tsx` (e `planos/page.tsx`) pro Next 16 — candidato a task separada.

## Como testar manualmente
`npm run dev` → abrir um paciente → ícone FilePlus no header → gerar "Receita simples" com 2 vias → conferir PDF (1ª/2ª via) → aba Arquivos → PDF em "Documentos" + filtro "Emitidos". Também: consulta real → salvar ficha → link discreto "Emitir documento".
