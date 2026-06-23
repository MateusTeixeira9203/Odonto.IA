# Plano de Sessão — Modo Consulta + Refinamentos Visuais

> Criado em: 2026-06-07  
> Objetivo: elevar o nível visual e corrigir funcionalidades críticas do Odonto.IA

---

## 0. Revisão de Keys de IA

**Estado atual em `.env.local`:**

| Key | Status | Usado para |
|---|---|---|
| `GEMINI_API_KEY` | ✅ Ativo | Formatar com IA, planejamento, todas as features |
| `OPENAI_API_KEY` | ❌ Quota excedida | Nada — abandonado |
| `GROQ_API_KEY` | ❌ Não configurado | Precisa adicionar para transcrição |

**Ação necessária antes de começar:**
- Criar conta em [console.groq.com](https://console.groq.com) → API Keys → gerar key gratuita
- Adicionar `GROQ_API_KEY=gsk_...` no `.env.local`
- Remover qualquer referência ao `OPENAI_API_KEY` no código

---

## 1. Borda feia do Hero do Dashboard

**Arquivo:** `src/components/dashboard/next-appointment-hero.tsx`

**Problema:** `containerShadow` tem `0 0 0 4px rgba(...)` (anel externo de glow) combinado com a borda `border-teal/50`. Resulta em efeito de borda dupla visual — parece pesado e poluído.

**Fix:** Remover o spread `0 0 0 4px` de todos os 6 estados do `containerShadow`. Manter apenas o `0 16px 48px -16px` (sombra de profundidade). A cor da borda já comunica o estado.

```ts
// ANTES
'0 0 0 4px rgba(47,156,133,0.10), 0 16px 48px -16px rgba(47,156,133,0.30)'

// DEPOIS
'0 16px 48px -16px rgba(47,156,133,0.30)'
```

---

## 2. Hero Strip do Paciente — Remodelação Visual

**Arquivo:** `src/app/dashboard/pacientes/[id]/_components/paciente-detail-client.tsx`  
**Seção:** `/* ── HERO STRIP (Task 5) */` — linhas ~932–1120

**Problema:** O strip de 3 colunas (Próxima Consulta / Tratamento / Pendências) está genérico e plano. Parece uma tabela com bordas divisórias, sem hierarquia visual.

**Conceito de redesign:**

Transformar o grid plano em 3 cards de status com personalidade própria:

### Col 1 — Próxima Consulta
- Remover o bloco `w-10 h-10` calendário-caixinha
- Substituir por uma pill de data grande com fundo teal/10, letra teal forte
- Mostrar dia + mês em destaque, hora menor abaixo
- Adicionar chip de "Hoje", "Amanhã" ou "Em X dias" com cor dinâmica
- Estado vazio: chip cinza "Sem consulta" + botão inline "+ Agendar"

### Col 2 — Tratamento
- Adicionar barra de progresso visual (etapas concluídas / total)
- Mostrar nome do plano em destaque + fase atual
- Chip de status: "Em andamento", "Aguardando aprovação", "Planejamento ativo"
- Sem tratamento: estado visual limpo com ícone e CTA "Criar planejamento"

### Col 3 — Pendências
- Substituir lista simples por badges coloridos por urgência
- Follow-up: chip âmbar com contador de dias pendente
- Orçamento aguardando: chip coral com "1 aguardando"
- Sem pendências: checkmark verde com "Tudo em dia"

**Visual geral:**
- Remover bordas divisórias horizontais `border-border/60`
- Substituir por separadores mais suaves — `bg-border/30` de 1px
- Cada coluna com `hover:bg-surface-alt/40` suave
- Labels uppercase mais sutis (`text-[9px] tracking-[0.3em]`)
- Adicionar micro-ícones à esquerda de cada label (Calendar, Activity, Bell)

---

## 3. Design do Modo Consulta — Sidebar Expandida

**Arquivo:** `src/app/consulta/[agendamentoId]/_components/consultation-sidebar.tsx`

**Problema:** Sidebar em `w-64` (256px) é estreita, sem hierarquia forte, parece genérica.

**Mudanças:**

### Largura
`w-64` → `w-80` (320px)

### Seção de Identificação (topo)
Antes: nome + idade + observações em texto puro  
Depois:
- Avatar grande com iniciais (50px) + anel colorido (teal padrão, coral se tem alertas)
- Nome em heading forte
- Chips inline: idade + "X consultas" + "Desde mês/ano"
- Observações do agendamento em balão/quote estilizado

### Seções intermediárias
- Cada seção com `rounded-xl bg-surface-alt/60` ao redor (cards internos)
- Headers com ícone + label de 9px uppercase
- Separadores entre seções apenas `border-border/40` 1px
- Hover suave em cada card

### Planejamento ativo
- Barra de progresso mais larga e visível
- Badge "HOJE" mais imponente
- Etapas com checkmarks explícitos

### Última visita
- Data mais destacada
- Dentes como chips mais estilizados com número centralizado

---

## 4. Formatar com IA — Velocidade Percebida

**Arquivo:** `src/app/consulta/[agendamentoId]/_components/consulta-client.tsx`  
**Função:** `handleFormatar`

**Problema:** Gemini 2.5 Flash demora 6–16s. O usuário vê apenas spinner genérico.

**Solução — Feedback Progressivo por Etapas:**

Adicionar um array de etapas com timers internos que atualizam o label do botão enquanto a requisição acontece:

```ts
const ETAPAS = [
  { ms: 0,    label: 'Analisando queixa...' },
  { ms: 1800, label: 'Identificando dentes...' },
  { ms: 3800, label: 'Gerando conduta...' },
  { ms: 6500, label: 'Finalizando ficha...' },
];
```

O servidor ainda faz **uma única chamada** ao Gemini. A percepção de velocidade melhora porque o usuário vê "progresso real" acontecendo — não um spinner parado.

Implementar com `useState<string>('Formatar com IA')` + `useEffect` com `setTimeout` que avanças as etapas enquanto `isFormatting === true`. Limpar todos os timeouts no cleanup.

---

## 5. Transcrição — Migrar para Groq Whisper

**Arquivo:** `src/app/api/transcrever/route.ts`

**Problema:** Gemini `inlineData` com áudio é instável — 503 frequente, sobrecarga do modelo. Não é o modelo adequado para áudio curto de consulta.

**Solução:** Groq Whisper `whisper-large-v3-turbo`
- Latência real: ~1–2s (vs 6–10s do Gemini)
- Free tier generoso
- API simples e confiável
- Suporte nativo a `multipart/form-data`

**Dependência nova:**
```bash
npm install groq-sdk
```

**Código novo:**
```ts
import Groq from 'groq-sdk';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const transcription = await groq.audio.transcriptions.create({
  file: audioFile,          // File object direto
  model: 'whisper-large-v3-turbo',
  language: 'pt',
  prompt: 'dentista, endodontia, exodontia, restauração, implante, prótese, periodontia',
});

return NextResponse.json({ transcricao: transcription.text });
```

**Vantagens do `prompt`:** O campo prompt do Whisper funciona como dicionário de contexto — lista de termos odontológicos melhora drasticamente o reconhecimento de palavras técnicas.

---

## 7. Ficha Clínica — Procedimentos e Múltiplos por Dente

**Arquivos:** `src/components/pacientes/FichasTab.tsx` + `src/app/api/dex/formatar-evolucao/route.ts`

### Problema diagnosticado

O modo consulta salva 3 campos distintos no banco:
- `dentes_afetados` + `dentes_observacoes` → **mostrados** na FichasTab ✅
- `procedimentos` (array de strings) → **salvo mas nunca buscado nem exibido** ❌
- `conduta` + `retorno_sugerido` → **salvos mas nunca buscados nem exibidos** ❌

Além disso, a IA retorna **uma string única por dente** em `dentes_observacoes` — então mesmo que o dentista tenha feito 3 procedimentos no dente 36, aparece apenas 1 item marcável (`36_0`).

### Correção 1 — FichasTab: buscar e exibir `procedimentos`, `conduta`, `retorno_sugerido`

**Tipo `FichaDB`** — adicionar campos:
```ts
procedimentos: string[] | null;
conduta: string | null;
retorno_sugerido: string | null;
```

**Query Supabase** — expandir select:
```ts
.select("id, created_at, queixa_principal, anotacoes, dentes_afetados, dentes_observacoes,
         status, procedimentos_concluidos, procedimentos, conduta, retorno_sugerido,
         assinatura_url, assinado_em, dentista:dentistas(nome)")
```

**Interface `Evolution`** — adicionar:
```ts
procedimentos: string[];
conduta: string | null;
retornoSugerido: string | null;
```

**`mapFichaToEvolution`** — mapear novos campos:
```ts
procedimentos: f.procedimentos ?? [],
conduta: f.conduta ?? null,
retornoSugerido: f.retorno_sugerido ?? null,
```

**Card da ficha** — exibir seção "Procedimentos realizados" quando `evo.procedimentos.length > 0`:
- Lista de chips/badges com cada procedimento (estilo pill teal/10)
- Exibir `conduta` como bloco de texto se preenchido
- Exibir `retornoSugerido` como badge "Retorno em X dias"

### Correção 2 — Prompt da IA: múltiplos procedimentos no mesmo dente

**Arquivo:** `src/app/api/dex/formatar-evolucao/route.ts`

Alterar instrução do `dentes_observacoes` para suportar múltiplos procedimentos por dente separados por `\n`:

```
// ANTES
"dentes_observacoes": {"número": "observação específica deste dente"},

// DEPOIS
"dentes_observacoes": {"número": "procedimento 1\nprocedimento 2\nprocedimento 3"},

Regra: se mais de um procedimento no mesmo dente, separar por \n — cada linha vira um item marcável independente.
```

Isso faz o sistema de check-off (`tooth_0`, `tooth_1`, `tooth_2`) funcionar corretamente para múltiplos procedimentos por dente.

### Resultado esperado

Ao abrir a ficha de uma consulta do modo consulta:
- ✅ Dentes marcados no odontograma (já funcionava)
- ✅ Observação por dente (já funcionava)
- ✅ Lista de procedimentos realizados visível na card
- ✅ Múltiplos procedimentos no mesmo dente → múltiplos checkboxes
- ✅ Conduta clínica exibida
- ✅ Retorno sugerido exibido como badge

---

## Ordem de Execução

```
1. [x] GROQ_API_KEY → .env.local + npm install groq-sdk   ← FEITO
2. [x] Migrar transcrição → Groq Whisper                   ← FEITO
3. [ ] Fix borda hero dashboard (~5 min)
4. [ ] Hero strip paciente — remodelação visual (~45 min)
5. [ ] Feedback progressivo Formatar com IA (~20 min)
6. [ ] Redesign sidebar consulta (~45 min)
7. [ ] Ficha clínica — procedimentos + múltiplos por dente (~30 min)
```

**Total estimado:** ~2h30 restantes

---

## Arquivos Impactados

| Arquivo | Mudança |
|---|---|
| `.env.local` | `GROQ_API_KEY` adicionado ✅ |
| `src/app/api/transcrever/route.ts` | Migrado Gemini → Groq Whisper ✅ |
| `src/components/dashboard/next-appointment-hero.tsx` | Fix borda (remover spread 4px) |
| `src/app/dashboard/pacientes/[id]/_components/paciente-detail-client.tsx` | Redesign hero strip 3 colunas |
| `src/app/consulta/[agendamentoId]/_components/consulta-client.tsx` | Feedback progressivo |
| `src/app/consulta/[agendamentoId]/_components/consultation-sidebar.tsx` | Redesign sidebar (w-80, cards) |
| `src/components/pacientes/FichasTab.tsx` | Buscar + exibir `procedimentos`, `conduta`, `retorno_sugerido` |
| `src/app/api/dex/formatar-evolucao/route.ts` | Prompt: múltiplos procedimentos por dente com `\n` |
