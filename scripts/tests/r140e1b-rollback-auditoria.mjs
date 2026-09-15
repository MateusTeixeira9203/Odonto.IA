// Exercita a RPC real de estoque em Postgres local isolado (PGlite).
// PGLITE_MODULE_PATH=/tmp/r169-db-check/pglite/package/dist/index.js node scripts/tests/r140e1b-rollback-auditoria.mjs
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

if (!process.env.PGLITE_MODULE_PATH) {
  throw new Error('Defina PGLITE_MODULE_PATH para executar a fixture PostgreSQL local.');
}

const { PGlite } = await import(pathToFileURL(process.env.PGLITE_MODULE_PATH).href);
const db = new PGlite();
const migrations = new URL('../../supabase/migrations/', import.meta.url);
const migration = async (name) => readFile(new URL(name, migrations), 'utf8');
const clinica = '10000000-0000-4000-8000-000000000001';
const ator = '20000000-0000-4000-8000-000000000001';
const dentista = '30000000-0000-4000-8000-000000000001';
const membro = '40000000-0000-4000-8000-000000000001';
const item = '50000000-0000-4000-8000-000000000001';
const lote = '60000000-0000-4000-8000-000000000001';

try {
  await db.exec(`
    create role anon;
    create role authenticated;
    create role service_role;
    create schema auth;
    create schema private;
    create schema extensions;
    create function auth.uid() returns uuid language sql stable
      as $$ select nullif(current_setting('test.actor', true), '')::uuid $$;
    -- Stub somente do digest externo: a regra testada é a atomicidade da RPC real.
    create function extensions.digest(text, text) returns bytea language sql immutable
      as $$ select decode(repeat('00', 32), 'hex') $$;
    create table public.clinicas (id uuid primary key);
    create table public.users (id uuid primary key, active_clinica_id uuid);
    create table public.dentistas (
      id uuid primary key, clinica_id uuid not null, user_id uuid not null,
      nome text, role text not null default 'dentista', ativo boolean not null default true
    );
    create table public.secretarias (id uuid primary key default gen_random_uuid(), clinica_id uuid, usuario_id uuid, nome text);
    create table public.clinica_governanca (clinica_id uuid primary key);
    create table public.clinica_usuarios (id uuid primary key, clinica_id uuid not null, usuario_id uuid not null, status text not null);
    create table public.clinica_acessos (id uuid primary key default gen_random_uuid(), clinica_id uuid not null, membro_id uuid not null);
    create function private.obter_contexto_estoque(p_clinica uuid)
    returns jsonb language sql stable set search_path = pg_catalog, public, auth as $$
      select jsonb_build_object('ok', true, 'data', jsonb_build_object(
        'clinicaId', p_clinica::text,
        'dentistaId', auth.uid()::text,
        'permissoesPessoais', jsonb_build_array('estoque.ler','estoque.gerir','estoque.receber','estoque.consumir','estoque.descartar','estoque.ajustar'),
        'permissoesCompartilhadas', jsonb_build_array('estoque.ler','estoque.gerir','estoque.receber','estoque.consumir','estoque.descartar','estoque.ajustar'),
        'podeGerenciarCompartilhado', true
      ))
    $$;
    insert into public.clinicas values ('${clinica}');
    insert into public.users values ('${ator}', '${clinica}');
    insert into public.dentistas values ('${dentista}', '${clinica}', '${ator}', 'Dra. QA', 'dentista', true);
    insert into public.clinica_governanca values ('${clinica}');
    insert into public.clinica_usuarios values ('${membro}', '${clinica}', '${ator}', 'ativo');
    insert into public.clinica_acessos(clinica_id, membro_id) values ('${clinica}', '${membro}');
    select set_config('test.actor', '${ator}', false);
  `);

  await db.exec(await migration('20260912023531_r140e1_estrutura_estoque_manual.sql'));
  await db.exec(await migration('20260913005320_r140e1b_operacoes_estoque.sql'));
  await db.exec(await migration('20260913012420_r140e1b_corrigir_trigger_saldo_definer.sql'));
  await db.exec(await migration('20260913012824_r140e1b_corrigir_tipo_consumo.sql'));

  await db.exec(`
    insert into public.estoque_itens(
      id, clinica_id, titular_tipo, nome, unidade_base, comportamento, controle_lote, minimo
    ) values ('${item}', '${clinica}', 'clinica', 'Resina QA', 'unidade', 'consumivel', false, 0);
    insert into public.estoque_lotes(
      id, clinica_id, item_id, identificador_fabricante, validade, origem_sem_identificacao
    ) values ('${lote}', '${clinica}', '${item}', null, null, true);
    create function private.r140e1b_falhar_auditoria()
    returns trigger language plpgsql set search_path = pg_catalog as $$
    begin
      raise exception 'R140E1B_AUDITORIA_FORCADA' using errcode = 'P0001';
    end;
    $$;
    create trigger r140e1b_forcar_falha_auditoria
      before insert on public.estoque_auditoria
      for each row execute function private.r140e1b_falhar_auditoria();
  `);

  const executar = async (chave, versao = 1) => (
    await db.query(
      'select public.operar_estoque($1, $2::jsonb) as resultado',
      ['receber', JSON.stringify({
        clinicaIdEsperada: clinica,
        chaveIdempotencia: chave,
        itemId: item,
        loteId: lote,
        versaoEsperada: versao,
        quantidadeBase: '5',
      })],
    )
  ).rows[0].resultado;

  const falha = await executar('70000000-0000-4000-8000-000000000001');
  assert.deepEqual(
    { ok: falha.ok, codigo: falha.codigo },
    { ok: false, codigo: 'INDISPONIVEL' },
    'a exceção do trigger de auditoria deve ser absorvida como falha operacional',
  );
  const aposFalha = (await db.query(`
    select
      (select count(*)::int from public.estoque_operacoes) as operacoes,
      (select count(*)::int from public.estoque_movimentos) as movimentos,
      (select count(*)::int from public.estoque_auditoria) as auditorias,
      (select versao from public.estoque_itens where id = '${item}') as versao,
      (select coalesce(sum(quantidade), 0) from public.estoque_movimentos where item_id = '${item}') as saldo
  `)).rows[0];
  assert.deepEqual(
    {
      operacoes: aposFalha.operacoes,
      movimentos: aposFalha.movimentos,
      auditorias: aposFalha.auditorias,
      versao: aposFalha.versao,
      saldo: Number(aposFalha.saldo),
    },
    { operacoes: 0, movimentos: 0, auditorias: 0, versao: 1, saldo: 0 },
    'falha na auditoria não pode manter operação, movimento, saldo nem versão parcial',
  );

  await db.exec('drop trigger r140e1b_forcar_falha_auditoria on public.estoque_auditoria');
  const sucesso = await executar('70000000-0000-4000-8000-000000000002');
  assert.equal(sucesso.ok, true, JSON.stringify(sucesso));
  assert.deepEqual(sucesso.data.saldo, '5');
  const aposSucesso = (await db.query(`
    select
      (select count(*)::int from public.estoque_operacoes) as operacoes,
      (select count(*)::int from public.estoque_movimentos) as movimentos,
      (select count(*)::int from public.estoque_auditoria) as auditorias,
      (select versao from public.estoque_itens where id = '${item}') as versao,
      (select coalesce(sum(quantidade), 0) from public.estoque_movimentos where item_id = '${item}') as saldo
  `)).rows[0];
  assert.deepEqual(
    {
      operacoes: aposSucesso.operacoes,
      movimentos: aposSucesso.movimentos,
      auditorias: aposSucesso.auditorias,
      versao: aposSucesso.versao,
      saldo: Number(aposSucesso.saldo),
    },
    { operacoes: 1, movimentos: 1, auditorias: 1, versao: 2, saldo: 5 },
    'a mesma RPC real precisa seguir funcional após a falha de auditoria',
  );
  console.log('R140e1b: falha forçada na auditoria reverte operação, movimento, saldo e versão; nova recepção passou.');
} finally {
  await db.close();
}
