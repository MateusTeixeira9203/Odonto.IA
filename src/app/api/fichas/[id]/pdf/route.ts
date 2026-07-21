import { createClient } from '@/lib/supabase/server';
import { getDentistaCached } from '@/lib/get-dentista';
import { buildFichaHTML, type FichaComPaciente, type EventoFichaPdf } from '@/lib/prontuario-html';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;

  const dentista = await getDentistaCached();
  if (!dentista) return new Response('Não autorizado', { status: 401 });

  const supabase = await createClient();

  const [{ data: fichaRaw }, { data: eventosRaw }] = await Promise.all([
    supabase
      .from('fichas')
      .select('id, created_at, data_atendimento, queixa_principal, anotacoes, dentes_afetados, dentes_observacoes, procedimentos_concluidos, assinatura_url, assinado_em, dentista:dentistas(nome, cro), paciente:pacientes(nome, data_nascimento)')
      .eq('id', id)
      .eq('clinica_id', dentista.clinica_id)
      .maybeSingle(),
    // v3 §1.10 — eventos do odontograma da ficha (o que a fiscalização pergunta:
    // o quê, onde, situação e a data clínica da execução).
    supabase
      .from('odontograma_eventos')
      .select('tipo, status, origem, dente, faces, observacao, realizado_em, registrado_em')
      .eq('ficha_id', id)
      .eq('clinica_id', dentista.clinica_id)
      .order('dente', { ascending: true })
      .order('registrado_em', { ascending: true }),
  ]);

  if (!fichaRaw) return new Response('Ficha não encontrada', { status: 404 });

  const html = buildFichaHTML(
    fichaRaw as unknown as FichaComPaciente,
    (eventosRaw ?? []) as EventoFichaPdf[],
  );

  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}
