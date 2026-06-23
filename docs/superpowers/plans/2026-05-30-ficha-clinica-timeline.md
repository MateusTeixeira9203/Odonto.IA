# Plano — Ficha Clínica como Timeline Clínica (Bloco 3)

**Spec:** `docs/superpowers/specs/2026-05-30-sprint2-bloco3-ficha-clinica-timeline.md`  
**Arquivo único:** `src/components/pacientes/FichasTab.tsx` (~1400 linhas)  
**Stack:** Next.js App Router · TypeScript strict · Framer Motion · Tailwind CSS v4 · lucide-react  

---

## Contexto do arquivo

`FichasTab.tsx` é um componente cliente que:
- Busca fichas do Supabase (`fetchFichas`) e as mapeia para `Evolution[]`
- Renderiza um painel de formulário deslizante (animado com `AnimatePresence`)
- Renderiza uma timeline onde **todos os cards estão sempre expandidos**
- O formulário tem uma coluna esquerda (tipo, observações, procedimentos, anexos) e coluna direita (odontograma)

O que **NÃO** muda: lógica de fetch, save, assinatura, DEX, upload, odontograma.

---

## Arquivos modificados

| Arquivo | Operação |
|---------|----------|
| `src/components/pacientes/FichasTab.tsx` | Modificado |

Nenhum arquivo criado ou deletado.

---

## Task 1 — Infraestrutura de colapso + diferenciação de tipo

**Objetivo:** adicionar o estado `expandedIds`, o helper `buildCollapsedContent`, o mapeamento `TYPE_CONFIG`, e atualizar `fetchFichas` para fazer o primeiro registro abrir automaticamente.

**Arquivo:** `src/components/pacientes/FichasTab.tsx`

### Passo 1 — Atualizar imports de lucide-react

Localizar (linha ~5):
```tsx
import {
  Plus,
  X,
  Mic,
  MicOff,
  Trash2,
  MoreVertical,
  Edit2,
  FileText,
  Download,
  Upload,
  Check,
  User,
  Loader2,
  Sparkles,
  Lock,
  PenLine,
} from "lucide-react";
```

Substituir por:
```tsx
import {
  Plus,
  X,
  Mic,
  MicOff,
  Trash2,
  MoreVertical,
  Edit2,
  FileText,
  Download,
  Upload,
  Check,
  User,
  Loader2,
  Sparkles,
  Lock,
  PenLine,
  ChevronDown,
  Stethoscope,
  RotateCcw,
  AlertCircle,
  Zap,
} from "lucide-react";
```

### Passo 2 — Adicionar TYPE_CONFIG após ARCH_LABELS (linha ~70)

Após o bloco:
```tsx
const ARCH_LABELS: Record<number, string> = {
  [ARCH_SUPERIOR]: 'Arcada Superior',
  [ARCH_INFERIOR]: 'Arcada Inferior',
  [ARCH_COMPLETA]: 'Boca Toda',
};
```

Adicionar:
```tsx
const ARCH_SHORT: Record<number, string> = {
  [ARCH_SUPERIOR]: 'Sup.',
  [ARCH_INFERIOR]: 'Inf.',
  [ARCH_COMPLETA]: 'Geral',
};

type TypeConfig = {
  badge: string;
  icon: React.ComponentType<{ className?: string }>;
};

const TYPE_CONFIG: Record<string, TypeConfig> = {
  'Avaliação':    { badge: 'bg-teal/10 text-teal border border-teal/20',                    icon: Stethoscope },
  'Evolução':     { badge: 'bg-surface-alt text-text-secondary border border-border/60',    icon: FileText    },
  'Retorno':      { badge: 'bg-blue-500/10 text-blue-600 border border-blue-500/20',        icon: RotateCcw   },
  'Urgência':     { badge: 'bg-coral/10 text-coral border border-coral/20',                 icon: AlertCircle },
  'Procedimento': { badge: 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20', icon: Zap       },
};
const DEFAULT_TYPE: TypeConfig = {
  badge: 'bg-surface-alt text-text-secondary border border-border/60',
  icon: FileText,
};
```

### Passo 3 — Adicionar helper buildCollapsedContent antes do componente

Logo após as constantes (antes de `const mapFichaToEvolution = ...`), adicionar:

```tsx
type CollapsedContent = {
  tags: string[];   // procedimentos clínicos formatados
  preview: string | null; // fallback: primeira linha do observation
};

function buildCollapsedContent(evo: Evolution): CollapsedContent {
  const tags: string[] = [];

  for (const tn of evo.teethNotes) {
    const toothLabel = tn.tooth in ARCH_SHORT
      ? ARCH_SHORT[tn.tooth]!
      : `D${tn.tooth}`;

    for (const note of tn.notes.filter(Boolean)) {
      const proc = note.length > 22 ? `${note.slice(0, 22)}…` : note;
      tags.push(`${proc} · ${toothLabel}`);
    }
  }

  const preview = evo.observation
    ? evo.observation.split('\n')[0]?.slice(0, 90) ?? null
    : null;

  return { tags, preview };
}
```

### Passo 4 — Adicionar estado expandedIds no componente

No bloco de estado do componente (logo após `const [isLoading, setIsLoading] = ...`, linha ~143), adicionar:

```tsx
const [expandedIds, setExpandedIds] = React.useState<Set<string>>(new Set());

const toggleExpand = React.useCallback((id: string) => {
  setExpandedIds(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });
}, []);
```

### Passo 5 — Atualizar fetchFichas para aceitar autoExpandFirst

Localizar (linha ~230):
```tsx
const fetchFichas = React.useCallback(async () => {
  setIsLoading(true);
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      // ...
    if (error) throw error;
    setEvolutions((data as unknown as FichaDB[]).map(mapFichaToEvolution));
  } catch (err) {
    console.error("Erro ao buscar fichas:", err);
  } finally {
    setIsLoading(false);
  }
}, [patientId, clinicaId]);
```

Substituir por:
```tsx
const fetchFichas = React.useCallback(async (autoExpandFirst = false) => {
  setIsLoading(true);
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("fichas")
      .select("id, created_at, queixa_principal, anotacoes, dentes_afetados, dentes_observacoes, status, procedimentos_concluidos, assinatura_url, assinado_em, dentista:dentistas(nome)")
      .eq("paciente_id", patientId)
      .eq("clinica_id", clinicaId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    const mapped = (data as unknown as FichaDB[]).map(mapFichaToEvolution);
    setEvolutions(mapped);
    if (autoExpandFirst && mapped.length > 0) {
      setExpandedIds(new Set([mapped[0].id]));
    }
  } catch (err) {
    console.error("Erro ao buscar fichas:", err);
  } finally {
    setIsLoading(false);
  }
}, [patientId, clinicaId]);
```

### Passo 6 — Atualizar chamada inicial do useEffect

Localizar (linha ~250):
```tsx
React.useEffect(() => {
  if (patientId && clinicaId) {
    void fetchFichas();
  }
}, [patientId, clinicaId, fetchFichas]);
```

Substituir por:
```tsx
React.useEffect(() => {
  if (patientId && clinicaId) {
    void fetchFichas(true);
  }
}, [patientId, clinicaId, fetchFichas]);
```

### Passo 7 — Atualizar handleSave para expandir o registro salvo

Localizar em `handleSave` (linha ~472):
```tsx
      await fetchFichas();
      if (dexDebounceRef.current) clearTimeout(dexDebounceRef.current);
```

Substituir por:
```tsx
      const wasEditing = editingId;
      await fetchFichas(!wasEditing); // para nova ficha: expande a primeira
      if (wasEditing) {
        setExpandedIds(prev => new Set([...prev, wasEditing]));
      }
      if (dexDebounceRef.current) clearTimeout(dexDebounceRef.current);
```

**Commit:** `feat: Task 8 infra — expandedIds, TYPE_CONFIG, buildCollapsedContent, fetchFichas update`

---

## Task 2 — Reescrever o render dos cards da timeline

**Objetivo:** substituir os cards sempre-expandidos pelo novo design colapsável com tags clínicas.

**Arquivo:** `src/components/pacientes/FichasTab.tsx`

### O que substituir

Localizar o bloco completo (linha ~1122):
```tsx
      <div className="relative space-y-8 before:absolute before:left-[19px] before:top-4 before:bottom-4 before:w-px before:bg-border/40">
        {evolutions.map((evo, idx) => {
          // ... tudo dentro do map ...
        })}
      </div>
```

### Substituir pelo novo render

```tsx
      <div className="relative space-y-3 before:absolute before:left-[19px] before:top-4 before:bottom-4 before:w-px before:bg-border/40">
        {evolutions.map((evo, idx) => {
          const isOpen = expandedIds.has(evo.id);
          const { tags, preview } = buildCollapsedContent(evo);
          const typeCfg = TYPE_CONFIG[evo.type] ?? DEFAULT_TYPE;
          const TypeIcon = typeCfg.icon;

          const validKeys = evo.teethNotes.flatMap((tn) =>
            tn.notes.filter(Boolean).map((_, i) => `${tn.tooth}_${i}`)
          );
          const totalProcs = validKeys.length;
          const doneProcs = evo.procedimentosConcluidos.filter((k) => validKeys.includes(k)).length;
          const allDone = totalProcs > 0 && doneProcs === totalProcs;

          return (
            <motion.div
              key={evo.id}
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: Math.min(idx * 0.04, 0.3) }}
              className="relative pl-10 sm:pl-12"
            >
              {/* Dot indicator */}
              <div className={`absolute left-0 top-3.5 w-9 h-9 rounded-full bg-surface border-2 flex items-center justify-center z-10 shadow-sm transition-colors ${allDone ? 'border-emerald-500' : 'border-teal/60'}`}>
                <TypeIcon className={`w-3.5 h-3.5 ${allDone ? 'text-emerald-500' : 'text-teal'}`} />
              </div>

              <div
                className={`bg-surface rounded-2xl border shadow-sm transition-all ${allDone ? 'border-emerald-500/30' : 'border-border/60'}`}
                style={allDone && isOpen ? { boxShadow: '-3px 0 0 0 #10b981, 0 1px 3px rgba(0,0,0,0.06)' } : undefined}
              >
                {/* ── HEADER (sempre visível, clicável) ─────────────────── */}
                <button
                  onClick={() => toggleExpand(evo.id)}
                  className="w-full text-left px-5 py-4 flex items-start justify-between gap-3 group"
                >
                  <div className="flex-1 min-w-0 space-y-2">
                    {/* Linha 1: badge de tipo + data + profissional */}
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-widest ${typeCfg.badge}`}>
                        <TypeIcon className="w-2.5 h-2.5" />
                        {evo.type}
                      </span>
                      <span className="text-xs font-semibold text-text-primary">{evo.date}</span>
                      <span className="text-[10px] text-text-secondary flex items-center gap-1">
                        <User className="w-3 h-3" /> {evo.professional}
                      </span>
                      {totalProcs > 0 && (
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border ${allDone ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' : 'bg-amber-500/10 text-amber-600 border-amber-500/20'}`}>
                          {allDone ? '✓ Concluído' : `${doneProcs}/${totalProcs}`}
                        </span>
                      )}
                    </div>

                    {/* Linha 2: tags clínicas (colapsado) ou preview */}
                    {!isOpen && (
                      <div className="flex flex-wrap gap-1.5">
                        {tags.length > 0 ? (
                          <>
                            {tags.slice(0, 4).map((tag, i) => (
                              <span
                                key={i}
                                className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-surface-alt border border-border/50 text-text-secondary"
                              >
                                {tag}
                              </span>
                            ))}
                            {tags.length > 4 && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium text-text-secondary">
                                +{tags.length - 4} mais
                              </span>
                            )}
                          </>
                        ) : preview ? (
                          <p className="text-xs text-text-secondary line-clamp-1">{preview}</p>
                        ) : null}
                      </div>
                    )}
                  </div>

                  {/* Chevron */}
                  <ChevronDown
                    className={`w-4 h-4 text-text-secondary shrink-0 mt-1 transition-transform duration-200 group-hover:text-text-primary ${isOpen ? 'rotate-180' : ''}`}
                  />
                </button>

                {/* ── CONTEÚDO EXPANDIDO ────────────────────────────────── */}
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      key="content"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2, ease: 'easeInOut' }}
                      className="overflow-hidden"
                    >
                      <div className="px-5 pb-5 space-y-5 border-t border-border/40 pt-4">

                        {/* Seção: Avaliação Clínica */}
                        {evo.observation && (
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-text-secondary mb-2">
                              Avaliação Clínica
                            </p>
                            <p className="text-sm text-text-primary leading-relaxed">
                              {evo.observation}
                            </p>
                          </div>
                        )}

                        {/* Seção: Procedimentos */}
                        {evo.teethNotes.length > 0 && (
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-text-secondary mb-2">
                              Procedimentos
                            </p>
                            <div className="flex flex-col gap-2">
                              {evo.teethNotes.map((tn) => (
                                <div
                                  key={tn.tooth}
                                  className="bg-surface-alt rounded-xl border border-border/40 px-3 py-2"
                                >
                                  <span className="font-mono text-[10px] font-bold text-teal block mb-1.5">
                                    {tn.tooth in ARCH_LABELS ? ARCH_LABELS[tn.tooth] : `D${tn.tooth}`}
                                  </span>
                                  <div className="flex flex-col gap-1.5">
                                    {tn.notes.filter(Boolean).map((n, i) => {
                                      const procKey = `${tn.tooth}_${i}`;
                                      const done = evo.procedimentosConcluidos.includes(procKey);
                                      return (
                                        <button
                                          key={i}
                                          onClick={() => void handleToggleProcedimento(evo.id, procKey, evo.procedimentosConcluidos)}
                                          className="flex items-center gap-2 text-left group/proc w-full"
                                        >
                                          <div className={`w-4 h-4 rounded border shrink-0 flex items-center justify-center transition-all ${done ? 'bg-emerald-500 border-emerald-500' : 'border-border group-hover/proc:border-teal'}`}>
                                            {done && <Check className="w-2.5 h-2.5 text-white" />}
                                          </div>
                                          <span className={`text-[11px] font-medium transition-all ${done ? 'line-through text-text-secondary' : 'text-text-primary group-hover/proc:text-teal'}`}>
                                            {n}
                                          </span>
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Seção: Anexos */}
                        {evo.files.length > 0 && (
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-text-secondary mb-2">
                              Anexos
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {evo.files.map((f, i) => (
                                <div
                                  key={i}
                                  className="flex items-center gap-2 px-3 py-2 bg-surface-alt rounded-xl border border-border/40 text-[10px] font-bold text-text-primary"
                                >
                                  <FileText className="w-3 h-3 text-teal" /> {f}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Ações */}
                        <div className="flex items-center justify-between pt-1">
                          <div>
                            {evo.assinadoEm ? (
                              <span className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 text-[9px] font-bold">
                                <Check className="w-3 h-3" />
                                Assinado em {new Date(evo.assinadoEm).toLocaleDateString('pt-BR')}
                              </span>
                            ) : (
                              <button
                                onClick={() => setSigningFichaId(evo.id)}
                                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-bold border border-border text-text-secondary hover:border-teal hover:text-teal transition-colors"
                              >
                                <PenLine className="w-3 h-3" />
                                Assinar
                              </button>
                            )}
                          </div>

                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button className="p-2 hover:bg-surface-alt rounded-lg transition-colors text-text-secondary hover:text-text-primary">
                                <MoreVertical className="w-4 h-4" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleEdit(evo)}>
                                <Edit2 className="w-3 h-3" /> Editar
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => window.open(`/api/fichas/${evo.id}/pdf`, '_blank')}>
                                <Download className="w-3 h-3" /> Imprimir Ficha
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => setShowDeleteConfirm(evo.id)}
                                className="text-red-500 focus:text-red-500"
                              >
                                <Trash2 className="w-3 h-3" /> Excluir
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>

                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          );
        })}
      </div>
```

**Commit:** `feat: Task 8 — timeline colapsável com tags clínicas e ícones por tipo`

---

## Task 3 — Reorganizar formulário em seções clínicas

**Objetivo:** adicionar hierarquia de seções ao formulário sem alterar nenhum campo ou lógica. Puro refactor visual.

**Arquivo:** `src/components/pacientes/FichasTab.tsx`

### Estrutura do formulário atual (coluna esquerda, linha ~752)

```
bg-surface-alt/30 border rounded-2xl p-4 md:p-6 flex lg:flex-row gap-6
  coluna esquerda (flex-[3]):
    Tipo de Registro (select)
    Observações Gerais (textarea + voice)
    Procedimentos (teeth notes)
    Anexos (file upload)
    Botões (Cancelar / Salvar)
  coluna direita (flex-[2]):
    Odontograma
```

### Nova estrutura (coluna esquerda)

Localizar o div interno da coluna esquerda (linha ~752):
```tsx
              {/* Coluna Esquerda */}
              <div className="flex-[3] flex flex-col gap-6">
                <div className="flex-1">
                  <label className="block text-[10px] font-bold text-text-secondary uppercase tracking-[0.15em] mb-2">
                    Tipo de Registro
                  </label>
                  <select ...>
```

Substituir toda a coluna esquerda (do `<div className="flex-[3]...">` até o `</div>` que o fecha, antes do Odontograma — linha ~1026) por:

```tsx
              {/* Coluna Esquerda — seções clínicas */}
              <div className="flex-[3] flex flex-col gap-0">

                {/* ── QUEIXA PRINCIPAL ─────────────────────────────── */}
                <div className="pb-5">
                  <label className="block text-[10px] font-bold text-text-secondary uppercase tracking-[0.15em] mb-3">
                    Queixa Principal
                  </label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData((f) => ({ ...f, type: e.target.value }))}
                    className="w-full bg-surface-alt border border-border rounded-xl px-4 py-2.5 text-sm font-medium text-text-primary outline-none focus:border-teal transition-colors"
                  >
                    <option value="Avaliação">Avaliação</option>
                    <option value="Evolução">Evolução</option>
                    <option value="Retorno">Retorno</option>
                    <option value="Urgência">Urgência</option>
                    <option value="Procedimento">Procedimento</option>
                  </select>
                </div>

                <div className="h-px bg-border/40 mb-5" />

                {/* ── AVALIAÇÃO CLÍNICA ─────────────────────────────── */}
                <div className="pb-5">
                  <div className="flex items-center justify-between mb-3">
                    <label className="block text-[10px] font-bold text-text-secondary uppercase tracking-[0.15em]">
                      Avaliação Clínica
                    </label>
                    {temFeature(plano, 'transcricaoVoz') ? (
                      <button
                        onClick={() => {
                          void (isRecording ? stopRecording() : startRecording());
                        }}
                        disabled={isTranscribing}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                          isRecording
                            ? "bg-red-100 text-red-600 hover:bg-red-200 animate-pulse"
                            : "bg-teal/10 text-teal hover:bg-teal/20"
                        }`}
                      >
                        {isTranscribing ? (
                          <>
                            <span className="w-3.5 h-3.5 inline-block border-2 border-teal border-t-transparent rounded-full animate-spin" />{" "}
                            Transcrevendo...
                          </>
                        ) : isRecording ? (
                          <>
                            <MicOff className="w-3.5 h-3.5" /> Parar Gravação
                          </>
                        ) : (
                          <>
                            <Mic className="w-3.5 h-3.5" /> Gravar Voz (IA)
                          </>
                        )}
                      </button>
                    ) : (
                      <span
                        title="Disponível no Plano Básico"
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-surface-alt text-text-secondary cursor-not-allowed select-none"
                      >
                        <Lock className="w-3.5 h-3.5" /> Gravar Voz (IA)
                      </span>
                    )}
                  </div>
                  <textarea
                    value={formData.observation}
                    onChange={(e) => setFormData((f) => ({ ...f, observation: e.target.value }))}
                    placeholder="Descreva os achados clínicos, diagnóstico, condutas e evolução do paciente..."
                    className="w-full bg-surface-alt border border-border rounded-xl px-4 py-3 text-sm font-medium text-text-primary outline-none focus:border-teal transition-colors min-h-[120px] resize-y"
                  />
                  <AnimatePresence>
                    {isDexAnalyzing && !editingId && (
                      <motion.div
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        className="flex items-center gap-1.5 text-[11px] mt-1"
                        style={{ color: 'rgba(47,156,133,0.7)' }}
                      >
                        <Loader2 className="w-3 h-3 animate-spin" />
                        DEX analisando procedimentos...
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <div className="h-px bg-border/40 mb-5" />

                {/* ── PROCEDIMENTOS ─────────────────────────────────── */}
                <div className="pb-5">
                  <label className="block text-[10px] font-bold text-text-secondary uppercase tracking-[0.15em] mb-3">
                    Procedimentos
                  </label>

                  {selectedTeeth.length === 0 && sharedTeeth.length === 0 ? (
                    <div className="min-h-[88px] flex items-center justify-center text-xs text-text-secondary bg-surface-alt rounded-xl border border-dashed border-border/60">
                      {selectionMode === 'arch'
                        ? 'Selecione uma arcada ao lado'
                        : 'Selecione dentes no odontograma ao lado'}
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* Dentes individuais */}
                      {selectedTeeth.length > 0 && (
                        <div className="space-y-3">
                          {sharedTeeth.length > 0 && (
                            <span className="text-[10px] font-bold text-text-secondary uppercase tracking-widest">Individuais</span>
                          )}
                          {selectedTeeth.map((tooth) => {
                            const tn = formData.teethNotes.find((t) => t.tooth === tooth);
                            const notes = tn?.notes ?? [''];
                            return (
                              <motion.div
                                key={tooth}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                className="flex items-start gap-3"
                              >
                                {tooth in ARCH_LABELS ? (
                                  <div className="shrink-0 rounded-lg bg-teal text-white flex items-center justify-center font-mono text-[10px] font-bold shadow-sm mt-0.5 px-2 py-2 whitespace-nowrap">
                                    {ARCH_LABELS[tooth]}
                                  </div>
                                ) : (
                                  <div className="w-10 h-10 shrink-0 rounded-lg bg-teal text-white flex items-center justify-center font-mono text-sm font-bold shadow-sm mt-0.5">
                                    {tooth}
                                  </div>
                                )}
                                <div className="flex-1 space-y-2">
                                  {notes.map((note, idx) => (
                                    <div key={idx} className="flex items-center gap-2">
                                      <input
                                        type="text"
                                        value={note}
                                        onChange={(e) => handleToothNoteChange(tooth, idx, e.target.value)}
                                        placeholder={`Procedimento ${idx + 1}...`}
                                        className="flex-1 bg-surface-alt border border-border rounded-xl px-4 py-2.5 text-sm font-medium text-text-primary outline-none focus:border-teal transition-colors"
                                      />
                                      {notes.length > 1 && (
                                        <button type="button" onClick={() => removeToothNote(tooth, idx)} className="p-1.5 text-text-secondary hover:text-red-500 transition-colors rounded-lg hover:bg-red-50 dark:hover:bg-red-950/20">
                                          <X className="w-3.5 h-3.5" />
                                        </button>
                                      )}
                                    </div>
                                  ))}
                                  <button type="button" onClick={() => addToothNote(tooth)} className="flex items-center gap-1.5 text-xs font-semibold text-teal hover:text-teal-lt transition-colors px-1">
                                    <Plus className="w-3.5 h-3.5" />
                                    Adicionar procedimento
                                  </button>
                                </div>
                              </motion.div>
                            );
                          })}
                        </div>
                      )}

                      {/* Grupo de dentes */}
                      {(sharedTeeth.length > 0 || selectionMode === 'multiple') && (
                        <div className="space-y-3">
                          {selectedTeeth.length > 0 && (
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-px bg-border/60" />
                              <span className="text-[10px] font-bold text-text-secondary uppercase tracking-widest shrink-0">Grupo</span>
                              <div className="flex-1 h-px bg-border/60" />
                            </div>
                          )}
                          {sharedTeeth.length > 0 && (
                            <div className="flex flex-wrap gap-1.5">
                              {sharedTeeth.map((tooth) => (
                                <div key={tooth} className="flex items-center gap-1 bg-teal/15 border border-teal/40 text-teal px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold">
                                  D{tooth}
                                  <button type="button" onClick={() => toggleTooth(tooth)} className="ml-0.5 hover:opacity-60 transition-opacity">
                                    <X className="w-2.5 h-2.5" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                          {sharedTeeth.length === 0 ? (
                            <div className="min-h-[60px] flex items-center justify-center text-xs text-text-secondary bg-surface-alt rounded-xl border border-dashed border-border/60">
                              Selecione os dentes no odontograma
                            </div>
                          ) : (
                            <div className="space-y-2">
                              {sharedNotes.map((note, idx) => (
                                <div key={idx} className="flex items-center gap-2">
                                  <input
                                    type="text"
                                    value={note}
                                    onChange={(e) => handleSharedNoteChange(idx, e.target.value)}
                                    placeholder={`Procedimento ${idx + 1} para todos os dentes...`}
                                    className="flex-1 bg-surface-alt border border-teal/30 rounded-xl px-4 py-2.5 text-sm font-medium text-text-primary outline-none focus:border-teal transition-colors"
                                  />
                                  {sharedNotes.length > 1 && (
                                    <button type="button" onClick={() => removeSharedNote(idx)} className="p-1.5 text-text-secondary hover:text-red-500 transition-colors rounded-lg hover:bg-red-50 dark:hover:bg-red-950/20">
                                      <X className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </div>
                              ))}
                              <button type="button" onClick={addSharedNote} className="flex items-center gap-1.5 text-xs font-semibold text-teal hover:text-teal-lt transition-colors px-1">
                                <Plus className="w-3.5 h-3.5" />
                                Adicionar procedimento
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="h-px bg-border/40 mb-5" />

                {/* ── ANEXOS ───────────────────────────────────────── */}
                <div className="pb-5">
                  <label className="block text-[10px] font-bold text-text-secondary uppercase tracking-[0.15em] mb-3">
                    Anexos
                  </label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".jpg,.jpeg,.png,.webp,.pdf,.docx"
                    className="hidden"
                    onChange={(e) => void handleFileSelect(e)}
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                    className="w-full border-2 border-dashed border-border hover:border-teal bg-surface-alt rounded-xl py-6 flex flex-col items-center justify-center gap-2 text-text-secondary hover:text-teal transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isUploading ? (
                      <Loader2 className="w-6 h-6 animate-spin" />
                    ) : (
                      <Upload className="w-6 h-6" />
                    )}
                    <span className="text-sm font-medium">
                      {isUploading ? 'Enviando...' : 'Clique para fazer upload de imagens ou raio-x'}
                    </span>
                  </button>
                  {uploadedFiles.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {uploadedFiles.map((f) => (
                        <div
                          key={f.docId}
                          className="flex items-center justify-between px-3 py-2 bg-surface-alt rounded-xl border border-border/40"
                        >
                          <div className="flex items-center gap-2 text-xs font-medium text-text-primary min-w-0">
                            <FileText className="w-3.5 h-3.5 text-teal shrink-0" />
                            <span className="truncate">{f.name}</span>
                          </div>
                          <button
                            onClick={() => void handleRemoveFile(f.docId, f.storagePath)}
                            className="p-1 text-text-secondary hover:text-red-500 transition-colors shrink-0 ml-2"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* ── AÇÕES ────────────────────────────────────────── */}
                <div className="flex items-center justify-end gap-3 pt-4 border-t border-border/60">
                  <button
                    onClick={closePanel}
                    className="px-5 py-2.5 rounded-xl font-semibold text-sm text-text-secondary hover:text-text-primary hover:bg-surface-alt transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={() => void handleSave()}
                    disabled={isSaving}
                    className="bg-teal hover:bg-teal-lt text-white px-5 py-2.5 rounded-xl font-semibold text-sm flex items-center gap-2 transition-all shadow-[0_0_15px_rgba(47,156,133,0.3)] disabled:opacity-50"
                  >
                    {isSaving ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Check className="w-4 h-4" />
                    )}
                    {isSaving ? "Salvando..." : "Salvar Evolução"}
                  </button>
                </div>

              </div>
```

**Commit:** `feat: Task 9 — formulário reorganizado em seções clínicas (Queixa, Avaliação, Procedimentos, Anexos)`

---

## Task 4 — Validação TypeScript e ajustes finais

**Objetivo:** garantir zero erros TS e revisar os critérios de aceitação.

```bash
npx tsc --noEmit 2>&1 | grep -v "screenshots-sprint2"
```

Saída esperada: silenciosa (zero erros).

Se houver erros, corrigir antes de prosseguir.

**Verificações manuais:**
- [ ] Primeiro registro abre automaticamente ao montar
- [ ] Clique no header toggle expande/colapsa
- [ ] Tags clínicas aparecem no estado colapsado
- [ ] Fallback de texto aparece quando sem procedimentos
- [ ] Card recém-salvo abre automaticamente
- [ ] Seções do formulário têm separadores visíveis
- [ ] Labels renomeadas (Queixa Principal, Avaliação Clínica)
- [ ] Ícone por tipo de evento visível no dot e no badge

**Commit:** `feat: Sprint 2 Bloco 3 — Ficha Clínica como Timeline Clínica concluída`

---

## Auditoria final obrigatória

Ao concluir, responder como Product Designer + Dentista (não desenvolvedor):

| Cenário | Pergunta |
|---------|----------|
| 1 | Com 100 registros, localizo "Canal · D36" sem abrir nenhum card? |
| 2 | Entendo o último atendimento em < 5 segundos? |
| 3 | Parece prontuário clínico moderno ou lista de accordions? |
| 4 | Ficha Clínica claramente separada do módulo Tratamento? |
| 5 | Sinto que estou navegando pela evolução clínica do paciente? |
