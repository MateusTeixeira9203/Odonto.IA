'use server';

import { redirect } from 'next/navigation';
import { getDentistaCached } from '@/lib/get-dentista';
import { createServiceClient } from '@/lib/supabase/service';
import { sendWhatsAppText } from '@/lib/whatsapp/evolution';
import { STATES } from '@/lib/whatsapp/states';

// ─── Tipos públicos ───────────────────────────────────────────────────────────

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

// ─── Guard de role ────────────────────────────────────────────────────────────

async function verificarAcesso() {
  const dentista = await getDentistaCached();
  if (!dentista) redirect('/login');
  if (dentista.role !== 'admin' && dentista.role !== 'secretaria') {
    redirect('/dashboard');
  }
  return dentista;
}

// ─── Leitura ──────────────────────────────────────────────────────────────────

export async function listarConversas(): Promise<ConversaItem[]> {
  const dentista = await verificarAcesso();
  const db = createServiceClient();

  const { data } = await db
    .from('conversas_bot')
    .select('id, telefone, etapa, ativo, ultimo_contato, paciente:pacientes(id, nome)')
    .eq('clinica_id', dentista.clinica_id)
    .order('ultimo_contato', { ascending: false })
    .limit(60);

  return (data ?? []) as unknown as ConversaItem[];
}

export async function buscarMensagens(conversaId: string): Promise<MensagemItem[]> {
  await verificarAcesso();
  const db = createServiceClient();

  const { data } = await db
    .from('mensagens_bot')
    .select('id, direcao, conteudo, tipo, created_at')
    .eq('conversa_id', conversaId)
    .order('created_at', { ascending: true })
    .limit(200);

  return (data ?? []) as MensagemItem[];
}

// ─── Ações ────────────────────────────────────────────────────────────────────

export async function assumirConversa(conversaId: string): Promise<{ ok: boolean }> {
  await verificarAcesso();
  const db = createServiceClient();

  const { error } = await db
    .from('conversas_bot')
    .update({ ativo: false, etapa: STATES.HUMANO })
    .eq('id', conversaId);

  return { ok: !error };
}

export async function finalizarConversa(conversaId: string): Promise<{ ok: boolean }> {
  await verificarAcesso();
  const db = createServiceClient();

  const { error } = await db
    .from('conversas_bot')
    .update({ ativo: true, etapa: STATES.INICIO, contexto: {} })
    .eq('id', conversaId);

  return { ok: !error };
}

export async function enviarMensagemManual(
  conversaId: string,
  clinicaId: string,
  telefone: string,
  conteudo: string,
): Promise<{ ok: boolean; aviso?: string }> {
  await verificarAcesso();
  const db = createServiceClient();

  // Salva no histórico independente do envio via API
  await db.from('mensagens_bot').insert({
    conversa_id: conversaId,
    clinica_id:  clinicaId,
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
