/**
 * R-58 — testes de `eventosParaCards`, extraído de FichasTab.tsx. Roda sem framework:
 *   node --test src/lib/odontograma/eventos-para-cards.test.ts
 * O agrupamento em si (ordem, chave) já é coberto por agrupar-registros.test.ts — aqui só o
 * que esta função ACRESCENTA: a montagem do RegistroCardData por grupo.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { eventosParaCards, type EventoParaCard } from './eventos-para-cards.ts';

const evento = (over: Partial<EventoParaCard> & { id: string }): EventoParaCard => ({
  grupoId: null,
  tipo: 'carie_restauracao',
  status: 'indicado',
  origem: 'clinica',
  ancora: { nivel: 'dente', dente: 15 },
  observacao: null,
  detalhe: null,
  realizadoEm: null,
  registradoEm: '2026-08-04T10:00:00.000Z',
  assinaturaId: null,
  encaminhadoPara: null,
  ...over,
});

test('eventosParaCards: evento isolado vira 1 card com 1 âncora', () => {
  const r = eventosParaCards([evento({ id: 'a', ancora: { nivel: 'dente', dente: 15 } })], 'Dra. Ana', 'CRO-1');
  assert.equal(r.length, 1);
  assert.deepEqual(r[0].ids, ['a']);
  assert.equal(r[0].data.ancoras.length, 1);
  assert.equal(r[0].data.ancoras[0].dente, 15);
});

test('eventosParaCards: preserva o nome-snapshot do procedimento livre', () => {
  const r = eventosParaCards([
    evento({ id: 'livre', tipo: 'outro', procedimentoNome: 'Troca de curativo' }),
  ], 'Dra. Ana', null);

  assert.equal(r[0].data.procedimentoNome, 'Troca de curativo');
});

test('intervenções livres distintas na mesma arcada aparecem em cards separados', () => {
  const r = eventosParaCards([
    evento({ id: 'provisoria', tipo: 'outro', ancora: { nivel: 'arcada', arcada: 'inferior' }, procedimentoNome: 'Prótese protocolo inferior provisória' }),
    evento({ id: 'definitiva', tipo: 'outro', ancora: { nivel: 'arcada', arcada: 'inferior' }, procedimentoNome: 'Prótese protocolo inferior definitiva' }),
    evento({ id: 'total', tipo: 'outro', ancora: { nivel: 'arcada', arcada: 'inferior' }, observacao: 'Prótese total inferior' }),
  ], 'Dentista de teste', null);
  assert.equal(r.length, 3);
  assert.ok(r.every((card) => card.ids.length === 1));
});

test('eventosParaCards: mesmo grupoId vira 1 card com N âncoras (multi-dente)', () => {
  const r = eventosParaCards(
    [
      evento({ id: 'a', grupoId: 'g1', ancora: { nivel: 'dente', dente: 31 } }),
      evento({ id: 'b', grupoId: 'g1', ancora: { nivel: 'dente', dente: 41 } }),
    ],
    'Dra. Ana', null,
  );
  assert.equal(r.length, 1);
  assert.deepEqual(r[0].ids.sort(), ['a', 'b']);
  assert.equal(r[0].data.ancoras.length, 2);
});

test('eventosParaCards: grupo com status diferentes é explicitamente misto', () => {
  const r = eventosParaCards(
    [
      evento({ id: 'a', grupoId: 'g1', status: 'indicado' }),
      evento({ id: 'b', grupoId: 'g1', status: 'realizado' }),
    ],
    'Dra. Ana', null,
  );

  assert.equal(r[0].data.statusMisto, true);
});

test('grupo sem localização só aparece como próxima sessão quando todos os itens foram priorizados', () => {
  const r = eventosParaCards([
    evento({ id: 'a', grupoId: 'grupo', ancora: { nivel: 'geral' }, momentoPlanejado: 'proxima_sessao' }),
    evento({ id: 'b', grupoId: 'grupo', ancora: { nivel: 'geral' }, momentoPlanejado: 'sessao_atual' }),
  ], 'Dra. Ana', null);

  assert.equal(r[0]?.data.momentoPlanejado, 'sessao_atual');
});

test('grupo sem localização mantém próxima sessão quando a priorização é unânime', () => {
  const r = eventosParaCards([
    evento({ id: 'a', grupoId: 'grupo', ancora: { nivel: 'geral' }, momentoPlanejado: 'proxima_sessao' }),
    evento({ id: 'b', grupoId: 'grupo', ancora: { nivel: 'geral' }, momentoPlanejado: 'proxima_sessao' }),
  ], 'Dra. Ana', null);

  assert.equal(r[0]?.data.momentoPlanejado, 'proxima_sessao');
});

test('eventosParaCards: assinada é true sse o PRIMEIRO do grupo tem assinaturaId', () => {
  const assinado = eventosParaCards([evento({ id: 'a', assinaturaId: 'assin-1' })], 'Dra. Ana', null);
  const semAssinatura = eventosParaCards([evento({ id: 'b' })], 'Dra. Ana', null);
  assert.equal(assinado[0].data.assinada, true);
  assert.equal(semAssinatura[0].data.assinada, false);
});

test('eventosParaCards: autorNome/autorCro se aplicam a TODOS os cards da chamada', () => {
  const r = eventosParaCards(
    [
      evento({ id: 'a', ancora: { nivel: 'dente', dente: 11 } }),
      evento({ id: 'b', ancora: { nivel: 'dente', dente: 12 } }),
    ],
    'Dr. João', 'CRO-99',
  );
  assert.equal(r.length, 2);
  for (const card of r) {
    assert.equal(card.data.autorNome, 'Dr. João');
    assert.equal(card.data.autorCro, 'CRO-99');
  }
});

test('eventosParaCards: observacao/detalhe/realizadoEm/encaminhadoPara vêm do PRIMEIRO do grupo', () => {
  const r = eventosParaCards(
    [evento({
      id: 'a',
      observacao: 'nota clínica',
      detalhe: { canais: [] },
      realizadoEm: '2026-08-01',
      encaminhadoPara: { id: 'd2', nome: 'Dr. Outro' },
    })],
    'Dra. Ana', null,
  );
  assert.equal(r[0].data.observacao, 'nota clínica');
  assert.deepEqual(r[0].data.detalhe, { canais: [] });
  assert.equal(r[0].data.realizadoEm, '2026-08-01');
  assert.deepEqual(r[0].data.encaminhadoPara, { id: 'd2', nome: 'Dr. Outro' });
});
