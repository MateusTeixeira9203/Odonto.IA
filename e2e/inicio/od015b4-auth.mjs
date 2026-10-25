// Independent B4 QA on the explicitly authorized working-tree server. Canvas excluded.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {chromium} from '@playwright/test';
import {createClient} from '@supabase/supabase-js';
import {contexto,exigirHostQa} from '../../scripts/qa/_lib.mjs';
assert.equal(process.env.INICIO_B4_AUTH_READY,'working-tree-3000');
const root=process.cwd(),ctx=await contexto(root),host=exigirHostQa(ctx.env.NEXT_PUBLIC_SUPABASE_URL).hostname;
const base='http://localhost:3000',dir='C:/Users/mateu/Desktop/Nex Lab/Projetos/Odonto-IA/log/QA-OD-005b-inicio-2026-10-24-evidencias/od015b4-auth';
fs.mkdirSync(dir,{recursive:true});const file=path.join(dir,'b4-auth.json');assert(!fs.existsSync(file),'No replay: B4 evidence exists');
const sources=['src/app/dashboard/agendamentos/assinatura-actions.ts','src/server/patients/registro-actions.ts','src/lib/prontuario/assinatura-recepcao.ts','src/lib/prontuario/assinatura-recepcao.test.ts'];
const fingerprints=()=>Object.fromEntries(sources.map(p=>[p,createHash('sha256').update(fs.readFileSync(p)).digest('hex')]));
const e={base,host,started:new Date().toISOString(),head:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),sourceBefore:fingerprints(),identities:[],fixtures:[],cases:[]};
const save=()=>fs.writeFileSync(file,JSON.stringify(e,null,2));save();
fs.writeFileSync('.qa/qa3-b4-tested.patch',execFileSync('git',['diff','HEAD','--',...sources],{encoding:'utf8'}));
const guardedFetch=(readOnly=false)=>(input,init)=>{assert.equal(new URL(input instanceof Request?input.url:String(input)).hostname,host);if(readOnly)assert(['GET','HEAD'].includes((init?.method??'GET').toUpperCase()));return fetch(input,init);};
const db=createClient(ctx.env.NEXT_PUBLIC_SUPABASE_URL,ctx.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:guardedFetch(true)}});
async function rows(q){const r=await q;assert(!r.error,r.error?.message);return r.data;}
const accounts={ANA:'dentista.a.r140@example.invalid',CARLOS:'dentista.c.auditoria@example.invalid',SARA:'secretaria.a.auditoria@example.invalid',PROTETICO:'protetico.a.qa@example.invalid',BRUNO:'dentista.b.r140@example.invalid'};
const sessions={};const browser=await chromium.launch({channel:'msedge',headless:true});
async function login(role){
 const account=ctx.accounts.contas.find(c=>c.email===accounts[role]);assert(account);
 const client=createClient(ctx.env.NEXT_PUBLIC_SUPABASE_URL,ctx.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:guardedFetch()}});
 const auth=await client.auth.signInWithPassword({email:account.email,password:account.senha});assert(!auth.error,'QA login failed');
 const user=await rows(client.from('users').select('active_clinica_id').eq('id',auth.data.user.id).single());
 const d=await rows(client.from('dentistas').select('id,nome,cro').eq('user_id',auth.data.user.id).eq('clinica_id',user.active_clinica_id).single());
 const membership=await rows(client.from('clinica_usuarios').select('role,status').eq('usuario_id',auth.data.user.id).eq('clinica_id',user.active_clinica_id).single());
 const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage();
 await page.route('**/*',route=>{const u=new URL(route.request().url());if(u.hostname.endsWith('.supabase.co')&&u.hostname!==host)return route.abort();return route.continue();});
 await page.goto(base+'/login');await page.waitForFunction(()=>{const f=document.querySelector('form');return f&&Object.keys(f).some(k=>k.startsWith('__reactProps')&&typeof Reflect.get(f,k).onSubmit==='function');});
 await page.locator('input[type=email]').fill(account.email);await page.locator('input[type=password]').fill(account.senha);await page.locator('button[type=submit]').click();await page.waitForURL(u=>u.pathname.startsWith('/dashboard'),{timeout:60000});
 const cookies=await context.cookies();assert(cookies.some(c=>c.name.startsWith('sb-uhuxteswtvgdnlixwrdu-auth-token')),'Server did not establish a QA auth cookie');assert(!cookies.some(c=>c.name.includes('zenfemoxvwerplrjgfqz')));
 sessions[role]={client,page,clinicId:user.active_clinica_id,dentistId:d.id,name:d.nome,cro:d.cro};e.identities.push({label:role,clinicId:user.active_clinica_id,dentistId:d.id,name:d.nome,cro:d.cro,role:membership.role,serverQaCookie:true});save();
}
async function state(f){
 const fichas=await rows(db.from('fichas').select('*').eq('paciente_id',f.patientId).order('id'));
 const [eventos,atendimentos,assinaturas]=await Promise.all([rows(db.from('odontograma_eventos').select('*').eq('paciente_id',f.patientId).order('id')),rows(db.from('atendimentos_clinicos').select('*').eq('paciente_id',f.patientId).order('id')),rows(db.from('assinaturas').select('*').eq('paciente_id',f.patientId).order('id'))]);
 const evolucoes=fichas.length?await rows(db.from('ficha_evolucoes').select('*').in('ficha_id',fichas.map(x=>x.id)).order('id')):[];
 const vinculos=atendimentos.length?await rows(db.from('atendimento_eventos').select('*').in('atendimento_id',atendimentos.map(x=>x.id)).order('atendimento_id').order('evento_id').order('papel')):[];
 const documentos=await rows(db.from('documentos_aceite').select('*').eq('paciente_id',f.patientId).order('id'));
 return Object.fromEntries(Object.entries({fichas,odontograma_eventos:eventos,atendimentos_clinicos:atendimentos,ficha_evolucoes:evolucoes,atendimento_eventos:vinculos,assinaturas,documentos_aceite:documentos}).map(([table,data])=>[table,{count:data.length,hash:createHash('sha256').update(JSON.stringify(data)).digest('hex'),ids:data.map(x=>x.id??`${x.atendimento_id}:${x.evento_id}:${x.papel}`)}]));
}
async function fixture(label){
 const a=sessions.ANA;const f={label,patientId:randomUUID(),fichaId:randomUUID(),clinicId:a.clinicId,name:'QA INICIO3 B4 '+label+' '+Date.now()};e.fixtures.push(f);save();
 let r=await a.client.from('pacientes').insert({id:f.patientId,clinica_id:f.clinicId,dentista_id:a.dentistId,nome:f.name});assert(!r.error,r.error?.message);
 r=await a.client.from('fichas').insert({id:f.fichaId,clinica_id:f.clinicId,paciente_id:f.patientId,dentista_id:a.dentistId,origem:'manual',status:'aberta',data_atendimento:'2026-10-25',queixa_principal:'QA B4 '+label,anotacoes:'QA B4 nova fixture sintética'});assert(!r.error,r.error?.message);return f;
}
function event(f,{id=randomUUID(),forward=false,label='próprio'}={}){return {id,clinica_id:f.clinicId,paciente_id:f.patientId,ficha_id:f.fichaId,dentista_id:sessions.ANA.dentistId,procedimento_nome:'QA B4 '+label,tipo:'outro',status:'realizado',realizado_em:'2026-10-25',origem:'clinica',nivel:'dente',dente:26,faces:[],momento_planejado:'sessao_atual',encaminhado_para:forward?sessions.CARLOS.dentistId:null};}
async function action(role,name,args){
 const manifest=JSON.parse(fs.readFileSync('.next/dev/server/server-reference-manifest.json','utf8'));
 const id=Object.entries(manifest.node).find(([,v])=>v.exportedName===name)?.[0];assert(id,'Action not compiled '+name);
 const response=await sessions[role].page.request.post(base+'/dashboard',{headers:{'next-action':id,'content-type':'text/plain;charset=UTF-8',accept:'text/x-component',origin:base},data:JSON.stringify(args),maxRedirects:0,timeout:60000});
 const text=await response.text(),line=text.split('\n').find(l=>/^\d+:\{"ok":/.test(l));assert(line,'Action result missing');return {http:response.status(),result:JSON.parse(line.slice(line.indexOf(':')+1),(_k,v)=>v==='$undefined'?undefined:v)};
}
let controls=[];async function controlHashes(){return Object.fromEntries(await Promise.all(controls.map(async f=>[f.fichaId,await state(f)])));}
async function check(label,role,f,run,verify){
 const c={label,role,patientId:f.patientId,fichaId:f.fichaId,status:'INCONCLUSIVO',before:await state(f),othersBefore:await controlHashes(),sentAt:new Date().toISOString()};e.cases.push(c);save();
 try{c.response=await run();c.after=await state(f);c.othersAfter=await controlHashes();c.receivedAt=new Date().toISOString();assert.deepEqual(c.othersBefore,c.othersAfter,'Other control fichas changed');await verify(c);c.status='PASSOU';}
 catch(error){c.status='FALHOU';c.failure=error.message;if(!c.after)c.after=await state(f);if(!c.othersAfter)c.othersAfter=await controlHashes();}
 save();console.log(c.status+' '+label);return c;
}
const noMark=f=>assert(f.assinado_em==null&&f.assinatura_url==null,'Unexpected legacy mark A');
async function signedEvidence(c,f,eventId,author){
 const ev=await rows(db.from('odontograma_eventos').select('*').eq('id',eventId).single());assert(ev.assinatura_id,'Event still unsigned');
 const signature=await rows(db.from('assinaturas').select('*').eq('id',ev.assinatura_id).single());
 assert.equal(signature.dentista_id,sessions[author].dentistId);assert.equal(signature.cro_no_ato,sessions[author].cro);
 const time=Date.parse(signature.assinado_em);assert(time>=Date.parse(c.sentAt)-2000&&time<=Date.parse(c.receivedAt)+2000,'Signature timestamp outside actual action');
 c.event=ev;c.signature=signature;c.header=await rows(db.from('fichas').select('id,assinado_em,assinatura_url').eq('id',f.fichaId).single());noMark(c.header);
}
try{
 // Browser authentication and QA cookie proof precede every clinical fixture write.
 for(const role of ['SARA','ANA','CARLOS','PROTETICO','BRUNO'])await login(role);
 const png=await sessions.SARA.page.evaluate(()=>{const c=document.createElement('canvas');c.width=300;c.height=120;const x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,300,120);x.strokeStyle='#000';x.beginPath();x.moveTo(20,70);x.lineTo(60,30);x.lineTo(110,85);x.lineTo(170,30);x.lineTo(270,80);x.stroke();return c.toDataURL('image/png');});
 const receipt=(role,f)=>action(role,'salvarAssinaturaRecepcao',[f.fichaId,f.patientId,'QA paciente sintético B4',png]);
 controls=[await fixture('controle-1'),await fixture('controle-2')];
 const ce=event(controls[1],{label:'controle intocado'});let r=await sessions.ANA.client.from('odontograma_eventos').insert(ce);assert(!r.error,r.error?.message);
 e.controlsInitial=await controlHashes();save();
 const single=await fixture('Ana-unico');const se=event(single);single.eventId=se.id;save();r=await sessions.ANA.client.from('odontograma_eventos').insert(se);assert(!r.error,r.error?.message);
 // Warm the real patient bundle, which exposes the normal author signature action too.
 await sessions.ANA.page.goto(base+'/dashboard/pacientes/'+single.patientId);await sessions.ANA.page.getByRole('tab',{name:'Prontuário',exact:true}).waitFor({timeout:60000});
 const one=await check('B4 Sara assina lote próprio Ana','SARA',single,()=>receipt('SARA',single),async c=>{assert.equal(c.response.http,200);assert.equal(c.response.result.ok,true);await signedEvidence(c,single,se.id,'ANA');});
 await sessions.SARA.page.reload();const lookupManifest=JSON.parse(fs.readFileSync('.next/dev/server/server-reference-manifest.json','utf8'));
 const lookupId=Object.entries(lookupManifest.node).find(([,v])=>v.exportedName==='buscarFichaParaAssinar')?.[0];assert(lookupId);
 const lookup=await sessions.SARA.page.request.post(base+'/dashboard',{headers:{'next-action':lookupId,'content-type':'text/plain;charset=UTF-8',accept:'text/x-component',origin:base},data:JSON.stringify([single.patientId]),maxRedirects:0});
 const lookupText=await lookup.text();one.reloadLookup={http:lookup.status(),noEligibleFicha:/"fichaId":null/.test(lookupText)};assert(one.reloadLookup.noEligibleFicha);save();
 await check('B4 repetição recusa sem marca A','SARA',single,()=>receipt('SARA',single),async c=>{assert.equal(c.response.result.ok,false);assert.deepEqual(c.before,c.after);noMark(await rows(db.from('fichas').select('assinado_em,assinatura_url').eq('id',single.fichaId).single()));});
 for(const forwardedFirst of [false,true]){
   const f=await fixture(forwardedFirst?'misto-Carlos-primeiro':'misto-Ana-primeiro');
   const low='10000000-'+randomUUID().slice(9),high='e0000000-'+randomUUID().slice(9);
   const own=event(f,{id:forwardedFirst?high:low,label:'Ana lote próprio'}),forward=event(f,{id:forwardedFirst?low:high,forward:true,label:'encaminhado Carlos'});
   f.eventIds={own:own.id,forwarded:forward.id};f.insertOrder=forwardedFirst?[forward.id,own.id]:[own.id,forward.id];save();
   r=await sessions.ANA.client.from('odontograma_eventos').insert(forwardedFirst?[forward,own]:[own,forward]);assert(!r.error,r.error?.message);
   f.observedOrder=await rows(db.from('odontograma_eventos').select('id,encaminhado_para').eq('ficha_id',f.fichaId).order('id'));save();
   const partial=await check('B4 Sara misto '+(forwardedFirst?'Carlos primeiro':'Ana primeiro'),'SARA',f,()=>receipt('SARA',f),async c=>{
     assert.equal(c.response.result.ok,false);assert.match(c.response.result.error,/1 procedimento\(s\) assinado\(s\)/);assert.match(c.response.result.error,/1 procedimento\(s\) encaminhado\(s\).*pendente/);assert(c.response.result.error.includes(sessions.CARLOS.name));
     await signedEvidence(c,f,own.id,'ANA');c.pending=await rows(db.from('odontograma_eventos').select('*').eq('id',forward.id).single());assert.equal(c.pending.assinatura_id,null);assert.equal(c.after.assinaturas.count,c.before.assinaturas.count+1);
   });
   await sessions.SARA.page.reload();partial.reloadState=await state(f);assert.deepEqual(partial.reloadState,partial.after);save();
   await check('B4 Carlos assina encaminhado '+(forwardedFirst?'Carlos primeiro':'Ana primeiro'),'CARLOS',f,()=>action('CARLOS','assinarProcedimentos',[{eventoIds:[forward.id],assinadoPor:'QA paciente sintético B4',assinaturaDataUrl:png}]),async c=>{assert.equal(c.response.result.ok,true);await signedEvidence(c,f,forward.id,'CARLOS');const preserved=await rows(db.from('assinaturas').select('*').eq('id',partial.signature.id).single());assert.deepEqual(preserved,partial.signature);});
 }
 const empty=await fixture('vazia-legado');await check('B4 ficha vazia mantém legado','SARA',empty,()=>receipt('SARA',empty),async c=>{assert.equal(c.response.result.ok,true);c.header=await rows(db.from('fichas').select('id,assinado_em,assinatura_url').eq('id',empty.fichaId).single());assert(c.header.assinado_em&&c.header.assinatura_url);assert.equal(c.after.assinaturas.count,0);assert.equal(c.after.odontograma_eventos.count,0);});
 const negative=await fixture('negativas');const ne=event(negative);negative.eventId=ne.id;save();r=await sessions.ANA.client.from('odontograma_eventos').insert(ne);assert(!r.error,r.error?.message);
 for(const role of ['BRUNO','PROTETICO','CARLOS']){
  await check('B4 recepção recusa '+role,role,negative,()=>receipt(role,negative),async c=>{assert.equal(c.response.result.ok,false);assert.deepEqual(c.before,c.after);});
  await check('B4 assinatura de procedimento alheio recusa '+role,role,negative,()=>action(role,'assinarProcedimentos',[{eventoIds:[ne.id],assinadoPor:'QA paciente sintético B4',assinaturaDataUrl:png}]),async c=>{assert.equal(c.response.result.ok,false);assert.deepEqual(c.before,c.after);});
 }
 e.controlsFinal=await controlHashes();assert.deepEqual(e.controlsInitial,e.controlsFinal);e.sourceAfter=fingerprints();assert.deepEqual(e.sourceBefore,e.sourceAfter,'B4 sources changed during the test');
 for(const f of e.fixtures)f.final=await state(f);e.finished=new Date().toISOString();save();
}catch(error){e.interrupted={message:error.message,time:new Date().toISOString()};save();console.error('INCONCLUSIVO '+error.message);process.exitCode=1;}
finally{await browser.close();save();console.log('Evidence '+file);}
