import assert from 'node:assert/strict';
import { test } from 'node:test';
import { concluidoPor } from './concluido-por';

test('realizado encaminhado mostra destinatário diferente da autora da visita', () => {
  assert.equal(concluidoPor([{ status: 'realizado', encaminhadoParaNome: 'Carlos' }], 'Ana'), 'Carlos');
});
test('realizado sem encaminhamento não acrescenta nome', () => {
  assert.equal(concluidoPor([{ status: 'realizado', encaminhadoParaNome: null }], 'Ana'), null);
});
test('indicado encaminhado ainda não tem executor', () => {
  assert.equal(concluidoPor([{ status: 'indicado', encaminhadoParaNome: 'Carlos' }], 'Ana'), null);
});
test('encaminhamento ao próprio autor não repete o nome', () => {
  assert.equal(concluidoPor([{ status: 'realizado', encaminhadoParaNome: 'Ana' }], 'Ana'), null);
});
