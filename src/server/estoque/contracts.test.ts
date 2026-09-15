import assert from 'node:assert/strict';
import test from 'node:test';
import { z } from 'zod';
import {
  AjustarContagemSchema,
  CadastrarItemSchema,
  ConsumirMaterialSchema,
  CorrigirMovimentoSchema,
  createEstoqueResultSchema,
  DescartarMaterialSchema,
  DetalharEstoqueSchema,
  EditarItemSchema,
  ItemResumoSchema,
  IsoCalendarDateSchema,
  LoteResumoSchema,
  ListarEstoqueSchema,
  MutacaoEstoqueResultDataSchema,
  ReceberMaterialSchema,
  SignedDecimalSchema,
  SignedNonZeroDecimalSchema,
  TitularEstoqueSchema,
} from './contracts.ts';

const CLINICA_ID = '11111111-1111-4111-8111-111111111111';
const ITEM_ID = '22222222-2222-4222-8222-222222222222';
const LOTE_ID = '33333333-3333-4333-8333-333333333333';
const DENTISTA_ID = '44444444-4444-4444-8444-444444444444';
const CHAVE_ID = '55555555-5555-4555-8555-555555555555';

const context = { clinicaIdEsperada: CLINICA_ID, chaveIdempotencia: CHAVE_ID };

test('cadastrar item aceita somente consumível, titular válido e mínimo decimal canônico', () => {
  const parsed = CadastrarItemSchema.parse({
    ...context,
    titular: { tipo: 'dentista', dentistaId: DENTISTA_ID.toUpperCase() },
    nome: '  Luva de procedimento  ',
    unidadeBase: 'unidade',
    comportamento: 'consumivel',
    controlaLote: true,
    minimo: '0.5',
  });

  assert.equal(parsed.titular.tipo, 'dentista');
  if (parsed.titular.tipo === 'dentista') {
    assert.equal(parsed.titular.dentistaId, DENTISTA_ID);
  }
  assert.equal(parsed.nome, 'Luva de procedimento');
  assert.equal(CadastrarItemSchema.safeParse({
    ...parsed,
    comportamento: 'reutilizavel',
  }).success, false);
  assert.equal(CadastrarItemSchema.safeParse({ ...parsed, saldo: '10' }).success, false);
});

test('quantidades rejeitam float semântico, notação, zeros não canônicos e precisão fora de NUMERIC(18,6)', () => {
  const base = {
    ...context,
    itemId: ITEM_ID,
    loteId: LOTE_ID,
    versaoEsperada: 1,
    quantidade: '1',
    motivo: 'Consumo conferido',
  };

  for (const quantidade of ['1.0', '01', '1e2', '0', '0.000000', '1234567890123', '0.1234567']) {
    assert.equal(ConsumirMaterialSchema.safeParse({ ...base, quantidade }).success, false, quantidade);
  }
  assert.equal(ConsumirMaterialSchema.safeParse(base).success, true);
});

test('recebimento exige exatamente lote existente ou novo lote', () => {
  const base = {
    ...context,
    itemId: ITEM_ID,
    versaoEsperada: 1,
    quantidadeBase: '200',
  };

  assert.equal(ReceberMaterialSchema.safeParse(base).success, false);
  assert.equal(ReceberMaterialSchema.safeParse({ ...base, loteId: LOTE_ID, novoLote: {
    codigoFabricante: null,
    validadeISO: null,
  } }).success, false);
  assert.equal(ReceberMaterialSchema.safeParse({
    ...base,
    novoLote: { codigoFabricante: null, validadeISO: '2028-02-29' },
  }).success, true);
});

test('recebimento confere conversão de embalagem sem usar float', () => {
  const base = {
    ...context,
    itemId: ITEM_ID,
    loteId: LOTE_ID,
    versaoEsperada: 1,
    quantidadeBase: '200',
    embalagemConferida: {
      quantidadeEmbalagens: '2',
      quantidadePorEmbalagem: '100',
      unidadeBase: 'unidade',
    },
  };

  assert.equal(ReceberMaterialSchema.safeParse(base).success, true);
  assert.equal(ReceberMaterialSchema.safeParse({
    ...base,
    embalagemConferida: { ...base.embalagemConferida, quantidadePorEmbalagem: '99' },
  }).success, false);
  assert.equal(ReceberMaterialSchema.safeParse({
    ...base,
    embalagemConferida: {
      quantidadeEmbalagens: '0.1',
      quantidadePorEmbalagem: '0.1',
      unidadeBase: 'unidade',
    },
    quantidadeBase: '0.01',
  }).success, true);
});

test('recebimento inválido não alcança BigInt no refinamento de conversão', () => {
  const base = {
    ...context,
    itemId: ITEM_ID,
    loteId: LOTE_ID,
    versaoEsperada: 1,
    embalagemConferida: {
      quantidadeEmbalagens: '2',
      quantidadePorEmbalagem: '100',
      unidadeBase: 'unidade',
    },
  };

  for (const input of [
    { ...base, quantidadeBase: 'x' },
    {
      ...base,
      quantidadeBase: '200',
      embalagemConferida: { ...base.embalagemConferida, quantidadePorEmbalagem: 'x' },
    },
    { ...base, quantidadeBase: '9'.repeat(10_000) },
  ]) {
    assert.doesNotThrow(() => ReceberMaterialSchema.safeParse(input));
    assert.equal(ReceberMaterialSchema.safeParse(input).success, false);
  }
});

test('validade exige calendário ISO real, sem regra dependente do relógio', () => {
  assert.equal(IsoCalendarDateSchema.safeParse('2028-02-29').success, true);
  assert.equal(IsoCalendarDateSchema.safeParse('2027-02-29').success, false);
  assert.equal(IsoCalendarDateSchema.safeParse('2028-2-9').success, false);
  assert.equal(IsoCalendarDateSchema.safeParse('2028-02-29T00:00:00Z').success, false);
});

test('consumo, descarte e ajuste aceitam somente os fatos mínimos e contagem pode ser zero', () => {
  const movement = {
    ...context,
    itemId: ITEM_ID,
    loteId: LOTE_ID,
    versaoEsperada: 3,
    quantidade: '2.5',
    motivo: 'Validade expirada',
  };
  assert.equal(ConsumirMaterialSchema.safeParse(movement).success, true);
  assert.equal(DescartarMaterialSchema.safeParse(movement).success, true);
  assert.equal(DescartarMaterialSchema.safeParse({ ...movement, atorUsuarioId: CLINICA_ID }).success, false);
  assert.equal(AjustarContagemSchema.safeParse({
    ...context,
    itemId: ITEM_ID,
    loteId: LOTE_ID,
    versaoEsperada: 3,
    quantidadeContada: '0',
    motivo: 'Contagem física',
  }).success, true);
});

test('edição não recebe titularidade ou unidade e resultado tem envelope estrito', () => {
  const edit = {
    ...context,
    itemId: ITEM_ID,
    versaoEsperada: 2,
    nome: 'Luva nitrílica',
    minimo: '10',
    ativo: true,
    motivo: 'Correção do mínimo',
  };
  assert.equal(EditarItemSchema.safeParse(edit).success, true);
  assert.equal(EditarItemSchema.safeParse({ ...edit, titular: { tipo: 'clinica' } }).success, false);
  assert.equal(TitularEstoqueSchema.safeParse({ tipo: 'clinica', dentistaId: DENTISTA_ID }).success, false);
  assert.equal(ReceberMaterialSchema.safeParse({
    ...context,
    itemId: ITEM_ID,
    versaoEsperada: 1,
    quantidadeBase: '1',
    novoLote: { codigoFabricante: 'x'.repeat(121), validadeISO: null },
  }).success, false);

  const resultSchema = createEstoqueResultSchema(z.string());
  assert.equal(resultSchema.safeParse({ ok: true, data: 'feito' }).success, true);
  assert.equal(resultSchema.safeParse({ ok: false, codigo: 'SEM_ACESSO', mensagem: 'Negado' }).success, true);
  assert.equal(resultSchema.safeParse({ ok: false, codigo: 'SEM_ACESSO', mensagem: 'Negado', extra: true }).success, false);
});

test('recebimento vencido e correção exigem confirmação e motivo pareados', () => {
  const expiredReceive = {
    ...context,
    itemId: ITEM_ID,
    versaoEsperada: 1,
    quantidadeBase: '10',
    novoLote: { codigoFabricante: 'L-1', validadeISO: '2000-01-01' },
  };
  assert.equal(ReceberMaterialSchema.safeParse(expiredReceive).success, false);
  assert.equal(ReceberMaterialSchema.safeParse({
    ...expiredReceive,
    aceitarVencido: true,
    motivoVencido: 'Conferido para descarte',
  }).success, true);
  assert.equal(ReceberMaterialSchema.safeParse({
    ...expiredReceive,
    aceitarVencido: true,
  }).success, false);

  const correction = {
    ...context,
    itemId: ITEM_ID,
    movimentoId: LOTE_ID,
    versaoEsperada: 2,
    motivo: 'Quantidade corrigida',
    substituicao: { tipo: 'entrada', quantidade: '8' },
  };
  assert.equal(CorrigirMovimentoSchema.safeParse(correction).success, true);
  assert.equal(CorrigirMovimentoSchema.safeParse({
    ...correction,
    motivoVencido: 'Lote vencido confirmado',
  }).success, false);
  assert.equal(CorrigirMovimentoSchema.safeParse({
    ...correction,
    aceitarVencido: true,
    motivoVencido: 'Lote vencido confirmado',
  }).success, true);
});

test('leitura limita paginação, normaliza defaults e separa saldo de quantidade assinada', () => {
  const list = ListarEstoqueSchema.parse({
    clinicaIdEsperada: CLINICA_ID.toUpperCase(),
    titular: { tipo: 'clinica' },
  });
  assert.deepEqual(list, {
    clinicaIdEsperada: CLINICA_ID,
    titular: { tipo: 'clinica' },
    busca: '',
    filtro: 'todos',
    cursor: null,
    limite: 25,
  });
  assert.equal(ListarEstoqueSchema.safeParse({ ...list, limite: 51 }).success, false);
  assert.equal(ListarEstoqueSchema.safeParse({ ...list, busca: 'x'.repeat(121) }).success, false);
  assert.equal(DetalharEstoqueSchema.safeParse({
    clinicaIdEsperada: CLINICA_ID,
    itemId: ITEM_ID,
    cursor: { ocorridoEm: '2026-09-12', id: LOTE_ID },
  }).success, false);
  assert.equal(SignedNonZeroDecimalSchema.safeParse('-0.25').success, true);
  assert.equal(SignedNonZeroDecimalSchema.safeParse('0').success, false);
  assert.equal(SignedNonZeroDecimalSchema.safeParse('-0').success, false);
  assert.equal(SignedNonZeroDecimalSchema.safeParse('1.0').success, false);
});

test('DTOs de saldo preservam divergência decimal assinada, inclusive em resultados de operação', () => {
  assert.equal(SignedDecimalSchema.safeParse('-2.25').success, true);
  assert.equal(SignedDecimalSchema.safeParse('0').success, true);
  assert.equal(SignedDecimalSchema.safeParse('-0').success, false);
  assert.equal(ItemResumoSchema.safeParse({
    id: ITEM_ID,
    nome: 'Gaze',
    unidadeBase: 'unidade',
    titular: { tipo: 'clinica' },
    controlaLote: true,
    minimo: '10',
    saldo: '-2',
    ativo: true,
    versao: 2,
    validadeProxima: null,
  }).success, true);
  assert.equal(LoteResumoSchema.safeParse({
    id: LOTE_ID,
    codigoFabricante: null,
    validadeISO: null,
    semIdentificacao: true,
    saldo: '-2',
  }).success, true);
  assert.equal(MutacaoEstoqueResultDataSchema.safeParse({
    itemId: ITEM_ID,
    loteId: LOTE_ID,
    movimentoId: null,
    saldo: '-2',
    versao: 3,
  }).success, true);
});
