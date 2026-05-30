# Plano: Redesign do Modal de Novo Orçamento

## Goal
Reformular o modal de criação de orçamento para:
1. Layout dois colunas (`max-w-3xl`) — esquerda scrollável, direita sticky com resumo
2. Checklist de procedimentos pendentes da ficha do paciente (seleção parcial para pagamento)
3. Botões de desconto rápido: 5%, 10%, 15% (além do input manual em R$)

## Architecture Overview
Toda a mudança é no componente cliente existente:
`src/app/dashboard/orcamentos/_components/orcamentos-client.tsx`

- Nenhuma migration necessária (`desconto` já existe na tabela)
- Nenhuma server action nova — a busca de fichas é feita client-side via Supabase (padrão do projeto para queries interativas)
- `criarOrcamento` já aceita `desconto` e `itens` — sem mudança no backend

## File Structure Map

| Arquivo | Operação |
|---|---|
| `src/app/dashboard/orcamentos/_components/orcamentos-client.tsx` | **Modificado** |

---

## Task 1 — Tipos, estado e lógica de ficha + desconto %

**Arquivo:** `src/app/dashboard/orcamentos/_components/orcamentos-client.tsx`

**Objetivo:** Adicionar o tipo `FichaProc`, estender `NovoOrcItem` com `fichaKey?`, inserir os novos estados, a função de busca de procedimentos da ficha, e o efeito de desconto por percentual.

**Passos:**

### 1a — Estender `NovoOrcItem` com `fichaKey`

Localizar a interface existente (linha ~94):
```typescript
interface NovoOrcItem {
  procedimentoId: string;
  descricao: string;
  quantidade: number;
  preco: string;
}
```

Substituir por:
```typescript
interface NovoOrcItem {
  procedimentoId: string;
  descricao: string;
  quantidade: number;
  preco: string;
  /** Preenchido quando o item veio da seleção na ficha do paciente */
  fichaKey?: string;
}
```

### 1b — Adicionar tipo `FichaProc` logo acima de `NovoOrcItem`:

```typescript
interface FichaProc {
  fichaId: string;
  fichaDate: string;
  tooth: number;
  descricao: string;
  /** `${fichaId}::${tooth}_${noteIndex}` — chave global única */
  globalKey: string;
}
```

### 1c — Adicionar novos estados dentro de `OrcamentosClient`, após o bloco de estado de "novo orçamento" (após linha ~138):

```typescript
// Procedimentos da ficha (carregados ao selecionar paciente)
const [fichaProcs, setFichaProcs] = useState<FichaProc[]>([]);
const [fichaProcsLoading, setFichaProcsLoading] = useState(false);
const [selectedFichaKeys, setSelectedFichaKeys] = useState<Set<string>>(new Set());

// Desconto por percentual (null = sem percentual ativo, controle manual)
const [descontoPercent, setDescontoPercent] = useState<5 | 10 | 15 | null>(null);
```

### 1d — Adicionar `buscarProcedimentosFicha` junto ao `buscarPacientes` (após linha ~201):

```typescript
const buscarProcedimentosFicha = useCallback(async (pacienteId: string) => {
  if (!pacienteId) { setFichaProcs([]); return; }
  setFichaProcsLoading(true);
  const supabase = createClient();
  const { data } = await supabase
    .from('fichas')
    .select('id, created_at, dentes_afetados, dentes_observacoes, procedimentos_concluidos')
    .eq('paciente_id', pacienteId)
    .eq('clinica_id', clinicaId)
    .order('created_at', { ascending: false });

  const procs: FichaProc[] = [];
  for (const ficha of (data ?? []) as {
    id: string;
    created_at: string;
    dentes_afetados: number[];
    dentes_observacoes: Record<string, string>;
    procedimentos_concluidos: string[];
  }[]) {
    const done = new Set(ficha.procedimentos_concluidos ?? []);
    for (const tooth of (ficha.dentes_afetados ?? [])) {
      const raw = ficha.dentes_observacoes?.[String(tooth)] ?? '';
      raw.split('\n').filter(Boolean).forEach((note, i) => {
        const key = `${tooth}_${i}`;
        if (!done.has(key)) {
          procs.push({
            fichaId: ficha.id,
            fichaDate: ficha.created_at,
            tooth,
            descricao: note,
            globalKey: `${ficha.id}::${key}`,
          });
        }
      });
    }
  }
  setFichaProcs(procs);
  setFichaProcsLoading(false);
}, [clinicaId]);
```

### 1e — Adicionar handler de toggle do checklist logo após `buscarProcedimentosFicha`:

```typescript
const handleToggleFichaProc = useCallback((proc: FichaProc) => {
  const isSelected = selectedFichaKeys.has(proc.globalKey);

  if (isSelected) {
    setNovoOrcItens(prev => prev.filter(i => i.fichaKey !== proc.globalKey));
    setSelectedFichaKeys(prev => {
      const next = new Set(prev);
      next.delete(proc.globalKey);
      return next;
    });
  } else {
    const newItem: NovoOrcItem = {
      procedimentoId: '',
      descricao: `Dente ${proc.tooth} – ${proc.descricao}`,
      quantidade: 1,
      preco: '',
      fichaKey: proc.globalKey,
    };
    setNovoOrcItens(prev => {
      // Remove o item placeholder inicial vazio se ainda não foi preenchido
      const cleaned = prev.filter(i => i.descricao !== '' || i.preco !== '');
      return [...cleaned, newItem];
    });
    setSelectedFichaKeys(prev => new Set([...prev, proc.globalKey]));
  }
}, [selectedFichaKeys]);
```

### 1f — Adicionar efeito de desconto por percentual após os estados (após a declaração de `novoOrcTotal`):

```typescript
// Recalcula desconto em R$ quando percentual ou subtotal mudam
useEffect(() => {
  if (descontoPercent !== null) {
    setNovoOrcDesconto(
      Math.round(novoOrcSubtotal * descontoPercent) / 100
    );
  }
}, [descontoPercent, novoOrcSubtotal]);
```

### 1g — Localizar a função de reset (dentro de `handleCriarOrcamento`, após o `if (result.id)`) e adicionar reset do novo estado:

Encontrar o bloco que contém:
```typescript
setNovoOrcDesconto(0);
setNovoOrcPacienteSearch('');
setNovoOrcPacienteId('');
```

Adicionar logo depois:
```typescript
setFichaProcs([]);
setSelectedFichaKeys(new Set());
setDescontoPercent(null);
setFichaProcsLoading(false);
```

### 1h — Verificar tipos:
```bash
npm run typecheck
```
Esperado: 0 erros nos novos tipos.

---

## Task 2 — Disparo do fetch de fichas ao selecionar paciente

**Arquivo:** `src/app/dashboard/orcamentos/_components/orcamentos-client.tsx`

**Objetivo:** Quando o dentista seleciona um paciente no autocomplete, disparar `buscarProcedimentosFicha` e limpar seleções anteriores.

### 2a — Localizar o bloco do autocomplete de pacientes onde o paciente é selecionado (linha ~1519-1534). O `onClick` do item da lista:

```typescript
onClick={() => {
  setNovoOrcPacienteSearch(p.nome);
  setNovoOrcPacienteId(p.id);
  setNovoOrcPacienteNome(p.nome);
  setShowSugestoes(false);
  setPacienteSugestoes([]);
}}
```

Substituir por:

```typescript
onClick={() => {
  setNovoOrcPacienteSearch(p.nome);
  setNovoOrcPacienteId(p.id);
  setNovoOrcPacienteNome(p.nome);
  setShowSugestoes(false);
  setPacienteSugestoes([]);
  // Limpa seleções anteriores e carrega procedimentos da ficha
  setSelectedFichaKeys(new Set());
  setNovoOrcItens([{ procedimentoId: '', descricao: '', quantidade: 1, preco: '' }]);
  void buscarProcedimentosFicha(p.id);
}}
```

### 2b — Verificar tipos:
```bash
npm run typecheck
```

---

## Task 3 — Redesign do Dialog: shell dois colunas + coluna direita

**Arquivo:** `src/app/dashboard/orcamentos/_components/orcamentos-client.tsx`

**Objetivo:** Substituir o `DialogContent` atual (max-w-lg, scroll único) pelo novo shell dois colunas e implementar a coluna direita completa (desconto + totais + botões).

### 3a — Localizar o Dialog de Novo Orçamento (linha ~1466):

```tsx
<Dialog open={isNovoOrcOpen} onOpenChange={setIsNovoOrcOpen}>
  <DialogContent className="max-w-lg rounded-2xl bg-card border-border max-h-[90vh] overflow-y-auto scrollbar-hide">
```

Substituir **toda** a `<DialogContent>` e seu conteúdo (até o `</Dialog>` de fechamento do modal de novo orçamento, linha ~1726) pelo bloco abaixo.

> **ATENÇÃO:** Preservar os outros Dialogs antes e depois (confirmar exclusão, traduzir). Substituir apenas o Dialog que abre com `open={isNovoOrcOpen}`.

```tsx
<Dialog open={isNovoOrcOpen} onOpenChange={setIsNovoOrcOpen}>
  <DialogContent className="max-w-3xl rounded-2xl bg-card border-border p-0 overflow-hidden gap-0 max-h-[90vh]">
    <div className="flex" style={{ maxHeight: '90vh' }}>

      {/* ── Coluna esquerda: scrollável ── */}
      <div className="flex-1 min-w-0 overflow-y-auto p-6 space-y-5">
        <DialogHeader>
          <DialogTitle className="font-heading text-2xl text-foreground">
            Novo Orçamento
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Selecione o paciente e os procedimentos a cobrar.
          </DialogDescription>
        </DialogHeader>

        {/* Seletor de dentista — apenas para secretária */}
        {isSecretaria && dentistas.length > 1 && (
          <div className="space-y-2">
            <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
              Dentista <span className="text-red-500">*</span>
            </Label>
            <select
              value={novoOrcDentistaId}
              onChange={(e) => setNovoOrcDentistaId(e.target.value)}
              className="w-full rounded-xl bg-muted border border-border text-foreground px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal/50"
            >
              {dentistas.map((d) => (
                <option key={d.id} value={d.id}>{d.nome}</option>
              ))}
            </select>
          </div>
        )}

        {/* Busca de paciente */}
        <div className="space-y-2 relative">
          <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
            Paciente <span className="text-red-500">*</span>
          </Label>
          <Input
            placeholder="Digite o nome do paciente..."
            value={novoOrcPacienteSearch}
            autoComplete="off"
            onChange={(e) => {
              const v = e.target.value;
              setNovoOrcPacienteSearch(v);
              setNovoOrcPacienteId('');
              setNovoOrcPacienteNome('');
              setShowSugestoes(true);
              void buscarPacientes(v);
            }}
            className="rounded-xl bg-muted border-border text-foreground"
          />
          {showSugestoes && pacienteSugestoes.length > 0 && (
            <div className="absolute z-50 w-full bg-card border border-border rounded-xl shadow-lg mt-1 overflow-hidden">
              {pacienteSugestoes.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    setNovoOrcPacienteSearch(p.nome);
                    setNovoOrcPacienteId(p.id);
                    setNovoOrcPacienteNome(p.nome);
                    setShowSugestoes(false);
                    setPacienteSugestoes([]);
                    setSelectedFichaKeys(new Set());
                    setNovoOrcItens([{ procedimentoId: '', descricao: '', quantidade: 1, preco: '' }]);
                    void buscarProcedimentosFicha(p.id);
                  }}
                  className="w-full px-4 py-2.5 text-sm text-left hover:bg-muted transition-colors text-foreground"
                >
                  {p.nome}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── Checklist de procedimentos da ficha ── */}
        {novoOrcPacienteId && (
          <div className="space-y-2">
            <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block">
              Procedimentos Pendentes na Ficha
            </Label>
            {fichaProcsLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-3">
                <Loader2 className="w-4 h-4 animate-spin" />
                Carregando fichas...
              </div>
            ) : fichaProcs.length === 0 ? (
              <p className="text-xs text-muted-foreground bg-muted rounded-xl px-4 py-3 border border-border">
                Nenhum procedimento pendente registrado nas fichas deste paciente.
              </p>
            ) : (
              <div className="rounded-xl border border-border overflow-hidden">
                {fichaProcs.map((proc) => {
                  const isSelected = selectedFichaKeys.has(proc.globalKey);
                  const date = new Date(proc.fichaDate).toLocaleDateString('pt-BR', {
                    day: '2-digit', month: '2-digit', year: '2-digit',
                  });
                  return (
                    <button
                      key={proc.globalKey}
                      type="button"
                      onClick={() => handleToggleFichaProc(proc)}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors border-b border-border last:border-b-0 ${
                        isSelected
                          ? 'bg-teal/5 hover:bg-teal/10'
                          : 'hover:bg-muted'
                      }`}
                    >
                      <div className={`w-4 h-4 rounded border-2 shrink-0 flex items-center justify-center transition-colors ${
                        isSelected
                          ? 'bg-teal border-teal'
                          : 'border-border bg-transparent'
                      }`}>
                        {isSelected && <Check className="w-2.5 h-2.5 text-white" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {proc.descricao}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="font-mono text-[10px] font-bold text-teal">D{proc.tooth}</span>
                          <span className="text-[10px] text-muted-foreground">{date}</span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── Itens selecionados ── */}
        <div className="space-y-3">
          <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block">
            Itens do Orçamento
          </Label>

          {novoOrcItens.map((item, idx) => (
            <div key={idx} className="bg-muted rounded-2xl border border-border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest">
                  {item.fichaKey ? `Da ficha` : `Item ${idx + 1}`}
                </span>
                {novoOrcItens.length > 1 && (
                  <button
                    onClick={() => {
                      if (item.fichaKey) {
                        setSelectedFichaKeys(prev => {
                          const next = new Set(prev);
                          next.delete(item.fichaKey!);
                          return next;
                        });
                      }
                      setNovoOrcItens(prev => prev.filter((_, i) => i !== idx));
                    }}
                    className="p-1 text-red-400 hover:text-red-500 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <Select
                value={item.procedimentoId}
                onValueChange={(v) => {
                  if (!v) return;
                  const proc = procedimentosClinica.find((p) => p.id === v);
                  setNovoOrcItens(prev =>
                    prev.map((it, i) =>
                      i === idx
                        ? {
                            ...it,
                            procedimentoId: v,
                            descricao: proc?.nome ?? it.descricao,
                            preco: proc?.preco_padrao != null ? floatToCents(proc.preco_padrao) : it.preco,
                          }
                        : it
                    )
                  );
                }}
              >
                <SelectTrigger className="rounded-xl bg-card border-border text-foreground">
                  <SelectValue>
                    {(v: string | null) =>
                      v
                        ? (procedimentosClinica.find((p) => p.id === v)?.nome ?? v)
                        : 'Vincular ao catálogo (preenche preço)...'
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  {procedimentosClinica.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Input
                placeholder="Descrição do procedimento *"
                value={item.descricao}
                onChange={(e) =>
                  setNovoOrcItens(prev =>
                    prev.map((it, i) =>
                      i === idx ? { ...it, descricao: e.target.value } : it
                    )
                  )
                }
                className="rounded-xl bg-card border-border text-foreground"
              />

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Qtd</Label>
                  <Input
                    type="number"
                    min="1"
                    value={item.quantidade}
                    onChange={(e) =>
                      setNovoOrcItens(prev =>
                        prev.map((it, i) =>
                          i === idx
                            ? { ...it, quantidade: parseInt(e.target.value) || 1 }
                            : it
                        )
                      )
                    }
                    className="rounded-xl bg-card border-border text-foreground font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Valor unitário (R$)</Label>
                  <Input
                    type="text"
                    inputMode="numeric"
                    placeholder="0,00"
                    value={formatCents(item.preco)}
                    onChange={(e) =>
                      setNovoOrcItens(prev =>
                        prev.map((it, i) =>
                          i === idx ? { ...it, preco: e.target.value.replace(/\D/g, '') } : it
                        )
                      )
                    }
                    className="rounded-xl bg-card border-border text-foreground font-mono"
                  />
                </div>
              </div>
            </div>
          ))}

          <button
            onClick={() =>
              setNovoOrcItens(prev => [
                ...prev,
                { procedimentoId: '', descricao: '', quantidade: 1, preco: '' },
              ])
            }
            className="w-full py-3 border border-dashed border-border rounded-xl text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors flex items-center justify-center gap-2"
          >
            <Plus className="w-3.5 h-3.5" />
            Adicionar item manual
          </button>
        </div>
      </div>

      {/* ── Coluna direita: sticky ── */}
      <div className="w-72 shrink-0 border-l border-border flex flex-col bg-muted/20">
        <div className="flex-1 p-6 space-y-5 overflow-y-auto">

          {/* Desconto */}
          <div className="space-y-3">
            <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block">
              Desconto
            </Label>

            {/* Botões rápidos de % */}
            <div className="flex gap-2">
              {([5, 10, 15] as const).map((pct) => (
                <button
                  key={pct}
                  type="button"
                  onClick={() =>
                    setDescontoPercent(prev => (prev === pct ? null : pct))
                  }
                  className={`flex-1 py-2 rounded-xl text-sm font-bold border transition-all ${
                    descontoPercent === pct
                      ? 'bg-teal text-white border-teal shadow-[0_0_12px_rgba(47,156,133,0.3)]'
                      : 'bg-card border-border text-muted-foreground hover:border-teal/50 hover:text-foreground'
                  }`}
                >
                  {pct}%
                </button>
              ))}
            </div>

            {/* Input manual */}
            <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2">
              <span className="text-xs text-muted-foreground shrink-0">R$</span>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={novoOrcDesconto || ''}
                onChange={(e) => {
                  setDescontoPercent(null);
                  setNovoOrcDesconto(Math.max(0, parseFloat(e.target.value) || 0));
                }}
                placeholder="0,00"
                className="rounded-lg bg-transparent border-0 text-right font-mono text-sm p-0 h-auto focus-visible:ring-0 shadow-none"
              />
            </div>
          </div>

          {/* Resumo financeiro */}
          <div className="bg-teal/5 rounded-2xl p-4 space-y-2 border border-teal/15">
            {novoOrcDesconto > 0 && (
              <>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Subtotal</span>
                  <span className="font-mono">{formatCurrency(novoOrcSubtotal)}</span>
                </div>
                <div className="flex items-center justify-between text-xs text-red-500">
                  <span>
                    Desconto{descontoPercent ? ` (${descontoPercent}%)` : ''}
                  </span>
                  <span className="font-mono">– {formatCurrency(novoOrcDesconto)}</span>
                </div>
                <div className="border-t border-teal/15 pt-2" />
              </>
            )}
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-foreground">Total</span>
              <span className="font-mono text-2xl font-bold text-teal">
                {formatCurrency(novoOrcTotal)}
              </span>
            </div>
            <p className="text-[10px] text-muted-foreground text-right font-mono">
              {novoOrcItens.filter(i => i.descricao || i.preco).length} item(s)
            </p>
          </div>
        </div>

        {/* Botões de ação — fixos no rodapé da coluna direita */}
        <div className="p-6 border-t border-border space-y-2">
          {orcError && (
            <p className="text-xs text-red-500 bg-red-500/10 rounded-lg px-3 py-2 mb-2">{orcError}</p>
          )}
          <Button
            onClick={() => void handleCriarOrcamento()}
            disabled={orcSaving}
            className="w-full bg-teal text-white hover:bg-teal-lt rounded-xl disabled:opacity-50 font-bold"
          >
            {orcSaving ? 'Salvando...' : 'Criar Orçamento'}
          </Button>
          <Button
            variant="outline"
            onClick={() => setIsNovoOrcOpen(false)}
            className="w-full rounded-xl border-border text-foreground hover:bg-muted"
          >
            Cancelar
          </Button>
        </div>
      </div>

    </div>
  </DialogContent>
</Dialog>
```

### 3b — Remover o import `DialogFooter` se não for mais usado em nenhum outro Dialog no arquivo:

Verificar se `DialogFooter` ainda aparece em outros Dialogs (ex: Traduzir). Se aparecer, manter o import. Se não, remover da linha de imports do `@/components/ui/dialog`.

### 3c — Verificar tipos e build:
```bash
npm run typecheck
```

---

## Task 4 — Reset completo e verificação final

**Arquivo:** `src/app/dashboard/orcamentos/_components/orcamentos-client.tsx`

**Objetivo:** Garantir que fechar o modal (via `onOpenChange`) ou clicar Cancelar reseta todo o estado novo corretamente.

### 4a — Localizar o `onOpenChange` do Dialog:

```tsx
<Dialog open={isNovoOrcOpen} onOpenChange={setIsNovoOrcOpen}>
```

Substituir por um handler explícito:

```tsx
<Dialog
  open={isNovoOrcOpen}
  onOpenChange={(open) => {
    if (!open) {
      setIsNovoOrcOpen(false);
      setNovoOrcItens([{ procedimentoId: '', descricao: '', quantidade: 1, preco: '' }]);
      setNovoOrcDesconto(0);
      setNovoOrcPacienteSearch('');
      setNovoOrcPacienteId('');
      setNovoOrcPacienteNome('');
      setOrcError(null);
      setFichaProcs([]);
      setSelectedFichaKeys(new Set());
      setDescontoPercent(null);
      setFichaProcsLoading(false);
    } else {
      setIsNovoOrcOpen(true);
    }
  }}
>
```

### 4b — Verificar o `handleCriarOrcamento` já tem o reset do novo estado (adicionado na Task 1g). Confirmar que `descontoPercent` e `selectedFichaKeys` são resetados ali também.

### 4c — Typecheck final + lint:
```bash
npm run typecheck && npm run lint
```
Esperado: 0 erros.

---

## Checklist de Spec Coverage

| Requisito | Task |
|---|---|
| Layout dois colunas `max-w-3xl` | Task 3 |
| Coluna esquerda scrollável | Task 3 |
| Coluna direita sticky com resumo | Task 3 |
| Checklist de procedimentos pendentes da ficha | Task 3 |
| Fetch client-side ao selecionar paciente | Task 2 |
| Desmarcar procedimento remove item correspondente | Task 1e + Task 3 |
| Botões 5%, 10%, 15% | Task 3 |
| Input manual de desconto em R$ | Task 3 |
| % ativo destaca em teal, clique duplo desativa | Task 3 |
| Desconto recalcula ao mudar subtotal | Task 1f |
| Reset completo ao fechar modal | Task 4 |
| `fichaKey` rastreia origem do item | Task 1a + Task 1e |

---

## Execution Options

1. **Subagent-Driven** (recomendado) — invoke `superpowers:subagent-driven-development`
2. **Inline** — invoke `superpowers:executing-plans`
