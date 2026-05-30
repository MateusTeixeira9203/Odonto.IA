'use server';

import { requireRole } from '@/server/auth/roles';
import { createServiceClient } from '@/lib/supabase/service';
import { sendWhatsAppText } from '@/lib/whatsapp/evolution';
import { STATES } from '@/lib/whatsapp/states';

export interface ConversaItem {
  id: string;
  telefone: string;
  etapa: string;
  ativo: boolean;
  ultimo_contato: string;
  paciente: { id: string; nome: string } | null;
}

export interface MensagemItem {
  id: string;
  direcao: 'entrada' | 'saida';
  conteudo: string;
  tipo: string;
  created_at: string;
}

export async function listarConversas(): Promise<ConversaItem[]> {
  const { clinicId } = await requireRole(['admin', 'secretaria']);
  const db = createServiceClient();

  const { data } = await db
    .from('conversas_bot')
    .select('id, telefone, etapa, ativo, ultimo_contato, paciente:pacientes(id, nome)')
    .eq('clinica_id', clinicId)
    .order('ultimo_contato', { ascending: false })
    .limit(60);

  return (data ?? []) as unknown as ConversaItem[];
}

export async function buscarMensagens(conversaId: string): Promise<MensagemItem[]> {
  const { clinicId } = await requireRole(['admin', 'secretaria']);
  const db = createServiceClient();

  const { data } = await db
    .from('mensagens_bot')
    .select('id, direcao, conteudo, tipo, created_at')
    .eq('conversa_id', conversaId)
    .eq('clinica_id', clinicId)
    .order('created_at', { ascending: true })
    .limit(200);

  return (data ?? []) as MensagemItem[];
}

export async function assumirConversa(conversaId: string): Promise<{ ok: boolean }> {
  const { clinicId } = await requireRole(['admin', 'secretaria']);
  const db = createServiceClient();

  const { error } = await db
    .from('conversas_bot')
    .update({ ativo: false, etapa: STATES.HUMANO })
    .eq('id', conversaId)
    .eq('clinica_id', clinicId);

  return { ok: !error };
}

export async function finalizarConversa(conversaId: string): Promise<{ ok: boolean }> {
  const { clinicId } = await requireRole(['admin', 'secretaria']);
  const db = createServiceClient();

  const { error } = await db
    .from('conversas_bot')
    .update({ ativo: true, etapa: STATES.INICIO, contexto: {} })
    .eq('id', conversaId)
    .eq('clinica_id', clinicId);

  return { ok: !error };
}

export async function enviarMensagemManual(
  conversaId: string,
  telefone: string,
  conteudo: string,
): Promise<{ ok: boolean; aviso?: string }> {
  const { clinicId } = await requireRole(['admin', 'secretaria']);
  const db = createServiceClient();

  await db.from('mensagens_bot').insert({
    conversa_id: conversaId,
    clinica_id:  clinicId,
    direcao:     'saida',
    conteudo,
    tipo:        'texto',
  });

  const instance = process.env.EVOLUTION_DEFAULT_INSTANCE;
  if (!instance) {
    return { ok: true, aviso: 'EVOLUTION_DEFAULT_INSTANCE não configurada — mensagem salva apenas no histórico.' };
  }

  try {
    await sendWhatsAppText(instance, telefone, conteudo);
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: true, aviso: `Salvo, mas falha no envio WhatsApp: ${msg}` };
  }
}
