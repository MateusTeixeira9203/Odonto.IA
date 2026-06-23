# Sprint 3 — Roadmap Completo
**Data:** 2026-06-02  
**Fase:** Produto Operacional — Consulta, Convites, Secretaria, Dex, Notificações  
**Estimativa total:** ~17h  

---

## Contexto: O que já existe

| Área | O que está feito |
|------|-----------------|
| Modo Consulta | `consulta-client.tsx` (581 linhas) com odontograma, gravação de áudio, API `/dex/formatar-evolucao`, sidebar clínico, dialog de finalização |
| Convites | `POST /api/convite` cria link, `DELETE /api/convite/[id]` cancela. Sem página de aceite. |
| Secretaria | Acesso à agenda, check-in, no-show, cancel, filtro por dentista. Sem dashboard próprio nem relatório diário. |
| Dex | `DexWidget` (chatbot flutuante), `DexLoader` (spinner premium), 10+ endpoints IA. Não integrado no fluxo de consulta. |
| Notificações | Tabela `notificacoes`, `notification-bell.tsx` (badge + painel + mark-as-read), API `/api/dex/alerts` com polling 90s. Sem Realtime, sem timestamps, tipos incompletos. |

---

## Ordem de Execução

```
Sprint 3.1 — Modo Consulta          ~4h 30min   (maior valor, core do produto)
Sprint 3.2 — Convites + Onboarding  ~2h 30min   (desbloqueador de crescimento)
Sprint 3.3 — Secretaria             ~3h 30min   (retenção da secretária)
Sprint 3.4 — Dex Profundo           ~3h 30min   (diferencial competitivo)
Sprint 3.5 — Notificações           ~3h         (infraestrutura de comunicação)
```

**Dependências:**
- Sprint 3.4 depende de Sprint 3.1 (Dex se integra na consulta)
- Sprint 3.5 depende de Sprint 3.3 (novos tipos de notificação para secretária)
- Sprints 3.2 e 3.3 são independentes, podem rodar em paralelo

---

## Sprint 3.1 — Modo Consulta

**Arquivo principal:** `src/app/consulta/[agendamentoId]/_components/consulta-client.tsx`  
**Objetivo:** Tornar o fluxo consulta → captura → IA → ficha clínica completamente fluido e visualmente premium.  
**Tempo:** ~4h 30min

### Bloco 1.1 — Audit + mapeamento do estado atual (~30min)
Ler `consulta-client.tsx` completo e mapear:
- Estado do fluxo de gravação (botão gravar → transcrição → estruturação IA)
- Como o DexLoader está sendo usado (ou não) durante o processamento
- Como o resultado da IA é apresentado para o dentista
- Como a ficha é salva ao finalizar

**Critério de saída:** Mapa mental dos 3 estados principais (gravando / processando IA / revisando resultado)

### Bloco 1.2 — Header da Consulta (~25min)
**Arquivo:** `consulta-client.tsx`

Criar header premium consistente com o restante do sistema:
```
[← Voltar]     [Nome do Paciente — Idade — Dente selecionado]     [Iniciar / Pausar / Finalizar]
```

- Badge de status do agendamento (em atendimento / concluído)
- Botão "Finalizar Consulta" com gradiente teal + shadow
- Responsivo: em mobile o header colapsa para 2 linhas

### Bloco 1.3 — Fluxo de Captura com DexLoader (~45min)
**Arquivo:** `consulta-client.tsx`

O processamento IA (após gravar ou digitar) deve usar o `DexLoader` ao invés de spinner genérico:

```typescript
// Estados visuais:
idle        → botão "Gravar" ou textarea
recording   → animação pulse + timer
processing  → <DexLoader label="Organizando anotações..." />
reviewing   → resultado IA exibido para revisão
saved       → chip de confirmação + botão "Nova anotação"
```

**Regra:** Nunca salvar direto sem mostrar o resultado para o dentista revisar.

Imports necessários:
```typescript
import { DexLoader } from '@/components/ui/dex-loader';
```

### Bloco 1.4 — Card de Resultado IA (~35min)
**Arquivo:** `consulta-client.tsx`

Quando a IA retorna `EvolucaoFormatada`, exibir um card de revisão antes de salvar:

```tsx
<motion.div
  initial={{ opacity: 0, y: 8 }}
  animate={{ opacity: 1, y: 0 }}
  className="rounded-2xl border border-teal/25 p-4 space-y-3"
  style={{ background: 'color-mix(in srgb, var(--color-teal) 6%, var(--color-surface))' }}
>
  {/* Queixa Principal */}
  <div>
    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-teal mb-1">Queixa Principal</p>
    <p className="text-sm text-text-primary">{resultado.queixa_principal}</p>
  </div>
  {/* Anotações */}
  {/* Dentes afetados como chips */}
  {/* Botões: Salvar / Editar / Descartar */}
</motion.div>
```

Permitir edição inline dos campos antes de salvar.

### Bloco 1.5 — Sidebar Clínica (~40min)
**Arquivo:** `consultation-sidebar.tsx`

Verificar e polir a sidebar:
- Alertas clínicos em destaque no topo (alergia = coral, medicamento = amber)
- Fichas anteriores colapsáveis (último registro expandido)
- Orçamentos pendentes com valor total
- Botão rápido "Ver Ficha Completa" → `/dashboard/pacientes/[id]`

### Bloco 1.6 — Dialog de Finalização (~35min)
**Arquivo:** `finalize-consultation-dialog.tsx`

O dialog deve ter 2 passos:

**Passo 1 — Confirmar fichas salvas:**
- Lista das evoluções registradas na consulta atual
- Status de cada uma (salva / pendente)
- Aviso se nenhuma ficha foi registrada

**Passo 2 — Próximos passos:**
- Gerar orçamento automaticamente (link direto)
- Agendar retorno (abre drawer de novo agendamento pré-preenchido)
- Enviar mensagem WhatsApp (BotaoMensagemIA)
- Apenas "Concluir" como ação principal

### Bloco 1.7 — Layout geral + dark mode (~25min)
**Arquivo:** `consulta-client.tsx`

- Container: `max-w-6xl mx-auto p-4 sm:p-6`
- Grid: `grid grid-cols-1 lg:grid-cols-3 gap-6` (2/3 conteúdo + 1/3 sidebar)
- Em mobile: sidebar colapsa para um drawer na parte inferior
- Verificar dark mode em todos os estados

**Verificação pós-sprint:**
```bash
npx tsc --noEmit
```
- [ ] Gravação → DexLoader → card de resultado funciona
- [ ] Card de resultado permite edição antes de salvar
- [ ] Dialog de finalização tem os 2 passos
- [ ] Dark mode sem regressão
- [ ] TypeScript sem erros

---

## Sprint 3.2 — Fluxo de Convites + Onboarding

**Objetivo:** Tornar o fluxo completo — desde o envio do convite até o novo membro ativo na clínica.  
**Tempo:** ~2h 30min

### Contexto atual
O convite gera um link com token. Não há página de aceite — o novo usuário provavelmente vai para o onboarding genérico. Não há confirmação visual premium no envio.

### Bloco 2.1 — Página de aceite do convite (~50min)
**Arquivo novo:** `src/app/(auth)/aceitar-convite/page.tsx`  
**URL:** `/aceitar-convite?token=xxx`

Fluxo:
1. Verificar token na tabela `convites` (válido / expirado / já usado)
2. Se válido → exibir: nome da clínica, papel convidado, formulário de cadastro (nome + senha)
3. Se expirado → tela de erro com botão "Solicitar novo convite"
4. Ao confirmar → criar conta, vincular à clínica, redirecionar para `/dashboard`

Design: layout 2 colunas (painel teal com logo Odonto.IA + formulário), igual ao login premium.

### Bloco 2.2 — Email de convite transacional (~30min)
**Arquivo:** `src/services/invites.ts` (ou onde `criarConvite()` é chamado)

Template HTML do email com:
- Logo Odonto.IA
- "Você foi convidado para a clínica [Nome]"
- Papel: [Dentista / Secretária]
- Botão CTA "Aceitar convite"
- Validade: 7 dias
- Supabase Auth trigger ou `resend` SDK

### Bloco 2.3 — UX de envio no modal (~20min)
**Arquivo:** `usuarios-client.tsx`

Após enviar convite com sucesso:
- Animação de "envelope enviado" (ícone de Send com motion)
- Chip do email na lista de pendentes aparece com motion.animate
- Toast mais descritivo: "Convite enviado! [email] tem 7 dias para aceitar."

### Bloco 2.4 — Onboarding do novo membro (~50min)
**Arquivo:** `src/app/onboarding/page.tsx` (verificar se existe)

Após aceitar o convite e criar conta, o novo membro (dentista ou secretária) vê um onboarding de 3 telas:

**Tela 1:** "Bem-vindo à [Nome da Clínica]!" — avatar + nome do admin que convidou
**Tela 2:** Completar perfil (foto, CRO se dentista)
**Tela 3:** Tour rápido das funcionalidades principais (3 cards: Agenda, Pacientes, Consulta)

**Verificação:**
- [ ] Token inválido → tela de erro correta
- [ ] Token válido → cadastro funciona e usuário aparece na lista de membros
- [ ] Email chega com link funcional
- [ ] Onboarding aparece apenas na primeira vez

---

## Sprint 3.3 — Secretaria

**Objetivo:** A secretária tem um produto diferente do dentista — ela precisa de ferramentas de gestão operacional, não clínica.  
**Tempo:** ~3h 30min

### Bloco 3.1 — Dashboard da Secretária (~50min)
**Arquivo:** `src/app/dashboard/page.tsx` + `src/components/dashboard/`

O Dashboard atual é voltado para o dentista (receita, procedimentos, etc.). Para secretária, criar uma variante com foco operacional:

```
┌─────────────────────────────────────────────────────────┐
│  Hoje — [data]                         [Novo Agendamento]│
├──────────────┬──────────────┬──────────────┬────────────┤
│  Consultas   │  Confirmados │  Na Recepção │  Faltaram  │
│  Hoje: 8     │  5           │  2           │  1         │
└──────────────┴──────────────┴──────────────┴────────────┘
│  Timeline do dia — próximas consultas em ordem          │
│  [09:00] João Silva — Confirmado                        │
│  [10:30] Ana Costa — Na Recepção ← ação rápida         │
└─────────────────────────────────────────────────────────┘
```

Separar a lógica: se `role === 'secretaria'`, renderizar `DashboardSecretaria` em vez do dashboard do dentista.

### Bloco 3.2 — Timeline do dia na agenda (~40min)
**Arquivo:** `day-view.tsx`

Melhorar a view de dia com:
- Linha "agora" em tempo real (useEffect com setInterval a cada minuto)
- Chip de contagem ao lado dos botões rápidos: "3 pendentes confirmação"
- Cor de fundo diferente para consultas em andamento vs agendadas

### Bloco 3.3 — Check-in rápido na recepção (~35min)
**Arquivo:** `month-view.tsx` + `day-view.tsx`

Criar um painel de "Recepção" acessível pela agenda quando há pacientes em estado `scheduled` ou `confirmed`:

```
┌─ Pacientes aguardando ────────────────────────────────┐
│ [MT] João Silva  09:00  Confirmado   [Chegou!] [Faltou]│
│ [AC] Ana Costa   10:30  Agendado     [Chegou!] [Faltou]│
└───────────────────────────────────────────────────────┘
```

Ações com 1 clique (sem abrir modal). Feedback visual imediato com `toast.success`.

### Bloco 3.4 — Relatório diário (~35min)
**Arquivo novo:** `src/app/dashboard/relatorio/_components/relatorio-client.tsx`

Página `/dashboard/relatorio` com relatório do dia:
- Total de consultas: realizadas / canceladas / faltaram
- Lista detalhada com horário, paciente, dentista, status
- Filtro por dentista (se secretária multi-dentista)
- Botão de exportar como CSV (download simples)
- Acessível no floating dock da secretária

### Bloco 3.5 — Notificações inteligentes (~30min)
**Arquivo:** `notification-bell.tsx`

Alertas automáticos relevantes para a secretária:
- "3 consultas de amanhã sem confirmação — enviar lembrete?"
- "Convite para [email] expira em 24h"
- "Pagamento pendente: [Paciente] — orçamento aprovado há 7 dias"

CTA direto em cada notificação (botão que executa a ação).

**Verificação:**
- [ ] Role `secretaria` vê dashboard operacional, não clínico
- [ ] Linha "agora" funciona em tempo real
- [ ] Check-in com 1 clique funciona sem abrir modal
- [ ] Relatório diário exibe dados corretos
- [ ] Export CSV funciona

---

## Sprint 3.4 — Dex Profundo

**Objetivo:** O Dex para de ser "mais um chatbot" e se torna a identidade inteligente operacional — presente onde a IA trabalha, não só quando o usuário pede.  
**Tempo:** ~3h 30min

### Princípio guia
> O Dex não deve ser invocado. Ele deve aparecer quando o sistema está fazendo algo inteligente.

### Bloco 4.1 — DexLoader Universal na Consulta (~35min)
**Arquivo:** `consulta-client.tsx`

Substituir todos os spinners genéricos durante processamento de IA:

```typescript
// Estados com mensagens contextuais do Dex
const DEX_MENSAGENS = {
  transcrevendo: 'Transcrevendo áudio...',
  formatando:    'Organizando anotações clínicas...',
  salvando:      'Salvando na ficha do paciente...',
  gerando:       'Gerando planejamento...',
} as const;
```

```tsx
{estado === 'processing' && (
  <DexLoader label={DEX_MENSAGENS[subEstado]} size="lg" />
)}
```

### Bloco 4.2 — Rebrand: "Gerar com Dex" (~25min)
**Arquivos:** Todos que têm botões "Gerar com IA" ou "Gerar Planejamento"
- `src/components/pacientes/PlanejamentoTab.tsx`
- `src/app/dashboard/orcamentos/_components/orcamentos-client.tsx`
- Qualquer outro com texto "IA" em botões

Substituição:
```tsx
// ANTES
<Button>✦ Gerar com IA</Button>

// DEPOIS — com logo Dex (bolinha teal animada)
<Button>
  <span className="w-3.5 h-3.5 rounded-full bg-teal animate-pulse shrink-0" />
  Gerar com Dex
</Button>
```

### Bloco 4.3 — Dex Briefing no Dashboard (~50min)
**Arquivo novo:** `src/components/dashboard/dex-briefing.tsx`

Card no Dashboard que aparece no início do dia com contexto inteligente:

```
┌─ Dex ────────────────────────────────────────────────────┐
│  ● Bom dia, Dr. Mateus.                                  │
│                                                          │
│  Hoje você tem 6 consultas — 4 confirmadas, 2 pendentes. │
│  João Silva (09:00) tem alergia a penicilina. ⚠️         │
│  3 orçamentos aguardam resposta há mais de 7 dias.       │
│                                               [Ver mais] │
└──────────────────────────────────────────────────────────┘
```

**API:** `GET /api/dex/briefing` (já existe) → adaptar para retornar dados estruturados  
**Renderização:** Streaming de texto (effect de digitação) com `useEffect` + intervalo  
**Aparece apenas:** Entre 06:00 e 14:00 (horário de abertura da clínica)

### Bloco 4.4 — Dex no Planejamento (~45min)
**Arquivo:** `PlanejamentoTab.tsx`

Quando o dentista clica "Gerar com Dex", substituir o loader atual por:

1. Painel lateral abre com DexLoader animado
2. Texto streamado aparece enquanto o planejamento é gerado
3. Ao completar, transição suave para o resultado
4. Botão "Aceitar plano" com `CheckCircle2 teal`

Implementação do streaming:
```typescript
// Usar ReadableStream da API ou simular com chunks
const stream = await fetch('/api/dex/planejamento', { method: 'POST', body: ... });
const reader = stream.body!.getReader();
// Ler chunks e atualizar estado progressivamente
```

### Bloco 4.5 — DexLoader no Orçamento por Voz (~25min)
**Arquivo:** `orcamentos-client.tsx` (se houver geração de orçamento por IA)

Garantir que qualquer geração de orçamento via IA usa:
```tsx
{gerandoOrcamento && <DexLoader label="Calculando orçamento..." />}
```

### Bloco 4.6 — Polir DexWidget (Chatbot) (~30min)
**Arquivo:** `dex-widget.tsx`

O chatbot existente precisa de polish:
- Substituir placeholder do chat por sugestões contextuais (baseadas na página atual)
- Na página de paciente: "Resumir histórico clínico", "Listar pendências"
- Na agenda: "O que tenho hoje?", "Confirmar próximas consultas"
- Animação de entrada mais suave (`zoom-in-95`)
- Botão de fechar mais visível

**Verificação final Sprint 3.4:**
- [ ] DexLoader aparece em todos os processamentos IA (sem spinner genérico)
- [ ] Botões "Gerar com IA" → "Gerar com Dex" em todos os módulos
- [ ] Dex Briefing aparece no Dashboard entre 06:00-14:00
- [ ] Streaming do planejamento funciona
- [ ] DexWidget tem sugestões contextuais por página

---

## Sprint 3.5 — Notificações

**Objetivo:** Transformar o sino de um polling de 90s em um sistema de comunicação em tempo real, com timestamps, agrupamento e novos tipos que cobrem o ciclo completo do atendimento.  
**Tempo:** ~3h  

### Diagnóstico atual

| Aspecto | Status | Impacto |
|---------|--------|---------|
| Tabela + API + UI | ✅ Funciona | — |
| Realtime (WebSocket) | ❌ Ausente | **Alto** — secretária vê check-in 90s depois |
| Timestamps no painel | ❌ Ausente | Médio — não sabe se notif é de agora ou ontem |
| Tipos: check-in, consulta finalizada, novo agendamento via bot | ❌ Ausente | Alto |
| Agrupamento por tipo | ❌ Ausente | Médio — 8 notifs do mesmo tipo poluem |
| Soft delete / histórico | ❌ Ausente | Baixo |

### Bloco 5.1 — Realtime via Supabase (~45min)
**Arquivo:** `src/components/layout/notification-bell.tsx`

Substituir o polling de 90s por subscription Supabase Realtime:

```typescript
// Dentro do useEffect de inicialização
const channel = supabase
  .channel('notificacoes-realtime')
  .on(
    'postgres_changes',
    {
      event: 'INSERT',
      schema: 'public',
      table: 'notificacoes',
      filter: `para_dentista_id=eq.${meuDentistaId}`,
    },
    (payload) => {
      // Nova notificação chegou — adicionar à lista local + tocar som leve
      const nova = mapNotificacaoToAlert(payload.new);
      setAlerts(prev => [nova, ...prev]);
      // Badge anima automaticamente (motion já está no componente)
    }
  )
  .subscribe();

return () => { void supabase.removeChannel(channel); };
```

**Props adicionadas:** `meuDentistaId: string` — passar do layout que já tem o dentista logado.

Manter o polling de 90s como **fallback** (caso o WebSocket caia), mas reduzir para 5 minutos.

### Bloco 5.2 — Timestamps + agrupamento no painel (~40min)
**Arquivo:** `notification-bell.tsx`

Adicionar `created_at` ao tipo `DexAlert` e exibir tempo relativo:

```typescript
// Helper de tempo relativo
function tempoRelativo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return 'agora';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}min atrás`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h atrás`;
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}
```

Exibir no card de cada notificação:
```tsx
<div className="flex items-center justify-between">
  <p className="text-xs font-semibold text-white leading-snug">{alert.title}</p>
  <span className="text-[10px] text-white/30 font-mono shrink-0 ml-2">
    {alert.createdAt ? tempoRelativo(alert.createdAt) : ''}
  </span>
</div>
```

**Agrupamento:** Se houver 3+ notificações do mesmo tipo, colapsar:
```tsx
// Ex: "5 orçamentos aguardando resposta" em vez de 5 cards separados
{grupo.length > 1 && (
  <span className="text-[10px] text-white/40 ml-auto">{grupo.length}x</span>
)}
```

### Bloco 5.3 — Novos tipos de notificação (~55min)
**Arquivo:** `src/lib/notificacoes.ts` + arquivos de actions correspondentes

Adicionar ao `TipoNotificacao`:
```typescript
export type TipoNotificacao =
  | 'orcamento_gerado'
  | 'orcamento_enviado'
  | 'follow_up'
  | 'briefing'
  | 'sistema'
  // Novos:
  | 'checkin_paciente'       // Paciente chegou na recepção
  | 'consulta_finalizada'    // Dentista finalizou consulta
  | 'agendamento_criado'     // Novo agendamento (especialmente via bot)
  | 'agendamento_cancelado'  // Paciente cancelou
  | 'pagamento_confirmado';  // Pagamento registrado no financeiro
```

**Onde inserir cada tipo:**

| Tipo | Arquivo | Quem recebe | Trigger |
|------|---------|-------------|---------|
| `checkin_paciente` | `agendamentos/actions.ts` → `fazerCheckIn()` | dentista | Quando secretária faz check-in |
| `consulta_finalizada` | `consulta/actions.ts` → `finalizarConsulta()` | secretaria | Quando dentista finaliza |
| `agendamento_criado` | `agendamentos/actions.ts` → `criarAgendamento()` | dentista (se criado pela secretária) | Novo agendamento manual |
| `agendamento_cancelado` | `agendamentos/actions.ts` → `cancelarComMotivo()` | dentista | Qualquer cancelamento |
| `pagamento_confirmado` | `financeiro/actions.ts` | dentista específico | Lançamento de entrada |

Exemplo de implementação em `fazerCheckIn()`:
```typescript
// Após atualizar status para 'checked_in'
await inserirNotificacao(supabase, {
  clinicaId,
  paraRole: 'dentista',
  paraDentistaId: agendamento.dentista_id,
  tipo: 'checkin_paciente',
  titulo: `${agendamento.paciente.nome} chegou`,
  mensagem: `Consulta das ${format(parseISO(agendamento.data_hora), 'HH:mm')} — paciente na recepção`,
  href: `/dashboard/agendamentos`,
});
```

### Bloco 5.4 — Ícones contextuais por tipo (~20min)
**Arquivo:** `notification-bell.tsx` + `src/app/api/dex/alerts/route.ts`

Mapear cada tipo para um ícone Lucide específico (além do genérico ⚠️ / ℹ️):

```typescript
const TIPO_ICON: Record<TipoNotificacao, LucideIcon> = {
  checkin_paciente:    UserCheck,
  consulta_finalizada: Stethoscope,
  agendamento_criado:  CalendarPlus,
  agendamento_cancelado: CalendarX,
  pagamento_confirmado: CircleDollarSign,
  orcamento_gerado:    FileText,
  orcamento_enviado:   Send,
  follow_up:           Clock,
  briefing:            Bell,
  sistema:             Info,
};
```

Renderizar o ícone no lugar do genérico `AlertIcon`.

### Bloco 5.5 — Estado vazio + ações rápidas no painel (~20min)
**Arquivo:** `notification-bell.tsx`

**Estado vazio melhorado:**
```tsx
<div className="px-4 py-10 flex flex-col items-center gap-3">
  <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
    style={{ background: 'rgba(47,156,133,0.1)' }}>
    <Bell className="w-5 h-5 text-teal" />
  </div>
  <p className="text-xs font-semibold text-white/50">Tudo em dia</p>
  <p className="text-[11px] text-white/25 text-center max-w-[160px]">
    Nenhum alerta ou pendência no momento
  </p>
</div>
```

**Ação "Marcar todas como lidas"** (apenas quando há notificações `isNotif`):
```tsx
{unreadNotifCount > 0 && (
  <button
    onClick={markAllNotifsRead}
    className="text-[11px] text-teal/70 hover:text-teal transition-colors px-4 pb-2"
  >
    Marcar todas como lidas
  </button>
)}
```

**Verificação pós-sprint:**
```bash
npx tsc --noEmit
```
- [ ] Nova notificação aparece instantaneamente (sem esperar 90s)
- [ ] Timestamps mostram tempo relativo correto
- [ ] Check-in pela secretária → dentista recebe notif em ≤2s
- [ ] Consulta finalizada → secretária recebe notif
- [ ] Ícones corretos por tipo de notificação
- [ ] Estado vazio atualizado
- [ ] Dark mode sem regressão

---

## Resumo de Arquivos Modificados

| Arquivo | Sprint |
|---------|--------|
| `src/app/consulta/[agendamentoId]/_components/consulta-client.tsx` | 3.1 |
| `src/app/consulta/[agendamentoId]/_components/consultation-sidebar.tsx` | 3.1 |
| `src/app/consulta/[agendamentoId]/_components/finalize-consultation-dialog.tsx` | 3.1 |
| `src/app/(auth)/aceitar-convite/page.tsx` *(novo)* | 3.2 |
| `src/services/invites.ts` | 3.2 |
| `src/app/dashboard/configuracoes/usuarios/_components/usuarios-client.tsx` | 3.2 |
| `src/app/onboarding/page.tsx` | 3.2 |
| `src/app/dashboard/page.tsx` | 3.3 |
| `src/app/dashboard/agendamentos/_components/day-view.tsx` | 3.3 |
| `src/app/dashboard/agendamentos/_components/month-view.tsx` | 3.3 |
| `src/app/dashboard/relatorio/_components/relatorio-client.tsx` *(novo)* | 3.3 |
| `src/components/dashboard/dex-briefing.tsx` *(novo)* | 3.4 |
| `src/components/pacientes/PlanejamentoTab.tsx` | 3.4 |
| `src/components/layout/dex-widget.tsx` | 3.4 |
| `src/app/dashboard/orcamentos/_components/orcamentos-client.tsx` | 3.4 |
| `src/components/layout/notification-bell.tsx` | 3.5 |
| `src/lib/notificacoes.ts` | 3.5 |
| `src/app/api/dex/alerts/route.ts` | 3.5 |
| `src/app/dashboard/agendamentos/actions.ts` | 3.5 |
| `src/app/consulta/[agendamentoId]/actions.ts` | 3.5 |

---

## Checklist Final de Qualidade

```
Sprint 3.1 — Modo Consulta
[ ] Fluxo gravação → DexLoader → card de resultado → salvar funciona end-to-end
[ ] Dark mode sem regressão
[ ] TypeScript sem erros

Sprint 3.2 — Convites
[ ] Convite enviado → email chega com link correto
[ ] Link de aceite → cadastro → usuário na lista de membros
[ ] Onboarding aparece na primeira vez e não repete

Sprint 3.3 — Secretaria
[ ] Secretária vê dashboard operacional diferente do dentista
[ ] Check-in com 1 clique funciona
[ ] Relatório CSV exporta corretamente

Sprint 3.4 — Dex
[ ] Zero spinners genéricos em processamento IA
[ ] Briefing aparece no horário correto com dados reais
[ ] "Gerar com Dex" em todos os pontos de entrada IA

Sprint 3.5 — Notificações
[ ] Nova notificação via Realtime aparece em ≤2s (sem polling)
[ ] Timestamps relativos corretos no painel
[ ] Check-in → dentista notificado instantaneamente
[ ] Consulta finalizada → secretária notificada
[ ] Ícones contextuais por tipo (não só ⚠️ / ℹ️)
[ ] Agrupamento de notificações repetidas
```

---

## Notas de Execução

- Executar `npx tsc --noEmit` após cada bloco
- Sprints 3.2 e 3.3 podem ser executados em paralelo
- Sprint 3.4 é mais impactante depois do 3.1 (Dex na consulta = maior visibilidade)
- **Não alterar lógica de negócio** nos blocos de UI — somente visual e fluxo
- Commit por sprint concluído
