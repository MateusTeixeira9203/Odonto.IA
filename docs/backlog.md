# Backlog — DentIA

Documento vivo de organização do que precisa ser feito, refinado ou corrigido.
Atualizado em: 2026-04-29

---

## 🔴 Prioridade Alta — Completar antes de ir a produção

### DEX — Assistente IA
- [ ] **Reativar o DEX** — widget e onboarding estão comentados em `dashboard-shell.tsx`. Reativar após validação dos testes.
- [ ] **Modo Consulta** — tela em `/consulta/[agendamentoId]` está funcional mas desconectada do fluxo principal. Decidir se integra ao perfil do paciente ou mantém rota separada.
- [ ] **Briefing automático** — rota `/api/dex/briefing` funcionando, mas depende do DEX estar ativo.
- [ ] **Formatar evolução** — rota `/api/dex/formatar-evolucao` pronta, integrada ao modo consulta. Revisar edge cases de resposta da IA.
- [ ] **Contexto do paciente** — rota `/api/dex/patient-context` com mudanças pendentes (unstaged). Revisar e commitar.

### Fluxo da Secretária
- [ ] **Criar agendamento em nome do dentista** — lógica de `dentistaId` na action existe, mas o formulário de criação na visão da secretária precisa de revisão de UX (seleção do dentista não está clara).
- [ ] **Visão da agenda por dentista** — secretária vê todos os agendamentos da clínica mas não tem filtro visual por dentista no calendário.
- [ ] **Confirmação de agendamentos** — agendamentos criados pela secretária ficam com status `agendado`. Falta fluxo de confirmação pelo dentista ou pelo paciente.
- [ ] **Permissões de edição** — secretária consegue editar fichas? Revisar o que ela pode e não pode fazer em cada tela.

### Pagamentos
- [ ] **Geração automática ao criar orçamento** — `pagamentos` não é inserido ao criar orçamento. A tela exibe e atualiza registros existentes, mas não os cria.
- [ ] **Conciliação básica** — marcar parcela como paga manualmente funciona, mas não há histórico de quem marcou ou quando.

---

## 🟡 Prioridade Média — Refinamentos importantes

### Fichas Clínicas
- [ ] **Assinatura do paciente** — implementada na `FichasTab`. Validar UX no tablet (touch), garantir que o canvas renderiza corretamente em diferentes tamanhos de tela.
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

## ✅ Feito recentemente (referência)

- Fix PGRST201 — agendamentos não apareciam por FK ambígua com `created_by`
- DEX desativado temporariamente (widget + onboarding comentados)
- Assinatura digital do paciente na FichasTab (`signature_pad`)
- Migration `045_fichas_assinatura` — colunas `assinatura_url` e `assinado_em`
- Fix de performance RLS — `(select auth.uid())` em 17 políticas
- 8 índices criados em FKs sem cobertura
- 3 índices duplicados removidos
