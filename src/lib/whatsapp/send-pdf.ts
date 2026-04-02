/**
 * Envio de orçamento via WhatsApp.
 * Gera o PDF em memória (sem HTTP) e envia como documento pela Evolution API.
 */

import { createServiceClient } from '@/lib/supabase/service';
import { gerarPDFOrcamento, type OrcamentoData } from '@/lib/pdf/orcamento';
import { sendWhatsAppFile } from './evolution';

const BRT_OFFSET_H = 3;

// ─── Tipos internos ───────────────────────────────────────────────────────────

interface OrcamentoRow {
  id: string;
  created_at: string;
  validade_dias: number;
  status: string;
  condicoes_pagamento: string | null;
  total: number | null;
  paciente: { nome: string; cpf: string | null; telefone: string | null } | null;
  clinica: { nome: string; endereco: string | null; telefone: string | null } | null;
  dentista: { nome: string; cro: string | null } | null;
  itens: Array<{
    id: string;
    descricao: string | null;
    dente: string | null;
    preco_unitario: number | null;
    quantidade: number;
  }>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function numeroExibivel(id: string): number {
  return parseInt(id.replace(/-/g, '').slice(-4), 16) % 10_000;
}

function calcularValidade(createdAt: string, validadeDias: number): string {
  const d = new Date(createdAt);
  d.setDate(d.getDate() + validadeDias);
  return d.toISOString();
}

function formatarDataBRT(iso: string): string {
  const d = new Date(new Date(iso).getTime() - BRT_OFFSET_H * 3_600_000);
  return d.toLocaleDateString('pt-BR');
}

function montarOrcamentoData(row: OrcamentoRow): OrcamentoData {
  const itens = row.itens ?? [];
  const subtotal = itens.reduce(
    (acc, i) => acc + (i.preco_unitario ?? 0) * i.quantidade,
    0,
  );
  const numero = numeroExibivel(row.id);

  return {
    id:       row.id,
    numero,
    data:     row.created_at,
    validade: calcularValidade(row.created_at, row.validade_dias ?? 30),
    status:   row.status,
    paciente: {
      nome:     row.paciente?.nome    ?? 'Não informado',
      cpf:      row.paciente?.cpf     ?? undefined,
      telefone: row.paciente?.telefone ?? undefined,
    },
    clinica: {
      nome:     row.clinica?.nome     ?? 'Clínica',
      endereco: row.clinica?.endereco ?? undefined,
      telefone: row.clinica?.telefone ?? undefined,
    },
    dentista: {
      nome: row.dentista?.nome ?? 'Dentista',
      cro:  row.dentista?.cro  ?? '',
    },
    procedimentos: itens.map(i => ({
      id:         i.id,
      nome:       i.descricao  ?? 'Procedimento',
      dente:      i.dente      ?? undefined,
      valor:      i.preco_unitario ?? 0,
      quantidade: i.quantidade,
    })),
    subtotal,
    desconto: 0,
    total:    row.total ?? subtotal,
    forma_pagamento: row.condicoes_pagamento ?? undefined,
  };
}

// ─── Função principal ─────────────────────────────────────────────────────────

/**
 * Busca o último orçamento do paciente, gera PDF e envia pelo WhatsApp.
 * Retorna texto de resposta para o bot.
 */
export async function sendOrcamentoWhatsApp(
  numero: string,
  pacienteId: string | null,
  clinicaId: string,
): Promise<string> {
  const instance = process.env.EVOLUTION_DEFAULT_INSTANCE;
  if (!instance) return 'Serviço de envio não configurado. Fale com nossa equipe.';

  const db = createServiceClient();

  // Se não há paciente_id vinculado, tenta encontrar pelo WhatsApp
  let resolvedPacienteId = pacienteId;
  if (!resolvedPacienteId) {
    const { data: pac } = await db
      .from('pacientes')
      .select('id')
      .eq('clinica_id', clinicaId)
      .eq('whatsapp', numero)
      .maybeSingle();

    if (!pac) {
      return (
        'Não encontrei nenhum cadastro vinculado a este número.\n' +
        'Para consultar seu orçamento, fale com nossa equipe.'
      );
    }
    resolvedPacienteId = pac.id as string;
  }

  // Busca último orçamento com todos os relacionamentos
  const { data: row, error } = await db
    .from('orcamentos')
    .select(`
      id, created_at, validade_dias, status, condicoes_pagamento, total,
      paciente:pacientes (nome, cpf, telefone),
      clinica:clinicas (nome, endereco, telefone),
      dentista:dentistas (nome, cro),
      itens:orcamento_itens (id, descricao, dente, preco_unitario, quantidade)
    `)
    .eq('paciente_id', resolvedPacienteId)
    .eq('clinica_id', clinicaId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !row) {
    return 'Não encontrei nenhum orçamento para o seu cadastro ainda. 😊';
  }

  const orcamentoRow = row as unknown as OrcamentoRow;
  const data = montarOrcamentoData(orcamentoRow);
  const dataFormatada = formatarDataBRT(orcamentoRow.created_at);

  // Gera PDF em memória
  let pdfBuffer: Buffer;
  try {
    pdfBuffer = await gerarPDFOrcamento(data);
  } catch (err) {
    console.error('[send-pdf] Erro ao gerar PDF:', err);
    return 'Tive um problema ao gerar o PDF do orçamento. Fale com nossa equipe.';
  }

  const base64   = pdfBuffer.toString('base64');
  const filename = `orcamento-${data.numero}.pdf`;
  const caption  = `Orçamento nº ${data.numero} — emitido em ${dataFormatada}`;

  try {
    await sendWhatsAppFile(instance, numero, base64, filename, caption);
    return `✅ Seu orçamento (nº ${data.numero}) foi enviado como arquivo acima! 📄`;
  } catch (err) {
    console.error('[send-pdf] Erro ao enviar via Evolution API:', err);
    return 'Tive um problema ao enviar o arquivo. Fale com nossa equipe.';
  }
}
