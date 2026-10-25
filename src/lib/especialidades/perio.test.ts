import assert from 'node:assert/strict';
import { test } from 'node:test';
import { alternarAsterisco, cicloSextante, PSR_VAZIO, psrDetalheSchema, SEXTANTE_IDS } from './perio';

test('primeiro clique avalia somente o sextante escolhido sem alterar o estado inicial', () => {
  const d = cicloSextante(null, 's1');
  assert.equal(d.psr.s1.codigo, 0);
  for (const id of SEXTANTE_IDS) assert.equal(PSR_VAZIO.psr[id].codigo, null);
  for (const id of SEXTANTE_IDS.filter(id => id !== 's1')) assert.equal(d.psr[id].codigo, null);
});

test('ciclo inteiro passa por 0 a 4, ausente e volta a não avaliado', () => {
  let d = PSR_VAZIO;
  for (const esperado of [0, 1, 2, 3, 4, 'X', null]) {
    d = cicloSextante(d, 's1');
    assert.equal(d.psr.s1.ausente ? 'X' : d.psr.s1.codigo, esperado);
    assert.equal(psrDetalheSchema.safeParse(d).success, true);
  }
});

test('asterisco liga e desliga sem mudar código nem outros sextantes', () => {
  const inicial = cicloSextante(null, 's1');
  const ligado = alternarAsterisco(inicial, 's1');
  const desligado = alternarAsterisco(ligado, 's1');
  assert.equal(ligado.psr.s1.asterisco, true);
  assert.equal(desligado.psr.s1.asterisco, undefined);
  assert.equal(inicial.psr.s1.asterisco, undefined);
  assert.equal(ligado.psr.s1.codigo, 0);
  assert.equal(desligado.psr.s1.codigo, 0);
  assert.deepEqual(desligado.psr.s2, inicial.psr.s2);
  assert.equal(psrDetalheSchema.safeParse(ligado).success, true);
  assert.equal(psrDetalheSchema.safeParse(desligado).success, true);
});

test('ciclo preserva o asterisco inclusive ao entrar e sair de ausente', () => {
  let d = alternarAsterisco(null, 's1');
  for (let i = 0; i < 7; i++) {
    d = cicloSextante(d, 's1');
    assert.equal(d.psr.s1.asterisco, true);
    assert.equal(psrDetalheSchema.safeParse(d).success, true);
  }
});
