/** Executa as três RPCs reais em Postgres/WASM isolado; sem acesso ao banco principal. */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
const { PGlite } = await import(pathToFileURL(process.env.R169_PGLITE).href);
const db = new PGlite();
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const clinic=id(1), actor=id(2), patient=id(3), ficha=id(4);
await db.exec(`
create schema auth;
create function auth.uid() returns uuid language sql as $$ select '${actor}'::uuid $$;
create function get_my_clinica_id() returns uuid language sql as $$ select '${clinic}'::uuid $$;
create function can_act_as_dentista(uuid) returns boolean language sql as $$ select $1='${actor}'::uuid $$;
create function validar_composicao_orcamento(jsonb) returns void language plpgsql as $$ begin return; end $$;
create table pacientes(id uuid primary key, clinica_id uuid);
create table fichas(id uuid primary key, clinica_id uuid, paciente_id uuid, dentista_id uuid);
create table odontograma_eventos(id uuid primary key, clinica_id uuid, paciente_id uuid, ficha_id uuid, origem text default 'clinica', status text default 'indicado', encaminhado_para uuid, retirado_em timestamptz);
create table procedimentos(id uuid primary key, clinica_id uuid);
create table orcamentos(id uuid primary key default gen_random_uuid(), clinica_id uuid, dentista_id uuid, paciente_id uuid, ficha_id uuid, status text, total numeric, desconto numeric, validade_dias integer, mostrar_valor_por_item boolean, valor_acordado numeric);
create table orcamento_itens(id uuid primary key default gen_random_uuid(), orcamento_id uuid references orcamentos(id), clinica_id uuid, descricao text, procedimento_id uuid, quantidade integer, preco_unitario numeric, preco_total numeric, aprovado boolean default false, composicao jsonb);
create table orcamento_eventos(clinica_id uuid, orcamento_id uuid references orcamentos(id), evento_id uuid unique references odontograma_eventos(id), item_id uuid references orcamento_itens(id));
create table pagamentos(id uuid primary key, orcamento_id uuid, clinica_id uuid, cobranca_id uuid);
insert into pacientes values('${patient}','${clinic}');
insert into fichas values('${ficha}','${clinic}','${patient}','${actor}'),('${id(5)}','${clinic}','${patient}','${actor}');
`);
await db.exec(await readFile(new URL('../supabase/migrations/20260914213000_r169_vinculos_criacao_orcamento.sql',import.meta.url),'utf8'));
let passed=0;
const item=(events,composition)=>({descricao:'Nome livre clínico',quantidade:1,preco_unitario:150,evento_ids:events,...(composition?{composicao:composition}:{})});
async function event(n,where=ficha,retired=false) {
 await db.query('insert into odontograma_eventos(id,clinica_id,paciente_id,ficha_id,retirado_em) values($1,$2,$3,$4,$5)',[id(n),clinic,patient,where,retired?'2026-09-14':null]);return id(n);
}
async function create(fn,events,composition) {return (await db.query(`select ${fn}($1,$2,$3,0,$4) as id`,[patient,actor,ficha,[item(events,composition)]])).rows[0].id;}
async function check(label,fn){await fn();passed++;console.log(`PASS ${label}`);}
let budget;
await check('criação normal conserva contrato e grava item exato de cada evento',async()=>{
 const e=await event(10);budget=await create('criar_orcamento_com_eventos',[e]);
 const rows=(await db.query('select i.descricao, i.preco_total from orcamento_eventos oe join orcamento_itens i on i.id=oe.item_id where oe.evento_id=$1',[e])).rows;
 assert.equal(rows.length,1);assert.equal(rows[0].descricao,'Nome livre clínico');assert.equal(Number(rows[0].preco_total),150);
});
await check('criação R157 preserva composição e vínculo',async()=>{
 const e=await event(11), composition={versao:1,teste:'conteúdo preservado'};
 const b=await create('criar_orcamento_com_eventos_r157',[e],composition);
 const rows=(await db.query('select i.composicao from orcamento_eventos oe join orcamento_itens i on i.id=oe.item_id where oe.orcamento_id=$1',[b])).rows;
 assert.deepEqual(rows[0].composicao,composition);
});
await check('adição R157 preserva item anterior e vincula novo por ID',async()=>{
 const e=await event(12);await db.query('select adicionar_itens_orcamento_com_eventos_r157($1,$2)',[budget,[item([e])]]);
 const rows=(await db.query('select item_id from orcamento_eventos where orcamento_id=$1',[budget])).rows;
 assert.equal(rows.length,2);assert.equal(new Set(rows.map(x=>x.item_id)).size,2);
});
await check('retry não cria item órfão ou duplicado',async()=>{
 await assert.rejects(db.query('select adicionar_itens_orcamento_com_eventos_r157($1,$2)',[budget,[item([id(12)])]]),/ja_orcado/);
 assert.equal((await db.query('select count(*)::int as n from orcamento_itens where orcamento_id=$1',[budget])).rows[0].n,2);
});
await check('criação recusa retirado e outra ficha sem gravar orçamento',async()=>{
 const before=(await db.query('select count(*)::int as n from orcamentos')).rows[0].n;
 const retired=await event(13,ficha,true),other=await event(14,id(5));
 for(const fn of ['criar_orcamento_com_eventos','criar_orcamento_com_eventos_r157']) for(const e of [retired,other]) await assert.rejects(create(fn,[e]),/evento_invalido/);
 assert.equal((await db.query('select count(*)::int as n from orcamentos')).rows[0].n,before);
});
await check('adição R157 recusa retirado/outra ficha sem alterar total',async()=>{
 for(const e of [id(13),id(14)]) await assert.rejects(db.query('select adicionar_itens_orcamento_com_eventos_r157($1,$2)',[budget,[item([e])]]),/evento_invalido/);
 assert.equal(Number((await db.query('select total from orcamentos where id=$1',[budget])).rows[0].total),300);
});
await check('criação recusa clínica alheia e ator sem permissão',async()=>{
 await db.query('insert into odontograma_eventos(id,clinica_id,paciente_id,ficha_id) values($1,$2,$3,$4)',[id(15),id(99),patient,ficha]);
 await assert.rejects(create('criar_orcamento_com_eventos',[id(15)]),/evento_invalido/);
 await assert.rejects(db.query('select criar_orcamento_com_eventos($1,$2,$3,0,$4)',[patient,id(99),ficha,[item([])]]),/dentista_invalido/);
});
await check('criação recusa lote vazio ou nulo',async()=>{
 for(const items of [[],null]) await assert.rejects(db.query('select criar_orcamento_com_eventos($1,$2,$3,0,$4)',[patient,actor,ficha,items]),/itens_invalidos/);
});
console.log(`${passed}/${passed} verificações passaram`);await db.close();
