import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { resolve } from 'node:path';

const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260914013908_r161d_pendencias_contatos.sql'),
  'utf8',
);
const incremental = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260914015942_r161d_correcao_permissoes_reconcile.sql'),
  'utf8',
);
const agendaGuard = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260914022321_r161d_guardar_agenda_e_autorizacao_antes_cas.sql'),
  'utf8',
);
const clinicalFilter = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260914022831_r161d_filtrar_profissionais_clinicos.sql'),
  'utf8',
);

test('R161d preserva a origem clínica da reativação e não fecha por visita histórica', () => {
  assert.match(migration, /select ac\.id,ac\.dentista_id,ac\.data_atendimento from public\.atendimentos_clinicos ac/);
  assert.match(migration, /ac\.estado='finalizado'/);
  assert.match(migration, /m\.dentista_id=ultimo\.dentista_id/);
  assert.match(migration, /\(novo\.data_atendimento,novo\.created_at,novo\.id::text\) > \(origem\.data_atendimento,origem\.created_at,origem\.id::text\)/);
  assert.match(migration, /a\.paciente_id=p\.id and a\.data_hora > now\(\)/);
});

test('R161d mantém CAS, histórico transacional e telefone seguro no SQL', () => {
  assert.match(migration, /for update of p/);
  assert.match(migration, /estado_anterior/);
  assert.match(migration, /on conflict \(clinica_id,dentista_id,tipo\) do update[\s\S]*where public\.pendencias_mensagens\.versao=v_versao/);
  assert.match(migration, /if char_length\(v_numero\) in \(10,11\) then v_numero := '55' \|\| v_numero/);
  assert.match(migration, /if char_length\(v_numero\) not between 12 and 15 then/);
  assert.match(migration, /lpad\(to_hex\(v_byte\), 2, '0'\)/);
});

test('R161d incremental recompila funções e limita o board sem vazar contato', () => {
  assert.match(incremental, /create or replace function private\.listar_pendencias_contatos/);
  assert.match(incremental, /create or replace function private\.materializar_pendencias_contatos/);
  assert.match(incremental, /versao=p\.versao\+1/);
  assert.match(incremental, /from alvo, public\.agendamentos a/);
  assert.match(incremental, /'podeVerContato',private\.pendencias_tem_permissao_profissional/);
  assert.match(incremental, /else 'Mensagem indisponível\.' end/);
  assert.match(incremental, /order by ordem_tipo, ordem_data nulls last, paciente_nome\s+limit 500/);
  assert.match(incremental, /v_adiado is null or not isfinite\(v_adiado\)/);
});

test('R161d exige envio antes de agenda e autoriza antes do CAS', () => {
  assert.match(agendaGuard, /create or replace function private\.operar_pendencia_contato/);
  assert.match(agendaGuard, /if v_p\.status <> 'esperando_resposta' or v_p\.envio_confirmado is not true then/);
  assert.match(agendaGuard, /'Registre o envio antes de alterar a agenda\.'/);
  assert.ok(
    agendaGuard.indexOf("'Sem acesso para alterar o acompanhamento.'")
      < agendaGuard.indexOf('if v_p.versao <> v_versao then'),
  );
});

test('R161d só lista e materializa profissionais clínicos ativos', () => {
  assert.match(clinicalFilter, /create or replace function private\.listar_pendencias_contatos/);
  assert.match(clinicalFilter, /create or replace function private\.materializar_pendencias_contatos/);
  assert.match(clinicalFilter, /d\.ativo and d\.role in \('admin','dentista'\)/);
  assert.match(clinicalFilter, /du\.status='ativo' and du\.role in \('admin','dentista'\)/);
});
