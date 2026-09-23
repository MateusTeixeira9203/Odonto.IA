import assert from 'node:assert/strict';
import test from 'node:test';

import { createTeamInvite } from './team-invites';

const clinicId = 'a9b9f0d6-9758-4a46-b3f0-56d5b7695550';
const key = '4b84942d-d619-40f7-a123-1d883824d70b';

test('recusa convite de proprietário: a propriedade nasce na criação da clínica', async () => {
  const result = await createTeamInvite({
    clinicaId: clinicId,
    nome: 'Maria',
    email: 'maria@teste.dev',
    tipo: 'proprietario',
    chaveIdempotencia: key,
  }, {
    create: async () => { throw new Error('não deve chamar RPC'); },
  });
  assert.deepEqual(result, { ok: false, mensagem: 'Revise nome, e-mail e função antes de enviar.' });
});

test('envia somente os campos de um dentista à RPC', async () => {
  let request: unknown;
  const result = await createTeamInvite({
    clinicaId: clinicId,
    nome: 'Maria',
    email: 'MARIA@TESTE.DEV',
    tipo: 'dentista',
    chaveIdempotencia: key,
  }, {
    create: async (value) => {
      request = value;
      return {
        data: {
          ok: true,
          data: {
            id: 'b9b9f0d6-9758-4a46-b3f0-56d5b7695550',
            token: 'c9b9f0d6-9758-4a46-b3f0-56d5b7695550',
            email: 'maria@teste.dev',
            tipo: 'dentista',
            expiresAt: '2026-09-29T00:00:00.000Z',
          },
        },
        error: null,
      };
    },
  });
  assert.deepEqual(request, {
    p_clinica_id: clinicId,
    p_nome: 'Maria',
    p_email: 'maria@teste.dev',
    p_tipo: 'dentista',
    p_chave_idempotencia: key,
  });
  assert.equal(result.ok, true);
});
