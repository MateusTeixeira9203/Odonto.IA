import { createClient } from '@/lib/supabase/server';
import { getDentistaCached } from '@/lib/get-dentista';
import { buildFichaHTML, type FichaComPaciente } from '@/lib/prontuario-html';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;

  const dentista = await getDentistaCached();
  if (!dentista) return new Response('Não autorizado', { status: 401 });

  const supabase = await createClient();

  const { data: fichaRaw } = await supabase
    .from('fichas')
    .select('id, created_at, queixa_principal, anotacoes, dentes_afetados, dentes_observacoes, procedimentos_concluidos, assinatura_url, assinado_em, dentista:dentistas(nome), paciente:pacientes(nome, data_nascimento)')
    .eq('id', id)
    .eq('clinica_id', dentista.clinica_id)
    .maybeSingle();

  if (!fichaRaw) return new Response('Ficha não encontrada', { status: 404 });

  const html = buildFichaHTML(fichaRaw as unknown as FichaComPaciente);

  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}
