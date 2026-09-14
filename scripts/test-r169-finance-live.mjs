/** SQL real em Postgres/WASM isolado; não acessa Supabase nem altera clínicas.
 * R169_PGLITE=/caminho/pglite/dist/index.js node scripts/test-r169b-ficha-orcamento.mjs
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

if (!process.env.R169_PGLITE) throw new Error('Informe R169_PGLITE (runtime temporário, fora das dependências do app).');
const { PGlite } = await import(pathToFileURL(process.env.R169_PGLITE).href);
const db = new PGlite();
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const clinic = id(1), actor = id(2), patient = id(3), ficha = id(4), orcamento = id(5);
const eventoA = id(6), eventoB = id(7), item = id(8), cobranca = id(9);

await db.exec(`
  create role authenticated; create role anon;
  create table dentistas(id uuid primary key, clinica_id uuid not null, nome text not null);
  create table fichas(id uuid primary key, clinica_id uuid not null, paciente_id uuid not null, dentista_id uuid,
    assinado_em timestamptz, dentes_afetados integer[], dentes_observacoes jsonb, procedimentos text[], status text, updated_at timestamptz);
  create table odontograma_eventos(id uuid primary key, clinica_id uuid not null, paciente_id uuid not null, dentista_id uuid,
    ficha_id uuid not null, assinatura_id uuid, procedimento_nome text, tipo text not null, observacao text, dente integer,
    status text not null, origem text not null, nivel text default 'dente', arcada text, quadrante smallint, created_at timestamptz default now());
  create table procedimentos(id uuid primary key, clinica_id uuid not null);
  create table orcamentos(id uuid primary key, clinica_id uuid not null, ficha_id uuid, paciente_id uuid not null, dentista_id uuid,
    total numeric, valor_acordado numeric, desconto numeric default 0, updated_at timestamptz);
  create table orcamento_itens(id uuid primary key, clinica_id uuid not null, orcamento_id uuid not null, descricao text,
    procedimento_id uuid, quantidade integer, preco_unitario numeric, preco_total numeric, aprovado boolean default false);
  create table orcamento_eventos(clinica_id uuid not null, orcamento_id uuid not null, evento_id uuid not null unique);
  create table pagamentos(id uuid primary key, clinica_id uuid not null, orcamento_id uuid not null, valor numeric, status text);
  create table orcamento_cobrancas(id uuid primary key, clinica_id uuid not null, orcamento_id uuid not null, situacao text, desconto numeric default 0);
  create table activity_logs(id uuid default gen_random_uuid(), clinica_id uuid, actor_id uuid, actor_nome text, paciente_id uuid, entity_type text, entity_id text, action text, metadata jsonb);
  create function get_my_clinica_id() returns uuid language sql as $$ select current_setting('qa.clinic')::uuid $$;
  create function get_my_dentista_id() returns uuid language sql as $$ select current_setting('qa.actor')::uuid $$;
  create function get_my_role() returns text language sql as $$ select current_setting('qa.role') $$;
  create function can_act_as_dentista(uuid) returns boolean language sql as $$ select true $$;
  create function criar_cobranca_orcamento(uuid,uuid[],numeric,smallint,date,text) returns void language plpgsql as $$
  declare v_clinica_id uuid := public.get_my_clinica_id();
  begin
    perform oi.id from public.orcamento_itens oi where oi.id = $2[1] and oi.orcamento_id = $1 and oi.clinica_id = v_clinica_id for update;
  end;
  $$;
  create function editar_cobranca_orcamento(uuid,uuid[],numeric) returns void language plpgsql as $$
  declare v_clinica_id uuid := public.get_my_clinica_id();
  begin
    perform oi.id from public.orcamento_itens oi where oi.id = $2[1] and oi.orcamento_id = $1 and oi.clinica_id = v_clinica_id order by oi.id;
  end;
  $$;
  create function reorganizar_parcelas_orcamento(uuid,numeric,jsonb) returns void language plpgsql as $$
  declare v_clinica_id uuid := public.get_my_clinica_id(); v_orc public.orcamentos%rowtype;
  begin
    select * into v_orc from public.orcamentos where id = $1;
    perform oi.id from public.orcamento_itens oi where oi.orcamento_id = v_orc.id and oi.clinica_id = v_clinica_id;
  end;
  $$;
  insert into dentistas values ('${actor}','${clinic}','Autor QA');
  insert into fichas values ('${ficha}','${clinic}','${patient}','${actor}',null,array[11,12],'{}',array['Antigo'],'aberta',now());
  insert into orcamentos values ('${orcamento}','${clinic}','${ficha}','${patient}','${actor}',300,null,0,'2026-09-14T00:00:00Z');
  insert into orcamento_itens(id,clinica_id,orcamento_id,descricao,quantidade,preco_unitario,preco_total,aprovado)
    values ('${item}','${clinic}','${orcamento}','Dois procedimentos',2,150,300,true);
  insert into odontograma_eventos(id,clinica_id,paciente_id,dentista_id,ficha_id,procedimento_nome,tipo,observacao,dente,status,origem)
    values ('${eventoA}','${clinic}','${patient}','${actor}','${ficha}','Procedimento A','outro',null,11,'indicado','clinica'),
           ('${eventoB}','${clinic}','${patient}','${actor}','${ficha}','Procedimento B','outro',null,12,'realizado','clinica');
  insert into orcamento_eventos values ('${clinic}','${orcamento}','${eventoA}'), ('${clinic}','${orcamento}','${eventoB}');
  select set_config('qa.clinic','${clinic}',false), set_config('qa.actor','${actor}',false), set_config('qa.role','dentista',false);
`);

await db.exec('drop function criar_cobranca_orcamento(uuid,uuid[],numeric,smallint,date,text); drop function editar_cobranca_orcamento(uuid,uuid[],numeric); drop function reorganizar_parcelas_orcamento(uuid,numeric,jsonb);');
const fixture=JSON.parse(await readFile(process.env.R169_FINANCE_FIXTURE ?? '/tmp/r169-finance-before.json','utf8'));
for (const row of fixture) await db.exec(row.definition+';');
try {
  await db.exec(await readFile(new URL('../supabase/migrations/20260914210240_r169b_ficha_orcamento_incremental.sql',import.meta.url),'utf8'));
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  throw error;
}
const fns=(await db.query("select proname,prosrc from pg_proc join pg_namespace n on n.oid=pronamespace where n.nspname='public' and proname in ('registrar_recebimento_orcamento','confirmar_previsao_orcamento','corrigir_recebimento_orcamento','reorganizar_parcelas_orcamento','aceitar_orcamento','criar_cobranca_orcamento','editar_cobranca_orcamento')")).rows;
for (const f of fns) {
 if(f.prosrc.includes('orcamento_itens')) {
  assert.ok(f.prosrc.includes('retirado_em is null'),f.proname+' continua incluindo retirados');
  console.log('PASS filtro ativo em função live '+f.proname);
 }
}
console.log('PASS migration compilada sobre definições vigentes do principal');await db.close();
