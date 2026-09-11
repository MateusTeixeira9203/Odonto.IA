import { createClient } from '@/lib/supabase/server';
import { getDentistaCached } from '@/lib/get-dentista';
import {
  buildProntuarioHTML,
  type PacienteExport,
  type FichaExport,
  type OrcamentoExport,
  type AgendamentoExport,
  type AtendimentoProntuarioExport,
} from '@/lib/prontuario-html';
import { getProntuarioLongitudinal } from '@/server/patients/get-prontuario-longitudinal';
import { TIPO_LABEL } from '@/types/odontograma';

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
      .select('id, created_at, data_atendimento, queixa_principal, anotacoes, dentes_afetados, dentes_observacoes, procedimentos_concluidos, assinatura_url, assinado_em, origem, dentista:dentistas(nome)')
      .eq('paciente_id', id)
      .eq('clinica_id', dentista.clinica_id)
      .order('data_atendimento', { ascending: false }),
    supabase
      .from('orcamentos')
      .select('id, status, total, valor_acordado, desconto, cobrancas:orcamento_cobrancas(desconto, situacao), created_at, condicoes_pagamento, orcamento_itens(descricao, preco_total, quantidade, aprovado), pagamentos(valor, status, forma_pagamento)')
      .eq('paciente_id', id)
      .eq('clinica_id', dentista.clinica_id)
      .order('created_at', { ascending: false }),
    supabase
      .from('agendamentos')
      // R-67: `agendamentos` tem DOIS caminhos pra `dentistas` (dentista_id e
      // created_by). Sem nomear a FK o PostgREST recusa o embed, a query inteira
      // volta vazia e o prontuario exportado sai SEM as consultas.
      .select('data_hora, status, observacoes, dentista:dentistas!agendamentos_dentista_id_fkey(nome)')
      .eq('paciente_id', id)
      .eq('clinica_id', dentista.clinica_id)
      .order('data_hora', { ascending: false })
      .limit(30),
  ]);

  if (!pacienteRaw) return new Response('Paciente não encontrado', { status: 404 });

  const longitudinal = await getProntuarioLongitudinal({ patientId: id, clinicId: dentista.clinica_id });
  const nomeFicha = new Map(longitudinal.atendimentos.flatMap((atendimento) => (
    atendimento.fichas.map((ficha) => [ficha.id, ficha.nome] as const)
  )));
  const atendimentosExport: AtendimentoProntuarioExport[] = longitudinal.atendimentos.map((atendimento) => ({
    data: atendimento.dataAtendimento,
    fonte: atendimento.fonte,
    profissionalNome: atendimento.profissional.nome,
    evolucoes: atendimento.evolucoes.map((evolucao) => ({
      fichaNome: nomeFicha.get(evolucao.fichaId) ?? 'Evolução clínica',
      texto: evolucao.texto,
    })),
    procedimentos: atendimento.eventos.map((evento) => ({
      nome: evento.procedimentoNome?.trim() || TIPO_LABEL[evento.tipo],
      localizacao: evento.ancora.dente != null
        ? `Dente ${evento.ancora.dente}`
        : evento.ancora.quadrante != null
          ? `Quadrante ${evento.ancora.quadrante}`
          : evento.ancora.arcada != null
            ? `Arcada ${evento.ancora.arcada}`
            : evento.ancora.nivel === 'boca'
              ? 'Boca toda'
              : 'Sem localização registrada',
      status: evento.status,
    })),
  }));

  const html = buildProntuarioHTML(
    pacienteRaw as PacienteExport,
    (fichasRaw ?? []) as unknown as FichaExport[],
    (orcamentosRaw ?? []) as unknown as OrcamentoExport[],
    (agendamentosRaw ?? []) as unknown as AgendamentoExport[],
    atendimentosExport,
  );

  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}
