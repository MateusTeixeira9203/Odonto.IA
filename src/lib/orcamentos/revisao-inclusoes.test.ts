import assert from 'node:assert/strict';
import test from 'node:test';
import { idsDeInclusoesRevisadas } from './revisao-inclusoes';

test('a revisão neutraliza somente os eventos que o dentista viu', () => {
  const revisados = idsDeInclusoesRevisadas([
    { action: 'orcamento_evento.inclusao_revisada', metadata: { evento_ids: ['evento-a', 'evento-b'] } },
    { action: 'orcamento.editado', metadata: { evento_ids: ['evento-c'] } },
  ]);

  assert.deepEqual([...revisados], ['evento-a', 'evento-b']);
  assert.equal(revisados.has('evento-c'), false);
});

test('um procedimento criado depois da revisão permanece novo', () => {
  const revisados = idsDeInclusoesRevisadas([
    { action: 'orcamento_evento.inclusao_revisada', metadata: { evento_ids: ['evento-antigo'] } },
  ]);

  assert.equal(revisados.has('evento-antigo'), true);
  assert.equal(revisados.has('evento-novo'), false);
});

test('metadata ausente ou inválido não revisa nenhum evento', () => {
  const revisados = idsDeInclusoesRevisadas([
    { action: 'orcamento_evento.inclusao_revisada', metadata: null },
    { action: 'orcamento_evento.inclusao_revisada', metadata: { evento_ids: 'evento-a' } },
  ]);

  assert.equal(revisados.size, 0);
});
