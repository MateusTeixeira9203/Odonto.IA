/**
 * R-46d D0 (gate G2) — testes do dedup/merge extraído de FichasTab.tsx. Roda sem framework:
 *   node --test src/lib/odontograma/dedup-eventos-draft.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chaveDedupEvento, dedupEventosDraft, mesclarEventosSemPerda } from './dedup-eventos-draft.ts';
import type { OdontogramaEventoDraft, OdontogramaEventoInput } from '@/types/odontograma';

const draft = (over: Partial<OdontogramaEventoDraft> & { id: string }): OdontogramaEventoDraft => ({
  tipo: 'carie_restauracao', status: 'indicado', origem: 'clinica',
  ancora: { nivel: 'dente', dente: 15 }, grupo_id: null, papel_no_grupo: null,
  observacao: '', realizado_em: null,
  ...over,
});

const input = (over: Partial<OdontogramaEventoInput> = {}): OdontogramaEventoInput => ({
  tipo: 'carie_restauracao', status: 'indicado', origem: 'clinica',
  ancora: { nivel: 'dente', dente: 15 }, grupo_id: null, papel_no_grupo: null,
  observacao: '',
  ...over,
});

test('dedupEventosDraft: mesma chave, sem assinatura — mantém o de MENOR id', () => {
  const r = dedupEventosDraft([draft({ id: 'b-maior' }), draft({ id: 'a-menor' })]);
  assert.equal(r.length, 1);
  assert.equal(r[0].id, 'a-menor');
});

test('dedupEventosDraft: evento com assinaturaId NUNCA sai, mesmo com chave repetida', () => {
  const assinado = draft({ id: 'x', assinaturaId: 'assin-1' });
  const semAssinatura = draft({ id: 'y' }); // mesma chave semântica de `assinado`
  const r = dedupEventosDraft([assinado, semAssinatura]);
  assert.equal(r.length, 2);
  assert.ok(r.some((e) => e.id === 'x' && e.assinaturaId === 'assin-1'));
  assert.ok(r.some((e) => e.id === 'y'));
});

test('dedupEventosDraft: âncoras diferentes (dente diferente) nunca colidem', () => {
  const r = dedupEventosDraft([
    draft({ id: 'a', ancora: { nivel: 'dente', dente: 15 } }),
    draft({ id: 'b', ancora: { nivel: 'dente', dente: 16 } }),
  ]);
  assert.equal(r.length, 2);
});

test('mesclarEventosSemPerda: reextração idêntica é no-op — não duplica nem substitui', () => {
  const existente = draft({ id: 'ja-no-banco', observacao: 'nota original' });
  const reextraido = input({ observacao: 'nota que a IA extraiu de novo' }); // mesma chave
  const r = mesclarEventosSemPerda([existente], [reextraido], '2026-08-04');
  assert.equal(r.length, 1);
  assert.equal(r[0].id, 'ja-no-banco');
  assert.equal(r[0].observacao, 'nota original'); // o que já existia não foi tocado
});

test('mesclarEventosSemPerda: evento novo com âncora distinta entra', () => {
  const existente = draft({ id: 'ja-no-banco', ancora: { nivel: 'dente', dente: 15 } });
  const novo = input({ ancora: { nivel: 'dente', dente: 26 } });
  const r = mesclarEventosSemPerda([existente], [novo], '2026-08-04');
  assert.equal(r.length, 2);
  assert.ok(r.some((e) => e.id === 'ja-no-banco'));
  assert.ok(r.some((e) => e.ancora.dente === 26 && e.id !== 'ja-no-banco'));
});

test('mesclarEventosSemPerda: dois eventos NOVOS com a mesma chave entre si dedup antes de entrar', () => {
  const a = input({ ancora: { nivel: 'dente', dente: 21 } });
  const b = input({ ancora: { nivel: 'dente', dente: 21 } }); // mesma chave que `a`
  const r = mesclarEventosSemPerda([], [a, b], '2026-08-04');
  assert.equal(r.length, 1);
});

test('mesclarEventosSemPerda: realizado_em só entra pra realizado+clinica (§1.10, invariante #13)', () => {
  const realizadoClinico = input({ status: 'realizado', origem: 'clinica', ancora: { nivel: 'dente', dente: 11 } });
  const indicado = input({ status: 'indicado', origem: 'clinica', ancora: { nivel: 'dente', dente: 12 } });
  const realizadoPreexistente = input({ status: 'realizado', origem: 'preexistente', ancora: { nivel: 'dente', dente: 13 } });
  const r = mesclarEventosSemPerda([], [realizadoClinico, indicado, realizadoPreexistente], '2026-08-04');
  const porDente = (d: number) => r.find((e) => e.ancora.dente === d);
  assert.equal(porDente(11)?.realizado_em, '2026-08-04');
  assert.equal(porDente(12)?.realizado_em, null);
  assert.equal(porDente(13)?.realizado_em, null);
});

test('mesclarEventosSemPerda: contexto da captura não sobrescreve status heterogêneo do Dex', () => {
  const realizado = input({
    status: 'realizado',
    origem: 'clinica',
    momento_planejado: 'sessao_atual',
    evidencia_status: 'execucao_explicita',
    ancora: { nivel: 'dente', dente: 14 },
  });
  const indicado = input({
    status: 'indicado',
    origem: 'clinica',
    momento_planejado: 'sessao_atual',
    evidencia_status: 'indicacao_explicita',
    ancora: { nivel: 'dente', dente: 46 },
  });

  const r = mesclarEventosSemPerda([], [realizado, indicado], '2026-08-28', {
    capturaId: 'captura-1',
  });
  const porDente = (d: number) => r.find((e) => e.ancora.dente === d);

  assert.equal(porDente(14)?.status, 'realizado');
  assert.equal(porDente(14)?.realizado_em, '2026-08-28');
  assert.equal(porDente(14)?.evidencia_status, 'execucao_explicita');
  assert.equal(porDente(46)?.status, 'indicado');
  assert.equal(porDente(46)?.realizado_em, null);
  assert.equal(porDente(46)?.evidencia_status, 'indicacao_explicita');
  assert.ok(porDente(14)?.chaveCaptura?.startsWith('captura-1:'));
  assert.ok(porDente(46)?.chaveCaptura?.startsWith('captura-1:'));
});

test('chaveDedupEvento: faces em ordem diferente geram a MESMA chave (sort interno)', () => {
  const e1 = draft({ id: 'a', ancora: { nivel: 'face', dente: 15, faces: ['O', 'M'] } });
  const e2 = draft({ id: 'b', ancora: { nivel: 'face', dente: 15, faces: ['M', 'O'] } });
  assert.equal(chaveDedupEvento(e1), chaveDedupEvento(e2));
});

test('Dex conserva protocolos provisório e definitivo na mesma arcada e não perde lote anterior', () => {
  const provisoria = input({ tipo: 'outro', ancora: { nivel: 'arcada', arcada: 'inferior' }, procedimentoNome: 'Prótese protocolo inferior provisória' });
  const definitiva = { ...provisoria, procedimentoNome: 'Prótese protocolo inferior definitiva' };
  const primeiroLote = mesclarEventosSemPerda([], [provisoria, definitiva], '2026-09-14', { capturaId: 'captura-1' });
  assert.equal(primeiroLote.length, 2);
  assert.equal(new Set(primeiroLote.map((evento) => evento.chaveCaptura)).size, 2);
  const segundoLote = mesclarEventosSemPerda(primeiroLote, [input({ tipo: 'implante' })], '2026-09-14');
  assert.equal(segundoLote.length, 3);
  assert.deepEqual(segundoLote.slice(0, 2), primeiroLote);
});

test('legado outro usa nome na observação para não fundir intervenções diferentes', () => {
  const resultado = mesclarEventosSemPerda([], [
    input({ tipo: 'outro', observacao: 'Osteotomia da maxila' }),
    input({ tipo: 'outro', observacao: 'Prótese total superior' }),
  ], '2026-09-14');
  assert.equal(resultado.length, 2);
});

test('mesma captura conserva a chave clínica e reaplicação mantém IDs já materializados', () => {
  const extraido = [input({ tipo: 'outro', procedimentoNome: 'Osteotomia da maxila' })];
  const contexto = { capturaId: 'captura-estavel' };
  const primeiro = mesclarEventosSemPerda([], extraido, '2026-09-14', contexto);
  const repetido = mesclarEventosSemPerda([], extraido, '2026-09-14', contexto);
  assert.equal(primeiro[0].chaveCaptura, repetido[0].chaveCaptura);
  assert.deepEqual(mesclarEventosSemPerda(primeiro, extraido, '2026-09-14', contexto), primeiro);
});
