/**
 * Reusable CsvColumn definitions for common entities.
 * Import these in server actions to build consistent, typed CSV exports.
 */
import type { CsvColumn } from './csv';

// ── Pacientes ──────────────────────────────────────────────────────────────

export type PacienteCsvRow = {
  nome: string;
  telefone: string | null;
  email: string | null;
  data_nascimento: string | null;
  cidade: string | null;
  estado: string | null;
  created_at: string;
};

export const PACIENTE_CSV_COLUMNS: CsvColumn<PacienteCsvRow>[] = [
  { header: 'Nome',             value: r => r.nome },
  { header: 'Telefone',         value: r => r.telefone ?? '' },
  { header: 'E-mail',           value: r => r.email ?? '' },
  { header: 'Data Nascimento',  value: r => r.data_nascimento ?? '' },
  { header: 'Cidade',           value: r => r.cidade ?? '' },
  { header: 'Estado',           value: r => r.estado ?? '' },
  { header: 'Cadastrado em',    value: r => r.created_at.split('T')[0] },
];

// ── Agendamentos ───────────────────────────────────────────────────────────

export type AgendamentoCsvRow = {
  paciente_nome: string;
  dentista_nome: string;
  data_hora: string;
  duracao_minutos: number;
  status: string;
  observacoes: string | null;
  origem: string;
};

export const AGENDAMENTO_CSV_COLUMNS: CsvColumn<AgendamentoCsvRow>[] = [
  { header: 'Paciente',    value: r => r.paciente_nome },
  { header: 'Dentista',    value: r => r.dentista_nome },
  { header: 'Data/Hora',   value: r => r.data_hora.replace('T', ' ').slice(0, 16) },
  { header: 'Duração (min)', value: r => r.duracao_minutos },
  { header: 'Status',      value: r => r.status },
  { header: 'Origem',      value: r => r.origem },
  { header: 'Observações', value: r => r.observacoes ?? '' },
];

// ── Activity Logs / Auditoria ──────────────────────────────────────────────

export type ActivityLogCsvRow = {
  action: string;
  actor_nome: string | null;
  entity_type: string;
  entity_id: string | null;
  created_at: string;
};

export const ACTIVITY_LOG_CSV_COLUMNS: CsvColumn<ActivityLogCsvRow>[] = [
  { header: 'Ação',        value: r => r.action },
  { header: 'Responsável', value: r => r.actor_nome ?? '—' },
  { header: 'Entidade',    value: r => r.entity_type },
  { header: 'ID Entidade', value: r => r.entity_id ?? '—' },
  { header: 'Data/Hora',   value: r => r.created_at.replace('T', ' ').slice(0, 16) },
];
