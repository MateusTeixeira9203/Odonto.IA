# Plano: Modo Consulta Premium
**Data:** 2026-06-02  
**Status:** PRONTO PARA EXECUÇÃO

---

## Goal
Transformar `/consulta/[agendamentoId]` no cockpit clínico inteligente definitivo do Odonto.IA — com pipeline de IA expandido, dicionário odontológico, voice UX com identidade Dex, estado amber de validação e commit estruturado.

## Contexto: o que existe hoje
- Rota `/consulta/[agendamentoId]` funcional com `ConsultaClient` + `ConsultationSidebar` + `FinalizeConsultationDialog`
- `/api/transcrever` → Whisper (OpenAI) com prompt dental básico
- `/api/dex/formatar-evolucao` → Gemini 2.5 Flash JSON mode, retorna 4 campos
- `actions.ts` → `salvarFichaConsulta`, `iniciarAtendimentoConsulta`, `finalizarConsulta`
- `lib/ai/provider.ts` → `generateStructured` + `generateText`
- `lib/ai/prompts/` → briefing.ts, communication.ts, contextual-questions.ts, treatment-explanation.ts

## Bugs identificados para corrigir
1. `alertasClinicos` em `page.tsx` lê só da última ficha — alergia antiga some silenciosamente
2. `finalizarConsulta` concatena resumo/conduta com emojis em texto livre — não estruturado
3. Wizard manual do `FinalizeConsultationDialog` é atrito puro — IA deveria gerar esses campos

## Stack
- Next.js App Router, TypeScript estrito, Supabase, Gemini 2.5 Flash, Whisper, Framer Motion, Tailwind v4

## File Map Completo

| Arquivo | Ação |
|---|---|
| `src/lib/odonto-dictionary.ts` | CREATE |
| `src/app/consulta/[agendamentoId]/page.tsx` | MODIFY — fix alertas aggregation |
| `src/app/api/transcrever/route.ts` | MODIFY — prompt dental rico |
| `src/app/api/dex/formatar-evolucao/route.ts` | MODIFY — 8 campos + dicionário |
| `src/app/consulta/[agendamentoId]/actions.ts` | MODIFY — storage estruturado |
| `src/app/consulta/[agendamentoId]/_components/mini-odontograma.tsx` | CREATE |
| `src/app/consulta/[agendamentoId]/_components/draft-pending-card.tsx` | CREATE |
| `src/app/consulta/[agendamentoId]/_components/voice-ux.tsx` | CREATE |
| `src/components/consulta/modo-consulta-loader.tsx` | CREATE |
| `src/app/consulta/[agendamentoId]/_components/consulta-client.tsx` | MODIFY — integrar tudo |
| `src/app/consulta/[agendamentoId]/_components/consultation-sidebar.tsx` | MODIFY — context rail |
| `src/components/dashboard/next-appointment-hero.tsx` | MODIFY — 5/10min breakpoints |

---

## FASE 1 — FUNDAÇÃO (dados e lógica, sem UI)

### Task 1: Criar `src/lib/odonto-dictionary.ts`

**Files:** `src/lib/odonto-dictionary.ts` (CREATE)

Dicionário odontológico oficial do sistema. Será importado pelo Whisper prompt, pelo formatar-evolucao e por qualquer IA que toque em dados clínicos.

**Steps:**
1. Criar `src/lib/odonto-dictionary.ts`:

```typescript
// Dicionário odontológico oficial — Odonto.IA
// Importado por: /api/transcrever, /api/dex/formatar-evolucao, briefing, e qualquer IA clínica

// ── Numeração FDI — todos os 32 dentes ────────────────────────────────────────

export const DENTES_FDI: Record<number, string> = {
  // Quadrante 1 — Superior Direito
  18: 'Terceiro molar superior direito (siso)',
  17: 'Segundo molar superior direito',
  16: 'Primeiro molar superior direito',
  15: 'Segundo pré-molar superior direito',
  14: 'Primeiro pré-molar superior direito',
  13: 'Canino superior direito',
  12: 'Incisivo lateral superior direito',
  11: 'Incisivo central superior direito',
  // Quadrante 2 — Superior Esquerdo
  21: 'Incisivo central superior esquerdo',
  22: 'Incisivo lateral superior esquerdo',
  23: 'Canino superior esquerdo',
  24: 'Primeiro pré-molar superior esquerdo',
  25: 'Segundo pré-molar superior esquerdo',
  26: 'Primeiro molar superior esquerdo',
  27: 'Segundo molar superior esquerdo',
  28: 'Terceiro molar superior esquerdo (siso)',
  // Quadrante 3 — Inferior Esquerdo
  31: 'Incisivo central inferior esquerdo',
  32: 'Incisivo lateral inferior esquerdo',
  33: 'Canino inferior esquerdo',
  34: 'Primeiro pré-molar inferior esquerdo',
  35: 'Segundo pré-molar inferior esquerdo',
  36: 'Primeiro molar inferior esquerdo',
  37: 'Segundo molar inferior esquerdo',
  38: 'Terceiro molar inferior esquerdo (siso)',
  // Quadrante 4 — Inferior Direito
  41: 'Incisivo central inferior direito',
  42: 'Incisivo lateral inferior direito',
  43: 'Canino inferior direito',
  44: 'Primeiro pré-molar inferior direito',
  45: 'Segundo pré-molar inferior direito',
  46: 'Primeiro molar inferior direito',
  47: 'Segundo molar inferior direito',
  48: 'Terceiro molar inferior direito (siso)',
};

// ── Procedimentos — termos coloquiais → nome clínico ─────────────────────────

export const PROCEDIMENTOS_MAP: Record<string, string> = {
  'canal':                     'Tratamento endodôntico',
  'endodontia':                'Tratamento endodôntico',
  'retratamento de canal':     'Retratamento endodôntico',
  'extração':                  'Exodontia',
  'exodontia':                 'Exodontia',
  'extração simples':          'Exodontia simples',
  'extração complexa':         'Exodontia complexa',
  'siso':                      'Exodontia de terceiro molar',
  'raspagem':                  'Raspagem e alisamento radicular',
  'raspagem supra':            'Raspagem supragengival',
  'raspagem infra':            'Raspagem infragengival',
  'profilaxia':                'Profilaxia dental',
  'limpeza':                   'Profilaxia dental',
  'restauração':               'Restauração direta',
  'amálgama':                  'Restauração com amálgama',
  'resina':                    'Restauração com resina composta',
  'faceta':                    'Faceta de porcelana/resina',
  'clareamento':               'Clareamento dental',
  'coroa':                     'Coroa total protética',
  'prótese':                   'Prótese dentária',
  'implante':                  'Implante osseointegrado',
  'enxerto':                   'Enxerto ósseo/tecido mole',
  'gengivoplastia':            'Gengivoplastia',
  'apicectomia':               'Cirurgia parendodôntica (apicectomia)',
  'placa':                     'Placa miorrelaxante/de bruxismo',
  'contenção':                 'Contenção ortodôntica',
  'radiografia':               'Exame radiográfico',
  'tomografia':                'Tomografia computadorizada de feixe cônico (CBCT)',
  'moldagem':                  'Moldagem para confecção de prótese/dispositivo',
  'cimentação':                'Cimentação de prótese/restauração indireta',
  'retentor intracanal':       'Núcleo de preenchimento / retentor intracanal',
};

// ── Faces dentais ─────────────────────────────────────────────────────────────

export const FACES_DENTAIS: Record<string, string> = {
  'M':   'Mesial',
  'D':   'Distal',
  'O':   'Oclusal',
  'V':   'Vestibular',
  'L':   'Lingual',
  'P':   'Palatina',
  'MO':  'Mesio-oclusal',
  'DO':  'Disto-oclusal',
  'MOD': 'Mesio-ocluso-distal',
  'MV':  'Mesio-vestibular',
};

// ── Materiais e anestesia ─────────────────────────────────────────────────────

export const MATERIAIS_MAP: Record<string, string> = {
  'lidocaína':      'Lidocaína (anestésico local)',
  'articaína':      'Articaína (anestésico local)',
  'mepivacaína':    'Mepivacaína (anestésico local)',
  'guta-percha':    'Guta-percha (material obturador endodôntico)',
  'cimento endodôntico': 'Cimento obturador endodôntico',
  'hidróxido de cálcio': 'Hidróxido de cálcio (medicação intracanal)',
};

// ── Prompt para Whisper — vocabulário de contexto ────────────────────────────

export const WHISPER_DENTAL_PROMPT =
  'Dentista descrevendo evolução clínica em português brasileiro. ' +
  'Termos comuns: endodontia, exodontia, raspagem supra e infragengival, ' +
  'restauração com resina composta e amálgama, faceta de porcelana, ' +
  'implante osseointegrado, enxerto ósseo, prótese total e parcial removível, ' +
  'coroa total, retentores intracanal, placa miorrelaxante, clareamento dental, ' +
  'apicectomia, gengivoplastia, contenção ortodôntica, radiografia periapical, ' +
  'tomografia CBCT, moldagem, cimentação, profilaxia, anestesia com lidocaína e articaína. ' +
  'Numeração FDI: dentes 11 a 18 (superiores direitos), 21 a 28 (superiores esquerdos), ' +
  '31 a 38 (inferiores esquerdos), 41 a 48 (inferiores direitos). ' +
  'Faces: MOD = mesio-ocluso-distal, MO = mesio-oclusal, DO = disto-oclusal. ' +
  'Siso = terceiro molar (18, 28, 38, 48).';

// ── Contexto para injeção no prompt da IA ────────────────────────────────────

export function buildDentalContext(): string {
  const procedimentos = Object.entries(PROCEDIMENTOS_MAP)
    .slice(0, 15)
    .map(([k, v]) => `"${k}" → ${v}`)
    .join(', ');

  return `
GLOSSÁRIO ODONTOLÓGICO (use para interpretar o relato):
Numeração FDI: dentes 11-18 (sup. dir.), 21-28 (sup. esq.), 31-38 (inf. esq.), 41-48 (inf. dir.)
Sisos: 18, 28, 38, 48
Faces: M=Mesial, D=Distal, O=Oclusal, V=Vestibular, L=Lingual, MOD=Mesio-ocluso-distal
Procedimentos: ${procedimentos}
Sempre converter número verbal para FDI: "vinte e seis" → 26, "trinta e seis" → 36
`.trim();
}
```

2. Commit: `git commit -m "feat: odonto-dictionary — dicionário oficial de terminologia odontológica"`

---

### Task 2: Corrigir `alertasClinicos` em `page.tsx`

**Files:** `src/app/consulta/[agendamentoId]/page.tsx`

**Bug:** alertas leem só da última ficha. Se alergia foi registrada há 3 fichas atrás, some silenciosamente.

**Steps:**
1. Abrir `page.tsx`, localizar o bloco de alertasClinicos (linhas ~71-74 aproximadamente)
2. Substituir a lógica atual:
```typescript
// ANTES — só lê ultimaFicha
const ultimaFicha = fichas?.[0] ?? null;
const alertasClinicos: string[] = [];
if (ultimaFicha?.alergias) alertasClinicos.push(`Alergias: ${ultimaFicha.alergias as string}`);
if (ultimaFicha?.medicamentos_em_uso) alertasClinicos.push(`Medicamentos: ${ultimaFicha.medicamentos_em_uso as string}`);
```
```typescript
// DEPOIS — agrega de todas as fichas, deduplicado
const alertasClinicos: string[] = [];
const alergiasSeen = new Set<string>();
const medicamentosSeen = new Set<string>();

for (const f of fichas ?? []) {
  const alergia = (f.alergias as string | null)?.trim();
  const med = (f.medicamentos_em_uso as string | null)?.trim();
  if (alergia && !alergiasSeen.has(alergia)) {
    alergiasSeen.add(alergia);
    alertasClinicos.push(`⚠️ Alergia: ${alergia}`);
  }
  if (med && !medicamentosSeen.has(med)) {
    medicamentosSeen.add(med);
    alertasClinicos.push(`💊 Medicamentos: ${med}`);
  }
}
```
3. Também adicionar `historico_medico` às fichas selecionadas (já está no select, mas não exibido nos alertas):
```typescript
// No select de fichas, garantir que historico_medico está incluído (já está)
// Adicionar ao loop:
const histMed = (f.historico_medico as string | null)?.trim();
if (histMed && histMed.length > 0 && !alertasClinicos.some(a => a.includes(histMed))) {
  alertasClinicos.push(`🏥 Histórico: ${histMed}`);
}
```
4. Commit: `git commit -m "fix: page.tsx — alertas clínicos agregados de todas as fichas, não só a última"`

---

### Task 3: Expandir `/api/dex/formatar-evolucao` — 8 campos + dicionário

**Files:** `src/app/api/dex/formatar-evolucao/route.ts`

Expandir o output da IA de 4 para 8 campos estruturados. Isso elimina o wizard manual de resumo/conduta.

**Steps:**
1. Abrir `route.ts` do formatar-evolucao
2. Atualizar a interface `EvolucaoFormatada`:
```typescript
export interface EvolucaoFormatada {
  queixa_principal:    string;
  anotacoes:           string;
  dentes_afetados:     number[];
  dentes_observacoes:  Record<string, string>;
  // Campos novos:
  procedimentos:       string[];           // lista dos procedimentos realizados
  conduta:             string;             // orientações e conduta pós-procedimento
  retorno_sugerido:    string | null;      // "7 dias", "30 dias", null se não mencionado
  alerta_novo:         string | null;      // nova alergia/medicamento mencionado, null se nenhum
}
```
3. Importar o dicionário:
```typescript
import { buildDentalContext } from '@/lib/odonto-dictionary';
```
4. Atualizar o prompt:
```typescript
const prompt = `Você é um assistente clínico odontológico especializado em documentação.
Analise o relato livre do dentista e extraia TODAS as informações clínicas de forma estruturada.

${buildDentalContext()}

RELATO DO DENTISTA:
"${body.texto}"

CONTEXTO:
- Paciente: ${body.pacienteNome ?? 'não informado'}
- Data: ${new Date().toLocaleDateString('pt-BR')}

Retorne SOMENTE um JSON válido, sem markdown, com exatamente esta estrutura:
{
  "queixa_principal": "título objetivo do procedimento principal (ex: Endodontia dente 26, Restauração dentes 14 e 15)",
  "anotacoes": "evolução clínica completa e organizada em linguagem técnica — procedimento realizado, técnica usada, intercorrências, observações relevantes. 2-4 frases.",
  "dentes_afetados": [lista de números FDI mencionados como inteiros — ex: [26, 36]],
  "dentes_observacoes": {"número": "observação específica deste dente"},
  "procedimentos": ["lista dos procedimentos realizados — ex: Tratamento endodôntico, Radiografia periapical"],
  "conduta": "orientações ao paciente, cuidados pós-procedimento, prescrições mencionadas. Vazio se não mencionado.",
  "retorno_sugerido": "prazo de retorno se mencionado (ex: 7 dias, 1 mês) ou null",
  "alerta_novo": "se o dentista mencionar nova alergia ou medicamento novo do paciente, registrar aqui. null se nenhum"
}

Regras críticas:
- dentes_afetados: array de inteiros FDI válidos (11-48), nunca strings
- Se nenhum dente mencionado: [] e {}
- procedimentos: array de strings, mínimo 1 item baseado no relato
- conduta: string vazia "" se não houver orientações mencionadas
- retorno_sugerido: null se não mencionado
- alerta_novo: null se não mencionado
- Não repetir nome do paciente nas anotações
- Português brasileiro, linguagem técnica mas clara`;
```
5. Atualizar a validação pós-parse:
```typescript
const parsed = result.data;
parsed.dentes_afetados = (parsed.dentes_afetados ?? [])
  .map((d) => Number(d))
  .filter((d) => !isNaN(d) && d >= 11 && d <= 99);
parsed.dentes_observacoes = parsed.dentes_observacoes ?? {};
parsed.procedimentos = Array.isArray(parsed.procedimentos) ? parsed.procedimentos.filter(p => typeof p === 'string') : [];
parsed.conduta = typeof parsed.conduta === 'string' ? parsed.conduta : '';
parsed.retorno_sugerido = typeof parsed.retorno_sugerido === 'string' ? parsed.retorno_sugerido : null;
parsed.alerta_novo = typeof parsed.alerta_novo === 'string' ? parsed.alerta_novo : null;
```
6. Commit: `git commit -m "feat: formatar-evolucao — 8 campos estruturados + dicionário odontológico"`

---

### Task 4: Melhorar prompt do Whisper em `/api/transcrever`

**Files:** `src/app/api/transcrever/route.ts`

Substituir o prompt básico pelo vocabulário do dicionário.

**Steps:**
1. Importar o dicionário:
```typescript
import { WHISPER_DENTAL_PROMPT } from '@/lib/odonto-dictionary';
```
2. Substituir a linha do prompt:
```typescript
// ANTES:
prompt: 'Dentista descrevendo procedimentos: extração, restauração, canal...'

// DEPOIS:
prompt: WHISPER_DENTAL_PROMPT,
```
3. Commit: `git commit -m "feat: transcrever — prompt dental rico via odonto-dictionary"`

---

### Task 5: Atualizar `actions.ts` — storage estruturado sem concatenação

**Files:** `src/app/consulta/[agendamentoId]/actions.ts`

Remover a concatenação com emojis. Os novos campos (procedimentos, conduta, retorno) precisam ser salvos estruturadamente.

**Steps:**
1. Verificar se a tabela `fichas` já tem campos para `procedimentos`, `conduta` e `retorno_sugerido`. Rodar no Supabase SQL Editor:
```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'fichas' 
ORDER BY ordinal_position;
```
2. **Se as colunas não existirem**, criar uma migration:
```sql
ALTER TABLE fichas 
ADD COLUMN IF NOT EXISTS procedimentos text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS conduta text DEFAULT '',
ADD COLUMN IF NOT EXISTS retorno_sugerido text;
```
3. Atualizar a interface de params do `salvarFichaConsulta` e `finalizarConsulta`:
```typescript
export async function salvarFichaConsulta(params: {
  agendamentoId:    string;
  pacienteId:       string;
  queixa_principal: string;
  anotacoes:        string;
  dentes_afetados:  number[];
  dentes_observacoes: Record<string, string>;
  // Novos campos:
  procedimentos?:   string[];
  conduta?:         string;
  retorno_sugerido?: string | null;
}): Promise<{ error?: string }> {
```
4. No insert do Supabase, adicionar os novos campos:
```typescript
const { error: fichaError } = await supabase.from('fichas').insert({
  clinica_id:         clinicId,
  paciente_id:        params.pacienteId,
  dentista_id:        dentistaPerfil.id,
  queixa_principal:   params.queixa_principal,
  anotacoes:          params.anotacoes,
  dentes_afetados:    params.dentes_afetados,
  dentes_observacoes: params.dentes_observacoes,
  procedimentos:      params.procedimentos ?? [],
  conduta:            params.conduta ?? '',
  retorno_sugerido:   params.retorno_sugerido ?? null,
  status:             'concluida',
});
```
5. Simplificar `finalizarConsulta` — remover a concatenação com emojis:
```typescript
// REMOVER toda a lógica de anotacoesCompletas com emojis
// SUBSTITUIR por:
const { error: fichaError } = await supabase.from('fichas').insert({
  clinica_id:         clinicId,
  paciente_id:        params.pacienteId,
  dentista_id:        dentistaPerfil.id,
  queixa_principal:   params.queixa_principal,
  anotacoes:          params.anotacoes,
  dentes_afetados:    params.dentes_afetados,
  dentes_observacoes: params.dentes_observacoes,
  procedimentos:      params.procedimentos ?? [],
  conduta:            params.conduta ?? '',
  retorno_sugerido:   params.retorno_sugerido ?? null,
  status:             'concluida',
});
```
6. Commit: `git commit -m "feat: actions — storage estruturado com procedimentos/conduta/retorno separados"`

---

## FASE 2 — NOVOS COMPONENTES (UI)

### Task 6: Criar `MiniOdontograma` com estado amber AI-detected

**Files:** `src/app/consulta/[agendamentoId]/_components/mini-odontograma.tsx` (CREATE)

**Steps:**
1. Criar o arquivo:

```typescript
'use client';

const TEETH_UPPER = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28];
const TEETH_LOWER = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38];
const TOOTH_W: Record<number, string> = {
  1: 'w-6', 2: 'w-6', 3: 'w-6', 4: 'w-7', 5: 'w-7', 6: 'w-8', 7: 'w-8', 8: 'w-8',
};
const tw = (t: number) => TOOTH_W[t % 10] ?? 'w-7';

interface MiniOdontogramaProps {
  /** Dentes confirmados pelo dentista — cor teal */
  selected: number[];
  /** Dentes detectados pela IA ainda não confirmados — cor amber */
  aiDetected?: number[];
  onChange: (teeth: number[]) => void;
}

export function MiniOdontograma({ selected, aiDetected = [], onChange }: MiniOdontogramaProps) {
  const toggle = (t: number) => {
    if (selected.includes(t)) {
      onChange(selected.filter(x => x !== t));
    } else {
      onChange([...selected, t]);
    }
  };

  const getStyle = (t: number, isUpper: boolean): string => {
    const shape = isUpper
      ? 'rounded-t-md rounded-b-[2px]'
      : 'rounded-b-md rounded-t-[2px]';
    const base = `${tw(t)} h-8 ${shape} border text-[9px] font-mono font-bold transition-all hover:scale-105 active:scale-95`;
    const lift = isUpper ? '-translate-y-1' : 'translate-y-1';

    if (selected.includes(t)) {
      return `${base} bg-teal border-teal text-white ${lift} shadow-[0_3px_8px_rgba(47,156,133,0.4)]`;
    }
    if (aiDetected.includes(t)) {
      return `${base} bg-amber-500/10 border-amber-500 border-2 text-amber-600 dark:text-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.3)] ${lift}`;
    }
    return `${base} bg-surface-alt border-border text-text-secondary hover:border-teal/50 hover:text-teal hover:bg-teal/5`;
  };

  const renderRow = (teeth: number[], isUpper: boolean) => (
    <div className={`flex justify-center ${isUpper ? 'items-end' : 'items-start'} gap-0.5`}>
      {teeth.map((t, i) => (
        <div key={t} className={`flex ${isUpper ? 'items-end' : 'items-start'}`}>
          {i === 8 && <div className="w-px h-6 bg-border mx-0.5 self-stretch" />}
          <button
            onClick={() => toggle(t)}
            title={
              selected.includes(t)
                ? `Dente ${t} — confirmado`
                : aiDetected.includes(t)
                  ? `Dente ${t} — detectado pela IA (clique para confirmar)`
                  : `Dente ${t}`
            }
            className={getStyle(t, isUpper)}
          >
            {t}
          </button>
        </div>
      ))}
    </div>
  );

  const pendingCount = aiDetected.filter(t => !selected.includes(t)).length;

  return (
    <div className="space-y-1">
      {renderRow(TEETH_UPPER, true)}
      <div className="h-px bg-border/60" />
      {renderRow(TEETH_LOWER, false)}
      {pendingCount > 0 && (
        <p className="text-[10px] text-amber-500 dark:text-amber-400 text-center mt-2 font-medium">
          {pendingCount} dente{pendingCount > 1 ? 's' : ''} detectado{pendingCount > 1 ? 's' : ''} pela IA — clique para confirmar
        </p>
      )}
    </div>
  );
}
```
2. Commit: `git commit -m "feat: MiniOdontograma — estado amber IA + teal confirmado"`

---

### Task 7: Criar `DraftPendingCard` — Sistema visual amber PENDENTE

**Files:** `src/app/consulta/[agendamentoId]/_components/draft-pending-card.tsx` (CREATE)

```typescript
'use client';

import { motion } from 'motion/react';

interface DraftPendingCardProps {
  label: string;
  children: React.ReactNode;
}

export function DraftPendingCard({ label, children }: DraftPendingCardProps) {
  return (
    <motion.div
      className="relative rounded-2xl overflow-hidden"
      animate={{
        boxShadow: [
          '0 0 0px 0px rgba(245,158,11,0)',
          '0 0 16px 0px rgba(245,158,11,0.18)',
          '0 0 0px 0px rgba(245,158,11,0)',
        ],
      }}
      transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
      style={{ border: '2px solid #f59e0b' }}
    >
      {/* Header */}
      <div
        className="px-5 pt-4 pb-2 flex items-center justify-between"
        style={{ background: 'rgba(245,158,11,0.06)' }}
      >
        <label className="text-[10px] font-bold uppercase tracking-widest text-amber-700 dark:text-amber-400">
          {label}
        </label>
        <motion.span
          className="text-[9px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider"
          style={{
            background: 'rgba(245,158,11,0.15)',
            color: '#b45309',
            border: '1px solid rgba(245,158,11,0.35)',
          }}
          animate={{ opacity: [1, 0.55, 1] }}
          transition={{ duration: 1.8, repeat: Infinity }}
        >
          PENDENTE
        </motion.span>
      </div>

      {/* Content */}
      <div className="px-5 pb-5 pt-2 bg-surface">
        {children}
      </div>
    </motion.div>
  );
}
```
Commit: `git commit -m "feat: DraftPendingCard — amber PENDENTE com glow pulsante"`

---

### Task 8: Criar `VoiceUX` — Dex pulsando, waveform, transcript ao vivo

**Files:** `src/app/consulta/[agendamentoId]/_components/voice-ux.tsx` (CREATE)

```typescript
'use client';

import { AnimatePresence, motion } from 'motion/react';
import { Loader2, MicOff } from 'lucide-react';

function WaveBar({ delay }: { delay: number }) {
  return (
    <motion.div
      className="w-[3px] rounded-full bg-teal"
      animate={{ height: ['4px', '22px', '8px', '18px', '4px'], opacity: [0.5, 1, 0.65, 1, 0.5] }}
      transition={{ duration: 1.1, repeat: Infinity, delay, ease: 'easeInOut' }}
    />
  );
}

interface VoiceUXProps {
  isRecording: boolean;
  isTranscribing: boolean;
  liveTranscript: string;
  elapsedSeconds: number;
  onStop: () => void;
}

export function VoiceUX({ isRecording, isTranscribing, liveTranscript, elapsedSeconds, onStop }: VoiceUXProps) {
  const fmt = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  return (
    <AnimatePresence>
      {(isRecording || isTranscribing) && (
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 12, scale: 0.97 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 w-full max-w-sm px-4"
        >
          <div
            className="rounded-3xl p-5 shadow-2xl"
            style={{
              background: 'var(--surface)',
              border: '1.5px solid rgba(47,156,133,0.25)',
              boxShadow: '0 24px 64px rgba(0,0,0,0.2), 0 0 0 1px rgba(47,156,133,0.08)',
            }}
          >
            {/* Dex + waveform + timer */}
            <div className="flex items-center gap-3 mb-3">
              {/* Dex ball pulsando */}
              <motion.div
                className="w-11 h-11 rounded-xl flex items-center justify-center text-base font-black text-white shrink-0"
                style={{ background: 'linear-gradient(135deg, #2f9c85, #1d7a68)' }}
                animate={isRecording ? {
                  boxShadow: ['0 0 0 0 rgba(47,156,133,0.5)', '0 0 0 10px rgba(47,156,133,0)', '0 0 0 0 rgba(47,156,133,0)'],
                } : {}}
                transition={{ duration: 1.0, repeat: Infinity }}
              >
                D
              </motion.div>

              {/* Waveform */}
              <div className="flex items-center gap-[3px] flex-1 h-6">
                {isRecording
                  ? Array.from({ length: 9 }).map((_, i) => <WaveBar key={i} delay={i * 0.08} />)
                  : (
                    <div className="flex items-center gap-2">
                      <Loader2 className="w-3.5 h-3.5 text-teal animate-spin" />
                      <span className="text-xs text-text-secondary">Transcrevendo...</span>
                    </div>
                  )
                }
              </div>

              {/* Timer */}
              {isRecording && (
                <span className="font-mono text-sm font-bold text-teal shrink-0">
                  {fmt(elapsedSeconds)}
                </span>
              )}
            </div>

            {/* Badge ESCUTANDO */}
            {isRecording && (
              <div className="flex items-center gap-2 mb-3">
                <motion.div
                  className="w-2 h-2 rounded-full bg-red-500"
                  animate={{ opacity: [1, 0.25, 1] }}
                  transition={{ duration: 0.65, repeat: Infinity }}
                />
                <span className="text-[11px] font-bold text-red-500 uppercase tracking-widest">
                  Escutando
                </span>
              </div>
            )}

            {/* Live transcript */}
            {liveTranscript && (
              <p className="text-xs text-text-secondary leading-relaxed line-clamp-2 mb-3 italic pl-1 border-l-2 border-teal/30">
                {liveTranscript}
              </p>
            )}

            {/* Botão parar */}
            {isRecording && (
              <button
                onClick={onStop}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-bold transition-all"
                style={{
                  background: 'rgba(239,68,68,0.08)',
                  color: '#ef4444',
                  border: '1.5px solid rgba(239,68,68,0.25)',
                }}
              >
                <MicOff className="w-4 h-4" />
                Parar gravação
              </button>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
```
Commit: `git commit -m "feat: VoiceUX — Dex pulsando, waveform 9 barras, badge ESCUTANDO, timer"`

---

### Task 9: Criar `ModoConsultaLoader` — Microtransição premium

**Files:** `src/components/consulta/modo-consulta-loader.tsx` (CREATE)

Criar pasta `src/components/consulta/` se não existir.

```typescript
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle, Pill, Stethoscope, ArrowRight, X } from 'lucide-react';

export interface AlertaClinico {
  tipo: 'alergia' | 'condicao' | 'medicamento';
  texto: string;
}

interface ModoConsultaLoaderProps {
  agendamentoId: string;
  pacienteNome: string;
  hora: string;
  ultimoProcedimento: string | null;
  alertas: AlertaClinico[];
  onClose: () => void;
}

const ICON_MAP = {
  alergia:    { Icon: AlertTriangle, color: 'text-coral' },
  condicao:   { Icon: Stethoscope,  color: 'text-amber-400' },
  medicamento:{ Icon: Pill,         color: 'text-blue-400' },
};

export function ModoConsultaLoader({
  agendamentoId,
  pacienteNome,
  hora,
  ultimoProcedimento,
  alertas,
  onClose,
}: ModoConsultaLoaderProps) {
  const router = useRouter();
  const [phase, setPhase] = useState<'loading' | 'ready'>('loading');
  const firstName = pacienteNome.split(' ')[0];

  useEffect(() => {
    const t = setTimeout(() => setPhase('ready'), 1600);
    return () => clearTimeout(t);
  }, []);

  const handleEnter = () => {
    onClose();
    router.push(`/consulta/${agendamentoId}`);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(14px)' }}
    >
      <motion.div
        initial={{ scale: 0.93, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ delay: 0.08, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="bg-surface border border-border rounded-3xl p-8 max-w-sm w-full shadow-2xl relative"
      >
        {/* Fechar */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-text-secondary hover:text-text-primary transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Dex */}
        <div className="flex justify-center mb-6">
          <motion.div
            className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-black text-white"
            style={{ background: 'linear-gradient(135deg, #2f9c85, #1d7a68)' }}
            animate={phase === 'loading' ? {
              boxShadow: [
                '0 0 0 0 rgba(47,156,133,0)',
                '0 0 0 14px rgba(47,156,133,0.18)',
                '0 0 0 0 rgba(47,156,133,0)',
              ],
            } : { boxShadow: '0 8px 32px rgba(47,156,133,0.35)' }}
            transition={{ duration: 1.8, repeat: phase === 'loading' ? Infinity : 0 }}
          >
            D
          </motion.div>
        </div>

        {/* Cabeçalho */}
        <div className="text-center mb-5">
          <AnimatePresence mode="wait">
            {phase === 'loading' ? (
              <motion.div key="a" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <p className="text-sm text-text-secondary mb-1">Preparando consulta de</p>
                <p className="font-heading text-2xl text-text-primary">{firstName}</p>
                <p className="text-xs text-text-secondary mt-1 font-mono">{hora}</p>
              </motion.div>
            ) : (
              <motion.div key="b" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}>
                <p className="text-sm text-teal font-semibold mb-1">Contexto clínico pronto</p>
                <p className="font-heading text-2xl text-text-primary">{firstName}</p>
                <p className="text-xs text-text-secondary mt-1 font-mono">{hora}</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Alertas */}
        {alertas.length > 0 && (
          <div className="bg-surface-alt rounded-2xl p-4 mb-4 space-y-2">
            {alertas.map((alerta, i) => {
              const { Icon, color } = ICON_MAP[alerta.tipo];
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.15 + i * 0.1 }}
                  className={`flex items-start gap-2 text-xs ${color}`}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span>{alerta.texto}</span>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* Último procedimento */}
        {ultimoProcedimento && (
          <div className="flex items-center gap-2 mb-4 text-xs text-text-secondary">
            <span className="w-1.5 h-1.5 rounded-full bg-teal shrink-0" />
            Último: {ultimoProcedimento}
          </div>
        )}

        {/* Status */}
        <div className="flex items-center gap-2 mb-6 text-xs">
          <AnimatePresence mode="wait">
            {phase === 'loading' ? (
              <motion.span key="l" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="flex items-center gap-1.5 text-text-secondary">
                <motion.div
                  className="w-1.5 h-1.5 rounded-full bg-teal"
                  animate={{ opacity: [1, 0.3, 1] }}
                  transition={{ duration: 0.7, repeat: Infinity }}
                />
                Dex preparando contexto clínico...
              </motion.span>
            ) : (
              <motion.span key="r" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="text-teal font-semibold">
                ✓ Pronto para atender
              </motion.span>
            )}
          </AnimatePresence>
        </div>

        {/* CTA */}
        <AnimatePresence>
          {phase === 'ready' && (
            <motion.button
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              onClick={handleEnter}
              className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl text-sm font-bold text-white"
              style={{ background: '#2f9c85', boxShadow: '0 4px 20px rgba(47,156,133,0.38)' }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              Entrar agora
              <ArrowRight className="w-4 h-4" />
            </motion.button>
          )}
        </AnimatePresence>

        <button onClick={handleEnter} className="w-full mt-3 text-xs text-text-secondary hover:text-text-primary transition-colors py-1">
          Pular transição
        </button>
      </motion.div>
    </motion.div>
  );
}
```
Commit: `git commit -m "feat: ModoConsultaLoader — microtransição premium com Dex e contexto clínico"`

---

## FASE 3 — INTEGRAÇÃO

### Task 10: Integrar tudo no `ConsultaClient`

**Files:** `src/app/consulta/[agendamentoId]/_components/consulta-client.tsx`

Esta é a task mais longa — integra todos os novos componentes e expande o estado para os 8 campos.

**Steps:**
1. Atualizar imports no topo:
```typescript
import { VoiceUX } from './voice-ux';
import { DraftPendingCard } from './draft-pending-card';
import { MiniOdontograma } from './mini-odontograma';
import type { EvolucaoFormatada } from '@/app/api/dex/formatar-evolucao/route';
// Remover: Bot (substituído pelo Dex interno), MicOff (no VoiceUX)
```

2. Remover as definições inline de `TEETH_UPPER`, `TEETH_LOWER`, `TOOTH_W`, `tw`, e a função `MiniOdontograma` completa (agora é componente separado)

3. Adicionar novos estados:
```typescript
const [elapsedSeconds, setElapsedSeconds] = useState(0);
const [liveTranscript, setLiveTranscript] = useState('');
const [confirmedTeeth, setConfirmedTeeth] = useState<number[]>([]);
const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
```

4. Atualizar `handleVoice` para controlar o timer:
```typescript
const handleVoice = useCallback(async () => {
  if (micStatus === 'recording') {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    setIsTranscribing(true);
    const blob = await stopRecording();
    if (!blob) { setIsTranscribing(false); return; }
    try {
      const fd = new FormData();
      fd.append('audio', blob, 'audio.webm');
      const res = await fetch('/api/transcrever', { method: 'POST', body: fd });
      const data = await res.json() as { transcricao?: string };
      const texto = data.transcricao?.trim();
      if (texto) {
        setLiveTranscript(texto);
        setTextoLivre(prev => prev ? `${prev}\n${texto}` : texto);
      }
    } catch { /* silencioso */ } finally { setIsTranscribing(false); }
  } else {
    setElapsedSeconds(0);
    setLiveTranscript('');
    timerRef.current = setInterval(() => setElapsedSeconds(s => s + 1), 1000);
    await startRecording();
  }
}, [micStatus, startRecording, stopRecording]);
```

5. Atualizar `handleFormatar` — resetar `confirmedTeeth` ao receber o draft:
```typescript
const handleFormatar = async () => {
  const texto = textoLivre.trim();
  if (!texto) return;
  setIsFormatando(true);
  try {
    const res = await fetch('/api/dex/formatar-evolucao', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ texto, pacienteNome: paciente.nome }),
    });
    const data = await res.json() as EvolucaoFormatada & { error?: string };
    if (!res.ok || data.error) throw new Error(data.error ?? 'Erro ao formatar');
    setEvolucao(data);
    setConfirmedTeeth([]);  // ← todos os dentes do draft começam como amber
  } catch (err) {
    console.error('[consulta] formatar-evolucao:', err);
  } finally {
    setIsFormatando(false);
  }
};
```

6. Atualizar `handleSalvar` para passar os novos campos:
```typescript
const handleSalvar = async () => {
  if (!evolucao) return;
  setIsSaving(true);
  const result = await salvarFichaConsulta({
    agendamentoId,
    pacienteId: paciente.id,
    queixa_principal:   evolucao.queixa_principal,
    anotacoes:          evolucao.anotacoes,
    dentes_afetados:    [...new Set([...confirmedTeeth, ...evolucao.dentes_afetados])],
    dentes_observacoes: evolucao.dentes_observacoes,
    procedimentos:      evolucao.procedimentos,
    conduta:            evolucao.conduta,
    retorno_sugerido:   evolucao.retorno_sugerido,
  });
  if (result.error) { toast.error(result.error); setIsSaving(false); return; }
  setSaved(true);
  setTimeout(() => router.push(`/dashboard/pacientes/${paciente.id}`), 1800);
};
```

7. Substituir o bloco de confirmação `evolucao && !saved` — usar `DraftPendingCard` e `MiniOdontograma` com amber:
```tsx
{/* Queixa principal */}
<DraftPendingCard label="Tipo / Queixa principal">
  <input
    value={evolucao.queixa_principal}
    onChange={e => setEvolucao({ ...evolucao, queixa_principal: e.target.value })}
    className="w-full text-sm font-semibold text-text-primary bg-transparent outline-none border-b border-border focus:border-teal pb-1 transition-colors"
  />
</DraftPendingCard>

{/* Anotações */}
<DraftPendingCard label="Anotações clínicas">
  <textarea
    value={evolucao.anotacoes}
    onChange={e => setEvolucao({ ...evolucao, anotacoes: e.target.value })}
    className="w-full text-sm text-text-primary bg-transparent outline-none resize-none leading-relaxed"
    rows={4}
  />
</DraftPendingCard>

{/* Procedimentos detectados (novo campo) */}
{evolucao.procedimentos.length > 0 && (
  <DraftPendingCard label="Procedimentos detectados">
    <div className="flex flex-wrap gap-2">
      {evolucao.procedimentos.map((p, i) => (
        <span key={i} className="text-xs px-3 py-1 rounded-lg bg-surface-alt border border-border text-text-primary">
          {p}
        </span>
      ))}
    </div>
  </DraftPendingCard>
)}

{/* Conduta (novo campo — gerado pela IA) */}
{evolucao.conduta && (
  <DraftPendingCard label="Conduta / Orientações">
    <textarea
      value={evolucao.conduta}
      onChange={e => setEvolucao({ ...evolucao, conduta: e.target.value })}
      className="w-full text-sm text-text-primary bg-transparent outline-none resize-none leading-relaxed"
      rows={2}
    />
  </DraftPendingCard>
)}

{/* Retorno sugerido (novo campo) */}
{evolucao.retorno_sugerido && (
  <DraftPendingCard label="Retorno sugerido">
    <p className="text-sm font-semibold text-text-primary">{evolucao.retorno_sugerido}</p>
  </DraftPendingCard>
)}

{/* Odontograma com amber AI-detected */}
<DraftPendingCard label={`Dentes afetados${evolucao.dentes_afetados.length > 0 ? ` — ${[...new Set([...confirmedTeeth, ...evolucao.dentes_afetados])].join(', ')}` : ''}`}>
  <MiniOdontograma
    selected={confirmedTeeth}
    aiDetected={evolucao.dentes_afetados.filter(t => !confirmedTeeth.includes(t))}
    onChange={(dentes) => {
      setConfirmedTeeth(dentes);
    }}
  />
</DraftPendingCard>
```

8. **Remover** `FinalizeConsultationDialog` e o wizard de 2 passos — substituir por botão direto:
```tsx
{/* Substituir o "Finalizar Consulta" que abria o wizard por: */}
<button
  onClick={() => void handleSalvar()}
  disabled={isSaving}
  className="w-full flex items-center justify-center gap-2 px-5 py-4 rounded-2xl text-sm font-bold transition-all disabled:opacity-40 text-white"
  style={{ background: '#2f9c85', boxShadow: '0 2px 16px rgba(47,156,133,0.30)' }}
>
  {isSaving
    ? <><Loader2 className="w-4 h-4 animate-spin" /> Salvando...</>
    : <><Check className="w-4 h-4" /> Confirmar e salvar na ficha</>
  }
</button>
```

9. Adicionar `VoiceUX` no return (antes do fechamento da div principal):
```tsx
<VoiceUX
  isRecording={micStatus === 'recording'}
  isTranscribing={isTranscribing}
  liveTranscript={liveTranscript}
  elapsedSeconds={elapsedSeconds}
  onStop={() => void handleVoice()}
/>
```

10. Simplificar o bloco de texto livre — remover o título "O que foi feito hoje?":
```tsx
{/* Header minimalista */}
<div className="mb-3 flex items-center justify-between">
  <span className="text-xs text-text-secondary font-medium">{firstName} · {hora}</span>
  <span className="text-xs text-text-secondary font-mono">{textoLivre.length} caracteres</span>
</div>
```

11. Commit: `git commit -m "feat: consulta-client — integra VoiceUX, DraftPendingCard, MiniOdontograma amber, remove wizard"`

---

### Task 11: Redesenhar `ConsultationSidebar` — Context Rail com Tratamento e Última Visita

**Files:** `src/app/consulta/[agendamentoId]/_components/consultation-sidebar.tsx`

O PDF: reduzir troca de contexto, mostrar apenas informações críticas. Remover o fetch async do briefing (ruído visual). Adicionar progresso visual do tratamento.

**Steps:**
1. Remover o `useEffect` de fetch do `/api/dex/briefing` e os estados `briefing`/`briefingLoading`
2. Remover `BriefingData` interface e `QuestionsSection`, `ExplicarDialog` (escopo separado)
3. Remover imports desnecessários: `Bot`, `Sparkles`, `ClipboardList`, `HelpCircle`, `Copy`, `Activity`
4. Estreitar a sidebar: `md:w-72 lg:w-80` → `md:w-64`
5. Reescrever o JSX principal com esta estrutura:

```tsx
<aside className="w-full md:w-64 shrink-0 border-b border-border md:border-b-0 md:border-r bg-surface overflow-y-auto flex flex-col max-h-64 md:max-h-none">

  {/* 1. Identificação */}
  <div className="p-5 border-b border-border">
    <div className="font-heading text-lg text-text-primary leading-tight">{pacienteNome}</div>
    {idadeStr && <div className="text-xs text-text-secondary mt-0.5">{idadeStr}</div>}
    {observacoesAgendamento && (
      <div className="mt-2 text-xs text-text-secondary italic">"{observacoesAgendamento}"</div>
    )}
  </div>

  {/* 2. Alertas clínicos — CRÍTICO, sempre visível */}
  {alertasClinicos.length > 0 && (
    <div className="p-4 border-b border-border" style={{ background: 'rgba(239,68,68,0.04)' }}>
      <div className="flex items-center gap-1.5 mb-2">
        <AlertTriangle className="w-3.5 h-3.5 text-coral shrink-0" />
        <span className="text-[10px] font-bold text-coral uppercase tracking-widest">Alertas</span>
      </div>
      <div className="space-y-1">
        {alertasClinicos.map((a, i) => (
          <p key={i} className="text-xs text-coral leading-relaxed">{a}</p>
        ))}
      </div>
    </div>
  )}

  {/* 3. Progresso do tratamento */}
  {planejamento && (
    <div className="p-4 border-b border-border">
      <span className="text-[10px] font-bold text-teal uppercase tracking-widest block mb-2">
        Tratamento ativo
      </span>
      <p className="text-xs font-semibold text-text-primary mb-3 leading-tight">{planejamento.titulo}</p>

      {/* Barra de progresso */}
      {(() => {
        const total = planejamento.etapas.length;
        const concluidas = planejamento.etapas.filter(e => e.status === 'concluido').length;
        const pct = total > 0 ? Math.round((concluidas / total) * 100) : 0;
        return (
          <div className="mb-3">
            <div className="flex justify-between mb-1">
              <span className="text-[10px] text-text-secondary">{concluidas}/{total} etapas</span>
              <span className="text-[10px] font-bold text-teal">{pct}%</span>
            </div>
            <div className="h-1.5 bg-surface-alt rounded-full overflow-hidden">
              <div
                className="h-full bg-teal rounded-full transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })()}

      {/* Lista de etapas — com marcação "HOJE" na primeira pendente */}
      <div className="space-y-1.5">
        {planejamento.etapas.slice(0, 6).map((etapa, idx) => {
          const isPrimeiraPendente = etapa.status !== 'concluido' &&
            planejamento.etapas.slice(0, idx).every(e => e.status === 'concluido');
          return (
            <div key={etapa.id} className={`flex items-center gap-2 ${isPrimeiraPendente ? 'bg-teal/5 rounded-lg px-2 py-1 -mx-2' : ''}`}>
              <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                etapa.status === 'concluido' ? 'bg-teal' :
                isPrimeiraPendente ? 'bg-teal animate-pulse' :
                'bg-border'
              }`} />
              <span className={`text-[11px] leading-tight flex-1 ${
                etapa.status === 'concluido' ? 'line-through text-text-secondary' :
                isPrimeiraPendente ? 'text-teal font-semibold' :
                'text-text-primary'
              }`}>
                {etapa.titulo}{etapa.dente ? ` — ${etapa.dente}` : ''}
              </span>
              {isPrimeiraPendente && (
                <span className="text-[9px] font-black text-teal uppercase tracking-wide">HOJE</span>
              )}
            </div>
          );
        })}
        {planejamento.etapas.length > 6 && (
          <p className="text-[10px] text-text-secondary ml-3.5">+{planejamento.etapas.length - 6} etapas</p>
        )}
      </div>
    </div>
  )}

  {/* 4. Última visita */}
  {(ultimaQueixa || ultimasAnotacoes || fichas[0]?.dentes?.length > 0) && (
    <div className="p-4 border-b border-border">
      <div className="flex items-center gap-1.5 mb-2">
        <Clock className="w-3.5 h-3.5 text-text-secondary shrink-0" />
        <span className="text-[10px] font-bold text-text-secondary uppercase tracking-widest">
          Última visita{fichas[0]?.data ? ` · ${fichas[0].data}` : ''}
        </span>
      </div>
      {ultimaQueixa && (
        <p className="text-xs font-semibold text-text-primary mb-1 leading-tight">{ultimaQueixa}</p>
      )}
      {ultimasAnotacoes && (
        <p className="text-xs text-text-secondary leading-relaxed line-clamp-3">{ultimasAnotacoes}</p>
      )}
      {fichas[0]?.dentes?.length > 0 && (
        <div className="flex gap-1 mt-2 flex-wrap">
          {fichas[0].dentes.map(d => (
            <span key={d} className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-surface-alt border border-border text-text-secondary">
              {d}
            </span>
          ))}
        </div>
      )}
    </div>
  )}

  {/* 5. Histórico colapsado */}
  {fichas.length > 1 && (
    <div className="p-4">
      <button onClick={() => setFichasExpanded(v => !v)} className="flex items-center justify-between w-full">
        <div className="flex items-center gap-1.5">
          <FileText className="w-3.5 h-3.5 text-text-secondary" />
          <span className="text-[10px] font-bold text-text-secondary uppercase tracking-widest">
            Histórico ({fichas.length - 1} anteriores)
          </span>
        </div>
        {fichasExpanded ? <ChevronUp className="w-3 h-3 text-text-secondary" /> : <ChevronDown className="w-3 h-3 text-text-secondary" />}
      </button>
      <AnimatePresence>
        {fichasExpanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="mt-3 space-y-2">
              {fichas.slice(1).map((f, i) => (
                <div key={i} className="bg-surface-alt rounded-xl p-3">
                  <div className="flex justify-between mb-1">
                    <span className="text-[10px] font-mono text-text-secondary">{f.data}</span>
                    {f.dentes.length > 0 && (
                      <span className="text-[10px] font-mono text-teal">{f.dentes.join(', ')}</span>
                    )}
                  </div>
                  {f.queixa && <p className="text-[11px] font-semibold text-text-primary">{f.queixa}</p>}
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )}
</aside>
```

6. Manter apenas os imports necessários: `useState`, `motion`, `AnimatePresence`, `AlertTriangle`, `Clock`, `FileText`, `ChevronDown`, `ChevronUp`
7. Commit: `git commit -m "feat: consultation-sidebar — context rail com progresso de tratamento e última visita"`

---

### Task 12: Dashboard Hero — Breakpoints 5min e 10min

**Files:** `src/components/dashboard/next-appointment-hero.tsx`

**Steps:**
1. Localizar `getHeroState` e o tipo `HeroState`
2. Adicionar estados `'critical'` (≤5min ou no horário) e `'near'` (<10min):
```typescript
type HeroState = 'empty' | 'concluded' | 'active' | 'critical' | 'near' | 'imminent' | 'approaching' | 'distant';
type FilledState = Exclude<HeroState, 'empty' | 'concluded'>;

function getHeroState(status: string, minutesUntil: number): FilledState {
  if (status === 'in_progress' || status === 'checked_in') return 'active';
  if (minutesUntil <= 5)  return 'critical';
  if (minutesUntil < 10)  return 'near';
  if (minutesUntil < 30)  return 'imminent';
  if (minutesUntil < 120) return 'approaching';
  return 'distant';
}
```
3. Atualizar `STATE_LABEL`:
```typescript
const STATE_LABEL: Record<FilledState, string> = {
  active:      'EM ATENDIMENTO',
  critical:    'INICIAR AGORA',
  near:        'COMEÇA EM BREVE',
  imminent:    'EM BREVE',
  approaching: 'PRÓXIMO',
  distant:     'PRÓXIMO ATENDIMENTO',
};
```
4. No `CountdownRing`, adicionar cor vermelha para `critical`:
```typescript
const ringColor =
  state === 'critical' ? '#ef4444' :
  state === 'near'     ? '#f59e0b' :
  useAmber             ? '#f59e0b' :
  '#2f9c85';
```
5. No botão CTA, envolver com motion pulse quando `state === 'critical'`:
```tsx
// Localizar onde ConsultaCtaButton é renderizado
// Envolver:
<motion.div
  animate={state === 'critical' ? { scale: [1, 1.025, 1] } : {}}
  transition={{ duration: 1.0, repeat: Infinity }}
>
  <ConsultaCtaButton ... />
</motion.div>
```
6. Commit: `git commit -m "feat: hero — critical/near pulse states (5min e 10min)"`

---

## Ordem de Execução Recomendada

```
Task 1  → odonto-dictionary (sem dependências)
Task 2  → page.tsx fix alertas (sem dependências)
Task 3  → formatar-evolucao (depende Task 1)
Task 4  → transcrever (depende Task 1)
Task 5  → actions.ts (depende Task 3)
Task 6  → MiniOdontograma (sem dependências)
Task 7  → DraftPendingCard (sem dependências)
Task 8  → VoiceUX (sem dependências)
Task 9  → ModoConsultaLoader (sem dependências)
Task 10 → ConsultaClient (depende 3, 5, 6, 7, 8)
Task 11 → ConsultationSidebar (sem dependências)
Task 12 → Dashboard Hero (sem dependências)
```

Tasks 1-4 são Fase 1 — fundação. Tasks 6-9 são Fase 2 — componentes. Tasks 10-12 são Fase 3 — integração.
Task 5 (actions) pode rodar em paralelo com as Fase 2 após Task 3 estar pronta.
