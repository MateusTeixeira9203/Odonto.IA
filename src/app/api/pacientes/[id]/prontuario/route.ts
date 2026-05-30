import { createClient } from '@/lib/supabase/server';
import { getDentistaCached } from '@/lib/get-dentista';
import {
  buildProntuarioHTML,
  type PacienteExport,
  type FichaExport,
  type OrcamentoExport,
  type AgendamentoExport,
} from '@/lib/prontuario-html';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;

  const dentista = await getDentistaCached();
  if (!dentista) return new Response('Não autorizado', { status: 401 });

  const supabase = await createClient();

  const [
    { data: pacienteRaw },
    { data: fichasRaw },
    { data: orcamentosRaw },
    { data: agendamentosRaw },
  ] = await Promise.all([
    supabase
      .from('pacientes')
      .select('nome, cpf, email, telefone, data_nascimento, endereco, cidade, estado, created_at')
      .eq('id', id)
      .eq('clinica_id', dentista.clinica_id)
      .maybeSingle(),
    supabase
      .from('fichas')
      .select('id, created_at, queixa_principal, anotacoes, dentes_afetados, dentes_observacoes, procedimentos_concluidos, assinatura_url, assinado_em, dentista:dentistas(nome)')
      .eq('paciente_id', id)
      .eq('clinica_id', dentista.clinica_id)
      .order('created_at', { ascending: false }),
    supabase
      .from('orcamentos')
      .select('id, status, total, created_at, condicoes_pagamento, orcamento_itens(descricao, preco_total, quantidade), pagamentos(valor, status, forma_pagamento)')
      .eq('paciente_id', id)
      .eq('clinica_id', dentista.clinica_id)
      .order('created_at', { ascending: false }),
    supabase
      .from('agendamentos')
      .select('data_hora, status, observacoes, dentista:dentistas(nome)')
      .eq('paciente_id', id)
      .eq('clinica_id', dentista.clinica_id)
      .order('data_hora', { ascending: false })
      .limit(30),
  ]);

  if (!pacienteRaw) return new Response('Paciente não encontrado', { status: 404 });

  const html = buildProntuarioHTML(
    pacienteRaw as PacienteExport,
    (fichasRaw ?? []) as unknown as FichaExport[],
    (orcamentosRaw ?? []) as unknown as OrcamentoExport[],
    (agendamentosRaw ?? []) as unknown as AgendamentoExport[],
  );

  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}
