# Plano: Polimento de Baixa Prioridade — DentIA
**Data:** 2026-05-10  
**Goal:** Fechar todos os itens de baixa prioridade: dark mode, toasts, skeletons, mobile, PlanGuard audit, storage migrations, env validation.  
**Stack:** Next.js 16 App Router, TypeScript strict, Supabase, Tailwind v4, shadcn/ui, Sonner (toast), Framer Motion.

---

## Arquivos Modificados

| Arquivo | Ação |
|---|---|
| `src/components/fichas/SignaturePad.tsx` | Modificar — dark mode |
| `src/components/pacientes/FichasTab.tsx` | Modificar — dark mode + toasts + mobile |
| `src/components/pacientes/PlanejamentoTab.tsx` | Modificar — toasts + skeleton |
| `src/components/pacientes/PendenciasTab.tsx` | Modificar — toasts + skeleton |
| `src/components/pacientes/DocumentosTab.tsx` | Modificar — toasts |
| `src/app/consulta/[agendamentoId]/_components/consulta-client.tsx` | Modificar — toast |
| `src/app/dashboard/agendamentos/_components/agendamentos-client.tsx` | Modificar — mobile list view |
| `src/app/dashboard/configuracoes/usuarios/page.tsx` | Modificar — passar plano |
| `src/app/dashboard/configuracoes/usuarios/_components/usuarios-client.tsx` | Modificar — PlanGuard |
| `src/lib/env.ts` | Criar — validação de env vars |
| `src/app/api/transcrever/route.ts` | Modificar — usar env.ts |
| `src/app/api/gerar-planejamento/route.ts` | Modificar — usar env.ts |
| `src/app/dashboard/orcamentos/loading.tsx` | Criar — skeleton route |
| `src/app/dashboard/agendamentos/loading.tsx` | Criar — skeleton route |
| `src/app/dashboard/configuracoes/loading.tsx` | Criar — skeleton route |
| `supabase/migrations/20260510000001_052_storage_policies.sql` | Criar — bucket policies |

---

## Task 1: Dark mode no SignaturePad

**Arquivo:** `src/components/fichas/SignaturePad.tsx`

**Problema:** `backgroundColor: 'rgb(255, 255, 255)'` e `penColor: '#0d0d0d'` são fixos. Em dark mode a canvas fica branca, a assinatura some. O container também tem `bg-white` fixo.

**Implementação:**

```tsx
'use client';

import { useEffect, useRef, useCallback } from 'react';
import SignaturePadLib from 'signature_pad';
import { RotateCcw } from 'lucide-react';

interface SignaturePadProps {
  onClear?: () => void;
  padRef: React.MutableRefObject<SignaturePadLib | null>;
}

export function SignaturePad({ onClear, padRef }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !padRef.current) return;
    const ratio = window.devicePixelRatio || 1;
    canvas.width = canvas.offsetWidth * ratio;
    canvas.height = canvas.offsetHeight * ratio;
    const ctx = canvas.getContext('2d');
    if (ctx) ctx.scale(ratio, ratio);
    padRef.current.clear();
  }, [padRef]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const isDark = document.documentElement.classList.contains('dark');
    const bgColor = isDark ? 'rgb(15, 15, 15)' : 'rgb(255, 255, 255)';
    const penColor = isDark ? '#e5e5e5' : '#0d0d0d';

    padRef.current = new SignaturePadLib(canvas, {
      backgroundColor: bgColor,
      penColor,
      minWidth: 1.5,
      maxWidth: 3,
    });

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    return () => {
      window.removeEventListener('resize', resizeCanvas);
      padRef.current?.off();
    };
  }, [padRef, resizeCanvas]);

  const handleClear = () => {
    padRef.current?.clear();
    onClear?.();
  };

  return (
    <div className="flex flex-col gap-3">
      <div
        className="relative rounded-xl border-2 border-border bg-background overflow-hidden"
        style={{ height: 220 }}
      >
        <canvas ref={canvasRef} className="w-full h-full touch-none" />
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 pointer-events-none">
          <div className="w-32 h-px bg-border/60" />
        </div>
      </div>
      <button
        type="button"
        onClick={handleClear}
        className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors self-start px-1"
      >
        <RotateCcw className="w-3.5 h-3.5" />
        Limpar
      </button>
    </div>
  );
}
```

**Commit:** `fix: dark mode no SignaturePad — cores dinâmicas e bg-background`

---

## Task 2: Dark mode no odontograma (checkbox de dente)

**Arquivo:** `src/components/pacientes/FichasTab.tsx`  
**Linha:** 1507–1508  

**Problema:** O checkbox sobreposto no dente usa `bg-white border-white` quando selecionado — invisível em dark mode.

**Buscar (string exata):**
```
isShared ? 'bg-teal border-teal' : isSelected ? 'bg-white border-white' : 'border-muted-foreground/50'
```

**Substituir por:**
```
isShared ? 'bg-teal border-teal' : isSelected ? 'bg-background border-background' : 'border-muted-foreground/50'
```

**Commit:** `fix: dark mode no odontograma — checkbox usa bg-background`

---

## Task 3: Toasts em catches sem feedback — FichasTab

**Arquivo:** `src/components/pacientes/FichasTab.tsx`

Todos os catches abaixo precisam de `toast.error()` ao lado do `console.error()`. O import de `toast` já existe (linha 43).

### 3a — `fetchFichas` (buscar fichas)
**Buscar:**
```ts
    } catch (err) {
      console.error("Erro ao buscar fichas:", err);
    } finally {
      setIsLoading(false);
    }
```
**Substituir:**
```ts
    } catch (err) {
      console.error("Erro ao buscar fichas:", err);
      toast.error('Erro ao carregar fichas clínicas.');
    } finally {
      setIsLoading(false);
    }
```

### 3b — `transcribeAudio` (transcrição)
**Buscar:**
```ts
    } catch (error) {
      console.error("Erro na transcrição:", error);
    } finally {
```
**Substituir:**
```ts
    } catch (error) {
      console.error("Erro na transcrição:", error);
      toast.error('Erro ao transcrever áudio.');
    } finally {
```

### 3c — gerar orçamento automático via DEX
**Buscar:**
```ts
        } catch (err) {
          console.error('Erro ao gerar orçamento automático:', err);
        }
```
**Substituir:**
```ts
        } catch (err) {
          console.error('Erro ao gerar orçamento automático:', err);
          toast.error('Erro ao gerar orçamento automático.');
        }
```

### 3d — `handleSave` (salvar ficha) — crítico
**Buscar:**
```ts
    } catch (err) {
      console.error("Erro ao salvar ficha:", err);
    } finally {
      setIsSaving(false);
    }
```
**Substituir:**
```ts
    } catch (err) {
      console.error("Erro ao salvar ficha:", err);
      toast.error('Erro ao salvar ficha. Tente novamente.');
    } finally {
      setIsSaving(false);
    }
```

### 3e — `handleConfirmarOrcamento` (criar orçamento)
**Buscar:**
```ts
    } catch (err) {
      console.error('Erro ao criar orçamento:', err);
    } finally {
      setCriandoOrcamento(false);
    }
```
**Substituir:**
```ts
    } catch (err) {
      console.error('Erro ao criar orçamento:', err);
      toast.error('Erro ao criar orçamento. Tente novamente.');
    } finally {
      setCriandoOrcamento(false);
    }
```

### 3f — `handleRemoveFile` (remover arquivo)
**Buscar:**
```ts
    } catch (err) {
      console.error('Erro ao remover arquivo:', err);
    }
```
**Substituir:**
```ts
    } catch (err) {
      console.error('Erro ao remover arquivo:', err);
      toast.error('Erro ao remover arquivo.');
    }
```

### 3g — `handleDelete` (excluir ficha) — crítico
**Buscar:**
```ts
    } catch (err) {
      console.error("Erro ao excluir ficha:", err);
    } finally {
      setShowDeleteConfirm(null);
    }
```
**Substituir:**
```ts
    } catch (err) {
      console.error("Erro ao excluir ficha:", err);
      toast.error('Erro ao excluir ficha.');
    } finally {
      setShowDeleteConfirm(null);
    }
```

**Commit:** `fix: toasts em todos os catches críticos da FichasTab`

---

## Task 4: Toasts em catches sem feedback — PlanejamentoTab

**Arquivo:** `src/components/pacientes/PlanejamentoTab.tsx`

O import de `toast` ainda não existe nesta tab. Adicionar no topo junto aos outros imports:
```ts
import { toast } from 'sonner';
```

### 4a — `fetchData`
**Buscar:**
```ts
    } catch (error) {
      console.error('Erro ao buscar dados de planejamento:', JSON.stringify(error), error);
    } finally {
```
**Substituir:**
```ts
    } catch (error) {
      console.error('Erro ao buscar dados de planejamento:', JSON.stringify(error), error);
      toast.error('Erro ao carregar dados do planejamento.');
    } finally {
```

### 4b — `saveSection` (salvar seção)
**Buscar:**
```ts
    } catch (error) {
      console.error('Erro ao salvar seção:', error);
    } finally {
```
**Substituir:**
```ts
    } catch (error) {
      console.error('Erro ao salvar seção:', error);
      toast.error('Erro ao salvar seção.');
    } finally {
```

### 4c — `handleGenerateAI` (gerar com IA)
**Buscar:**
```ts
    } catch (error) {
      console.error('Erro ao gerar com IA:', error);
    } finally {
```
**Substituir:**
```ts
    } catch (error) {
      console.error('Erro ao gerar com IA:', error);
      toast.error('Erro ao gerar conteúdo com IA.');
    } finally {
```

### 4d — `handleAddSection` (criar seção)
**Buscar:**
```ts
    if (error ?? !data) {
      console.error('Erro ao criar seção:', error);
      return;
    }
```
**Substituir:**
```ts
    if (error ?? !data) {
      console.error('Erro ao criar seção:', error);
      toast.error('Erro ao criar seção.');
      return;
    }
```

**Commit:** `fix: toasts nos catches do PlanejamentoTab + import sonner`

---

## Task 5: Toasts — PendenciasTab e DocumentosTab

### PendenciasTab (`src/components/pacientes/PendenciasTab.tsx`)
O import de `toast` ainda não existe. Adicionar:
```ts
import { toast } from 'sonner';
```

**5a — `fetchPendencias`:**
**Buscar:**
```ts
    } catch (err) {
      console.error('Erro ao buscar pendências:', err);
    } finally {
      setIsLoading(false);
    }
```
**Substituir:**
```ts
    } catch (err) {
      console.error('Erro ao buscar pendências:', err);
      toast.error('Erro ao carregar pendências.');
    } finally {
      setIsLoading(false);
    }
```

**5b — `handleToggle`:**
**Buscar:**
```ts
    } catch (err) {
      console.error('Erro ao atualizar procedimento:', err);
    } finally {
      setTogglingKey(null);
    }
```
**Substituir:**
```ts
    } catch (err) {
      console.error('Erro ao atualizar procedimento:', err);
      toast.error('Erro ao atualizar procedimento.');
    } finally {
      setTogglingKey(null);
    }
```

### DocumentosTab (`src/components/pacientes/DocumentosTab.tsx`)
O `toast` já é importado (verifica no topo). Apenas adicionar onde falta:

**5c — `fetchDocuments`:**
**Buscar:**
```ts
    } catch (error) {
      console.error('Erro ao buscar documentos:', error);
    } finally {
```
**Substituir:**
```ts
    } catch (error) {
      console.error('Erro ao buscar documentos:', error);
      toast.error('Erro ao carregar documentos.');
    } finally {
```

**Commit:** `fix: toasts nos catches de PendenciasTab e DocumentosTab`

---

## Task 6: Skeletons em loading.tsx ausentes

Criar três arquivos de loading para rotas que ainda não têm. Usar o padrão de `src/app/dashboard/pacientes/loading.tsx` como referência.

### `src/app/dashboard/orcamentos/loading.tsx`
```tsx
import { Skeleton } from '@/components/ui/skeleton';

export default function OrcamentosLoading() {
  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-10 w-32" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24 rounded-2xl" />
        ))}
      </div>
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-20 rounded-2xl" />
        ))}
      </div>
    </div>
  );
}
```

### `src/app/dashboard/agendamentos/loading.tsx`
```tsx
import { Skeleton } from '@/components/ui/skeleton';

export default function AgendamentosLoading() {
  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-10 w-36" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Skeleton className="h-80 rounded-3xl" />
        <div className="lg:col-span-2 space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
      </div>
    </div>
  );
}
```

### `src/app/dashboard/configuracoes/loading.tsx`
```tsx
import { Skeleton } from '@/components/ui/skeleton';

export default function ConfiguracoesLoading() {
  return (
    <div className="p-8 space-y-6">
      <Skeleton className="h-9 w-48" />
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-16 rounded-2xl" />
        ))}
      </div>
    </div>
  );
}
```

**Commit:** `feat: loading skeletons para orcamentos, agendamentos e configuracoes`

---

## Task 7: Skeleton inline — PlanejamentoTab e PendenciasTab

### PlanejamentoTab (`src/components/pacientes/PlanejamentoTab.tsx`)

**Adicionar import** (junto aos demais imports de componentes):
```ts
import { Skeleton } from '@/components/ui/skeleton';
```

**Buscar (estado de loading atual):**
```tsx
  if (loadingData) {
    return (
      <div className="flex items-center justify-center p-20">
        <Loader2 className="w-8 h-8 animate-spin text-teal" />
      </div>
    );
  }
```

**Substituir:**
```tsx
  if (loadingData) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-32 rounded-2xl" />
        <Skeleton className="h-32 rounded-2xl" />
        <Skeleton className="h-32 rounded-2xl" />
      </div>
    );
  }
```

Remover `Loader2` dos imports de lucide se não for mais usado em nenhum outro lugar da tab. (Verificar antes de remover.)

### PendenciasTab (`src/components/pacientes/PendenciasTab.tsx`)

**Adicionar import:**
```ts
import { Skeleton } from '@/components/ui/skeleton';
```

**Buscar:**
```tsx
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-teal" />
      </div>
    );
  }
```

**Substituir:**
```tsx
  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-14 rounded-xl" />
        ))}
      </div>
    );
  }
```

**Commit:** `feat: skeleton inline em PlanejamentoTab e PendenciasTab`

---

## Task 8: Mobile — FichasTab (dentes overflow)

**Arquivo:** `src/components/pacientes/FichasTab.tsx`

**Problema:** As duas fileiras de 16 dentes (36px × 16 = 576px mínimo) transbordam em telas < 768px.

**Localizar a seção de dentes superiores.** Buscar o pattern que renderiza as fileiras de dentes — procurar por:
```tsx
TEETH_UPPER.map
```
e
```tsx
TEETH_LOWER.map
```

As duas fileiras estão envolvidas em divs de `grid` ou `flex`. Envolver cada fileira em um container com `overflow-x-auto`:

**Buscar o wrapper dos dentes superiores** (dentro do bloco do odontograma, após o seletor de modo):
```tsx
            <div className="flex gap-0.5 justify-center mb-1">
              {TEETH_UPPER.map(
```
**Substituir:**
```tsx
            <div className="overflow-x-auto -mx-1 px-1">
            <div className="flex gap-0.5 justify-center mb-1 min-w-max">
              {TEETH_UPPER.map(
```
E fechar o wrapper extra com `</div>` antes do próximo bloco relevante.

**Buscar o wrapper dos dentes inferiores:**
```tsx
            <div className="flex gap-0.5 justify-center mt-1">
              {TEETH_LOWER.map(
```
**Substituir:**
```tsx
            <div className="overflow-x-auto -mx-1 px-1">
            <div className="flex gap-0.5 justify-center mt-1 min-w-max">
              {TEETH_LOWER.map(
```
E fechar o wrapper extra.

> **Nota:** Durante a implementação, ler o arquivo para localizar os wrappers exatos. Os padrões acima são aproximados — usar o contexto para confirmar os wrappers reais antes de editar.

**Commit:** `fix: overflow-x-auto nos dentes do odontograma em mobile`

---

## Task 9: Mobile — Agendamentos lista view

**Arquivo:** `src/app/dashboard/agendamentos/_components/agendamentos-client.tsx`

**Problema:** Abaixo de 768px, o calendário mensal comprime mal. O hook `isMobile` já é importado (linha 73) mas não é usado para alternar a visualização.

**O `isMobile` hook retorna `true` abaixo de 768px** (verificar em `src/hooks/use-mobile.ts`).

**Estratégia:** No bloco do calendário (dentro do `grid grid-cols-1 lg:grid-cols-3`), quando `isMobile === true`, renderizar um header de navegação de mês + lista simples de todos os agendamentos do mês agrupados por dia, em vez do grid de 7 colunas.

**Localizar a div que contém o calendário:**
```tsx
        <motion.div
          initial={{ opacity: 0, x: -20 }}
```
(primeira motion.div dentro de `grid grid-cols-1 lg:grid-cols-3`)

**Dentro dela, localizar o grid de dias do calendário:**
```tsx
            <div className="grid grid-cols-7 gap-1 mb-2">
```

**Envolver a renderização do calendário em condicional:**

Antes da div com `grid grid-cols-7 gap-1 mb-2`, adicionar:
```tsx
            {isMobile ? (
              /* Vista mobile: lista por dia */
              <div className="space-y-3">
                {eachDayOfInterval({
                  start: startOfMonth(currentMonth),
                  end: endOfMonth(currentMonth),
                }).filter((day) =>
                  agendamentosFiltrados.some((a) => isSameDay(parseISO(a.data_hora), day))
                ).map((day) => {
                  const dayApts = agendamentosFiltrados.filter((a) =>
                    isSameDay(parseISO(a.data_hora), day)
                  );
                  return (
                    <div key={day.toISOString()}>
                      <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5 px-1">
                        {format(day, "EEE, d 'de' MMMM", { locale: ptBR })}
                      </p>
                      <div className="space-y-1.5">
                        {dayApts.map((apt) => (
                          <button
                            key={apt.id}
                            onClick={() => { setSelectedApt(apt); setIsDetailModalOpen(true); }}
                            className="w-full text-left px-4 py-3 bg-card rounded-xl border border-border/60 hover:border-teal/40 transition-colors"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-semibold text-sm text-foreground truncate">
                                {apt.paciente?.nome ?? '—'}
                              </span>
                              <span className="font-mono text-xs text-muted-foreground shrink-0">
                                {format(parseISO(apt.data_hora), 'HH:mm')}
                              </span>
                            </div>
                            <span className={`mt-1 inline-block text-[10px] font-bold px-2 py-0.5 rounded-full ${getStatusColor(apt.status)}`}>
                              {STATUS_DISPLAY[apt.status] ?? apt.status}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
                {agendamentosFiltrados.length === 0 && (
                  <div className="text-center py-10 text-muted-foreground text-sm">
                    Nenhum agendamento este mês.
                  </div>
                )}
              </div>
            ) : (
              /* Vista desktop: grid calendário */
              <>
```

E fechar com:
```tsx
              </>
            )}
```
Logo após o bloco do grid de calendário (`</div>` que fecha o grid de 7 colunas e o mini-resumo do dia).

> **Nota:** Ler o arquivo para localizar os pontos de corte exatos. A estrutura é: `grid grid-cols-7` (cabeçalho de dias) → `grid grid-cols-7` (células dos dias) → mini-resumo do dia. Envolver esses três blocos no `{isMobile ? ... : <>...</>}`.

**Commit:** `feat: vista lista mobile no calendário de agendamentos`

---

## Task 10: PlanGuard — audit e gaps na página de Usuários

**Problema:** A página de Usuários não passa `plano` para o `UsuariosClient`, portanto não é possível mostrar PlanGuard correto para `equipe` e `multiDentistas`.

### 10a — Page server component

**Arquivo:** `src/app/dashboard/configuracoes/usuarios/page.tsx`

Adicionar `plano` à query e passar para o client:

**Buscar:**
```ts
  const [{ data: usuarios }, { data: convites }, { data: clinica }] = await Promise.all([
    supabase
      .from('dentistas')
      .select('id, nome, email, role, ativo, created_at')
      .eq('clinica_id', dentista.clinica_id)
      .order('created_at', { ascending: true }),
    supabase
      .from('convites')
      .select('id, email, role, expires_at, created_at')
      .eq('clinica_id', dentista.clinica_id)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false }),
    supabase
      .from('clinicas')
      .select('limite_dentistas')
      .eq('id', dentista.clinica_id)
      .single(),
  ]);
```

**Substituir:**
```ts
  const [{ data: usuarios }, { data: convites }, { data: clinica }] = await Promise.all([
    supabase
      .from('dentistas')
      .select('id, nome, email, role, ativo, created_at')
      .eq('clinica_id', dentista.clinica_id)
      .order('created_at', { ascending: true }),
    supabase
      .from('convites')
      .select('id, email, role, expires_at, created_at')
      .eq('clinica_id', dentista.clinica_id)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false }),
    supabase
      .from('clinicas')
      .select('limite_dentistas, plano')
      .eq('id', dentista.clinica_id)
      .single(),
  ]);
```

Adicionar o import de `PlanoId`:
```ts
import type { PlanoId } from '@/lib/planos';
```

**Buscar:**
```ts
  const limiteDentistas = (clinica as { limite_dentistas: number } | null)?.limite_dentistas ?? 5;
```
**Substituir:**
```ts
  const clinicaData = clinica as { limite_dentistas: number; plano: string } | null;
  const limiteDentistas = clinicaData?.limite_dentistas ?? 5;
  const plano = (clinicaData?.plano ?? 'SOLO') as PlanoId;
```

**Buscar:**
```ts
  return (
    <UsuariosClient
      usuarios={(usuarios as UsuarioRow[]) ?? []}
      convitesPendentes={(convites as ConvitePendente[]) ?? []}
      meuId={dentista.id}
      meuRole={dentista.role}
      limiteDentistas={limiteDentistas}
      convitesRestantes={convitesRestantes}
    />
  );
```
**Substituir:**
```ts
  return (
    <UsuariosClient
      usuarios={(usuarios as UsuarioRow[]) ?? []}
      convitesPendentes={(convites as ConvitePendente[]) ?? []}
      meuId={dentista.id}
      meuRole={dentista.role}
      limiteDentistas={limiteDentistas}
      convitesRestantes={convitesRestantes}
      plano={plano}
    />
  );
```

### 10b — UsuariosClient

**Arquivo:** `src/app/dashboard/configuracoes/usuarios/_components/usuarios-client.tsx`

Adicionar imports:
```ts
import type { PlanoId } from '@/lib/planos';
import { temFeature } from '@/lib/planos';
import { Lock, ArrowUpRight } from 'lucide-react';
import Link from 'next/link';
```

Atualizar a interface `Props`:
```ts
interface Props {
  usuarios: UsuarioRow[];
  convitesPendentes: ConvitePendente[];
  meuId: string;
  meuRole: DentistaRole;
  limiteDentistas: number;
  convitesRestantes: number;
  plano: PlanoId;
}
```

Atualizar a desestruturação:
```ts
export function UsuariosClient({ usuarios, convitesPendentes, meuId, meuRole, limiteDentistas, convitesRestantes, plano }: Props): React.JSX.Element {
```

**Localizar o botão de convidar** (onde o formulário de convite é disparado ou onde o botão "Convidar" fica no header da seção). Ler o arquivo para identificar o wrapper exato. O padrão será:

```tsx
{/* Guard de plano para convite de dentista adicional */}
{!temFeature(plano, 'multiDentistas') && convitesRestantes === 0 && (
  <div className="rounded-2xl border border-teal/20 bg-teal/5 p-6 flex items-center justify-between gap-4">
    <div className="flex items-center gap-3">
      <div className="w-10 h-10 rounded-xl bg-teal/10 border border-teal/20 flex items-center justify-center shrink-0">
        <Lock className="w-5 h-5 text-teal" />
      </div>
      <div>
        <p className="font-bold text-sm text-foreground">Limite de dentistas atingido</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          O plano <strong>{plano}</strong> permite apenas {limiteDentistas} dentista{limiteDentistas !== 1 ? 's' : ''}.
          Faça upgrade para adicionar mais.
        </p>
      </div>
    </div>
    <Link
      href="/dashboard/configuracoes"
      className="shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-xl bg-teal text-white text-sm font-bold hover:bg-teal-lt transition-colors"
    >
      Fazer Upgrade
      <ArrowUpRight className="w-4 h-4" />
    </Link>
  </div>
)}
{!temFeature(plano, 'equipe') && (
  <div className="rounded-2xl border border-border bg-muted/40 p-6 flex items-center justify-between gap-4">
    <div className="flex items-center gap-3">
      <div className="w-10 h-10 rounded-xl bg-muted border border-border flex items-center justify-center shrink-0">
        <Lock className="w-5 h-5 text-muted-foreground" />
      </div>
      <div>
        <p className="font-bold text-sm text-foreground">Secretária disponível no Plano Básico</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Convide uma secretária para gerenciar agenda e recepção.
        </p>
      </div>
    </div>
    <Link
      href="/dashboard/configuracoes"
      className="shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-xl border border-border text-sm font-bold hover:bg-muted transition-colors"
    >
      Ver Planos
      <ArrowUpRight className="w-4 h-4" />
    </Link>
  </div>
)}
```

> **Nota:** Ler o arquivo completo antes de implementar para identificar onde esses banners devem ser inseridos (antes do formulário de convite, na seção de equipe).

**Commit:** `feat: PlanGuard para equipe e multiDentistas na página de Usuários`

---

## Task 11: Storage migrations

**Arquivo:** `supabase/migrations/20260510000001_052_storage_policies.sql`

```sql
-- Migration 052: criar buckets do Storage de forma idempotente e definir RLS policies
-- Buckets criados manualmente até aqui: audios, fichas, radiografias, documentos, avatars
-- Esta migration garante que o setup não dependa de configuração manual no dashboard.

-- ─── Buckets ──────────────────────────────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('audios', 'audios', false, 52428800, ARRAY['audio/webm', 'audio/mp4', 'audio/mpeg', 'audio/ogg', 'audio/wav']),
  ('fichas', 'fichas', true, 20971520, ARRAY[
    'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/bmp',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  ]),
  ('radiografias', 'radiografias', false, 20971520, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/dicom']),
  ('documentos', 'documentos', false, 52428800, ARRAY[
    'image/jpeg', 'image/png', 'image/webp',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  ]),
  ('avatars', 'avatars', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ─── RLS Policies: audios ─────────────────────────────────────────────────────

DROP POLICY IF EXISTS audios_upload_policy ON storage.objects;
CREATE POLICY audios_upload_policy ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'audios'
    AND (storage.foldername(name))[1] IN (
      SELECT clinica_id::text FROM dentistas WHERE user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS audios_read_policy ON storage.objects;
CREATE POLICY audios_read_policy ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'audios'
    AND (storage.foldername(name))[1] IN (
      SELECT clinica_id::text FROM dentistas WHERE user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS audios_delete_policy ON storage.objects;
CREATE POLICY audios_delete_policy ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'audios'
    AND (storage.foldername(name))[1] IN (
      SELECT clinica_id::text FROM dentistas WHERE user_id = (SELECT auth.uid())
    )
  );

-- ─── RLS Policies: fichas (público para leitura, autenticado para escrita) ───

DROP POLICY IF EXISTS fichas_upload_policy ON storage.objects;
CREATE POLICY fichas_upload_policy ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'fichas'
    AND (storage.foldername(name))[1] IN (
      SELECT clinica_id::text FROM dentistas WHERE user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS fichas_read_policy ON storage.objects;
CREATE POLICY fichas_read_policy ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'fichas');

DROP POLICY IF EXISTS fichas_delete_policy ON storage.objects;
CREATE POLICY fichas_delete_policy ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'fichas'
    AND (storage.foldername(name))[1] IN (
      SELECT clinica_id::text FROM dentistas WHERE user_id = (SELECT auth.uid())
    )
  );

-- ─── RLS Policies: radiografias ───────────────────────────────────────────────

DROP POLICY IF EXISTS radiografias_upload_policy ON storage.objects;
CREATE POLICY radiografias_upload_policy ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'radiografias'
    AND (storage.foldername(name))[1] IN (
      SELECT clinica_id::text FROM dentistas WHERE user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS radiografias_read_policy ON storage.objects;
CREATE POLICY radiografias_read_policy ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'radiografias'
    AND (storage.foldername(name))[1] IN (
      SELECT clinica_id::text FROM dentistas WHERE user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS radiografias_delete_policy ON storage.objects;
CREATE POLICY radiografias_delete_policy ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'radiografias'
    AND (storage.foldername(name))[1] IN (
      SELECT clinica_id::text FROM dentistas WHERE user_id = (SELECT auth.uid())
    )
  );

-- ─── RLS Policies: documentos ─────────────────────────────────────────────────

DROP POLICY IF EXISTS documentos_upload_policy ON storage.objects;
CREATE POLICY documentos_upload_policy ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'documentos'
    AND (storage.foldername(name))[1] IN (
      SELECT clinica_id::text FROM dentistas WHERE user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS documentos_read_policy ON storage.objects;
CREATE POLICY documentos_read_policy ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'documentos'
    AND (storage.foldername(name))[1] IN (
      SELECT clinica_id::text FROM dentistas WHERE user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS documentos_delete_policy ON storage.objects;
CREATE POLICY documentos_delete_policy ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'documentos'
    AND (storage.foldername(name))[1] IN (
      SELECT clinica_id::text FROM dentistas WHERE user_id = (SELECT auth.uid())
    )
  );

-- ─── RLS Policies: avatars (público para leitura) ────────────────────────────

DROP POLICY IF EXISTS avatars_upload_policy ON storage.objects;
CREATE POLICY avatars_upload_policy ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars');

DROP POLICY IF EXISTS avatars_read_policy ON storage.objects;
CREATE POLICY avatars_read_policy ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS avatars_delete_policy ON storage.objects;
CREATE POLICY avatars_delete_policy ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] IN (
      SELECT clinica_id::text FROM dentistas WHERE user_id = (SELECT auth.uid())
    )
  );
```

**Commit:** `feat: migration 052 — storage buckets e RLS policies versionados`

---

## Task 12: Env validation

**Arquivo:** `src/lib/env.ts` (criar)

```ts
// Valida variáveis de ambiente críticas ao carregar o módulo.
// Lança erro descritivo se alguma estiver ausente, evitando falhas silenciosas em produção.

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Variável de ambiente obrigatória não configurada: ${name}. ` +
      `Verifique o arquivo .env.local ou as variáveis do deploy.`
    );
  }
  return value;
}

export const env = {
  geminiApiKey: (): string => requireEnv('GEMINI_API_KEY'),
  openaiApiKey: (): string => requireEnv('OPENAI_API_KEY'),
  supabaseUrl: (): string => requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
  supabaseAnonKey: (): string => requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
  supabaseServiceRoleKey: (): string => requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
  googleClientId: (): string => requireEnv('GOOGLE_CLIENT_ID'),
  googleClientSecret: (): string => requireEnv('GOOGLE_CLIENT_SECRET'),
  nextPublicSiteUrl: (): string => process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000',
} as const;
```

### Aplicar em `src/app/api/transcrever/route.ts`

**Buscar:**
```ts
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY ?? '' });
```
**Substituir:**
```ts
import { env } from '@/lib/env';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY ?? '' });
```

E na verificação inline dentro de POST:
**Buscar:**
```ts
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: 'OPENAI_API_KEY não configurada.' }, { status: 500 });
  }
```
**Substituir (remover o check inline — o env.ts já lança ao iniciar):**
```ts
  // env.openaiApiKey() lança no boot se ausente — aqui já está garantido
```

### Aplicar em `src/app/api/gerar-planejamento/route.ts`

**Buscar:**
```ts
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'GEMINI_API_KEY não configurada.' }, { status: 500 });
  }
```
**Substituir:**
```ts
  let apiKey: string;
  try {
    apiKey = env.geminiApiKey();
  } catch {
    return NextResponse.json({ error: 'GEMINI_API_KEY não configurada.' }, { status: 500 });
  }
```

Adicionar import no topo do arquivo:
```ts
import { env } from '@/lib/env';
```

**Commit:** `feat: src/lib/env.ts — validação de vars de ambiente críticas`

---

## Ordem de execução recomendada

1. Task 1 — SignaturePad dark mode (isolado, sem dependências)
2. Task 2 — Odontograma dark mode (1 linha)
3. Tasks 3–5 — Toasts (mecânico, alto volume)
4. Tasks 6–7 — Skeletons (loading.tsx + inline)
5. Task 8 — Mobile FichasTab
6. Task 9 — Mobile Agendamentos
7. Task 10 — PlanGuard audit
8. Task 11 — Storage migration
9. Task 12 — Env validation

---

## Verificação final

Após todas as tasks:
```bash
npm run typecheck
npm run lint
npm run build
```

Inspecionar manualmente em dark mode:
- SignaturePad (abrir ficha → criar evolução → assinar)
- Odontograma (selecionar dente → ver checkbox)
- PlanejamentoTab loading state
- Agendamentos em viewport < 768px
