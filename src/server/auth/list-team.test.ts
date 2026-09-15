import assert from 'node:assert/strict';
import test from 'node:test';
import { listTeam, type ListTeamDependencies } from './list-team.ts';

const clinic = '22222222-2222-4222-8222-222222222222';
const other = '33333333-3333-4333-8333-333333333333';
const input = { clinicaIdEsperada: clinic };
const success = { ok: true, data: { clinicaId: clinic, clinicaNome: 'Clínica fictícia', membros: [], proximo: null } };
const source = (data: unknown): ListTeamDependencies => ({ list: async () => ({ data, error: null }) });

test('não aceita ator ou permissões declaradas no formulário', async () => {
  const dependencies: ListTeamDependencies = { list: async () => { throw new Error('não deve consultar'); } };
  for (const invalid of [null, {}, { ...input, ator: other }, { ...input, acessos: [] }, { ...input, apos: 'inválido' }]) {
    const result = await listTeam(invalid, dependencies);
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.codigo, 'INVALIDO');
  }
});

test('consulta a página com cursor, sem converter falha em vazio', async () => {
  const dependencies: ListTeamDependencies = { list: async (args) => {
    assert.deepEqual(args, { p_clinica_id: clinic, p_apos: other });
    return { data: success, error: null };
  } };
  assert.deepEqual(await listTeam({ ...input, apos: other }, dependencies), success);
  for (const data of [null, {}, { ok: true, data: null }, { ...success, dadosClinicos: [] }]) {
    const result = await listTeam(input, source(data));
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.codigo, 'INDISPONIVEL');
  }
});

test('rejeita projeção com dados extras e resposta de outra unidade', async () => {
  const member = { membroId: other, nome: 'QA', email: 'qa@example.com', papel: 'gestor', status: 'ativo', proprietario: true, atuaClinicamente: false };
  const valid = { ok: true, data: { ...success.data, membros: [member] } };
  assert.deepEqual(await listTeam(input, source(valid)), valid);
  const unicode = { ok: true, data: { ...success.data, membros: [{ ...member, nome: '🦷'.repeat(200) }] } };
  assert.deepEqual(await listTeam(input, source(unicode)), unicode);
  const extra = await listTeam(input, source({ ok: true, data: { ...success.data, membros: [{ ...member, prontuario: 'sigiloso' }] } }));
  assert.equal(extra.ok, false);
  const different = await listTeam(input, source({ ok: true, data: { ...success.data, clinicaId: other } }));
  assert.equal(different.ok, false);
  if (!different.ok) assert.equal(different.codigo, 'CONTEXTO_ALTERADO');
});

test('falha técnica e erro do banco não expõem a mensagem interna', async () => {
  for (const dependencies of [
    { list: async () => ({ data: success, error: { message: 'segredo interno' } }) },
    { list: async () => { throw new Error('segredo interno'); } },
    source({ ok: false, codigo: 'SEM_ACESSO', mensagem: 'segredo interno' }),
  ]) {
    const result = await listTeam(input, dependencies);
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.mensagem.includes('segredo'), false);
  }
});
