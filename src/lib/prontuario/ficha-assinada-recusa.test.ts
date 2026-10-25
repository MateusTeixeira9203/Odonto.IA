import assert from 'node:assert/strict';
import test from 'node:test';
import { fichaAssinadaRecusa } from './ficha-assinada-recusa';

test('sem marca A, permite evolução e procedimentos (incluindo ficha só com marca B)', () => {
  assert.equal(fichaAssinadaRecusa(null, 0), false);
  assert.equal(fichaAssinadaRecusa(null, 3), false);
});

test('regressão: marca A permite evolução sem procedimentos', () => {
  assert.equal(fichaAssinadaRecusa('2026-10-21T12:45:00Z', 0), false);
});

test('marca A recusa procedimentos; removê-los permite salvar na nova tentativa', () => {
  const assinatura = '2026-10-21T12:45:00Z';
  assert.equal(fichaAssinadaRecusa(assinatura, 1), true);
  assert.equal(fichaAssinadaRecusa(assinatura, 0), false);
});
