import assert from 'node:assert/strict';
import test from 'node:test';

import { getGovernanceContext } from './governance-context.ts';

const clinicId = 'a1111111-1111-4111-8111-111111111111';

test('uma clínica sem governança é interpretada como colaborativa legada', async () => {
  const result = await getGovernanceContext(clinicId, {
    get: async () => ({
      data: {
        ok: true,
        data: {
          clinicaId: clinicId,
          modalidade: 'colaborativa',
          versao: 0,
          vigenciaModalidadeEm: null,
          configurada: false,
          papeis: [],
        },
      },
      error: null,
    }),
  });

  assert.deepEqual(result, {
    ok: true,
    data: {
      clinicaId: clinicId,
      modalidade: 'colaborativa',
      versao: 0,
      vigenciaModalidadeEm: null,
      configurada: false,
      papeis: [],
    },
  });
});

test('aceita papéis de governança acumuláveis retornados pelo servidor', async () => {
  const result = await getGovernanceContext(clinicId, {
    get: async () => ({
      data: {
        ok: true,
        data: {
          clinicaId: clinicId,
          modalidade: 'gerida',
          versao: 3,
          vigenciaModalidadeEm: '2026-09-21T12:00:00+00:00',
          configurada: true,
          papeis: ['proprietario', 'responsavel_tecnico'],
        },
      },
      error: null,
    }),
  });

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.deepEqual(result.data.papeis, ['proprietario', 'responsavel_tecnico']);
  }
});

test('falha fechada para resposta RPC inesperada ou clínica inválida', async () => {
  const malformed = await getGovernanceContext(clinicId, {
    get: async () => ({ data: { ok: true, data: { clinicaId: clinicId } }, error: null }),
  });
  assert.deepEqual(malformed, {
    ok: false,
    codigo: 'INDISPONIVEL',
    mensagem: 'Não foi possível consultar a governança agora.',
  });

  const invalid = await getGovernanceContext('fora-do-formato', {
    get: async () => {
      throw new Error('não deveria consultar');
    },
  });
  assert.deepEqual(invalid, {
    ok: false,
    codigo: 'CONTEXTO_ALTERADO',
    mensagem: 'A clínica ativa foi alterada. Atualize e tente novamente.',
  });
});
