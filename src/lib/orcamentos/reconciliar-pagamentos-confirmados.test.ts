import assert from 'node:assert/strict';
import test from 'node:test';

import { reconciliarPagamentosConfirmados } from './reconciliar-pagamentos-confirmados';

test('substitui somente o registro com pagamentos confirmados pelo servidor', () => {
  const origem = [
    { id: 'orcamento-a', pagamentos: [{ id: 'antigo', valor: 20 }] },
    { id: 'orcamento-b', pagamentos: [{ id: 'outro', valor: 30 }] },
  ];
  const confirmados = [{ id: 'antigo', valor: 20 }, { id: 'novo', valor: 10 }];

  const resultado = reconciliarPagamentosConfirmados(origem, 'orcamento-a', confirmados);

  assert.equal(resultado.confirmado, true);
  assert.deepEqual(resultado.registros[0].pagamentos, confirmados);
  assert.equal(resultado.registros[1], origem[1]);
});

test('preserva o estado anterior quando a confirmação autoritativa não chegou', () => {
  const origem = [{ id: 'etapa-a', pagamentos: [{ id: 'existente', valor: 20 }] }];

  const resultado = reconciliarPagamentosConfirmados(origem, 'etapa-a', undefined);

  assert.equal(resultado.confirmado, false);
  assert.equal(resultado.registros, origem);
});
