import { createClient } from '@/lib/supabase/server';
import { getDentistaCached } from '@/lib/get-dentista';
import { buildOrcamentoHTML, type OrcamentoHtmlData } from '@/lib/prontuario-html';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;

  const dentista = await getDentistaCached();
  if (!dentista) return new Response('Não autorizado', { status: 401 });

  const supabase = await createClient();

  const { data: raw } = await supabase
    .from('orcamentos')
    .select(`
      id, status, total, desconto, validade_dias, condicoes_pagamento, created_at,
      paciente:pacientes(nome, telefone),
      dentista:dentistas(nome),
      itens:orcamento_itens(descricao, quantidade, preco_unitario, preco_total),
      pagamentos(valor, status, forma_pagamento, data_pagamento)
    `)
    .eq('id', id)
    .eq('clinica_id', dentista.clinica_id)
    .maybeSingle();

  if (!raw) return new Response('Orçamento não encontrado', { status: 404 });

  const html = buildOrcamentoHTML(raw as unknown as OrcamentoHtmlData);

  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}
