# Backlog — DentIA

Documento vivo de organização do que precisa ser feito, refinado ou corrigido.
Atualizado em: 2026-05-04

---

## 📅 Tarefas do Dia — 2026-05-04

- [ ] **Commit das alterações** — commitar tudo que está pendente das sessões anteriores (PlanejamentoTab B+C, modal agendamentos, migrations 048–049, backlog atualizado)
- [ ] **Reativar o DEX** — desbloquear widget e onboarding em `dashboard-shell.tsx`; reconectar modo consulta ao fluxo principal; revisar e commitar mudanças pendentes em `patient-context/route.ts`

---

## 🔴 Prioridade Alta — Completar antes de ir a produção

### DEX — Assistente IA
- [ ] **Reativar o DEX** — widget e onboarding estão comentados em `dashboard-shell.tsx`. Reativar após validação dos testes.
- [ ] **Modo Consulta** — tela em `/consulta/[agendamentoId]` está funcional mas desconectada do fluxo principal. Decidir se integra ao perfil do paciente ou mantém rota separada.
- [ ] **Briefing automático** — rota `/api/dex/briefing` funcionando, mas depende do DEX estar ativo.
- [ ] **Formatar evolução** — rota `/api/dex/formatar-evolucao` pronta, integrada ao modo consulta. Revisar edge cases de resposta da IA.
- [ ] **Contexto do paciente** — rota `/api/dex/patient-context` com mudanças pendentes (unstaged). Revisar e commitar.

### Fluxo da Secretária
- [ ] **Confirmação de agendamentos** — agendamentos criados pela secretária ficam com status `agendado`. Falta fluxo de confirmação pelo dentista ou pelo paciente.
- [ ] **Auditoria de ações** — campo `created_by` existe em `agendamentos` mas não é exibido em nenhuma tela. Mostrar "criado por [secretária]" nos cards de agendamento e nos registros financeiros.

### Fluxo do Dentista Convidado
- [ ] **Lembrete de perfil incompleto** — dentista convidado vai direto ao dashboard sem preencher nome, CRO ou especialidade. Implementar uma das duas abordagens: (a) ícone de engrenagem na sidebar pulsando em âmbar com tooltip "Complete seu perfil" enquanto `cro` ou `especialidade` estiverem nulos; (b) notificação no sino ao entrar pela primeira vez (`status_convite === 'aceito'` + perfil incompleto). Redirecionar para `/dashboard/perfil`.
- [ ] **Dentista com conta existente sendo convidado** — atualmente `inviteUserByEmail` rejeita emails já cadastrados. Suportar esse caso exige arquitetura many-to-many: tabela `dentistas_clinicas` (dentista_id, clinica_id, role) substituindo o `clinica_id` direto em `dentistas`, lógica de troca de contexto de clínica no dashboard e ajuste em todas as queries que usam `get_my_clinica_id()`.

---

## 🟡 Prioridade Média — Refinamentos importantes

### Fichas Clínicas
- [ ] **Export do prontuário completo** — botão sutil no cabeçalho do perfil do paciente para baixar histórico completo como HTML estilizado (abre no browser, Ctrl+P para PDF). Sem dependência extra. Fichas, procedimentos, orçamentos e agendamentos em um arquivo só.
- [ ] **Extração de imagem com IA** — rota `/api/extrair-imagem` existe mas não tem botão na interface. Adicionar ação nas fotos de raio-x.
- [ ] **PDF da ficha** — gerar PDF da evolução clínica para impressão ou envio. Coluna `pdf_url` existe no schema, sem implementação.

### Orçamentos
- [ ] **PDF do orçamento** — coluna `pdf_url` existe no banco mas não há rota, action ou UI para gerar. Alta demanda dos dentistas.
- [ ] **Envio por WhatsApp** — deep link `wa.me` existe, mas envio automático com PDF anexado não está implementado.

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
- [ ] **Dentista pode migrar de clínica** — dentista autenticado consegue sair de uma clínica e aceitar convite de outra sem criar nova conta. Dados clínicos (pacientes, fichas, orçamentos) seguem o dentista. Uma clínica ativa por vez; opção de operar solo permitida. Requer: fluxo de convite revisado, tela de "Minhas Clínicas" no perfil, e migração controlada de `clinica_id` nas tabelas relevantes.

### Infraestrutura
- [ ] **Stripe** — billing, planos e upgrade não implementados. Necessário antes de cobrar clientes.
- [ ] **Versionar buckets do Storage** — buckets (`audios`, `fichas`, `radiografias`, `documentos`, `avatars`) criados manualmente. Adicionar migration de storage policies para não depender de setup manual.
- [ ] **Variáveis de ambiente** — validar que todas as envs críticas (`GEMINI_API_KEY`, `EVOLUTION_API_KEY`, `GOOGLE_*`) têm fallback seguro em produção.

### Comunicação Interna
- [ ] **Chat interno da clínica** — canal de mensagens entre dentista e demais membros (secretárias). Mensagens em tempo real via Supabase Realtime. Fio por clínica, notificação no bell. Sem exposição de dados de pacientes no chat.

### Visão de Futuro
- [ ] **Rede social para dentistas** — feed de cases clínicos (anonimizados), grupos por especialidade, troca de dicas de gestão. Produto separado ou extensão do DentIA para criar network entre profissionais.

---

## 🔧 Dívida Técnica

| Item | Arquivo | Descrição |
|---|---|---|
| `any` no código | Vários | Alguns casts `as unknown as X` ainda existem. Revisar e tipar corretamente. |
| Estados do bot desatualizados | `lib/whatsapp/states.ts` | Mudanças unstaged. Revisar antes de reativar o bot. |
| Contexto DEX | `api/dex/patient-context/route.ts` | Mudanças unstaged. Revisar e commitar ou descartar. |
| `update_updated_at` search_path | migration | Função com `search_path` mutável. Fix simples com `SET search_path = public`. |
| Funções SECURITY DEFINER expostas para `anon` | banco | `get_my_clinica_id`, `get_my_role`, `get_my_dentista_id` acessíveis sem login via REST. Revogar EXECUTE para anon. |
| RLS `WITH CHECK (true)` em clinicas | banco | INSERT na tabela `clinicas` sem restrição para usuários autenticados. |

---

## ✅ Feito recentemente (referência)

### PlanejamentoTab + Agendamentos (2026-05-03)
- **PlanejamentoTab B+C** — barra de progresso com contagem de procedimentos e total do orçamento; seção colapsável sincroniza procedimentos das fichas (`dentes_observacoes`) para `planejamento_procedimentos` (migration 048); cada procedimento tem badge de status clicável (pendente → agendado → concluído); cabeçalho de seção ganhou select de status e input de data estimada (migration 049); image picker renomeado para "Buscar da aba Documentos".
- **Modal Novo Agendamento redesenhado** — layout dois colunas (`max-w-2xl`); campo "Procedimento" removido; coluna esquerda com busca de paciente, seletor de dentista (secretária) e observações; coluna direita com data, hora, duração e card resumo visual.
- **Notificações secretária ↔ dentista auditadas** — fluxos de `orcamentos/actions.ts`, `financeiro/actions.ts` e `whatsapp/message-handler.ts` verificados; `para_dentista_id` e `para_role` funcionando corretamente em todos os caminhos.

### Módulo Secretária — Blocos 1–5 (2026-04-30)
- **Bloco 1** — Dashboard da secretária: métricas do dia, agenda de hoje com filtro por dentista, ações rápidas, resumo por dentista.
- **Bloco 2** — Agenda multi-dentista: filtro por dentista como tabs/pills em agendamentos e no dashboard; botão "Chegou!" para check-in rápido; status `na_recepcao` e `em_atendimento` adicionados ao `StatusAgendamento`.
- **Bloco 3** — Assinatura na recepção: `AssinaturaRecepcaoModal` com pad de assinatura (signature_pad), `assinatura-actions.ts` (service role, busca ficha + upload PNG), botão "Assinar" nos cards do dashboard e da agenda.
- **Bloco 4** — Data de vencimento nos pagamentos: campo `data_vencimento` no formulário; parcelas futuras → `status=pendente`; display Pago/Pendente/Vencido + datas; alerta âmbar de vencimentos no dashboard da secretária.
- **Bloco 5** — Perfil do paciente restrito para secretária: abas Fichas Clínicas e Planejamento ocultas; queries de fichas puladas; "Atividade Recente" e "Iniciar consulta" gateados por `showClinicalTabs`.
- Bugs secretária resolvidos: paciente órfão, dois links WhatsApp na sidebar, criar orçamentos, seletor de dentista em orçamentos, notificação ao dentista em lançamentos financeiros, filtro de dentista, permissões de fichas clínicas, persistência de seletor no financeiro.
- Pagamentos: geração automática ao aprovar orçamento; conciliação básica com `marcado_por_id` (migration 046).
- WhatsApp connect Sheet na sidebar para secretária conectar instância Evolution API.

### Anteriores
- Fix PGRST201 — agendamentos não apareciam por FK ambígua com `created_by`
- DEX desativado temporariamente (widget + onboarding comentados)
- Assinatura digital do paciente na FichasTab (`signature_pad`)
- Migration `045_fichas_assinatura` — colunas `assinatura_url` e `assinado_em`
- Fix de performance RLS — `(select auth.uid())` em 17 políticas
- 8 índices criados em FKs sem cobertura; 3 índices duplicados removidos
