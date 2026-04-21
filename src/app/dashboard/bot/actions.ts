'use server';

import { redirect } from 'next/navigation';
import { getDentistaCached } from '@/lib/get-dentista';
import { createServiceClient } from '@/lib/supabase/service';
import {
  getBotMensagens,
  DEFAULTS_MENSAGENS,
  type BotMensagens,
} from '@/lib/whatsapp/template';

// Nota: DEFAULTS_MENSAGENS e BotMensagens devem ser importados diretamente de
// @/lib/whatsapp/template — arquivos 'use server' só podem exportar async functions.

// ─── Guard ────────────────────────────────────────────────────────────────────

async function verificarAcesso() {
  const dentista = await getDentistaCached();
  if (!dentista) redirect('/login');
  if (dentista.role !== 'admin' && dentista.role !== 'secretaria') redirect('/dashboard');
  return dentista;
}

// ─── Actions ──────────────────────────────────────────────────────────────────

/**
 * Carrega as mensagens configuradas para a clínica do usuário autenticado.
 */
export async function carregarMensagensBot(): Promise<BotMensagens> {
  const dentista = await verificarAcesso();
  return getBotMensagens(dentista.clinica_id);
}

/**
 * Salva as mensagens personalizadas para a clínica.
 * Preserva os outros campos de bot_config (whatsapp_number, horários, etc.).
 */
export async function salvarMensagensBot(
  form: BotMensagens,
): Promise<{ ok: boolean; erro?: string }> {
  const dentista = await verificarAcesso();
  const db = createServiceClient();

  // Verifica se já existe uma linha para esta clínica
  const { data: existing } = await db
    .from('bot_config')
    .select('clinica_id')
    .eq('clinica_id', dentista.clinica_id)
    .maybeSingle();

  const d = DEFAULTS_MENSAGENS;
  const payload = {
    msg_novo_paciente:     form.msg_novo_paciente.trim()     || d.msg_novo_paciente,
    msg_paciente_antigo:   form.msg_paciente_antigo.trim()   || d.msg_paciente_antigo,
    titulo_menu_principal: form.titulo_menu_principal.trim() || d.titulo_menu_principal,
    nome_assistente:       form.nome_assistente.trim()       || d.nome_assistente,
    msg_confirmacao:       form.msg_confirmacao.trim()       || d.msg_confirmacao,
    msg_sem_horario:       form.msg_sem_horario.trim()       || d.msg_sem_horario,
  };

  if (existing) {
    const { error } = await db
      .from('bot_config')
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq('clinica_id', dentista.clinica_id);
    if (error) return { ok: false, erro: error.message };
  } else {
    const { error } = await db
      .from('bot_config')
      .insert({ clinica_id: dentista.clinica_id, ...payload });
    if (error) return { ok: false, erro: error.message };
  }

  return { ok: true };
}
