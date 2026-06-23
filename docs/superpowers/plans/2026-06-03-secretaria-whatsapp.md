# Plano: Secretaria Operacional + WhatsApp Official API
**Data:** 2026-06-03  
**Spec:** `docs/superpowers/specs/2026-06-03-secretaria-whatsapp-design.md`

---

## Goal
Corrigir permissões da secretária, melhorar seu fluxo operacional e preparar a infraestrutura para o WhatsApp Business Cloud API (Meta).

## Stack
Next.js App Router · TypeScript estrito · Supabase · Tailwind v4 · Framer Motion

## Arquivos por Sprint

### Sprint A — Secretaria
| Operação | Arquivo |
|---|---|
| Modificar | `src/app/dashboard/orcamentos/page.tsx` |
| Modificar | `src/app/dashboard/pacientes/[id]/_components/paciente-detail-client.tsx` |
| Modificar | `src/app/dashboard/pacientes/novo/_components/novo-paciente-form.tsx` |
| Modificar | `src/components/layout/sidebar-content.tsx` |
| Modificar | `src/app/dashboard/page.tsx` |
| Modificar | `src/app/dashboard/orcamentos/_components/orcamentos-client.tsx` |
| Modificar | `src/app/dashboard/financeiro/_components/financeiro-client.tsx` |
| Modificar | `src/app/dashboard/financeiro/actions.ts` |
| Modificar | `src/app/dashboard/financeiro/page.tsx` |

### Sprint B — WhatsApp
| Operação | Arquivo |
|---|---|
| Criar | `supabase/migrations/20260603000001_069_whatsapp_official_api.sql` |
| Criar | `src/app/api/webhooks/whatsapp/route.ts` |
| Criar | `src/lib/whatsapp/types.ts` |
| Criar | `src/lib/whatsapp/client.ts` |
| Criar | `src/lib/whatsapp/bot-engine.ts` |
| Criar | `src/lib/whatsapp/flows/cadastro.ts` |
| Criar | `src/lib/whatsapp/flows/agendamento.ts` |
| Criar | `src/lib/whatsapp/flows/pagamento.ts` |
| Criar | `src/lib/whatsapp/flows/orcamento.ts` |
| Modificar | `src/app/dashboard/configuracoes/whatsapp/_components/whatsapp-config-client.tsx` |
| Modificar | `src/app/dashboard/configuracoes/whatsapp/_components/aba-conexao.tsx` |
| Modificar | `src/app/dashboard/configuracoes/whatsapp/_components/aba-configuracoes.tsx` |
| Modificar | `src/app/dashboard/whatsapp/_components/whatsapp-client.tsx` |
| Modificar | `src/app/dashboard/whatsapp/actions.ts` |

---

## SPRINT A — Secretaria

---

### Tarefa A1: Remover "Novo Orçamento" da UI para secretária

**Arquivos:**
- `src/app/dashboard/orcamentos/page.tsx`
- `src/app/dashboard/pacientes/[id]/_components/paciente-detail-client.tsx`

**Passo 1 — `orcamentos/page.tsx` linha 104:**

Localizar:
```ts
const canEdit = !isUserOverride && (dentista.plano === 'SOLO' || dentista.role === 'secretaria');
```

Substituir por:
```ts
const canEdit = !isUserOverride && dentista.plano === 'SOLO';
```

> Secretária nunca cria orçamentos. O banco já bloqueia via RLS (`orcamentos_insert_dentistas`); a UI estava inconsistente.

**Passo 2 — `paciente-detail-client.tsx` linha ~1309:**

Localizar o bloco `<TabsContent value="orcamentos">` e o botão "Novo Orçamento":
```tsx
{/* Botão novo orçamento — sempre visível */}
<div className="flex items-center justify-between">
  <span ...>{orcamentosState.length} orçamento...</span>
  <button
    onClick={() => void abrirNovoOrcamento()}
    ...
  >
    ...Novo Orçamento
  </button>
</div>
```

Substituir por:
```tsx
<div className="flex items-center justify-between">
  <span className="text-sm text-text-secondary font-medium">
    {orcamentosState.length} orçamento{orcamentosState.length !== 1 ? 's' : ''}
  </span>
  {role !== 'secretaria' && (
    <button
      onClick={() => void abrirNovoOrcamento()}
      disabled={isLoadingFichaParaOrc}
      className="bg-teal text-white px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-2 hover:bg-teal-lt transition-all shadow-md disabled:opacity-60"
    >
      {isLoadingFichaParaOrc ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
      ) : (
        <Plus className="w-3.5 h-3.5" />
      )}
      Novo Orçamento
    </button>
  )}
</div>
```

**Verificar:** Logar como secretária → abrir `/dashboard/orcamentos` → botão "Novo Orçamento" não aparece. Abrir perfil de qualquer paciente → aba Orçamentos → botão não aparece.

---

### Tarefa A2: Novo Paciente — seleção de dentista obrigatória para secretária

**Arquivo:** `src/app/dashboard/pacientes/novo/_components/novo-paciente-form.tsx`

O form já tem `isSecretaria` e `dentistas` como props. Já existe `<Select>` importado. A action já aceita `dentistaId`. Falta apenas: (a) mostrar o campo e (b) validar que está preenchido.

**Passo 1 — Adicionar state para dentista selecionado.**

Localizar os estados no início do componente (`useState`) e adicionar:
```tsx
const [dentistaId, setDentistaId] = useState<string>(dentistas[0]?.id ?? '');
```

**Passo 2 — Adicionar campo visual logo abaixo do título da seção de dados pessoais.**

Localizar a primeira `<AppFormField>` ou o primeiro campo de input do formulário. Inserir antes dele:

```tsx
{isSecretaria && dentistas.length > 0 && (
  <AppFormField>
    <AppLabel required>Dentista Responsável</AppLabel>
    <Select
      value={dentistaId}
      onValueChange={(v) => v && setDentistaId(v)}
    >
      <SelectTrigger className="rounded-xl bg-surface-alt border-border text-text-primary">
        <SelectValue placeholder="Selecione o dentista..." />
      </SelectTrigger>
      <SelectContent className="bg-surface border-border">
        {dentistas.map((d) => (
          <SelectItem key={d.id} value={d.id}>
            {d.nome}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  </AppFormField>
)}
```

**Passo 3 — Passar `dentistaId` para a action no submit.**

Localizar a chamada `createPaciente({ ... })` e garantir que inclui:
```ts
dentistaId: isSecretaria ? dentistaId : undefined,
```

**Passo 4 — Validação no submit.**

Antes da chamada à action, adicionar:
```ts
if (isSecretaria && !dentistaId) {
  setError('Selecione o dentista responsável pelo paciente.');
  return;
}
```

**Verificar:** Logar como secretária → Novo Paciente → campo "Dentista Responsável" aparece como obrigatório → paciente criado tem `dentista_id` preenchido.

---

### Tarefa A3: Fichas — secretária vê conteúdo clínico em leitura

**Arquivo:** `src/app/dashboard/pacientes/[id]/_components/paciente-detail-client.tsx`

**Passo 1 — Substituir o flag único por dois flags.**

Localizar:
```ts
const showClinicalTabs = role === 'admin' || role === 'dentista';
```

Substituir por:
```ts
const canViewClinical  = true; // todos vêem fichas (secretária em leitura)
const canWriteClinical = role === 'admin' || role === 'dentista';
```

**Passo 2 — Atualizar todas as referências a `showClinicalTabs`.**

Fazer busca global no arquivo por `showClinicalTabs` e substituir cada ocorrência:

| Ocorrência | Substituição |
|---|---|
| Tabs "Tratamento" e "Ficha Clínica" nos `TabsList` | Manter `canWriteClinical` para "Tratamento"; mudar "Ficha Clínica" para `canViewClinical` |
| `<TabsContent value="ficha-clinica">` | Manter mas usar `canWriteClinical` como guard para botões de escrita internos |
| `<TabsContent value="tratamento">` | Manter `canWriteClinical` |
| "Iniciar consulta" button | Manter `canWriteClinical` |
| Atividade recente (fichas recentes) | Manter `canWriteClinical` |
| Pendências clínicas widget | Manter `canWriteClinical` |

**Passo 3 — Dentro de `<TabsContent value="ficha-clinica">`:**

Encontrar o botão "Nova Evolução" ou "Nova Ficha" e adicionar guard:
```tsx
{canWriteClinical && (
  <button ...>Nova Ficha</button>
)}
```
Garantir que o conteúdo de leitura (lista de fichas, procedimentos) renderiza para todos quando `canViewClinical`.

**Passo 4 — Aba Documentos:** Já deve estar visível para todos. Confirmar que upload, download e assinatura não têm guard `showClinicalTabs`.

**Verificar:** Secretária abre perfil de paciente → vê aba "Ficha Clínica" (leitura) → não vê botão de criar ficha → vê aba "Documentos" com upload/download → não vê aba "Tratamento".

---

### Tarefa A4: Sidebar — adicionar Orçamentos no grupo GESTÃO

**Arquivo:** `src/components/layout/sidebar-content.tsx`

**Passo 1 — Adicionar import de ícone.**

Localizar os imports do `lucide-react` e adicionar `FileText` (ou usar `CircleDollarSign` que já pode estar importado):
```ts
import {
  ...,
  FileText,
} from 'lucide-react';
```

**Passo 2 — Adicionar item no grupo GESTÃO.**

Localizar:
```ts
{
  label: 'GESTÃO',
  items: [
    { href: '/dashboard/financeiro', icon: Wallet, label: 'Financeiro', id: 'financeiro-link', visible: true, locked: financeiroLocked },
  ],
},
```

Substituir por:
```ts
{
  label: 'GESTÃO',
  items: [
    { href: '/dashboard/financeiro',  icon: Wallet,    label: 'Financeiro', id: 'financeiro-link',  visible: true, locked: financeiroLocked },
    { href: '/dashboard/orcamentos',  icon: FileText,  label: 'Orçamentos', id: 'orcamentos-link',  visible: true, locked: false },
  ],
},
```

**Verificar:** Sidebar renderiza "Orçamentos" abaixo de "Financeiro" no grupo GESTÃO. Item ativo quando em `/dashboard/orcamentos`.

---

### Tarefa A5: Dashboard — remover pendências de orçamento parado para secretária

**Arquivo:** `src/app/dashboard/page.tsx`

A função `SecretaryDashboardServer` constrói pendências incluindo o loop de `orcamento_parado`. A secretária não pode agir sobre orçamentos parados (não cria/movimenta), então esse alerta não tem valor para ela.

**Passo 1 — Remover a query `orcamentosParadosRaw`.**

Localizar no `Promise.all`:
```ts
// Orçamentos enviados parados há > 5 dias
supabase
  .from('orcamentos')
  .select('id, created_at, total, paciente:pacientes(id, nome)')
  ...
```
Remover essa entrada do `Promise.all` e remover a variável `orcamentosParadosRaw` da desestruturação.

**Passo 2 — Remover o loop que adiciona pendências do tipo `orcamento_parado`.**

Localizar e remover:
```ts
for (const orc of (orcamentosParadosRaw ?? []) as ...) {
  // ...
  pendencias.push({ tipo: 'orcamento_parado', ... });
}
```

**Passo 3 — Remover `limiteOrcamento` que não é mais usado:**
```ts
const limiteOrcamento = new Date(now.getTime() - 5 * 86_400_000).toISOString();
```

**Verificar:** Dashboard da secretária não mostra mais itens "Orçamento aguardando há X dias". Pagamentos vencidos e follow-ups continuam aparecendo.

---

### Tarefa A6: Orçamentos — dentista visível e proeminente na lista

**Arquivo:** `src/app/dashboard/orcamentos/_components/orcamentos-client.tsx`

O join do dentista já existe nos dados. Objetivo: garantir que o nome do dentista aparece claramente na linha de cada orçamento na tabela.

**Passo 1 — Localizar a linha de renderização de cada orçamento na tabela** (dentro do `map` que renderiza `<motion.tr>`).

Encontrar onde o paciente é exibido e verificar se o dentista já aparece. Se não:

**Passo 2 — Adicionar coluna/campo do dentista.**

Na linha da tabela, após o campo do paciente, garantir que o dentista está visível:
```tsx
{/* Dentista */}
<td className="px-4 py-3">
  <span className="text-xs text-text-secondary font-medium">
    {o.dentista?.nome ?? '—'}
  </span>
</td>
```

Na versão mobile/card (se houver), adicionar linha:
```tsx
<p className="text-xs text-text-secondary mt-0.5">
  {o.dentista?.nome ?? '—'}
</p>
```

**Verificar:** Lista de orçamentos mostra claramente o dentista de cada orçamento.

---

### Tarefa A7: Financeiro — modal "Registrar Recebimento"

Esta é a maior tarefa do Sprint A. Adiciona uma nova ação primária no financeiro para secretária registrar pagamentos vinculados a pacientes e orçamentos.

**Arquivos:**
- `src/app/dashboard/financeiro/actions.ts`
- `src/app/dashboard/financeiro/_components/financeiro-client.tsx`
- `src/app/dashboard/financeiro/page.tsx`

#### Passo 1 — Nova action `registrarRecebimento` em `financeiro/actions.ts`

Adicionar ao final do arquivo:

```ts
export type OrcamentoPendente = {
  id: string;
  total: number | null;
  descricao_resumo: string;
  valor_pendente: number;
};

export type BuscarOrcamentosPendentesResult = {
  orcamentos: OrcamentoPendente[];
  dentistaId: string | null;
  dentistaNome: string | null;
  error?: string;
};

export async function buscarOrcamentosPendentesPorPaciente(
  pacienteId: string,
): Promise<BuscarOrcamentosPendentesResult> {
  const { supabase, clinicId } = await requireClinicContext();

  // Busca dentista do paciente
  const { data: paciente } = await supabase
    .from('pacientes')
    .select('dentista_id, dentista:dentistas(id, nome)')
    .eq('id', pacienteId)
    .eq('clinica_id', clinicId)
    .maybeSingle();

  // Busca orçamentos aprovados com pagamentos pendentes
  const { data: orcamentosRaw } = await supabase
    .from('orcamentos')
    .select(`
      id, total,
      itens:orcamento_itens(descricao),
      pagamentos(id, valor, status)
    `)
    .eq('clinica_id', clinicId)
    .eq('paciente_id', pacienteId)
    .eq('status', 'aprovado');

  const orcamentos: OrcamentoPendente[] = (orcamentosRaw ?? [])
    .map((o) => {
      const pags = (o.pagamentos ?? []) as { valor: number; status: string }[];
      const totalPago = pags
        .filter((p) => p.status === 'pago')
        .reduce((s, p) => s + p.valor, 0);
      const valorPendente = Math.max(0, (o.total ?? 0) - totalPago);
      const descricao = (o.itens as { descricao: string | null }[])
        .map((i) => i.descricao)
        .filter(Boolean)
        .slice(0, 2)
        .join(', ') || 'Orçamento';
      return {
        id: o.id,
        total: o.total,
        descricao_resumo: descricao,
        valor_pendente: valorPendente,
      };
    })
    .filter((o) => o.valor_pendente > 0);

  const dentista = paciente?.dentista as { id: string; nome: string } | null;

  return {
    orcamentos,
    dentistaId: dentista?.id ?? null,
    dentistaNome: dentista?.nome ?? null,
  };
}

export type RegistrarRecebimentoInput = {
  pacienteId: string;
  orcamentoId: string;
  valor: number;
  formaPagamento: 'pix' | 'dinheiro' | 'transferencia' | 'cartao_credito' | 'cartao_debito' | 'boleto' | 'outro';
  data: string;
  dentistaId?: string;
};

export async function registrarRecebimento(
  dados: RegistrarRecebimentoInput,
): Promise<{ error?: string }> {
  const { supabase, clinicId } = await requireClinicContext();

  // 1. Criar pagamento vinculado ao orçamento
  const { error: pagError } = await supabase.from('pagamentos').insert({
    clinica_id:      clinicId,
    orcamento_id:    dados.orcamentoId,
    paciente_id:     dados.pacienteId,
    valor:           dados.valor,
    status:          'pago',
    forma_pagamento: dados.formaPagamento,
    data_pagamento:  dados.data,
  });

  if (pagError) return { error: pagError.message };

  // 2. Criar receita manual espelho (registro financeiro)
  const { error: recError } = await supabase.from('receitas_manuais').insert({
    clinica_id:  clinicId,
    dentista_id: dados.dentistaId ?? null,
    valor:       dados.valor,
    forma:       ['cartao_credito', 'cartao_debito', 'boleto'].includes(dados.formaPagamento)
                   ? 'outro'
                   : dados.formaPagamento as 'pix' | 'dinheiro' | 'transferencia' | 'outro',
    data:        dados.data,
    descricao:   `Recebimento registrado pela secretária`,
  });

  if (recError) return { error: recError.message };

  revalidatePath('/dashboard/financeiro');
  revalidatePath('/dashboard/orcamentos');
  return {};
}
```

#### Passo 2 — Adicionar os novos tipos ao export da `page.tsx` do financeiro

Abrir `src/app/dashboard/financeiro/page.tsx` e garantir que as props passadas para `FinanceiroClient` incluem `isSecretaria` e a lista de dentistas (para o modal).

Localizar onde `FinanceiroClient` é renderizado e adicionar:
```tsx
isSecretaria={dentista.role === 'secretaria'}
```

#### Passo 3 — Modal "Registrar Recebimento" no `financeiro-client.tsx`

**3a. Adicionar imports necessários:**
```tsx
import { buscarOrcamentosPendentesPorPaciente, registrarRecebimento } from '../actions';
import type { OrcamentoPendente } from '../actions';
```

**3b. Adicionar estados do modal:**
```tsx
const [isRecebimentoOpen, setIsRecebimentoOpen] = useState(false);
const [recPacienteSearch, setRecPacienteSearch] = useState('');
const [recPacienteId, setRecPacienteId] = useState('');
const [recPacienteNome, setRecPacienteNome] = useState('');
const [recPacienteSugestoes, setRecPacienteSugestoes] = useState<{ id: string; nome: string }[]>([]);
const [recShowSugestoes, setRecShowSugestoes] = useState(false);
const [recDentistaNome, setRecDentistaNome] = useState('');
const [recDentistaId, setRecDentistaId] = useState('');
const [recOrcamentos, setRecOrcamentos] = useState<OrcamentoPendente[]>([]);
const [recOrcamentoId, setRecOrcamentoId] = useState('');
const [recValor, setRecValor] = useState('');
const [recForma, setRecForma] = useState<'pix' | 'dinheiro' | 'transferencia' | 'cartao_credito' | 'cartao_debito' | 'boleto' | 'outro'>('pix');
const [recData, setRecData] = useState(() => new Date().toISOString().split('T')[0]);
const [recLoading, setRecLoading] = useState(false);
const [recError, setRecError] = useState<string | null>(null);
const [recBuscando, setRecBuscando] = useState(false);
const supabaseClient = createClient();
```

**3c. Função de busca de pacientes (autocomplete):**
```tsx
const buscarPacientesRec = useCallback(async (nome: string) => {
  if (nome.length < 2) { setRecPacienteSugestoes([]); return; }
  const { data } = await supabaseClient
    .from('pacientes')
    .select('id, nome')
    .ilike('nome', `%${nome}%`)
    .limit(6);
  setRecPacienteSugestoes(data ?? []);
}, [supabaseClient]);
```

**3d. Ao selecionar paciente — buscar dentista e orçamentos pendentes:**
```tsx
const aoSelecionarPaciente = async (id: string, nome: string) => {
  setRecPacienteId(id);
  setRecPacienteNome(nome);
  setRecShowSugestoes(false);
  setRecBuscando(true);
  setRecOrcamentos([]);
  setRecOrcamentoId('');
  const result = await buscarOrcamentosPendentesPorPaciente(id);
  setRecDentistaNome(result.dentistaNome ?? '');
  setRecDentistaId(result.dentistaId ?? '');
  setRecOrcamentos(result.orcamentos);
  if (result.orcamentos.length === 1) {
    setRecOrcamentoId(result.orcamentos[0].id);
    setRecValor(String(result.orcamentos[0].valor_pendente));
  }
  setRecBuscando(false);
};
```

**3e. Função de submit:**
```tsx
const handleRegistrarRecebimento = async () => {
  if (!recPacienteId) { setRecError('Selecione o paciente.'); return; }
  if (!recOrcamentoId) { setRecError('Selecione o orçamento.'); return; }
  const valorNum = parseFloat(recValor.replace(',', '.'));
  if (!valorNum || valorNum <= 0) { setRecError('Informe um valor válido.'); return; }
  setRecError(null);
  setRecLoading(true);
  const result = await registrarRecebimento({
    pacienteId: recPacienteId,
    orcamentoId: recOrcamentoId,
    valor: valorNum,
    formaPagamento: recForma,
    data: recData,
    dentistaId: recDentistaId || undefined,
  });
  if (result.error) {
    setRecError(result.error);
  } else {
    setIsRecebimentoOpen(false);
    setRecPacienteSearch(''); setRecPacienteId(''); setRecPacienteNome('');
    setRecOrcamentos([]); setRecOrcamentoId(''); setRecValor('');
    router.refresh();
    toast.success('Recebimento registrado!');
  }
  setRecLoading(false);
};
```

**3f. Botão de acesso ao modal — adicionar ao header do Financeiro:**

Localizar o botão "+ Despesa" ou o header da página no `financeiro-client.tsx` e adicionar (visível apenas para secretária):
```tsx
{isSecretaria && (
  <button
    onClick={() => setIsRecebimentoOpen(true)}
    className="bg-gradient-to-r from-teal to-teal-lt text-white px-5 py-2.5 rounded-xl font-semibold text-sm flex items-center gap-2 shadow-[0_8px_32px_rgba(47,156,133,0.38)] hover:-translate-y-0.5 transition-all"
  >
    <Plus className="w-4 h-4" />
    Registrar Recebimento
  </button>
)}
```

**3g. Modal JSX — adicionar antes do `</div>` final do componente:**

```tsx
<Sheet open={isRecebimentoOpen} onOpenChange={(open) => { if (!open) setRecError(null); setIsRecebimentoOpen(open); }}>
  <SheetContent side="right" showCloseButton={false} className="!w-full sm:!w-[520px] p-0 gap-0 flex flex-col bg-surface border-l border-border">

    {/* Header */}
    <div className="relative px-6 pt-6 pb-5 shrink-0" style={{ background: 'linear-gradient(135deg, #2f9c85 0%, #1a7a65 100%)' }}>
      <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-transparent pointer-events-none" />
      <div className="relative flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-white/15">
            <CircleDollarSign className="w-5 h-5 text-white" />
          </div>
          <div>
            <SheetTitle className="font-heading font-semibold text-xl text-white leading-tight">Registrar Recebimento</SheetTitle>
            <p className="text-white/70 text-xs mt-0.5">Vincule o pagamento ao paciente e orçamento.</p>
          </div>
        </div>
        <SheetClose render={<button className="w-8 h-8 rounded-lg flex items-center justify-center bg-white/10 hover:bg-white/20 transition-colors" />}>
          <X className="w-4 h-4 text-white" />
        </SheetClose>
      </div>
    </div>

    {/* Body */}
    <div className="flex-1 overflow-y-auto p-6 space-y-5">

      {/* Busca de paciente */}
      <div className="space-y-2 relative">
        <Label className="text-[10px] font-bold uppercase tracking-[0.18em] text-text-secondary">
          Paciente <span className="text-coral">*</span>
        </Label>
        <div className="relative">
          <UserRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary/40 pointer-events-none" />
          <Input
            placeholder="Buscar paciente pelo nome..."
            value={recPacienteSearch}
            autoComplete="off"
            onChange={(e) => {
              const v = e.target.value;
              setRecPacienteSearch(v);
              setRecPacienteId('');
              setRecPacienteNome('');
              setRecShowSugestoes(true);
              void buscarPacientesRec(v);
            }}
            onBlur={() => setTimeout(() => setRecShowSugestoes(false), 150)}
            className="rounded-xl bg-surface-alt border-border text-text-primary pl-10"
          />
        </div>
        {recShowSugestoes && recPacienteSugestoes.length > 0 && (
          <div className="absolute z-50 w-full bg-surface border border-border rounded-xl shadow-lg overflow-hidden">
            {recPacienteSugestoes.map((p) => (
              <button key={p.id} type="button"
                onClick={() => { setRecPacienteSearch(p.nome); void aoSelecionarPaciente(p.id, p.nome); }}
                className="w-full px-4 py-2.5 text-sm text-left hover:bg-surface-alt transition-colors text-text-primary"
              >
                {p.nome}
              </button>
            ))}
          </div>
        )}
        {recPacienteId && (
          <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2.5 px-3 py-2.5 border border-teal/25 rounded-xl text-sm text-teal font-semibold"
            style={{ background: 'color-mix(in srgb, var(--color-teal) 8%, var(--color-surface-alt))' }}
          >
            <UserRound className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{recPacienteNome}</span>
            {recDentistaNome && (
              <span className="ml-auto text-xs text-text-secondary font-normal shrink-0">
                {recDentistaNome}
              </span>
            )}
          </motion.div>
        )}
      </div>

      {/* Orçamentos pendentes */}
      {recPacienteId && (
        <div className="space-y-2">
          <Label className="text-[10px] font-bold uppercase tracking-[0.18em] text-text-secondary">
            Orçamento <span className="text-coral">*</span>
          </Label>
          {recBuscando ? (
            <div className="flex items-center gap-2 text-sm text-text-secondary py-3">
              <Loader2 className="w-4 h-4 animate-spin" /> Buscando orçamentos...
            </div>
          ) : recOrcamentos.length === 0 ? (
            <div className="px-4 py-3 bg-surface-alt rounded-xl border border-border text-sm text-text-secondary">
              Nenhum orçamento aprovado com saldo pendente.
            </div>
          ) : (
            <div className="space-y-2">
              {recOrcamentos.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => { setRecOrcamentoId(o.id); setRecValor(String(o.valor_pendente)); }}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 transition-all text-left ${
                    recOrcamentoId === o.id
                      ? 'border-teal bg-teal/8 text-teal'
                      : 'border-border bg-surface-alt text-text-primary hover:border-teal/40'
                  }`}
                >
                  <div>
                    <p className="text-sm font-semibold">{o.descricao_resumo}</p>
                    <p className="text-xs text-text-secondary mt-0.5">
                      Pendente: R$ {o.valor_pendente.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  {recOrcamentoId === o.id && <CheckCircle2 className="w-4 h-4 text-teal shrink-0" />}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Valor + Forma + Data */}
      {recOrcamentoId && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-[10px] font-bold uppercase tracking-[0.18em] text-text-secondary">
                Valor <span className="text-coral">*</span>
              </Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={recValor}
                onChange={(e) => setRecValor(e.target.value)}
                className="rounded-xl bg-surface-alt border-border text-text-primary"
                placeholder="0,00"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-bold uppercase tracking-[0.18em] text-text-secondary">Data</Label>
              <Input
                type="date"
                value={recData}
                onChange={(e) => setRecData(e.target.value)}
                className="rounded-xl bg-surface-alt border-border text-text-primary"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-[10px] font-bold uppercase tracking-[0.18em] text-text-secondary">Forma de Pagamento</Label>
            <Select value={recForma} onValueChange={(v) => setRecForma(v as typeof recForma)}>
              <SelectTrigger className="rounded-xl bg-surface-alt border-border text-text-primary">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-surface border-border">
                <SelectItem value="pix">PIX</SelectItem>
                <SelectItem value="dinheiro">Dinheiro</SelectItem>
                <SelectItem value="transferencia">Transferência</SelectItem>
                <SelectItem value="cartao_credito">Cartão Crédito</SelectItem>
                <SelectItem value="cartao_debito">Cartão Débito</SelectItem>
                <SelectItem value="boleto">Boleto</SelectItem>
                <SelectItem value="outro">Outro</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </motion.div>
      )}
    </div>

    {/* Footer */}
    <div className="shrink-0 px-6 py-5 border-t border-border space-y-3 bg-surface">
      {recError && <p className="text-xs text-red-500 bg-red-500/10 rounded-lg p-2">{recError}</p>}
      <Button
        onClick={() => void handleRegistrarRecebimento()}
        disabled={recLoading || !recOrcamentoId}
        className="w-full bg-gradient-to-r from-teal to-teal-lt text-white rounded-2xl py-3 font-bold shadow-[0_8px_32px_rgba(47,156,133,0.40)] hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0 transition-all"
      >
        {recLoading ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Registrando...</> : 'Confirmar Recebimento'}
      </Button>
      <button onClick={() => setIsRecebimentoOpen(false)} className="w-full py-1.5 text-sm font-medium text-text-secondary hover:text-text-primary transition-colors">
        Cancelar
      </button>
    </div>
  </SheetContent>
</Sheet>
```

**Verificar:** Secretária no Financeiro → botão "Registrar Recebimento" → seleciona paciente → dentista aparece automaticamente → orçamentos pendentes listados → seleciona e preenche valor → confirma → pagamento criado + receita registrada.

---

## SPRINT B — WhatsApp Official API

---

### Tarefa B1: Migração SQL — campos para API Oficial

**Arquivo:** `supabase/migrations/20260603000001_069_whatsapp_official_api.sql`

```sql
-- Migration 069: WhatsApp Business Cloud API (Meta Official)
-- Substitui integração via QR code / Evolution API

BEGIN;

-- conversas_bot: estado da máquina de estados + vínculos
ALTER TABLE public.conversas_bot
  ADD COLUMN IF NOT EXISTS estado        text DEFAULT 'inicio',
  ADD COLUMN IF NOT EXISTS paciente_id   uuid REFERENCES public.pacientes(id)  ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS dentista_id   uuid REFERENCES public.dentistas(id)  ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS dados_coleta  jsonb DEFAULT '{}';

COMMENT ON COLUMN public.conversas_bot.estado IS
  'Estado atual da FSM: inicio | cadastro | agendamento | orcamento | pagamento | humano | encerrado';

COMMENT ON COLUMN public.conversas_bot.dados_coleta IS
  'Dados coletados parcialmente durante fluxo de cadastro/agendamento';

-- mensagens_bot: suporte a mídia (comprovantes, PDFs)
ALTER TABLE public.mensagens_bot
  ADD COLUMN IF NOT EXISTS media_url  text,
  ADD COLUMN IF NOT EXISTS media_type text;

COMMENT ON COLUMN public.mensagens_bot.media_type IS
  'Tipo de mídia recebida: image | document | audio';

-- pagamentos: rastreamento de comprovante e verificação automática
ALTER TABLE public.pagamentos
  ADD COLUMN IF NOT EXISTS comprovante_url              text,
  ADD COLUMN IF NOT EXISTS verificado_automaticamente   boolean DEFAULT false;

-- bot_config: campos para WhatsApp Business Cloud API
-- (substitui waba_phone_number_id / qr_code fields anteriores)
ALTER TABLE public.bot_config
  ADD COLUMN IF NOT EXISTS waba_id               text,
  ADD COLUMN IF NOT EXISTS phone_number_id        text,
  ADD COLUMN IF NOT EXISTS access_token           text,
  ADD COLUMN IF NOT EXISTS webhook_verify_token   text,
  ADD COLUMN IF NOT EXISTS dentistas_ativos_bot   uuid[]  DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS template_orcamento     text,
  ADD COLUMN IF NOT EXISTS bot_ativo              boolean DEFAULT false;

COMMENT ON COLUMN public.bot_config.access_token IS
  'Meta App Token — armazenar criptografado na aplicação';

COMMENT ON COLUMN public.bot_config.dentistas_ativos_bot IS
  'IDs dos dentistas disponíveis para seleção pelo paciente no bot';

-- Índices de suporte
CREATE INDEX IF NOT EXISTS idx_conversas_bot_estado       ON public.conversas_bot(estado);
CREATE INDEX IF NOT EXISTS idx_conversas_bot_paciente_id  ON public.conversas_bot(paciente_id);

COMMIT;
```

**Aplicar:** `npx supabase db push` ou pelo painel Supabase.

---

### Tarefa B2: Tipos TypeScript para WhatsApp Cloud API

**Arquivo:** `src/lib/whatsapp/types.ts`

```ts
// Tipos para a WhatsApp Business Cloud API (Meta)

export type WabaMessage = {
  object: 'whatsapp_business_account';
  entry: WabaEntry[];
};

export type WabaEntry = {
  id: string;
  changes: WabaChange[];
};

export type WabaChange = {
  value: WabaValue;
  field: 'messages';
};

export type WabaValue = {
  messaging_product: 'whatsapp';
  metadata: { display_phone_number: string; phone_number_id: string };
  contacts?: WabaContact[];
  messages?: WabaIncomingMessage[];
  statuses?: WabaStatus[];
};

export type WabaContact = {
  profile: { name: string };
  wa_id: string;
};

export type WabaIncomingMessage = {
  id: string;
  from: string;       // telefone do remetente
  timestamp: string;
  type: 'text' | 'image' | 'document' | 'audio' | 'interactive' | 'button';
  text?: { body: string };
  image?: { id: string; mime_type: string; sha256: string };
  document?: { id: string; filename: string; mime_type: string };
  interactive?: {
    type: 'button_reply' | 'list_reply';
    button_reply?: { id: string; title: string };
    list_reply?: { id: string; title: string };
  };
  button?: { payload: string; text: string };
};

export type WabaStatus = {
  id: string;
  status: 'sent' | 'delivered' | 'read' | 'failed';
  timestamp: string;
  recipient_id: string;
};

// Tipos de saída (mensagens que enviamos)

export type OutboundTextMessage = {
  messaging_product: 'whatsapp';
  to: string;
  type: 'text';
  text: { body: string; preview_url?: boolean };
};

export type InteractiveButton = {
  type: 'reply';
  reply: { id: string; title: string };
};

export type OutboundInteractiveMessage = {
  messaging_product: 'whatsapp';
  to: string;
  type: 'interactive';
  interactive: {
    type: 'button';
    body: { text: string };
    action: { buttons: InteractiveButton[] };
  };
};

export type OutboundMessage = OutboundTextMessage | OutboundInteractiveMessage;

// Estado da FSM do bot
export type BotEstado =
  | 'inicio'
  | 'cadastro'
  | 'agendamento'
  | 'orcamento'
  | 'pagamento'
  | 'humano'
  | 'encerrado';

export type DadosColeta = {
  // Cadastro
  nome?: string;
  telefone?: string;
  data_nascimento?: string;
  dentista_id?: string;
  dentista_nome?: string;
  etapa_cadastro?: 'nome' | 'telefone' | 'nascimento' | 'concluido';
  // Agendamento
  data_agendamento?: string;
  hora_agendamento?: string;
  etapa_agendamento?: 'data' | 'hora' | 'confirmacao';
};
```

---

### Tarefa B3: Cliente HTTP para WhatsApp Cloud API

**Arquivo:** `src/lib/whatsapp/client.ts`

```ts
import type { OutboundMessage, OutboundInteractiveMessage, InteractiveButton } from './types';

const GRAPH_URL = 'https://graph.facebook.com/v19.0';

export async function sendWhatsAppMessage(
  phoneNumberId: string,
  accessToken: string,
  payload: OutboundMessage,
): Promise<{ error?: string }> {
  try {
    const res = await fetch(`${GRAPH_URL}/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return { error: `WhatsApp API error ${res.status}: ${JSON.stringify(body)}` };
    }
    return {};
  } catch (err) {
    return { error: String(err) };
  }
}

export async function sendText(
  to: string,
  body: string,
  phoneNumberId: string,
  accessToken: string,
): Promise<{ error?: string }> {
  return sendWhatsAppMessage(phoneNumberId, accessToken, {
    messaging_product: 'whatsapp',
    to,
    type: 'text',
    text: { body },
  });
}

export async function sendButtons(
  to: string,
  text: string,
  buttons: { id: string; title: string }[],
  phoneNumberId: string,
  accessToken: string,
): Promise<{ error?: string }> {
  const payload: OutboundInteractiveMessage = {
    messaging_product: 'whatsapp',
    to,
    type: 'interactive',
    interactive: {
      type: 'button',
      body: { text },
      action: {
        buttons: buttons.slice(0, 3).map<InteractiveButton>((b) => ({
          type: 'reply',
          reply: { id: b.id, title: b.title.slice(0, 20) },
        })),
      },
    },
  };
  return sendWhatsAppMessage(phoneNumberId, accessToken, payload);
}

export async function downloadMediaUrl(
  mediaId: string,
  accessToken: string,
): Promise<{ url?: string; error?: string }> {
  try {
    const res = await fetch(`${GRAPH_URL}/${mediaId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return { error: `Media lookup error ${res.status}` };
    const data = await res.json() as { url?: string };
    return { url: data.url };
  } catch (err) {
    return { error: String(err) };
  }
}
```

---

### Tarefa B4: Webhook endpoint da Meta

**Arquivo:** `src/app/api/webhooks/whatsapp/route.ts`

```ts
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { handleIncomingMessage } from '@/lib/whatsapp/bot-engine';
import type { WabaMessage, WabaIncomingMessage } from '@/lib/whatsapp/types';

// GET — verificação do webhook exigida pela Meta
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mode      = searchParams.get('hub.mode');
  const token     = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  if (mode !== 'subscribe' || !challenge) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  // Busca o verify_token do banco (clínica ativa via service role)
  const supabase = createServiceClient();
  const { data: config } = await supabase
    .from('bot_config')
    .select('webhook_verify_token')
    .eq('webhook_verify_token', token)
    .maybeSingle();

  if (!config) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  return new NextResponse(challenge, { status: 200 });
}

// POST — recebe mensagens e eventos
export async function POST(req: NextRequest) {
  let body: WabaMessage;
  try {
    body = await req.json() as WabaMessage;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (body.object !== 'whatsapp_business_account') {
    return NextResponse.json({ status: 'ignored' });
  }

  for (const entry of body.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (change.field !== 'messages') continue;

      const { value } = change;
      const phoneNumberId = value.metadata.phone_number_id;

      for (const msg of value.messages ?? []) {
        const contact = value.contacts?.find((c) => c.wa_id === msg.from);
        await handleIncomingMessage({
          phoneNumberId,
          from: msg.from,
          fromName: contact?.profile.name ?? '',
          message: msg,
        }).catch(console.error);
      }
    }
  }

  return NextResponse.json({ status: 'ok' });
}
```

---

### Tarefa B5: Motor do bot (máquina de estados)

**Arquivo:** `src/lib/whatsapp/bot-engine.ts`

```ts
import { createServiceClient } from '@/lib/supabase/service';
import { sendText, sendButtons } from './client';
import { handleCadastroFlow } from './flows/cadastro';
import { handleAgendamentoFlow } from './flows/agendamento';
import { handlePagamentoFlow } from './flows/pagamento';
import type { WabaIncomingMessage, BotEstado, DadosColeta } from './types';

interface IncomingContext {
  phoneNumberId: string;
  from: string;
  fromName: string;
  message: WabaIncomingMessage;
}

export async function handleIncomingMessage(ctx: IncomingContext): Promise<void> {
  const supabase = createServiceClient();

  // Busca config da clínica pelo phone_number_id
  const { data: config } = await supabase
    .from('bot_config')
    .select('id, clinica_id, bot_ativo, access_token, phone_number_id, dentistas_ativos_bot, mensagem_boas_vindas')
    .eq('phone_number_id', ctx.phoneNumberId)
    .maybeSingle();

  if (!config || !config.bot_ativo) return;

  const { clinicaId, accessToken } = {
    clinicaId: config.clinica_id as string,
    accessToken: config.access_token as string,
  };

  // Busca ou cria conversa
  let { data: conversa } = await supabase
    .from('conversas_bot')
    .select('id, estado, paciente_id, dentista_id, dados_coleta')
    .eq('clinica_id', clinicaId)
    .eq('telefone', ctx.from)
    .eq('estado', 'humano')
    .maybeSingle()
    .then(async (r) => {
      if (r.data) return r;
      return supabase
        .from('conversas_bot')
        .select('id, estado, paciente_id, dentista_id, dados_coleta')
        .eq('clinica_id', clinicaId)
        .eq('telefone', ctx.from)
        .not('estado', 'in', '("encerrado")')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
    });

  // Se conversa está em modo humano: não responde (secretária está controlando)
  if (conversa?.estado === 'humano') return;

  // Cria nova conversa se não existe
  if (!conversa) {
    const { data: nova } = await supabase
      .from('conversas_bot')
      .insert({
        clinica_id: clinicaId,
        telefone:   ctx.from,
        nome:       ctx.fromName,
        canal:      'whatsapp',
        estado:     'inicio',
        dados_coleta: {},
      })
      .select('id, estado, paciente_id, dentista_id, dados_coleta')
      .single();
    conversa = nova;
  }

  if (!conversa) return;

  // Persiste mensagem recebida
  await supabase.from('mensagens_bot').insert({
    conversa_id: conversa.id,
    clinica_id:  clinicaId,
    direcao:     'entrada',
    conteudo:    extractText(ctx.message),
    media_url:   null,
    media_type:  ctx.message.type !== 'text' ? ctx.message.type : null,
  });

  const estado = (conversa.estado ?? 'inicio') as BotEstado;
  const dadosColeta = (conversa.dados_coleta ?? {}) as DadosColeta;

  // Roteamento por estado
  switch (estado) {
    case 'inicio':
      await handleInicio({ conversa, config, ctx, clinicaId, accessToken, supabase });
      break;
    case 'cadastro':
      await handleCadastroFlow({ conversa, ctx, clinicaId, accessToken, dadosColeta, supabase, config });
      break;
    case 'agendamento':
      await handleAgendamentoFlow({ conversa, ctx, clinicaId, accessToken, dadosColeta, supabase, config });
      break;
    case 'pagamento':
      await handlePagamentoFlow({ conversa, ctx, clinicaId, accessToken, supabase, config });
      break;
    default:
      await sendText(ctx.from, 'Como posso ajudar? Digite *oi* para começar.', ctx.phoneNumberId, accessToken);
  }
}

async function handleInicio({ conversa, config, ctx, clinicaId, accessToken, supabase }: {
  conversa: { id: string };
  config: { dentistas_ativos_bot: string[] | null; mensagem_boas_vindas?: string | null };
  ctx: IncomingContext;
  clinicaId: string;
  accessToken: string;
  supabase: ReturnType<typeof createServiceClient>;
}) {
  const dentistasIds = config.dentistas_ativos_bot ?? [];
  const { data: dentistas } = await supabase
    .from('dentistas')
    .select('id, nome')
    .in('id', dentistasIds)
    .eq('ativo', true);

  const boas_vindas = config.mensagem_boas_vindas
    ?? 'Olá! Bem-vindo à nossa clínica. Qual dentista você prefere?';

  if (!dentistas || dentistas.length === 0) {
    await sendText(ctx.from, boas_vindas + '\n\nEntre em contato pelo telefone da clínica.', ctx.phoneNumberId, accessToken);
    return;
  }

  await sendButtons(
    ctx.from,
    boas_vindas,
    dentistas.map((d) => ({ id: `dentista_${d.id}`, title: d.nome.split(' ')[0] })),
    ctx.phoneNumberId,
    accessToken,
  );

  await supabase.from('conversas_bot').update({ estado: 'cadastro' }).eq('id', conversa.id);
}

function extractText(msg: WabaIncomingMessage): string {
  if (msg.type === 'text') return msg.text?.body ?? '';
  if (msg.type === 'interactive') {
    return msg.interactive?.button_reply?.title
      ?? msg.interactive?.list_reply?.title
      ?? '';
  }
  if (msg.type === 'button') return msg.button?.text ?? '';
  return `[${msg.type}]`;
}
```

---

### Tarefa B6: Fluxo de cadastro de paciente via bot

**Arquivo:** `src/lib/whatsapp/flows/cadastro.ts`

```ts
import type { DadosColeta, WabaIncomingMessage } from '../types';
import { sendText } from '../client';
import { createServiceClient } from '@/lib/supabase/service';

interface CadastroContext {
  conversa: { id: string; paciente_id: string | null };
  ctx: { from: string; message: WabaIncomingMessage; phoneNumberId: string };
  clinicaId: string;
  accessToken: string;
  dadosColeta: DadosColeta;
  supabase: ReturnType<typeof createServiceClient>;
  config: unknown;
}

export async function handleCadastroFlow(c: CadastroContext) {
  const { conversa, ctx, clinicaId, accessToken, dadosColeta, supabase } = c;
  const texto = extractInput(ctx.message);

  // Seleção de dentista (resposta de botão)
  if (!dadosColeta.dentista_id && ctx.message.type === 'interactive') {
    const payload = ctx.message.interactive?.button_reply?.id ?? '';
    if (payload.startsWith('dentista_')) {
      const dentistaId = payload.replace('dentista_', '');
      const { data: d } = await supabase.from('dentistas').select('nome').eq('id', dentistaId).maybeSingle();
      const novosDados: DadosColeta = { ...dadosColeta, dentista_id: dentistaId, dentista_nome: d?.nome, etapa_cadastro: 'nome' };
      await supabase.from('conversas_bot').update({ dados_coleta: novosDados, dentista_id: dentistaId }).eq('id', conversa.id);
      await sendText(ctx.from, `Ótimo! Dr(a). ${d?.nome ?? ''}. Qual é o seu nome completo?`, ctx.phoneNumberId, accessToken);
      return;
    }
  }

  const etapa = dadosColeta.etapa_cadastro;

  if (!dadosColeta.dentista_id || !etapa) {
    await sendText(ctx.from, 'Por favor, escolha um dentista digitando *oi* para recomeçar.', ctx.phoneNumberId, accessToken);
    return;
  }

  if (etapa === 'nome') {
    if (!texto || texto.length < 3) {
      await sendText(ctx.from, 'Por favor, informe seu nome completo.', ctx.phoneNumberId, accessToken);
      return;
    }
    const novosDados: DadosColeta = { ...dadosColeta, nome: texto, etapa_cadastro: 'telefone' };
    await supabase.from('conversas_bot').update({ dados_coleta: novosDados }).eq('id', conversa.id);
    await sendText(ctx.from, 'Obrigado! Qual é o seu celular com DDD? (Ex: 11999999999)', ctx.phoneNumberId, accessToken);
    return;
  }

  if (etapa === 'telefone') {
    const tel = texto.replace(/\D/g, '');
    if (tel.length < 10) {
      await sendText(ctx.from, 'Informe um celular válido com DDD. Ex: 11999999999', ctx.phoneNumberId, accessToken);
      return;
    }
    const novosDados: DadosColeta = { ...dadosColeta, telefone: tel, etapa_cadastro: 'nascimento' };
    await supabase.from('conversas_bot').update({ dados_coleta: novosDados }).eq('id', conversa.id);
    await sendText(ctx.from, 'Qual a sua data de nascimento? (DD/MM/AAAA)', ctx.phoneNumberId, accessToken);
    return;
  }

  if (etapa === 'nascimento') {
    const nascParsed = parseDateBR(texto);
    if (!nascParsed) {
      await sendText(ctx.from, 'Data inválida. Use o formato DD/MM/AAAA. Ex: 15/03/1990', ctx.phoneNumberId, accessToken);
      return;
    }
    // Criar paciente no sistema
    const { data: paciente, error } = await supabase.from('pacientes').insert({
      clinica_id:      clinicaId,
      dentista_id:     dadosColeta.dentista_id,
      nome:            dadosColeta.nome!,
      telefone:        dadosColeta.telefone,
      data_nascimento: nascParsed,
    }).select('id').single();

    if (error || !paciente) {
      await sendText(ctx.from, 'Ocorreu um erro ao salvar seu cadastro. Tente novamente ou ligue para a clínica.', ctx.phoneNumberId, accessToken);
      return;
    }

    await supabase.from('conversas_bot').update({
      paciente_id: paciente.id,
      estado:      'agendamento',
      dados_coleta: {},
    }).eq('id', conversa.id);

    await sendText(
      ctx.from,
      `✅ Cadastro realizado! Bem-vindo(a), ${dadosColeta.nome}!\n\nDeseja agendar uma consulta? Responda *sim* para continuar.`,
      ctx.phoneNumberId,
      accessToken,
    );
    return;
  }
}

function extractInput(msg: WabaIncomingMessage): string {
  if (msg.type === 'text') return (msg.text?.body ?? '').trim();
  if (msg.type === 'button') return (msg.button?.text ?? '').trim();
  return '';
}

function parseDateBR(input: string): string | null {
  const match = input.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (!match) return null;
  const [, d, m, y] = match;
  const date = new Date(Number(y), Number(m) - 1, Number(d));
  if (isNaN(date.getTime())) return null;
  return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
}
```

---

### Tarefa B7: Fluxo de agendamento via bot

**Arquivo:** `src/lib/whatsapp/flows/agendamento.ts`

```ts
import { sendText, sendButtons } from '../client';
import { createServiceClient } from '@/lib/supabase/service';
import type { DadosColeta, WabaIncomingMessage } from '../types';
import { format, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface AgendamentoContext {
  conversa: { id: string; paciente_id: string | null; dentista_id: string | null };
  ctx: { from: string; message: WabaIncomingMessage; phoneNumberId: string };
  clinicaId: string;
  accessToken: string;
  dadosColeta: DadosColeta;
  supabase: ReturnType<typeof createServiceClient>;
  config: unknown;
}

export async function handleAgendamentoFlow(c: AgendamentoContext) {
  const { conversa, ctx, clinicaId, accessToken, dadosColeta, supabase } = c;
  const texto = (ctx.message.text?.body ?? ctx.message.button?.text ?? '').trim().toLowerCase();

  if (!conversa.paciente_id || !conversa.dentista_id) {
    await sendText(ctx.from, 'Não encontrei seus dados. Digite *oi* para recomeçar.', ctx.phoneNumberId, accessToken);
    return;
  }

  if (!dadosColeta.etapa_agendamento) {
    if (!['sim', 's', 'yes'].includes(texto)) {
      await sendText(ctx.from, 'Tudo certo! Se precisar de algo, é só chamar.', ctx.phoneNumberId, accessToken);
      await supabase.from('conversas_bot').update({ estado: 'encerrado' }).eq('id', conversa.id);
      return;
    }
    // Oferecer próximos 5 dias úteis
    const dias = getProximasDatas(5);
    await sendButtons(
      ctx.from,
      'Escolha uma data para sua consulta:',
      dias.map((d) => ({ id: `data_${d.iso}`, title: d.label })),
      ctx.phoneNumberId,
      accessToken,
    );
    await supabase.from('conversas_bot').update({ dados_coleta: { ...dadosColeta, etapa_agendamento: 'data' } }).eq('id', conversa.id);
    return;
  }

  if (dadosColeta.etapa_agendamento === 'data') {
    const payload = ctx.message.interactive?.button_reply?.id ?? '';
    if (!payload.startsWith('data_')) {
      await sendText(ctx.from, 'Por favor, escolha uma das opções acima.', ctx.phoneNumberId, accessToken);
      return;
    }
    const dataISO = payload.replace('data_', '');
    // Busca horários disponíveis do dentista
    const horarios = await getHorariosDisponiveis(supabase, clinicaId, conversa.dentista_id, dataISO);
    if (horarios.length === 0) {
      await sendText(ctx.from, 'Não há horários disponíveis nessa data. Escolha outro dia digitando *agenda*.', ctx.phoneNumberId, accessToken);
      return;
    }
    await sendButtons(
      ctx.from,
      `Horários disponíveis em ${formatDateBR(dataISO)}:`,
      horarios.slice(0, 3).map((h) => ({ id: `hora_${dataISO}_${h}`, title: h })),
      ctx.phoneNumberId,
      accessToken,
    );
    await supabase.from('conversas_bot').update({
      dados_coleta: { ...dadosColeta, data_agendamento: dataISO, etapa_agendamento: 'hora' },
    }).eq('id', conversa.id);
    return;
  }

  if (dadosColeta.etapa_agendamento === 'hora') {
    const payload = ctx.message.interactive?.button_reply?.id ?? '';
    if (!payload.startsWith('hora_')) {
      await sendText(ctx.from, 'Por favor, escolha um horário acima.', ctx.phoneNumberId, accessToken);
      return;
    }
    const parts = payload.replace('hora_', '').split('_');
    const dataISO = parts[0];
    const hora    = parts[1];

    const dataHora = `${dataISO}T${hora}:00-03:00`;
    await supabase.from('agendamentos').insert({
      clinica_id:      clinicaId,
      paciente_id:     conversa.paciente_id,
      dentista_id:     conversa.dentista_id,
      data_hora:       dataHora,
      duracao_minutos: 30,
      status:          'scheduled',
      origem:          'whatsapp',
    });

    await sendText(
      ctx.from,
      `✅ Consulta agendada!\n📅 ${formatDateBR(dataISO)} às ${hora}\n\nEnviaremos um lembrete antes. Até lá! 😊`,
      ctx.phoneNumberId,
      accessToken,
    );
    await supabase.from('conversas_bot').update({ estado: 'encerrado', dados_coleta: {} }).eq('id', conversa.id);
  }
}

function getProximasDatas(n: number): { iso: string; label: string }[] {
  const result: { iso: string; label: string }[] = [];
  let d = new Date();
  while (result.length < n) {
    d = addDays(d, 1);
    if (d.getDay() !== 0 && d.getDay() !== 6) {
      result.push({
        iso:   format(d, 'yyyy-MM-dd'),
        label: format(d, "EEE dd/MM", { locale: ptBR }),
      });
    }
  }
  return result;
}

async function getHorariosDisponiveis(
  supabase: ReturnType<typeof createServiceClient>,
  clinicaId: string,
  dentistaId: string,
  dataISO: string,
): Promise<string[]> {
  const diaSemana = new Date(dataISO + 'T12:00:00').getDay();
  const { data: horarios } = await supabase
    .from('horarios_disponiveis')
    .select('hora_inicio, hora_fim')
    .eq('clinica_id', clinicaId)
    .eq('dentista_id', dentistaId)
    .eq('dia_semana', diaSemana)
    .eq('ativo', true)
    .order('hora_inicio');

  if (!horarios || horarios.length === 0) return [];

  // Gera slots de 30 min dentro dos horários
  const slots: string[] = [];
  for (const h of horarios) {
    const [startH, startM] = h.hora_inicio.split(':').map(Number);
    const [endH, endM]     = h.hora_fim.split(':').map(Number);
    let cur = startH * 60 + startM;
    const end = endH * 60 + endM;
    while (cur + 30 <= end) {
      const hh = String(Math.floor(cur / 60)).padStart(2, '0');
      const mm = String(cur % 60).padStart(2, '0');
      slots.push(`${hh}:${mm}`);
      cur += 30;
    }
  }
  return slots;
}

function formatDateBR(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}
```

---

### Tarefa B8: Fluxo de pagamento via comprovante

**Arquivo:** `src/lib/whatsapp/flows/pagamento.ts`

```ts
import { sendText } from '../client';
import { downloadMediaUrl } from '../client';
import { createServiceClient } from '@/lib/supabase/service';
import type { WabaIncomingMessage } from '../types';

interface PagamentoContext {
  conversa: { id: string; paciente_id: string | null };
  ctx: { from: string; message: WabaIncomingMessage; phoneNumberId: string };
  clinicaId: string;
  accessToken: string;
  supabase: ReturnType<typeof createServiceClient>;
  config: { access_token: string; phone_number_id: string };
}

export async function handlePagamentoFlow(c: PagamentoContext) {
  const { conversa, ctx, clinicaId, accessToken, supabase } = c;

  // Recebeu imagem — tenta verificar comprovante
  if (ctx.message.type === 'image' && ctx.message.image) {
    const mediaId = ctx.message.image.id;
    const { url } = await downloadMediaUrl(mediaId, c.config.access_token);

    if (!url) {
      await sendText(ctx.from, 'Não consegui processar a imagem. Tente enviar novamente.', ctx.phoneNumberId, accessToken);
      return;
    }

    // Notifica secretária para revisão manual
    // (OCR automático pode ser integrado aqui — ex: Google Vision API)
    await notificarSecretariaComprovante(supabase, clinicaId, {
      conversaId:  conversa.id,
      pacienteId:  conversa.paciente_id,
      mediaUrl:    url,
      telefone:    ctx.from,
    });

    // Persiste a mídia na mensagem
    await supabase.from('mensagens_bot').update({ media_url: url, media_type: 'image' })
      .eq('conversa_id', conversa.id)
      .order('created_at', { ascending: false })
      .limit(1);

    await sendText(
      ctx.from,
      '✅ Comprovante recebido! Nossa equipe irá verificar e confirmar seu pagamento em breve.',
      ctx.phoneNumberId,
      accessToken,
    );
    return;
  }

  await sendText(
    ctx.from,
    'Para registrar seu pagamento, envie uma foto do comprovante.',
    ctx.phoneNumberId,
    accessToken,
  );
}

async function notificarSecretariaComprovante(
  supabase: ReturnType<typeof createServiceClient>,
  clinicaId: string,
  dados: { conversaId: string; pacienteId: string | null; mediaUrl: string; telefone: string },
) {
  await supabase.from('notificacoes').insert({
    clinica_id: clinicaId,
    para_role:  'secretaria',
    tipo:       'comprovante_recebido',
    titulo:     'Comprovante de pagamento recebido',
    mensagem:   `Comprovante recebido pelo WhatsApp do número ${dados.telefone}. Revisar e confirmar.`,
    dados:      {
      conversa_id: dados.conversaId,
      paciente_id: dados.pacienteId,
      media_url:   dados.mediaUrl,
    },
  });
}
```

---

### Tarefa B9: Configuração UI — Admin (API Oficial)

**Arquivo:** `src/app/dashboard/configuracoes/whatsapp/_components/aba-conexao.tsx`

Substituir o conteúdo atual (QR code + pairing) pela interface de configuração da API Oficial:

```tsx
// Remover: QRCode, botão de conectar via QR, status de instância
// Adicionar: campos para WABA ID, Phone Number ID, Access Token, Verify Token

<div className="space-y-5">
  <div className="bg-surface-alt rounded-2xl border border-border p-5 space-y-2">
    <p className="text-sm font-semibold text-text-primary">WhatsApp Business Cloud API</p>
    <p className="text-xs text-text-secondary">
      Configure as credenciais do seu app Meta Business para conectar o número oficial.
    </p>
  </div>

  {/* WABA ID */}
  <AppFormField>
    <AppLabel>WhatsApp Business Account ID</AppLabel>
    <Input value={wabaId} onChange={(e) => setWabaId(e.target.value)}
      className="rounded-xl bg-surface-alt border-border"
      placeholder="123456789012345" />
  </AppFormField>

  {/* Phone Number ID */}
  <AppFormField>
    <AppLabel>Phone Number ID</AppLabel>
    <Input value={phoneNumberId} onChange={(e) => setPhoneNumberId(e.target.value)}
      className="rounded-xl bg-surface-alt border-border"
      placeholder="109876543210987" />
  </AppFormField>

  {/* Access Token */}
  <AppFormField>
    <AppLabel>Access Token</AppLabel>
    <Input type="password" value={accessToken} onChange={(e) => setAccessToken(e.target.value)}
      className="rounded-xl bg-surface-alt border-border"
      placeholder="EAAxxxxx..." />
  </AppFormField>

  {/* Webhook Verify Token */}
  <AppFormField>
    <AppLabel>Webhook Verify Token</AppLabel>
    <div className="flex gap-2">
      <Input value={verifyToken} readOnly className="rounded-xl bg-surface-alt border-border flex-1" />
      <button onClick={gerarVerifyToken}
        className="px-3 py-2 rounded-xl border border-border text-xs font-semibold text-text-secondary hover:bg-surface-alt transition-colors">
        Gerar
      </button>
    </div>
    <p className="text-xs text-text-secondary">
      Cole este token no painel do Meta Developers → Webhooks → Verify Token
    </p>
  </AppFormField>

  {/* URL do webhook */}
  <div className="bg-surface-alt rounded-xl border border-border px-4 py-3">
    <p className="text-[10px] font-bold uppercase tracking-widest text-text-secondary mb-1">URL do Webhook</p>
    <p className="text-xs font-mono text-text-primary break-all">
      {process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/whatsapp
    </p>
  </div>

  <Button onClick={handleSalvarConexao} disabled={saving}
    className="w-full bg-gradient-to-r from-teal to-teal-lt text-white rounded-xl">
    {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
    Salvar Configuração
  </Button>
</div>
```

**Em `aba-configuracoes.tsx`:** Adicionar seção "Dentistas no Bot" — multiselect dos dentistas ativos da clínica (para `dentistas_ativos_bot`).

---

### Tarefa B10: Supervisão UI — Secretária

**Arquivo:** `src/app/dashboard/whatsapp/_components/whatsapp-client.tsx`

Adicionar na lista de conversas:

**1. Badge de estado visual:**
```tsx
const ESTADO_BADGE: Record<string, { label: string; cls: string }> = {
  inicio:      { label: 'Iniciando',  cls: 'bg-surface-alt text-text-secondary' },
  cadastro:    { label: 'Cadastro',   cls: 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400' },
  agendamento: { label: 'Agendando',  cls: 'bg-teal/10 text-teal' },
  orcamento:   { label: 'Orçamento',  cls: 'bg-surface-alt text-text-secondary' },
  pagamento:   { label: '⚠️ Comprov.',cls: 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400' },
  humano:      { label: 'Humano',     cls: 'bg-coral/10 text-coral' },
  encerrado:   { label: 'Encerrado',  cls: 'bg-surface-alt text-text-secondary' },
};
```

**2. Botão "Assumir Conversa":**
```tsx
{conversa.estado !== 'humano' && (
  <button onClick={() => assumirConversa(conversa.id)}
    className="text-xs font-semibold text-text-secondary hover:text-teal hover:bg-teal/5 px-2.5 py-1.5 rounded-lg border border-border transition-all">
    Assumir
  </button>
)}
{conversa.estado === 'humano' && (
  <button onClick={() => devolverParaBot(conversa.id)}
    className="text-xs font-semibold text-teal bg-teal/10 px-2.5 py-1.5 rounded-lg border border-teal/20 transition-all">
    Devolver ao bot
  </button>
)}
```

**3. Painel de comprovante** (quando `estado === 'pagamento'`):
```tsx
{conversa.estado === 'pagamento' && comprovanteUrl && (
  <div className="mt-3 rounded-xl border border-amber-200 dark:border-amber-800/40 bg-amber-50 dark:bg-amber-900/20 p-4 space-y-3">
    <p className="text-xs font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wide">
      Comprovante aguardando verificação
    </p>
    <img src={comprovanteUrl} alt="Comprovante" className="rounded-lg max-h-48 object-cover w-full" />
    <div className="flex gap-2">
      <button onClick={() => confirmarPagamento(conversa.id)}
        className="flex-1 bg-teal text-white rounded-lg py-2 text-xs font-bold hover:bg-teal-lt transition-colors">
        Confirmar Pagamento
      </button>
      <button onClick={() => recusarPagamento(conversa.id)}
        className="flex-1 border border-border text-text-secondary rounded-lg py-2 text-xs font-semibold hover:bg-surface-alt transition-colors">
        Recusar
      </button>
    </div>
  </div>
)}
```

**Em `whatsapp/actions.ts`:** Adicionar `assumirConversa`, `devolverParaBot`, `confirmarPagamento`, `recusarPagamento` que atualizam `estado` na tabela `conversas_bot`.

---

## Ordem de execução recomendada

```
A1 → A2 → A3 → A4 → A5 → A6 → A7  (Sprint A — 1 a 2 dias)
B1 → B2 → B3 → B4 → B5 → B6 → B7 → B8 → B9 → B10  (Sprint B — 3 a 4 dias)
```

Sprint A pode entrar em produção independentemente. Sprint B depende do acesso à API Oficial da Meta.
