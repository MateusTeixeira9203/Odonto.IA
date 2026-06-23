# Backlog — Odonto.IA

Documento vivo de organização do que precisa ser feito, refinado ou corrigido.
**Atualizado em: 2026-06-22**

---

## 🔴 Prioridade Alta

### Migrations WhatsApp pendentes (bloqueiam Task 6 de Documentos)
- [ ] Aplicar migrations **069 (whatsapp_official_api)** e **076 (clinicas_whatsapp_meta)** — commitadas mas nunca aplicadas ao banco. `send-pdf.ts` já referencia colunas inexistentes (`whatsapp_phone_number_id`) → envio de orçamento por WhatsApp está quebrado em prod. Ambas são aditivas/idempotentes (`ADD COLUMN IF NOT EXISTS`), seguras de aplicar.
- [ ] Após aplicar: implementar **Task 6 do plano de documentos** — botão "Enviar por WhatsApp" no `EmitirDocumentoModal` + `enviarDocumentoWhatsApp` na server action. Código já planejado em `docs/superpowers/plans/2026-06-22-emitir-documentos-clinicos.md`.

### Upstash Redis expirado
- [ ] Plano gratuito expirou (`frank-sponge-87179.upstash.io` → `ENOTFOUND`). Rate-limit rodando em fallback em memória (por-instância). Criar novo Redis no Upstash e atualizar `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` na Vercel e `.env.local`.

### Fluxo do Dentista Convidado
- [ ] **Perfil incompleto** — dentista convidado vai direto ao dashboard sem preencher nome, CRO ou especialidade. Implementar ícone de engrenagem na sidebar pulsando em âmbar com tooltip "Complete seu perfil" enquanto `cro` ou `especialidade` estiverem nulos.
- [ ] **Dentista com conta existente sendo convidado** — `inviteUserByEmail` rejeita e-mails já cadastrados. Exige arquitetura many-to-many (`dentistas_clinicas`) e troca de contexto de clínica no dashboard. Decisão: adiar ou implementar já?

---

## 🟡 Prioridade Média

### Modo Consulta — Refinamentos UI (plano: `2026-06-07-modo-consulta-refinamentos.md`)
- [ ] Fix borda dupla no Hero do Dashboard (`next-appointment-hero.tsx` — remover spread `0 0 0 4px`)
- [ ] Redesign Hero Strip do paciente — 3 colunas com cards de status com personalidade
- [ ] Feedback progressivo no "Formatar com IA" — etapas animadas enquanto Gemini processa
- [ ] Redesign sidebar do modo consulta — `w-64` → `w-80`, cards internos, avatar com anel
- [ ] Ficha clínica — buscar e exibir `procedimentos`, `conduta`, `retorno_sugerido` (salvos mas nunca exibidos); múltiplos procedimentos por dente via `\n` no prompt da IA

### Documentos Clínicos — Follow-up
- [ ] `onEmitted` callback no `EmitirDocumentoModal` para recarregar aba Arquivos automaticamente após emitir (hoje precisa refresh manual de página)

### Secretaria — Fluxos Pendentes
- [ ] **Confirmação de agendamentos** — agendamentos criados pela secretária ficam com status `agendado`. Falta fluxo de confirmação pelo dentista ou pelo paciente.
- [ ] **Auditoria de ações** — campo `created_by` existe em `agendamentos` mas não exibido. Mostrar "criado por [secretária]" nos cards.

### Fichas Clínicas
- [ ] **Extração de imagem com IA** — rota `/api/extrair-imagem` existe mas não tem botão na interface. Adicionar ação nas fotos de raio-x.

### Agendamentos
- [ ] **Notificação de lembrete** — `agendamentos.whatsapp_reminder_sent` existe. Falta o job que dispara o lembrete.
- [ ] **Google Calendar** — OAuth2 implementado (`google-provider.ts`), sync bidirecional parcial. Testar fluxo completo. Adicionar `https://dentia.app.br/api/calendar/auth/callback` nas redirect URIs do Google Console se usar no domínio de prod.

### WhatsApp / Bot
- [ ] **Integração Evolution API** — tabelas `conversas_bot` e `mensagens_bot` existem. Webhook `/api/whatsapp/webhook` planejado mas não implementado.
- [ ] **Envio ativo de mensagens** — rota `/api/whatsapp/enviar` planejada. Útil para confirmações e lembretes.
- [ ] **Bot de agendamento automático** — fluxo de estados em `src/lib/whatsapp/states.ts` com mudanças unstaged. Revisar e completar.

---

## 🟢 Prioridade Baixa

### UX / Interface
- [ ] **Responsividade mobile** — ajustes feitos para tablet (768–1024px), mas mobile puro (<768px) tem pontos críticos na FichasTab e no calendário.
- [ ] **Dark mode** — alguns componentes (SignaturePad, odontograma, EmitirDocumentoModal) não testados em dark.
- [ ] **Feedback de erros** — padronizar uso do `toast` da Sonner em todo o projeto (muitos `alert()` e `console.error()` ainda espalhados).
- [ ] **Loading states** — padronizar skeleton em telas sem loading state explícito.

### Configurações
- [ ] **Planos e limites** — `temFeature()` e `limite_dentistas` implementados mas não testados com múltiplos usuários em produção.
- [ ] **Chave PIX** — campo `chave_pix` em `dentistas` (migration 042). Não exibida em nenhuma tela de pagamento.

### Infraestrutura
- [ ] **Stripe** — billing, planos e upgrade não implementados. Necessário antes de cobrar clientes.
- [ ] **Versionar buckets do Storage** — buckets criados manualmente. Adicionar migration de storage policies.
- [ ] **`searchParams` async** — `(auth)/cadastro/page.tsx` e `planos/page.tsx` precisam de `searchParams` como `Promise` para Next 16 (build passa com `ignoreBuildErrors:true`, mas deve ser corrigido).

### Comunicação Interna
- [ ] **Chat interno da clínica** — mensagens em tempo real via Supabase Realtime entre dentista e secretária.

---

## 🔧 Dívida Técnica

| Item | Arquivo | Descrição |
|---|---|---|
| `any` no código | Vários | Alguns casts `as unknown as X` ainda existem. |
| Bot states | `lib/whatsapp/states.ts` | Mudanças unstaged. Revisar antes de reativar. |
| Contexto DEX | `api/dex/patient-context/route.ts` | Mudanças unstaged. Revisar e commitar ou descartar. |
| Testes de isolamento | `scripts/test-isolation.sql` | Tabelas adicionadas após Mar/2026 (`clinica_usuarios`, `paciente_documentos`) não foram testadas. |

---

## ✅ Feito (referência cronológica)

### Documentos Clínicos + Correções (Jun/2026)
- **Emitir documentos clínicos** — registry de modelos (receita, atestado, pedido de exame), gerador PDF com 2 vias, server action `emitirDocumento`, `EmitirDocumentoModal`, botão no header do paciente, filtro "Emitidos" na aba Arquivos, link pós-consulta. Migration 078 aplicada. Em produção.
- **Fluxo de convite ponta a ponta** — 6 bugs corrigidos: notificação in-app (PK + role corretos), callback `/auth/callback` cria estado canônico completo, tela de sucesso honesta, cancelamento persistente, `emailEnviado` falso-positivo, anti-spam (texto puro + remetente único). Domínio Resend verificado. Em produção.
- **Infra de produção** — domínio `dentia.app.br` na Vercel, env vars, Supabase redirect URLs, git remote `Odonto.IA`.

### Modo Consulta + Transcrição (Jun/2026)
- **Groq Whisper** — migração de Gemini → `whisper-large-v3-turbo` para transcrição. Latência 1–2s vs 6–10s anterior. Prompt odontológico configurado.
- **GROQ_API_KEY** — configurada em `.env.local` e Vercel.

### Planejamento + Agenda + Módulo Secretária (Mai/2026)
- **Block 10 parcial** — Week view, view toggle Mês/Semana, no-show button, cancel-com-motivo dialog, walk-in/encaixe, contexto do paciente expandido na consulta (alergias, tratamento ativo, etapas).
- **PlanejamentoTab B+C** — barra de progresso, sincronização com fichas, badges de status clicáveis, data estimada por seção.
- **Modal Novo Agendamento** — redesenhado 2 colunas, campo Procedimento removido, card resumo visual.
- **Módulo Secretária completo (Blocos 1–5)** — dashboard com métricas, agenda multi-dentista, assinatura na recepção, data de vencimento em pagamentos, perfil do paciente restrito.
- **DEX + Tour de Onboarding** — tour ativado para todos os roles, SimFinanceiro novo, SimOrcamento redesenhado, textos revisados.
- **Exportações HTML→Print** — prontuário completo, PDF da ficha, PDF do orçamento.
- **Conflito de horário** — detecção local (sem roundtrip ao servidor).

### Segurança (Mai/2026)
- REVOKE EXECUTE anon em `get_my_clinica_id`, `get_my_role`, `get_my_dentista_id`.
- `clinicas_insert_policy` com check de dentista existente.
- `update_updated_at` com `SET search_path = public`.
- Fix de performance RLS — `(select auth.uid())` em 17 políticas.
- 8 índices criados em FKs; 3 índices duplicados removidos.

### Fluxo de Convites v1 (Mai/2026)
- Metadados no JWT, redirect unificado, histórico de convites com `status`, contador de vagas correto.

### Assinatura Digital + Outros (Abr/Mai 2026)
- Assinatura digital do paciente na FichasTab.
- Fix PGRST201 (FK ambígua em `agendamentos`).
- Odontograma premium, floating dock nav, ficha clínica timeline.
