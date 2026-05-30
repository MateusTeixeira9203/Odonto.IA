export interface Clinica {
  id: string;
  nome: string;
  status: 'ativa' | 'cancelada' | 'suspensa';
  limite_dentistas: number;
  created_at: string;
  updated_at: string;
}

/** Identidade global — espelha auth.users + active_clinica_id */
export interface User {
  id: string;
  email: string;
  active_clinica_id: string | null;
  created_at: string;
  updated_at: string;
}

export type ClinicaUsuarioRole   = 'admin' | 'dentista' | 'secretaria';
export type ClinicaUsuarioStatus = 'ativo' | 'removido' | 'pendente';

/** Fonte da verdade de membership multi-tenant */
export interface ClinicaUsuario {
  id: string;
  usuario_id: string;
  clinica_id: string;
  role: ClinicaUsuarioRole;
  status: ClinicaUsuarioStatus;
  invited_by: string | null;
  joined_at: string;
  removed_at: string | null;
  created_at: string;
  updated_at: string;
}

/** Perfil de domínio operacional da secretária */
export interface Secretaria {
  id: string;
  usuario_id: string;
  clinica_id: string;
  nome: string;
  telefone: string | null;
  must_change_password: boolean;
  created_at: string;
  updated_at: string;
}

export type DentistaRole = 'admin' | 'dentista' | 'secretaria';

export interface Dentista {
  id: string;
  clinica_id: string;
  user_id: string;
  nome: string;
  role: DentistaRole;
  cro: string | null;
  especialidade: string | null;
  telefone: string | null;
  email: string | null;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface Paciente {
  id: string;
  clinica_id: string;
  dentista_id: string | null;
  nome: string;
  cpf: string | null;
  email: string | null;
  telefone: string | null;
  data_nascimento: string | null;
  endereco: string | null;
  cidade: string | null;
  estado: string | null;
  whatsapp: string | null;
  observacoes: string | null;
  followup_pendente: boolean;
  followup_nota: string | null;
  followup_em: string | null;
  followup_snooze_ate: string | null;
  created_at: string;
  updated_at: string;
}

export interface Ficha {
  id: string;
  clinica_id: string;
  paciente_id: string;
  dentista_id: string;
  audio_url: string | null;
  transcricao: string | null;
  foto_ficha_url: string | null;
  radiografia_url: string | null;
  anotacoes: string | null;
  status: "aberta" | "concluida";
  created_at: string;
  updated_at: string;
  queixa_principal: string | null;
  historico_dental: string | null;
  historico_medico: string | null;
  alergias: string | null;
  medicamentos_em_uso: string | null;
  exame_fisico: string | null;
  dentes_afetados: string[] | null;
}

export interface Procedimento {
  id: string;
  clinica_id: string;
  nome: string;
  descricao: string | null;
  codigo_tuss: string | null;
  categoria: string;
  preco_padrao: number | null;
  duracao_minutos: number | null;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface Orcamento {
  id: string;
  clinica_id: string;
  ficha_id: string;
  paciente_id: string;
  dentista_id: string;
  status: "rascunho" | "enviado" | "aprovado" | "recusado";
  validade_dias: number;
  condicoes_pagamento: string | null;
  total: number | null;
  pdf_url: string | null;
  enviado_em: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProcedimentoPadrao {
  id: string;
  nome: string;
  descricao: string | null;
  categoria: string;
  preco_sugerido: number;
  duracao_minutos: number;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface FichaArquivo {
  id: string;
  clinica_id: string;
  ficha_id: string;
  tipo: "documento" | "foto_ficha" | "radiografia";
  nome_original: string;
  storage_url: string;
  texto_extraido: string | null;
  processado: boolean;
  created_at: string;
  updated_at: string;
}

export interface Pagamento {
  id: string;
  clinica_id: string;
  orcamento_id: string;
  paciente_id: string;
  dentista_id: string;
  valor: number;
  forma_pagamento: "dinheiro" | "pix" | "cartao_credito" | "cartao_debito" | "boleto" | "outro" | null;
  status: "pendente" | "pago" | "cancelado";
  data_vencimento: string | null;
  data_pagamento: string | null;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ConfiguracaoClinica {
  id: string;
  clinica_id: string;
  nome_clinica: string | null;
  telefone: string | null;
  endereco: string | null;
  horario_atendimento: string | null;
  mensagem_boas_vindas: string | null;
  mensagem_confirmacao: string | null;
  mensagem_lembrete: string | null;
  formas_pagamento: string[];
  aceita_convenio: boolean;
  convenios: string[];
  created_at: string;
  updated_at: string;
}

export type AgendamentoStatus =
  | 'scheduled'
  | 'confirmed'
  | 'checked_in'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'no_show';

export interface Agendamento {
  id: string;
  clinica_id: string;
  paciente_id: string;
  dentista_id: string;
  data_hora: string;
  duracao_minutos: number;
  status: AgendamentoStatus;
  origem: 'manual' | 'bot' | 'app';
  observacoes: string | null;
  confirmado_em: string | null;
  google_event_id: string | null;
  whatsapp_reminder_sent: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface HorarioDisponivel {
  id: string;
  clinica_id: string;
  dentista_id: string;
  dia_semana: number;
  hora_inicio: string;
  hora_fim: string;
  intervalo_minutos: number;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface OrcamentoItem {
  id: string;
  clinica_id: string;
  orcamento_id: string;
  etapa_id: string | null;
  procedimento_id: string | null;
  descricao: string | null;
  dente: string | null;
  quantidade: number;
  preco_unitario: number | null;
  preco_total: number | null;
  created_at: string;
  updated_at: string;
}

export interface Planejamento {
  id: string;
  clinica_id: string;
  ficha_id: string;
  paciente_id: string;
  dentista_id: string;
  titulo: string;
  status: "rascunho" | "apresentado" | "aprovado";
  created_at: string;
  updated_at: string;
}

export interface PlanejamentoEtapa {
  id: string;
  clinica_id: string;
  planejamento_id: string;
  ordem: number;
  titulo: string;
  dente: string | null;
  dentes: string[];
  descricao_simples: string | null;
  status: "aberto" | "pendente" | "concluido";
  imagem_arquivo_id: string | null;
  procedimento_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface BotConfig {
  clinica_id: string;
  whatsapp_number: string;
  welcome_message: string;
  working_hours_start: string;
  working_hours_end: string;
  transfer_to_human_enabled: boolean;
  reminder_enabled: boolean;
  reminder_hours: number;
  reminder_message: string;
  updated_at: string;
}

export interface InstanciaWhatsapp {
  id: string;
  clinica_id: string;
  instance_name: string;
  status: 'inactive' | 'connecting' | 'connected' | 'error';
  qrcode: string | null;
  last_qrcode_at: string | null;
  updated_at: string;
}

/** Linha real da tabela conversas_bot (schema da migration 002) */
export interface ConversaBot {
  id: string;
  clinica_id: string;
  telefone: string;
  etapa: string;
  contexto: Record<string, unknown>;
  paciente_id: string | null;
  ativo: boolean;         // false = transferido para humano
  ultimo_contato: string;
  created_at: string;
  updated_at: string;
}

/** Schema real da tabela mensagens_bot (migration 002) */
export interface MensagemBot {
  id: string;
  clinica_id: string;
  conversa_id: string;
  direcao: 'entrada' | 'saida';
  conteudo: string;
  tipo: 'texto' | 'imagem' | 'audio' | 'documento';
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export type ConviteStatus = 'pendente' | 'aceito' | 'expirado' | 'cancelado';

export interface Convite {
  id: string;
  clinica_id: string;
  email: string;
  role: DentistaRole;
  token: string;
  status: ConviteStatus;
  expires_at: string;
  /** FK dentistas.id — legado, mantido para compatibilidade */
  convidado_por: string | null;
  /** FK users.id — novo campo (migration 056) */
  invited_by: string | null;
  /** FK users.id — usuário que aceitou o convite */
  accepted_by: string | null;
  created_at: string;
  updated_at: string;
}
