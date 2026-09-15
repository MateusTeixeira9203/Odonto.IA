import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { ACCESS_PERMISSIONS } from '../../src/server/auth/access-catalog.ts';

const migration = readFileSync(new URL(
  '../../supabase/migrations/20260912015733_r140e1_catalogo_permissoes_estoque.sql', import.meta.url,
), 'utf8');

test('normalizador SQL permite o catálogo completo usado pelo app', () => {
  const allowlist = migration.match(/v_permissao not in \(([\s\S]*?)\n      \)/)?.[1];
  assert.ok(allowlist, 'allowlist SQL ausente');
  const permissions = [...allowlist.matchAll(/'([^']+)'/g)].map((match) => match[1]);
  assert.deepEqual(permissions.sort(), [...ACCESS_PERMISSIONS].sort());
  const limit = Number(migration.match(/jsonb_array_length\(p_acessos\) > (\d+)/)?.[1]);
  assert.equal(limit, ACCESS_PERMISSIONS.length);
});
