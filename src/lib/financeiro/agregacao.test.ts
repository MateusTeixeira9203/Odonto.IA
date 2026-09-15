import assert from 'node:assert/strict';
import test from 'node:test';
import { agregarFluxoFinanceiro } from './agregacao';

test('caixa combina receita manual e pagamento confirmado sem incluir cancelado', () => {
  assert.deepEqual(agregarFluxoFinanceiro({
    receitasManuais: [{ valor: 100 }],
    pagamentos: [{ valor: 200, status: 'pago' }, { valor: 500, status: 'cancelado' }],
    despesas: [{ valor: 50 }],
  }), { receita: 300, despesas: 50, saldo: 250 });
});
