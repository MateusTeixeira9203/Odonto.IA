import assert from 'node:assert/strict';
import test from 'node:test';
import { getMemberContext, type MemberContextDependencies } from './member-context.ts';

const userId = '11111111-1111-4111-8111-111111111111';
const clinicId = '22222222-2222-4222-8222-222222222222';
const otherClinicId = '33333333-3333-4333-8333-333333333333';
const memberId = '44444444-4444-4444-8444-444444444444';
const dentistId = '55555555-5555-4555-8555-555555555555';

type FakeRows = {
  activeClinic?: { active_clinica_id: string | null } | null;
  membership?: { id: string; role: string; status: string } | null;
  dentist?: { id: string; role: string } | null;
};

type DependencyName = 'getUser' | 'getActiveClinic' | 'getMembership' | 'getClinicalProfile';

function fakeDependencies({
  user = { id: userId, email: 'dentista@example.com' },
  authError = null,
  errors = {},
  throws = {},
  rows = {},
}: {
  user?: { id: string; email?: string | null } | null;
  authError?: { message: string } | null;
  errors?: Partial<Record<DependencyName, { message: string } | null>>;
  throws?: Partial<Record<DependencyName, boolean>>;
  rows?: FakeRows;
} = {}): MemberContextDependencies {
  return {
    async getUser() {
      if (throws.getUser) throw new Error('auth unavailable');
      return { data: user, error: authError ?? errors.getUser ?? null };
    },
    async getActiveClinic() {
      if (throws.getActiveClinic) throw new Error('active clinic unavailable');
      return { data: rows.activeClinic ?? null, error: errors.getActiveClinic ?? null };
    },
    async getMembership() {
      if (throws.getMembership) throw new Error('membership unavailable');
      return { data: rows.membership ?? null, error: errors.getMembership ?? null };
    },
    async getClinicalProfile() {
      if (throws.getClinicalProfile) throw new Error('profile unavailable');
      return { data: rows.dentist ?? null, error: errors.getClinicalProfile ?? null };
    },
  };
}

function activeRows(role: string = 'dentista'): FakeRows {
  return {
    activeClinic: { active_clinica_id: clinicId },
    membership: { id: memberId, role, status: 'ativo' },
    dentist: { id: dentistId, role },
  };
}

test('nega sessão não autenticada', async () => {
  const result = await getMemberContext({ dependencies: fakeDependencies({ user: null }) });
  assert.deepEqual(result, {
    ok: false, codigo: 'SEM_ACESSO', mensagem: 'Sessão autenticada obrigatória.',
  });
});

test('detecta clínica esperada divergente antes de ler membership', async () => {
  const result = await getMemberContext({
    clinicaIdEsperada: otherClinicId,
    dependencies: fakeDependencies({ rows: activeRows() }),
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.codigo, 'CONTEXTO_ALTERADO');
});

test('nega membro ausente ou inativo', async () => {
  const absent = await getMemberContext({
    dependencies: fakeDependencies({ rows: { activeClinic: { active_clinica_id: clinicId } } }),
  });
  assert.equal(absent.ok, false);
  if (!absent.ok) assert.equal(absent.codigo, 'SEM_ACESSO');

  const inactive = await getMemberContext({
    dependencies: fakeDependencies({ rows: {
      activeClinic: { active_clinica_id: clinicId },
      membership: { id: memberId, role: 'dentista', status: 'suspenso' },
    } }),
  });
  assert.equal(inactive.ok, false);
  if (!inactive.ok) assert.equal(inactive.codigo, 'SEM_ACESSO');
});

test('distingue erro de consulta de contexto ausente', async () => {
  const result = await getMemberContext({
    dependencies: fakeDependencies({ errors: { getMembership: { message: 'network timeout' } }, rows: activeRows() }),
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.codigo, 'INDISPONIVEL');
});

test('rejeição de dependência retorna indisponível sem vazar erro', async () => {
  const result = await getMemberContext({
    dependencies: fakeDependencies({ throws: { getActiveClinic: true } }),
  });
  assert.deepEqual(result, {
    ok: false, codigo: 'INDISPONIVEL', mensagem: 'Não foi possível resolver o contexto de acesso.',
  });
});

test('secretaria com linha legada em dentistas não recebe perfil clínico', async () => {
  const result = await getMemberContext({
    dependencies: fakeDependencies({ rows: activeRows('secretaria') }),
  });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.data.role, 'secretaria');
    assert.equal(result.data.perfilClinico, null);
  }
});

test('gestor resolve a unidade sem consultar ou inferir perfil clínico', async () => {
  const dependencies = fakeDependencies({
    rows: activeRows('gestor'),
    throws: { getClinicalProfile: true },
  });
  const result = await getMemberContext({ dependencies });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.data.role, 'gestor');
    assert.equal(result.data.perfilClinico, null);
    assert.equal(result.data.clinicaId, clinicId);
  }
});

test('perfil legado com role não clínico não promove membership admin a profissional', async () => {
  const rows = activeRows('admin');
  rows.dentist = { id: dentistId, role: 'secretaria' };
  const result = await getMemberContext({ dependencies: fakeDependencies({ rows }) });
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.data.perfilClinico, null);
});

test('ausência de perfil clínico em dentista é um contexto válido', async () => {
  const rows = activeRows();
  rows.dentist = null;
  const result = await getMemberContext({ dependencies: fakeDependencies({ rows }) });
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.data.perfilClinico, null);
});

test('dentista ativo recebe perfil clínico legítimo', async () => {
  const result = await getMemberContext({ dependencies: fakeDependencies({ rows: activeRows() }) });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.deepEqual(result.data.perfilClinico, { tipo: 'dentista', dentistaId: dentistId });
    assert.equal(result.data.clinicaId, clinicId);
    assert.equal(result.data.membroId, memberId);
  }
});
