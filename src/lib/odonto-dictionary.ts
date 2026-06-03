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
  'lidocaína':           'Lidocaína (anestésico local)',
  'articaína':           'Articaína (anestésico local)',
  'mepivacaína':         'Mepivacaína (anestésico local)',
  'guta-percha':         'Guta-percha (material obturador endodôntico)',
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
