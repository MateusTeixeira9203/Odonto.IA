import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {Client} from 'pg';
import {lerVariavel,exigirHostQa,configPgQa,mascarar} from '../../scripts/qa/_lib.mjs';

const quote=value=>'"'+value.replaceAll('"','""')+'"';
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');

// Somente SELECT, em transação READ ONLY. Nunca executa cleanup.
export async function collectInventory({root,dir,patients,clinicId,patientNames,secrets}){
 const connection=await lerVariavel(path.join(root,'.env.qa-dump'),'QA_DB_URL');
 exigirHostQa(connection);
 const pg=new Client(configPgQa(connection,fs.readFileSync(path.join(root,'scripts/qa/supabase-ca.crt'))));
 const data={},identity=new Map(),keys=new Map(),queue=[];
 try{
  await pg.connect();await pg.query('begin read only');
  const pks=await pg.query(`select c.relname as table_name,array_agg(a.attname::text order by k.ordinality) as columns
   from pg_index i join pg_class c on c.oid=i.indrelid join pg_namespace n on n.oid=c.relnamespace
   join lateral unnest(i.indkey) with ordinality k(attnum,ordinality) on true
   join pg_attribute a on a.attrelid=c.oid and a.attnum=k.attnum
   where n.nspname='public' and i.indisprimary group by c.relname`);
  for(const row of pks.rows)keys.set(row.table_name,row.columns);
  const fks=await pg.query(`select child.relname as child,parent.relname as parent,
    array_agg(ca.attname::text order by k.ordinality) as child_columns,
    array_agg(pa.attname::text order by k.ordinality) as parent_columns
   from pg_constraint fk join pg_class child on child.oid=fk.conrelid
   join pg_namespace cn on cn.oid=child.relnamespace join pg_class parent on parent.oid=fk.confrelid
   join pg_namespace pn on pn.oid=parent.relnamespace
   join lateral unnest(fk.conkey,fk.confkey) with ordinality k(child_att,parent_att,ordinality) on true
   join pg_attribute ca on ca.attrelid=child.oid and ca.attnum=k.child_att
   join pg_attribute pa on pa.attrelid=parent.oid and pa.attnum=k.parent_att
   where fk.contype='f' and cn.nspname='public' and pn.nspname='public'
   group by fk.oid,child.relname,parent.relname`);
  function add(table,rows){
   data[table]??=[];const known=identity.get(table)??new Set();let added=false;
   for(const row of rows){const columns=keys.get(table),key=columns?JSON.stringify(columns.map(c=>row[c])):hash(row);if(!known.has(key)){known.add(key);data[table].push(row);added=true;}}
   identity.set(table,known);if(added&&!queue.includes(table))queue.push(table);
  }
  add('pacientes',(await pg.query('select * from public.pacientes where id=any($1::uuid[]) and clinica_id=$2',[patients,clinicId])).rows);
  // A cópia não tem FK para paciente; continua enumerada se ele for apagado.
  for(const table of ['prontuario_exclusoes','prontuario_exclusoes_copias'])add(table,(await pg.query('select * from public.'+quote(table)+' where paciente_id=any($1::uuid[]) and clinica_id=$2',[patients,clinicId])).rows);
  // Expande todas as filhas efetivas, inclusive FKs compostas e tabelas novas.
  let rounds=0;
  while(queue.length){
   assert(++rounds<=1000,'Fechamento das filhas nao convergiu; manifesto incompleto');
   const parent=queue.shift();
   for(const fk of fks.rows.filter(f=>f.parent===parent)){
    const tuples=data[parent].filter(r=>fk.parent_columns.every(c=>r[c]!=null));if(!tuples.length)continue;
    for(let at=0;at<tuples.length;at+=100){const args=[],where=tuples.slice(at,at+100).map(row=>'('+fk.child_columns.map((column,i)=>{args.push(row[fk.parent_columns[i]]);return quote(column)+'=$'+args.length;}).join(' and ')+')').join(' or ');
     add(fk.child,(await pg.query('select * from public.'+quote(fk.child)+' where '+where,args)).rows);
    }
   }
  }
  const ownedIds=new Set(patients);
  for(const [table,records]of Object.entries(data))for(const row of records)for(const key of keys.get(table)??[])if(typeof row[key]==='string')ownedIds.add(row[key]);
  const notices=(await pg.query('select * from public.notificacoes where clinica_id=$1',[clinicId])).rows.filter(row=>{
   const href=String(row.href??'');return [...ownedIds].some(value=>href.includes(value))||patientNames.some(name=>String(row.mensagem??'').includes(name)||String(row.titulo??'').includes(name));
  });
  data.notificacoes=notices;
  const references=[];
  for(const [table,records]of Object.entries(data))for(const row of records)for(const field of ['assinatura_ref','assinatura_url','storage_url','pdf_path','url']){
   const raw=row[field];if(typeof raw!=='string'||!raw||raw.startsWith('data:'))continue;
   if(/^https?:/i.test(raw)){const u=new URL(raw);exigirHostQa(u.origin);const match=u.pathname.match(/^\/storage\/v1\/object\/(?:public\/|sign\/)?([^/]+)\/(.+)$/);if(match)references.push({table,id:row.id??row.exclusao_id,field,bucket:decodeURIComponent(match[1]),path:decodeURIComponent(match[2])});}
   else if(raw.includes('/'))references.push({table,id:row.id??row.exclusao_id,field,path:raw});
  }
  const paths=[...new Set(references.map(r=>r.path))];
  // Inclui órfãos de upload sob diretórios de pacientes próprios, sem baixar binários.
  const objects=(await pg.query(`select id,bucket_id,name from storage.objects
   where name=any($1::text[]) or string_to_array(name,'/') && $2::text[]`,[paths,patients])).rows;
  const referencedPaths=new Set(references.map(reference=>reference.path));
  const patientSet=new Set(patients);
  const signatureObjects=objects.filter(object=>{const parts=object.name.split('/');return object.bucket_id==='fichas'&&parts.length===3&&parts[0]===clinicId&&patientSet.has(parts[1])&&/^assinatura_[0-9a-f-]{36}_(?:[0-9a-f-]{36}|[0-9]+)\.png$/i.test(parts[2]);});
  const signatureSummary={total:signatureObjects.length,uuid:signatureObjects.filter(object=>/_[0-9a-f-]{36}\.png$/i.test(object.name)).length,orphans:signatureObjects.filter(object=>!referencedPaths.has(object.name)).map(object=>({id:object.id,bucket:object.bucket_id,path:object.name}))};
  const tables=Object.fromEntries(Object.entries(data).map(([table,records])=>{
   const columns=keys.get(table)??(records.length&&'id'in records[0]?['id']:[]);
   return [table,{columns,keys:records.map(row=>Object.fromEntries(columns.map(c=>[c,row[c]]))),count:records.length,cleanupBlocked:records.length>0&&columns.length===0}];
  }));
  data._cleanup={patients,tables,storage:{signatureSummary,objects:objects.map(o=>({id:o.id,bucket:o.bucket_id,path:o.name})),references},notificationRule:'Somente IDs enumerados por href de entidade própria ou nome completo da fixture FINAL02; não limpar por texto.',cleanupExecuted:false,warning:'Inventário não autoriza limpeza. Somente IDs/chaves compostas/paths enumerados, respeitando retenção e gatilhos. Nenhum DELETE/TRUNCATE/storage remove é executado.'};
  await pg.query('rollback');
  fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,'inventario-ids-exatos.json'),mascarar(JSON.stringify(data,null,2),secrets));
  return data;
 }catch(error){throw new Error(mascarar(error.message,[...secrets,connection]));}
 finally{await pg.end();}
}
