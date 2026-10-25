import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

// Load the real module without executing its server-only dependencies.
const source = readFileSync('src/server/patients/registrar-atendimento-clinico.ts', 'utf8');
const output = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const exports: { papelPodeRegistrarClinico(role: string): boolean; MENSAGEM_VISITA_FINALIZADA: string } =
  runInNewContext(output + '\nexports;', { exports: {}, require: () => ({}) });

for (const role of ['admin', 'dentista']) {
  test(`registro clinico permite ${role}`, () => {
    assert.equal(exports.papelPodeRegistrarClinico(role), true);
  });
}
for (const role of ['secretaria', 'protetico', 'desconhecido', '']) {
  test(`registro clinico recusa ${role || 'papel vazio'}`, () => {
    assert.equal(exports.papelPodeRegistrarClinico(role), false);
  });
}
test('visita finalizada orienta sobre o texto acrescentado e Novo atendimento', () => {
  assert.equal(exports.MENSAGEM_VISITA_FINALIZADA,
    'Esta visita j\u00e1 foi finalizada e est\u00e1 salva na Ficha. Se voc\u00ea acrescentou algo depois, isso n\u00e3o foi gravado: use Novo atendimento na Ficha do paciente.');
});
