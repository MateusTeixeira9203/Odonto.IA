import assert from 'node:assert/strict';
import test from 'node:test';
import { dentistaDoEscopoDaAgenda } from './escopo-dentista';

const dentistaId = 'dentista-qa';

test('secretaria consulta a agenda da clinica inteira', () => {
  assert.equal(dentistaDoEscopoDaAgenda('secretaria', dentistaId), null);
});

for (const role of ['admin', 'dentista', 'protetico', null, undefined, 'desconhecido', '']) {
  test(`papel ${String(role)} conserva o escopo do proprio dentista`, () => {
    assert.equal(dentistaDoEscopoDaAgenda(role, dentistaId), dentistaId);
  });
}
