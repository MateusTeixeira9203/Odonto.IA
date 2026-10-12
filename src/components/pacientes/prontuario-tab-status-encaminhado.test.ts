import assert from 'node:assert/strict';
import test from 'node:test';
import {
  proximoStatusEncaminhadoLocal,
  refletirStatusEncaminhadoLocal,
} from '@/lib/prontuario/status-encaminhado-local';
import type { ProntuarioLongitudinalData } from '@/server/patients/get-prontuario-longitudinal';

const indicado = {
  id: 'evento-1', fichaId: 'ficha-1', capturaId: null, retiradoEm: null,
  dentistaId: 'autor-1', autorOriginal: { id: 'autor-1', nome: 'Autora', cro: null },
  responsavelEncaminhado: { id: 'destino-1', nome: 'Destino', cro: null },
  tipo: 'endodontia' as const, procedimentoId: null, procedimentoNome: 'Canal',
  status: 'indicado' as const, origem: 'clinica' as const, momento_planejado: 'proxima_sessao' as const,
  ancora: { nivel: 'dente' as const, dente: 26 }, grupo_id: null, papel_no_grupo: null,
  observacao: '', detalhe: null, realizado_em: null, registrado_em: '2026-10-12T10:00:00Z',
  created_at: '2026-10-12T10:00:00Z', assinaturaId: null, encaminhadoParaId: 'destino-1',
  atualizadoEm: '2026-10-12T10:00:00Z', ultimaAlteracao: null,
};

const dadosIniciais = {
  atendimentos: [{ id: 'atendimento-1', eventos: [indicado] }],
  fichas: [{ id: 'ficha-1', eventos: [indicado], atendimentos: [{ id: 'atendimento-1', eventos: [indicado] }], totalProcedimentos: 1, procedimentosRealizados: 0, procedimentosPendentes: 1 }],
  boca: [indicado], profissionaisClinicos: [], errosParciais: [],
} as unknown as ProntuarioLongitudinalData;

test('R-195 reflete o status confirmado e recalcula o progresso sem inventar data clínica', () => {
  const statusLocal = proximoStatusEncaminhadoLocal(dadosIniciais, null, ['evento-1'], 'realizado');
  const refletidos = refletirStatusEncaminhadoLocal(dadosIniciais, statusLocal);
  const ficha = refletidos.fichas[0]!;

  assert.equal(ficha.eventos[0]!.status, 'realizado');
  assert.equal(ficha.eventos[0]!.momento_planejado, 'sessao_atual');
  assert.equal(ficha.eventos[0]!.realizado_em, null);
  assert.equal(ficha.procedimentosRealizados, 1);
  assert.equal(ficha.procedimentosPendentes, 0);
});

test('R-195 cede ao payload novo do servidor', () => {
  const statusLocal = proximoStatusEncaminhadoLocal(dadosIniciais, null, ['evento-1'], 'realizado');
  const dadosDoServidor = { ...dadosIniciais };

  assert.equal(refletirStatusEncaminhadoLocal(dadosDoServidor, statusLocal), dadosDoServidor);
});
