'use server';

import { requireRole } from '@/server/auth/roles';
import { createServiceClient } from '@/lib/supabase/service';
import {
  getBotMensagens,
  DEFAULTS_MENSAGENS,
  type BotMensagens,
} from '@/lib/whatsapp/template';

export async function carregarMensagensBot(): Promise<BotMensagens> {
  const { clinicId } = await requireRole(['admin', 'secretaria']);
  return getBotMensagens(clinicId);
}

export async function salvarMensagensBot(
  form: BotMensagens,
): Promise<{ ok: boolean; erro?: string }> {
  const { clinicId } = await requireRole(['admin', 'secretaria']);
  const db = createServiceClient();

  const { data: existing } = await db
    .from('bot_config')
    .select('clinica_id')
    .eq('clinica_id', clinicId)
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
      .eq('clinica_id', clinicId);
    if (error) return { ok: false, erro: error.message };
  } else {
    const { error } = await db
      .from('bot_config')
      .insert({ clinica_id: clinicId, ...payload });
    if (error) return { ok: false, erro: error.message };
  }

  return { ok: true };
}
