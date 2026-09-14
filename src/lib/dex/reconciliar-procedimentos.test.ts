import assert from 'node:assert/strict';
import test from 'node:test';
import type { OdontogramaEventoInput } from '@/types/odontograma';
import { reconciliarProcedimentosDex } from './reconciliar-procedimentos';

function evento(tipo: OdontogramaEventoInput['tipo']): OdontogramaEventoInput {
  return {
    tipo,
    status: 'indicado',
    origem: 'clinica',
    momento_planejado: 'sessao_atual',
    ancora: { nivel: 'dente', dente: 26 },
    grupo_id: null,
    papel_no_grupo: null,
    observacao: '',
  };
}

test('mantém procedimento conhecido que já tem evento estrutural', () => {
  const resultado = reconciliarProcedimentosDex({
    procedimentos: ['Tratamento de canal'],
    eventos: [evento('endodontia')],
    dentesObservacoes: { '26': 'Tratamento de canal' },
    modo: 'consulta',
  });

  assert.equal(resultado.adicionadosComoOutro, 0);
  assert.equal(resultado.eventos.length, 1);
});

test('procedimento explícito sem tipo ganha fallback revisável nos dentes mencionados', () => {
  const resultado = reconciliarProcedimentosDex({
    procedimentos: ['Gengivoplastia'],
    eventos: [],
    dentesObservacoes: { '11': 'Gengivoplastia', '21': 'Gengivoplastia' },
    modo: 'consulta',
  });

  assert.equal(resultado.adicionadosComoOutro, 2);
  assert.deepEqual(resultado.eventos.map((item) => item.ancora.dente), [11, 21]);
  assert.ok(resultado.eventos.every((item) => (
    item.tipo === 'outro'
    && item.status === 'indicado'
    && item.revisar_status === true
    && item.procedimentoNome === 'Gengivoplastia'
  )));
  assert.equal(resultado.eventos[0]?.grupo_id, resultado.eventos[1]?.grupo_id);
});

test('sem localização explícita, fallback fica geral e não inventa anatomia', () => {
  const resultado = reconciliarProcedimentosDex({
    procedimentos: ['Moldagem para estudo'],
    eventos: [],
    dentesObservacoes: {},
    modo: 'consulta',
  });

  assert.deepEqual(resultado.eventos[0]?.ancora, { nivel: 'geral' });
  assert.equal(resultado.eventos[0]?.status, 'indicado');
});

test('não duplica procedimento repetido com variação de caixa ou acento', () => {
  const resultado = reconciliarProcedimentosDex({
    procedimentos: ['Gengivoplastia', 'gengivoplástia'],
    eventos: [],
    dentesObservacoes: {},
    modo: 'consulta',
  });

  assert.equal(resultado.adicionadosComoOutro, 1);
});

test('fallback regional conserva as arcadas e nunca cria dentes 97, 98 ou 99', () => {
  const resultado = reconciliarProcedimentosDex({
    procedimentos: ['Prótese total', 'Procedimento de boca toda'],
    eventos: [],
    dentesObservacoes: { '97': 'Prótese total', '98': 'Prótese total', '99': 'Procedimento de boca toda' },
    modo: 'consulta',
  });
  assert.deepEqual(resultado.eventos.map((item) => item.ancora), [
    { nivel: 'arcada', arcada: 'superior' },
    { nivel: 'arcada', arcada: 'inferior' },
    { nivel: 'boca' },
  ]);
  assert.ok(resultado.eventos.every((item) => item.revisar_status));
});


test('título explícito preserva a etapa definitiva quando só a provisória foi extraída', () => {
  const resultado = reconciliarProcedimentosDex({
    procedimentos: ['Coroa provisória', 'Coroa definitiva'],
    eventos: [{ ...evento('coroa'), procedimentoNome: 'Coroa provisória' }],
    dentesObservacoes: { '26': 'Coroa provisória\nCoroa definitiva' },
    modo: 'consulta',
  });
  assert.equal(resultado.eventos.length, 2);
  assert.equal(resultado.eventos[1].procedimentoNome, 'Coroa definitiva');
  assert.equal(resultado.eventos[1].revisar_status, true);
});

test('prefixo de instalação não duplica o pilar e remoção continua sendo outra intervenção', () => {
  const resultado = reconciliarProcedimentosDex({
    procedimentos: ['Instalação de pilar protético', 'Remoção de pilar protético'],
    eventos: [{ ...evento('outro'), procedimentoNome: 'Pilar protético' }],
    dentesObservacoes: { '26': 'Instalação de pilar protético\nRemoção de pilar protético' },
    modo: 'consulta',
  });
  assert.equal(resultado.eventos.length, 2);
  assert.equal(resultado.eventos[1].procedimentoNome, 'Remoção de pilar protético');
});

test('recupera somente a região omitida, sem duplicar a intervenção já coberta', () => {
  const resultado = reconciliarProcedimentosDex({
    procedimentos: ['Prótese total'],
    eventos: [{ ...evento('outro'), procedimentoNome: 'Prótese total', ancora: { nivel: 'arcada', arcada: 'superior' } }],
    dentesObservacoes: { '97': 'Confecção de prótese total', '98': 'Prótese total' },
    modo: 'consulta',
  });
  assert.equal(resultado.adicionadosComoOutro, 1);
  assert.deepEqual(resultado.eventos[1].ancora, { nivel: 'arcada', arcada: 'inferior' });
});
