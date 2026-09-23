import assert from 'node:assert/strict';
import test from 'node:test';
import {
  estoquePermissionAllows,
  estoqueScopeAllowsTitular,
  type EstoqueTitular,
} from './estoque-titularidade.ts';
import type { Access, AccessScope } from './access-catalog.ts';

const dentistA = 'a1111111-1111-4111-8111-111111111111';
const dentistB = '22222222-2222-4222-8222-222222222222';

const compartilhado: EstoqueTitular = { tipo: 'clinica' };
const pessoalA: EstoqueTitular = { tipo: 'dentista', dentistaId: dentistA };
const pessoalB: EstoqueTitular = { tipo: 'dentista', dentistaId: dentistB };
const mutacoes = [
  'estoque.receber',
  'estoque.consumir',
  'estoque.descartar',
  'estoque.ajustar',
] as const;

function scope(tipo: AccessScope['tipo'], dentistaIds?: string[]): AccessScope {
  if (tipo === 'selecionados') return { tipo, dentistaIds: dentistaIds ?? [dentistA] };
  return { tipo };
}

function access(permissao: Access['permissao'], escopo: AccessScope): Access {
  return { permissao, escopo };
}

test('titularidade de estoque não reaproveita a semântica clínica de escopo', () => {
  assert.equal(estoqueScopeAllowsTitular(scope('clinica'), compartilhado, null), true);
  assert.equal(estoqueScopeAllowsTitular(scope('clinica'), pessoalA, dentistA), false);
  assert.equal(estoqueScopeAllowsTitular(scope('proprio'), compartilhado, dentistA), false);
  assert.equal(estoqueScopeAllowsTitular(scope('proprio'), pessoalA, dentistA.toUpperCase()), true);
  assert.equal(estoqueScopeAllowsTitular(scope('proprio'), pessoalB, dentistA), false);
  assert.equal(estoqueScopeAllowsTitular(scope('proprio'), pessoalA, null), false);
  assert.equal(estoqueScopeAllowsTitular(scope('selecionados', [dentistA]), pessoalA, null), true);
  assert.equal(estoqueScopeAllowsTitular(scope('selecionados', [dentistA]), pessoalB, dentistA), false);
});

test('mutação de estoque exige ler no mesmo titular', () => {
  assert.equal(estoquePermissionAllows([
    access('estoque.receber', scope('clinica')),
  ], 'estoque.receber', compartilhado, null), false);

  assert.equal(estoquePermissionAllows([
    access('estoque.ler', scope('clinica')),
    access('estoque.receber', scope('clinica')),
  ], 'estoque.receber', compartilhado, null), true);

  assert.equal(estoquePermissionAllows([
    access('estoque.ler', scope('clinica')),
    access('estoque.consumir', scope('clinica')),
  ], 'estoque.consumir', pessoalA, dentistA), false);
});

test('ler sozinho permite consulta, e ler mais gerir não amplia outras ações', () => {
  const somenteMetadados = [
    access('estoque.ler', scope('clinica')),
    access('estoque.gerir', scope('clinica')),
  ];

  assert.equal(estoquePermissionAllows(somenteMetadados, 'estoque.ler', compartilhado, null), true);
  mutacoes.forEach((permissao) => {
    assert.equal(estoquePermissionAllows(somenteMetadados, permissao, compartilhado, null), false);
  });
});

test('leitura e mutação em titulares distintos nunca se combinam', () => {
  assert.equal(estoquePermissionAllows([
    access('estoque.ler', scope('clinica')),
    access('estoque.receber', scope('selecionados', [dentistA])),
  ], 'estoque.receber', pessoalA, null), false);

  assert.equal(estoquePermissionAllows([
    access('estoque.ler', scope('selecionados', [dentistA])),
    access('estoque.receber', scope('clinica')),
  ], 'estoque.receber', compartilhado, null), false);
});

test('acessos vazios ou explicitamente negados falham fechados', () => {
  assert.equal(estoquePermissionAllows([], 'estoque.ler', compartilhado, null), false);
  assert.equal(estoquePermissionAllows([
    access('estoque.ler', scope('nenhum')),
    access('estoque.consumir', scope('nenhum')),
  ], 'estoque.consumir', compartilhado, null), false);
});

test('selecionados permite operação explicitamente concedida a estoque pessoal', () => {
  const accesses = [
    access('estoque.ler', scope('selecionados', [dentistA])),
    access('estoque.gerir', scope('selecionados', [dentistA])),
  ];

  assert.equal(estoquePermissionAllows(accesses, 'estoque.gerir', pessoalA, null), true);
  assert.equal(estoquePermissionAllows(accesses, 'estoque.gerir', pessoalB, null), false);
  assert.equal(estoquePermissionAllows(accesses, 'estoque.gerir', compartilhado, null), false);
});
