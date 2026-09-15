import assert from 'node:assert/strict';
import test from 'node:test';
import { listarResultadosClinica, obterContextoClinica, type ClinicaDependencies } from './operations';

const clinicaId = 'a067564a-23d4-5791-ab29-17001897a134';
const dentistaId = 'a70a4348-07aa-5834-bab4-08806546f45b';

const contexto = {
  clinicaId,
  nome: 'QA R163A Clínica Proprietário Clínico',
  proprietario: true,
  dentistaId,
  gestaoDisponivel: true,
  recebimentoMisto: true,
};

const resultados = {
  contexto,
  mes: '2026-09',
  dentistaFiltro: null,
  profissionais: [{ id: dentistaId, nome: 'QA R163A Proprietário Clínico' }],
  recebidoClinicaCentavos: 70000,
  recebidoDiretoCentavos: 30000,
  receitasManuaisCentavos: 0,
  despesasClinicaCentavos: 10000,
  aReceberClinicaCentavos: 70000,
  realizados: 1,
  faltas: 1,
  cancelados: 0,
  confirmacoesAmanha: 1,
  porProfissional: [{
    id: dentistaId,
    nome: 'QA R163A Proprietário Clínico',
    recebidoClinicaCentavos: 70000,
    recebidoDiretoCentavos: 30000,
    aReceberClinicaCentavos: 70000,
    realizados: 1,
    faltas: 1,
    cancelados: 0,
  }],
};

function dependency(result: unknown, error: unknown = null, calls: Array<{ name: string; args: Record<string, unknown> }> = []): ClinicaDependencies {
  return {
    rpc: async (name, args) => {
      calls.push({ name, args });
      return { data: result, error };
    },
  };
}

test('obterContextoClinica valida o envelope e preserva o contexto pedido', async () => {
  const result = await obterContextoClinica({ clinicaIdEsperada: clinicaId }, dependency({ ok: true, data: contexto }));
  assert.deepEqual(result, { ok: true, data: contexto });
});

test('obterContextoClinica não aceita contexto devolvido para outra clínica', async () => {
  const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
  const result = await obterContextoClinica(
    { clinicaIdEsperada: clinicaId },
    dependency({ ok: true, data: { ...contexto, clinicaId: 'a49bd475-6e0a-52dc-80c2-5a843732b86d' } }, null, calls),
  );
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.codigo, 'INDISPONIVEL');
  assert.equal(calls.length, 1);
});

test('inputs inválidos falham antes do RPC', async () => {
  let called = false;
  const dependencies: ClinicaDependencies = { rpc: async () => { called = true; return { data: null, error: null }; } };
  const result = await listarResultadosClinica({ clinicaIdEsperada: clinicaId, mes: '2026-13' }, dependencies);
  assert.deepEqual(result, { ok: false, codigo: 'INVALIDO', mensagem: 'Revise o mês e o profissional.' });
  assert.equal(called, false);
});

test('listarResultadosClinica mapeia dentista omitido para null', async () => {
  const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
  const result = await listarResultadosClinica({ clinicaIdEsperada: clinicaId, mes: '2026-09' }, dependency({ ok: true, data: resultados }, null, calls));
  assert.deepEqual(result, { ok: true, data: resultados });
  assert.deepEqual(calls[0], {
    name: 'listar_resultados_clinica',
    args: { p_clinica_id_esperada: clinicaId, p_mes: '2026-09', p_dentista_id: null },
  });
});

test('falha de RPC vira indisponível sem preencher métricas com zeros', async () => {
  const result = await listarResultadosClinica(
    { clinicaIdEsperada: clinicaId, mes: '2026-09', dentistaId },
    dependency(null, new Error('timeout')),
  );
  assert.deepEqual(result, { ok: false, codigo: 'INDISPONIVEL', mensagem: 'Não foi possível carregar os resultados. Tente novamente.' });
});

test('falha tipada do banco é preservada', async () => {
  const result = await listarResultadosClinica(
    { clinicaIdEsperada: clinicaId, mes: '2026-09', dentistaId },
    dependency({ ok: false, codigo: 'SEM_ACESSO', mensagem: 'Somente o proprietário pode consultar estes resultados.' }),
  );
  assert.deepEqual(result, { ok: false, codigo: 'SEM_ACESSO', mensagem: 'Somente o proprietário pode consultar estes resultados.' });
});

test('payload estrito inválido não atravessa a fronteira tipada', async () => {
  const result = await listarResultadosClinica(
    { clinicaIdEsperada: clinicaId, mes: '2026-09' },
    dependency({ ok: true, data: { ...resultados, recebidoDiretoCentavos: -1 } }),
  );
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.codigo, 'INDISPONIVEL');
});
