/**
 * receipt-handler.ts
 *
 * Analisa imagens de comprovante PIX enviadas por pacientes via WhatsApp.
 * Usa Gemini Vision para extrair os dados do comprovante e tenta vincular
 * ao orçamento pendente do paciente identificado pelo número de WhatsApp.
 */

import { GoogleGenAI } from '@google/genai';
import type { SupabaseClient } from '@supabase/supabase-js';

export interface ReceiptAnalysis {
  /** Valor total do comprovante em R$ (null se não identificado) */
  valor: number | null;
  /** Data do pagamento em ISO 8601 (null se não identificado) */
  data: string | null;
  /** Nome ou chave PIX do destinatário (null se não identificado) */
  destinatario: string | null;
  /** Confiança da extração: high | medium | low */
  confianca: 'high' | 'medium' | 'low';
  /** Texto bruto extraído do comprovante */
  textoExtraido: string;
}

export type ReceiptMatchResult =
  | { matched: true; orcamentoId: string; valorPago: number; mensagem: string }
  | { matched: false; motivo: string; mensagem: string };

/**
 * Analisa a imagem do comprovante via Gemini Vision.
 * @param imageBase64 - Conteúdo da imagem em base64 (sem prefixo data:)
 * @param mimeType - MIME da imagem (ex: 'image/jpeg')
 */
export async function analyzeReceipt(
  imageBase64: string,
  mimeType: string,
): Promise<ReceiptAnalysis> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY não configurada');

  const ai = new GoogleGenAI({ apiKey });

  const prompt = `Você é um assistente especializado em comprovantes de pagamento PIX brasileiros.
Analise esta imagem e extraia as seguintes informações no formato JSON exato abaixo:

{
  "valor": <número float ou null>,
  "data": "<YYYY-MM-DD ou null>",
  "destinatario": "<nome ou chave PIX do destinatário ou null>",
  "confianca": "<high|medium|low>",
  "textoExtraido": "<transcrição relevante do comprovante>"
}

Regras:
- valor: extraia o valor principal transferido em reais (ex: 250.00 para R$ 250,00). null se não encontrar.
- data: data da transferência no formato YYYY-MM-DD. null se não encontrar.
- destinatario: nome do beneficiário ou chave PIX (CPF/CNPJ/e-mail/telefone). null se não encontrar.
- confianca: "high" se todos os campos foram encontrados, "medium" se parcial, "low" se nenhum.
- textoExtraido: resuma os campos mais relevantes em texto legível.
- Se não for um comprovante PIX, retorne todos os campos como null e confianca como "low".
- Retorne APENAS o JSON, sem markdown.`;

  const response = await ai.models.generateContent({
    model: 'gemini-1.5-flash',
    contents: [
      {
        role: 'user',
        parts: [
          {
            inlineData: {
              mimeType,
              data: imageBase64,
            },
          },
          { text: prompt },
        ],
      },
    ],
  });

  const text = (response.text ?? '').replace(/```(?:json)?/g, '').replace(/```/g, '').trim();

  try {
    const parsed = JSON.parse(text) as {
      valor?: number | null;
      data?: string | null;
      destinatario?: string | null;
      confianca?: string;
      textoExtraido?: string;
    };
    return {
      valor: typeof parsed.valor === 'number' ? parsed.valor : null,
      data: typeof parsed.data === 'string' ? parsed.data : null,
      destinatario: typeof parsed.destinatario === 'string' ? parsed.destinatario : null,
      confianca: (['high', 'medium', 'low'].includes(parsed.confianca ?? '') ? parsed.confianca : 'low') as ReceiptAnalysis['confianca'],
      textoExtraido: parsed.textoExtraido ?? text,
    };
  } catch {
    console.error('[receipt-handler] Gemini não retornou JSON válido:', text);
    return {
      valor: null,
      data: null,
      destinatario: null,
      confianca: 'low',
      textoExtraido: text,
    };
  }
}

/**
 * Tenta vincular o comprovante a um orçamento pendente do paciente.
 * Se encontrar match, registra o pagamento e retorna mensagem de confirmação.
 * Se não encontrar, retorna mensagem pedindo esclarecimento.
 *
 * @param clinicaId  - ID da clínica (multi-tenant)
 * @param telefone   - Número de WhatsApp do remetente (sem @s.whatsapp.net)
 * @param analysis   - Resultado do analyzeReceipt
 * @param db         - Service client do Supabase (bypassa RLS)
 */
export async function matchReceiptToOrcamento(
  clinicaId: string,
  telefone: string,
  analysis: ReceiptAnalysis,
  db: SupabaseClient,
): Promise<ReceiptMatchResult> {
  if (analysis.confianca === 'low' || !analysis.valor) {
    return {
      matched: false,
      motivo: 'confianca_baixa',
      mensagem:
        '🤔 Não consegui ler os dados do comprovante com clareza. Poderia enviar uma foto mais nítida ou informar o valor e data do pagamento?',
    };
  }

  // Localiza o paciente pelo número de WhatsApp
  const { data: paciente } = await db
    .from('pacientes')
    .select('id, nome')
    .eq('clinica_id', clinicaId)
    .eq('whatsapp', telefone)
    .maybeSingle();

  if (!paciente) {
    return {
      matched: false,
      motivo: 'paciente_nao_encontrado',
      mensagem:
        '✅ Comprovante recebido! Vou repassar para a equipe da clínica confirmar o pagamento. Obrigado!',
    };
  }

  // Busca orçamentos pendentes do paciente
  const { data: orcamentos } = await db
    .from('orcamentos')
    .select('id, total, status')
    .eq('clinica_id', clinicaId)
    .eq('paciente_id', paciente.id)
    .in('status', ['pendente', 'aprovado'])
    .order('created_at', { ascending: false })
    .limit(5);

  if (!orcamentos || orcamentos.length === 0) {
    return {
      matched: false,
      motivo: 'sem_orcamentos_pendentes',
      mensagem:
        `✅ Comprovante de R$ ${analysis.valor.toFixed(2)} recebido! Não encontrei orçamentos pendentes associados ao seu número, mas já registrei a confirmação para a equipe. Obrigado, ${paciente.nome}! 😊`,
    };
  }

  // Encontra o orçamento com valor mais próximo (tolerância de R$ 1,00)
  const TOLERANCIA = 1.0;
  const match = orcamentos.find(
    (o) => Math.abs((o.total as number) - analysis.valor!) <= TOLERANCIA,
  );

  if (!match) {
    // Valor não bate — registra para revisão manual
    const valores = orcamentos.map((o) => `R$ ${(o.total as number).toFixed(2)}`).join(', ');
    return {
      matched: false,
      motivo: 'valor_nao_corresponde',
      mensagem:
        `✅ Comprovante de R$ ${analysis.valor.toFixed(2)} recebido! Seus orçamentos registrados são: ${valores}. A equipe vai conferir e te confirmar em breve. Obrigado!`,
    };
  }

  // Registra o pagamento
  const hoje = new Date().toISOString().split('T')[0];
  const { error: pagError } = await db.from('pagamentos').insert({
    orcamento_id: match.id,
    paciente_id: paciente.id,
    clinica_id: clinicaId,
    valor: analysis.valor,
    status: 'pago',
    forma_pagamento: 'pix',
    data_pagamento: analysis.data ?? hoje,
  });

  if (pagError) {
    console.error('[receipt-handler] Erro ao registrar pagamento:', pagError);
    return {
      matched: false,
      motivo: 'erro_db',
      mensagem:
        '✅ Comprovante recebido! Houve uma instabilidade ao registrar automaticamente, mas já avisamos a equipe. Obrigado!',
    };
  }

  // Atualiza o orçamento para aprovado
  await db
    .from('orcamentos')
    .update({ status: 'aprovado' })
    .eq('id', match.id)
    .eq('clinica_id', clinicaId);

  console.log(
    `[receipt-handler] Pagamento PIX R$ ${analysis.valor.toFixed(2)} vinculado ao orçamento ${match.id}`,
  );

  return {
    matched: true,
    orcamentoId: match.id as string,
    valorPago: analysis.valor,
    mensagem:
      `✅ Pagamento de R$ ${analysis.valor.toFixed(2)} confirmado! Seu orçamento foi atualizado. Obrigado, ${paciente.nome}! 🦷`,
  };
}
