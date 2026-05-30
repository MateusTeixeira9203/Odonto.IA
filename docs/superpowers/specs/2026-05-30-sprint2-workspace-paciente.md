# Sprint 2 — Workspace do Paciente

**Data:** 2026-05-30  
**Status:** Aprovado  
**Escopo:** Elevação visual do workspace de pacientes — lista, perfil, ficha clínica. Sem novas funcionalidades. Sem alterações de regras de negócio.

---

## Contexto

Dashboard e Tratamento são as referências visuais do produto. Esta sprint eleva a lista de pacientes, o perfil do paciente e a ficha clínica ao mesmo nível de percepção visual — replicando princípios, não layouts.

**Princípios que fazem Dashboard e Tratamento funcionarem:**
- Cards bem definidos com `bg-surface rounded-2xl border border-border shadow-sm`
- Hierarquia em 3 níveis: título → dado principal → dado secundário
- Espaço em branco generoso (padding 24–32px, gap entre seções 24px)
- Informação agrupada por contexto, não listada flat
- CTAs com peso visual claro

---

## Padrões de referência (aplicar em toda a sprint)

Estes padrões são estabelecidos aqui e referenciados nas sprints 3A, 3B, 3C e 4.

| Elemento | Classe canônica |
|---|---|
| Card container | `bg-surface rounded-2xl border border-border shadow-sm` |
| Card padding compacto | `p-5` |
| Card padding padrão | `p-6` |
| Seção label | `text-[10px] font-bold uppercase tracking-widest text-text-secondary` |
| Dado principal numérico | `font-mono text-2xl font-bold text-text-primary` |
| Dado contextual | `text-sm font-semibold text-text-primary` |
| Dado secundário | `text-xs text-text-secondary` |
| CTA primário | `variant="brand"` |
| CTA secundário | `variant="outline"` |
| Ação terciária | `variant="ghost"` |
| Ícone container | `w-8 h-8 rounded-xl bg-teal/10 flex items-center justify-center` |
| Badge de status | `text-[10px] font-bold uppercase px-2 py-0.5 rounded-full` |
| Row hover | `hover:bg-surface-alt/50 transition-colors cursor-pointer` |
| Empty state icon | `w-12 h-12 rounded-2xl bg-surface-alt border border-border flex items-center justify-center` |

---

## Módulo 1 — Lista de Pacientes

**Arquivo principal:** `src/app/dashboard/pacientes/page.tsx`  
**Componentes afetados:** `src/app/dashboard/pacientes/_components/pacientes-list.tsx`, `src/components/pacientes/pacientes-table.tsx`

### 1.1 Header

```
Pacientes                                          [+ Novo Paciente ▶]
Workspace de pacientes da clínica · 142 registros
```

- Título: `font-heading font-bold text-3xl md:text-4xl text-text-primary`
- Descrição: `text-text-secondary text-sm font-medium` — dinâmica, inclui o total do count via prop
- CTA: `variant="brand"` com ícone Plus
- Layout: `flex items-start justify-between gap-4 mb-6`

### 1.2 Métricas strip

Quatro cards em linha entre o header e a tabela. Queries paralelas no servidor.

```
┌─────────────┬─────────────┬─────────────┬─────────────┐
│ 📋  142     │ ✦  8        │ ↻  34       │ 🔔  5       │
│ Total       │ Novos       │ Em          │ Follow-ups  │
│ Pacientes   │ este mês    │ tratamento  │ pendentes   │
└─────────────┴─────────────┴─────────────┴─────────────┘
```

**Estrutura de cada card:**
```tsx
<div className="bg-surface rounded-2xl border border-border shadow-sm p-5 flex items-center gap-4">
  <div className="w-10 h-10 rounded-xl bg-{color}/10 flex items-center justify-center shrink-0">
    <Icon className="w-5 h-5 text-{color}" />
  </div>
  <div>
    <div className="font-mono text-2xl font-bold text-text-primary leading-none">{valor}</div>
    <div className="text-xs text-text-secondary font-medium mt-1">{label}</div>
  </div>
</div>
```

**Cores por métrica:**
- Total: `text-teal / bg-teal/10`
- Novos este mês: `text-teal / bg-teal/10`
- Em tratamento: `text-teal / bg-teal/10`
- Follow-ups: `text-warning / bg-warning-pale` (usa token de Sprint 1)

**Grid:** `grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6`

**Interatividade:** clicar em "Follow-ups" ativa `filterFollowup=true` na tabela (já existe o toggle — só conectar ao card)

**Queries para PacientesList:**
```ts
const [pacientes, novosCount, emTratamentoCount, followupsCount] = await Promise.all([
  // query principal já existente (com count)
  queryPrincipal,
  // novos este mês
  supabase.from('pacientes').select('id', { count: 'exact', head: true })
    .eq('clinica_id', clinicaId)
    .gte('created_at', inicioMes),
  // em tratamento (orcamento aprovado)
  supabase.from('orcamentos').select('paciente_id', { count: 'exact', head: true })
    .eq('clinica_id', clinicaId).eq('status', 'aprovado'),
  // follow-ups
  supabase.from('pacientes').select('id', { count: 'exact', head: true })
    .eq('clinica_id', clinicaId).eq('followup_pendente', true),
])
```
Nota: `emTratamentoCount` usa `COUNT(DISTINCT paciente_id)` — verificar se Supabase suporta via head:true. Se não, usar `select('paciente_id').eq('status','aprovado')` e fazer `new Set(data.map(r => r.paciente_id)).size` no servidor.

### 1.3 Tabela — breathing aumentado

**Mudanças em `PacientesTable`:**

| Elemento | Antes | Depois |
|---|---|---|
| Row padding | `py-4` | `py-5` |
| Avatar shape | círculo | `rounded-xl` (quadrado com cantos) |
| Avatar size | `w-10 h-10` | `w-10 h-10` (mantém tamanho) |
| Nome | `text-sm` | `text-sm font-semibold text-text-primary` |
| Telefone/email | `text-text-secondary` | `text-xs text-text-secondary` |
| Badge follow-up | ícone plano | `bg-warning-pale text-warning text-[10px] font-bold px-2 py-0.5 rounded-full border border-warning/20` |
| Hover row | sem hover | `hover:bg-surface-alt/50 transition-colors` |

### 1.4 Empty state

Quando `pacientes.length === 0`:

```tsx
<div className="py-16 flex flex-col items-center gap-4 text-center">
  <div className="w-12 h-12 rounded-2xl bg-surface-alt border border-border flex items-center justify-center">
    <Users className="w-6 h-6 text-text-secondary/40" />
  </div>
  <div>
    <p className="text-text-primary font-semibold text-sm">
      {q ? 'Nenhum paciente encontrado' : 'Nenhum paciente cadastrado'}
    </p>
    <p className="text-text-secondary text-xs mt-1 max-w-[220px]">
      {q ? 'Tente outros termos de busca.' : 'Cadastre o primeiro paciente da clínica.'}
    </p>
  </div>
  {canCreate && !q && (
    <Button variant="brand" size="sm">
      <Plus className="w-3.5 h-3.5" /> Novo Paciente
    </Button>
  )}
</div>
```

---

## Módulo 2 — Perfil do Paciente

**Arquivo principal:** `src/app/dashboard/pacientes/[id]/_components/paciente-detail-client.tsx`

### 2.1 Header compacto

```
← Pacientes

Dr. Ana Beatriz Santos                [Nova Consulta] [Editar] [···]
34 anos · Paciente desde Mar 2024
```

**Estrutura:**
```tsx
<div className="flex items-start justify-between gap-4 mb-6">
  <div>
    <h1 className="font-heading font-bold text-3xl md:text-4xl text-text-primary">
      {paciente.nome}
    </h1>
    <p className="text-text-secondary text-sm font-medium mt-1">
      {idade && `${idade} anos · `}Paciente desde {membroDesde}
    </p>
  </div>
  <div className="flex items-center gap-2 shrink-0">
    <Button variant="brand" size="sm" onClick={...}>
      <Calendar className="w-3.5 h-3.5" /> Nova Consulta
    </Button>
    <Button variant="outline" size="sm" onClick={...}>
      <Edit2 className="w-3.5 h-3.5" /> Editar
    </Button>
    {/* Dropdown "···" com: Ver Contato, Exportar Prontuário */}
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm">
          <MoreHorizontal className="w-4 h-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[180px]">
        <DropdownMenuItem>
          <Phone className="w-4 h-4 mr-2" /> {paciente.telefone ?? 'Sem telefone'}
        </DropdownMenuItem>
        <DropdownMenuItem>
          <Mail className="w-4 h-4 mr-2" /> {paciente.email ?? 'Sem email'}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => window.open(...)}>
          <FileDown className="w-4 h-4 mr-2" /> Exportar Prontuário
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  </div>
</div>
```

**Cálculo de idade:**
```ts
const idade = paciente.data_nascimento
  ? differenceInYears(new Date(), parseISO(paciente.data_nascimento))
  : null;
```

### 2.2 Painel operacional (hero strip)

Ordem de prioridade clínica: **Próxima Consulta → Tratamento → Pendências**

```
┌────────────────────────┬────────────────────────┬────────────────────────┐
│  Próxima Consulta      │  Tratamento            │  Pendências            │
│  ─────────────────     │  ─────────────────     │  ─────────────────     │
│  Qua, 02 Jun           │  3 pendentes           │  2 clínicas            │
│  14:30 · 45 min        │  1 orçamento aberto    │  1 orçamento parado    │
│  Dr. João Silva        │  Aprovado: R$ 2.400    │  Follow-up ● pendente  │
│                        │                        │                        │
│  [Iniciar Consulta ▶]  │  [Ver Tratamento →]    │  [Ver Pendências →]    │
└────────────────────────┴────────────────────────┴────────────────────────┘
```

**Container:**
```tsx
<div className="bg-surface rounded-2xl border border-border shadow-sm mb-6 overflow-hidden">
  <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-border/60">
    {/* Seção 1: Próxima Consulta */}
    {/* Seção 2: Tratamento */}
    {/* Seção 3: Pendências */}
  </div>
</div>
```

**Cada seção:**
```tsx
<div className="px-6 py-5 flex flex-col gap-3">
  <div className="text-[10px] font-bold uppercase tracking-widest text-text-secondary">
    {titulo}
  </div>
  {/* Conteúdo da seção */}
  {/* CTA secundário no rodapé */}
</div>
```

**Seção 1 — Próxima Consulta:**
- Quando há agendamento futuro:
  - Data: `text-lg font-bold text-text-primary` (ex: "Qua, 02 Jun")
  - Hora + duração: `text-sm text-text-secondary`
  - Dentista: `text-xs text-teal font-medium`
  - Botão: `variant="brand" size="sm"` "Iniciar Consulta" (só se `showClinicalTabs` e status não terminal)
  - Link: `text-xs font-semibold text-teal` "Ver Agenda →" (sempre)
- Quando sem agendamento:
  - Texto: `text-sm text-text-secondary` "Nenhuma consulta agendada"
  - Botão: `variant="outline" size="sm"` "Agendar"

**Seção 2 — Tratamento:**
- Procedimentos pendentes: `text-lg font-bold text-text-primary` + label `text-xs text-text-secondary`
- Orçamentos em aberto: `text-sm text-text-secondary`
- Valor aprovado (se houver): `text-sm font-mono text-teal`
- Link: `text-xs font-semibold text-teal` "Ver Tratamento →" → switch para aba 'tratamento'
- Se não há dados: `text-sm text-text-secondary` "Sem tratamento ativo"

**Seção 3 — Pendências:**
- Pendências clínicas (procedimentos não concluídos): número + label
- Orçamento parado (> 5 dias): indicador se aplicável
- Follow-up: badge `bg-warning-pale text-warning` se pendente; "Sem pendências" se limpo
- Link: `text-xs font-semibold text-teal` "Ver Resumo →" → switch para aba 'resumo'
- Dados vêm do state já existente (`pendencias`, `followupPendente`, `orcamentosState`)

### 2.3 Tabs — sem alteração estrutural

Manter as 6 abas existentes: Resumo | Tratamento | Ficha Clínica | Agenda | Orçamentos | Arquivos.

A TabsList recebe um leve upgrade visual:
```tsx
// antes: bg-surface p-1.5 rounded-2xl border border-border/60 shadow-sm
// depois: bg-surface-alt/50 p-1.5 rounded-2xl border border-border shadow-sm
```

TabsTrigger ativo:
```
data-[state=active]:bg-surface data-[state=active]:text-teal 
data-[state=active]:border data-[state=active]:border-teal/20 
data-[state=active]:shadow-sm
```

### 2.4 Aba Resumo reestruturada

Com o hero strip absorvendo próxima consulta + tratamento + pendências, o Resumo exibe:

**Layout:** coluna única com `space-y-6`

**Atividade Recente** (fichas das últimas consultas):
```tsx
<div className="bg-surface rounded-2xl border border-border shadow-sm p-6">
  <div className="flex items-center justify-between mb-5">
    <h3 className="font-semibold text-text-primary">Atividade Recente</h3>
    <button onClick={() => handleTabChange('ficha-clinica')} 
            className="text-xs font-semibold text-teal hover:opacity-80">
      Ver Ficha →
    </button>
  </div>
  {/* Lista de fichas */}
  <div className="space-y-0 divide-y divide-border/40">
    {fichasRecentes.map(ficha => (
      <div key={ficha.id} className="py-3 flex items-start gap-3">
        <div className="w-8 h-8 rounded-xl bg-teal/10 flex items-center justify-center shrink-0 mt-0.5">
          <FileText className="w-4 h-4 text-teal" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-text-primary truncate">
            {ficha.queixa_principal ?? 'Evolução clínica'}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[10px] text-text-secondary">
              {format(parseISO(ficha.created_at), "dd/MM/yyyy 'às' HH:mm")}
            </span>
            {ficha.dentista && (
              <span className="text-[10px] text-teal font-medium">{ficha.dentista.nome}</span>
            )}
          </div>
        </div>
      </div>
    ))}
  </div>
</div>
```

**Financeiro Resumido** (posição secundária, só quando há histórico):
```tsx
<div className="bg-surface rounded-2xl border border-border shadow-sm p-6">
  <h3 className="font-semibold text-text-primary mb-5">Situação Financeira</h3>
  <div className="grid grid-cols-3 gap-3">
    {/* Aprovado | Recebido | Pendente */}
  </div>
  {/* Progress bar teal */}
  <button onClick={() => setActiveTab('orcamentos')}
          className="mt-4 w-full text-xs font-semibold text-teal ...">
    Ver Orçamentos →
  </button>
</div>
```

**Timeline Histórica:**
```tsx
<div className="bg-surface rounded-2xl border border-border shadow-sm p-6">
  <h3 className="font-semibold text-text-primary mb-5">Histórico</h3>
  {/* timeline vertical com dots — mantém estrutura atual, só melhora espaçamento */}
</div>
```

**Removido do Resumo:** os cards "Próxima Consulta" e "Status" (absorvidos pelo hero strip).

---

## Módulo 3 — Ficha Clínica: Timeline Pattern

**Arquivo:** `src/components/pacientes/FichasTab.tsx`

### 3.1 Direção

A ficha clínica é histórico e documentação clínica, não um dashboard. Com dezenas ou centenas de evoluções, uma lista de cards completos degrada a experiência. A solução é um padrão de **timeline expansível**.

### 3.2 Lista de evoluções — timeline compacta

```
● Consulta Inicial                                    12/05/2026
  Dr. João Silva · Queixa: Dor ao mastigar           [▾ Expandir]

● Evolução Clínica                                    19/05/2026
  Dr. João Silva · Evolução clínica                  [▾ Expandir]
  ┌─────────────────────────────────────────────────────────────┐
  │ Queixa: Sensibilidade no dente 16                           │
  │ Dentes: [D16] [D17]                                         │
  │ Observação: Aplicação de dessensibilizante...               │
  │ [📎 2 arquivos]    [Assinatura ✓]    [Editar] [Excluir]    │
  └─────────────────────────────────────────────────────────────┘

● Retorno                                             27/05/2026
  Dr. João Silva · Retorno                            [▾ Expandir]
```

**Container da timeline:**
```tsx
<div className="relative">
  {/* Linha vertical */}
  <div className="absolute left-[7px] top-2 bottom-2 w-px bg-border/60" />
  
  <div className="space-y-0">
    {evolutions.map(ev => (
      <TimelineEntry key={ev.id} evolution={ev} ... />
    ))}
  </div>
</div>
```

**Cada entrada — collapsed (padrão):**
```tsx
<div className="relative flex gap-4 pb-4 last:pb-0">
  {/* Dot */}
  <div className="relative z-10 mt-1.5 shrink-0">
    <div className="w-3.5 h-3.5 rounded-full bg-teal/20 border-2 border-teal/60" />
  </div>
  
  {/* Conteúdo colapsado */}
  <div className="flex-1 min-w-0">
    <button
      onClick={() => toggleExpanded(ev.id)}
      className="w-full text-left group"
    >
      <div className="flex items-center justify-between gap-2 py-2 hover:bg-surface-alt/50 rounded-xl px-3 -mx-3 transition-colors">
        <div className="min-w-0">
          <span className="text-sm font-semibold text-text-primary">{ev.type}</span>
          <span className="text-xs text-text-secondary ml-2">{ev.professional}</span>
          {ev.observation && (
            <span className="text-xs text-text-secondary ml-1">· {truncate(ev.observation, 50)}</span>
          )}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-[10px] font-mono text-text-secondary">{ev.date}</span>
          <ChevronDown className={`w-3.5 h-3.5 text-text-secondary transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </div>
      </div>
    </button>
    
    {/* Expanded panel — AnimatePresence */}
    {expanded && (
      <div className="mt-1 ml-0 bg-surface rounded-xl border border-border p-4 space-y-3">
        {/* queixa */}
        {/* dentes badges */}
        {/* observação */}
        {/* anexos */}
        {/* assinatura */}
        {/* ações: editar / excluir */}
      </div>
    )}
  </div>
</div>
```

**Expanded panel content:**
```tsx
{ev.teethNotes.length > 0 && (
  <div className="flex flex-wrap gap-1.5">
    {ev.teethNotes.map(t => (
      <span key={t.tooth} 
            className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-teal/10 text-teal border border-teal/20">
        D{t.tooth}
      </span>
    ))}
  </div>
)}

{ev.observation && (
  <p className="text-sm text-text-primary leading-relaxed">{ev.observation}</p>
)}

{/* Rodapé de ações */}
<div className="flex items-center justify-between pt-2 border-t border-border/40">
  <div className="flex items-center gap-3 text-xs text-text-secondary">
    {ev.files.length > 0 && (
      <span className="flex items-center gap-1">
        <Paperclip className="w-3 h-3" /> {ev.files.length} arquivo{ev.files.length !== 1 ? 's' : ''}
      </span>
    )}
    {ev.assinaturaUrl && (
      <span className="flex items-center gap-1 text-teal">
        <Check className="w-3 h-3" /> Assinado
      </span>
    )}
  </div>
  <div className="flex items-center gap-1">
    <button onClick={() => handleEdit(ev)} className="p-1.5 rounded-lg text-text-secondary hover:text-teal hover:bg-teal/10 transition-colors">
      <Edit2 className="w-3.5 h-3.5" />
    </button>
    <button onClick={() => handleDelete(ev.id)} className="p-1.5 rounded-lg text-text-secondary hover:text-coral hover:bg-coral-pale transition-colors">
      <Trash2 className="w-3.5 h-3.5" />
    </button>
  </div>
</div>
```

**Estado expandido:** controle via `useState<Set<string>>` de IDs expandidos. A entrada mais recente começa expandida por padrão.

### 3.3 Formulário de nova evolução — agrupado

O painel de criação mantém toda a funcionalidade atual (odontograma, áudio, upload, assinatura). Melhoria é organizacional:

```tsx
<div className="bg-surface rounded-2xl border border-border shadow-sm p-6 space-y-6">
  {/* Cabeçalho do form */}
  <div className="flex items-center justify-between">
    <h3 className="font-semibold text-text-primary">Nova Evolução</h3>
    <button onClick={handleClose}><X className="w-4 h-4" /></button>
  </div>

  {/* Grupo 1: Tipo + Queixa */}
  <div className="space-y-3">
    <label className="text-[10px] font-bold uppercase tracking-widest text-text-secondary">
      Queixa Principal
    </label>
    <div className="flex gap-2">
      <Input placeholder="Descreva a queixa..." className="flex-1" />
      {/* Botão de transcrição de áudio */}
    </div>
  </div>

  {/* Grupo 2: Dentes Afetados */}
  <div className="space-y-3">
    <label className="text-[10px] font-bold uppercase tracking-widest text-text-secondary">
      Dentes Afetados
    </label>
    <div className="bg-surface-alt rounded-xl border border-border/60 p-4">
      <Odontograma ... />
    </div>
    {/* Notas por dente selecionado */}
  </div>

  {/* Grupo 3: Observações */}
  <div className="space-y-3">
    <label className="text-[10px] font-bold uppercase tracking-widest text-text-secondary">
      Observações
    </label>
    <Textarea ... />
  </div>

  {/* Grupo 4: Anexos */}
  <div className="space-y-3">
    <label className="text-[10px] font-bold uppercase tracking-widest text-text-secondary">
      Anexos
    </label>
    {/* Upload area */}
  </div>

  {/* Ações */}
  <div className="flex gap-3 pt-2 border-t border-border/40">
    <Button variant="outline" onClick={handleClose} className="flex-1">Cancelar</Button>
    <Button variant="brand" onClick={handleSave} className="flex-1" disabled={isSaving}>
      {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
      Salvar Evolução
    </Button>
  </div>
</div>
```

**Separação entre seções do form:** `space-y-6` entre grupos. Cada grupo tem label `text-[10px] uppercase tracking-widest` + campo.

---

## Fora de escopo desta sprint

- Odontograma: contraste e legibilidade → Sprint 3C (ver nota de diretriz do usuário)
- EmptyState component global → pendente para sprint futura
- Migração de Loader2 → DexLoader em todo o sistema → pendente

---

## Critério de conclusão

- [ ] Header da lista de pacientes com descrição dinâmica
- [ ] 4 métricas em cards acima da tabela (queries paralelas no servidor)
- [ ] Tabela com row padding aumentado, avatar `rounded-xl`, badge follow-up com token warning
- [ ] Empty state com ícone + título + descrição + CTA condicional
- [ ] Header do perfil: Nome + Idade + "Paciente desde" + dropdown de contato
- [ ] Hero strip operacional com 3 seções: Próxima Consulta | Tratamento | Pendências
- [ ] Aba Resumo reestruturada: sem cards de Próxima Consulta e Status (absorvidos pelo strip)
- [ ] Financeiro em posição secundária no Resumo
- [ ] FichasTab: timeline expansível com dots, collapsed por padrão, mais recente aberta
- [ ] Formulário de nova evolução com seções agrupadas e labels canônicas
- [ ] Todos os componentes novos usam padrões de referência desta spec
