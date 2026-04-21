/**
 * POST /api/whatsapp/webhook
 *
 * Recebe eventos da Evolution API, processa mensagens recebidas e
 * responde via WhatsApp usando o fluxo de List Messages.
 *
 * Segurança: valida o header `apikey` contra EVOLUTION_API_KEY.
 *
 * Fluxo por mensagem:
 *   1. Valida autenticação e filtra eventos irrelevantes.
 *   2. Extrai número + texto (texto OU selectedRowId da list message).
 *   3. Localiza a clínica via instância ou variável de ambiente.
 *   4. Identifica/cria paciente em `pacientes` usando pushName.
 *   5. Localiza/cria conversa em `conversas_bot`.
 *   6. Chama processMessage (que envia list messages diretamente quando necessário).
 *   7. Se processMessage retornar texto, envia via WhatsApp texto.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { sendWhatsAppText } from '@/lib/whatsapp/evolution';
import { mapEvolutionStatus } from '@/lib/whatsapp/evolution-admin';
import { processMessage, type ConversaBot } from '@/lib/whatsapp/message-handler';
import { STATES } from '@/lib/whatsapp/states';
import { verificarDexUser, handleDexMessage } from '@/lib/whatsapp/dex-handler';
import { analyzeReceipt, matchReceiptToOrcamento } from '@/lib/whatsapp/receipt-handler';

// ─── Tipos do payload Evolution API ──────────────────────────────────────────

interface EvolutionWebhookPayload {
  event: string;
  instance: string;
  data: {
    key: {
      remoteJid: string;
      fromMe?: boolean;
      id?: string;
    };
    pushName?: string;
    messageType?: string;
    message?: {
      conversation?: string;
      extendedTextMessage?: { text: string };
      listResponseMessage?: {
        title?: string;
        singleSelectReply?: { selectedRowId: string };
      };
      /** Mensagem de imagem (ex: comprovante PIX) */
      imageMessage?: {
        url?: string;
        /** Base64 da imagem, quando disponível via webhook */
        base64?: string;
        mimetype?: string;
        caption?: string;
      };
    };
    /** Base64 da mídia, presente em alguns modos de webhook da Evolution API */
    mediaBase64?: string;
    /** MIME type da mídia */
    mediaMimetype?: string;
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extrairNumero(remoteJid: string): string {
  return remoteJid.replace('@s.whatsapp.net', '').replace('@g.us', '');
}

/**
 * Extrai o texto da mensagem.
 * Para list responses, retorna o selectedRowId (tratado como input pela máquina de estados).
 */
function extrairTexto(payload: EvolutionWebhookPayload): string | null {
  const msg = payload.data?.message;
  if (!msg) return null;

  // List response — retorna o rowId selecionado
  const rowId = msg.listResponseMessage?.singleSelectReply?.selectedRowId;
  if (rowId) return rowId;

  // Texto simples
  return msg.conversation ?? msg.extendedTextMessage?.text ?? null;
}

// ─── Identificação de paciente ────────────────────────────────────────────────

/**
 * Localiza o paciente pelo número de WhatsApp.
 * Se não existir, cria com o pushName fornecido e vincula ao dentista principal da clínica.
 * Retorna nome, id e se o paciente é novo (isNovo = true → msg_novo_paciente).
 */
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

// ─── Handler principal ────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  // Valida autenticação do webhook
  const apiKey = req.headers.get('apikey');
  if (apiKey !== process.env.EVOLUTION_API_KEY) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  let payload: EvolutionWebhookPayload;
  try {
    payload = await req.json() as EvolutionWebhookPayload;
  } catch {
    return NextResponse.json({ error: 'Payload inválido' }, { status: 400 });
  }

  const evento = payload.event?.toLowerCase().replace('.', '_');

  // ── connection.update → atualiza status da instância no banco ──────────────
  if (evento === 'connection_update') {
    const rawState =
      (payload.data as Record<string, unknown>).state as string | undefined ??
      (payload.data as Record<string, unknown>).connection as string | undefined;

    if (rawState && payload.instance) {
      const db  = createServiceClient();
      const status = mapEvolutionStatus(rawState);
      await db
        .from('instancias_whatsapp')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('instance_name', payload.instance);
    }
    return NextResponse.json({ ok: true });
  }

  // Processa apenas mensagens recebidas
  if (evento !== 'messages_upsert' || payload.data?.key?.fromMe) {
    return NextResponse.json({ ok: true });
  }

  const numero   = extrairNumero(payload.data.key.remoteJid);
  const instance = payload.instance;
  const pushName = payload.data.pushName ?? null;

  // ── Imagem recebida → tenta analisar como comprovante PIX ─────────────────
  if (payload.data.messageType === 'imageMessage') {
    // A Evolution API pode entregar a mídia como base64 em campos distintos
    const imageBase64 =
      payload.data.mediaBase64 ??
      payload.data.message?.imageMessage?.base64 ??
      null;

    const mimeType =
      payload.data.mediaMimetype ??
      payload.data.message?.imageMessage?.mimetype ??
      'image/jpeg';

    const clinicaId = process.env.EVOLUTION_DEFAULT_CLINICA_ID;

    if (imageBase64 && clinicaId) {
      try {
        const analysis = await analyzeReceipt(imageBase64, mimeType);
        const db = createServiceClient();
        const result = await matchReceiptToOrcamento(clinicaId, numero, analysis, db);
        await sendWhatsAppText(instance, numero, result.mensagem);
        console.log(
          `[webhook/receipt] Comprovante processado — matched=${result.matched}, numero=${numero}`,
        );
      } catch (err) {
        console.error('[webhook/receipt] Erro ao processar comprovante:', err);
        // Não envia mensagem de erro para não confundir o paciente
      }
    } else {
      // Sem base64 disponível — apenas acusa recebimento
      await sendWhatsAppText(
        instance,
        numero,
        '✅ Imagem recebida! Nossa equipe irá verificar o comprovante em breve. Obrigado!',
      );
    }
    return NextResponse.json({ ok: true });
  }
  // ─────────────────────────────────────────────────────────────────────────

  const texto = extrairTexto(payload);
  if (!texto?.trim()) {
    return NextResponse.json({ ok: true });
  }

  // Localiza a clínica — MVP usa variável de ambiente
  const clinicaId = process.env.EVOLUTION_DEFAULT_CLINICA_ID;
  if (!clinicaId) {
    console.error('[webhook] EVOLUTION_DEFAULT_CLINICA_ID não definida');
    return NextResponse.json({ error: 'Clínica não configurada' }, { status: 500 });
  }

  const db = createServiceClient();

  // ── Modo DEX: intercepta mensagens de dentistas/admins ────────────────────
  const dexDentista = await verificarDexUser(clinicaId, numero, db);
  if (dexDentista) {
    try {
      await handleDexMessage(dexDentista, clinicaId, numero, texto, instance, db);
    } catch (err) {
      console.error('[webhook/dex] Erro ao processar mensagem DEX:', err);
    }
    return NextResponse.json({ ok: true });
  }
  // ─────────────────────────────────────────────────────────────────────────

  // Dentista principal da clínica (o mais antigo que não seja secretária)
  // usado para vincular pacientes criados automaticamente pelo bot
  const { data: dentistaPrincipal } = await db
    .from('dentistas')
    .select('id')
    .eq('clinica_id', clinicaId)
    .neq('role', 'secretaria')
    .eq('ativo', true)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  // Identifica ou cria o paciente pelo número de WhatsApp
  const { pacienteId, nome: pacienteNome, isNovo: isNovoPaciente } = await identificarOuCriarPaciente(
    clinicaId,
    numero,
    pushName,
    dentistaPrincipal?.id ?? null,
  );

  // Localiza conversa ativa ou cria nova
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

    // Atualiza paciente_id se ainda não vinculado
    if (!conversa.paciente_id && pacienteId) {
      await db
        .from('conversas_bot')
        .update({ paciente_id: pacienteId })
        .eq('id', conversa.id);
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
      return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
    }
    conversa = nova as ConversaBot;
  }

  // Conversa transferida para humano — bot silencia
  if (!conversa.ativo) {
    return NextResponse.json({ ok: true });
  }

  // Garante que o nome do paciente esteja no contexto para saudações
  if (!conversa.contexto?.paciente_nome && pacienteNome) {
    conversa = {
      ...conversa,
      contexto: { ...conversa.contexto, paciente_nome: pacienteNome },
    };
  }

  try {
    const resposta = await processMessage(conversa, texto, instance);

    // Texto não vazio = processMessage não enviou diretamente (ex: confirmação)
    if (resposta.texto) {
      await sendWhatsAppText(instance, numero, resposta.texto);
    }
  } catch (err) {
    console.error('[webhook] Erro ao processar/enviar mensagem:', err);
    // Retorna 200 para Evolution API não reenviar o webhook
  }

  return NextResponse.json({ ok: true });
}
