export const STATES = {
  // Fluxo legado (text-based) — mantido para conversas em andamento
  INICIO:                 'inicio',
  COLETANDO_NOME:         'coletando_nome',
  COLETANDO_MOTIVO:       'coletando_motivo',
  SELECIONANDO_DENTISTA:  'selecionando_dentista',
  OFERECENDO_HORARIOS:    'oferecendo_horarios',
  AGUARDANDO_CONFIRMACAO: 'aguardando_confirmacao',
  ENVIANDO_PDF:           'enviando_pdf',

  // Fluxo via List Messages (balões interativos)
  AGUARDANDO_DENTISTA: 'aguardando_dentista',
  AGUARDANDO_DATA:     'aguardando_data',
  AGUARDANDO_HORA:     'aguardando_hora',

  // Estados comuns
  CONFIRMADO: 'confirmado',
  HUMANO:     'humano',
} as const;

export type BotState = (typeof STATES)[keyof typeof STATES];
