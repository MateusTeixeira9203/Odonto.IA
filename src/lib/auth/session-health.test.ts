import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveSessionHealth } from './session-health.ts';

test('usuário presente mantém sessão mesmo com aviso auxiliar', () => {
  assert.equal(resolveSessionHealth({ hasUser: true, error: { status: 500 } }), 'healthy');
});

test('ausência comprovada ou token rejeitado expira sessão', () => {
  assert.equal(resolveSessionHealth({ hasUser: false, error: null }), 'expired');
  assert.equal(resolveSessionHealth({ hasUser: false, error: { status: 401 } }), 'expired');
  assert.equal(resolveSessionHealth({ hasUser: false, error: { name: 'AuthSessionMissingError' } }), 'expired');
});

test('falha de rede não se transforma em logout', () => {
  assert.equal(resolveSessionHealth({
    hasUser: false,
    error: { name: 'AuthRetryableFetchError', status: 0 },
  }), 'technical_failure');
});
