import assert from 'node:assert/strict';
import { test } from 'node:test';
import { limparDadosMeuDiaDaAba } from './use-logout';

function armazenamento(entradas: Array<[string, string]>) {
  const dados = new Map(entradas);
  const storage: Pick<Storage, 'length' | 'key' | 'removeItem'> = {
    get length() { return dados.size; },
    key: (indice) => [...dados.keys()][indice] ?? null,
    removeItem: (chave) => { dados.delete(chave); },
  };
  return { dados, storage };
}

test('limpa todos os dados do Meu Dia, inclusive rascunhos de versões e pacientes diferentes', () => {
  const { dados, storage } = armazenamento([
    ['odontoia:meu-dia:rascunho:v1:paciente-ficticio-a', 'texto fictício A'],
    ['odontoia:meu-dia:rascunho:v2:paciente-ficticio-b', 'texto fictício B'],
    ['odontoia:meu-dia:rascunho:v2:paciente-ficticio-c', 'texto fictício C'],
    ['odontoia:meu-dia:selecao', 'agendamento fictício'],
  ]);
  limparDadosMeuDiaDaAba(storage);
  assert.equal(dados.size, 0);
});

test('preserva dados de outras funcionalidades e prefixos parecidos', () => {
  const { dados, storage } = armazenamento([
    ['preferencia-tema', 'escuro'],
    ['odontoia:meu-dia:rascunho:v2:qa', 'texto fictício'],
    ['odontoia:orcamento:qa', 'preferência fictícia'],
    ['odontoia:meu-dia-extra:qa', 'outro recurso'],
  ]);
  limparDadosMeuDiaDaAba(storage);
  assert.deepEqual([...dados.keys()], ['preferencia-tema', 'odontoia:orcamento:qa', 'odontoia:meu-dia-extra:qa']);
});

test('a limpeza repetida é segura e remove um rascunho regravado durante a saída', () => {
  const { dados, storage } = armazenamento([]);
  limparDadosMeuDiaDaAba(storage);
  dados.set('odontoia:meu-dia:rascunho:v2:qa', 'texto fictício regravado no pagehide');
  limparDadosMeuDiaDaAba(storage);
  limparDadosMeuDiaDaAba(storage);
  assert.equal(dados.size, 0);
});

test('storage bloqueado não interrompe o fluxo de saída', () => {
  const storage: Pick<Storage, 'length' | 'key' | 'removeItem'> = {
    get length(): number { throw new Error('Storage indisponível no teste'); },
    key: () => null,
    removeItem: () => undefined,
  };
  assert.doesNotThrow(() => limparDadosMeuDiaDaAba(storage));
});

test('sem navegador a limpeza não acessa storage nem falha', () => {
  assert.equal(typeof window, 'undefined');
  assert.doesNotThrow(() => limparDadosMeuDiaDaAba());
});
