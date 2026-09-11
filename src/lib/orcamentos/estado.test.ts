import assert from 'node:assert/strict';
import { test } from 'node:test';
import { deriveEstadoOrcamento, rotuloEstado } from './estado';

type Entrada = Parameters<typeof deriveEstadoOrcamento>[0];
const entrada = (patch: Partial<Entrada> = {}): Entrada => ({
  valorAcordado: null, desconto: 0, cobrancas: [],
  itens: [{ precoTotal: 400, aprovado: true }],
  pagamentos: [{ valor: 360, status: 'pago' }], ...patch,
});

test('desconto global de 40 e recebimento de 360 quitam orçamento de 400', () => {
  const estado = deriveEstadoOrcamento(entrada({ desconto: 40 }));
  assert.deepEqual(estado, { valorAprovado: 400, valorDevido: 360, valorPago: 360, estado: 'quitado' });
  assert.equal(rotuloEstado(estado), 'Quitado');
});

test('desconto da etapa também reduz o saldo geral', () => {
  assert.equal(deriveEstadoOrcamento(entrada({ cobrancas: [{ desconto: 40, situacao: 'aberta' }] })).estado, 'quitado');
});

test('pagamento menor sem desconto continua parcial', () => {
  const estado = deriveEstadoOrcamento(entrada());
  assert.equal(estado.estado, 'aceito');
  assert.equal(estado.valorDevido - estado.valorPago, 40);
  assert.match(rotuloEstado(estado), /40,00/);
});

test('recebimento parcial desconta apenas o dinheiro confirmado', () => {
  const estado = deriveEstadoOrcamento(entrada({ desconto: 40, pagamentos: [
    { valor: 300, status: 'pago' }, { valor: 60, status: 'pendente' }, { valor: 40, status: 'cancelado' },
  ] }));
  assert.equal(estado.valorDevido - estado.valorPago, 60);
  assert.equal(estado.estado, 'aceito');
});

test('acordo explícito prevalece sem descontar duas vezes', () => {
  assert.equal(deriveEstadoOrcamento(entrada({ valorAcordado: 360, desconto: 40,
    cobrancas: [{ desconto: 40, situacao: 'aberta' }],
  })).valorDevido, 360);
});

test('soma descontos abertos e ignora cancelados', () => {
  const cobrancas = [{ desconto: 10, situacao: 'aberta' }, { desconto: 30, situacao: 'aberta' },
    { desconto: 200, situacao: 'cancelada' }];
  assert.equal(deriveEstadoOrcamento(entrada({ cobrancas })).estado, 'quitado');
  cobrancas[1].situacao = 'cancelada';
  assert.equal(deriveEstadoOrcamento(entrada({ cobrancas })).valorDevido, 390);
});

test('não cobra itens não aprovados e limita desconto ao aprovado', () => {
  const estado = deriveEstadoOrcamento(entrada({ desconto: 40,
    itens: [{ precoTotal: 400, aprovado: true }, { precoTotal: 500, aprovado: false }],
  }));
  assert.equal(estado.valorDevido, 360);
  assert.equal(deriveEstadoOrcamento(entrada({ desconto: 500 })).valorDevido, 0);
  assert.equal(deriveEstadoOrcamento(entrada({ itens: [], desconto: 40 })).estado, 'proposto');
});

test('parcelas em centavos não deixam saldo fantasma por float', () => {
  const estado = deriveEstadoOrcamento(entrada({ desconto: null,
    itens: [{ precoTotal: 0.1, aprovado: true }, { precoTotal: 0.2, aprovado: true }],
    pagamentos: [{ valor: 0.3, status: 'pago' }],
  }));
  assert.equal(estado.valorDevido, 0.3);
  assert.equal(estado.estado, 'quitado');
});

test('etapas históricas usam o desconto da obrigação, sem acumular o global da proposta', () => {
  assert.equal(deriveEstadoOrcamento(entrada({ desconto: 40,
    cobrancas: [{ desconto: 0, situacao: 'aberta' }],
  })).valorDevido, 400);
  assert.equal(deriveEstadoOrcamento(entrada({ desconto: 40,
    cobrancas: [{ desconto: 40, situacao: 'aberta' }],
  })).valorDevido, 360);
});

test('cancelar a última etapa volta ao desconto global, inclusive com etapa parcial', () => {
  const cobrancas = [{ desconto: 20, situacao: 'aberta' }];
  assert.equal(deriveEstadoOrcamento(entrada({ desconto: 100, cobrancas })).valorDevido, 380);
  cobrancas[0].situacao = 'cancelada';
  assert.equal(deriveEstadoOrcamento(entrada({ desconto: 100, cobrancas })).valorDevido, 300);
});
