# Spec — Odontograma de referência como padrão do sistema (Fase 1)

**Status:** Aprovada (usuário aprovou approach + detalhe). Data: 2026-07-03.
**Objetivo:** tornar o `Odontograma.tsx` (o odontograma anatômico com Permanentes **e Decíduos**) o seletor padrão, trazendo-o pro **modo consulta** — que hoje usa um `MiniOdontograma` só-permanentes. Decíduos são necessários em casos pediátricos.

## Estado atual (mapa)
| Componente | Decíduos? | Usado em | Interface |
|---|---|---|---|
| `components/odontograma/Odontograma.tsx` (referência) | ✅ aba Permanentes/Decíduos | `FichasTab` | `selectedTeeth` / `onToothToggle` |
| `consulta/.../mini-odontograma.tsx` | ❌ só permanentes | `consulta-client` | `selected` / `aiDetected` / `onChange` |
| `fichas/NovaEvolucaoPanel.tsx` (grid inline) | ❌ | **ninguém (morto)** | — |

## Insight que destrava
Dente é `FDI int[]` em todo lugar. Decíduos (51–85) **já são FDI válidos**, **já aceitos** pela validação da IA (`formatar-evolucao`, quadrantes 5–8), e o de referência **já os desenha**. Portanto: **zero mudança de banco, zero mudança de IA** — só troca qual componente renderiza o seletor no consulta.

## Decisões travadas
- **Estado "detectado pela IA" = amber** (mesmo amber pendente do Mini). Mantido.
- **`hideFilters` no consulta** — os filtros (Maxila/Mandíbula/Arcadas) não são necessários dentro do modo consulta. Abas Permanentes/Decíduos **mantidas** (é o ponto).
- Sentinelas de arcada (97/98/99) **não** entram no componente de referência nesta fase — ficam nos chips (`arch-chips.tsx`).

## Mudanças por arquivo

### 1. `Odontograma.tsx` (aditivo)
- Prop nova `detectedTeeth?: number[]` (default `[]`).
- Novo `ToothState` `'detected'`.
- `getState` precedência: `shared > selected > detected > historical > default`.
- Estilo `detected`: amber (token do design system; se não houver, o mesmo valor amber do Mini).
- **Indicador de aba:** ponto/contador em Permanentes e Decíduos com nº de dentes ativos (selecionados+detectados) daquela dentição — torna um decíduo detectado descobrível quando a aba ativa é a outra.
- FichasTab não passa `detectedTeeth` → comportamento idêntico.

### 2. `consulta-client.tsx`
- Troca `<MiniOdontograma>` por `<Odontograma compact hideFilters>` com adaptador:
  - `selectedTeeth={confirmedTeeth}`
  - `detectedTeeth={dentes_afetados.filter(t => !confirmedTeeth.includes(t))}`
  - `onToothToggle={t => setConfirmedTeeth(prev => prev.includes(t) ? prev.filter(x=>x!==t) : [...prev, t])}`
- Renderiza `<ArchChips>` ao lado (mesmo toggle).
- "Confirmar todos os detectados" e o editor multi-procedimento por dente **inalterados** (iteram `confirmedTeeth`; funcionam com decíduos de graça).

### 3. `arch-chips.tsx` (novo)
- Extrai os 3 chips (Boca Toda / Arcada Sup / Inf, sentinelas 99/97/98 de `@/lib/arcadas`) do Mini.
- Props: `selected: number[]`, `detected: number[]`, `onToggle: (n:number)=>void`. amber se detectado & não-selecionado; teal se selecionado.

### 4. `mini-odontograma.tsx` — **deletado**.

## O que NÃO muda
Banco · IA/validação FDI · FichasTab · editor multi-proc por dente.

## Riscos & verificação
- **Único risco real = visual:** caber o de referência no drawer estreito. Fallback: `overflow-x-auto` (já existe) + `compact`.
- `tsc`/`eslint` limpos.
- Teste ao vivo no consulta: detectar 1 permanente + 1 decíduo (ex. 54) → indicador na aba Decíduos acende; marcar/desmarcar; 1 arch chip; confirmar que FichasTab não mudou.

## Fase 2 (futuro, não nesta entrega)
- Mover seleção de arcada (97/98/99) pra dentro do componente de referência (FichasTab + consulta compartilham).
- Deletar `NovaEvolucaoPanel` (grid inline morto).
