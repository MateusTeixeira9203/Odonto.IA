import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const migration = readFileSync(fileURLToPath(new URL(
  '../../../supabase/migrations/20260916010305_r159c_recepcao_operacional.sql',
  import.meta.url,
)), 'utf8');

test('helper operacional usa membro ativo, clínica ativa, whitelist e alvo clínico ativo', () => {
  assert.match(migration, /create or replace function private\.membro_tem_permissao_operacional/);
  assert.match(migration, /u\.active_clinica_id = p_clinica_id/);
  assert.match(migration, /cu\.status = 'ativo'/);
  assert.match(migration, /'agenda\.ler', 'agenda\.editar', 'agenda\.confirmar'/);
  assert.match(migration, /'financeiro\.ler', 'financeiro\.exportar', 'cobrancas\.ler'/);
  assert.match(migration, /'orcamentos\.ler', 'contatos\.whatsapp'/);
  assert.match(migration, /p_dentista_id is null and acesso\.value -> 'escopo' ->> 'tipo' = 'clinica'/);
  assert.match(migration, /d\.id = p_dentista_id[\s\S]*d\.clinica_id = p_clinica_id[\s\S]*d\.ativo/);
  assert.match(migration, /cu\.role <> 'protetico'[\s\S]*p_permissao in \('agenda\.ler', 'agenda\.confirmar'\)/);
  assert.doesNotMatch(migration, /'clinico\.ler'|'clinico\.registrar'|'orcamentos\.criar'/);
});

test('recepção sem perfil clínico não herda policies clínicas ou acesso amplo por cargo', () => {
  assert.match(migration, /create or replace function public\.is_clinic_staff\(\)/);
  assert.match(migration, /join public\.dentistas d[\s\S]*d\.clinica_id = u\.active_clinica_id[\s\S]*d\.ativo/);
  assert.match(migration, /create or replace function private\.membro_tem_acesso_paciente_operacional/);
  assert.match(migration, /from public\.agendamentos a[\s\S]*from public\.atendimentos_clinicos ac[\s\S]*from public\.orcamentos o/);
  assert.match(migration, /drop policy if exists "agendamentos_all_clinic_members"/);
  assert.match(migration, /drop policy if exists "pacientes_all_clinic_members"/);
  assert.match(migration, /drop policy if exists "horarios_select_clinic_members"[\s\S]*create policy "horarios_operacionais_select"/);
  assert.doesNotMatch(migration, /membro_legado_pode_operar_profissional/);
});

test('paciente novo da recepção nasce junto com agendamento autorizado', () => {
  assert.match(migration, /create or replace function public\.criar_paciente_e_agendamento_operacional/);
  assert.match(migration, /cu\.role = 'secretaria'[\s\S]*join public\.secretarias s/);
  assert.match(migration, /not exists \([\s\S]*from public\.dentistas d/);
  assert.match(migration, /'pacientes\.editar', p_dentista_id[\s\S]*'agenda\.editar', p_dentista_id/);
  assert.match(migration, /tstzrange\(a\.data_hora[\s\S]*'CONFLITO_DENTISTA'/);
  assert.match(migration, /horarios_disponiveis h[\s\S]*'FORA_EXPEDIENTE'/);
  assert.match(migration, /insert into public\.pacientes[\s\S]*insert into public\.agendamentos/);
  assert.match(migration, /created_by\n  \) values \([\s\S]*'manual', null/);
});

test('seletor operacional de agenda só devolve profissionais no escopo agenda.ler', () => {
  assert.match(migration, /create or replace function public\.listar_profissionais_agenda_operacional/);
  assert.match(migration, /d\.role in \('admin', 'dentista'\)[\s\S]*'agenda\.ler', d\.id/);
});

test('paciente existente precisa de relação e agenda.editar antes do agendamento atômico', () => {
  assert.match(migration, /create or replace function public\.criar_agendamento_operacional/);
  assert.match(migration, /membro_tem_acesso_paciente_operacional\(p_clinica_id, 'pacientes\.ler', p_paciente_id\)[\s\S]*'agenda\.editar', p_dentista_id/);
  assert.match(migration, /insert into public\.agendamentos[\s\S]*'manual', null/);
});
