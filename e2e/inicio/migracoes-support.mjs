import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {createClient} from '@supabase/supabase-js';
import {contexto,exigirHostQa} from '../../scripts/qa/_lib.mjs';
assert.equal(process.env.INICIO_OD015_READY,'M1-M2-2c6eeff');
export const snapshotDir=path.resolve('../Odonto.IA-qa3-depois');
export const commit=execFileSync('git',['rev-parse','HEAD'],{cwd:snapshotDir,encoding:'utf8'}).trim();assert(commit.startsWith('2c6eeff'));
export const ctx=await contexto(snapshotDir);
export const host=exigirHostQa(ctx.env.NEXT_PUBLIC_SUPABASE_URL).hostname;
export const base='http://localhost:3015';
export const dir='C:/Users/mateu/Desktop/Nex Lab/Projetos/Odonto-IA/log/QA-OD-005b-inicio-2026-10-24-evidencias/m1m2-live';
fs.mkdirSync(dir,{recursive:true});
export const file=path.join(dir,'od015-m1m2-live.json');
export const names={ANA:'dentista.a.r140@example.invalid',CARLOS:'dentista.c.auditoria@example.invalid',SARA:'secretaria.a.auditoria@example.invalid',PROTETICO:'protetico.a.qa@example.invalid',BRUNO:'dentista.b.r140@example.invalid'};
export const auth={};
export const db=createClient(ctx.env.NEXT_PUBLIC_SUPABASE_URL,ctx.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:(input,init)=>{
  assert.equal(new URL(input instanceof Request?input.url:String(input)).hostname,host);assert(['GET','HEAD'].includes((init?.method??'GET').toUpperCase()));return fetch(input,init);
}}});
export async function rows(q){const r=await q;assert(!r.error,r.error?.message);return r.data;}
export function save(e){fs.writeFileSync(file,JSON.stringify(e,null,2));}
export async function authenticate(role){
  if(auth[role])return auth[role];
  const account=ctx.accounts.contas.find(c=>c.email===names[role]);assert(account);
  const client=createClient(ctx.env.NEXT_PUBLIC_SUPABASE_URL,ctx.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:(input,init)=>{assert.equal(new URL(input instanceof Request?input.url:String(input)).hostname,host);return fetch(input,init);}}});
  const logged=await client.auth.signInWithPassword({email:account.email,password:account.senha});assert(!logged.error,'Synthetic login failed');
  const user=await rows(client.from('users').select('active_clinica_id').eq('id',logged.data.user.id).single());
  const dentist=await rows(client.from('dentistas').select('id,cro').eq('user_id',logged.data.user.id).eq('clinica_id',user.active_clinica_id).single());
  const membership=await rows(client.from('clinica_usuarios').select('role,status').eq('usuario_id',logged.data.user.id).eq('clinica_id',user.active_clinica_id).single());
  auth[role]={client,clinicId:user.active_clinica_id,dentistId:dentist.id,cro:dentist.cro,role:membership.role,userId:logged.data.user.id};return auth[role];
}
export async function browserLogin(browser,role){
  const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage();
  const account=ctx.accounts.contas.find(c=>c.email===names[role]);assert(account);
  await page.route('**/*',route=>{const u=new URL(route.request().url());if(u.hostname.endsWith('.supabase.co')&&u.hostname!==host)return route.abort();return route.continue();});
  await page.goto(base+'/login');await page.waitForFunction(()=>{const f=document.querySelector('form');return f&&Object.keys(f).some(k=>k.startsWith('__reactProps')&&typeof Reflect.get(f,k).onSubmit==='function');});
  await page.locator('input[type=email]').fill(account.email);await page.locator('input[type=password]').fill(account.senha);await page.locator('button[type=submit]').click();await page.waitForURL(u=>u.pathname.startsWith('/dashboard'),{timeout:60000});
  return page;
}
export async function snapshot(f){
  const fichas=await rows(db.from('fichas').select('*').eq('paciente_id',f.patientId).order('id'));
  const [atendimentos_clinicos,odontograma_eventos,assinaturas]=await Promise.all([
    rows(db.from('atendimentos_clinicos').select('*').eq('paciente_id',f.patientId).order('id')),
    rows(db.from('odontograma_eventos').select('*').eq('paciente_id',f.patientId).order('id')),
    rows(db.from('assinaturas').select('*').eq('paciente_id',f.patientId).order('id')),
  ]);
  const ficha_evolucoes=fichas.length?await rows(db.from('ficha_evolucoes').select('*').in('ficha_id',fichas.map(x=>x.id)).order('id')):[];
  const atendimento_eventos=atendimentos_clinicos.length?await rows(db.from('atendimento_eventos').select('*').in('atendimento_id',atendimentos_clinicos.map(x=>x.id)).order('atendimento_id').order('evento_id').order('papel')):[];
  const agendamentos=await rows(db.from('agendamentos').select('*').eq('paciente_id',f.patientId).order('id'));
  return Object.fromEntries(Object.entries({fichas,atendimentos_clinicos,odontograma_eventos,ficha_evolucoes,atendimento_eventos,assinaturas,agendamentos}).map(([table,data])=>[table,{count:data.length,hash:createHash('sha256').update(JSON.stringify(data)).digest('hex'),ids:data.map(x=>x.id??`${x.atendimento_id}:${x.evento_id}:${x.papel}`)}]));
}
export async function fixture(e,label,{ficha=true,slot=false}={}){
  assert(!e.fixtures.some(f=>f.label===label),'No automatic fixture replay');const a=await authenticate('ANA');
  const f={label,patientId:randomUUID(),clinicId:a.clinicId,name:'QA INICIO3 M1M2 '+label+' '+Date.now()};if(ficha)f.fichaId=randomUUID();if(slot)f.slotId=randomUUID();
  e.fixtures.push(f);save(e);
  let r=await a.client.from('pacientes').insert({id:f.patientId,clinica_id:f.clinicId,dentista_id:a.dentistId,nome:f.name});assert(!r.error,r.error?.message);
  if(ficha){r=await a.client.from('fichas').insert({id:f.fichaId,clinica_id:f.clinicId,paciente_id:f.patientId,dentista_id:a.dentistId,origem:'manual',data_atendimento:'2026-10-24',queixa_principal:'QA M1M2 '+label,anotacoes:'QA M1M2 fixture sintética',status:'aberta'});assert(!r.error,r.error?.message);}
  if(slot){r=await a.client.from('agendamentos').insert({id:f.slotId,clinica_id:f.clinicId,dentista_id:a.dentistId,paciente_id:f.patientId,data_hora:new Date().toISOString(),duracao_minutos:15,status:'scheduled',observacoes:'QA M1M2 sintético',created_by:a.dentistId});assert(!r.error,r.error?.message);}
  f.initial=await snapshot(f);save(e);return f;
}
export function event(f,extra={}){return {id:randomUUID(),clinica_id:f.clinicId,paciente_id:f.patientId,ficha_id:f.fichaId,dentista_id:auth.ANA.dentistId,tipo:'outro',procedimento_nome:'QA M1M2 sintético',status:'indicado',origem:'clinica',nivel:'dente',dente:26,faces:[],momento_planejado:'sessao_atual',...extra};}
export async function apiCase(e,label,role,f,operation,expected){
  const c={label,role,status:'INCONCLUSIVO',before:await snapshot(f),sent:true};e.cases.push(c);save(e);
  try{
    const r=await operation();c.response={status:r.status,statusText:r.statusText,data:r.data,error:r.error?{code:r.error.code,message:r.error.message,details:r.error.details,hint:r.error.hint}:null};
    c.after=await snapshot(f);
    const unchanged=JSON.stringify(c.before)===JSON.stringify(c.after);c.zeroWrite=unchanged;
    if(expected==='denied')assert((r.error||Array.isArray(r.data)&&r.data.length===0)&&unchanged,'Expected refusal/zero rows and unchanged tables');
    else{assert(!r.error,r.error?.message);assert(!unchanged,'Expected persisted change');}
    c.status='PASSOU';
  }catch(error){c.status='FALHOU';c.failure=error.message;}
  save(e);console.log(c.status+' '+label);return c;
}
export async function capture(page,label){await page.screenshot({path:path.join(dir,label+'.png'),animations:'disabled',fullPage:false});}
export async function recordUi(e,label,f,run,verify){
  const c={label,role:'UI',status:'INCONCLUSIVO',before:await snapshot(f)};e.cases.push(c);save(e);
  try{await run(c);c.after=await snapshot(f);await verify(c);c.status='PASSOU';}
  catch(error){c.failure=error.message;c.status='FALHOU';c.after=await snapshot(f);}
  save(e);console.log(c.status+' '+label);return c;
}
