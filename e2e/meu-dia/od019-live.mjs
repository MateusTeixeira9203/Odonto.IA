// Directed OD-019 Auth QA. No migration, cleanup, production or automatic replay.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';
import { chromium, expect } from '@playwright/test';
import { contexto, exigirHostQa } from '../../scripts/qa/_lib.mjs';

assert.equal(process.env.OD019_READY, 'M0-APLICADA-3000');
const ctx = await contexto(path.resolve('../Odonto.IA-depois4'));
const host = exigirHostQa(ctx.env.NEXT_PUBLIC_SUPABASE_URL).hostname;
const base = 'http://localhost:3000';
const retest=process.env.OD019_RUN==='4763996';
if(process.env.OD019_RUN)assert(retest,'Unknown run');
if(retest)execFileSync('git',['merge-base','--is-ancestor','4763996','HEAD']);
const dir = 'C:/Users/mateu/Desktop/Nex Lab/Projetos/Odonto-IA/log/'+(retest?'QA-OD019-reteste-4763996-2026-10-25':'QA-OD019-live-2026-10-25');
fs.mkdirSync(dir, {recursive:true});
const file = path.join(dir, 'evidence.json');
const stage = process.argv[2] ?? 'preflight';
const e = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file,'utf8')) : {base,host,head:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),started:new Date().toISOString(),identities:[],fixtures:[],cases:[],stages:{}};
assert(!e.stages[stage], 'Stage already attempted: do not replay');
e.stages[stage] = {started:new Date().toISOString()};
const save = () => fs.writeFileSync(file, JSON.stringify(e,null,2)); save();
const guarded = (readOnly=false) => (input,init) => {
  assert.equal(new URL(input instanceof Request?input.url:String(input)).hostname,host);
  if(readOnly) assert(['GET','HEAD'].includes((init?.method??'GET').toUpperCase()));
  return fetch(input,init);
};
const db = createClient(ctx.env.NEXT_PUBLIC_SUPABASE_URL,ctx.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:guarded(true)}});
const rows = async q => {const r=await q;assert(!r.error,r.error?.message);return r.data;};
const hash = data => createHash('sha256').update(JSON.stringify(data)).digest('hex');
const accounts={ANA:'dentista.a.r140@example.invalid',BRUNO:'dentista.b.r140@example.invalid',SARA:'secretaria.a.auditoria@example.invalid',PROTETICO:'protetico.a.qa@example.invalid',CARLOS:'dentista.c.auditoria@example.invalid',ADMIN:'admin.a.auditoria@example.invalid'};
const sessions={};
const browser=await chromium.launch({channel:'msedge',headless:true});
async function login(role){
  if(sessions[role])return sessions[role];
  const account=ctx.accounts.contas.find(c=>c.email===accounts[role]);assert(account);
  const client=createClient(ctx.env.NEXT_PUBLIC_SUPABASE_URL,ctx.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:guarded()}});
  const auth=await client.auth.signInWithPassword({email:account.email,password:account.senha});assert(!auth.error,'QA Auth failed');
  const user=await rows(client.from('users').select('active_clinica_id').eq('id',auth.data.user.id).single());
  const dentist=await rows(db.from('dentistas').select('id,nome,role,cro').eq('user_id',auth.data.user.id).eq('clinica_id',user.active_clinica_id).single());
  const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage();
  if(retest)page.on('response',async response=>{
    const url=new URL(response.url());
    if(response.status()<400)return;
    const issue={role,host:url.hostname,path:url.pathname,http:response.status()};
    if(url.hostname===host&&url.pathname.startsWith('/rest/')){const body=await response.json().catch(()=>null);issue.code=body?.code;}
    (e.networkIssues??=[]).push(issue);save();
  });
  const requests=new Set();
  await page.route('**/*',route=>{const u=new URL(route.request().url());if(u.hostname.endsWith('.supabase.co')){requests.add(u.hostname);if(u.hostname!==host)return route.abort();}return route.continue();});
  await page.goto(base+'/login');
  await page.waitForFunction(()=>{const f=document.querySelector('form');return f&&Object.keys(f).some(k=>k.startsWith('__reactProps')&&typeof Reflect.get(f,k).onSubmit==='function');});
  await page.locator('input[type=email]').fill(account.email);await page.locator('input[type=password]').fill(account.senha);
  await page.locator('button[type=submit]').click();await page.waitForURL(u=>u.pathname.startsWith('/dashboard'),{timeout:60000});
  const cookies=await context.cookies();assert(cookies.some(c=>c.name.startsWith('sb-uhuxteswtvgdnlixwrdu-auth-token')),'No QA server cookie');assert(!cookies.some(c=>c.name.includes('zenfemoxvwerplrjgfqz')));
  assert([...requests].every(h=>h===host));
  sessions[role]={client,page,clinicId:user.active_clinica_id,dentistId:dentist.id,cro:dentist.cro};
  if(!e.identities.some(i=>i.role===role))e.identities.push({role,clinicId:user.active_clinica_id,dentistId:dentist.id,effectiveRole:dentist.role,serverQaCookie:true,hosts:[...requests]});
  save();return sessions[role];
}
async function state(){
 const patients=e.fixtures.map(f=>f.patientId);
 const data={};
 for(const t of ['pacientes','agendamentos','fichas','atendimentos_clinicos','odontograma_eventos','assinaturas'])data[t]=patients.length?await rows(db.from(t).select('*').in(t==='pacientes'?'id':'paciente_id',patients).order('id')):[];
 data.ficha_evolucoes=data.fichas.length?await rows(db.from('ficha_evolucoes').select('*').in('ficha_id',data.fichas.map(f=>f.id)).order('id')):[];
 data.atendimento_eventos=data.atendimentos_clinicos.length?await rows(db.from('atendimento_eventos').select('*').in('atendimento_id',data.atendimentos_clinicos.map(f=>f.id)).order('atendimento_id').order('evento_id').order('papel')):[];
 data.reservedVisits=e.reservedVisits?.length?await rows(db.from('atendimentos_clinicos').select('*').in('id',e.reservedVisits).order('id')):[];
 data.reservedFichas=e.reservedFichas?.length?await rows(db.from('fichas').select('*').in('id',e.reservedFichas).order('id')):[];
 return Object.fromEntries(Object.entries(data).map(([t,d])=>[t,{count:d.length,hash:hash(d),ids:d.map(x=>x.id??`${x.atendimento_id}:${x.evento_id}:${x.papel}`)}]));
}
async function fixture(role,label,{ficha=false,slot=true}={}){
 assert(!e.fixtures.some(f=>f.label===label));const s=await login(role);
 const f={label,role,patientId:randomUUID(),clinicId:s.clinicId,name:`QA OD019 ${label} ${Date.now()}`,...(slot?{slotId:randomUUID()}:{}),...(ficha?{fichaId:randomUUID()}:{} )};e.fixtures.push(f);save();
 let r=await s.client.from('pacientes').insert({id:f.patientId,clinica_id:s.clinicId,dentista_id:s.dentistId,nome:f.name});assert(!r.error,r.error?.message);
 if(slot){r=await s.client.from('agendamentos').insert({id:f.slotId,clinica_id:s.clinicId,paciente_id:f.patientId,dentista_id:s.dentistId,data_hora:new Date().toISOString(),duracao_minutos:15,status:'scheduled',observacoes:'QA OD019 sintético',created_by:s.dentistId});assert(!r.error,r.error?.message);}
 if(ficha){r=await s.client.from('fichas').insert({id:f.fichaId,clinica_id:s.clinicId,paciente_id:f.patientId,dentista_id:s.dentistId,origem:'manual',status:'aberta',data_atendimento:'2026-10-25',anotacoes:'QA OD019 sintético'});assert(!r.error,r.error?.message);}
 f.created=true;save();return f;
}
async function action(role,name,args,target='/dashboard/meu-dia'){
 const manifest=JSON.parse(fs.readFileSync('.next/dev/server/server-reference-manifest.json','utf8'));
 const id=Object.entries(manifest.node).find(([,v])=>v.exportedName===name)?.[0];assert(id,'Action not compiled '+name);
 const response=await sessions[role].page.request.post(base+target,{headers:{'next-action':id,'content-type':'text/plain;charset=UTF-8',accept:'text/x-component',origin:base},data:JSON.stringify(args),maxRedirects:0,timeout:60000});
 const text=await response.text();
 const candidates=text.split('\n').filter(l=>/^\d+:\{/.test(l)).map(l=>JSON.parse(l.slice(l.indexOf(':')+1),(_k,v)=>v==='$undefined'?undefined:v));
 const result=candidates.find(r=>Object.hasOwn(r,'ok')||Object.hasOwn(r,'error')||Object.hasOwn(r,'id'))??candidates.find(r=>Object.keys(r).length===0);
 assert(result,'Action result missing');return {http:response.status(),result};
}
async function check(label,run,verify){
 const c={label,status:'NAO TESTADO',before:await state(),started:new Date().toISOString()};e.cases.push(c);save();
 try{c.response=await run(c);c.after=await state();await verify(c);c.status='PASSOU';}
 catch(error){c.status='FALHOU';c.failure=error.message;c.after=await state();}
 save();console.log(c.status+' '+label);return c;
}
const capture=async(page,label)=>{await page.screenshot({path:path.join(dir,label+'.png'),animations:'disabled'});};
const visitPayload=f=>({visitaKey:randomUUID(),pacienteId:f.patientId,agendamentoId:f.slotId,textoVisita:'QA OD019 relato clínico sintético',eventosDraft:[],alertaNovo:null,ortoManutencao:null,destinoNovos:{fichaId:null}});
try{
 if(stage==='preflight'){
   for(const role of ['ANA','BRUNO','SARA','PROTETICO'])await login(role);
   assert.notEqual(sessions.ANA.clinicId,sessions.BRUNO.clinicId);
   assert.equal(sessions.ANA.clinicId,sessions.SARA.clinicId);
   assert.equal(sessions.ANA.clinicId,sessions.PROTETICO.clinicId);
   e.preflight='PASSOU';console.log('PASSOU preflight: four Auth sessions and QA server cookies');
 }
 if(stage==='L1'){
   assert.equal(e.preflight,'PASSOU');await login('ANA');await login('BRUNO');
   const a=await fixture('ANA','L1-A'),b=await fixture('BRUNO','L1-B');
   const s=sessions.BRUNO;
   e.reservedVisits=[randomUUID(),randomUUID()];e.reservedFichas=[randomUUID()];save();
   for(const [label,table,payload]of [
    ['REST visita B paciente A','atendimentos_clinicos',{id:e.reservedVisits[0],clinica_id:s.clinicId,paciente_id:a.patientId,dentista_id:s.dentistId,agendamento_id:null,chave_idempotencia:randomUUID(),data_atendimento:'2026-10-25',origem:'meu_dia',estado:'preparando'}],
    ['REST visita B agendamento A','atendimentos_clinicos',{id:e.reservedVisits[1],clinica_id:s.clinicId,paciente_id:b.patientId,dentista_id:s.dentistId,agendamento_id:a.slotId,chave_idempotencia:randomUUID(),data_atendimento:'2026-10-25',origem:'meu_dia',estado:'preparando'}],
    ['REST ficha B paciente A','fichas',{id:e.reservedFichas[0],clinica_id:s.clinicId,paciente_id:a.patientId,dentista_id:s.dentistId,origem:'manual',status:'aberta'}]
   ])await check('L1 '+label,async()=>{const r=await s.client.from(table).insert(payload).select('id');return {http:r.status,error:r.error?{code:r.error.code,message:r.error.message,details:r.error.details}:null,data:r.data};},c=>{assert.equal(c.response.http,409);assert.equal(c.response.error?.code,'23503');assert.deepEqual(c.before,c.after);});
   await s.page.goto(base+'/dashboard/meu-dia');
   if(retest)await s.page.locator('[data-rail-alvo]').first().waitFor({timeout:25000});
   else await s.page.getByRole('heading',{name:'Meu Dia',exact:true}).waitFor({timeout:60000});
   await check('L1 Meu Dia Bruno x A ação real',()=>action('BRUNO','salvarVisitaMeuDia',[visitPayload(a)]),c=>{assert.equal(c.response.result.ok,false);assert.match(c.response.result.error,/Registro n[aã]o encontrado/);assert.deepEqual(c.before,c.after);});
 }
 if(stage==='L1-app'){
   assert(e.stages.L1.error&&!e.cases.some(c=>c.label.includes('ação real')),'Only preparation retry, no prior action');
   const b=await login('BRUNO');await b.page.goto(base+'/dashboard/meu-dia');
   e.brunoPage={url:b.page.url(),text:await b.page.locator('body').innerText()};await capture(b.page,'L1-Bruno-meu-dia');save();
   const a=e.fixtures.find(f=>f.label==='L1-A');
   await check('L1 Meu Dia Bruno x A ação real',()=>action('BRUNO','salvarVisitaMeuDia',[visitPayload(a)]),c=>{assert.equal(c.response.result.ok,false);assert.match(c.response.result.error,/Registro n[aã]o encontrado/);assert.deepEqual(c.before,c.after);});
 }
 if(stage==='inspect-Ana'){
   const a=await login('ANA');await a.page.goto(base+'/dashboard/meu-dia');
   e.anaPage={url:a.page.url(),text:await a.page.locator('body').innerText()};await capture(a.page,'pre-L2-meu-dia');save();
 }
 if(stage==='L1-result'){
   const previous=e.cases.find(c=>c.label==='L1 Meu Dia Bruno x A ação real');assert(previous?.failure&&JSON.stringify(previous.before)===JSON.stringify(previous.after));
   previous.status='NAO TESTADO';previous.harnessNote='Parser selected RSC metadata, not action result. Zero effects; one corrected-parser attempt.';save();
   await login('BRUNO');
   await check('L1 Meu Dia Bruno x A resultado corrigido',()=>action('BRUNO','salvarVisitaMeuDia',[visitPayload(e.fixtures.find(f=>f.label==='L1-A'))]),c=>{assert.equal(c.response.result.ok,false);assert.match(c.response.result.error,/Registro n[aã]o encontrado/);assert.deepEqual(c.before,c.after);});
 }
 if(['L2','L5'].includes(stage)){
   const role=stage==='L2'?'ANA':'BRUNO',s=await login(role);
   const f=await fixture(role,stage+'-principal');
   await check(stage+' Meu Dia salvar/finalizar Auth',()=>action(role,'salvarVisitaMeuDia',[visitPayload(f)]),async c=>{
     assert.equal(c.response.result.ok,true);assert(!c.response.result.eventosFalharam);
     f.savedFichaId=c.response.result.fichaId;f.visitId=c.response.result.atendimentoId;save();
     c.persisted=await rows(s.client.from('atendimentos_clinicos').select('id,clinica_id,paciente_id,estado').eq('id',f.visitId).single());
     assert.equal(c.persisted.clinica_id,f.clinicId);assert.equal(c.persisted.paciente_id,f.patientId);assert.equal(c.persisted.estado,'finalizado');
     c.slot=await rows(s.client.from('agendamentos').select('id,status').eq('id',f.slotId).single());assert.equal(c.slot.status,'completed');
   });
   await s.page.goto(base+'/dashboard/pacientes/'+f.patientId);
   await check(stage+' Prontuário recarga e Novo atendimento UI',async c=>{
     await s.page.getByRole('tab',{name:'Prontuário',exact:true}).click({timeout:20000});
     await s.page.reload();await s.page.getByRole('tab',{name:'Prontuário',exact:true}).click({timeout:20000});
     await s.page.getByText('QA OD019 relato clínico sintético',{exact:false}).first().waitFor({timeout:15000});
     c.reloadSeen=true;await capture(s.page,stage+'-prontuario-reload');
     await s.page.getByRole('button',{name:'Novo atendimento',exact:true}).first().click();
     await s.page.getByRole('button',{name:'+ Evolução',exact:true}).click({timeout:15000});
     const editor=s.page.getByPlaceholder('Curativo, sutura, orientação ou evolução da consulta',{exact:true});await editor.click();await editor.fill('QA OD019 '+stage+' Novo atendimento sintético');
     await capture(s.page,stage+'-novo-atendimento-antes');
     await s.page.getByRole('button',{name:'Salvar atendimento',exact:true}).click();
     await expect.poll(async()=>rows(db.from('atendimentos_clinicos').select('id').eq('paciente_id',f.patientId)),{timeout:20000}).toHaveLength(2);
     await s.page.reload();await s.page.getByRole('tab',{name:'Prontuário',exact:true}).click({timeout:20000});
     await s.page.getByText('QA OD019 '+stage+' Novo atendimento sintético',{exact:false}).first().waitFor({timeout:15000});await capture(s.page,stage+'-novo-atendimento-depois');return {uiReload:true};
   },c=>assert(c.response.uiReload));
   const alt=await fixture(role,stage+'-agenda-alternativo',{slot:false});
   await s.page.goto(base+'/dashboard/agendamentos');
   await check(stage+' Agenda criar Auth',()=>action(role,'criarAgendamento',[{pacienteId:f.patientId,dataHora:'2026-10-26T21:17:00Z',duracaoMinutos:15,observacoes:'QA OD019 '+stage+' agenda',forcarConflitoDentista:true,forcarForaDoExpediente:true}],'/dashboard/agendamentos'),async c=>{
     assert(!c.response.result.error,c.response.result.error);assert(c.response.result.id);f.agendaCreatedId=c.response.result.id;save();
     c.persisted=await rows(s.client.from('agendamentos').select('id,clinica_id,paciente_id').eq('id',f.agendaCreatedId).single());assert.equal(c.persisted.paciente_id,f.patientId);assert.equal(c.persisted.clinica_id,f.clinicId);
   });
   if(f.agendaCreatedId)await check(stage+' Agenda editar e trocar paciente da mesma clínica Auth',()=>action(role,'atualizarAgendamento',[f.agendaCreatedId,{pacienteId:alt.patientId,observacoes:'QA OD019 editado '+stage,forcarConflitoDentista:true,forcarForaDoExpediente:true}],'/dashboard/agendamentos'),async c=>{
     assert(!c.response.result.error,c.response.result.error);await s.page.reload();
     c.reload=await rows(s.client.from('agendamentos').select('id,clinica_id,paciente_id,observacoes').eq('id',f.agendaCreatedId).single());assert.equal(c.reload.paciente_id,alt.patientId);assert.equal(c.reload.clinica_id,f.clinicId);assert.equal(c.reload.observacoes,'QA OD019 editado '+stage);
     await capture(s.page,stage+'-agenda-reload');
   });
 }
 if(stage==='L3'){
   const a=await login('ANA'),s=await login('SARA');await login('CARLOS');
   const f=await fixture('ANA','L3-recepcao',{ficha:true});
   f.ownEventId=randomUUID();f.forwardEventId=randomUUID();save();
   const event=(id,forward)=>({id,clinica_id:f.clinicId,paciente_id:f.patientId,ficha_id:f.fichaId,dentista_id:a.dentistId,tipo:'outro',procedimento_nome:'QA OD019 recepção '+(forward?'encaminhado':'próprio'),status:'realizado',realizado_em:'2026-10-25',origem:'clinica',nivel:'dente',dente:26,faces:[],momento_planejado:'sessao_atual',encaminhado_para:forward?sessions.CARLOS.dentistId:null});
   const r=await a.client.from('odontograma_eventos').insert([event(f.ownEventId,false),event(f.forwardEventId,true)]);assert(!r.error,r.error?.message);
   await s.page.goto(base+'/dashboard/agendamentos');
   await check('L3 Sara Agenda criar Auth',()=>action('SARA','criarAgendamento',[{pacienteId:f.patientId,dentistaId:a.dentistId,dataHora:'2026-10-26T21:47:00Z',duracaoMinutos:15,observacoes:'QA OD019 Sara agenda',forcarConflitoDentista:true,forcarForaDoExpediente:true}],'/dashboard/agendamentos'),async c=>{
     assert(!c.response.result.error,c.response.result.error);assert(c.response.result.id);f.agendaCreatedId=c.response.result.id;save();
     await s.page.reload();c.reload=await rows(s.client.from('agendamentos').select('id,paciente_id,dentista_id,clinica_id').eq('id',f.agendaCreatedId).single());assert.equal(c.reload.paciente_id,f.patientId);assert.equal(c.reload.dentista_id,a.dentistId);assert.equal(c.reload.clinica_id,f.clinicId);await capture(s.page,'L3-agenda-reload');
   });
   const png=await s.page.evaluate(()=>{const c=document.createElement('canvas');c.width=300;c.height=120;const x=c.getContext('2d');x.beginPath();x.moveTo(20,70);x.lineTo(80,30);x.lineTo(140,90);x.lineTo(270,40);x.stroke();return c.toDataURL('image/png');});
   await check('L3 recepção Auth assina próprio e preserva encaminhado REC-4',()=>action('SARA','salvarAssinaturaRecepcao',[f.fichaId,f.patientId,'QA OD019 paciente sintético',png],'/dashboard/agendamentos'),async c=>{
     assert.equal(c.response.result.ok,false);assert.match(c.response.result.error,/1 procedimento\(s\) assinado\(s\)/);assert.match(c.response.result.error,/encaminhado/);
     c.events=await rows(db.from('odontograma_eventos').select('id,assinatura_id,encaminhado_para').eq('ficha_id',f.fichaId).order('id'));
     const own=c.events.find(x=>x.id===f.ownEventId),forward=c.events.find(x=>x.id===f.forwardEventId);assert(own.assinatura_id);assert.equal(forward.assinatura_id,null);
     c.signature=await rows(db.from('assinaturas').select('id,dentista_id,cro_no_ato,assinado_em').eq('id',own.assinatura_id).single());assert.equal(c.signature.dentista_id,a.dentistId);assert.equal(c.signature.cro_no_ato,a.cro);
     c.header=await rows(db.from('fichas').select('id,assinado_em,assinatura_url').eq('id',f.fichaId).single());assert.equal(c.header.assinado_em,null);assert.equal(c.header.assinatura_url,null);
     await s.page.reload();c.reload=await rows(s.client.from('odontograma_eventos').select('id,assinatura_id,encaminhado_para').eq('ficha_id',f.fichaId).order('id'));assert.deepEqual(c.reload,c.events);
   });
   await check('L3 recepção UI limite canvas conhecido',async c=>{
     await s.page.goto(base+'/dashboard');const patient=s.page.getByRole('link',{name:f.name,exact:true});await patient.waitFor({timeout:20000});
     const card=patient.locator('../..');await card.getByRole('button',{name:'Assinar',exact:true}).click();
     const dialog=s.page.getByRole('dialog'),canvas=dialog.locator('canvas');await canvas.waitFor({timeout:15000});
     c.canvas=await canvas.evaluate(c=>({width:c.width,height:c.height,clientWidth:c.clientWidth,clientHeight:c.clientHeight}));
     const box=await canvas.boundingBox();assert(box);await s.page.mouse.move(box.x+25,box.y+50);await s.page.mouse.down();await s.page.mouse.move(box.x+160,box.y+90,{steps:15});await s.page.mouse.up();
     c.disabled=await dialog.getByRole('button',{name:'Confirmar Assinatura',exact:true}).isDisabled();await capture(s.page,'L3-recepcao-canvas');return {limitConfirmed:c.disabled};
   },c=>{assert(c.response.limitConfirmed,'Known canvas limitation changed; inspect before saving');assert.deepEqual(c.before,c.after);});
 }
 if(stage==='L4'){
   const a=await login('ANA'),p=await login('PROTETICO');await login('CARLOS');
   const f=await fixture('ANA','L4-protetico',{ficha:true});f.orderId=randomUUID();f.otherOrderId=randomUUID();save();
   const order=(id,recipient)=>({id,clinica_id:f.clinicId,protetico_id:recipient,dentista_id:a.dentistId,paciente_id:f.patientId,observacao:'QA OD019 agenda protético '+id,data_entrega:'2026-10-25',status:'pendente'});
   const created=await a.client.from('pedidos_protetico').insert([order(f.orderId,p.dentistId),order(f.otherOrderId,sessions.CARLOS.dentistId)]);assert(!created.error,created.error?.message);
   await check('L4 protético lê somente pedidos próprios Auth',async()=>({rows:await rows(p.client.from('pedidos_protetico').select('id,protetico_id').in('id',[f.orderId,f.otherOrderId]))}),c=>{assert.deepEqual(c.response.rows.map(x=>x.id),[f.orderId]);});
   await check('L4 protético própria agenda UI e recarga',async c=>{
     await p.page.goto(base+'/dashboard/agendamentos');await p.page.getByText('QA OD019 agenda protético '+f.orderId,{exact:false}).first().waitFor({timeout:20000});await p.page.reload();await p.page.getByText('QA OD019 agenda protético '+f.orderId,{exact:false}).first().waitFor({timeout:20000});
     c.text=await p.page.locator('body').innerText();assert(!c.text.includes(f.otherOrderId));await capture(p.page,'L4-agenda-protetico');return {reload:true};
   },c=>assert(c.response.reload));
   await check('L4 protético insert ficha REST recusado',async()=>{const r=await p.client.from('fichas').insert({id:randomUUID(),clinica_id:f.clinicId,paciente_id:f.patientId,dentista_id:p.dentistId,origem:'manual',status:'aberta'}).select('id');return {http:r.status,error:r.error?{code:r.error.code,message:r.error.message}:null,data:r.data};},c=>{assert.equal(c.response.error?.code,'42501');assert.deepEqual(c.before,c.after);});
   await check('L4 protético escrita clínica Meu Dia recusada',()=>action('PROTETICO','salvarVisitaMeuDia',[visitPayload(f)]),c=>{assert.equal(c.response.result.ok,false);assert.deepEqual(c.before,c.after);});
   await check('L4 protético rota clínica sem editor',async c=>{await p.page.goto(base+'/dashboard/pacientes/'+f.patientId);await p.page.waitForTimeout(2000);c.url=p.page.url();c.text=await p.page.locator('body').innerText();c.editorCount=await p.page.getByRole('button',{name:'Novo atendimento',exact:true}).count();await capture(p.page,'L4-clinica-restrita');return {editorCount:c.editorCount};},c=>{assert.equal(c.response.editorCount,0);assert.deepEqual(c.before,c.after);});
 }
 if(stage==='L2-delete'){
   const a=await login('ANA'),f=await fixture('ANA','L2-exclusao-sintetica',{ficha:true,slot:false});
   f.eventId=randomUUID();save();const r=await a.client.from('odontograma_eventos').insert({id:f.eventId,clinica_id:f.clinicId,paciente_id:f.patientId,ficha_id:f.fichaId,dentista_id:a.dentistId,tipo:'outro',procedimento_nome:'QA OD019 exclusão sintética',status:'indicado',origem:'clinica',nivel:'boca',faces:[],momento_planejado:'sessao_atual'});assert(!r.error,r.error?.message);
   await a.page.goto(base+'/dashboard/pacientes/'+f.patientId);await a.page.getByRole('tab',{name:'Prontuário',exact:true}).waitFor({timeout:20000});
   await check('L2 apagar ficha própria sintética Auth e cascade',()=>action('ANA','deletarFicha',[f.fichaId],'/dashboard/pacientes/'+f.patientId),async c=>{
     assert.equal(c.response.result.ok,true);await a.page.reload();
     c.remainingFicha=await rows(a.client.from('fichas').select('id').eq('id',f.fichaId));c.remainingEvents=await rows(db.from('odontograma_eventos').select('id').eq('id',f.eventId));
     assert.equal(c.remainingFicha.length,0);assert.equal(c.remainingEvents.length,0);f.deletedInRequiredTest={fichaId:f.fichaId,eventId:f.eventId};save();await capture(a.page,'L2-exclusao-reload');
   });
 }
 if(stage==='MeuDia-UI'){
   const a=await login('ANA');const errors=[];
   a.page.on('pageerror',error=>errors.push(error.message));
   await check('L2 Meu Dia UI carregamento',async c=>{
     await a.page.goto(base+'/dashboard/meu-dia');
     try{await a.page.getByRole('heading',{name:'Meu Dia',exact:true}).waitFor({timeout:20000});}catch{ /* preserve the rendered error for the report */ }
     c.url=a.page.url();c.text=await a.page.locator('body').innerText();c.errors=errors;await capture(a.page,'L2-meu-dia-erro');
     return {headingVisible:await a.page.getByRole('heading',{name:'Meu Dia',exact:true}).isVisible(),errorShown:c.text.includes('Não deu pra carregar o seu dia')};
   },c=>assert(c.response.headingVisible,'Meu Dia não carregou: erro/skeleton em 3000'));
 }
 if(stage==='final-readonly'){
   const ui=e.cases.find(c=>c.label==='L3 recepção UI limite canvas conhecido');
   if(ui?.status==='FALHOU'&&ui.failure?.includes('getByRole(\'link\'')){
     ui.attemptStatus='FALHOU_PREPARO';ui.status='NAO TESTADO';ui.limit='Cartão próprio não localizado na lista do Início; canvas não abriu e nenhuma confirmação foi enviada. Não é prova nova do defeito REC-1.';
   }
   e.finalState=await state();
   const orders=await rows(db.from('pedidos_protetico').select('id,clinica_id,paciente_id,protetico_id,status').in('paciente_id',e.fixtures.map(f=>f.patientId)).order('id'));
   e.ordersFinal={count:orders.length,hash:hash(orders),rows:orders};
   e.finalHead=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
   e.finished=new Date().toISOString();save();console.log('PASSOU inventário final somente leitura');
 }
 if(stage.startsWith('RT-')){
   assert(retest,'Retest requires isolated evidence directory');
   const {run}=await import('./od019-retest-4763996.mjs');
   await run(stage,{assert,fs,path,randomUUID,createHash,execFileSync,expect,e,save,rows,db,login,state,fixture,action,check,capture,visitPayload,sessions,base,dir,hash});
 }
 e.stages[stage].finished=new Date().toISOString();save();
}catch(error){e.stages[stage].error=error.message;save();console.error('INTERRUPCAO '+error.message);process.exitCode=1;}
finally{await browser.close();save();}

export {e,save,rows,db,login,state,fixture,action,check,capture,visitPayload,expect};
