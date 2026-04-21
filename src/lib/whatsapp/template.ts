import { createServiceClient } from '@/lib/supabase/service';

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface BotMensagens {
  msg_novo_paciente:     string;
  msg_paciente_antigo:   string;
  titulo_menu_principal: string;
  nome_assistente:       string;
  msg_confirmacao:       string;
  msg_sem_horario:       string;
}

export interface TemplateVars {
  nome?:       string;
  clinica?:    string;
  dentista?:   string;
  data_hora?:  string;
  assistente?: string;
}

// ─── Defaults ─────────────────────────────────────────────────────────────────

export const DEFAULTS_MENSAGENS: BotMensagens = {
  msg_novo_paciente:
    'Olá! Seja bem-vindo(a) à {{clinica}}! 😊\nSou o *{{assistente}}*, assistente virtual da clínica. Vou te ajudar a agendar sua consulta.',
  msg_paciente_antigo:
    'Olá, {{nome}}! Que bom ter você de volta. 😊\nSou o *{{assistente}}*, como posso te ajudar hoje?',
  titulo_menu_principal: 'Agendar Consulta',
  nome_assistente:       'DEX',
  msg_confirmacao:
    '✅ *Agendamento confirmado pelo {{assistente}}!*\n\n🦷 Dentista: *{{dentista}}*\n📅 Data/hora: *{{data_hora}}*\n\nAté lá! Qualquer dúvida, é só me chamar. 😊\n\n_Para agendar novamente, envie qualquer mensagem._',
  msg_sem_horario:
    'Poxa, não encontrei horários disponíveis para essa opção. 😕\nTente outro dentista ou outra data — estou aqui para ajudar!',
};

// ─── Parser ───────────────────────────────────────────────────────────────────

export function parseTemplate(text: string, vars: TemplateVars): string {
  return text
    .replace(/\{\{nome\}\}/g,       vars.nome       ?? '')
    .replace(/\{\{clinica\}\}/g,    vars.clinica    ?? '')
    .replace(/\{\{dentista\}\}/g,   vars.dentista   ?? '')
    .replace(/\{\{data_hora\}\}/g,  vars.data_hora  ?? '')
    .replace(/\{\{assistente\}\}/g, vars.assistente ?? '');
}

// ─── Fetcher ──────────────────────────────────────────────────────────────────

export async function getBotMensagens(clinicaId: string): Promise<BotMensagens> {
  const db = createServiceClient();
  const { data } = await db
    .from('bot_config')
    .select('msg_novo_paciente, msg_paciente_antigo, titulo_menu_principal, nome_assistente, msg_confirmacao, msg_sem_horario')
    .eq('clinica_id', clinicaId)
    .maybeSingle();

  const d = DEFAULTS_MENSAGENS;
  if (!data) return { ...d };

  const assistente = (data.nome_assistente as string | null)?.trim() || d.nome_assistente;

  return {
    nome_assistente:
      assistente,
    msg_novo_paciente:
      (data.msg_novo_paciente as string | null)?.trim()      || d.msg_novo_paciente,
    msg_paciente_antigo:
      (data.msg_paciente_antigo as string | null)?.trim()    || d.msg_paciente_antigo,
    titulo_menu_principal:
      (data.titulo_menu_principal as string | null)?.trim()  || d.titulo_menu_principal,
    msg_confirmacao:
      (data.msg_confirmacao as string | null)?.trim()        || d.msg_confirmacao,
    msg_sem_horario:
      (data.msg_sem_horario as string | null)?.trim()        || d.msg_sem_horario,
  };
}
