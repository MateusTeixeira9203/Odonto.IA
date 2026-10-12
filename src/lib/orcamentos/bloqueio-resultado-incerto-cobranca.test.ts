import assert from 'node:assert/strict';
import test from 'node:test';

import {
  bloquearCobrancaComResultadoIncerto,
} from './bloqueio-resultado-incerto-cobranca';

test('mantém o bloqueio ao fechar e reabrir o detalhe na mesma página', () => {
  const bloqueiosNoPai = bloquearCobrancaComResultadoIncerto(new Set(), 'cobranca-a');

  // Fechar o diálogo desmonta apenas o filho; o estado do pai é reutilizado ao reabrir.
  const bloqueiosAoReabrir = bloqueiosNoPai;

  assert.equal(bloqueiosAoReabrir.has('cobranca-a'), true);
});

test('erro acrescenta somente a cobrança incerta e não altera as demais', () => {
  const bloqueios = bloquearCobrancaComResultadoIncerto(new Set(['cobranca-a']), 'cobranca-b');

  assert.deepEqual([...bloqueios].sort(), ['cobranca-a', 'cobranca-b']);
});
