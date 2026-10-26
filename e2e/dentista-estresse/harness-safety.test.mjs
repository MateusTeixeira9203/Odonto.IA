import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const harness = new URL('./harness.mjs', import.meta.url).href;
const defaults = { DENTISTA_D2_PORT: '3018', DENTISTA_D2_SNAPSHOT: 'dentistadev2-final', DENTISTA_D2_COMMIT: '2da5469858ea84fb40971ad2edc1e8d4d5e7ef0e', DENTISTA_D2_PREFIX: 'd025d201', DENTISTA_D2_READY: '' };
function run(env, code = `await import(${JSON.stringify(harness)})`) {
  return spawnSync(process.execPath, ['--input-type=module', '-e', code], { encoding: 'utf8', windowsHide: true, timeout: 30000, env: { ...process.env, ...defaults, ...env } });
}
test('D2 segurança: importar harness não acessa banco nem exige login; IDs próprios', () => {
  const r = run({}, `const h=await import(${JSON.stringify(harness)});if(h.id(1)!=='d025d201-0000-4000-8000-000000000001')throw Error('id');`);
  assert.equal(r.status, 0);
});
for (const [label, env] of [
  ['3018snapshotErrado', { DENTISTA_D2_SNAPSHOT: 'dentistadev2' }],
  ['3018faixaAntiga', { DENTISTA_D2_PREFIX: 'd025d200' }],
  ['3018pinErrado', { DENTISTA_D2_COMMIT: '2c2afae6e2f4966b6c22ac7b41060b7fa5df5269' }],
  ['porta3017QA', { DENTISTA_D2_PORT: '3017' }],
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
