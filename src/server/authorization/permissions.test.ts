import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import type { ClinicRole } from '@/server/auth/clinic';
import { canAccess } from './permissions';

const roles: ClinicRole[] = ['admin', 'dentista', 'secretaria', 'protetico'];
for (const role of roles) {
  test(`configurações: ${role}`, () => {
    assert.equal(canAccess(role, 'configuracoes'), role === 'admin' || role === 'dentista');
  });
}

// Exercise the actions themselves: checking the permission table alone would pass
// before the bug fix even though the actions still allowed unauthorized writes.
const nativeRequire = createRequire(import.meta.url);
type ConfigActions = {
  salvarPerfil(data: { nome: string; cro: string }): Promise<{ error?: string }>;
  salvarHorarios(horarios: unknown[]): Promise<{ error?: string }>;
};
function configActions(role: ClinicRole): ConfigActions {
  const source = readFileSync('src/app/dashboard/configuracoes/actions.ts', 'utf8');
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  runInNewContext(code, {
    exports,
    require: (name: string): unknown => {
      if (name === '@/server/auth/clinic') return {
        requireClinicContext: async () => ({
          role, user: { id: 'qa-user' }, dentistaId: 'qa-profile', clinicId: 'qa-clinic',
          supabase: { from: () => assert.fail('Papel recusado não pode ler ou escrever tabelas.') },
        }),
      };
      if (name === '@/server/authorization/permissions') return { canAccess };
      if (name === 'zod') return nativeRequire(name);
      return {};
    },
  });
  return exports as ConfigActions;
}
for (const role of ['secretaria', 'protetico'] as const) {
  test(`regressão: ${role} não chama o banco ao salvar perfil ou horários das configurações`, async () => {
    const actions = configActions(role);
    for (const result of [
      await actions.salvarPerfil({ nome: 'QA', cro: 'QA-X' }),
      await actions.salvarHorarios([]),
    ]) {
      assert.equal(result.error, 'Só dentistas e o administrador podem alterar as configurações.');
    }
  });
}
