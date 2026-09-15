import assert from 'node:assert/strict';
import test from 'node:test';
import { horasLiquidasNoMes, janelaDoMes, mesBRT, mesesAte, ultimosDiasBRT } from './calculos';

test('janelas e série mensal terminam no mês selecionado', () => {
  assert.deepEqual(janelaDoMes('2026-02'), { inicio: '2026-02-01', fim: '2026-03-01' });
  assert.deepEqual(mesesAte('2026-02', 3), ['2025-12', '2026-01', '2026-02']);
});

test('dia e mês de negócio respeitam BRT na virada UTC', () => {
  const agora = new Date('2026-10-01T01:30:00Z');
  assert.equal(mesBRT(agora), '2026-09');
  assert.deepEqual(ultimosDiasBRT(2, agora), [
    { diaISO: '2026-09-29', dia: 'Ter' },
    { diaISO: '2026-09-30', dia: 'Hoje' },
  ]);
});

test('hora clínica desconta almoço e não duplica turnos sobrepostos', () => {
  const turno = { dentistaId: 'd1', diaSemana: 1, horaInicio: '08:00', horaFim: '18:00', almocoInicio: '12:00', almocoFim: '13:00' };
  assert.equal(horasLiquidasNoMes('2026-02', [turno]), 36);
  assert.equal(horasLiquidasNoMes('2026-02', [turno, { ...turno, horaInicio: '09:00', horaFim: '17:00' }]), 36);
});

test('hora clínica desconta somente a parte do almoço dentro da jornada', () => {
  const turno = { dentistaId: 'd1', diaSemana: 1, horaInicio: '08:00', horaFim: '12:30', almocoInicio: '12:00', almocoFim: '13:00' };
  // Fevereiro de 2026 tem quatro segundas: 4h30 de jornada menos 30min de almoço.
  assert.equal(horasLiquidasNoMes('2026-02', [turno]), 16);
});

test('sem grade ou com grade inválida não inventa capacidade nem custo', () => {
  assert.equal(horasLiquidasNoMes('2026-02', []), 0);
  assert.equal(horasLiquidasNoMes('2026-02', [{
    dentistaId: 'd1', diaSemana: 1, horaInicio: '18:00', horaFim: '08:00', almocoInicio: null, almocoFim: null,
  }]), 0);
  assert.equal(horasLiquidasNoMes('2026-13', []), 0);
  assert.equal(horasLiquidasNoMes('2026-02', [{
    dentistaId: 'd1', diaSemana: 1, horaInicio: '08:99', horaFim: '18:00', almocoInicio: null, almocoFim: null,
  }]), 0);
});

test('turnos de dentistas diferentes somam, mas não se misturam', () => {
  const turno = { diaSemana: 1, horaInicio: '08:00', horaFim: '10:00', almocoInicio: null, almocoFim: null };
  assert.equal(horasLiquidasNoMes('2026-02', [{ ...turno, dentistaId: 'd1' }, { ...turno, dentistaId: 'd2' }]), 16);
});
