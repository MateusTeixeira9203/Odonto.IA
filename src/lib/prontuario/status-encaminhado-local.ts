import type { ProntuarioAtendimento, ProntuarioLongitudinalData } from '@/server/patients/get-prontuario-longitudinal';
import type { OdontogramaEventoDraft } from '@/types/odontograma';

type StatusRegistro = 'indicado' | 'realizado';

export type StatusEncaminhadoLocal = {
  dadosDeOrigem: ProntuarioLongitudinalData;
  porEvento: Record<string, StatusRegistro>;
};

export function proximoStatusEncaminhadoLocal(
  dados: ProntuarioLongitudinalData,
  anterior: StatusEncaminhadoLocal | null,
  eventoIds: string[],
  novoStatus: StatusRegistro,
): StatusEncaminhadoLocal {
  const porEvento = anterior?.dadosDeOrigem === dados ? { ...anterior.porEvento } : {};
  eventoIds.forEach((eventoId) => {
    porEvento[eventoId] = novoStatus;
  });
  return { dadosDeOrigem: dados, porEvento };
}

export function refletirStatusEncaminhadoLocal(
  dados: ProntuarioLongitudinalData,
  statusLocal: StatusEncaminhadoLocal | null,
): ProntuarioLongitudinalData {
  if (statusLocal?.dadosDeOrigem !== dados) return dados;

  const atualizarEvento = <T extends OdontogramaEventoDraft>(evento: T): T => {
    const novoStatus = statusLocal.porEvento[evento.id];
    if (novoStatus == null) return evento;
    return {
      ...evento,
      status: novoStatus,
      // A data clínica vem da RPC; até o próximo payload, nunca inventamos uma data local.
      realizado_em: novoStatus === 'indicado' ? null : evento.realizado_em,
      momento_planejado: novoStatus === 'realizado' ? 'sessao_atual' : evento.momento_planejado,
    };
  };
  const atualizarAtendimento = (atendimento: ProntuarioAtendimento): ProntuarioAtendimento => ({
    ...atendimento,
    eventos: atendimento.eventos.map(atualizarEvento),
  });

  return {
    ...dados,
    atendimentos: dados.atendimentos.map(atualizarAtendimento),
    fichas: dados.fichas.map((ficha) => {
      const eventos = ficha.eventos.map(atualizarEvento);
      return {
        ...ficha,
        eventos,
        atendimentos: ficha.atendimentos.map(atualizarAtendimento),
        procedimentosRealizados: eventos.filter((evento) => evento.status === 'realizado').length,
        procedimentosPendentes: eventos.filter((evento) => evento.status === 'indicado').length,
      };
    }),
    boca: dados.boca.map(atualizarEvento),
  };
}
