/**
 * Central event catalog — single source of truth for event names.
 * Used by: activity_logs, future webhooks, integrations.
 * Convention: domain.action in lowercase (dot-notation).
 */
export const EVENTS = {
  // ── Orçamentos ─────────────────────────────────────────────────────────────
  ORCAMENTO_CRIADO:    'orcamento.criado',
  ORCAMENTO_ENVIADO:   'orcamento.enviado',
  ORCAMENTO_APROVADO:  'orcamento.aprovado',
  ORCAMENTO_RECUSADO:  'orcamento.recusado',
  ORCAMENTO_EXCLUIDO:  'orcamento.excluido',
  ORCAMENTO_EDITADO:   'orcamento.editado',

  // ── Pagamentos ─────────────────────────────────────────────────────────────
  PAGAMENTO_REGISTRADO: 'pagamento.registrado',
  PAGAMENTO_CANCELADO:  'pagamento.cancelado',
  PAGAMENTO_EDITADO:    'pagamento.editado',
  PAGAMENTO_EXCLUIDO:   'pagamento.excluido',

  // ── Agendamentos ───────────────────────────────────────────────────────────
  AGENDAMENTO_CRIADO:     'agendamento.criado',
  AGENDAMENTO_CONFIRMADO: 'agendamento.confirmado',
  AGENDAMENTO_CANCELADO:  'agendamento.cancelado',
  AGENDAMENTO_CONCLUIDO:  'agendamento.concluido',
  AGENDAMENTO_NO_SHOW:    'agendamento.no_show',
  AGENDAMENTO_CHECKIN:    'agendamento.checkin',

  // ── Follow-ups ─────────────────────────────────────────────────────────────
  FOLLOWUP_MARCADO:   'followup.marcado',
  FOLLOWUP_CONCLUIDO: 'followup.concluido',
  FOLLOWUP_ADIADO:    'followup.adiado',

  // ── Pacientes ──────────────────────────────────────────────────────────────
  PACIENTE_CRIADO:     'paciente.criado',
  PACIENTE_ATUALIZADO: 'paciente.atualizado',
  PACIENTE_EXCLUIDO:   'paciente.excluido',

  // ── Consultas / Fichas ─────────────────────────────────────────────────────
  CONSULTA_INICIADA:   'consulta.iniciada',
  CONSULTA_FINALIZADA: 'consulta.finalizada',
  FICHA_CRIADA:        'ficha.criada',
  FICHA_EDITADA:       'ficha.editada',
  FICHA_EXCLUIDA:      'ficha.excluida',

  // ── Planejamentos ──────────────────────────────────────────────────────────
  PLANEJAMENTO_CRIADO:  'planejamento.criado',
  PLANEJAMENTO_EDITADO: 'planejamento.editado',

  // ── Financeiro ─────────────────────────────────────────────────────────────
  DESPESA_CRIADA:  'despesa.criada',
  DESPESA_EXCLUIDA: 'despesa.excluida',
  RECEITA_CRIADA:  'receita.criada',
  RECEITA_EXCLUIDA: 'receita.excluida',

  // ── Equipe / Clínica ───────────────────────────────────────────────────────
  CONVITE_ENVIADO:      'convite.enviado',
  CONVITE_ACEITO:       'convite.aceito',
  USUARIO_ADICIONADO:   'usuario.adicionado',
  USUARIO_REMOVIDO:     'usuario.removido',
  CONFIGURACAO_SALVA:   'configuracao.salva',
} as const;

export type OdontoEvent = typeof EVENTS[keyof typeof EVENTS];

/**
 * Entity type identifiers for activity logs and future webhooks.
 * Use these constants instead of raw strings.
 */
export const ENTITY_TYPES = {
  ORCAMENTO:     'orcamento',
  PAGAMENTO:     'pagamento',
  AGENDAMENTO:   'agendamento',
  PACIENTE:      'paciente',
  FICHA:         'ficha',
  PLANEJAMENTO:  'planejamento',
  DESPESA:       'despesa',
  RECEITA:       'receita',
  CONVITE:       'convite',
  USUARIO:       'usuario',
  CLINICA:       'clinica',
} as const;

export type EntityType = typeof ENTITY_TYPES[keyof typeof ENTITY_TYPES];

/** Typed metadata payloads per event — grow this as needed */
export type EventPayload<E extends OdontoEvent> =
  E extends 'orcamento.aprovado'    ? { paciente_nome: string; total: number } :
  E extends 'pagamento.registrado'  ? { valor: number; forma: string; orcamento_id: string } :
  E extends 'followup.marcado'      ? { nota?: string } :
  E extends 'agendamento.cancelado' ? { motivo?: string } :
  E extends 'convite.enviado'       ? { email: string; role: string } :
  Record<string, unknown>;
