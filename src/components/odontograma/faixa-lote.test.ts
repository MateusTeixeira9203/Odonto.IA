import assert from 'node:assert/strict';
import test from 'node:test';
import { restauracaoPodeAplicar } from './restauracao-pode-aplicar';

test('Meu Dia não aplica restauração sem faces', () => {
  assert.equal(restauracaoPodeAplicar([], 'meu-dia'), false);
});

test('Meu Dia aplica restauração com ao menos uma face', () => {
  assert.equal(restauracaoPodeAplicar(['O'], 'meu-dia'), true);
  assert.equal(restauracaoPodeAplicar(['M', 'O'], 'meu-dia'), true);
});

test('sem variante preserva a abertura do seletor de faces', () => {
  assert.equal(restauracaoPodeAplicar([]), true);
  assert.equal(restauracaoPodeAplicar(['O']), true);
});