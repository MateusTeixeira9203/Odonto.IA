# Backlog — DentIA

Documento vivo de organização do que precisa ser feito, refinado ou corrigido.
Atualizado em: 2026-04-29 (pendentes de commit adicionados)

---

## 🔴 Prioridade Alta — Completar antes de ir a produção

### DEX — Assistente IA
- [ ] **Reativar o DEX** — widget e onboarding estão comentados em `dashboard-shell.tsx`. Reativar após validação dos testes.
- [ ] **Modo Consulta** — tela em `/consulta/[agendamentoId]` está funcional mas desconectada do fluxo principal. Decidir se integra ao perfil do paciente ou mantém rota separada.
- [ ] **Briefing automático** — rota `/api/dex/briefing` funcionando, mas depende do DEX estar ativo.
- [ ] **Formatar evolução** — rota `/api/dex/formatar-evolucao` pronta, integrada ao modo consulta. Revisar edge cases de resposta da IA.
- [ ] **Contexto do paciente** — rota `/api/dex/patient-context` com mudanças pendentes (unstaged). Revisar e commitar.

### Fluxo da Secretária

#### Bugs / Inconsistências
- [ ] **Paciente órfão ao criar** — formulário de novo paciente (`pacientes/novo`) não tem seletor de dentista. Paciente fica sem `dentista_id`, invisível nas fichas do dentista. Adicionar dropdown igual ao de agendamentos.
- [ ] **Dois links de WhatsApp na sidebar** — sidebar mostra `/dashboard/whatsapp` e `/dashboard/bot` ao mesmo tempo para secretária. Remover o redundante.
- [ ] **Secretária não consegue criar orçamentos** — `canEdit = dentista.plano === 'SOLO'` bloqueia secretária mesmo no plano CLINICA. Corrigir para `canEdit = plano === 'SOLO' || role === 'secretaria'`.
- [ ] **Seletor de dentista em orçamentos não existe** — secretária vê orçamentos de todos mas não tem filtro por dentista. Props `dentistas` já chegam no componente mas não são usadas.

#### Funcionalidades incompletas
- [ ] **Criar agendamento em nome do dentista** — lógica de `dentistaId` na action existe, mas o formulário precisa de revisão de UX (seleção do dentista não está clara visualmente).
- [ ] **Visão da agenda por dentista** — secretária vê todos os agendamentos da clínica mas não tem filtro visual por dentista no calendário.
- [ ] **Confirmação de agendamentos** — agendamentos criados pela secretária ficam com status `agendado`. Falta fluxo de confirmação pelo dentista ou pelo paciente.
- [ ] **Auditoria de ações** — campo `created_by` existe em `agendamentos` mas não é exibido em nenhuma tela. Mostrar "criado por [secretária]" nos cards de agendamento e nos registros financeiros.
- [ ] **Notificação ao dentista em lançamentos financeiros** — quando secretária lança despesa/receita associada a um dentista, o dentista não é notificado. Apenas o admin recebe notificação de pagamento.
- [ ] **Filtro de dentista em orçamentos** — adicionar dropdown similar ao de agendamentos para secretária filtrar orçamentos por dentista.

#### Permissões a revisar
- [ ] **Secretária pode editar fichas clínicas?** — não está claro no código se tem acesso ao perfil do paciente e às fichas. Definir e implementar guardrail.
- [ ] **Seletor de dentista no financeiro não persiste** — ao trocar de aba/mês, o seletor de dentista volta ao padrão. Manter seleção enquanto navega.

### Pagamentos
- [ ] **Geração automática ao criar orçamento** — `pagamentos` não é inserido ao criar orçamento. A tela exibe e atualiza registros existentes, mas não os cria.
- [ ] **Conciliação básica** — marcar parcela como paga manualmente funciona, mas não há histórico de quem marcou ou quando.

---

## 🟡 Prioridade Média — Refinamentos importantes

### Fichas Clínicas
- [ ] **Assinatura do paciente** — implementada na `FichasTab`. Validar UX no tablet (touch), garantir que o canvas renderiza corretamente em diferentes tamanhos de tela.
- [ ] **Export do prontuário completo** — botão sutil no cabeçalho do perfil do paciente para baixar histórico completo como HTML estilizado (abre no browser, Ctrl+P para PDF). Sem dependência extra. Fichas, procedimentos, orçamentos e agendamentos em um arquivo só.
- [ ] **Extração de imagem com IA** — rota `/api/extrair-imagem` existe mas não tem botão na interface. Adicionar ação nas fotos de raio-x.
- [ ] **PDF da ficha** — gerar PDF da evolução clínica para impressão ou envio. Coluna `pdf_url` existe no schema, sem implementação.

### Orçamentos
- [ ] **PDF do orçamento** — coluna `pdf_url` existe no banco mas não há rota, action ou UI para gerar. Alta demanda dos dentistas.
- [ ] **Envio por WhatsApp** — deep link `wa.me` existe, mas envio automático com PDF anexado não está implementado.
- [ ] **Parcelamento** — exibir formas de pagamento e parcelas no orçamento.

### Agendamentos
- [ ] **Detecção de conflito de horário no front** — conflito é validado na action server-side, mas o formulário não avisa antes de submeter.
- [ ] **Notificação de lembrete** — tabela `agendamentos` tem coluna `whatsapp_reminder_sent`. Falta o job que dispara o lembrete.
- [ ] **Integração Google Calendar** — OAuth2 implementado (`google-provider.ts`), sync bidirecional parcial. Testar fluxo completo de import/export.

### WhatsApp / Bot
- [ ] **Integração Evolution API** — tabelas `conversas_bot` e `mensagens_bot` existem. Webhook `/api/whatsapp/webhook` planejado mas não implementado.
- [ ] **Envio ativo de mensagens** — rota `/api/whatsapp/enviar` planejada. Útil para confirmações e lembretes.
- [ ] **Bot de agendamento automático** — fluxo de estados em `src/lib/whatsapp/states.ts` com mudanças pendentes. Revisar e completar.

---

## 🟢 Prioridade Baixa — Melhorias e polimento

### UX / Interface
- [ ] **Responsividade mobile** — ajustes feitos para tablet (768–1024px), mas mobile puro (<768px) tem pontos críticos na FichasTab e no calendário de agendamentos.
- [ ] **Dark mode** — implementado, mas alguns componentes novos (SignaturePad, odontograma) não testados em dark.
- [ ] **Feedback de erros** — muitos `alert()` e `console.error()` espalhados. Padronizar uso do `toast` da Sonner em todo o projeto.
- [ ] **Loading states** — algumas telas não têm skeleton enquanto carregam dados. Padronizar com o `Skeleton` do shadcn.

### Configurações
- [ ] **Convite de dentistas** — tabela `convites` e fluxo de `status_convite` existem. Revisar se o e-mail de convite está sendo disparado corretamente.
- [ ] **Planos e limites** — `temFeature()` e `limite_dentistas` estão implementados mas não testados com múltiplos usuários em produção.
- [ ] **Chave PIX** — campo `chave_pix` adicionado em dentistas (migration 042). Não está sendo exibida em nenhuma tela relevante de pagamento.

### Infraestrutura
- [ ] **Stripe** — billing, planos e upgrade não implementados. Necessário antes de cobrar clientes.
- [ ] **Versionar buckets do Storage** — buckets (`audios`, `fichas`, `radiografias`, `documentos`, `avatars`) criados manualmente. Adicionar migration de storage policies para não depender de setup manual.
- [ ] **Variáveis de ambiente** — validar que todas as envs críticas (`GEMINI_API_KEY`, `EVOLUTION_API_KEY`, `GOOGLE_*`) têm fallback seguro em produção.

---

## 🔧 Dívida Técnica

| Item | Arquivo | Descrição |
|---|---|---|
| `any` no código | Vários | Alguns casts `as unknown as X` ainda existem. Revisar e tipar corretamente. |
| Query ambígua corrigida | `agendamentos/page.tsx` | Fix do PGRST201 aplicado. Monitorar se há outras queries com FK ambígua. |
| `dentista:dentistas` em actions | `agendamentos/actions.ts` | Fix aplicado. Verificar outros arquivos que fazem join com `dentistas`. |
| Estados do bot desatualizados | `lib/whatsapp/states.ts` | Mudanças unstaged. Revisar antes de reativar o bot. |
| Contexto DEX | `api/dex/patient-context/route.ts` | Mudanças unstaged. Revisar e commitar ou descartar. |
| `update_updated_at` search_path | migration | Função com `search_path` mutável. Fix simples com `SET search_path = public`. |
| Funções SECURITY DEFINER expostas para `anon` | banco | `get_my_clinica_id`, `get_my_role`, `get_my_dentista_id` acessíveis sem login via REST. Revogar EXECUTE para anon. |
| RLS `WITH CHECK (true)` em clinicas | banco | INSERT na tabela `clinicas` sem restrição para usuários autenticados. |

---

## 🕐 Mudanças pendentes de commit

Arquivos com alterações não commitadas — revisar e commitar quando contexto da sessão estiver disponível:

| Arquivo | O que tem |
|---|---|
| `src/app/api/dex/patient-context/route.ts` | Mudanças no contexto enviado ao DEX durante consulta |
| `src/lib/whatsapp/states.ts` | Novos estados do bot WhatsApp (possivelmente AGUARDANDO_CONFIRMACAO_24H) |
| `src/components/layout/dex-widget.tsx` | Mudanças no widget do DEX (incompletas) |
| `src/app/dashboard/pacientes/[id]/_components/paciente-detail-client.tsx` | Mudanças no detalhe do paciente (não revisadas) |

---

## ✅ Feito recentemente (referência)

- Fix PGRST201 — agendamentos não apareciam por FK ambígua com `created_by`
- DEX desativado temporariamente (widget + onboarding comentados)
- Assinatura digital do paciente na FichasTab (`signature_pad`)
- Migration `045_fichas_assinatura` — colunas `assinatura_url` e `assinado_em`
- Fix de performance RLS — `(select auth.uid())` em 17 políticas
- 8 índices criados em FKs sem cobertura
- 3 índices duplicados removidos
