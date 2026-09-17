import 'server-only';

import { createClient } from '@/lib/supabase/server';
import { nomeTratamentoDerivado } from '@/lib/ficha/nome-tratamento';
import { eventosDaVisita } from '@/lib/prontuario/eventos-da-visita';
import type { OdontogramaEventoDraft, OrtoManutencaoInfo } from '@/types/odontograma';
import {
  projetarFichasProntuario,
  type ProntuarioFicha,
} from '@/server/patients/projetar-fichas-prontuario';

export type FonteProntuario = 'moderna' | 'evolucao_legada' | 'ficha_legada';

export type ProntuarioProfissional = {
  id: string;
  nome: string;
  cro: string | null;
};

export type ProntuarioEvolucao = {
  id: string;
  fichaId: string;
  texto: string | null;
  automatica: boolean;
  data: string;
  profissional: ProntuarioProfissional;
};

export type ProntuarioEvento = OdontogramaEventoDraft & {
  fichaId: string | null;
  /** Captura que acrescentou o evento depois da visita original, quando houver. */
  capturaId?: string | null;
  /** Retirada preserva o histórico; a ficha ativa a exclui. */
  retiradoEm?: string | null;
  dentistaId: string;
  autorOriginal: ProntuarioProfissional;
  /** Profissional que assumiu a responsabilidade clínica após encaminhamento. */
  responsavelEncaminhado: ProntuarioProfissional | null;
  atualizadoEm: string;
  /**
   * Auditoria de uma alteração de encaminhamento. Não é a data clínica do
   * procedimento nem substitui a autoria original do evento.
   */
  ultimaAlteracao: {
    atorId: string | null;
    atorNome: string | null;
    alteradoEm: string;
    acao: 'encaminhado' | 'encaminhamento_removido' | 'detalhe_alterado' | 'marcado_realizado' | 'reaberto';
  } | null;
};

export type ProntuarioDocumento = {
  id: string;
  fichaId: string;
  tipo: 'orcamento' | 'tcle' | 'conclusao_procedimento';
  assinadoEm: string;
  /** Eventos clínicos congelados no documento; permite mostrar o PDF na consulta exata. */
  eventoIds: string[];
};

export type ProntuarioAtendimento = {
  id: string;
  fonte: FonteProntuario;
  atendimentoId: string | null;
  dataAtendimento: string;
  criadoEm: string;
  estado: 'preparando' | 'finalizado' | 'falhou' | 'legado';
  origem: 'meu_dia' | 'ficha' | 'importado' | 'legado';
  profissional: ProntuarioProfissional;
  fichaIds: string[];
  fichas: Array<{
    id: string;
    nome: string;
    status: string;
    assinaturaUrl: string | null;
    assinadoEm: string | null;
    ortoManutencao: OrtoManutencaoInfo | null;
    responsavel: ProntuarioProfissional;
  }>;
  evolucoes: ProntuarioEvolucao[];
  eventos: ProntuarioEvento[];
  retorno: {
    id: string;
    dataHora: string;
    status: string;
    dentistaNome: string | null;
  } | null;
  /** Só documentos com vínculo explícito a uma Ficha entram na visita. */
  documentos: ProntuarioDocumento[];
};

export type ProntuarioLongitudinalData = {
  atendimentos: ProntuarioAtendimento[];
  fichas: ProntuarioFicha[];
  boca: OdontogramaEventoDraft[];
  profissionaisClinicos: ProntuarioProfissional[];
  /** Falhas de uma fonte não podem transformar o restante do prontuário em lista vazia. */
  errosParciais: string[];
};

type AtendimentoRaw = {
  id: string;
  dentista_id: string;
  data_atendimento: string;
  origem: 'meu_dia' | 'ficha' | 'importado' | 'legado';
  estado: 'preparando' | 'finalizado' | 'falhou';
  created_at: string;
};

type FichaRaw = {
  id: string;
  dentista_id: string;
  data_atendimento: string;
  created_at: string;
  nome: string | null;
  anotacoes: string | null;
  procedimentos: string[] | null;
  dentes_afetados: number[] | null;
  status: string;
  origem: 'modo_consulta' | 'manual' | 'importado';
  assinatura_url: string | null;
  assinado_em: string | null;
  orto_manutencao: OrtoManutencaoInfo | null;
};

type EvolucaoRaw = {
  id: string;
  ficha_id: string;
  atendimento_id: string | null;
  dentista_id: string;
  data: string;
  texto: string | null;
  automatica: boolean;
};

type EventoRaw = {
  id: string;
  ficha_id: string | null;
  captura_id: string | null;
  retirado_em: string | null;
  dentista_id: string;
  tipo: OdontogramaEventoDraft['tipo'];
  procedimento_id: string | null;
  procedimento_nome: string | null;
  status: OdontogramaEventoDraft['status'];
  origem: OdontogramaEventoDraft['origem'];
  momento_planejado: OdontogramaEventoDraft['momento_planejado'];
  nivel: OdontogramaEventoDraft['ancora']['nivel'];
  arcada: 'superior' | 'inferior' | null;
  quadrante: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | null;
  dente: number | null;
  faces: Array<'O' | 'M' | 'D' | 'V' | 'L'> | null;
  grupo_id: string | null;
  papel_no_grupo: 'pilar' | 'pontico' | null;
  observacao: string | null;
  detalhe: unknown | null;
  realizado_em: string | null;
  registrado_em: string;
  created_at: string;
  assinatura_id: string | null;
  encaminhado_para: string | null;
};

type AtendimentoEventoRaw = {
  atendimento_id: string;
  evento_id: string;
};

type DentistaRaw = {
  id: string;
  nome: string;
  cro: string | null;
  role: string;
  ativo: boolean;
};

type DocumentoRaw = {
  id: string;
  ficha_id: string | null;
  assinatura_id: string | null;
  tipo: ProntuarioDocumento['tipo'];
  assinado_em: string;
  conteudo_snapshot: unknown;
};

type ActivityLogRaw = {
  actor_id: string | null;
  actor_nome: string | null;
  entity_id: string | null;
  action: string;
  created_at: string;
};

type RetornoRaw = {
  id: string;
  atendimento_origem_id: string | null;
  data_hora: string;
  status: string;
  dentista: { nome: string } | null;
};

const acoesDeEncaminhamento = {
  'odontograma_evento.encaminhado': 'encaminhado',
  'odontograma_evento.encaminhamento_removido': 'encaminhamento_removido',
  'odontograma_evento.detalhe_alterado': 'detalhe_alterado',
  'odontograma_evento.marcado_realizado': 'marcado_realizado',
  'odontograma_evento.reaberto': 'reaberto',
} as const;

type AcaoDeEncaminhamento = typeof acoesDeEncaminhamento[keyof typeof acoesDeEncaminhamento];

const profissionalDesconhecido: ProntuarioProfissional = {
  id: 'legado', nome: 'Profissional não identificado', cro: null,
};

function paraEvento(
  raw: EventoRaw,
  ultimaAlteracao: ProntuarioEvento['ultimaAlteracao'],
  autorOriginal: ProntuarioProfissional,
  responsavelEncaminhado: ProntuarioProfissional | null,
): ProntuarioEvento {
  const ancora: OdontogramaEventoDraft['ancora'] = { nivel: raw.nivel };
  if (raw.arcada) ancora.arcada = raw.arcada;
  if (raw.quadrante) ancora.quadrante = raw.quadrante;
  if (raw.dente) ancora.dente = raw.dente;
  if (raw.faces?.length) ancora.faces = raw.faces;

  return {
    id: raw.id,
    fichaId: raw.ficha_id,
    capturaId: raw.captura_id,
    retiradoEm: raw.retirado_em,
    dentistaId: raw.dentista_id,
    autorOriginal,
    responsavelEncaminhado,
    tipo: raw.tipo,
    procedimentoId: raw.procedimento_id,
    procedimentoNome: raw.procedimento_nome,
    status: raw.status,
    origem: raw.origem,
    momento_planejado: raw.momento_planejado,
    ancora,
    grupo_id: raw.grupo_id,
    papel_no_grupo: raw.papel_no_grupo,
    observacao: raw.observacao ?? '',
    detalhe: raw.detalhe,
    realizado_em: raw.realizado_em,
    registrado_em: raw.registrado_em,
    created_at: raw.created_at,
    assinaturaId: raw.assinatura_id,
    encaminhadoParaId: raw.encaminhado_para,
    atualizadoEm: raw.registrado_em,
    ultimaAlteracao,
  };
}

function mapaDeListas<T>(items: T[], key: (item: T) => string | null): Map<string, T[]> {
  const result = new Map<string, T[]>();
  for (const item of items) {
    const id = key(item);
    if (!id) continue;
    result.set(id, [...(result.get(id) ?? []), item]);
  }
  return result;
}

function idsDeEventosDoSnapshot(snapshot: unknown): string[] {
  if (!snapshot || typeof snapshot !== 'object' || !('eventoIds' in snapshot)) return [];
  const eventoIds = (snapshot as { eventoIds?: unknown }).eventoIds;
  if (!Array.isArray(eventoIds)) return [];

  return eventoIds.flatMap((item) => {
    if (typeof item === 'string') return [item];
    if (item && typeof item === 'object' && 'id' in item && typeof item.id === 'string') {
      return [item.id];
    }
    return [];
  });
}

/**
 * Projeção de leitura do prontuário. Não altera nenhuma fonte clínica: atendimento moderno
 * vence; fichas sem âncora continuam visíveis como legado, em vez de sumirem da linha do tempo.
 */
export async function getProntuarioLongitudinal({
  patientId,
  clinicId,
}: {
  patientId: string;
  clinicId: string;
}): Promise<ProntuarioLongitudinalData> {
  const supabase = await createClient();
  const [atendimentosResult, fichasResult, eventosResult, dentistasResult, documentosResult] = await Promise.all([
    supabase
      .from('atendimentos_clinicos')
      .select('id, dentista_id, data_atendimento, origem, estado, created_at')
      .eq('clinica_id', clinicId)
      .eq('paciente_id', patientId)
      .order('data_atendimento', { ascending: false })
      .order('created_at', { ascending: false }),
    supabase
      .from('fichas')
      .select('id, dentista_id, data_atendimento, created_at, nome, anotacoes, procedimentos, dentes_afetados, status, origem, assinatura_url, assinado_em, orto_manutencao')
      .eq('clinica_id', clinicId)
      .eq('paciente_id', patientId)
      .order('data_atendimento', { ascending: false })
      .order('created_at', { ascending: false }),
    supabase
      .from('odontograma_eventos')
      .select('id, ficha_id, captura_id, retirado_em, dentista_id, tipo, procedimento_id, procedimento_nome, status, origem, momento_planejado, nivel, arcada, quadrante, dente, faces, grupo_id, papel_no_grupo, observacao, detalhe, realizado_em, registrado_em, created_at, assinatura_id, encaminhado_para')
      .eq('clinica_id', clinicId)
      .eq('paciente_id', patientId)
      .order('registrado_em', { ascending: false }),
    supabase
      .from('dentistas')
      .select('id, nome, cro, role, ativo')
      .eq('clinica_id', clinicId),
    supabase
      .from('documentos_aceite')
      .select('id, ficha_id, assinatura_id, tipo, assinado_em, conteudo_snapshot')
      .eq('clinica_id', clinicId)
      .eq('paciente_id', patientId),
  ]);

  // `ficha_evolucoes` pertence ao paciente por meio de `fichas`; a tabela não possui
  // `paciente_id`. Primeiro delimitamos as fichas já filtradas por clínica + paciente e
  // só então buscamos suas evoluções, sem ampliar o escopo multi-tenant da leitura.
  const fichaIdsDoPaciente = ((fichasResult.data as FichaRaw[] | null) ?? []).map((ficha) => ficha.id);
  const evolucoesResult = fichaIdsDoPaciente.length > 0
    ? await supabase
        .from('ficha_evolucoes')
        .select('id, ficha_id, atendimento_id, dentista_id, data, texto, automatica')
        .eq('clinica_id', clinicId)
        .in('ficha_id', fichaIdsDoPaciente)
        .order('data', { ascending: false })
    : { data: [] as EvolucaoRaw[], error: null };

  if (atendimentosResult.error) console.error('[getProntuarioLongitudinal:atendimentos]', atendimentosResult.error.message);
  if (fichasResult.error) console.error('[getProntuarioLongitudinal:fichas]', fichasResult.error.message);
  if (evolucoesResult.error) console.error('[getProntuarioLongitudinal:evolucoes]', evolucoesResult.error.message);
  if (eventosResult.error) console.error('[getProntuarioLongitudinal:eventos]', eventosResult.error.message);
  if (documentosResult.error) console.error('[getProntuarioLongitudinal:documentos]', documentosResult.error.message);

  const errosParciais = [
    atendimentosResult.error && 'atendimentos',
    fichasResult.error && 'fichas',
    evolucoesResult.error && 'evoluções',
    eventosResult.error && 'procedimentos',
    documentosResult.error && 'documentos',
  ].filter((fonte): fonte is string => Boolean(fonte));

  const atendimentos = (atendimentosResult.data as AtendimentoRaw[] | null) ?? [];
  const fichas = (fichasResult.data as FichaRaw[] | null) ?? [];
  const evolucoes = (evolucoesResult.data as EvolucaoRaw[] | null) ?? [];
  const profissionais = new Map(
    ((dentistasResult.data as DentistaRaw[] | null) ?? []).map((dentista) => [dentista.id, dentista]),
  );
  const eventosRaw = (eventosResult.data as EventoRaw[] | null) ?? [];
  const idsEvento = eventosRaw.map((evento) => evento.id);
  const auditoriaResult = idsEvento.length > 0
    ? await supabase
        .from('activity_logs')
        .select('actor_id, actor_nome, entity_id, action, created_at')
        .eq('clinica_id', clinicId)
        .eq('paciente_id', patientId)
        .eq('entity_type', 'odontograma_evento')
        .in('entity_id', idsEvento)
        .order('created_at', { ascending: false })
    : { data: [] as ActivityLogRaw[], error: null };
  if (auditoriaResult.error) console.error('[getProntuarioLongitudinal:auditoria]', auditoriaResult.error.message);
  if (auditoriaResult.error) errosParciais.push('histórico de alterações');

  const ultimaAlteracaoPorEvento = new Map<string, ProntuarioEvento['ultimaAlteracao']>();
  for (const log of (auditoriaResult.data as ActivityLogRaw[] | null) ?? []) {
    if (!log.entity_id || ultimaAlteracaoPorEvento.has(log.entity_id)) continue;
    const acao = acoesDeEncaminhamento[log.action as keyof typeof acoesDeEncaminhamento] as AcaoDeEncaminhamento | undefined;
    if (!acao) continue;
    ultimaAlteracaoPorEvento.set(log.entity_id, {
      atorId: log.actor_id,
      atorNome: log.actor_nome,
      alteradoEm: log.created_at,
      acao,
    });
  }
  const eventos = eventosRaw.map((evento) => paraEvento(
    evento,
    ultimaAlteracaoPorEvento.get(evento.id) ?? null,
    profissionais.get(evento.dentista_id) ?? profissionalDesconhecido,
    evento.encaminhado_para ? profissionais.get(evento.encaminhado_para) ?? profissionalDesconhecido : null,
  ));
  const eventosAtivos = eventos.filter((evento) => evento.retiradoEm == null);
  const eventosPorAssinatura = mapaDeListas(eventos, (evento) => evento.assinaturaId ?? null);
  const documentos = ((documentosResult.data as DocumentoRaw[] | null) ?? [])
    .flatMap((documento): ProntuarioDocumento[] => documento.ficha_id ? [{
      id: documento.id,
      fichaId: documento.ficha_id,
      tipo: documento.tipo,
      assinadoEm: documento.assinado_em,
      eventoIds: [...new Set([
        ...idsDeEventosDoSnapshot(documento.conteudo_snapshot),
        ...(documento.assinatura_id
          ? (eventosPorAssinatura.get(documento.assinatura_id) ?? []).map((evento) => evento.id)
          : []),
      ])],
    }] : []);
  const fichaPorId = new Map(fichas.map((ficha) => [ficha.id, ficha]));
  const evolucoesPorAtendimento = mapaDeListas(evolucoes, (evolucao) => evolucao.atendimento_id);
  const evolucoesPorFicha = mapaDeListas(evolucoes, (evolucao) => evolucao.ficha_id);
  const eventosAtivosPorFicha = mapaDeListas(eventosAtivos, (evento) => evento.fichaId);
  // A visita é um recorte histórico: inclusões posteriores por captura pertencem à Ficha,
  // não à visita legada que por acaso a originou. Eventos retirados continuam aqui para
  // preservar esse histórico, e continuam disponíveis por vínculo explícito acima.
  const eventosHistoricosPorFicha = mapaDeListas(
    eventos.filter((evento) => evento.capturaId == null),
    (evento) => evento.fichaId,
  );
  const documentosPorFicha = mapaDeListas(documentos, (documento) => documento.fichaId);

  const idsAtendimento = atendimentos.map((atendimento) => atendimento.id);
  const [atendimentoEventosResult, retornosResult] = await Promise.all([
    idsAtendimento.length > 0
      ? supabase
        .from('atendimento_eventos')
        .select('atendimento_id, evento_id')
        .eq('clinica_id', clinicId)
        .in('atendimento_id', idsAtendimento)
      : Promise.resolve({ data: [] as AtendimentoEventoRaw[], error: null }),
    idsAtendimento.length > 0
      ? supabase
        .from('agendamentos')
        .select('id, atendimento_origem_id, data_hora, status, dentista:dentistas!agendamentos_dentista_id_fkey(nome)')
        .eq('clinica_id', clinicId)
        .eq('paciente_id', patientId)
        .in('atendimento_origem_id', idsAtendimento)
        .order('data_hora', { ascending: true })
      : Promise.resolve({ data: [] as RetornoRaw[], error: null }),
  ]);
  if (atendimentoEventosResult.error) console.error('[getProntuarioLongitudinal:relacoes]', atendimentoEventosResult.error.message);
  const retornoAindaSemMigration = retornosResult.error?.code === '42703'
    && retornosResult.error.message.includes('atendimento_origem_id');
  // Durante a implantação aditiva do R-140c, a ausência esperada da coluna degrada
  // somente o vínculo do retorno. Não deve acionar o overlay de erro do Next nem impedir
  // o restante do prontuário; a própria tela continua informando a fonte indisponível.
  if (retornosResult.error && !retornoAindaSemMigration) {
    console.error('[getProntuarioLongitudinal:retornos]', retornosResult.error.message);
  }
  if (atendimentoEventosResult.error) errosParciais.push('vínculos dos procedimentos');
  if (retornosResult.error) errosParciais.push('retornos');
  const eventoPorId = new Map(eventos.map((evento) => [evento.id, evento]));
  const linksPorAtendimento = mapaDeListas(
    (atendimentoEventosResult.data as AtendimentoEventoRaw[] | null) ?? [],
    (link) => link.atendimento_id,
  );
  const retornoPorAtendimento = new Map(
    ((retornosResult.data as RetornoRaw[] | null) ?? [])
      .flatMap((retorno) => retorno.atendimento_origem_id ? [[retorno.atendimento_origem_id, {
        id: retorno.id,
        dataHora: retorno.data_hora,
        status: retorno.status,
        dentistaNome: retorno.dentista?.nome ?? null,
      }] as const] : []),
  );

  const fichasUsadasPorAtendimento = new Set<string>();
  const fichasComFallbackConsumido = new Set<string>();
  const nomeDaFicha = (ficha: FichaRaw): string => (
    ficha.nome ?? nomeTratamentoDerivado(eventosAtivosPorFicha.get(ficha.id) ?? [])
  );
  const modernos = atendimentos.map<ProntuarioAtendimento>((atendimento) => {
    const evolucoesDaVisita = evolucoesPorAtendimento.get(atendimento.id) ?? [];
    const linksDaVisita = linksPorAtendimento.get(atendimento.id) ?? [];
    const fichaIdsDasEvolucoes = evolucoesDaVisita.map((evolucao) => evolucao.ficha_id);
    // Atendimentos existentes antes de `atendimento_eventos` podem já ter a evolução
    // vinculada, mas ainda não as relações dos eventos. Nesse caso, usa os eventos da ficha
    // da visita uma vez; quando existe relação explícita, ela sempre vence.
    const eventosProjetados = eventosDaVisita({
      links: linksDaVisita,
      eventosPorId: eventoPorId,
      fichaIds: fichaIdsDasEvolucoes,
      fichasComFallbackConsumido,
      eventosPorFicha: eventosHistoricosPorFicha,
    });
    const fichaIds = [...new Set([
      ...fichaIdsDasEvolucoes,
      ...eventosProjetados.flatMap((evento) => evento.fichaId ? [evento.fichaId] : []),
    ])];
    fichaIds.forEach((id) => fichasUsadasPorAtendimento.add(id));
    const profissional = profissionais.get(atendimento.dentista_id) ?? profissionalDesconhecido;

    return {
      id: atendimento.id,
      fonte: 'moderna',
      atendimentoId: atendimento.id,
      dataAtendimento: atendimento.data_atendimento,
      criadoEm: atendimento.created_at,
      estado: atendimento.estado,
      origem: atendimento.origem,
      profissional,
      fichaIds,
      fichas: fichaIds.flatMap((id) => {
        const ficha = fichaPorId.get(id);
        if (!ficha) return [];
        return [{
          id: ficha.id,
          nome: nomeDaFicha(ficha),
          status: ficha.status,
          assinaturaUrl: ficha.assinatura_url,
          assinadoEm: ficha.assinado_em,
          ortoManutencao: ficha.orto_manutencao,
          responsavel: profissionais.get(ficha.dentista_id) ?? profissionalDesconhecido,
        }];
      }),
      evolucoes: evolucoesDaVisita.map((evolucao) => ({
        id: evolucao.id,
        fichaId: evolucao.ficha_id,
        texto: evolucao.texto,
        automatica: evolucao.automatica,
        data: evolucao.data,
        profissional: profissionais.get(evolucao.dentista_id) ?? profissionalDesconhecido,
      })),
      eventos: eventosProjetados,
      retorno: retornoPorAtendimento.get(atendimento.id) ?? null,
      documentos: fichaIds.flatMap((fichaId) => {
        const idsEventoDaVisita = new Set(
          eventosProjetados
            .filter((evento) => evento.fichaId === fichaId)
            .map((evento) => evento.id),
        );
        return (documentosPorFicha.get(fichaId) ?? []).filter((documento) => (
          documento.eventoIds.some((eventoId) => idsEventoDaVisita.has(eventoId))
        ));
      }),
    };
  });

  const legados = fichas
    .filter((ficha) => !fichasUsadasPorAtendimento.has(ficha.id))
    .map<ProntuarioAtendimento>((ficha) => {
      const evolucoesDaFicha = evolucoesPorFicha.get(ficha.id) ?? [];
      const profissional = profissionais.get(ficha.dentista_id) ?? profissionalDesconhecido;
      return {
        id: `legado:${ficha.id}`,
        fonte: evolucoesDaFicha.length > 0 ? 'evolucao_legada' : 'ficha_legada',
        atendimentoId: null,
        dataAtendimento: ficha.data_atendimento,
        criadoEm: ficha.created_at,
        estado: 'legado',
        origem: ficha.origem === 'importado' ? 'importado' : 'legado',
        profissional,
        fichaIds: [ficha.id],
        fichas: [{
          id: ficha.id,
          nome: nomeDaFicha(ficha),
          status: ficha.status,
          assinaturaUrl: ficha.assinatura_url,
          assinadoEm: ficha.assinado_em,
          ortoManutencao: ficha.orto_manutencao,
          responsavel: profissional,
        }],
        evolucoes: (evolucoesDaFicha.length > 0 ? evolucoesDaFicha : [{
          id: `texto-legado:${ficha.id}`,
          ficha_id: ficha.id,
          atendimento_id: null,
          dentista_id: ficha.dentista_id,
          data: ficha.data_atendimento,
          texto: ficha.anotacoes,
          automatica: false,
        } satisfies EvolucaoRaw]).map((evolucao) => ({
          id: evolucao.id,
          fichaId: evolucao.ficha_id,
          texto: evolucao.texto,
          automatica: evolucao.automatica,
          data: evolucao.data,
          profissional: profissionais.get(evolucao.dentista_id) ?? profissionalDesconhecido,
        })),
        eventos: eventosHistoricosPorFicha.get(ficha.id) ?? [],
        retorno: null,
        documentos: documentosPorFicha.get(ficha.id) ?? [],
      };
    });

  const atendimentosOrdenados = [...modernos, ...legados].sort((a, b) => (
      b.dataAtendimento.localeCompare(a.dataAtendimento)
      || b.criadoEm.localeCompare(a.criadoEm)
  ));

  return {
    atendimentos: atendimentosOrdenados,
    fichas: projetarFichasProntuario(atendimentosOrdenados, eventosAtivos),
    boca: eventosAtivos,
    profissionaisClinicos: ((dentistasResult.data as DentistaRaw[] | null) ?? [])
      .filter((profissional) => profissional.ativo && ['admin', 'dentista'].includes(profissional.role))
      .map(({ id, nome, cro }) => ({ id, nome, cro })),
    errosParciais,
  };
}
