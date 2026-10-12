import assert from 'node:assert/strict';
import test from 'node:test';
import { formatarDataBRT, formatarHoraBRT, partesDataHoraBRT } from './hora-brt';

test('preserva data e hora clínicas de um instante UTC', () => {
  assert.equal(formatarDataBRT('2026-10-04T02:30:00.000Z'), '03/10/2026');
  assert.equal(formatarHoraBRT('2026-10-11T15:30:00.000Z'), '12:30');
  assert.deepEqual(partesDataHoraBRT('2026-10-11T15:30:00.000Z'), {
    data: '2026-10-11',
    hora: '12:30',
    minutoDoDia: 750,
  });
});
