import assert from 'node:assert/strict';
import test from 'node:test';
import { dentistaFinanceiroSchema, despesaFinanceiroSchema, mesFinanceiroSchema, receitaFinanceiroSchema } from './schemas';

const dentistaId = '6d015c2a-1fd3-48f2-a32f-5a729827d1d9';

test('lançamentos financeiros exigem valor positivo em centavos e data real', () => {
  const base = { valor: 120.5, categoria: 'Material', tipo: 'variavel' as const, data: '2026-09-09', dentistaId };
  assert.equal(despesaFinanceiroSchema.safeParse(base).success, true);
  assert.equal(despesaFinanceiroSchema.safeParse({ ...base, valor: 0 }).success, false);
  assert.equal(despesaFinanceiroSchema.safeParse({ ...base, valor: Number.POSITIVE_INFINITY }).success, false);
  assert.equal(despesaFinanceiroSchema.safeParse({ ...base, data: '2026-02-30' }).success, false);
  assert.equal(despesaFinanceiroSchema.safeParse({ ...base, dentistaId: 'externo' }).success, false);
});

test('receita aceita só formas permitidas e mês tem formato calendário', () => {
  assert.equal(receitaFinanceiroSchema.safeParse({ valor: 1, forma: 'pix', data: '2026-09-09' }).success, true);
  assert.equal(receitaFinanceiroSchema.safeParse({ valor: 1, forma: 'cartao_credito', data: '2026-09-09' }).success, false);
  assert.equal(mesFinanceiroSchema.safeParse('2026-12').success, true);
  assert.equal(mesFinanceiroSchema.safeParse('2026-13').success, false);
  assert.equal(dentistaFinanceiroSchema.safeParse(dentistaId).success, true);
});
