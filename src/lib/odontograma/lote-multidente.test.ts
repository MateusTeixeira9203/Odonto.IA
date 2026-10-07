import { test } from 'node:test';
import assert from 'node:assert/strict';
import { acrescentarRestauracoesDoLote, eventosDoLoteRestauracao } from './lote-multidente.ts';
import { montarRowsEventos } from './montar-rows-eventos.ts';
import type { ContextoLancamento } from './criar-eventos-contextuais.ts';
import type { OdontogramaEventoDraft } from '@/types/odontograma';

const data = '2026-10-06';
const autor = 'dentista-qa';
const contexto: ContextoLancamento = { capturaId: 'qa-r185', modo: 'a_fazer' };

function lote(
  dentes: number[] = [15, 25],
  faces: Array<'V' | 'O' | 'M'> = ['V', 'O'],
  opcoes: { data?: string; autor?: string; contexto?: ContextoLancamento } = {},
): OdontogramaEventoDraft[] {
  return faces.flatMap((face) => eventosDoLoteRestauracao(
    face, dentes, opcoes.data ?? data, opcoes.contexto ?? contexto, opcoes.autor ?? autor,
  ));
}

test('primeira aplicação 2 dentes x 2 faces e sete reaplicações mantêm quatro IDs', () => {
  let atual = acrescentarRestauracoesDoLote([], lote());
  assert.equal(atual.length, 4);
  assert.equal(new Set(atual.map((e) => `${e.ancora.dente}:${e.ancora.faces?.join(',')}`)).size, 4);
  const ids = atual.map((e) => e.id);
  for (let i = 0; i < 7; i += 1) {
    atual = acrescentarRestauracoesDoLote(atual, lote());
    assert.deepEqual(atual.map((e) => e.id), ids);
  }
});

test('atualizações funcionais enfileiradas contra o mesmo render não duplicam', () => {
  let atual: OdontogramaEventoDraft[] = [];
  const propostasA = lote();
  const propostasB = lote();
  const fila = [
    (estado: OdontogramaEventoDraft[]) => acrescentarRestauracoesDoLote(estado, propostasA),
    (estado: OdontogramaEventoDraft[]) => acrescentarRestauracoesDoLote(estado, propostasB),
  ];
  for (const atualizar of fila) atual = atualizar(atual);
  assert.equal(atual.length, 4);
  assert.deepEqual(atual.map((e) => e.id), propostasA.map((e) => e.id));
});

test('sobreposição parcial só acrescenta dente/face ainda ausente', () => {
  const primeiro = acrescentarRestauracoesDoLote([], lote([15], ['V', 'O']));
  const atual = acrescentarRestauracoesDoLote(primeiro, lote([15, 25], ['V', 'O', 'M']));
  assert.equal(atual.length, 6);
  assert.deepEqual(atual.slice(0, 2), primeiro);
});

test('diferenças clínicas explícitas são eventos distintos', () => {
  const original = lote([15], ['V'])[0];
  const casos: Array<[string, OdontogramaEventoDraft]> = [
    ['dente', lote([25], ['V'])[0]],
    ['face', lote([15], ['O'])[0]],
    ['data', lote([15], ['V'], { data: '2026-10-07' })[0]],
    ['momento', lote([15], ['V'], { contexto: { ...contexto, modo: 'proxima_sessao' } })[0]],
    ['realização', lote([15], ['V'], { contexto: { ...contexto, modo: 'realizado_hoje' } })[0]],
    ['origem', lote([15], ['V'], { contexto: { ...contexto, modo: 'preexistente' } })[0]],
    ['autor', lote([15], ['V'], { autor: 'dentista-outro' })[0]],
    ['encaminhamento', lote([15], ['V'], { contexto: { ...contexto, encaminharParaId: 'dentista-destino' } })[0]],
    ['procedimento', { ...lote([15], ['V'])[0], procedimentoNome: 'Restauro indireto' }],
    ['grupo', { ...lote([15], ['V'])[0], grupo_id: 'grupo-distinto' }],
    ['observação', { ...lote([15], ['V'])[0], observacao: 'cavidade profunda' }],
    ['detalhe', { ...lote([15], ['V'])[0], detalhe: { material: 'resina A' } }],
  ];
  for (const [nome, candidato] of casos) {
    assert.equal(acrescentarRestauracoesDoLote([original], [candidato]).length, 2, nome);
  }
});

test('assinado e evento com identidade clínica incompleta nunca bloqueiam proposta', () => {
  const original = lote([15], ['V'])[0];
  const novo = lote([15], ['V'])[0];
  assert.equal(acrescentarRestauracoesDoLote([{ ...original, assinaturaId: 'assinatura' }], [novo]).length, 2);
  assert.equal(acrescentarRestauracoesDoLote([{ ...original, autorDentistaId: undefined }], [novo]).length, 2);
  assert.equal(acrescentarRestauracoesDoLote([{ ...original, dataIntencao: undefined, realizado_em: null }], [novo]).length, 2);
  assert.equal(acrescentarRestauracoesDoLote([original], [{ ...novo, autorDentistaId: undefined }]).length, 2);
});

test('data clínica editada em realizado distingue nova aplicação e chega ao payload', () => {
  const contextoRealizado: ContextoLancamento = { ...contexto, modo: 'realizado_hoje' };
  const original = lote([15], ['V'], { contexto: contextoRealizado })[0];
  const mesmaData = lote([15], ['V'], { contexto: contextoRealizado })[0];
  assert.equal(acrescentarRestauracoesDoLote([original], [mesmaData]).length, 1);

  const editado = { ...original, realizado_em: '2026-10-05' };
  const atual = acrescentarRestauracoesDoLote([editado], [mesmaData]);
  assert.equal(atual.length, 2);
  assert.deepEqual(atual.map((e) => e.realizado_em), ['2026-10-05', '2026-10-06']);
  const payload = montarRowsEventos(atual, {
    clinicId: 'clinica-qa', pacienteId: 'paciente-qa', dentistaId: autor, fichaId: 'ficha-qa',
  });
  assert.deepEqual(payload.map((row) => row.realizado_em), ['2026-10-05', '2026-10-06']);
  assert.equal(acrescentarRestauracoesDoLote([{ ...original, realizado_em: null }], [mesmaData]).length, 2);
});

test('payload da Ficha mantém restaurações distintas com a mesma contagem do draft', () => {
  const primeiro = lote([15], ['V'])[0];
  const outraData = lote([15], ['V'], { data: '2026-10-07' })[0];
  const repeticao = lote([15], ['V'])[0];
  const atual = acrescentarRestauracoesDoLote([primeiro, outraData], [repeticao]);
  assert.equal(atual.length, 2);
  const payload = montarRowsEventos(atual, {
    clinicId: 'clinica-qa', pacienteId: 'paciente-qa', dentistaId: autor, fichaId: 'ficha-qa',
  });
  assert.deepEqual(payload.map((row) => row.id), [primeiro.id, outraData.id]);
  assert.equal(payload.length, 2);
  assert.ok(payload.every((row) => !('autorDentistaId' in row) && !('dataIntencao' in row)));
});
