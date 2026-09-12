import assert from 'node:assert/strict';
import test from 'node:test';
import { janelaDaSemanaDisponibilidade } from './disponibilidade';

test('a disponibilidade busca a semana desenhada a partir do domingo inicial', () => {
  assert.deepEqual(janelaDaSemanaDisponibilidade('2026-08-30'), {
    de: '2026-08-31T00:00:00.000-03:00',
    ate: '2026-09-06T00:00:00.000-03:00',
  });
});
