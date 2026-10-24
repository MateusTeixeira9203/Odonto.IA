import { createClient } from '@/lib/supabase/server';
import { getDentistaCached } from '@/lib/get-dentista';
import { acessoPdfPorPapel } from '@/lib/prontuario/acesso-pdf';
import { buildFichaHTML, type FichaComPaciente, type EventoFichaPdf, type EvolucaoFichaExport } from '@/lib/prontuario-html';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;

  const dentista = await getDentistaCached();
  if (!dentista) return new Response('Não autorizado', { status: 401 });

  const acesso = acessoPdfPorPapel(dentista.role);
  if (acesso === 'negado') return new Response('Ficha não encontrada', { status: 404 });
  if (acesso === 'administrativo') return new Response('Sem permissão', { status: 403 });

  const supabase = await createClient();

  const [{ data: fichaRaw }, { data: eventosRaw }, { data: evolucoesRaw, error: evolucoesError }] = await Promise.all([
    supabase
      .from('fichas')
      .select('id, created_at, data_atendimento, queixa_principal, anotacoes, dentes_afetados, dentes_observacoes, procedimentos_concluidos, assinatura_url, assinado_em, origem, dentista:dentistas(nome, cro), paciente:pacientes(nome, data_nascimento)')
      .eq('id', id)
      .eq('clinica_id', dentista.clinica_id)
      .maybeSingle(),
    // v3 §1.10 — eventos do odontograma da ficha (o que a fiscalização pergunta:
    // o quê, onde, situação e a data clínica da execução).
    supabase
      .from('odontograma_eventos')
      .select('tipo, procedimento_nome, status, origem, nivel, arcada, quadrante, dente, faces, observacao, realizado_em, registrado_em')
      .eq('ficha_id', id)
      .eq('clinica_id', dentista.clinica_id)
    .is('retirado_em', null)
      .order('dente', { ascending: true })
      .order('registrado_em', { ascending: true }),
    supabase
      .from('ficha_evolucoes')
      .select('data, texto, automatica')
      .eq('ficha_id', id)
      .eq('clinica_id', dentista.clinica_id)
      .order('data', { ascending: true })
      .order('created_at', { ascending: true }),
  ]);

  if (!fichaRaw) return new Response('Ficha não encontrada', { status: 404 });
  if (evolucoesError) console.error('[ficha/pdf] Erro ao ler evoluções para impressão:', evolucoesError);

  const html = buildFichaHTML(
    {
      ...(fichaRaw as unknown as FichaComPaciente),
      ...(evolucoesError ? {} : { evolucoes: (evolucoesRaw ?? []) as EvolucaoFichaExport[] }),
    },
    (eventosRaw ?? []) as EventoFichaPdf[],
  );

  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}
