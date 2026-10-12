import assert from 'node:assert/strict';
import test from 'node:test';
import { nomeProteticoSelecionado } from './nome-protetico-selecionado';

test('R-196 resolve cada ID para o nome da opção correspondente', () => {
  const proteticos = [
    { id: 'protetico-a', nome: 'Laboratório Alfa' },
    { id: 'protetico-b', nome: 'Laboratório Beta' },
  ];

  assert.equal(nomeProteticoSelecionado(proteticos, 'protetico-a'), 'Laboratório Alfa');
  assert.equal(nomeProteticoSelecionado(proteticos, 'protetico-b'), 'Laboratório Beta');
  assert.equal(nomeProteticoSelecionado(proteticos, null), 'Selecione o protético...');
  assert.equal(nomeProteticoSelecionado(proteticos, 'inativo'), 'Protético indisponível');
});
