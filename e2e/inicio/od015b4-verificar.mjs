// Fresh authenticated reads and UI reloads only; no clinical POST/confirm action.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {chromium} from '@playwright/test';
import {createClient} from '@supabase/supabase-js';
import {contexto,exigirHostQa} from '../../scripts/qa/_lib.mjs';
assert.equal(process.env.INICIO_B4_AUTH_READY,'working-tree-3000');
const ctx=await contexto();exigirHostQa(ctx.env.NEXT_PUBLIC_SUPABASE_URL);
const dir='C:/Users/mateu/Desktop/Nex Lab/Projetos/Odonto-IA/log/QA-OD-005b-inicio-2026-10-24-evidencias/od015b4-auth';
const e=JSON.parse(fs.readFileSync(dir+'/b4-auth.json','utf8'));assert(e.finished&&!e.interrupted);assert(e.cases.every(c=>c.status==='PASSOU'));
const a=ctx.accounts.contas.find(c=>c.email==='dentista.a.r140@example.invalid');assert(a);
const client=createClient(ctx.env.NEXT_PUBLIC_SUPABASE_URL,ctx.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const login=await client.auth.signInWithPassword({email:a.email,password:a.senha});assert(!login.error);
const v={time:new Date().toISOString(),base:e.base,readOnly:true,sourceStillSame:Object.entries(e.sourceBefore).every(([p,h])=>createHash('sha256').update(fs.readFileSync(p)).digest('hex')===h),fixtures:[],orders:[]};
const save=()=>fs.writeFileSync(dir+'/b4-recarga-auth.json',JSON.stringify(v,null,2));save();assert(v.sourceStillSame);
for(const f of e.fixtures.filter(f=>f.label.startsWith('misto'))){assert.deepEqual(f.observedOrder.map(r=>r.id),f.insertOrder);v.orders.push({label:f.label,insertOrder:f.insertOrder,observedOrder:f.observedOrder});}
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}});
 await page.goto(e.base+'/login');await page.waitForFunction(()=>{const f=document.querySelector('form');return f&&Object.keys(f).some(k=>k.startsWith('__reactProps')&&typeof Reflect.get(f,k).onSubmit==='function');});
 await page.locator('input[type=email]').fill(a.email);await page.locator('input[type=password]').fill(a.senha);await page.locator('button[type=submit]').click();await page.waitForURL(u=>u.pathname.startsWith('/dashboard'),{timeout:60000});
 for(const f of e.fixtures){
  const r=await client.from('fichas').select('*').eq('paciente_id',f.patientId).order('id');assert(!r.error,r.error?.message);
  assert.equal(createHash('sha256').update(JSON.stringify(r.data)).digest('hex'),f.final.fichas.hash,'Fichas changed or Auth read incomplete '+f.label);
  const ev=await client.from('odontograma_eventos').select('*').eq('paciente_id',f.patientId).order('id');assert(!ev.error,ev.error?.message);
  // Old SELECT policy may intentionally hide a legacy-signed empty fiche's events; it has none.
  assert.equal(createHash('sha256').update(JSON.stringify(ev.data)).digest('hex'),f.final.odontograma_eventos.hash,'Event persistence/Auth read '+f.label);
  const s=await client.from('assinaturas').select('*').eq('paciente_id',f.patientId).order('id');assert(!s.error,s.error?.message);
  assert.equal(createHash('sha256').update(JSON.stringify(s.data)).digest('hex'),f.final.assinaturas.hash,'Signature persistence/Auth read '+f.label);
  const rec={label:f.label,patientId:f.patientId,status:'PASSOU Auth reload',fichas:r.data.map(x=>({id:x.id,assinado_em:x.assinado_em,assinatura_url:x.assinatura_url})),events:ev.data.map(x=>({id:x.id,assinatura_id:x.assinatura_id,encaminhado_para:x.encaminhado_para})),signatures:s.data.map(x=>({id:x.id,dentista_id:x.dentista_id,cro_no_ato:x.cro_no_ato,assinado_em:x.assinado_em,assinatura_ref:x.assinatura_ref}))};v.fixtures.push(rec);save();
  if(['Ana-unico','misto-Ana-primeiro','misto-Carlos-primeiro','vazia-legado'].includes(f.label)){
   await page.goto(e.base+'/dashboard/pacientes/'+f.patientId);await page.getByRole('tab',{name:'Prontuário',exact:true}).click({timeout:60000});await page.getByRole('button',{name:/Abrir ficha/}).first().waitFor({timeout:60000});
   await page.reload();await page.getByRole('tab',{name:'Prontuário',exact:true}).click({timeout:60000});await page.getByRole('button',{name:/Abrir ficha/}).first().click({timeout:60000});await page.getByRole('region',{name:'Ficha aberta no prontuário',exact:true}).waitFor({timeout:20000});
   rec.uiReload='PASSOU';rec.uiText=await page.getByRole('region',{name:'Ficha aberta no prontuário',exact:true}).innerText();await page.screenshot({path:dir+'/b4-recarga-'+f.label+'.png',animations:'disabled'});save();console.log('PASSOU recarga '+f.label);
  }
 }
 v.finished=new Date().toISOString();save();
}catch(error){v.error=error.message;save();console.error('INCONCLUSIVO reload '+error.message);process.exitCode=1;}
finally{await browser.close();save();}
