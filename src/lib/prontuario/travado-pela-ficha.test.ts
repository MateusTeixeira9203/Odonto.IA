import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { z } from 'zod';
import { travadoPelaAssinaturaDaFicha } from './travado-pela-ficha';
import type * as RegistroActions from '@/server/patients/registro-actions';
import type * as Roteamento from '@/server/patients/rotear-visita';

const assinatura = '2026-10-21T12:45:00Z';
const antes = '2026-10-21T12:44:59Z';
const depois = '2026-10-21T12:45:00.001Z';

test('sem assinatura o item fica livre', () => {
  assert.equal(travadoPelaAssinaturaDaFicha(null, antes), false);
  assert.equal(travadoPelaAssinaturaDaFicha(null, null), false);
});
test('antes ou no mesmo instante da assinatura trava; depois fica livre', () => {
  for (const criado of [antes, assinatura, '2026-10-21T09:45:00-03:00']) {
    assert.equal(travadoPelaAssinaturaDaFicha(assinatura, criado), true);
  }
  assert.equal(travadoPelaAssinaturaDaFicha(assinatura, depois), false);
});
test('instante desconhecido ou inválido conserva a trava da ficha assinada', () => {
  for (const criado of [null, 'xyz']) assert.equal(travadoPelaAssinaturaDaFicha(assinatura, criado), true);
  assert.equal(travadoPelaAssinaturaDaFicha('xyz', depois), true);
});

// Exercita as funções reais com transporte controlado; não simula autorização do banco.
function carregar(criacoes: Array<string | null>, rpcErro: string | null = null) {
  let escritas = 0;
  let chamadasRpc = 0;
  let removidosStorage = 0;
  const ids = criacoes.map((_, i) => `e015b200-0000-4000-8000-${String(i + 1).padStart(12, '0')}`);
  const eventos = criacoes.map((created_at, i) => ({
    id: ids[i], ficha_id: 'ficha', paciente_id: 'paciente', origem: 'clinica', status: 'indicado', created_at,
  }));
  const fichas = [{ id: 'ficha', assinado_em: assinatura }];
  const supabase = {
    from(tabela: string) {
      const query = {
        select() { return query; }, eq() { return query; }, in() { return query; },
        is() { return query; }, or() { return query; }, neq() { return query; },
        update() { escritas++; return query; },
        async maybeSingle() { return { data: {
          id: 'ficha', nome: 'QA', ficha_id: 'ficha', paciente_id: 'paciente', assinado_em: assinatura,
        }, error: null }; },
        then(resolve: (value: { data: typeof eventos | typeof fichas; error: null }) => unknown) {
          return Promise.resolve(resolve({ data: tabela === 'odontograma_eventos' ? eventos : fichas, error: null }));
        },
      };
      return query;
    },
    async rpc() { chamadasRpc++; return { data: null, error: rpcErro ? { message: rpcErro } : null }; },
    storage: { from() { return {
      async upload() { return { error: null }; },
      async remove() { removidosStorage++; return { error: null }; },
    }; } },
  };
  function load(file: string): unknown {
    const source = readFileSync(file, 'utf8');
    const output = ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    return runInNewContext(output + '\nexports;', {
      exports: {}, Buffer, console: { error() {} },
      require(name: string) {
        if (name === 'zod') return { z };
        if (name === '@/lib/prontuario/travado-pela-ficha') return { travadoPelaAssinaturaDaFicha };
        if (name === '@/lib/prontuario/ficha-assinada-recusa') return { fichaAssinadaRecusa: (data: string | null, total: number) => data != null && total > 0 };
        if (name === '@/server/auth/clinic') return { requireClinicContext: async () => ({
          supabase, clinicId: 'clinica', dentistaId: 'autor', role: 'dentista', user: { id: 'usuario' },
        }) };
        if (name === '@/lib/hora-brt') return { hojeBRT: () => '2026-10-24' };
        if (name === 'next/cache') return { revalidatePath() {} };
        if (name === '@/lib/notificacoes') return { inserirNotificacao: async () => {} };
        if (name === '@/lib/odontograma/montar-rows-eventos') return { montarRowsEventos: () => [] };
        return {};
      },
    });
  }
  return {
    ids, actions: load('src/server/patients/registro-actions.ts') as typeof RegistroActions,
    roteamento: load('src/server/patients/rotear-visita.ts') as typeof Roteamento,
    escritas: () => escritas, chamadasRpc: () => chamadasRpc, removidosStorage: () => removidosStorage,
  };
}

for (const action of ['alternarStatusRegistro', 'alternarMomentoRegistro'] as const) {
  test(`${action}: evento novo em ficha assinada passa pela guarda real`, async () => {
    const caso = carregar([depois]);
    const resultado = action === 'alternarStatusRegistro'
      ? await caso.actions.alternarStatusRegistro({ eventoIds: caso.ids, novoStatus: 'realizado' })
      : await caso.actions.alternarMomentoRegistro({ eventoIds: caso.ids, novoMomento: 'proxima_sessao' });
    assert.equal(resultado.ok, true);
    assert.equal(caso.escritas(), 1);
  });
  test(`${action}: lote com antigo ou criação ausente não escreve`, async () => {
    for (const criado of [antes, null]) {
      const caso = carregar([depois, criado]);
      const resultado = action === 'alternarStatusRegistro'
        ? await caso.actions.alternarStatusRegistro({ eventoIds: caso.ids, novoStatus: 'realizado' })
        : await caso.actions.alternarMomentoRegistro({ eventoIds: caso.ids, novoMomento: 'proxima_sessao' });
      assert.equal(resultado.ok, false);
      assert.equal(caso.escritas(), 0);
    }
  });
}
test('encaminhar mantém sucesso parcial: novo elegível e antigo ignorado', async () => {
  const caso = carregar([depois, antes]);
  const result = await caso.actions.encaminharProcedimento({ eventoIds: caso.ids, dentistaDestinoId: 'destino' });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.deepEqual([...result.encaminhados], [caso.ids[0]]);
    assert.deepEqual([...result.ignorados], [caso.ids[1]]);
  }
  assert.equal(caso.chamadasRpc(), 1);
});
test('roteamento de procedimento novo em ficha assinada alcança a decisão do banco', async () => {
  const caso = carregar([depois], 'evento_contexto_invalido');
  await caso.roteamento.acrescentarEventosNaFicha({
    fichaId: 'ficha', pacienteId: 'paciente', eventos: [{
      id: caso.ids[0], tipo: 'profilaxia', status: 'indicado', origem: 'clinica', ancora: { nivel: 'boca' },
      grupo_id: null, papel_no_grupo: null, observacao: '',
    }], evolucao: { texto: null, automatica: false },
  });
  assert.equal(caso.chamadasRpc(), 1);
});
test('autores_diferentes devolve orientação e remove PNG órfão', async () => {
  const caso = carregar([depois], 'autores_diferentes');
  const result = await caso.actions.assinarProcedimentos({
    eventoIds: caso.ids, assinadoPor: 'Paciente QA', assinaturaDataUrl: 'data:image/png;base64,AA==',
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error, 'Selecione procedimentos de um único profissional para cada assinatura.');
  assert.equal(caso.removidosStorage(), 1);
});
