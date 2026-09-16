import assert from 'node:assert/strict';
import test from 'node:test';

import { resolverCoberturaComercial } from './commercial-coverage';

test('mantém clínica sem contrato R165 no caminho legado', () => {
  assert.equal(resolverCoberturaComercial({
    possuiContratoR165: false, papel: 'dentista', possuiPerfilClinico: true, existeDentistaCoberto: false,
  }), 'legado');
});

test('não confunde checkout pendente, suspensão ou cancelamento com cobertura clínica', () => {
  for (const coberturaDoDentista of ['aguardando_checkout', 'suspended', 'canceled'] as const) {
    assert.equal(resolverCoberturaComercial({
      possuiContratoR165: true, papel: 'admin', possuiPerfilClinico: true, coberturaDoDentista, existeDentistaCoberto: true,
    }), 'sem_cobertura');
  }
});

test('aceita somente os estados comerciais que preservam cobertura', () => {
  for (const coberturaDoDentista of ['trialing', 'active', 'past_due'] as const) {
    assert.equal(resolverCoberturaComercial({
      possuiContratoR165: true, papel: 'dentista', possuiPerfilClinico: true, coberturaDoDentista, existeDentistaCoberto: false,
    }), 'coberto');
  }
});

test('gestor e secretaria dependem de profissional coberta, sem fallback de cargo', () => {
  for (const papel of ['gestor', 'secretaria'] as const) {
    assert.equal(resolverCoberturaComercial({
      possuiContratoR165: true, papel, possuiPerfilClinico: false, existeDentistaCoberto: true,
    }), 'coberto');
  }
  assert.equal(resolverCoberturaComercial({
    possuiContratoR165: true, papel: 'gestor', possuiPerfilClinico: false, existeDentistaCoberto: false,
  }), 'sem_cobertura');
  assert.equal(resolverCoberturaComercial({
    possuiContratoR165: true, papel: 'protetico', possuiPerfilClinico: false, existeDentistaCoberto: true,
  }), 'sem_cobertura');
});
