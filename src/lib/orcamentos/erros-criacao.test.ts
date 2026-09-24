import assert from 'node:assert/strict';
import test from 'node:test';
import { erroCriacaoOrcamento } from './erros-criacao';

test('classifica evento indisponível sem expor a RPC', () => {
  assert.equal(
    erroCriacaoOrcamento({ code: 'P0001', message: 'orcamento_evento_invalido' }, 'criar'),
    'Um dos procedimentos não está mais disponível para este orçamento. Recarregue a ficha e tente novamente.',
  );
});

test('classifica vínculo de catálogo de outro dentista', () => {
  assert.equal(
    erroCriacaoOrcamento({ code: 'P0001', message: 'orcamento_procedimento_de_outro_dentista' }, 'adicionar'),
    'O procedimento escolhido pertence a outro dentista. Recarregue o catálogo antes de continuar.',
  );
});

test('preserva detalhes técnicos desconhecidos fora da resposta ao cliente', () => {
  const mensagem = erroCriacaoOrcamento({ code: 'XX000', message: 'detalhe_interno' }, 'criar');
  assert.match(mensagem, /Seus dados foram preservados/);
  assert.doesNotMatch(mensagem, /detalhe_interno/);
});
