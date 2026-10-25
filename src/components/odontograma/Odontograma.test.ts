import assert from 'node:assert/strict';
import test from 'node:test';
import type { OdontogramaEventoDraft, TipoRegistroOdontograma } from '@/types/odontograma';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Odontograma, rotuloDenticao, buildResumos } from './Odontograma';

function evento(
  id: string,
  tipo: TipoRegistroOdontograma,
  status: OdontogramaEventoDraft['status'],
): OdontogramaEventoDraft {
  return {
    id,
    tipo,
    status,
    origem: status === 'realizado' ? 'preexistente' : 'profissional',
    momento_planejado: status === 'realizado' ? 'sessao_atual' : 'proxima_sessao',
    ancora: { nivel: 'dente', dente: 23 },
    grupo_id: null,
    papel_no_grupo: null,
    observacao: '',
    realizado_em: status === 'realizado' ? '2026-09-02' : null,
    created_at: '2026-09-02T12:00:00Z',
  };
}

test('implante indicado não apaga ausência pré-existente do odontograma', () => {
  const resumos = buildResumos([], [
    evento('ausencia', 'exodontia', 'realizado'),
    evento('implante-planejado', 'implante', 'indicado'),
  ]);

  assert.equal(resumos.get(23)?.ausente, true);
});

test('implante realizado volta a desenhar o dente antes ausente', () => {
  const resumos = buildResumos([], [
    evento('ausencia', 'exodontia', 'realizado'),
    evento('implante-realizado', 'implante', 'realizado'),
  ]);

  assert.equal(resumos.get(23)?.ausente, false);
});

test('MD-06: cabecalho e dentes seguem a mesma denticao controlada, inclusive ao voltar', () => {
  for (const denticao of ['permanent', 'deciduous', 'permanent'] as const) {
    const markup = renderToStaticMarkup(createElement(Odontograma, {
      denticao, selectedTeeth: [], onToothToggle: () => {}, layout: 'colunas',
    }));
    assert.equal(rotuloDenticao(denticao), denticao === 'deciduous' ? 'Dentição decídua' : 'Dentição permanente');
    assert.equal(markup.includes('Dente 55'), denticao === 'deciduous');
    assert.equal(markup.includes('Dente 18'), denticao === 'permanent');
  }
});
