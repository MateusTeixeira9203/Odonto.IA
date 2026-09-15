import assert from 'node:assert/strict';
import test from 'node:test';
import { cobrançasAtivasComSaldo } from './cobrancas';

test('recebimento de uma cobrança não baixa a outra etapa do mesmo orçamento', () => {
  const etapas = cobrançasAtivasComSaldo([
    { id: 'superior', orcamentoId: 'orcamento', dentistaId: 'responsavel-orcamento', valorFinal: 15000, descricoes: ['Arcada superior'] },
    { id: 'inferior', orcamentoId: 'orcamento', dentistaId: 'responsavel-orcamento', valorFinal: 15000, descricoes: ['Arcada inferior'] },
  ], [
    { cobrancaId: 'superior', valor: 5000, status: 'pago' },
  ], new Map([['responsavel-orcamento', 'Dra. Helena']]));

  assert.deepEqual(etapas.map((etapa) => [etapa.cobrancaId, etapa.valorPendente]), [
    ['superior', 10000],
    ['inferior', 15000],
  ]);
  assert.equal(etapas[0]?.dentistaId, 'responsavel-orcamento');
  assert.equal(etapas[0]?.dentistaNome, 'Dra. Helena');
});

test('saldos de cobrança são calculados em centavos', () => {
  const [cobranca] = cobrançasAtivasComSaldo([
    { id: 'etapa', orcamentoId: 'orcamento', dentistaId: 'd1', valorFinal: 0.3, descricoes: [] },
  ], [
    { cobrancaId: 'etapa', valor: 0.1, status: 'pago' },
    { cobrancaId: 'etapa', valor: 0.2, status: 'pago' },
  ], new Map());
  assert.equal(cobranca, undefined);
});
