/** Execute com: node --test src/lib/billing/estado-comercial.test.ts */
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  estadoComercialBloqueiaOperacao,
  estadoComercialPermiteCobranca,
  resolverEstadoComercial,
} from './estado-comercial.ts';

test('isenção vence qualquer estado histórico de assinatura', () => {
  const estado = resolverEstadoComercial({ isento: true, statusAssinatura: 'past_due' });
  assert.equal(estado, 'isento');
  assert.equal(estadoComercialPermiteCobranca(estado), false);
});

test('formação não vira assinatura ativa nem inativa', () => {
  assert.equal(
    resolverEstadoComercial({ isento: false, statusAssinatura: 'cartao_pronto' }),
    'em_formacao',
  );
});

test('status Stripe vira estado comercial estável', () => {
  assert.equal(resolverEstadoComercial({ isento: false, statusAssinatura: 'trialing' }), 'trial');
  assert.equal(resolverEstadoComercial({ isento: false, statusAssinatura: 'active' }), 'ativo');
  assert.equal(resolverEstadoComercial({ isento: false, statusAssinatura: 'unpaid' }), 'suspenso');
});

test('inadimplência trava operação sem transformar a sessão em logout', () => {
  assert.equal(estadoComercialBloqueiaOperacao('past_due'), true);
  assert.equal(estadoComercialBloqueiaOperacao('suspenso'), true);
  assert.equal(estadoComercialBloqueiaOperacao('ativo'), false);
});
