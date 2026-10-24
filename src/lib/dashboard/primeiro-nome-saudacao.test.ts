import assert from 'node:assert/strict';
import test from 'node:test';
import { primeiroNomeSaudacao } from './primeiro-nome-saudacao';

for (const [nome, esperado] of [
  ['Dra. Ana Local', 'Ana'], ['Dr. Carlos Auditoria', 'Carlos'],
  ['dra Ana', 'Ana'], ['DR Carlos', 'Carlos'], ['Dra.Ana', 'Ana'],
  ['  Dra.   Érica Silva  ', 'Érica'], ['João Pedro', 'João'],
  ['Ana-Clara Souza', 'Ana-Clara'], ['\tMaria\nClara', 'Maria'],
  ['Drake Silva', 'Drake'], ['Drago Santos', 'Drago'],
  ['', ''], ['   ', ''], ['Dr.', ''], ['Dra.', ''],
]) {
  test(`nome ${JSON.stringify(nome)} → ${JSON.stringify(esperado)}`, () => {
    assert.equal(primeiroNomeSaudacao(nome), esperado);
  });
}
