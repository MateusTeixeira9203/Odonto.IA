import assert from 'node:assert/strict';
import test from 'node:test';
import { getPilotEntryMembership, isTeamWorkspaceEnabled } from './team-workspace-pilot';

test('entrada gerencial só existe no projeto de teste, sem liberar cobrança', () => {
  const url = 'https://etlqznuoxiilvxzygpat.supabase.co';
  assert.equal(isTeamWorkspaceEnabled({ NEXT_PUBLIC_SUPABASE_URL: url }), true);
  assert.equal(isTeamWorkspaceEnabled({ NEXT_PUBLIC_SUPABASE_URL: url, STRIPE_BILLING_ENABLED: 'true' }), false);
  for (const value of [undefined, '', 'inválido', 'http://etlqznuoxiilvxzygpat.supabase.co',
    'https://zenfemoxvwerplrjgfqz.supabase.co', `${url}.example.com`,
    'https://etlqznuoxiilvxzygpat.supabase.co@example.com',
    'https://user:password@etlqznuoxiilvxzygpat.supabase.co']) {
    assert.equal(isTeamWorkspaceEnabled({ NEXT_PUBLIC_SUPABASE_URL: value }), false);
  }
});

function membershipClient(results: Array<{
  data: { role: string; status: string } | null;
  error: { message: string } | null;
}>) {
  const filters: Array<[string, string]> = [];
  let reads = 0;
  const query = {
    select: () => query,
    eq: (key: string, value: string) => { filters.push([key, value]); return query; },
    order: () => query,
    limit: () => query,
    maybeSingle: async () => results[reads++],
  };
  return {
    client: { from: () => query } as unknown as Parameters<typeof getPilotEntryMembership>[0],
    filters,
    readCount: () => reads,
  };
}

test('vínculo clínico ativo prevalece sobre histórico gerencial e mantém filtro da unidade', async () => {
  const source = membershipClient([
    { data: { role: 'dentista', status: 'ativo' }, error: null },
    { data: { role: 'gestor', status: 'removido' }, error: null },
  ]);
  assert.deepEqual(await getPilotEntryMembership(source.client, 'pessoa', 'clinica'), { role: 'dentista', status: 'ativo' });
  assert.equal(source.readCount(), 1);
  assert.deepEqual(source.filters, [['usuario_id', 'pessoa'], ['clinica_id', 'clinica'], ['status', 'ativo']]);
});

test('sem vínculo ativo, gestor suspenso chega à negação estável; erro não vira ausência', async () => {
  const source = membershipClient([
    { data: null, error: null },
    { data: { role: 'gestor', status: 'suspenso' }, error: null },
  ]);
  assert.deepEqual(await getPilotEntryMembership(source.client, 'pessoa', 'clinica'), { role: 'gestor', status: 'suspenso' });
  assert.equal(source.readCount(), 2);
  const failed = membershipClient([{ data: null, error: { message: 'internal connection details' } }]);
  await assert.rejects(() => getPilotEntryMembership(failed.client, 'pessoa', 'clinica'), /^Error: Não foi possível verificar o acesso à clínica\.$/);
  assert.equal(failed.readCount(), 1);
});
