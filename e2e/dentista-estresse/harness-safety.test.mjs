import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const harness = new URL('./harness.mjs', import.meta.url).href;
const defaults = { DENTISTA_D2_PORT: '3013', DENTISTA_D2_SNAPSHOT: 'dentistadev2', DENTISTA_D2_COMMIT: '3d14edb231c318c4f005f57818a41233e8bab6ad', DENTISTA_D2_PREFIX: 'd025d200', DENTISTA_D2_READY: '' };
function run(env, code = `await import(${JSON.stringify(harness)})`) {
  return spawnSync(process.execPath, ['--input-type=module', '-e', code], { encoding: 'utf8', windowsHide: true, timeout: 30000, env: { ...process.env, ...defaults, ...env } });
}
test('D2 segurança: importar harness não acessa banco nem exige login; IDs próprios', () => {
  const r = run({}, `const h=await import(${JSON.stringify(harness)});if(h.id(1)!=='d025d200-0000-4000-8000-000000000001')throw Error('id');`);
  assert.equal(r.status, 0);
});
for (const [label, env] of [
  ['porta3000', { DENTISTA_D2_PORT: '3000' }],
  ['3015foraReteste', { DENTISTA_D2_PORT: '3015' }],
  ['snapshotForaWorkspace', { DENTISTA_D2_SNAPSHOT: '../../producao' }],
  ['faixaReservada', { DENTISTA_D2_PREFIX: 'e015b300' }],
  ['pinInvalido', { DENTISTA_D2_COMMIT: 'main' }],
]) test('D2 segurança recusa ' + label + ' antes de acessar ambiente', () => { assert.notEqual(run(env).status, 0); });
test('D2 segurança: sem opt-in não inicia preparo, Auth, banco ou navegador', () => {
  const r = run({}, `const h=await import(${JSON.stringify(harness)});await h.start('nao-deve-existir');`);
  assert.notEqual(r.status, 0); assert.match(r.stderr, /opt-in obrigatório por versão/);
});
