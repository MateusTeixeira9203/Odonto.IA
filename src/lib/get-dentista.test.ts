import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

// Source checks must delimit the same function on Windows (CRLF) and Unix (LF).
const source = readFileSync(fileURLToPath(new URL('./get-dentista.ts', import.meta.url)), 'utf8').replace(/\r\n/g, '\n');
const actorSource = source.slice(
  source.indexOf('export const getDexActorCached'),
  source.indexOf('/**\n * Busca o perfil clínico'),
);

test('a identidade mínima do Dex mantém a clínica ativa e não carrega perfil completo', () => {
  assert.match(actorSource, /auth\.getClaims\(\)/);
  assert.match(actorSource, /from\("users"\)[\s\S]*select\("active_clinica_id"\)/);
  assert.match(actorSource, /from\("dentistas"\)[\s\S]*select\("id, clinica_id"\)/);
  assert.match(actorSource, /\.eq\("user_id", userId\)[\s\S]*\.eq\("clinica_id", clinicaId\)/);
  assert.doesNotMatch(actorSource, /avatar_url|clinicas\(|storage/);
});
