import assert from 'node:assert/strict';
import test from 'node:test';
import { outrasFichasDaSessao } from './outras-fichas-da-sessao';

test('sessao somente na ficha atual nao tem outras fichas', () => {
  assert.deepEqual(outrasFichasDaSessao('S1', 'F1', [
    { id: 'S1', fichas: [{ id: 'F1', nome: 'Ficha atual' }] },
  ]), []);
});

test('sessao em duas fichas devolve somente a outra e preserva a entrada', () => {
  const atendimentos = [{ id: 'S12', fichas: [
    { id: 'F3', nome: 'Manutencao periodontal' },
    { id: 'F4', nome: 'Clareamento' },
  ] }];
  const antes = structuredClone(atendimentos);
  assert.deepEqual(outrasFichasDaSessao('S12', 'F3', atendimentos), [
    { id: 'F4', nome: 'Clareamento' },
  ]);
  assert.deepEqual(atendimentos, antes);
});

test('visita ausente na lista geral nao tem outras fichas', () => {
  assert.deepEqual(outrasFichasDaSessao('ausente', 'F1', [
    { id: 'S1', fichas: [{ id: 'F1', nome: 'Ficha atual' }] },
  ]), []);
});
