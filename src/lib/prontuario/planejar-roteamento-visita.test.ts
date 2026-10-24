import assert from 'node:assert/strict';
import test from 'node:test';
import { planejarRoteamentoVisita } from './planejar-roteamento-visita';
import type { OdontogramaEventoDraft } from '@/types/odontograma';

const evento = (id: string): OdontogramaEventoDraft => ({
  id, tipo: 'profilaxia', status: 'realizado', origem: 'clinica',
  momento_planejado: 'sessao_atual', ancora: { nivel: 'boca' },
  grupo_id: null, papel_no_grupo: null, observacao: '', realizado_em: '2026-10-24',
});
const base = { eventosDraft: [], fichaDeOrigem: new Map<string, string>() };

test('(a) só evolução entra na ficha escolhida sem criar ficha da sessão', () => {
  const plano = planejarRoteamentoVisita({ ...base, destinoNovos: { fichaId: 'escolhida' } });
  assert.equal(plano.criaFichaDaSessao, false);
  assert.equal(plano.principal, 'escolhida');
  assert.deepEqual([...plano.porFicha], [['escolhida', []]]);
  assert.deepEqual(plano.paraSessao, []);
});

test('(b) procedimento novo continua absorvido pela ficha escolhida', () => {
  const novo = evento('novo');
  const plano = planejarRoteamentoVisita({ ...base, eventosDraft: [novo], destinoNovos: { fichaId: 'escolhida' } });
  assert.equal(plano.criaFichaDaSessao, false);
  assert.equal(plano.principal, 'escolhida');
  assert.deepEqual(plano.porFicha.get('escolhida'), [novo]);
  assert.deepEqual(plano.paraSessao, []);
});

test('(c) só evolução sem destino continua criando ficha da sessão', () => {
  const plano = planejarRoteamentoVisita(base);
  assert.equal(plano.criaFichaDaSessao, true);
  assert.equal(plano.principal, null);
  assert.equal(plano.porFicha.size, 0);
});

test('(d) pendência mantém sua origem e recebe o relato, sem usar outro destino', () => {
  const pendencia = evento('pendencia');
  const plano = planejarRoteamentoVisita({ ...base, eventosDraft: [pendencia], fichaDeOrigem: new Map([['pendencia', 'origem']]), destinoNovos: { fichaId: 'escolhida' } });
  assert.equal(plano.criaFichaDaSessao, false);
  assert.equal(plano.principal, 'origem');
  assert.deepEqual([...plano.porFicha], [['origem', [pendencia]]]);
});

test('(e) ficha da sessão R-85 ignora o destino escolhido, com e sem procedimento', () => {
  for (const eventosDraft of [[], [evento('novo')]]) {
    const plano = planejarRoteamentoVisita({ ...base, eventosDraft, fichaId: 'sessao', destinoNovos: { fichaId: 'escolhida' } });
    assert.equal(plano.fichaDaSessao, 'sessao');
    assert.equal(plano.criaFichaDaSessao, true);
    assert.equal(plano.principal, null);
    assert.equal(plano.porFicha.size, 0);
    assert.deepEqual(plano.paraSessao, eventosDraft);
  }
});

for (const extra of [{ alertaNovo: 'Alerta fictício QA' }, { ortoManutencao: { arcada: 'superior' as const } }]) {
  test(`(f) ${'alertaNovo' in extra ? 'alerta' : 'orto'} mantém a ficha da sessão (C2-1)`, () => {
    const plano = planejarRoteamentoVisita({ ...base, ...extra, destinoNovos: { fichaId: 'escolhida' } });
    assert.equal(plano.criaFichaDaSessao, true);
    assert.equal(plano.principal, null);
    assert.equal(plano.porFicha.size, 0);
  });
}

test('principal mantém maior quantidade e desempate pela ordem do rascunho', () => {
  const a = evento('a'), b = evento('b'), c = evento('c');
  const fichaDeOrigem = new Map([['a', 'A'], ['b', 'B'], ['c', 'B']]);
  assert.equal(planejarRoteamentoVisita({ ...base, fichaDeOrigem, eventosDraft: [a, b, c] }).principal, 'B');
  assert.equal(planejarRoteamentoVisita({ ...base, fichaDeOrigem, eventosDraft: [a, b] }).principal, 'A');
  assert.equal(planejarRoteamentoVisita({ ...base, fichaDeOrigem, eventosDraft: [b, a] }).principal, 'B');
});

test('procedimento novo sem destino continua na ficha da sessão', () => {
  const novo = evento('novo');
  const plano = planejarRoteamentoVisita({ ...base, eventosDraft: [novo] });
  assert.equal(plano.criaFichaDaSessao, true);
  assert.deepEqual(plano.paraSessao, [novo]);
});
