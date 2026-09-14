import assert from 'node:assert/strict';
import test from 'node:test';
import type { ProntuarioAtendimento } from './get-prontuario-longitudinal';
import { projetarFichasProntuario } from './projetar-fichas-prontuario';

const profissional = { id: 'dentista-a', nome: 'Dra. Ana', cro: '1234' };

function atendimento(params: {
  id: string;
  data: string;
  fichas: Array<{ id: string; nome: string }>;
  eventos: Array<{ id: string; fichaId: string; status: 'indicado' | 'realizado' }>;
  documentos?: Array<{ id: string; fichaId: string; eventoIds: string[] }>;
}): ProntuarioAtendimento {
  return {
    id: params.id,
    fonte: 'moderna',
    atendimentoId: params.id,
    dataAtendimento: params.data,
    criadoEm: `${params.data}T12:00:00.000Z`,
    estado: 'finalizado',
    origem: 'ficha',
    profissional,
    fichaIds: params.fichas.map((ficha) => ficha.id),
    fichas: params.fichas.map((ficha) => ({
      ...ficha,
      status: 'aberta',
      assinaturaUrl: null,
      assinadoEm: null,
      ortoManutencao: null,
      responsavel: profissional,
    })),
    evolucoes: params.fichas.map((ficha) => ({
      id: `evolucao-${params.id}-${ficha.id}`,
      fichaId: ficha.id,
      texto: `Evolução ${ficha.nome}`,
      automatica: false,
      data: params.data,
      profissional,
    })),
    eventos: params.eventos.map((evento) => ({
      id: evento.id,
      fichaId: evento.fichaId,
      dentistaId: profissional.id,
      autorOriginal: profissional,
      atualizadoEm: `${params.data}T12:00:00.000Z`,
      ultimaAlteracao: null,
      tipo: 'outro',
      procedimentoId: null,
      procedimentoNome: evento.id,
      status: evento.status,
      origem: 'clinica',
      momento_planejado: 'sessao_atual',
      ancora: { nivel: 'geral' },
      grupo_id: null,
      papel_no_grupo: null,
      observacao: '',
      detalhe: null,
      realizado_em: evento.status === 'realizado' ? params.data : null,
    })),
    retorno: null,
    documentos: (params.documentos ?? []).map((documento) => ({
      ...documento,
      tipo: 'conclusao_procedimento',
      assinadoEm: `${params.data}T12:00:00.000Z`,
    })),
  };
}

test('uma consulta com duas fichas vira dois históricos sem duplicar eventos', () => {
  const fichas = projetarFichasProntuario([atendimento({
    id: 'atendimento-1',
    data: '2026-09-01',
    fichas: [{ id: 'ficha-a', nome: 'Canal 16' }, { id: 'ficha-b', nome: 'Coroa 26' }],
    eventos: [
      { id: 'evento-a', fichaId: 'ficha-a', status: 'indicado' },
      { id: 'evento-b', fichaId: 'ficha-b', status: 'realizado' },
    ],
  })]);

  assert.equal(fichas.length, 2);
  assert.deepEqual(fichas.find((ficha) => ficha.id === 'ficha-a')?.atendimentos[0]?.eventos.map((evento) => evento.id), ['evento-a']);
  assert.deepEqual(fichas.find((ficha) => ficha.id === 'ficha-b')?.atendimentos[0]?.eventos.map((evento) => evento.id), ['evento-b']);
});

test('documentos permanecem somente no recorte da ficha a que pertencem', () => {
  const fichas = projetarFichasProntuario([atendimento({
    id: 'atendimento-compartilhado',
    data: '2026-09-01',
    fichas: [{ id: 'ficha-a', nome: 'Canal 16' }, { id: 'ficha-b', nome: 'Coroa 26' }],
    eventos: [
      { id: 'evento-a', fichaId: 'ficha-a', status: 'realizado' },
      { id: 'evento-b', fichaId: 'ficha-b', status: 'realizado' },
    ],
    documentos: [
      { id: 'documento-a', fichaId: 'ficha-a', eventoIds: ['evento-a'] },
      { id: 'documento-b', fichaId: 'ficha-b', eventoIds: ['evento-b'] },
    ],
  })]);

  assert.deepEqual(
    fichas.find((ficha) => ficha.id === 'ficha-a')?.atendimentos[0]?.documentos.map((documento) => documento.id),
    ['documento-a'],
  );
  assert.deepEqual(
    fichas.find((ficha) => ficha.id === 'ficha-b')?.atendimentos[0]?.documentos.map((documento) => documento.id),
    ['documento-b'],
  );
});

test('o histórico mantém consultas em ordem decrescente e soma o progresso da ficha', () => {
  const fichas = projetarFichasProntuario([
    atendimento({
      id: 'atendimento-antigo',
      data: '2026-08-20',
      fichas: [{ id: 'ficha-a', nome: 'Canal 16' }],
      eventos: [{ id: 'evento-antigo', fichaId: 'ficha-a', status: 'realizado' }],
    }),
    atendimento({
      id: 'atendimento-novo',
      data: '2026-09-01',
      fichas: [{ id: 'ficha-a', nome: 'Canal 16' }],
      eventos: [{ id: 'evento-novo', fichaId: 'ficha-a', status: 'indicado' }],
    }),
  ]);

  assert.deepEqual(fichas[0]?.atendimentos.map((item) => item.id), ['atendimento-novo', 'atendimento-antigo']);
  assert.equal(fichas[0]?.totalProcedimentos, 2);
  assert.equal(fichas[0]?.procedimentosRealizados, 1);
  assert.equal(fichas[0]?.procedimentosPendentes, 1);
});

test('a ficha recebe adição posterior ativa sem anexá-la ao recorte da visita', () => {
  const visita = atendimento({
    id: 'atendimento-original',
    data: '2026-09-01',
    fichas: [{ id: 'ficha-a', nome: 'Canal 16' }],
    eventos: [{ id: 'evento-original', fichaId: 'ficha-a', status: 'realizado' }],
  });
  const adicionado = {
    ...visita.eventos[0],
    id: 'evento-adicionado',
    status: 'indicado' as const,
    capturaId: 'captura-posterior',
  };

  const [ficha] = projetarFichasProntuario([visita], [...visita.eventos, adicionado]);

  assert.deepEqual(ficha?.atendimentos[0]?.eventos.map((evento) => evento.id), ['evento-original']);
  assert.deepEqual(ficha?.eventos.map((evento) => evento.id), ['evento-original', 'evento-adicionado']);
  assert.equal(ficha?.totalProcedimentos, 2);
  assert.equal(ficha?.procedimentosRealizados, 1);
  assert.equal(ficha?.procedimentosPendentes, 1);
});
