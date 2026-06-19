'use server';

import { requireRole } from '@/server/auth/roles';
import { createServiceClient } from '@/lib/supabase/service';
import { sendText } from '@/lib/whatsapp/provider';
import { STATES } from '@/lib/whatsapp/states';

export interface ConversaItem {
  id: string;
  telefone: string;
  etapa: string;
  estado: string;
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
    .select('id, telefone, etapa, estado, ativo, ultimo_contato, paciente:pacientes(id, nome)')
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

  // Resolve phone_number_id da clínica
  const { data: clinicaRow } = await db
    .from('clinicas')
    .select('whatsapp_phone_number_id')
    .eq('id', clinicId)
    .maybeSingle();

  const phoneNumberId =
    (clinicaRow?.whatsapp_phone_number_id as string | null) ??
    process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (!phoneNumberId) {
    return { ok: true, aviso: 'WHATSAPP_PHONE_NUMBER_ID não configurada — mensagem salva apenas no histórico.' };
  }

  try {
    await sendText(phoneNumberId, telefone, conteudo);
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: true, aviso: `Salvo, mas falha no envio WhatsApp: ${msg}` };
  }
}

export async function devolverParaBot(conversaId: string): Promise<{ ok: boolean }> {
  const { clinicId } = await requireRole(['admin', 'secretaria']);
  const db = createServiceClient();

  const { error } = await db
    .from('conversas_bot')
    .update({ ativo: true, estado: 'inicio', etapa: 'inicio', dados_coleta: {}, contexto: {} })
    .eq('id', conversaId)
    .eq('clinica_id', clinicId);

  return { ok: !error };
}

export async function confirmarPagamento(conversaId: string): Promise<{ ok: boolean }> {
  const { clinicId } = await requireRole(['admin', 'secretaria']);
  const db = createServiceClient();

  // Busca o paciente vinculado à conversa para atualizar o pagamento mais recente pendente
  const { data: conversa } = await db
    .from('conversas_bot')
    .select('paciente_id')
    .eq('id', conversaId)
    .eq('clinica_id', clinicId)
    .maybeSingle();

  if (conversa?.paciente_id) {
    await db
      .from('pagamentos')
      .update({ status: 'pago', verificado_automaticamente: false })
      .eq('clinica_id', clinicId)
      .eq('paciente_id', conversa.paciente_id)
      .eq('status', 'pendente')
      .order('created_at', { ascending: false })
      .limit(1);
  }

  const { error } = await db
    .from('conversas_bot')
    .update({ estado: 'encerrado' })
    .eq('id', conversaId)
    .eq('clinica_id', clinicId);

  return { ok: !error };
}

export async function recusarPagamento(conversaId: string): Promise<{ ok: boolean }> {
  const { clinicId } = await requireRole(['admin', 'secretaria']);
  const db = createServiceClient();

  const { error } = await db
    .from('conversas_bot')
    .update({ estado: 'humano' })
    .eq('id', conversaId)
    .eq('clinica_id', clinicId);

  return { ok: !error };
}
