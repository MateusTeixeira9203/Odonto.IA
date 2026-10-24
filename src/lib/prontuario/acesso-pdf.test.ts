import assert from 'node:assert/strict';
import test from 'node:test';
import { acessoPdfPorPapel } from './acesso-pdf';

for (const role of ['admin', 'dentista']) {
  test(`${role} recebe PDF completo`, () => assert.equal(acessoPdfPorPapel(role), 'completo'));
}
test('secretária recebe apenas PDF administrativo', () => {
  assert.equal(acessoPdfPorPapel('secretaria'), 'administrativo');
});
for (const role of ['protetico', null, undefined, 'xyz', '', 'Admin']) {
  test(`papel ${String(role)} é negado`, () => assert.equal(acessoPdfPorPapel(role), 'negado'));
}
