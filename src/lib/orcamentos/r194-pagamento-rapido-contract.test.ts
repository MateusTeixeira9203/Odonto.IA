import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const actionSource = readFileSync(
  fileURLToPath(new URL('../../app/dashboard/orcamentos/actions.ts', import.meta.url)),
  'utf8',
);
const migrationSource = readFileSync(
  fileURLToPath(
    new URL('../../../supabase/migrations/20261012034858_r194_confirmacao_parcela_idempotente.sql', import.meta.url),
  ),
  'utf8',
);

function pagamentoRapidoAction(): string {
  const inicio = actionSource.indexOf('export async function registrarPagamentoRapido');
  const fim = actionSource.indexOf('\nexport async function excluirOrcamento', inicio);
  assert.notEqual(inicio, -1, 'registrarPagamentoRapido precisa existir');
  assert.notEqual(fim, -1, 'o limite da action precisa continuar identificável');
  return actionSource.slice(inicio, fim);
}

test('R-194 mantém uma única chamada transacional no pagamento rápido', () => {
  const action = pagamentoRapidoAction();
  const chamadasRpc = action.match(/await rpc\(/g) ?? [];

  assert.equal(chamadasRpc.length, 1);
  assert.match(action, /await rpc\('registrar_pagamento_rapido_idempotente'/);
  assert.doesNotMatch(action, /\.from\(/);
  assert.doesNotMatch(action, /confirmar_previsao_orcamento_idempotente/);
  assert.doesNotMatch(action, /registrarPagamento\(/);
});

test('R-194 autoriza e reconcilia sob o lock antes de escolher previsão ou saldo', () => {
  assert.match(migrationSource, /security definer\s+set search_path = ''/);
  assert.match(migrationSource, /cu\.usuario_id = v_auth_user_id/);
  assert.match(migrationSource, /cu\.status = 'ativo'/);
  assert.match(migrationSource, /v_orcamento\.dentista_id is distinct from v_caller\.id/);

  const lockOrcamento = migrationSource.indexOf('from public.orcamentos o');
  const replay = migrationSource.indexOf('and p.operacao_id = p_operacao_id;');
  const escolhaPrevisao = migrationSource.indexOf("and p.status = 'pendente'");
  assert.ok(lockOrcamento >= 0);
  assert.ok(replay > lockOrcamento);
  assert.ok(escolhaPrevisao > replay);
  assert.match(migrationSource.slice(lockOrcamento, replay), /for update;/);
});

test('R-194 depende da chave única da R-189, sem recriar o índice', () => {
  assert.doesNotMatch(migrationSource, /create\s+unique\s+index/i);
  assert.match(migrationSource, /v_constraint_name is distinct from 'uq_pagamentos_clinica_operacao'/);
});

test('R-194 notifica somente o primeiro efeito de saldo aplicável', () => {
  const replay = migrationSource.indexOf('and p.operacao_id = p_operacao_id;');
  const notificacao = migrationSource.indexOf('insert into public.notificacoes');
  const atividade = migrationSource.indexOf('insert into public.activity_logs');

  assert.ok(notificacao > replay);
  assert.ok(atividade > notificacao);
  assert.match(
    migrationSource.slice(replay, notificacao),
    /repetida := true;\s+return next;\s+return;/,
  );
  assert.equal((migrationSource.match(/insert into public\.notificacoes/g) ?? []).length, 1);
  assert.match(
    migrationSource,
    /if v_origem = 'saldo'[\s\S]+v_membership_role = 'secretaria'[\s\S]+v_orcamento\.dentista_id is distinct from v_caller\.id then/,
  );
  assert.match(migrationSource, /'pagamento_confirmado'/);
  assert.match(migrationSource, /v_notificacao_status text := 'nao_aplicavel'/);
  assert.match(migrationSource, /v_notificacao_status := 'emitida'/);
  assert.match(migrationSource, /when others then\s+v_notificacao_status := 'falhou'/);
  assert.match(
    migrationSource,
    /'notificacao_pagamento_confirmado', v_notificacao_status/,
  );
});

test('R-194 mantém um log novo e grants restritos', () => {
  assert.equal((migrationSource.match(/insert into public\.activity_logs/g) ?? []).length, 1);
  assert.match(migrationSource, /revoke all on function[\s\S]+from public, anon;/);
  assert.match(migrationSource, /grant execute on function[\s\S]+to authenticated;/);
  assert.doesNotMatch(migrationSource, /confirmar_previsao_orcamento_idempotente/);
});
