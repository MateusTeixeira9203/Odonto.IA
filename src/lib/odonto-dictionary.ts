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
  // Quadrante 5 — Decíduo Superior Direito
  51: 'Incisivo central decíduo superior direito',
  52: 'Incisivo lateral decíduo superior direito',
  53: 'Canino decíduo superior direito',
  54: 'Primeiro molar decíduo superior direito',
  55: 'Segundo molar decíduo superior direito',
  // Quadrante 6 — Decíduo Superior Esquerdo
  61: 'Incisivo central decíduo superior esquerdo',
  62: 'Incisivo lateral decíduo superior esquerdo',
  63: 'Canino decíduo superior esquerdo',
  64: 'Primeiro molar decíduo superior esquerdo',
  65: 'Segundo molar decíduo superior esquerdo',
  // Quadrante 7 — Decíduo Inferior Esquerdo
  71: 'Incisivo central decíduo inferior esquerdo',
  72: 'Incisivo lateral decíduo inferior esquerdo',
  73: 'Canino decíduo inferior esquerdo',
  74: 'Primeiro molar decíduo inferior esquerdo',
  75: 'Segundo molar decíduo inferior esquerdo',
  // Quadrante 8 — Decíduo Inferior Direito
  81: 'Incisivo central decíduo inferior direito',
  82: 'Incisivo lateral decíduo inferior direito',
  83: 'Canino decíduo inferior direito',
  84: 'Primeiro molar decíduo inferior direito',
  85: 'Segundo molar decíduo inferior direito',
};

// ── Procedimentos — termos coloquiais → nome clínico ─────────────────────────

export const PROCEDIMENTOS_MAP: Record<string, string> = {
  // Endodontia
  'canal':                       'Tratamento endodôntico',
  'tratamento de canal':         'Tratamento endodôntico',
  'canal radicular':             'Tratamento endodôntico',
  'endodontia':                  'Tratamento endodôntico',
  'retratamento de canal':       'Retratamento endodôntico',
  'retratamento endodôntico':    'Retratamento endodôntico',
  'apicectomia':                 'Cirurgia parendodôntica (apicectomia)',
  'cirurgia parendodôntica':     'Cirurgia parendodôntica (apicectomia)',

  // Exodontia
  'extração':                    'Exodontia',
  'extração dentária':           'Exodontia',
  'exodontia':                   'Exodontia',
  'extração simples':            'Exodontia simples',
  'extração complexa':           'Exodontia complexa',
  'extração cirúrgica':          'Exodontia complexa',
  'siso':                        'Exodontia de terceiro molar',
  'dente do siso':               'Exodontia de terceiro molar',
  'terceiro molar':              'Exodontia de terceiro molar',

  // Periodontia
  'raspagem':                    'Raspagem e alisamento radicular',
  'alisamento radicular':        'Raspagem e alisamento radicular',
  'raspagem supra':              'Raspagem supragengival',
  'raspagem supragengival':      'Raspagem supragengival',
  'raspagem infra':              'Raspagem infragengival',
  'raspagem infragengival':      'Raspagem infragengival',
  'curetagem':                   'Curetagem periodontal',
  'gengivoplastia':              'Gengivoplastia',
  'gengivectomia':               'Gengivectomia',
  'cirurgia periodontal':        'Cirurgia periodontal',

  // Dentística / restauradora
  'profilaxia':                  'Profilaxia dental',
  'limpeza':                     'Profilaxia dental',
  'limpeza dental':              'Profilaxia dental',
  'restauração':                 'Restauração direta',
  'obturação':                   'Restauração direta',
  'amálgama':                    'Restauração com amálgama',
  'resina':                      'Restauração com resina composta',
  'resina composta':             'Restauração com resina composta',
  'faceta':                      'Faceta de porcelana/resina',
  'faceta de porcelana':         'Faceta de porcelana/resina',
  'faceta de resina':            'Faceta de porcelana/resina',
  'lente de contato':            'Lente de contato dental',
  'clareamento':                 'Clareamento dental',
  'clareamento dental':          'Clareamento dental',
  'clareamento a laser':         'Clareamento dental a laser',

  // Prótese
  'coroa':                       'Coroa total protética',
  'coroa protética':             'Coroa total protética',
  'coroa de porcelana':          'Coroa total protética em porcelana',
  'prótese':                     'Prótese dentária',
  'prótese total':               'Prótese total',
  'dentadura':                   'Prótese total',
  'ppr':                         'Prótese parcial removível',
  'prótese parcial removível':   'Prótese parcial removível',
  'protocolo':                   'Prótese protocolo sobre implante',
  'pino':                        'Núcleo de preenchimento / retentor intracanal',
  'retentor intracanal':         'Núcleo de preenchimento / retentor intracanal',
  'núcleo de preenchimento':     'Núcleo de preenchimento / retentor intracanal',
  'provisório':                  'Coroa/restauração provisória',

  // Implantodontia
  'implante':                    'Implante osseointegrado',
  'implante dentário':           'Implante osseointegrado',
  'enxerto':                     'Enxerto ósseo/tecido mole',
  'enxerto ósseo':               'Enxerto ósseo/tecido mole',
  'levantamento de seio':        'Levantamento de seio maxilar',
  'sinus lift':                  'Levantamento de seio maxilar',

  // Ortodontia / disfunção
  'aparelho':                    'Aparelho ortodôntico',
  'aparelho ortodôntico':        'Aparelho ortodôntico',
  'contenção':                   'Contenção ortodôntica',
  'placa':                       'Placa miorrelaxante/de bruxismo',
  'placa miorrelaxante':         'Placa miorrelaxante/de bruxismo',
  'placa de bruxismo':           'Placa miorrelaxante/de bruxismo',

  // Diagnóstico / imagem
  'radiografia':                 'Exame radiográfico',
  'raio-x':                      'Exame radiográfico',
  'tomografia':                  'Tomografia computadorizada de feixe cônico (CBCT)',
  'tomografia computadorizada':  'Tomografia computadorizada de feixe cônico (CBCT)',

  // Auxiliares
  'moldagem':                    'Moldagem para confecção de prótese/dispositivo',
  'cimentação':                  'Cimentação de prótese/restauração indireta',
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
  'prilocaína':          'Prilocaína (anestésico local)',
  'guta-percha':         'Guta-percha (material obturador endodôntico)',
  'cimento endodôntico': 'Cimento obturador endodôntico',
  'hidróxido de cálcio': 'Hidróxido de cálcio (medicação intracanal)',
  'ionômero de vidro':   'Cimento de ionômero de vidro',
  'ionômero':            'Cimento de ionômero de vidro',
  'cimento resinoso':    'Cimento resinoso para cimentação',
};

// ── Prompt para Whisper — vocabulário de contexto ────────────────────────────
// Whisper só usa os ~224 primeiros tokens do prompt: FDI/quadrantes primeiro
// (ataca "erra o dente"), vocabulário clínico depois.

export const WHISPER_DENTAL_PROMPT =
  'Dentista relatando consulta odontológica em português brasileiro. ' +
  'Numeração FDI: quadrante 1 (11-18) superior direito, quadrante 2 (21-28) superior esquerdo, ' +
  'quadrante 3 (31-38) inferior esquerdo, quadrante 4 (41-48) inferior direito. ' +
  'Decíduos: 51-55, 61-65, 71-75, 81-85. Siso = terceiro molar (18, 28, 38, 48). ' +
  'Faces: M, D, O, V, L, MOD, MO, DO. ' +
  'Termos: endodontia, exodontia, raspagem supra e infragengival, restauração com resina e amálgama, faceta, ' +
  'implante osseointegrado, enxerto ósseo, prótese total e parcial removível, coroa, retentor intracanal, ' +
  'placa miorrelaxante, clareamento, apicectomia, gengivoplastia, radiografia periapical, tomografia CBCT, ' +
  'profilaxia, lidocaína, articaína.';

// ── Contexto para injeção no prompt da IA ────────────────────────────────────

export function buildDentalContext(): string {
  const procedimentos = Object.entries(PROCEDIMENTOS_MAP)
    .map(([k, v]) => `"${k}" → ${v}`)
    .join(', ');

  return `
GLOSSÁRIO ODONTOLÓGICO (use para interpretar o relato):
Numeração FDI: dentes 11-18 (sup. dir.), 21-28 (sup. esq.), 31-38 (inf. esq.), 41-48 (inf. dir.). Decíduos: 51-55, 61-65, 71-75, 81-85.
Sisos: 18, 28, 38, 48
Faces: M=Mesial, D=Distal, O=Oclusal, V=Vestibular, L=Lingual, MOD=Mesio-ocluso-distal
Arcada/boca: sentinela 99 = boca toda (limpeza, profilaxia, clareamento, raspagem geral); 97 = arcada superior; 98 = arcada inferior (ex: PPR, prótese total, aparelho, placa)
Procedimentos: ${procedimentos}
Sempre converter número verbal para FDI: "vinte e seis" → 26, "trinta e seis" → 36
`.trim();
}
