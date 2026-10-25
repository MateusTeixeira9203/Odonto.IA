// Read-only verification after the single authorized SEC-B1 round. No action POSTs.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {chromium} from '@playwright/test';
import {createClient} from '@supabase/supabase-js';
import {contexto,exigirHostQa} from '../../scripts/qa/_lib.mjs';
const dir='C:/Users/mateu/Desktop/Nex Lab/Projetos/Odonto-IA/log/QA-OD-005b-inicio-2026-10-24-evidencias';
const e=JSON.parse(fs.readFileSync(dir+'/SEC-B1-0c75582-reteste.json','utf8'));
const ctx=await contexto('C:/Users/mateu/Desktop/Projetos clone/Odonto.IA-qa3-depois');
const host=exigirHostQa(ctx.env.NEXT_PUBLIC_SUPABASE_URL).hostname;
const db=createClient(ctx.env.NEXT_PUBLIC_SUPABASE_URL,ctx.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:(input,init)=>{assert.equal(new URL(input instanceof Request?input.url:String(input)).hostname,host);assert(['GET','HEAD'].includes((init?.method??'GET').toUpperCase()));return fetch(input,init);}}});
async function rows(query){const r=await query;assert(!r.error,r.error?.message);return r.data;}
const result={host,commit:e.commit,time:new Date().toISOString(),fixtures:[],reload:[],identities:[]};
const save=()=>fs.writeFileSync(dir+'/SEC-B1-0c75582-verificacao.json',JSON.stringify(result,null,2));
for(const email of ['dentista.a.r140@example.invalid','dentista.b.r140@example.invalid','secretaria.a.auditoria@example.invalid','protetico.a.qa@example.invalid']){
  const u=await rows(db.from('users').select('id,active_clinica_id').eq('email',email).single());
  const membership=await rows(db.from('clinica_usuarios').select('clinica_id,role,status').eq('usuario_id',u.id).eq('clinica_id',u.active_clinica_id));
  result.identities.push({label:email.split('@')[0],...u,membership});save();
}
for(const f of e.fixtures){
  const docs=await rows(db.from('fichas').select('*').eq('paciente_id',f.patientId).order('id'));
  const atd=await rows(db.from('atendimentos_clinicos').select('*').eq('paciente_id',f.patientId).order('id'));
  const ev=await rows(db.from('odontograma_eventos').select('*').eq('paciente_id',f.patientId).order('id'));
  const evol=docs.length?await rows(db.from('ficha_evolucoes').select('*').in('ficha_id',docs.map(d=>d.id)).order('id')):[];
  const links=atd.length?await rows(db.from('atendimento_eventos').select('*').in('atendimento_id',atd.map(a=>a.id)).order('atendimento_id').order('evento_id').order('papel')):[];
  const tables={atendimentos_clinicos:atd,fichas:docs,ficha_evolucoes:evol,odontograma_eventos:ev,atendimento_eventos:links};
  for(const [table,data] of Object.entries(tables))assert.equal(createHash('sha256').update(JSON.stringify(data)).digest('hex'),f.final[table].hash,f.label+' '+table+' changed');
  const slot=await rows(db.from('agendamentos').select('id,paciente_id,clinica_id,status').eq('id',f.slotId).single());
  result.fixtures.push({label:f.label,patientId:f.patientId,slot,stable:true,tables});save();
}
const partial=result.fixtures.find(f=>f.label==='A-caso-B');
assert.equal(partial.tables.atendimentos_clinicos[0].estado,'preparando');
assert.equal(partial.tables.odontograma_eventos.length,0);assert.equal(partial.tables.atendimento_eventos.length,0);
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
  const page=await browser.newPage();const account=ctx.accounts.contas.find(c=>c.email==='dentista.a.r140@example.invalid');
  await page.goto('http://localhost:3015/login');
  await page.waitForFunction(()=>{const f=document.querySelector('form');return f&&Object.keys(f).some(k=>k.startsWith('__reactProps')&&typeof Reflect.get(f,k).onSubmit==='function');});
  await page.locator('input[type=email]').fill(account.email);await page.locator('input[type=password]').fill(account.senha);await page.locator('button[type=submit]').click();
  await page.waitForURL(u=>u.pathname.startsWith('/dashboard'),{timeout:60000});
  for(const [label,text]of [['A-guardas','QA SEC-B1 edição normal persistida'],['A-normal-Meu Dia','QA SEC-B1 registro sintético autorizado'],['A-normal-Prontuario','QA SEC-B1 registro sintético autorizado'],['A-normal-Word','QA SEC-B1 histórico sintético autorizado']]){
    const f=e.fixtures.find(f=>f.label===label);const rec={label,patientId:f.patientId,status:'INCONCLUSIVO'};result.reload.push(rec);save();
    await page.goto('http://localhost:3015/dashboard/pacientes/'+f.patientId);
    await page.getByRole('tab',{name:'Prontuário',exact:true}).click({timeout:60000});
    await page.getByText(text,{exact:false}).first().waitFor({timeout:15000});
    await page.reload();await page.getByRole('tab',{name:'Prontuário',exact:true}).click({timeout:60000});
    await page.getByText(text,{exact:false}).first().waitFor({timeout:15000});
    rec.status='PASSOU';save();console.log('PASSOU recarga '+label);
  }
}catch(error){result.browserError=error.message;save();console.log('INCONCLUSIVO browser '+error.message);process.exitCode=1;}
finally{await browser.close();save();}
console.log('SELECT: seven fixture hashes stable, partial visit preparando; no cross-link');
