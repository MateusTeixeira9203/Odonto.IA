import assert from 'node:assert/strict';
import test from 'node:test';

import { exigeRevisaoComercial } from './exige-revisao-comercial';

const base = {
  status: 'rascunho',
  valor_acordado: null,
  plano_forma: null,
  cobrancas: [],
  pagamentos: [],
  aceite: null,
  itens: [{ aprovado: false }],
};

test('mantém edição restrita quando não há histórico comercial', () => {
  assert.equal(exigeRevisaoComercial(base), false);
});

for (const [nome, parcial] of [
  ['item aprovado', { itens: [{ aprovado: true }] }],
  ['status legado aprovado', { status: 'aprovado' }],
  ['valor acordado', { valor_acordado: 100 }],
  ['plano de pagamento', { plano_forma: 'parcelado' }],
  ['cobrança existente', { cobrancas: [{}] }],
  ['pagamento existente', { pagamentos: [{}] }],
  ['aceite registrado', { aceite: {} }],
] as const) {
  test(`exige revisão R-172 com ${nome}`, () => {
    assert.equal(exigeRevisaoComercial({ ...base, ...parcial }), true);
  });
}
