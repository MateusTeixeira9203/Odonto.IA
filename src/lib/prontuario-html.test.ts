import assert from 'node:assert/strict';
import test from 'node:test';
import { buildFichaHTML, buildProntuarioHTML, buildOrcamentoHTML, evolucoesParaImpressao, registradaAposAssinatura, type FichaComPaciente, type PacienteExport, type OrcamentoHtmlData } from './prontuario-html';

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

const ficha: FichaComPaciente = {
  id: 'ficha-qa', created_at: '2026-10-20T12:00:00Z', data_atendimento: '2026-10-20',
  queixa_principal: null, anotacoes: 'QA texto antigo', dentes_afetados: null,
  dentes_observacoes: null, procedimentos_concluidos: null,
  assinatura_url: null, assinado_em: null, dentista: { nome: 'Dentista fictício' },
  paciente: { nome: 'Paciente fictício', data_nascimento: null },
};

const fichaComEvolucao = {
  ...ficha,
  evolucoes: [{ data: '2026-10-20', texto: 'QA texto vigente', automatica: false }],
};

test('PDF da Ficha imprime a evolução vigente, não a anotação antiga', () => {
  const html = buildFichaHTML(fichaComEvolucao);
  assert.ok(html.includes('QA texto vigente'), 'deve imprimir o texto vigente');
  assert.ok(!html.includes('QA texto antigo'), 'não deve imprimir a anotação antiga');
});

test('Fichas Clínicas do prontuário usa a evolução vigente', () => {
  const html = buildProntuarioHTML(paciente, [fichaComEvolucao], [], [], []);
  assert.ok(html.includes('QA texto vigente'), 'deve imprimir o texto vigente');
  assert.ok(!html.includes('QA texto antigo'), 'não deve imprimir a anotação antiga');
});

test('ficha legada sem evolução continua imprimindo Anotações', () => {
  for (const legado of [{ ...ficha, anotacoes: 'Texto legado' }, { ...ficha, anotacoes: 'Texto legado', evolucoes: [] }]) {
    const html = buildFichaHTML(legado);
    assert.ok(html.includes('Anotações'));
    assert.ok(html.includes('Texto legado'));
  }
});

test('evoluções são ordenadas por data sem mutar a entrada e preservam a ordem nos empates', () => {
  const evolucoes = [
    { data: '2026-10-21', texto: 'Segunda sessão', automatica: false },
    { data: '2026-10-20', texto: 'Primeira sessão', automatica: true },
    { data: '2026-10-21', texto: 'Terceira sessão', automatica: false },
  ];
  const original = structuredClone(evolucoes);
  assert.deepEqual(evolucoesParaImpressao({ ...ficha, evolucoes }), {
    titulo: 'Evolução clínica', itens: [evolucoes[1], evolucoes[0], evolucoes[2]],
  });
  assert.deepEqual(evolucoes, original);
});

test('evoluções ignoram texto vazio ou nulo e preservam texto e data nula válidos', () => {
  const resultado = evolucoesParaImpressao({ ...ficha, evolucoes: [
    { data: '2026-10-21', texto: null, automatica: false },
    { data: '2026-10-21', texto: ' \n ', automatica: false },
    { data: null, texto: ' Texto vigente sem data ', automatica: true },
  ] });
  assert.deepEqual(resultado, {
    titulo: 'Evolução clínica',
    itens: [{ data: null, texto: ' Texto vigente sem data ', automatica: true }],
  });
});

test('sem evolução textual usa o legado; sem qualquer texto devolve null', () => {
  const evolucoes = [{ data: null, texto: null, automatica: false }];
  assert.equal(evolucoesParaImpressao({ ...ficha, evolucoes })?.titulo, 'Anotações');
  assert.equal(evolucoesParaImpressao({ ...ficha, anotacoes: null, evolucoes }), null);
  assert.equal(evolucoesParaImpressao({ ...ficha, anotacoes: ' \n ', evolucoes: [] }), null);
});

test('impressão marca registro automático e escapa o texto vigente e a data', () => {
  const html = buildFichaHTML({ ...ficha, evolucoes: [{
    data: '2026-10-20<script>', texto: '<script>QA</script> & "texto"', automatica: true,
  }] });
  assert.ok(html.includes('(registro automático)'));
  assert.ok(html.includes('&lt;script&gt;QA&lt;/script&gt; &amp; &quot;texto&quot;'));
  assert.ok(html.includes('20&lt;script&gt;/10/2026'));
  assert.ok(!html.includes('<script>'));
});

test('ficha assinada imprime as duas evoluções vigentes sem recuperar anotações antigas', () => {
  const html = buildFichaHTML({ ...ficha, assinado_em: '2026-10-21T12:45:00Z', evolucoes: [
    { data: '2026-10-21', texto: 'Sessão S2 vigente', automatica: false },
    { data: '2026-10-15', texto: 'Sessão S1 vigente', automatica: false },
  ] });
  assert.ok(html.includes('15/10/2026 — Sessão S1 vigente'));
  assert.ok(html.includes('21/10/2026 — Sessão S2 vigente'));
  assert.ok(html.indexOf('Sessão S1 vigente') < html.indexOf('Sessão S2 vigente'));
  assert.ok(html.includes('Assinado digitalmente'));
  assert.ok(!html.includes('QA texto antigo'));
});

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

test('modo administrativo omite seções clínicas mesmo recebendo conteúdo clínico', () => {
  const html = buildProntuarioHTML(paciente, [{ ...fichaComEvolucao,
    evolucoes: [{ data: '2026-10-20', texto: 'QA evolucao clinica', automatica: false }],
  }], [{
    id: 'orcamento-administrativo-qa', status: 'rascunho', total: 150,
    valor_acordado: null, desconto: 0, cobrancas: [], created_at: '2026-10-20T12:00:00Z',
    condicoes_pagamento: null,
    orcamento_itens: [{ descricao: 'QA item orcamento', quantidade: 1, preco_total: 150, aprovado: true }],
    pagamentos: [],
  }], [{
    data_hora: '2026-11-04T15:00:00Z', status: 'scheduled',
    observacoes: 'QA observacao administrativa da agenda', dentista: { nome: 'Dentista fictício' },
  }], [{
    data: '2026-10-20', fonte: 'moderna', profissionalNome: 'Dentista fictício',
    evolucoes: [{ fichaNome: 'QA ficha clinica', texto: 'QA atendimento clinico' }],
    procedimentos: [{ nome: 'QA procedimento clinico', localizacao: 'Dente 16', status: 'realizado' }],
  }], { modo: 'administrativo' });
  for (const texto of ['QA evolucao clinica', 'QA atendimento clinico', 'QA procedimento clinico', 'QA texto antigo', 'Fichas Clínicas', 'Atendimentos']) {
    assert.ok(!html.includes(texto), `não deve expor ${texto}`);
  }
  for (const texto of ['Paciente Teste', 'QA item orcamento', 'Orçamentos', 'Consultas', 'QA observacao administrativa da agenda', 'Versão administrativa: sem dados clínicos.']) {
    assert.ok(html.includes(texto), `deve manter ${texto}`);
  }
});

test('modo completo explícito mantém as seções e evoluções como o padrão', () => {
  const padrao = buildProntuarioHTML(paciente, [fichaComEvolucao], [], []);
  const completo = buildProntuarioHTML(paciente, [fichaComEvolucao], [], [], [], { modo: 'completo' });
  for (const html of [padrao, completo]) {
    assert.ok(html.includes('Fichas Clínicas'));
    assert.ok(html.includes('Atendimentos'));
    assert.ok(html.includes('QA texto vigente'));
    assert.ok(!html.includes('Versão administrativa'));
  }
});

const fichaAposAssinatura: FichaComPaciente = {
  ...ficha,
  assinado_em: '2026-10-21T12:45:00Z',
  evolucoes: [
    { data: '2026-10-21', texto: 'QA S1 antes da assinatura', automatica: false, criadoEm: '2026-10-21T12:40:00Z' },
    { data: '2026-10-25', texto: 'QA S3 depois da assinatura', automatica: false, criadoEm: '2026-10-25T13:00:00Z' },
  ],
};
const rotuloAposAssinatura = '(registrado após a assinatura de 21/10/2026)';

test('registro posterior compara instantes absolutos, incluindo igualdade, nulos e datas inválidas', () => {
  const assinatura = '2026-10-21T12:45:00Z';
  for (const criadoEm of ['2026-10-21T12:40:00Z', assinatura, '2026-10-21T09:45:00-03:00', null, undefined, 'xyz']) {
    assert.equal(registradaAposAssinatura(criadoEm, assinatura), false);
  }
  assert.equal(registradaAposAssinatura('2026-10-25T10:00:00Z', assinatura), true);
  for (const assinadoEm of [null, undefined, 'xyz']) {
    assert.equal(registradaAposAssinatura('2026-10-25T10:00:00Z', assinadoEm), false);
  }
});

test('PDF rotula somente a evolução criada depois da assinatura e conserva o selo', () => {
  const html = buildFichaHTML(fichaAposAssinatura);
  assert.equal(html.split(rotuloAposAssinatura).length - 1, 1);
  assert.match(html, /QA S1 antes da assinatura<\/div>/);
  assert.ok(html.includes(`QA S3 depois da assinatura <span class="apos-assinatura">${rotuloAposAssinatura}</span>`));
  const seloAnterior = buildFichaHTML({ ...fichaAposAssinatura, evolucoes: [] }).match(/<div class="signed">.*?<\/div>/)?.[0];
  assert.ok(seloAnterior?.includes('Assinado digitalmente'));
  assert.ok(html.includes(seloAnterior));
});

test('rótulo usa a data BRT da assinatura mesmo quando UTC já é o dia seguinte', () => {
  const html = buildFichaHTML({ ...fichaAposAssinatura, assinado_em: '2026-10-22T01:30:00Z' });
  assert.ok(html.includes(rotuloAposAssinatura));
  assert.ok(!html.includes('(registrado após a assinatura de 22/10/2026)'));
});

test('sem assinatura, sem criação conhecida e anotações legadas não recebem rótulo', () => {
  for (const semRotulo of [
    { ...fichaAposAssinatura, assinado_em: null },
    { ...fichaAposAssinatura, evolucoes: [{ data: '2026-10-25', texto: 'QA sem instante', automatica: false }] },
    { ...fichaAposAssinatura, evolucoes: [] },
  ]) {
    assert.ok(!buildFichaHTML(semRotulo).includes('(registrado após a assinatura de'));
  }
  assert.deepEqual(evolucoesParaImpressao(fichaAposAssinatura)?.itens, [
    { data: '2026-10-21', texto: 'QA S1 antes da assinatura', automatica: false },
    { data: '2026-10-25', texto: 'QA S3 depois da assinatura', automatica: false, aposAssinatura: true },
  ]);
});

test('rótulo vem depois de registro automático e preserva escape do texto', () => {
  const html = buildFichaHTML({ ...fichaAposAssinatura, evolucoes: [{
    data: '2026-10-25', texto: '<QA> & "teste"', automatica: true, criadoEm: '2026-10-25T13:00:00Z',
  }] });
  assert.ok(html.includes(`&lt;QA&gt; &amp; &quot;teste&quot; (registro automático) <span class="apos-assinatura">${rotuloAposAssinatura}</span>`));
});

test('prontuário completo rotula a ficha; administrativo continua sem seção clínica', () => {
  const completo = buildProntuarioHTML(paciente, [fichaAposAssinatura], [], [], [], { modo: 'completo' });
  assert.ok(completo.includes(rotuloAposAssinatura));
  assert.ok(completo.includes('Fichas Clínicas'));
  const administrativo = buildProntuarioHTML(paciente, [fichaAposAssinatura], [], [], [], { modo: 'administrativo' });
  for (const texto of [rotuloAposAssinatura, 'QA S3 depois da assinatura', 'Fichas Clínicas']) {
    assert.ok(!administrativo.includes(texto));
  }
});
