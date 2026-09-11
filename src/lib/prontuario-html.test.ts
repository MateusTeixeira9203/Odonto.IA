import assert from 'node:assert/strict';
import test from 'node:test';
import { buildProntuarioHTML, buildOrcamentoHTML, type PacienteExport, type OrcamentoHtmlData } from './prontuario-html';

const paciente: PacienteExport = {
  nome: 'Paciente Teste',
  cpf: null,
  email: null,
  telefone: null,
  data_nascimento: null,
  endereco: null,
  cidade: null,
  estado: null,
  created_at: '2026-01-01T00:00:00Z',
};

test('exportação acrescenta Atendimentos e preserva Fichas Clínicas', () => {
  const html = buildProntuarioHTML(paciente, [], [], [], [{
    data: '2026-08-31',
    fonte: 'moderna',
    profissionalNome: 'Dra. Ana',
    evolucoes: [{ fichaNome: 'Reabilitação', texto: 'Evolução revisada' }],
    procedimentos: [{ nome: 'Restauração', localizacao: 'Dente 46', status: 'realizado' }],
  }]);

  assert.match(html, /Atendimentos/);
  assert.match(html, /Evolução revisada/);
  assert.match(html, /Fichas Clínicas/);
});

test('documento mostra desconto da etapa e não imprime previsão cancelada como pendente', () => {
  const orcamento: OrcamentoHtmlData = {
    id: 'orcamento-qa', created_at: '2026-09-11T15:00:00Z', status: 'rascunho',
    total: 400, valor_acordado: null, desconto: 0, validade_dias: 30,
    condicoes_pagamento: null, mostrar_valor_por_item: true,
    paciente: { nome: 'Paciente fictício', telefone: null }, dentista: { nome: 'Dentista fictício' },
    cobrancas: [{ desconto: 40, situacao: 'aberta' }],
    itens: [{ descricao: 'Procedimento', quantidade: 1, preco_unitario: 400, preco_total: 400, aprovado: true }],
    pagamentos: [
      { valor: 360, status: 'cancelado', forma_pagamento: null, data_pagamento: null },
      { valor: 360, status: 'pago', forma_pagamento: 'pix', data_pagamento: '2026-09-11' },
    ],
  };
  const html = buildOrcamentoHTML(orcamento);
  assert.match(html, /Quitado/);
  assert.match(html, /Desconto/);
  assert.match(html, /40,00/);
  assert.match(html, /360,00/);
  assert.doesNotMatch(html, />Pendente/);
  assert.equal((html.match(/class="orc-payment-card /g) ?? []).length, 1);
});
