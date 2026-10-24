import assert from 'node:assert/strict';
import test from 'node:test';
import {
  MSG_ORCAMENTO_ASSINADO, MSG_ERRO_EXCLUSAO,
  motivoBloqueioExclusao, mensagemErroExclusao,
} from './exclusao';

for (const [assinaturas, documentosAceite, esperado] of [
  [0, 0, null], [1, 0, MSG_ORCAMENTO_ASSINADO],
  [0, 1, MSG_ORCAMENTO_ASSINADO], [1, 1, MSG_ORCAMENTO_ASSINADO],
] as const) {
  test(`exclusão com ${assinaturas} assinatura(s) e ${documentosAceite} documento(s)`, () => {
    assert.equal(
      motivoBloqueioExclusao({ assinaturas, documentosAceite }),
      esperado,
    );
  });
}

test('FK em corrida usa a mensagem do orçamento assinado', () => {
  assert.equal(mensagemErroExclusao({ code: '23503' }), MSG_ORCAMENTO_ASSINADO);
});
test('demais erros usam mensagem genérica', () => {
  assert.equal(mensagemErroExclusao({ code: '42501' }), MSG_ERRO_EXCLUSAO);
  assert.equal(mensagemErroExclusao({}), MSG_ERRO_EXCLUSAO);
});
test('ausência de erro não inventa uma mensagem', () => {
  assert.equal(mensagemErroExclusao(null), null);
});
