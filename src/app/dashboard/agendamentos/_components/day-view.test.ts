import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { DayView } from './day-view';
import type { DentistaAgenda } from './cor-dentista';
import type { AgendamentoRow } from '../page';

const appointment: AgendamentoRow = {
  id: 'appointment-1',
  clinica_id: 'clinic-1',
  paciente_id: 'patient-1',
  dentista_id: 'dentist-1',
  data_hora: '2026-09-10T07:30:00-03:00',
  duracao_minutos: 30,
  status: 'scheduled',
  origem: 'manual',
  observacoes: null,
  created_at: '2026-09-01T12:00:00-03:00',
  paciente: { id: 'patient-1', nome: 'Maria Aparecida de Oliveira', observacoes: null },
  dentista: { id: 'dentist-1', nome: 'Dra. Ana' },
  criador: null,
};

const dentists: DentistaAgenda[] = [
  { id: 'dentist-1', nome: 'Dra. Ana', slot: 0 },
  { id: 'dentist-2', nome: 'Dr. Bruno', slot: 1 },
];

function renderDayView(colunas: DentistaAgenda[]): string {
  return renderToStaticMarkup(createElement(DayView, {
    agendamentos: [appointment],
    bloqueios: [],
    selectedDate: new Date('2026-09-10T12:00:00-03:00'),
    onDateChange: () => undefined,
    onAppointmentClick: () => undefined,
    onBloqueioClick: () => undefined,
    isSecretaria: true,
    onConfirm: () => undefined,
    onCheckIn: () => undefined,
    onNoShow: () => undefined,
    onCancel: () => undefined,
    onVerFicha: () => undefined,
    slotPorDentista: { 'dentist-1': 0, 'dentist-2': 1 },
    colunas,
    onSlotVazioClick: () => undefined,
  }));
}

test('multi-coluna prioriza o nome e não renderiza ações rápidas', () => {
  const html = renderDayView(dentists);

  assert.match(html, /Maria Aparecida de Oliveira/);
  assert.match(html, /Abrir detalhes de Maria Aparecida de Oliveira, \d{2}:\d{2} — Agendado/);
  assert.match(html, /aria-label="Dia anterior"/);
  assert.match(html, /aria-label="Próximo dia"/);
  assert.match(html, /text-foreground/);
  assert.match(html, /color-mix\(in srgb, #d97706 12\.5%, transparent\)/);
  assert.match(html, /focus-visible:ring-inset/);
  assert.doesNotMatch(html, /Confirmar consulta/);
  assert.doesNotMatch(html, /Paciente chegou \(check-in\)/);
  assert.doesNotMatch(html, /Paciente faltou/);
  assert.doesNotMatch(html, /Cancelar consulta/);
  assert.doesNotMatch(html, /Ver ficha do paciente/);
});

test('coluna única mantém as ações rápidas existentes', () => {
  const html = renderDayView([dentists[0]]);

  assert.match(html, /Confirmar consulta/);
  assert.match(html, /Paciente chegou \(check-in\)/);
  assert.match(html, /Paciente faltou/);
  assert.match(html, /Cancelar consulta/);
  assert.match(html, /Ver ficha do paciente/);
});
