/**
 * Parser de templates para mensagens do bot.
 * Suporta variáveis {{nome}} e {{clinica}}.
 *
 * Uso: parseTemplate("Olá, {{nome}}!", { nome: "João" }) → "Olá, João!"
 */

import { createServiceClient } from '@/lib/supabase/service';

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface BotMensagens {
  msg_novo_paciente:    string;
  msg_paciente_antigo:  string;
  titulo_menu_principal: string;
}

export interface TemplateVars {
  nome:    string;
  clinica: string;
}

// ─── Defaults ─────────────────────────────────────────────────────────────────

export const DEFAULTS_MENSAGENS: BotMensagens = {
  msg_novo_paciente:    'Sou a assistente virtual da clínica. Com qual dentista você deseja agendar?',
  msg_paciente_antigo:  'Que bom te ver de volta, {{nome}}! Como posso te ajudar hoje?',
  titulo_menu_principal: 'Agendar Consulta',
};

// ─── Parser ───────────────────────────────────────────────────────────────────

/**
 * Substitui variáveis {{nome}} e {{clinica}} nos templates de mensagem.
 */
export function parseTemplate(text: string, vars: Partial<TemplateVars>): string {
  return text
    .replace(/\{\{nome\}\}/g,    vars.nome    ?? '')
    .replace(/\{\{clinica\}\}/g, vars.clinica ?? '');
}

// ─── Fetcher ──────────────────────────────────────────────────────────────────

/**
 * Busca as mensagens configuradas pela clínica no banco.
 * Usa defaults para campos não preenchidos ou quando não há configuração.
 */
export async function getBotMensagens(clinicaId: string): Promise<BotMensagens> {
  const db = createServiceClient();
  const { data } = await db
    .from('bot_config')
    .select('msg_novo_paciente, msg_paciente_antigo, titulo_menu_principal')
    .eq('clinica_id', clinicaId)
    .maybeSingle();

  if (!data) return { ...DEFAULTS_MENSAGENS };

  return {
    msg_novo_paciente:
      (data.msg_novo_paciente as string | null)?.trim()     || DEFAULTS_MENSAGENS.msg_novo_paciente,
    msg_paciente_antigo:
      (data.msg_paciente_antigo as string | null)?.trim()   || DEFAULTS_MENSAGENS.msg_paciente_antigo,
    titulo_menu_principal:
      (data.titulo_menu_principal as string | null)?.trim() || DEFAULTS_MENSAGENS.titulo_menu_principal,
  };
}
