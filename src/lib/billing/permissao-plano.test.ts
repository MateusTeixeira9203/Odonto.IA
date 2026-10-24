import assert from 'node:assert/strict';
import test from 'node:test';
import { ehPlanoClinica, papelPodeAlterarPlano } from './permissao-plano';

for (const plano of ['SOLO', 'CLINICA']) {
  test(`${plano} é um plano de clínica válido`, () => {
    assert.equal(ehPlanoClinica(plano), true);
  });
}

for (const valor of ['XYZ', '', null, undefined, 1]) {
  test(`${JSON.stringify(valor)} não é um plano de clínica válido`, () => {
    assert.equal(ehPlanoClinica(valor), false);
  });
}

test('admin pode alterar o plano da clínica ativa', () => {
  assert.equal(papelPodeAlterarPlano('admin'), true);
});

for (const role of ['dentista', 'secretaria', 'protetico', null, undefined]) {
  test(`${String(role)} não pode alterar o plano da clínica`, () => {
    assert.equal(papelPodeAlterarPlano(role), false);
  });
}

test('papéis desconhecidos ou não canônicos são recusados', () => {
  for (const role of ['ADMIN', ' admin ', '', 'proprietario']) {
    assert.equal(papelPodeAlterarPlano(role), false);
  }
});
