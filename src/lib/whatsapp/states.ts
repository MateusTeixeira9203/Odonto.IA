export const STATES = {
  INICIO:                 'inicio',
  COLETANDO_NOME:         'coletando_nome',
  COLETANDO_MOTIVO:       'coletando_motivo',
  SELECIONANDO_DENTISTA:  'selecionando_dentista',
  OFERECENDO_HORARIOS:    'oferecendo_horarios',
  AGUARDANDO_CONFIRMACAO: 'aguardando_confirmacao',
  CONFIRMADO:             'confirmado',
  ENVIANDO_PDF:           'enviando_pdf',
  HUMANO:                 'humano',
} as const;

export type BotState = (typeof STATES)[keyof typeof STATES];
