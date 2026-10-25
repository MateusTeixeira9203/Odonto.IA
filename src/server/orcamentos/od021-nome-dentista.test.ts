import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';

const base = 'src/app/dashboard/pacientes/[id]/_components/';
const relation = 'dentista:dentistas!orcamentos_dentista_id_fkey(nome)';

test('OD-021: SSR e releitura usam a mesma FK simples do PDF sem inner join', () => {
  const pdf = readFileSync('src/app/api/orcamentos/[id]/pdf/route.ts', 'utf8');
  assert.ok(pdf.includes(relation));
  for (const path of ['src/server/patients/get-patient-workspace-data.ts', `${base}use-orcamento-modal.ts`]) {
    const source = readFileSync(path, 'utf8');
    const select = source.match(/\.from\('orcamentos'\)\s*\.select\([\s\S]*?\)\s*\.eq|\.from\('orcamentos'\)\s*\.select\([\s\S]*?\)\s*\.is/g)
      ?.find(query => query.includes('mostrar_valor_por_item'));
    assert.ok(select?.includes(relation), `${path}: relação do responsável`);
    assert.ok(!select.includes('!inner'), 'orçamento sem dentista deve continuar visível');
    assert.match(source, /\.eq\('paciente_id', (patientId|pacienteId)\)/);
    assert.match(source, /\.eq\('clinica_id', (clinicId|clinicaId)\)/);
  }
});

for (const [path, variable] of [
  [`${base}paciente-detail-client.tsx`, 'orc'],
  [`${base}modals/detalhe-orcamento-modal.tsx`, 'detalheOrc'],
]) {
  // Renderiza o JSX real do rótulo, sem dependências de auth ou dados reais.
  const source = readFileSync(path, 'utf8');
  const paragraph = source.match(/<p\b[^>]*>\s*Dentista responsável:[\s\S]*?<\/p>/)?.[0];
  assert.ok(paragraph, `${path}: rótulo visível`);
  const compiled = ts.transpileModule(`const resultado = (${paragraph});`, {
    compilerOptions: { jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2022 },
  }).outputText;

  for (const dentista of [{ nome: 'QA Dentista Responsável Sintético' }, null, undefined]) {
    test(`OD-021: ${variable} renderiza ${dentista ? 'nome' : String(dentista)}`, () => {
      const element = runInNewContext(`${compiled}\nresultado`, {
        React, [variable]: { dentista, aprovado_por: { nome: 'QA Outro Aprovador' } },
      }) as React.ReactElement;
      const html = renderToStaticMarkup(element);
      assert.ok(html.includes(`Dentista responsável: ${dentista?.nome ?? '—'}`));
      assert.ok(!html.includes('QA Outro Aprovador'));
      assert.ok(html.includes('text-muted-foreground'));
      assert.ok(html.includes('break-words'));
    });
  }
}
