/**
 * GET  /api/whatsapp/webhook  — verificação do webhook Meta
 * POST /api/whatsapp/webhook  — recebimento de mensagens Meta Cloud API
 *
 * Multi-tenant: o phone_number_id presente em cada mensagem é cruzado com
 * clinicas.whatsapp_phone_number_id para identificar a clínica destino.
 *
 * Segurança: valida assinatura HMAC-SHA256 via X-Hub-Signature-256.
 *
 * Fluxo por mensagem de texto/interactive:
 *   1. Valida assinatura e parseia payload com MetaProvider.
 *   2. Roteia para a clínica pelo phone_number_id.
 *   3. Verifica se é dentista (DEX) → handleDexMessage.
 *   4. Identifica/cria paciente, localiza/cria conversa.
 *   5. processMessage → sendText com resposta.
 *
 * Fluxo por imagem (comprovante PIX):
 *   1. downloadMedia(mediaId) → base64.
 *   2. analyzeReceipt → matchReceiptToOrcamento.
 *   3. Responde com resultado.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { getProvider, sendText } from '@/lib/whatsapp/provider';
import { MetaProvider } from '@/lib/whatsapp/providers/meta';
import { processMessage, type ConversaBot } from '@/lib/whatsapp/message-handler';
import { STATES } from '@/lib/whatsapp/states';
import { verificarDexUser, handleDexMessage } from '@/lib/whatsapp/dex-handler';
import { analyzeReceipt, matchReceiptToOrcamento } from '@/lib/whatsapp/receipt-handler';

// ─── GET — verificação do webhook (Meta chama isso ao configurar) ──────────────

export async function GET(req: NextRequest): Promise<NextResponse> {
  const params = Object.fromEntries(req.nextUrl.searchParams.entries());
  const meta = getProvider() as MetaProvider;
  const challenge = meta.verifyWebhook(params);

  if (challenge) {
    return new NextResponse(challenge, { status: 200 });
  }

  return NextResponse.json({ error: 'Verificação inválida' }, { status: 403 });
}

// ─── POST — mensagens recebidas ────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  // Lê o corpo como texto para validar assinatura antes de parsear
  const rawBody = await req.text();

  // Valida assinatura HMAC-SHA256 (ativa quando WHATSAPP_APP_SECRET estiver definida)
  const signature = req.headers.get('x-hub-signature-256') ?? '';
  const meta = getProvider() as MetaProvider;
  if (!meta.validateSignature(rawBody, signature)) {
    return NextResponse.json({ error: 'Assinatura inválida' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Payload inválido' }, { status: 400 });
  }

  // A Meta exige resposta 200 imediata — processa em background
  // (em produção, use queue/background job para mensagens pesadas)
  const mensagens = meta.parseInbound(body);

  for (const msg of mensagens) {
    try {
      await processarMensagem(msg.phoneNumberId, msg);
    } catch (err) {
      console.error('[webhook] Erro ao processar mensagem:', err);
      // Não lança — Meta reenviaria o webhook
    }
  }

  return NextResponse.json({ ok: true });
}

// ─── Lógica principal ──────────────────────────────────────────────────────────

async function processarMensagem(
  phoneNumberId: string,
  msg: Awaited<ReturnType<MetaProvider['parseInbound']>>[number],
): Promise<void> {
  const numero   = msg.from;
  const pushName = msg.pushName ?? null;

  // ── Imagem → tenta analisar como comprovante PIX ──────────────────────────
  if (msg.type === 'image' && msg.mediaId) {
    const clinicaId = await resolverClinicaPorPhone(phoneNumberId);
    if (!clinicaId) return;

    try {
      const { base64, mimeType } = await getProvider().downloadMedia(msg.mediaId);
      const analysis = await analyzeReceipt(base64, mimeType);
      const db = createServiceClient();
      const result = await matchReceiptToOrcamento(clinicaId, numero, analysis, db);
      await sendText(phoneNumberId, numero, result.mensagem);
    } catch (err) {
      console.error('[webhook/pix] Erro ao processar comprovante:', err);
      // Silencia — não confunde o paciente com erro técnico
    }
    return;
  }

  // ── Extrai texto (texto digitado ou resposta de lista interativa) ──────────
  const texto = msg.type === 'text'
    ? (msg.text ?? '').trim()
    : msg.type === 'interactive_reply'
      ? (msg.selectedRowId ?? '').trim()
      : '';

  if (!texto) return;

  // ── Localiza a clínica pelo phone_number_id ────────────────────────────────
  const clinicaId = await resolverClinicaPorPhone(phoneNumberId);
  if (!clinicaId) {
    console.error(`[webhook] Clínica não encontrada para phone_number_id=${phoneNumberId}`);
    return;
  }

  const db = createServiceClient();

  // ── Modo DEX: intercepta mensagens de dentistas/admins ────────────────────
  const dexDentista = await verificarDexUser(clinicaId, numero, db);
  if (dexDentista) {
    await handleDexMessage(dexDentista, clinicaId, numero, texto, phoneNumberId, db);
    return;
  }

  // ── Dentista principal (para vincular pacientes criados pelo bot) ──────────
  const { data: dentistaPrincipal } = await db
    .from('dentistas')
    .select('id')
    .eq('clinica_id', clinicaId)
    .neq('role', 'secretaria')
    .eq('ativo', true)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  // ── Identifica ou cria paciente ────────────────────────────────────────────
  const { pacienteId, nome: pacienteNome, isNovo: isNovoPaciente } =
    await identificarOuCriarPaciente(clinicaId, numero, pushName, dentistaPrincipal?.id ?? null);

  // ── Localiza ou cria conversa ──────────────────────────────────────────────
  const { data: conversaExistente } = await db
    .from('conversas_bot')
    .select('*')
    .eq('clinica_id', clinicaId)
    .eq('telefone', numero)
    .order('ultimo_contato', { ascending: false })
    .limit(1)
    .maybeSingle();

  let conversa: ConversaBot;

  if (conversaExistente) {
    conversa = conversaExistente as ConversaBot;
    if (!conversa.paciente_id && pacienteId) {
      await db.from('conversas_bot').update({ paciente_id: pacienteId }).eq('id', conversa.id);
      conversa = { ...conversa, paciente_id: pacienteId };
    }
  } else {
    const { data: nova, error } = await db
      .from('conversas_bot')
      .insert({
        clinica_id:  clinicaId,
        telefone:    numero,
        etapa:       STATES.INICIO,
        contexto:    { paciente_nome: pacienteNome, is_novo_paciente: isNovoPaciente },
        paciente_id: pacienteId || null,
        ativo:       true,
      })
      .select()
      .single();

    if (error || !nova) {
      console.error('[webhook] Erro ao criar conversa:', error);
      return;
    }
    conversa = nova as ConversaBot;
  }

  // Bot silencia se transferido para humano
  if (!conversa.ativo) return;

  if (!conversa.contexto?.paciente_nome && pacienteNome) {
    conversa = { ...conversa, contexto: { ...conversa.contexto, paciente_nome: pacienteNome } };
  }

  const resposta = await processMessage(conversa, texto, phoneNumberId);
  if (resposta.texto) {
    await sendText(phoneNumberId, numero, resposta.texto);
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Resolve o clinica_id a partir do phone_number_id da Meta.
 * Busca na coluna whatsapp_phone_number_id da tabela clinicas.
 *
 * TODO: quando múltiplas clínicas tiverem números registrados,
 *       garantir que a coluna existe e tem index único.
 */
async function resolverClinicaPorPhone(phoneNumberId: string): Promise<string | null> {
  // Fallback para desenvolvimento com number ID único no .env
  const envPhoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const envClinicaId = process.env.WHATSAPP_DEFAULT_CLINICA_ID;

  if (envPhoneId && envClinicaId && phoneNumberId === envPhoneId) {
    return envClinicaId;
  }

  // Multi-tenant: busca pelo phone_number_id na tabela clinicas
  const db = createServiceClient();
  const { data } = await db
    .from('clinicas')
    .select('id')
    .eq('whatsapp_phone_number_id', phoneNumberId)
    .maybeSingle();

  return (data?.id as string | null) ?? null;
}

async function identificarOuCriarPaciente(
  clinicaId: string,
  telefone: string,
  pushName: string | null,
  dentistaId: string | null,
): Promise<{ pacienteId: string; nome: string; isNovo: boolean }> {
  const db = createServiceClient();

  const { data: existente } = await db
    .from('pacientes')
    .select('id, nome')
    .eq('clinica_id', clinicaId)
    .eq('telefone', telefone)
    .maybeSingle();

  if (existente) {
    return { pacienteId: existente.id as string, nome: existente.nome as string, isNovo: false };
  }

  const nome = pushName?.trim() || `Paciente ${telefone.slice(-4)}`;

  const { data: novo, error } = await db
    .from('pacientes')
    .insert({ clinica_id: clinicaId, dentista_id: dentistaId, nome, telefone, whatsapp: telefone })
    .select('id')
    .single();

  if (error || !novo) {
    console.error('[webhook] Erro ao criar paciente:', error);
    return { pacienteId: '', nome, isNovo: false };
  }

  return { pacienteId: novo.id as string, nome, isNovo: true };
}
