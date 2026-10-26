import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { z } from 'zod';
import * as helpers from './assinatura-recepcao';
import type * as Registro from '@/server/patients/registro-actions';
import type * as Recepcao from '@/app/dashboard/agendamentos/assinatura-actions';

const id = (n: number) => `e015b400-0000-4000-8000-${String(n).padStart(12, '0')}`;
const evento = (n: number, extra: Partial<helpers.EventoParaAssinar> = {}): helpers.EventoParaAssinar => ({
  id: id(n), dentista_id: 'ana', encaminhado_para: null, status: 'realizado', assinatura_id: null, retirado_em: null, ...extra,
});
const params = { fichaId: id(90), pacienteId: id(91), assinadoPor: 'Paciente QA', assinaturaDataUrl: 'data:image/png;base64,cWE=' };

// Executa as actions reais; transporte controlado nao substitui a prova Auth no QA.
function carregar(eventos: helpers.EventoParaAssinar[], options: { role?: string; erroLeitura?: boolean; erroRpc?: string; erroRpcNoLote?: number } = {}) {
  const lotes: string[][] = [];
  let carimbos = 0;
  let uploads = 0;
  let removidos = 0;
  const role = options.role ?? 'secretaria';
  const db = {
    from(table: string) {
      const filtros: Array<(e: helpers.EventoParaAssinar) => boolean> = [];
      let atualizando = false;
      const q = {
        select() { return q; }, order() { return q; }, in() { return q; },
        eq(chave: string, valor: string) {
          if (chave === 'status') filtros.push(e => e.status === valor);
          return q;
        },
        is(chave: string) {
          if (chave === 'assinatura_id') filtros.push(e => e.assinatura_id == null);
          if (chave === 'retirado_em') filtros.push(e => e.retirado_em == null);
          return q;
        },
        or() { filtros.push(e => (e.encaminhado_para ?? e.dentista_id) === (role === 'secretaria' ? 'sara' : 'ana')); return q; },
        update() { atualizando = true; carimbos++; return q; },
        async maybeSingle() { return { data: { id: table === 'dentistas' ? (role === 'secretaria' ? 'sara' : 'ana') : params.fichaId, ficha_id: params.fichaId, paciente_id: params.pacienteId }, error: null }; },
        then(resolve: (value: unknown) => unknown) {
          const data = table === 'odontograma_eventos' ? eventos.filter(e => filtros.every(f => f(e))) : table === 'dentistas' ? [{ id: 'carlos', nome: 'Carlos QA' }] : table === 'fichas' && atualizando ? [{ id: params.fichaId }] : [];
          return Promise.resolve(resolve({ data, count: data.length, error: options.erroLeitura ? { message: 'QA leitura recusada' } : null }));
        },
      };
      return q;
    },
    async rpc(_name: string, args: { p_evento_ids: string[] }) {
      lotes.push([...args.p_evento_ids]);
      return { data: id(95), error: options.erroRpc && (!options.erroRpcNoLote || options.erroRpcNoLote === lotes.length) ? { message: options.erroRpc } : null };
    },
    storage: { from() { return {
      async upload() { uploads++; return { error: null }; },
      async remove() { removidos++; return { error: null }; },
    }; } },
  };
  function load(file: string): unknown {
    return runInNewContext(ts.transpileModule(readFileSync(file, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText + '\nexports;', {
      exports: {}, Buffer, console: { error() {} },
      require(name: string) {
        if (name === 'node:crypto') return { randomUUID: () => id(96) };
        if (name === 'zod') return { z };
        if (name === '@/lib/prontuario/assinatura-recepcao') return helpers;
        if (name === '@/server/patients/registro-actions') return registro;
        if (name === '@/server/auth/clinic') return { requireClinicContext: async () => ({ supabase: db, clinicId: 'clinica', dentistaId: role === 'secretaria' ? 'sara' : 'ana', user: { id: 'user' }, role }) };
        if (name === '@/lib/supabase/service') return { createServiceClient: () => db };
        if (name === 'next/cache') return { revalidatePath() {} };
        return {};
      },
    });
  }
  const registro = load('src/server/patients/registro-actions.ts') as typeof Registro;
  const recepcao = load('src/app/dashboard/agendamentos/assinatura-actions.ts') as typeof Recepcao;
  return { registro, recepcao, lotes, carimbos: () => carimbos, uploads: () => uploads, removidos: () => removidos };
}

const salvar = (c: ReturnType<typeof carregar>) => c.recepcao.salvarAssinaturaRecepcao(params.fichaId, params.pacienteId, params.assinadoPor, params.assinaturaDataUrl);

test('secretaria seleciona Ana e encaminhado Carlos, excluindo indicado, assinado e retirado', () => {
  const eventos = [evento(1), evento(2, { encaminhado_para: 'carlos' }), evento(3, { status: 'indicado' }), evento(4, { assinatura_id: id(94) }), evento(5, { retirado_em: '2026-10-25' })];
  assert.deepEqual(helpers.filtrarEventosParaAssinar(eventos, { role: 'secretaria', dentistaId: 'sara' }).map(e => e.id), [id(1), id(2)]);
  assert.deepEqual(helpers.filtrarEventosParaAssinar(eventos, { role: 'dentista', dentistaId: 'ana' }).map(e => e.id), [id(1)]);
  assert.deepEqual(helpers.agruparPorAutor(eventos.slice(0, 2)).map(g => g.map(e => e.id)), [[id(1)], [id(2)]]);
});
test('legado exige exatamente zero procedimentos', () => {
  assert.equal(helpers.usarCaminhoLegado({ totalProcedimentos: 0 }), true);
  assert.equal(helpers.usarCaminhoLegado({ totalProcedimentos: 1 }), false);
});
test('action real: Sara assina Ana e mantem Carlos pendente sem carimbar ficha', async () => {
  const c = carregar([evento(1), evento(2, { encaminhado_para: 'carlos' }), evento(3)]);
  assert.equal((await salvar(c)).ok, false);
  assert.deepEqual(c.lotes, [[id(1), id(3)]]);
  assert.equal(c.carimbos(), 0);
});
test('action real: dentista assina so autor efetivo, incluindo encaminhado para ele', async () => {
  const c = carregar([evento(1), evento(2, { encaminhado_para: 'carlos' }), evento(3, { dentista_id: 'carlos', encaminhado_para: 'ana' })], { role: 'dentista' });
  assert.equal((await c.registro.assinarTodosRealizadosDaFicha(params)).ok, true);
  assert.deepEqual(c.lotes, [[id(1), id(3)]]);
});
test('guarda real: procedimento ativo sem assinaveis recusa sem carimbo nem upload legado', async () => {
  for (const e of [evento(1, { status: 'indicado' }), evento(1, { assinatura_id: id(94) })]) {
    const c = carregar([e]);
    const result = await salvar(c);
    assert.equal(result.ok, false);
    assert.equal(result.error, 'Não há procedimento realizado para assinar nesta ficha.');
    assert.equal(c.carimbos(), 0);
    assert.equal(c.uploads(), 0);
  }
});
test('action real: zero procedimentos ativos preserva legado', async () => {
  for (const eventos of [[], [evento(1, { retirado_em: '2026-10-25' })]]) {
    const c = carregar(eventos);
    assert.equal((await salvar(c)).ok, true);
    assert.equal(c.carimbos(), 1);
  }
});
test('falha de leitura nao vira sucesso nem legado', async () => {
  const c = carregar([], { erroLeitura: true });
  assert.equal((await salvar(c)).ok, false);
  assert.equal(c.carimbos(), 0);
  assert.equal(c.uploads(), 0);
});
test('erros RPC sao amigaveis, removem PNG e nao caem no legado', async () => {
  for (const codigo of ['autores_diferentes', 'sem_permissao', 'status_invalido', 'outro_erro']) {
    const c = carregar([evento(1)], { erroRpc: codigo });
    const result = await salvar(c);
    assert.equal(result.ok, false);
    assert.equal(result.error?.includes(codigo), false);
    assert.equal(c.carimbos(), 0);
    assert.equal(c.removidos(), 1);
  }
});


test('encaminhado recusado preserva primeiro lote e informa pendencia e responsavel', async () => {
  const c = carregar([evento(1), evento(2, { encaminhado_para: 'carlos' })], {
    erroRpc: 'responsavel_do_encaminhamento', erroRpcNoLote: 2,
  });
  const result = await salvar(c);
  assert.equal(result.ok, false);
  assert.match(result.error ?? '', /continua\(m\) pendente/);
  assert.match(result.error ?? '', /Carlos QA/);
  assert.match(result.error ?? '', /assinaturas já registradas foram preservadas/);
  assert.equal(result.error?.includes('responsavel_do_encaminhamento'), false);
  assert.deepEqual(c.lotes, [[id(1)]]);
  assert.equal(c.removidos(), 0);
  assert.equal(c.carimbos(), 0);
});


test('recepcao: encaminhado primeiro nao impede proprio; ambas as ordens preservam pendencia nominal', async () => {
  for (const eventos of [[evento(2, { encaminhado_para: 'carlos' }), evento(1)], [evento(1), evento(2, { encaminhado_para: 'carlos' })]]) {
    const c = carregar(eventos, { erroRpc: 'responsavel_do_encaminhamento', erroRpcNoLote: 2 });
    const result = await salvar(c);
    assert.equal(result.ok, false);
    assert.deepEqual(c.lotes, [[id(1)]]);
    assert.match(result.error ?? '', /1 procedimento.*assinado/);
    assert.match(result.error ?? '', /1 procedimento.*pendente/);
    assert.match(result.error ?? '', /Carlos QA/);
    assert.equal(c.carimbos(), 0);
  }
});
