import assert from 'node:assert/strict';
import test from 'node:test';
import {
  janelaDaSemanaDisponibilidade,
  slotPodeSerSelecionadoParaRetorno,
  slotEstaLivre,
  type DisponibilidadeDia,
} from './disponibilidade';

test('a disponibilidade busca a semana desenhada a partir do domingo inicial', () => {
  assert.deepEqual(janelaDaSemanaDisponibilidade('2026-08-30'), {
    de: '2026-08-31T00:00:00.000-03:00',
    ate: '2026-09-06T00:00:00.000-03:00',
  });
});

const futuro: DisponibilidadeDia = {
  data: '2099-06-15',
  diaSemana: 1,
  temGrade: true,
  livres: [{ inicioMin: 8 * 60, fimMin: 18 * 60 }],
  ocupados: [{ inicioMin: 10 * 60, duracaoMin: 30, pacienteNome: 'Paciente' }],
  intervaloMinutos: 30,
};

test('slot livre rejeita ocupado e permite adjacência para a duração escolhida', () => {
  const agora = new Date('2026-09-07T12:00:00-03:00');

  assert.equal(slotEstaLivre(9 * 60 + 30, 30, futuro, agora), true);
  assert.equal(slotEstaLivre(10 * 60, 30, futuro, agora), false);
  assert.equal(slotEstaLivre(9 * 60 + 45, 30, futuro, agora), false);
  assert.equal(slotEstaLivre(10 * 60 + 30, 30, futuro, agora), true);
});

test('retorno permite fora do expediente, mas não ocupado ou passado', () => {
  const agora = new Date('2026-09-07T12:00:00-03:00');
  const semGrade: DisponibilidadeDia = { ...futuro, temGrade: false, livres: [] };
  const passado: DisponibilidadeDia = { ...semGrade, data: '2000-01-01' };

  assert.equal(slotPodeSerSelecionadoParaRetorno(7 * 60, 30, futuro, agora), true);
  assert.equal(slotPodeSerSelecionadoParaRetorno(9 * 60, 30, semGrade, agora), true);
  assert.equal(slotPodeSerSelecionadoParaRetorno(10 * 60, 30, semGrade, agora), false);
  assert.equal(slotPodeSerSelecionadoParaRetorno(9 * 60, 30, passado, agora), false);
});
