import assert from 'node:assert/strict';
import test from 'node:test';
import { getReceptionContext } from './reception-context.ts';

const member = {
  usuarioId: '11111111-1111-4111-8111-111111111111',
  membroId: '22222222-2222-4222-8222-222222222222',
  clinicaId: '33333333-3333-4333-8333-333333333333',
  email: 'recepcao@example.com',
  role: 'secretaria' as const,
  perfilClinico: null,
};

function dependencies(overrides: Partial<Parameters<typeof getReceptionContext>[0]> = {}) {
  return {
    async member() { return { ok: true as const, data: member }; },
    async profile() { return { data: { nome: 'Ana Recepção' }, error: null }; },
    async clinic() { return { data: { nome: 'Clínica Teste' }, error: null }; },
    ...overrides,
  };
}

test('recepção sem dentista recebe somente identidade operacional', async () => {
  const result = await getReceptionContext(dependencies());
  assert.deepEqual(result, {
    ok: true,
    data: {
      usuarioId: member.usuarioId,
      membroId: member.membroId,
      clinicaId: member.clinicaId,
      nome: 'Ana Recepção',
      clinicaNome: 'Clínica Teste',
    },
  });
});

test('perfil clínico ou perfil operacional ausente não vira recepção', async () => {
  const clinical = await getReceptionContext(dependencies({
    async member() { return { ok: true as const, data: { ...member, perfilClinico: { tipo: 'dentista' as const, dentistaId: member.membroId } } }; },
  }));
  assert.equal(clinical.ok, false);

  const absent = await getReceptionContext(dependencies({
    async profile() { return { data: null, error: null }; },
  }));
  assert.equal(absent.ok, false);
});
