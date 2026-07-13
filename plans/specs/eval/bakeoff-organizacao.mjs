// Bake-off de organização clínica — 13/07/2026
//
// Compara 3 configurações chamando os modelos DIRETO (sem servidor, sem login):
//   1. baseline  — Groq llama-3.3-70b-versatile + json_object (espelho exato de prod hoje)
//   2. gpt-oss   — Groq openai/gpt-oss-120b + json_schema strict (temp 0.2, max 16k)
//   3. gemini    — Gemini 2.5 Flash + responseSchema (temp 0.2, max 16k)
//
// Casos: formatar-evolucao-casos.json (5) + bakeoff-casos-pesados.json (3). 3 runs por caso
// por modelo = 72 chamadas. Critério declarado ANTES de rodar: precisão > latência.
// Alucinação de dente (fora de dentes_permitidos) = falha grave.
//
// Spike descartável de planejamento — NÃO é código de produção. O prompt dos candidatos
// muda só o formato de dentes_observacoes (array de pares — exigência do schema strict);
// todas as demais regras são idênticas ao prompt C2 de prod pra isolar a variável modelo.
//
// COMO RODAR (da raiz do repo):  node plans/specs/eval/bakeoff-organizacao.mjs

import Groq from 'groq-sdk';
import { GoogleGenAI } from '@google/genai';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..', '..');

// ── Env (.env.local, parse mínimo) ──────────────────────────────────────────
const env = {};
for (const line of readFileSync(join(ROOT, '.env.local'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
if (!env.GROQ_API_KEY || !env.GEMINI_API_KEY) {
  console.error('GROQ_API_KEY e GEMINI_API_KEY são obrigatórias no .env.local');
  process.exit(1);
}

const groq = new Groq({ apiKey: env.GROQ_API_KEY });
const gemini = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });

const RUNS = 3;
const THROTTLE_MS = 2500;
const TIMEOUT_MS = 90_000;

// ── Glossário (cópia de src/lib/odonto-dictionary.ts — spike, não importa TS) ─
const PROCEDIMENTOS_MAP = {
  'canal': 'Tratamento endodôntico', 'tratamento de canal': 'Tratamento endodôntico',
  'canal radicular': 'Tratamento endodôntico', 'endodontia': 'Tratamento endodôntico',
  'retratamento de canal': 'Retratamento endodôntico', 'retratamento endodôntico': 'Retratamento endodôntico',
  'apicectomia': 'Cirurgia parendodôntica (apicectomia)', 'cirurgia parendodôntica': 'Cirurgia parendodôntica (apicectomia)',
  'extração': 'Exodontia', 'extração dentária': 'Exodontia', 'exodontia': 'Exodontia',
  'extração simples': 'Exodontia simples', 'extração complexa': 'Exodontia complexa',
  'extração cirúrgica': 'Exodontia complexa', 'siso': 'Exodontia de terceiro molar',
  'dente do siso': 'Exodontia de terceiro molar', 'terceiro molar': 'Exodontia de terceiro molar',
  'raspagem': 'Raspagem e alisamento radicular', 'alisamento radicular': 'Raspagem e alisamento radicular',
  'raspagem supra': 'Raspagem supragengival', 'raspagem supragengival': 'Raspagem supragengival',
  'raspagem infra': 'Raspagem infragengival', 'raspagem infragengival': 'Raspagem infragengival',
  'curetagem': 'Curetagem periodontal', 'gengivoplastia': 'Gengivoplastia', 'gengivectomia': 'Gengivectomia',
  'cirurgia periodontal': 'Cirurgia periodontal',
  'profilaxia': 'Profilaxia dental', 'limpeza': 'Profilaxia dental', 'limpeza dental': 'Profilaxia dental',
  'restauração': 'Restauração direta', 'obturação': 'Restauração direta',
  'amálgama': 'Restauração com amálgama', 'resina': 'Restauração com resina composta',
  'resina composta': 'Restauração com resina composta', 'faceta': 'Faceta de porcelana/resina',
  'faceta de porcelana': 'Faceta de porcelana/resina', 'faceta de resina': 'Faceta de porcelana/resina',
  'lente de contato': 'Lente de contato dental', 'clareamento': 'Clareamento dental',
  'clareamento dental': 'Clareamento dental', 'clareamento a laser': 'Clareamento dental a laser',
  'coroa': 'Coroa total protética', 'coroa protética': 'Coroa total protética',
  'coroa de porcelana': 'Coroa total protética em porcelana', 'prótese': 'Prótese dentária',
  'prótese total': 'Prótese total', 'dentadura': 'Prótese total', 'ppr': 'Prótese parcial removível',
  'prótese parcial removível': 'Prótese parcial removível', 'protocolo': 'Prótese protocolo sobre implante',
  'pino': 'Núcleo de preenchimento / retentor intracanal', 'retentor intracanal': 'Núcleo de preenchimento / retentor intracanal',
  'núcleo de preenchimento': 'Núcleo de preenchimento / retentor intracanal', 'provisório': 'Coroa/restauração provisória',
  'implante': 'Implante osseointegrado', 'implante dentário': 'Implante osseointegrado',
  'enxerto': 'Enxerto ósseo/tecido mole', 'enxerto ósseo': 'Enxerto ósseo/tecido mole',
  'levantamento de seio': 'Levantamento de seio maxilar', 'sinus lift': 'Levantamento de seio maxilar',
  'aparelho': 'Aparelho ortodôntico', 'aparelho ortodôntico': 'Aparelho ortodôntico',
  'contenção': 'Contenção ortodôntica', 'placa': 'Placa miorrelaxante/de bruxismo',
  'placa miorrelaxante': 'Placa miorrelaxante/de bruxismo', 'placa de bruxismo': 'Placa miorrelaxante/de bruxismo',
  'radiografia': 'Exame radiográfico', 'raio-x': 'Exame radiográfico',
  'tomografia': 'Tomografia computadorizada de feixe cônico (CBCT)',
  'tomografia computadorizada': 'Tomografia computadorizada de feixe cônico (CBCT)',
  'moldagem': 'Moldagem para confecção de prótese/dispositivo',
  'cimentação': 'Cimentação de prótese/restauração indireta',
};

function buildDentalContext() {
  const procedimentos = Object.entries(PROCEDIMENTOS_MAP).map(([k, v]) => `"${k}" → ${v}`).join(', ');
  return `
GLOSSÁRIO ODONTOLÓGICO (use para interpretar o relato):
Numeração FDI: dentes 11-18 (sup. dir.), 21-28 (sup. esq.), 31-38 (inf. esq.), 41-48 (inf. dir.). Decíduos: 51-55, 61-65, 71-75, 81-85.
Sisos: 18, 28, 38, 48
Faces: M=Mesial, D=Distal, O=Oclusal, V=Vestibular, L=Lingual, MOD=Mesio-ocluso-distal
Arcada/boca: sentinela 99 = boca toda (limpeza, profilaxia, clareamento, raspagem geral); 97 = arcada superior; 98 = arcada inferior (ex: PPR, prótese total, aparelho, placa)
Procedimentos: ${procedimentos}
ACHADOS (não são procedimentos — descrevem o problema, não a intervenção): cárie, pulpite, necrose, fratura, mobilidade, retração gengival, abscesso, tártaro. Ao ver um achado, o procedimento é a intervenção correspondente (cárie→restauração, pulpite→endodontia, tártaro→raspagem/profilaxia).
Sempre converter número verbal para FDI: "vinte e seis" → 26, "trinta e seis" → 36
`.trim();
}

// ── Prompts ──────────────────────────────────────────────────────────────────
// Baseline: espelho EXATO do prompt de prod (dentes_observacoes como objeto).
function promptBaseline(texto) {
  return `Você é um assistente clínico odontológico especializado em documentação.
Analise o relato livre do dentista e extraia SOMENTE o que é clinicamente relevante — sinal, não ruído.

${buildDentalContext()}

RELATO DO DENTISTA:
"${texto}"

CONTEXTO:
- Paciente: não informado
- Data: ${new Date().toLocaleDateString('pt-BR')}

Retorne SOMENTE um JSON válido, sem markdown, com exatamente esta estrutura:
{
  "queixa_principal": "título objetivo do procedimento principal (ex: Endodontia dente 26, Restauração dentes 14 e 15)",
  "anotacoes": "evolução clínica em linguagem técnica — procedimento realizado, técnica usada, intercorrências relevantes. 2-3 frases, sem repetição, sem encher linguiça.",
  "dentes_afetados": [lista de números FDI mencionados como inteiros — ex: [26, 36]. Para procedimentos de arcada ou boca inteira, use os sentinelas do glossário acima (97/98/99)],
  "dentes_observacoes": {"13": "Tratamento de canal\\nPino\\nProvisório\\nCoroa de porcelana", "98": "PPR (prótese parcial removível)"},
  "procedimentos": ["lista resumida dos procedimentos realizados — ex: Tratamento endodôntico, Radiografia periapical"],
  "conduta": "orientações ao paciente, cuidados pós-procedimento, prescrições mencionadas. String vazia se não mencionado.",
  "retorno_sugerido": "prazo de retorno se mencionado (ex: 7 dias, 1 mês) ou null",
  "alerta_novo": "se o dentista mencionar nova alergia ou medicamento novo do paciente, registrar aqui. null se nenhum"
}

Regras críticas:
- IGNORE conversa não-clínica: saudação, small talk, divagação, interrupção — não vira anotação nem aparece no JSON.
- NÃO INVENTE nem infira o que não foi dito — dente, procedimento, conduta ou diagnóstico ausentes no relato ficam vazios/null, nunca "chutados".
- dentes_afetados: array de inteiros FDI válidos (11-48, decíduos 51-85), nunca strings.
- ARCADA / BOCA INTEIRA: procedimentos sem dente FDI individual usam sentinelas em dentes_afetados (99 boca toda, 97 arcada superior, 98 arcada inferior — ver glossário). NÃO liste dentes individuais nesses casos.
- OBRIGATÓRIO — dentes_observacoes cobre TODO dente: para CADA número em dentes_afetados (dente individual OU sentinela 97/98/99), crie a entrada correspondente em dentes_observacoes com o(s) procedimento(s) daquele dente/região (ex: dentes_observacoes["26"] = "Tratamento de canal", dentes_observacoes["98"] = "PPR (prótese parcial removível)"). Nenhum dente citado em dentes_afetados pode ficar sem entrada em dentes_observacoes — se o dente foi mencionado, o que se fez nele TEM que estar lá. Sem isso o procedimento some do orçamento e do progresso.
- Se nenhum dente mencionado: [] e {}
- dentes_observacoes: se mais de um procedimento no mesmo dente, separar por \\n — cada linha vira um item independente marcável pelo dentista
- procedimentos: array de strings resumidas, mínimo 1 item baseado no relato
- procedimentos = INTERVENÇÕES (o que foi feito ou será feito: restauração, endodontia, exodontia, profilaxia…), NUNCA achados/diagnósticos. Cárie, pulpite, necrose, fratura, mobilidade, retração gengival são ACHADOS — descrevem o problema, vão em anotacoes/queixa_principal, jamais em procedimentos. Ex: relato "cárie oclusal no 14" → procedimento = "Restauração com resina composta", não "Cárie oclusal".
- O diagnóstico e o raciocínio clínico (ex: "pulpite irreversível confirmada por teste de vitalidade") entram em anotacoes — registrar, não descartar.
- conduta: string vazia "" se não houver orientações mencionadas
- retorno_sugerido: null se não mencionado
- alerta_novo: null se não mencionado
- Não repetir nome do paciente nas anotações
- Português brasileiro, linguagem técnica mas clara`;
}

// Candidatos: idêntico, exceto dentes_observacoes como ARRAY DE PARES (exigência do schema strict).
function promptPares(texto) {
  return `Você é um assistente clínico odontológico especializado em documentação.
Analise o relato livre do dentista e extraia SOMENTE o que é clinicamente relevante — sinal, não ruído.

${buildDentalContext()}

RELATO DO DENTISTA:
"${texto}"

CONTEXTO:
- Paciente: não informado
- Data: ${new Date().toLocaleDateString('pt-BR')}

Retorne SOMENTE um JSON válido, sem markdown, com exatamente esta estrutura:
{
  "queixa_principal": "título objetivo do procedimento principal (ex: Endodontia dente 26, Restauração dentes 14 e 15)",
  "anotacoes": "evolução clínica em linguagem técnica — procedimento realizado, técnica usada, intercorrências relevantes. 2-3 frases (caso extenso: até 6, cobrindo os principais diagnósticos), sem repetição, sem encher linguiça.",
  "dentes_afetados": [26, 36],
  "dentes_observacoes": [{"dente": "13", "observacao": "Tratamento de canal\\nPino\\nProvisório\\nCoroa de porcelana"}, {"dente": "98", "observacao": "PPR (prótese parcial removível)"}],
  "procedimentos": ["lista resumida dos procedimentos realizados — ex: Tratamento endodôntico, Radiografia periapical"],
  "conduta": "orientações ao paciente, cuidados pós-procedimento, prescrições mencionadas. String vazia se não mencionado.",
  "retorno_sugerido": "prazo de retorno se mencionado (ex: 7 dias, 1 mês) ou null",
  "alerta_novo": "se o dentista mencionar nova alergia ou medicamento novo do paciente, registrar aqui. null se nenhum"
}

Regras críticas:
- IGNORE conversa não-clínica: saudação, small talk, divagação, interrupção — não vira anotação nem aparece no JSON.
- NÃO INVENTE nem infira o que não foi dito — dente, procedimento, conduta ou diagnóstico ausentes no relato ficam vazios/null, nunca "chutados".
- dentes_afetados: array de inteiros FDI válidos (11-48, decíduos 51-85). Para procedimentos de arcada ou boca inteira, use os sentinelas (99 boca toda, 97 arcada superior, 98 arcada inferior — ver glossário). NÃO liste dentes individuais nesses casos.
- OBRIGATÓRIO — dentes_observacoes cobre TODO dente: para CADA número em dentes_afetados (dente individual OU sentinela 97/98/99), crie um item {"dente": "<número>", "observacao": "<procedimento(s)>"} em dentes_observacoes. Nenhum dente citado em dentes_afetados pode ficar sem item correspondente — se o dente foi mencionado, o que se fez nele TEM que estar lá. Sem isso o procedimento some do orçamento e do progresso.
- PLANEJADO TAMBÉM CONTA: procedimento indicado ou planejado para sessão futura (ex: "indiquei exodontia", "vamos planejar implante ali", "facetas nos incisivos, preparo na próxima") ENTRA em dentes_afetados e dentes_observacoes igual ao realizado — marque o status na observação (ex: "Exodontia — planejado"). A ficha alimenta o plano de tratamento e o orçamento: o que foi indicado e não registrado é tratamento e receita perdidos.
- Se nenhum dente mencionado: [] e []
- observacao: se mais de um procedimento no mesmo dente, separar por \\n — cada linha vira um item independente marcável pelo dentista
- procedimentos: array de strings resumidas, mínimo 1 item baseado no relato
- procedimentos = INTERVENÇÕES (o que foi feito ou será feito: restauração, endodontia, exodontia, profilaxia…), NUNCA achados/diagnósticos. Cárie, pulpite, necrose, fratura, mobilidade, retração gengival são ACHADOS — descrevem o problema, vão em anotacoes/queixa_principal, jamais em procedimentos. Ex: relato "cárie oclusal no 14" → procedimento = "Restauração com resina composta", não "Cárie oclusal".
- O diagnóstico e o raciocínio clínico (ex: "pulpite irreversível confirmada por teste de vitalidade") entram em anotacoes — registrar, não descartar.
- conduta: string vazia "" se não houver orientações mencionadas
- retorno_sugerido: null se não mencionado
- alerta_novo: null se não mencionado
- Não repetir nome do paciente nas anotações
- Português brasileiro, linguagem técnica mas clara`;
}

// ── Schemas ──────────────────────────────────────────────────────────────────
const GROQ_STRICT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['queixa_principal', 'anotacoes', 'dentes_afetados', 'dentes_observacoes', 'procedimentos', 'conduta', 'retorno_sugerido', 'alerta_novo'],
  properties: {
    queixa_principal: { type: 'string' },
    anotacoes: { type: 'string' },
    dentes_afetados: { type: 'array', items: { type: 'integer' } },
    dentes_observacoes: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['dente', 'observacao'],
        properties: { dente: { type: 'string' }, observacao: { type: 'string' } },
      },
    },
    procedimentos: { type: 'array', items: { type: 'string' } },
    conduta: { type: 'string' },
    retorno_sugerido: { type: ['string', 'null'] },
    alerta_novo: { type: ['string', 'null'] },
  },
};

const GEMINI_SCHEMA = {
  type: 'OBJECT',
  required: ['queixa_principal', 'anotacoes', 'dentes_afetados', 'dentes_observacoes', 'procedimentos', 'conduta'],
  properties: {
    queixa_principal: { type: 'STRING' },
    anotacoes: { type: 'STRING' },
    dentes_afetados: { type: 'ARRAY', items: { type: 'INTEGER' } },
    dentes_observacoes: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        required: ['dente', 'observacao'],
        properties: { dente: { type: 'STRING' }, observacao: { type: 'STRING' } },
      },
    },
    procedimentos: { type: 'ARRAY', items: { type: 'STRING' } },
    conduta: { type: 'STRING' },
    retorno_sugerido: { type: 'STRING', nullable: true },
    alerta_novo: { type: 'STRING', nullable: true },
  },
};

// ── Chamadas ─────────────────────────────────────────────────────────────────
function withTimeout(promise, ms) {
  return Promise.race([promise, new Promise((_, rej) => setTimeout(() => rej(new Error(`timeout ${ms}ms`)), ms))]);
}

function stripFences(raw) {
  return raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
}

const MODELOS = {
  'baseline-llama': async (texto) => {
    const r = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: promptBaseline(texto) }],
      response_format: { type: 'json_object' },
      // sem temperature nem max_tokens — espelho de prod
    });
    return JSON.parse(stripFences(r.choices[0]?.message?.content ?? ''));
  },
  'groq-gpt-oss-120b': async (texto) => {
    const r = await groq.chat.completions.create({
      model: 'openai/gpt-oss-120b',
      messages: [{ role: 'user', content: promptPares(texto) }],
      temperature: 0.2,
      max_completion_tokens: 16384,
      response_format: {
        type: 'json_schema',
        json_schema: { name: 'evolucao_formatada', strict: true, schema: GROQ_STRICT_SCHEMA },
      },
    });
    return JSON.parse(stripFences(r.choices[0]?.message?.content ?? ''));
  },
  'gemini-2.5-flash': async (texto) => {
    const r = await gemini.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: promptPares(texto),
      config: {
        temperature: 0.2,
        maxOutputTokens: 16384,
        responseMimeType: 'application/json',
        responseSchema: GEMINI_SCHEMA,
      },
    });
    return JSON.parse(stripFences(r.text ?? ''));
  },
  // v2: thinking desligado — latência de cadeira. Mesmo prompt v2 (regra do planejado).
  'gemini-flash-nothink': async (texto) => {
    const r = await gemini.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: promptPares(texto),
      config: {
        temperature: 0.2,
        maxOutputTokens: 16384,
        responseMimeType: 'application/json',
        responseSchema: GEMINI_SCHEMA,
        thinkingConfig: { thinkingBudget: 0 },
      },
    });
    return JSON.parse(stripFences(r.text ?? ''));
  },
};

// ── Avaliação ────────────────────────────────────────────────────────────────
const norm = (s) => (s ?? '').toString().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

function procIsAchado(proc, achadoTerm) {
  const first = norm(proc).split(/\s+/)[0];
  return first === norm(achadoTerm);
}

const isArch = (d) => d === 97 || d === 98 || d === 99;
const isValidFDI = (d) => {
  const q = Math.floor(d / 10), t = d % 10;
  if (q >= 1 && q <= 4) return t >= 1 && t <= 8;
  if (q >= 5 && q <= 8) return t >= 1 && t <= 5;
  return false;
};

/** Normaliza dentes_observacoes (objeto OU array de pares) para objeto {"26": "..."}. */
function normObs(obs) {
  if (Array.isArray(obs)) {
    const o = {};
    for (const p of obs) {
      if (p && p.dente != null) o[String(Number(p.dente))] = p.observacao ?? '';
    }
    return o;
  }
  return obs ?? {};
}

function avaliar(resp, espera) {
  const falhas = [];
  // Réplica do pós-processamento de prod: filtra FDI inválido/sentinela (SEM o backstop
  // de órfão — órfão cru é sinal de qualidade do modelo que queremos medir).
  const afetados = (resp.dentes_afetados ?? []).map(Number).filter((d) => !isNaN(d) && (isValidFDI(d) || isArch(d)));
  const obs = normObs(resp.dentes_observacoes);
  const chaves = new Set(Object.keys(obs));

  const orphans = afetados.filter((d) => !chaves.has(String(d)));
  if (orphans.length) falhas.push(`ORFÃO: ${orphans.join(',')}`);

  let alucinacoes = [];
  if (espera.dentes_permitidos) {
    alucinacoes = afetados.filter((d) => !espera.dentes_permitidos.includes(d));
    if (alucinacoes.length) falhas.push(`ALUCINAÇÃO: dente(s) ${alucinacoes.join(',')} não estão no relato`);
  }
  for (const d of espera.dentes_afetados_contem ?? []) {
    if (!afetados.includes(d)) falhas.push(`faltou dente ${d} em dentes_afetados`);
  }
  for (const d of espera.dentes_observacoes_tem_chave ?? []) {
    if (!chaves.has(String(d))) falhas.push(`sem observação para "${d}"`);
  }
  for (const termo of espera.procedimentos_nao_contem_achado ?? []) {
    const ofensor = (resp.procedimentos ?? []).find((p) => procIsAchado(p, termo));
    if (ofensor) falhas.push(`procedimento é achado: "${ofensor}"`);
  }
  for (const termo of espera.anotacoes_contem ?? []) {
    if (!norm(resp.anotacoes).includes(norm(termo))) falhas.push(`anotacoes sem "${termo}"`);
  }
  for (const termo of espera.anotacoes_nao_contem ?? []) {
    if (norm(resp.anotacoes).includes(norm(termo))) falhas.push(`anotacoes com ruído "${termo}"`);
  }
  if (espera.retorno_sugerido_nao_null && !resp.retorno_sugerido) falhas.push('retorno_sugerido null');
  if (espera.alerta_novo_nao_null && !(typeof resp.alerta_novo === 'string' && resp.alerta_novo.trim())) {
    falhas.push('alerta_novo null (alergia mencionada no relato)');
  }
  return { falhas, orphans, alucinacoes, afetados: afetados.sort((a, b) => a - b), chaves: [...chaves].map(Number).sort((a, b) => a - b) };
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const base = JSON.parse(readFileSync(join(__dirname, 'formatar-evolucao-casos.json'), 'utf8')).casos;
  const pesados = JSON.parse(readFileSync(join(__dirname, 'bakeoff-casos-pesados.json'), 'utf8')).casos;
  const casos = [...base, ...pesados];

  // --only nome1,nome2  roda só esses modelos;  --tag xyz  sufixo do arquivo de saída
  const onlyArg = process.argv.indexOf('--only');
  const ONLY = onlyArg !== -1 ? process.argv[onlyArg + 1].split(',') : null;
  const tagArg = process.argv.indexOf('--tag');
  const TAG = tagArg !== -1 ? process.argv[tagArg + 1] : '2026-07-13';
  const ativos = Object.fromEntries(Object.entries(MODELOS).filter(([n]) => !ONLY || ONLY.includes(n)));
  if (!Object.keys(ativos).length) { console.error(`--only não bateu com nenhum modelo (${Object.keys(MODELOS).join(', ')})`); process.exit(1); }

  const resultado = { quando: new Date().toISOString(), runs_por_caso: RUNS, modelos: {} };
  for (const nome of Object.keys(ativos)) {
    resultado.modelos[nome] = { casos: [], erros: 0, orphansTotal: 0, alucinacoesTotal: 0, falhasTotal: 0, latencias: [] };
  }

  for (const caso of casos) {
    console.log(`\n═══ CASO: ${caso.id} ═══`);
    for (const [nome, chamar] of Object.entries(ativos)) {
      const agg = resultado.modelos[nome];
      const rodadas = [];
      for (let i = 0; i < RUNS; i++) {
        const t0 = Date.now();
        try {
          const resp = await withTimeout(chamar(caso.texto), TIMEOUT_MS);
          const latMs = Date.now() - t0;
          const av = avaliar(resp, caso.espera);
          rodadas.push({ latMs, ...av });
          agg.latencias.push(latMs);
          agg.orphansTotal += av.orphans.length;
          agg.alucinacoesTotal += av.alucinacoes.length;
          agg.falhasTotal += av.falhas.length;
        } catch (err) {
          const latMs = Date.now() - t0;
          const msg = String(err?.message ?? err).slice(0, 180);
          rodadas.push({ latMs, erro: msg });
          agg.erros += 1;
          console.log(`  [${nome}] run${i + 1}: ✗ ERRO (${latMs}ms) ${msg}`);
        }
        await new Promise((r) => setTimeout(r, THROTTLE_MS));
      }
      const validas = rodadas.filter((r) => !r.erro);
      const assinaturas = validas.map((r) => `${r.afetados.join(',')}|${r.chaves.join(',')}`);
      const estavel = assinaturas.length === RUNS && assinaturas.every((a) => a === assinaturas[0]);
      const totalFalhas = validas.reduce((n, r) => n + r.falhas.length, 0);
      const pass = rodadas.every((r) => !r.erro) && totalFalhas === 0 && estavel;
      agg.casos.push({ id: caso.id, pass, estavel, totalFalhas, rodadas });

      const lat = validas.length ? Math.round(validas.reduce((n, r) => n + r.latMs, 0) / validas.length) : 0;
      console.log(`  [${nome}] ${pass ? 'PASS' : 'FAIL'}  falhas=${totalFalhas} estável=${estavel} lat~${lat}ms`);
      for (const [i, r] of rodadas.entries()) {
        if (r.erro) continue;
        if (r.falhas.length) console.log(`    run${i + 1}: ${r.falhas.join(' | ')}`);
      }
    }
  }

  // ── Placar final ──────────────────────────────────────────────────────────
  console.log('\n\n════════════ PLACAR FINAL ════════════');
  console.log(`critério declarado: precisão (PASS, zero alucinação, zero órfão) > latência\n`);
  const linhas = [];
  for (const [nome, agg] of Object.entries(resultado.modelos)) {
    const passes = agg.casos.filter((c) => c.pass).length;
    const latMed = agg.latencias.length ? Math.round(agg.latencias.reduce((a, b) => a + b, 0) / agg.latencias.length) : 0;
    const latP95 = agg.latencias.length ? [...agg.latencias].sort((a, b) => a - b)[Math.floor(agg.latencias.length * 0.95)] : 0;
    linhas.push({ nome, passes, total: casos.length, falhas: agg.falhasTotal, orphans: agg.orphansTotal, alucin: agg.alucinacoesTotal, erros: agg.erros, latMed, latP95 });
  }
  for (const l of linhas) {
    console.log(`${l.nome.padEnd(20)} PASS ${l.passes}/${l.total}  falhas=${String(l.falhas).padStart(3)}  órfãos=${l.orphans}  alucinações=${l.alucin}  erros_hard=${l.erros}  lat méd=${l.latMed}ms p95=${l.latP95}ms`);
  }

  const out = join(__dirname, `bakeoff-resultado-${TAG}.json`);
  writeFileSync(out, JSON.stringify(resultado, null, 2));
  console.log(`\nResultado completo: ${out}`);
}

main().catch((err) => { console.error('ERRO FATAL:', err); process.exit(1); });
