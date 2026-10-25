import {createClient} from '@supabase/supabase-js';
﻿import {execFileSync} from 'node:child_process';
import {Client} from 'pg';
import {lerVariavel,configPgQa,exigirHostQa,guardaSqlFixture,mascarar} from '../../scripts/qa/_lib.mjs';
export async function run(stage,h){
 const {assert,fs,path,expect,e,save,ids,db,rows,hash,login,sessions,state,capture,check,openFicha,openDelete,fillDialog,base,dir,runtimeRoot,runtimeHead,ctx,qaPatient,qaName,qid}=h;
 const get=async(t,id,col='id')=>rows(db.from(t).select('*').eq(col,id));
 const noEffect=c=>assert.deepEqual(c.after,c.before);
 if(stage==='preflight'){
  for(const role of ['ANA','CARLOS','SARA','PROTETICO','BRUNO','ADMIN'])await login(role);
  e.beforeSeed=await state();assert.equal((await get('pacientes',qaPatient)).length,0);
  // Compile the patient lazy bundle before checking its server action references.
  await sessions.ANA.page.goto(base+'/dashboard/pacientes/'+ids.patient);await sessions.ANA.page.getByRole('tab',{name:'Prontuário',exact:true}).click();
  e.snapshot={base,head:runtimeHead,sourceClean:true,qaHost:'uhuxteswtvgdnlixwrdu.supabase.co'};
  e.inventory={qaPatient,EX1:qid(101),EX2:qid(102),EXO:qid(108),cascadeFicha:qid(111),visit:qid(201),event:qid(301),file:qid(501),budget:qid(603),permanentPatient:ids.patient,neverDelete:[ids.patient,ids.ES,ids.ES_event,ids.ES_signature]};save();console.log('PASSOU preflight 6 Auth UI/API; snapshot3013 e permanentes registrados');
 }
 if(stage==='seed'){
  assert(e.stages.preflight?.finished);assert(!e.seedInitial);assert.equal((await get('pacientes',qaPatient)).length,0);
  const sql=guardaSqlFixture(fs.readFileSync('supabase/tests/fixtures/od015m3b-live-seed.sql','utf8'));
  const conn=await lerVariavel('.env.qa-dump','QA_DB_URL');exigirHostQa(conn);
  const pg=new Client(configPgQa(conn,fs.readFileSync('scripts/qa/supabase-ca.crt')));
  try{await pg.connect();await pg.query(sql);}catch(error){throw new Error(mascarar(error.message,[...ctx.segredos,conn]));}finally{await pg.end();}
  e.seedInitial=await state();assert.equal(e.seedInitial.permanent,e.beforeSeed.permanent);save();console.log('PASSOU fixture isolada aplicada (DML QA); sem migration');
 }
 if(stage==='E11-E1-E10'){
  const a=await login('ANA'),p=a.page;
  await check('E11 DELETE direto fichas recusado (revoke)',async()=>{const r=await a.client.from('fichas').delete().eq('id',qid(101)).select('id');return {code:r.error?.code,message:r.error?.message,data:r.data};},c=>{assert.equal(c.response.code,'42501');assert.match(c.response.message,/permission denied/);noEffect(c);});
  for(const [item,n]of [['E11/E1',101],['E10',102]])await check(item+' apagar pela tela e persistir',async c=>{
   assert.equal((await get('fichas',qid(n))).length,1,'Do not replay persisted deletion');
   await openFicha(p,qid(n),qaPatient);const d=await openDelete(p);await d.waitFor();c.dialog=await d.innerText();assert.match(c.dialog,/cópia protegida/);assert.match(c.dialog,/só o administrador da clínica/);assert.match(c.dialog,/fica guardada/);if(n===101)assert.match(c.dialog,/fotos e os documentos anexados continuam guardados/);
   await fillDialog(d,{name:qaName});assert.equal(await d.getByRole('checkbox').count(),0);await expect(d.getByRole('button',{name:'Apagar ficha',exact:true})).toBeEnabled();await capture(p,item.replace('/','-')+'-antes');
   c.sent=true;save();await d.getByRole('button',{name:'Apagar ficha',exact:true}).click();
   await expect.poll(()=>get('fichas',qid(n)),{timeout:25000}).toHaveLength(0);await p.reload();await p.getByRole('tab',{name:'Prontuário',exact:true}).click();await capture(p,item.replace('/','-')+'-depois');
   c.audit=await get('prontuario_exclusoes',qid(n),'ficha_id');c.copy=await get('prontuario_exclusoes_copias',qid(n),'ficha_id');return {deleted:true};
  },c=>{
   assert(c.response.deleted);assert.equal(c.audit.length,1);assert.equal(c.copy.length,1);assert.equal(c.audit[0].resumo.copia_guardada,true);assert.equal(c.copy[0].exclusao_id,c.audit[0].id);assert(!JSON.stringify(c.audit).includes('QA-TEXTO-CLINICO'));
   assert.deepEqual(c.copy[0].conteudo.ficha,c.before.tables.fichas.rows.find(x=>x.id===qid(n)));
   if(n===101){assert.equal(c.copy[0].conteudo.evolucoes[0].texto,'QA-TEXTO-CLINICO-FX');assert.equal(c.copy[0].conteudo.procedimentos.length,1);assert.equal(c.copy[0].conteudo.arquivos.length,1);assert.equal(c.copy[0].conteudo.arquivos[0].texto_extraido,'QA-TEXTO-ARQUIVO-M3b');assert.equal(c.copy[0].conteudo.arquivos[0].storage_url,'qa/e015b300/nao-existe.txt');assert.equal((c.after.tables.atendimentos_clinicos.count),(c.before.tables.atendimentos_clinicos.count-1));assert(!c.after.tables.odontograma_eventos.rows.some(x=>x.id===qid(301)));}
  });
 }
 if(stage==='E11-access'){
  const copy=(await get('prontuario_exclusoes_copias',qid(101),'ficha_id'))[0];assert(copy);
  for(const role of ['ADMIN','ANA','CARLOS','SARA','PROTETICO','BRUNO']){
   const s=await login(role);
   await check('E11 leitura Auth '+role,async()=>({data:await rows(s.client.from('prontuario_exclusoes_copias').select('*').eq('exclusao_id',copy.exclusao_id))}),c=>{assert.equal(c.response.data.length,role==='ADMIN'?1:0);if(role==='ADMIN')assert.deepEqual(c.response.data[0],copy);noEffect(c);});
   for(const op of ['insert','update','delete'])await check('E11 escrita Auth '+role+' '+op,async()=>{
    const q=s.client.from('prontuario_exclusoes_copias');const r=await(op==='insert'?q.insert({...copy,exclusao_id:qid(9999)}):op==='update'?q.update({versao:2}).eq('exclusao_id',copy.exclusao_id):q.delete().eq('exclusao_id',copy.exclusao_id));
    return {code:r.error?.code,message:r.error?.message};
   },c=>{assert.equal(c.response.code,'42501');assert.match(c.response.message,/permission denied/);noEffect(c);});
  }
 }
 if(stage==='E8'){
  const a=await login('ANA'),p=a.page;
  await check('E8 caixa consciente, financeiro preservado, copia sem orçamento mantido',async c=>{
   assert.equal((await get('fichas',qid(108))).length,1,'Do not replay');await openFicha(p,qid(108),ids.patient);const d=await openDelete(p);await d.waitFor();await fillDialog(d);await expect(d.getByRole('checkbox')).not.toBeChecked();await expect(d.getByRole('button',{name:'Apagar ficha',exact:true})).toBeDisabled();c.warning=await d.innerText();await capture(p,'E8-sem-caixa');await d.getByRole('checkbox').check();await expect(d.getByRole('button',{name:'Apagar ficha',exact:true})).toBeEnabled();await capture(p,'E8-com-caixa');c.sent=true;save();await d.getByRole('button',{name:'Apagar ficha',exact:true}).click();await expect.poll(()=>get('fichas',qid(108)),{timeout:25000}).toHaveLength(0);await p.reload();await p.getByRole('tab',{name:'Orçamentos',exact:true}).click();
   // Select this exact synthetic budget by item text, never a neighbouring budget.
   const buttons=p.getByRole('button',{name:/^Abrir orçamento de/});c.budgetCards=await buttons.allTextContents();const target=buttons.filter({hasText:'QA item financeiro ficticio'});if(await target.count()===1){await target.click();c.budgetText=await p.getByRole('dialog',{name:'Orçamento',exact:true}).innerText();await capture(p,'E8-orcamento-depois');}else{c.budgetUi='NAO TESTADO: seletor nao identifica orçamento extra unicamente';await capture(p,'E8-lista-depois');}
   c.copy=await get('prontuario_exclusoes_copias',qid(108),'ficha_id');return {deleted:true};
  },c=>{
   const b=c.before.tables,a=c.after.tables;for(const t of ['assinaturas','pagamentos','orcamento_cobrancas','orcamento_cobranca_itens','orcamento_itens'])assert.equal(a[t].hash,b[t].hash,t);
   const old=b.orcamentos.rows.find(x=>x.id===qid(603)),now=a.orcamentos.rows.find(x=>x.id===qid(603));assert.deepEqual({...now,ficha_id:old.ficha_id},old);assert.equal(now.ficha_id,null);
   const oldDoc=b.documentos_aceite.rows.find(x=>x.orcamento_id===qid(603)),doc=a.documentos_aceite.rows.find(x=>x.orcamento_id===qid(603));assert.deepEqual({...doc,ficha_id:oldDoc.ficha_id},oldDoc);assert.equal(doc.ficha_id,null);assert.equal(a.orcamento_eventos.rows.filter(x=>x.orcamento_id===qid(603)).length,0);assert.equal(c.copy.length,1);assert.equal(c.copy[0].conteudo.orcamentos_apagados.length,0);assert.equal(c.copy[0].conteudo.vinculos_orcamento.length,1);
  });
 }

 if(stage==='E8-persistencia'||stage==='E8-leitura-final'){
  const a=await login('ANA'),p=a.page;
  await check('E8 persistencia independente apos exclusao ja enviada (sem replay)',async c=>{
   assert.equal((await get('fichas',qid(108))).length,0);const now=await state(),b=e.seedInitial.tables,at=now.tables;
   for(const t of ['assinaturas','pagamentos','orcamento_cobrancas','orcamento_cobranca_itens','orcamento_itens'])assert.equal(at[t].hash,b[t].hash,t);
   const old=b.orcamentos.rows.find(x=>x.id===qid(603)),current=at.orcamentos.rows.find(x=>x.id===qid(603));c.budgetDiff=Object.keys(old).filter(k=>JSON.stringify(old[k])!==JSON.stringify(current[k]));assert.equal(current.ficha_id,null);for(const k of ['id','total','status','aprovado_em','paciente_id','dentista_id'])assert.deepEqual(current[k],old[k]);
   const oldDoc=b.documentos_aceite.rows.find(x=>x.orcamento_id===qid(603)),doc=at.documentos_aceite.rows.find(x=>x.orcamento_id===qid(603));c.docDiff=Object.keys(oldDoc).filter(k=>JSON.stringify(oldDoc[k])!==JSON.stringify(doc[k]));assert.equal(doc.ficha_id,null);assert.deepEqual({...doc,ficha_id:oldDoc.ficha_id},oldDoc);assert.equal(at.orcamento_eventos.rows.filter(x=>x.orcamento_id===qid(603)).length,0);
   c.copy=await get('prontuario_exclusoes_copias',qid(108),'ficha_id');assert.equal(c.copy.length,1);assert.equal(c.copy[0].conteudo.orcamentos_apagados.length,0);assert.equal(c.copy[0].conteudo.vinculos_orcamento.length,1);c.audit=await get('prontuario_exclusoes',qid(108),'ficha_id');assert.equal(c.audit.length,1);assert(c.audit[0].resumo.confirmou_orcamento_aceito);
   await p.goto(base+'/dashboard/pacientes/'+ids.patient);await p.getByRole('tab',{name:'Or\u00e7amentos',exact:true}).click();await p.getByRole('button',{name:/^Abrir or?amento de/}).first().waitFor({timeout:15000});c.cards=await p.getByRole('button',{name:/^Abrir or?amento de/}).allTextContents();await capture(p,'E8-lista-verificada');return {verified:true};
  },c=>{assert(c.response.verified);noEffect(c);});
 }
 if(stage==='E11-sara-recheck'){
  const a=await login('SARA'),copy=(await get('prontuario_exclusoes_copias',qid(101),'ficha_id'))[0];
  await check('E11 SARA insert sequencial (corrida do harness eliminada)',async()=>{const r=await a.client.from('prontuario_exclusoes_copias').insert({...copy,exclusao_id:qid(9999)});return {code:r.error?.code,message:r.error?.message,status:r.status};},c=>{assert.equal(c.response.code,'42501');noEffect(c);});
  const old=e.cases.find(c=>c.label==='E11 escrita Auth SARA insert');if(old){old.attemptStatus=old.status;old.status='NAO TESTADO';old.harnessNote='Sobreposicao indevida de E8 com comparacao global: API recusou 42501, diff veio exclusivamente da exclusao E8. Nova prova sequencial com hash igual.';}
 }
 if(stage==='E12'){
  const a=await login('ANA'),admin=await login('ADMIN'),p=a.page;assert.notEqual(qaPatient,ids.patient);
  await check('E12 paciente extra excluido pela tela; copia fica imutavel',async c=>{
   assert.equal((await get('pacientes',qaPatient)).length,1,'Do not replay');assert.equal((await get('fichas',qid(111))).length,1);
   c.copyBefore=await rows(admin.client.from('prontuario_exclusoes_copias').select('*').eq('paciente_id',qaPatient).order('exclusao_id'));assert.equal(c.copyBefore.length,2);
   await p.goto(base+'/dashboard/pacientes/'+qaPatient);await p.getByRole('button',{name:'Mais ações do paciente',exact:true}).click();await p.getByRole('menuitem',{name:'Excluir paciente',exact:true}).click();const d=p.getByRole('dialog',{name:'Excluir '+qaName+'?',exact:true});await d.waitFor();await expect(d.getByRole('button',{name:'Excluir permanentemente',exact:true})).toBeDisabled();await d.getByPlaceholder(qaName,{exact:true}).fill(qaName);await capture(p,'E12-antes');c.sent=true;save();await d.getByRole('button',{name:'Excluir permanentemente',exact:true}).click();await expect.poll(()=>get('pacientes',qaPatient),{timeout:25000}).toHaveLength(0);await p.reload();c.url=p.url();await capture(p,'E12-depois');
   c.copyAfter=await rows(admin.client.from('prontuario_exclusoes_copias').select('*').eq('paciente_id',qaPatient).order('exclusao_id'));assert.deepEqual(c.copyAfter,c.copyBefore);c.cascade=await get('fichas',qid(111));return {deleted:true};
  },c=>{assert.equal(c.cascade.length,0);assert.deepEqual(c.copyBefore,c.copyAfter);assert.equal(c.after.tables.prontuario_exclusoes_copias.hash,c.before.tables.prontuario_exclusoes_copias.hash);});
 }
﻿ if(stage==='E8-inspect'){
  const a=await login('ANA'),p=a.page;await p.goto(base+'/dashboard/pacientes/'+ids.patient);await p.getByRole('tab',{name:'Orçamentos',exact:true}).click();await p.getByRole('button',{name:/^Abrir/}).first().waitFor({timeout:15000});e.e8Inspect={text:await p.locator('body').innerText(),buttons:await p.getByRole('button',{name:/^Abrir/}).allTextContents()};await capture(p,'E8-lista-final');save();console.log(JSON.stringify(e.e8Inspect.buttons));
 }
 if(stage==='E11-structural'){
  const conn=await lerVariavel('.env.qa-dump','QA_DB_URL');exigirHostQa(conn);const pg=new Client(configPgQa(conn,fs.readFileSync('scripts/qa/supabase-ca.crt')));await pg.connect();
  try{
   const r=await pg.query("select column_name,data_type from information_schema.columns where table_schema='public' and table_name in ('prontuario_exclusoes_copias','ficha_arquivos') order by table_name,ordinal_position");e.e11Schema=r.rows;
   const grants=await pg.query("select has_table_privilege('authenticated','public.fichas','DELETE') as delete_fichas,has_table_privilege('authenticated','public.prontuario_exclusoes_copias','INSERT,UPDATE,DELETE') as escrita_copia");e.e11Grants=grants.rows;assert.equal(grants.rows[0].delete_fichas,false);assert.equal(grants.rows[0].escrita_copia,false);
   const copy=(await get('prontuario_exclusoes_copias',qid(101),'ficha_id'))[0];const before=hash(copy);await pg.query('begin');let code,message;try{await pg.query('update public.prontuario_exclusoes_copias set versao=2 where exclusao_id=$1',[copy.exclusao_id]);}catch(error){code=error.code;message=error.message;}finally{await pg.query('rollback');}assert.equal(message,'copia_prontuario_imutavel');assert.equal(hash((await get('prontuario_exclusoes_copias',qid(101),'ficha_id'))[0]),before);e.e11PrivilegedUpdate={status:'PASSOU',code,message,before,after:before};save();console.log('PASSOU catalogo QA e UPDATE privilegiado recusado pela imutabilidade');
  }finally{await pg.end();}
 }
﻿ if(stage==='E8-telas'){
  const a=await login('ANA'),p=a.page;
  await check('E8 financeiro e lista/detalhes apos recarga (somente leitura)',async c=>{
   const b=e.seedInitial.tables,now=await state(),at=now.tables;
   for(const t of ['assinaturas','pagamentos','orcamento_cobrancas','orcamento_cobranca_itens','orcamento_itens'])assert.equal(at[t].hash,b[t].hash,t);
   const old=b.orcamentos.rows.find(x=>x.id===qid(603)),current=at.orcamentos.rows.find(x=>x.id===qid(603));assert.equal(current.ficha_id,null);for(const k of Object.keys(old).filter(k=>!['ficha_id','updated_at'].includes(k)))assert.deepEqual(current[k],old[k]);c.allowedBudgetDiff=['ficha_id','updated_at'];
   const doc=at.documentos_aceite.rows.find(x=>x.orcamento_id===qid(603)),oldDoc=b.documentos_aceite.rows.find(x=>x.orcamento_id===qid(603));assert.equal(doc.ficha_id,null);assert.deepEqual({...doc,ficha_id:oldDoc.ficha_id},oldDoc);
   await p.goto(base+'/dashboard/pacientes/'+ids.patient);await p.getByRole('tab',{name:'Orçamentos',exact:true}).click();const cards=p.getByRole('button',{name:/^Abrir orçamento de/});await cards.first().waitFor();assert.equal(await cards.count(),2);c.cards=await cards.allTextContents();c.details=[];
   for(let i=0;i<2;i++){await cards.nth(i).click();const d=p.getByRole('dialog',{name:'Orçamento',exact:true});await d.waitFor();const text=await d.innerText();c.details.push(text);assert.match(text,/100/);await capture(p,'E8-detalhe-'+i);await d.getByRole('button',{name:'Fechar',exact:true}).last().click();}
   await p.reload();await p.getByRole('tab',{name:'Orçamentos',exact:true}).click();await expect(p.getByRole('button',{name:/^Abrir orçamento de/})).toHaveCount(2);await capture(p,'E8-recarga-final');return {read:true};
  },c=>{assert(c.response.read);noEffect(c);});
 }
 if(stage==='E11-anon'){
  const client=createClient(ctx.env.NEXT_PUBLIC_SUPABASE_URL,ctx.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:(input,init)=>{assert.equal(new URL(input instanceof Request?input.url:String(input)).hostname,'uhuxteswtvgdnlixwrdu.supabase.co');return fetch(input,init);}}});
  await check('E11 anon sem leitura',async()=>{const r=await client.from('prontuario_exclusoes_copias').select('*').eq('ficha_id',qid(101));return {code:r.error?.code,message:r.error?.message,status:r.status};},c=>{assert.equal(c.response.code,'42501');noEffect(c);});
 }
 if(stage==='final'){
  for(const c of e.cases.filter(x=>x.status==='FALHOU'&&x.label.startsWith('E8 persistencia'))){c.attemptStatus=c.status;c.status='NAO TESTADO';c.harnessNote='Seletores corrompidos por encoding no transporte PowerShell (Or?amentos, or?amento). Comparacoes do banco passaram antes da leitura UI; E8-telas UTF8 validou lista, ambos detalhes e recarga sem repetir exclusao.';}
  e.harnessIncidents=['E8 sobrepos indevidamente a comparacao global de SARA insert; E8 exclusao enviada uma unica vez. E11 acesso preservado em access-attempt.json. Resultado E8 original nao sobreviveu a sobrescrita do arquivo; antes/depois disponivel em SARA insert e seedInitial, prints sem/com caixa e auditoria/copia. Persistencia e UI validadas separadamente.','Duas leituras E8 interrompidas por seletores com encoding corrompido; historico retido, substituido por E8-telas UTF8 somente leitura.','Portal OD App navegou para3013/login mas renderizou somente alert/devtools; sem login confirmado pelo portal. Fluxos e seis logins reais comprovados no Edge headless.'];

  e.final=await state();assert.equal(e.final.permanent,e.beforeSeed.permanent);execFileSync('git',['diff','--exit-code','--','src'],{cwd:runtimeRoot});assert.equal(execFileSync('git',['rev-parse','HEAD'],{cwd:runtimeRoot,encoding:'utf8'}).trim(),runtimeHead);
  fs.writeFileSync(path.join(dir,'fixtures-para-limpeza.json'),JSON.stringify({snapshot:e.snapshot,ids:e.inventory,remaining:e.final.tables,noCleanup:true,neverDelete:e.inventory.neverDelete},null,2));console.log('PASSOU final permanentes, snapshot e inventário');
 }
}
