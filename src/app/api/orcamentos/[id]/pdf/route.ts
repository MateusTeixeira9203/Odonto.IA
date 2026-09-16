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

  // orcamentos tem 3 FKs pra dentistas (dentista_id, aprovado_por_id,
  // plano_definido_por_id — R-34) — sem desambiguar, o Postgrest devolve 300 (Multiple
  // Choices) em vez do erro real, e `data` vem null. Achado 30/07: a rota nunca gerou um
  // PDF de verdade, mascarado como "não encontrado".
  const { data: raw, error } = await supabase
    .from('orcamentos')
    .select(`
      id, status, total, valor_acordado, desconto, validade_dias, condicoes_pagamento, mostrar_valor_por_item, created_at,
      paciente:pacientes(nome, telefone),
      dentista:dentistas!orcamentos_dentista_id_fkey(nome),
      itens:orcamento_itens(descricao, quantidade, preco_unitario, preco_total, aprovado, composicao),
      pagamentos(valor, status, forma_pagamento, data_pagamento)
    `)
    .eq('id', id)
    .eq('clinica_id', dentista.clinica_id)
    .maybeSingle();

  if (error) return new Response(`Erro ao carregar orçamento: ${error.message}`, { status: 500 });
  if (!raw) return new Response('Orçamento não encontrado', { status: 404 });

  const html = buildOrcamentoHTML(raw as unknown as OrcamentoHtmlData);

  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}
