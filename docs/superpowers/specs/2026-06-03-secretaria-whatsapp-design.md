# Spec: Secretaria Operacional + WhatsApp Official API
**Data:** 2026-06-03  
**Status:** Aprovado

---

## 1. Contexto

A secretária é o papel operacional da clínica. Ela não participa da parte clínica nem da criação de propostas comerciais — garante que o fluxo diário roda: agenda, cadastro de pacientes, recebimento de pagamentos e supervisão do bot de WhatsApp.

O sistema hoje tem permissões incorretas na UI (secretária vê botão de "Novo Orçamento" que o banco já bloqueia) e falta o fluxo de "Registrar Recebimento" vinculado a orçamentos. O WhatsApp precisa migrar da integração via QR code para a API Oficial da Meta.

---

## 2. Papel da Secretária — Mapa de Acesso

### ✅ PODE

| Módulo | Ações |
|---|---|
| **Agenda** | Criar, editar, cancelar, encaixe, confirmar, check-in, no-show — todos os dentistas da clínica |
| **Pacientes** | Cadastrar (obrigatório vincular a dentista), editar dados de contato, follow-up |
| **Orçamentos** | Ver lista (com dentista visível), ver detalhe, **alterar status**, registrar pagamento em orçamentos aprovados |
| **Financeiro** | Lançar despesas, lançar receita manual, **Registrar Recebimento** (fluxo novo) |
| **Fichas — Clínico** | Leitura apenas (queixas, procedimentos realizados) |
| **Fichas — Documentos** | Upload, download, recolher assinatura do paciente |
| **WhatsApp** | Supervisionar conversas, revisar comprovantes, assumir conversa manualmente |

### ❌ NÃO PODE

| Ação | Observação |
|---|---|
| Criar orçamento | Banco já bloqueia (RLS); UI precisa remover os botões |
| Criar / editar ficha clínica | Somente dentista/admin |
| Iniciar consulta | Somente dentista |
| Tratamento / Planejamento | Somente dentista/admin |
| Configurações, Bot config, Admin | Já bloqueado |

---

## 3. Mudanças na UI — Secretaria

### 3.1 Remover "Novo Orçamento"
- `src/app/dashboard/orcamentos/page.tsx:104` — remover `|| dentista.role === 'secretaria'` do `canEdit`
- `src/app/dashboard/pacientes/[id]/_components/paciente-detail-client.tsx:1315` — adicionar guard `role !== 'secretaria'` no botão

### 3.2 Novo Paciente — vincular dentista obrigatório
- `src/app/dashboard/pacientes/novo/_components/novo-paciente-form.tsx` — adicionar `<Select>` de dentista (busca dentistas ativos da clínica)
- `src/app/dashboard/pacientes/novo/actions.ts` — incluir `dentista_id` no INSERT

### 3.3 Fichas — acesso parcial para secretária
- Separar `showClinicalTabs` em dois flags:
  - `canViewClinical = true` para todos (secretária lê fichas)
  - `canWriteClinical = role === 'admin' || role === 'dentista'`
- Aba "Ficha Clínica" visível para secretária: mostrar conteúdo em modo leitura, sem botão "Nova Ficha"
- Aba "Documentos": visível para todos, upload/download/assinatura liberados
- Aba "Tratamento / Planejamento": oculta para secretária (sem mudança)

### 3.4 Sidebar — adicionar Orçamentos
- `src/components/layout/sidebar-content.tsx` — adicionar item `Orçamentos` no grupo `GESTÃO` (após Financeiro), visível para todos os roles

### 3.5 Dashboard — remover pendências de orçamento parado
- `src/app/dashboard/page.tsx` (ou server component que monta `pendencias`) — filtrar fora `tipo === 'orcamento_parado'` quando `role === 'secretaria'`

### 3.6 Orçamentos — dentista mais visível na lista
- `src/app/dashboard/orcamentos/_components/orcamentos-client.tsx` — garantir coluna/campo do dentista responsável visível na tabela

### 3.7 Financeiro — "Registrar Recebimento" (fluxo novo)
Nova ação primária no Financeiro para secretária:

**Fluxo do modal:**
1. Buscar paciente (autocomplete por nome)
2. Exibir dentista do paciente (automático pelo `dentista_id` do paciente)
3. Listar orçamentos pendentes do paciente (status `aprovado` com `pagamentos` em aberto)
4. Secretária seleciona qual orçamento foi pago
5. Preenche: valor, forma de pagamento, data
6. Ao confirmar: cria registro em `pagamentos` (vinculado ao orçamento) + cria `receita_manual` (registro financeiro)

**Arquivos:**
- `src/app/dashboard/financeiro/_components/financeiro-client.tsx` — botão "Registrar Recebimento" + modal
- `src/app/dashboard/financeiro/actions.ts` — nova action `registrarRecebimento()`

---

## 4. WhatsApp Official API — Estrutura

### 4.1 Substituição
A integração via QR code (Evolution API) é completamente substituída pela WhatsApp Business Cloud API da Meta. A estrutura de tabelas existente (`bot_config`, `instancias_whatsapp`, `conversas_bot`, `mensagens_bot`) é mantida e estendida.

### 4.2 Endpoints de Backend

```
POST /api/webhooks/whatsapp     — recebe mensagens/eventos da Meta
GET  /api/webhooks/whatsapp     — verificação do webhook (Meta exige GET com hub.challenge)
POST /api/whatsapp/send         — envia mensagem para número
POST /api/whatsapp/media        — processa imagem recebida (comprovantes)
```

### 4.3 Configuração — Admin/Dentista

Campos novos em `bot_config`:
- `waba_id` — WhatsApp Business Account ID
- `phone_number_id` — Business Phone Number ID  
- `access_token` — Meta App Token (armazenar criptografado)
- `webhook_verify_token` — token para verificação do webhook
- `dentistas_ativos_bot` — array de dentista_ids disponíveis para seleção pelo paciente
- `template_orcamento` — template de mensagem para envio de orçamento
- `bot_ativo` — habilita/desabilita o bot

### 4.4 Fluxos do Bot (máquina de estados)

#### Estado: `cadastro`
```
[entrada] → saudação + "Qual dentista você prefere?"
           → botões interativos: um por dentista ativo no bot
[dentista escolhido] → "Seu nome completo:"
[nome] → "Celular (com DDD):"
[telefone] → "Data de nascimento (DD/MM/AAAA):"
[data_nasc] → cria paciente vinculado ao dentista
             → "Cadastro feito! Quer agendar uma consulta?" [Sim] [Não]
```

#### Estado: `agendamento`
```
[entrada] → busca slots disponíveis do dentista (próximos 7 dias)
          → lista interativa com datas
[data] → lista de horários disponíveis
[horário] → confirma dados
[confirmação] → cria agendamento no sistema
             → envia mensagem de confirmação com data/hora/dentista
```

#### Estado: `orcamento`
```
[dentista marca orçamento "Enviar via WhatsApp"] → bot envia PDF + resumo
[paciente responde] → [Aprovar] → atualiza status para 'aprovado'
                   → [Recusar]  → atualiza status para 'recusado'
                   → [Dúvida]   → encaminha para secretária (estado: 'humano')
```

#### Estado: `pagamento`
```
[paciente envia imagem] → OCR/IA extrai: valor, chave PIX destino
                       → busca pagamentos pendentes do paciente
                       → se valor bate: registra pagamento + notifica secretária ✓
                       → se não bate:  notifica secretária para revisão manual
```

#### Estado: `humano`
```
Bot desativado para a conversa. Secretária responde diretamente.
[secretária clica "Devolver para o bot"] → retorna ao estado anterior
```

### 4.5 Supervisão — Secretária

**Página `/dashboard/whatsapp`** (já existe, refinar):
- Lista de conversas com badge de status: `bot`, `aguardando`, `pagamento pendente`, `humano`
- Notificação destacada para comprovantes aguardando revisão
- Painel de confirmação de pagamento: imagem do comprovante + paciente + valor extraído + botões "Confirmar pagamento" / "Recusar"
- Botão "Assumir conversa" em cada card

### 4.6 Migrações de Banco

```sql
-- conversas_bot: estado da máquina + vínculo ao paciente
ALTER TABLE conversas_bot 
  ADD COLUMN IF NOT EXISTS estado text DEFAULT 'cadastro',
  ADD COLUMN IF NOT EXISTS paciente_id uuid REFERENCES pacientes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS dentista_id uuid REFERENCES dentistas(id) ON DELETE SET NULL;

-- mensagens_bot: suporte a mídia (comprovantes)
ALTER TABLE mensagens_bot
  ADD COLUMN IF NOT EXISTS media_url text,
  ADD COLUMN IF NOT EXISTS media_type text;  -- 'image', 'document', 'audio'

-- pagamentos: rastreamento de comprovante
ALTER TABLE pagamentos
  ADD COLUMN IF NOT EXISTS comprovante_url text,
  ADD COLUMN IF NOT EXISTS verificado_automaticamente boolean DEFAULT false;

-- bot_config: campos para API Oficial (substitui QR code)
ALTER TABLE bot_config
  ADD COLUMN IF NOT EXISTS waba_id text,
  ADD COLUMN IF NOT EXISTS phone_number_id text,
  ADD COLUMN IF NOT EXISTS access_token text,
  ADD COLUMN IF NOT EXISTS webhook_verify_token text,
  ADD COLUMN IF NOT EXISTS dentistas_ativos_bot uuid[],
  ADD COLUMN IF NOT EXISTS template_orcamento text,
  ADD COLUMN IF NOT EXISTS bot_ativo boolean DEFAULT false;
```

---

## 5. Ordem de Implementação

### Sprint A — Correções da Secretária (sem WhatsApp)
1. Remover "Novo Orçamento" da UI (2 arquivos)
2. Novo Paciente: vincular dentista obrigatório
3. Fichas: split de `showClinicalTabs` → acesso parcial secretária
4. Sidebar: adicionar Orçamentos no grupo GESTÃO
5. Dashboard: remover pendências de orçamento parado para secretária
6. Orçamentos: dentista visível na lista
7. Financeiro: modal "Registrar Recebimento"

### Sprint B — WhatsApp Official API
1. Migração de banco (migration SQL)
2. Webhook endpoint (GET + POST)
3. Engine de envio de mensagens (HTTP client Meta API)
4. Máquina de estados do bot (arquivo de lógica isolado)
5. Fluxo: cadastro de paciente
6. Fluxo: agendamento
7. Fluxo: pagamento via comprovante (OCR/IA)
8. Fluxo: envio de orçamento (trigger no sistema)
9. Configuração UI — Admin (atualizar `whatsapp-config-client.tsx`)
10. Supervisão UI — Secretária (atualizar `whatsapp-client.tsx`)

---

## 6. Consistência de Design

Todas as mudanças seguem o design system existente:
- Tokens: `bg-surface`, `text-text-primary`, `text-teal`, `border-border`
- Sem cores hardcoded
- Dark mode obrigatório
- Animações via Framer Motion onde houver estados visuais
- Drawers para formulários longos, Dialogs para confirmações curtas
