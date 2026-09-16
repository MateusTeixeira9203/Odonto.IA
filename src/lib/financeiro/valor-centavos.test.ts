import assert from 'node:assert/strict';
import test from 'node:test';
import { formatarCentavos, parseValorCentavos } from './valor-centavos';

test('converte valores brasileiros em centavos sem arredondamento por float', () => {
  assert.equal(parseValorCentavos('250'), 25_000);
  assert.equal(parseValorCentavos('250,5'), 25_050);
  assert.equal(parseValorCentavos('1.234,56'), 123_456);
  assert.equal(parseValorCentavos('1234.56'), 123_456);
});

test('recusa formatos ambíguos, negativos e frações acima de centavos', () => {
  for (const value of ['', '-1', '1,234', '1.234', '1e3', ' 1 000 ', '0', '10000000000']) {
    assert.equal(parseValorCentavos(value), null, value);
  }
});

test('formata a partir de centavos inteiros sem converter o valor para decimal', () => {
  assert.equal(formatarCentavos(123_456), 'R$ 1.234,56');
  assert.equal(formatarCentavos(999_999_999_999), 'R$ 9.999.999.999,99');
});
