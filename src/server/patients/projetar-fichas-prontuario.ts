import type {
  ProntuarioAtendimento,
  ProntuarioEvento,
  ProntuarioProfissional,
} from '@/server/patients/get-prontuario-longitudinal';

export type ProntuarioFicha = {
  id: string;
  nome: string;
  status: string;
  assinaturaUrl: string | null;
  assinadoEm: string | null;
  responsavel: ProntuarioProfissional;
  /** Estado ativo inteiro da ficha; o atendimento abaixo preserva o recorte da visita. */
  eventos: ProntuarioEvento[];
  atendimentos: ProntuarioAtendimento[];
  totalProcedimentos: number;
  procedimentosRealizados: number;
  procedimentosPendentes: number;
};

/**
 * Converte a linha do tempo por visita na leitura por Ficha usada pela interface unificada.
 * A consulta continua sendo a unidade histórica; cada Ficha recebe somente o seu recorte.
 */
export function projetarFichasProntuario(
  atendimentos: ProntuarioAtendimento[],
  eventosDaFicha?: ProntuarioEvento[],
): ProntuarioFicha[] {
  const fichas = new Map<string, ProntuarioFicha>();
  // O parâmetro explícito vem da leitura atual da ficha. O fallback conserva o contrato dos
  // chamadores antigos e dos testes que só possuem os recortes das visitas.
  const todosEventos = eventosDaFicha ?? [...new Map(
    atendimentos.flatMap((atendimento) => atendimento.eventos).map((evento) => [evento.id, evento]),
  ).values()];
  const eventosPorFicha = new Map<string, ProntuarioEvento[]>();
  for (const evento of todosEventos) {
    if (!evento.fichaId) continue;
    eventosPorFicha.set(evento.fichaId, [...(eventosPorFicha.get(evento.fichaId) ?? []), evento]);
  }

  for (const atendimento of atendimentos) {
    for (const resumo of atendimento.fichas) {
      const eventosDoAtendimento = atendimento.eventos.filter((evento) => evento.fichaId === resumo.id);
      const eventos = eventosPorFicha.get(resumo.id) ?? [];
      const evolucoes = atendimento.evolucoes.filter((evolucao) => evolucao.fichaId === resumo.id);
      const documentos = atendimento.documentos.filter((documento) => documento.fichaId === resumo.id);
      const recorte: ProntuarioAtendimento = {
        ...atendimento,
        fichaIds: [resumo.id],
        fichas: [resumo],
        eventos: eventosDoAtendimento,
        evolucoes,
        documentos,
      };
      const existente = fichas.get(resumo.id);

      if (existente) {
        existente.atendimentos.push(recorte);
        continue;
      }

      fichas.set(resumo.id, {
        id: resumo.id,
        nome: resumo.nome,
        status: resumo.status,
        assinaturaUrl: resumo.assinaturaUrl,
        assinadoEm: resumo.assinadoEm,
        responsavel: resumo.responsavel,
        eventos,
        atendimentos: [recorte],
        totalProcedimentos: eventos.length,
        procedimentosRealizados: eventos.filter((evento) => evento.status === 'realizado').length,
        procedimentosPendentes: eventos.filter((evento) => evento.status === 'indicado').length,
      });
    }
  }

  return [...fichas.values()]
    .map((ficha) => ({
      ...ficha,
      atendimentos: ficha.atendimentos.sort((a, b) => (
        b.dataAtendimento.localeCompare(a.dataAtendimento)
        || b.criadoEm.localeCompare(a.criadoEm)
      )),
    }))
    .sort((a, b) => {
      const dataA = a.atendimentos[0]?.dataAtendimento ?? '';
      const dataB = b.atendimentos[0]?.dataAtendimento ?? '';
      return dataB.localeCompare(dataA) || a.nome.localeCompare(b.nome, 'pt-BR');
    });
}
