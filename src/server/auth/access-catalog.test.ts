import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ACCESS_PERMISSIONS,
  AccessCollectionSchema,
  AccessSchema,
  professionalScopeContains,
  type AccessScope,
} from './access-catalog.ts';

const dentistA = 'a1111111-1111-4111-8111-111111111111';
const dentistB = '22222222-2222-4222-8222-222222222222';

function scope(tipo: AccessScope['tipo'], dentistaIds?: string[]): AccessScope {
  if (tipo === 'selecionados') return { tipo, dentistaIds: dentistaIds ?? [dentistA] };
  return { tipo };
}

test('o catálogo contém exatamente as permissões do R-159', () => {
  assert.equal(ACCESS_PERMISSIONS.length, 42);
  assert.equal(new Set(ACCESS_PERMISSIONS).size, ACCESS_PERMISSIONS.length);
  assert.deepEqual(ACCESS_PERMISSIONS.slice(-4), [
    'estoque.ajustar',
    'kits.gerir',
    'materiais.confirmar',
    'unidades.consolidar',
  ]);
});

test('rejeita permissão desconhecida, propriedades extras e escopo indevido', () => {
  assert.equal(AccessSchema.safeParse({
    permissao: 'desconhecida', escopo: { tipo: 'clinica' },
  }).success, false);

  assert.equal(AccessSchema.safeParse({
    permissao: 'agenda.ler', escopo: { tipo: 'clinica' }, extra: true,
  }).success, false);

  assert.equal(AccessSchema.safeParse({
    permissao: 'agenda.ler', escopo: { tipo: 'clinica', extra: true },
  }).success, false);

  assert.equal(AccessSchema.safeParse({
    permissao: 'pacientes.ler', escopo: { tipo: 'proprio' },
  }).success, false);
});

test('rejeita coleções duplicadas e selecionados inválidos', () => {
  assert.equal(AccessCollectionSchema.safeParse([
    { permissao: 'agenda.ler', escopo: { tipo: 'clinica' } },
    { permissao: 'agenda.ler', escopo: { tipo: 'selecionados', dentistaIds: [dentistA] } },
  ]).success, false);

  assert.equal(AccessSchema.safeParse({
    permissao: 'agenda.ler', escopo: { tipo: 'selecionados', dentistaIds: [dentistA, dentistA] },
  }).success, false);

  assert.equal(AccessSchema.safeParse({
    permissao: 'agenda.ler', escopo: { tipo: 'selecionados', dentistaIds: [dentistA, dentistA.toUpperCase()] },
  }).success, false);

  assert.equal(AccessSchema.safeParse({
    permissao: 'agenda.ler', escopo: { tipo: 'selecionados', dentistaIds: ['não-é-uuid'] },
  }).success, false);

  assert.equal(AccessSchema.safeParse({
    permissao: 'agenda.ler',
    escopo: { tipo: 'selecionados', dentistaIds: Array.from({ length: 201 }, (_, index) =>
      `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`),
    },
  }).success, false);
});

test('inclusão de escopo falha fechada quando a identidade clínica falta', () => {
  assert.equal(professionalScopeContains(scope('proprio'), scope('proprio'), null), false);
  assert.equal(professionalScopeContains(scope('selecionados', [dentistA]), scope('proprio'), null), false);
  assert.equal(professionalScopeContains(scope('clinica'), scope('proprio'), null), false);
  assert.equal(professionalScopeContains(scope('clinica'), scope('proprio'), ''), false);
  assert.equal(professionalScopeContains(scope('nenhum'), scope('proprio'), dentistA), false);
});

test('UUIDs de selecionados são canônicos antes da comparação de escopo', () => {
  const access = AccessSchema.parse({
    permissao: 'agenda.ler',
    escopo: { tipo: 'selecionados', dentistaIds: [dentistA.toUpperCase()] },
  });
  assert.deepEqual(access.escopo, scope('selecionados', [dentistA]));
  assert.equal(professionalScopeContains(access.escopo, scope('proprio'), dentistA.toUpperCase()), true);
});

test('selecionados não amplia para outros profissionais e próprio nunca vira clínica', () => {
  assert.equal(
    professionalScopeContains(scope('selecionados', [dentistA]), scope('selecionados', [dentistA, dentistB]), dentistA),
    false,
  );
  assert.equal(professionalScopeContains(scope('proprio'), scope('clinica'), dentistA), false);
  assert.equal(professionalScopeContains(scope('clinica'), scope('selecionados', [dentistA, dentistB]), null), true);
});
