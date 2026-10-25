// OD-015 M3 directed QA. No migrations, production, cleanup or automatic replay.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {chromium,expect} from '@playwright/test';
import {createClient} from '@supabase/supabase-js';
import {contexto,exigirHostQa,mascarar} from '../../scripts/qa/_lib.mjs';
assert.equal(process.env.OD015M3B_READY,'1cec17f-M3b-APLICADA');
execFileSync('git',['merge-base','--is-ancestor','795872d','HEAD']);
const runtimeRoot=path.resolve('../Odonto.IA-m3bqa');
const runtimeHead=execFileSync('git',['rev-parse','HEAD'],{cwd:runtimeRoot,encoding:'utf8'}).trim();assert(runtimeHead.startsWith('1cec17f'));
execFileSync('git',['diff','--exit-code','--','src'],{cwd:runtimeRoot});
const ctx=await contexto(runtimeRoot),host=exigirHostQa(ctx.env.NEXT_PUBLIC_SUPABASE_URL).hostname;
const base='http://localhost:3013',dir='C:/Users/mateu/Desktop/Nex Lab/Projetos/Odonto-IA/log/QA-OD015M3b-live-1cec17f-2026-10-25';
fs.mkdirSync(dir,{recursive:true});const file=path.join(dir,'evidence.json'),stage=process.argv[2];assert(stage);
const ids={patient:'e0150000-0000-4000-8000-000000000001',EX1:'e0150000-0000-4000-8000-000000000101',EX2:'e0150000-0000-4000-8000-000000000102',ES:'e0150000-0000-4000-8000-000000000104',EC:'e0150000-0000-4000-8000-000000000107',EXO:'e0150000-0000-4000-8000-000000000108',ES_event:'e0150000-0000-4000-8000-000000000303',ES_signature:'e0150000-0000-4000-8000-000000000801',budget:'e0150000-0000-4000-8000-000000000603',extraPatient:'e0150000-0000-4000-8000-000000009001',FR:'e0150000-0000-4000-8000-000000009101',FE:'e0150000-0000-4000-8000-000000009102',RLS:'e0150000-0000-4000-8000-000000009103',rlsBudget:'e0150000-0000-4000-8000-000000009601'};
const qaPatient='e015b300-0000-4000-8000-000000000001',qaName='QA M3b E12 1cec17f',qid=n=>'e015b300-0000-4000-8000-'+String(n).padStart(12,'0');
const e=fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):{base,host,head:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),started:new Date().toISOString(),ids,stages:{},cases:[],identities:[]};
assert(!e.stages[stage],'Do not replay stage');e.stages[stage]={started:new Date().toISOString()};
const save=()=>fs.writeFileSync(file,JSON.stringify(e,null,2));save();
e.resume??={base,runtimeRoot,runtimeHead,started:new Date().toISOString()};
const captureDir=path.join(dir,'snapshot3013');fs.mkdirSync(captureDir,{recursive:true});
const guarded=(readOnly=false)=>(input,init)=>{assert.equal(new URL(input instanceof Request?input.url:String(input)).hostname,host);if(readOnly)assert(['GET','HEAD'].includes((init?.method??'GET').toUpperCase()));return fetch(input,init);};
const db=createClient(ctx.env.NEXT_PUBLIC_SUPABASE_URL,ctx.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:guarded(true)}});
const rows=async q=>{const r=await q;assert(!r.error,r.error?.message);return r.data;};
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const browser=await chromium.launch({channel:'msedge',headless:true}),sessions={};
const emails={ANA:'dentista.a.r140@example.invalid',CARLOS:'dentista.c.auditoria@example.invalid',SARA:'secretaria.a.auditoria@example.invalid',PROTETICO:'protetico.a.qa@example.invalid',BRUNO:'dentista.b.r140@example.invalid',ADMIN:'admin.a.auditoria@example.invalid'};
async function login(role){
 if(sessions[role])return sessions[role];const account=ctx.accounts.contas.find(x=>x.email===emails[role]);assert(account);
 const client=createClient(ctx.env.NEXT_PUBLIC_SUPABASE_URL,ctx.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:guarded()}});
 const auth=await client.auth.signInWithPassword({email:account.email,password:account.senha});assert(!auth.error,'QA Auth failed');
 const user=await rows(client.from('users').select('active_clinica_id').eq('id',auth.data.user.id).single());const d=await rows(db.from('dentistas').select('id,nome,role,clinica_id').eq('user_id',auth.data.user.id).eq('clinica_id',user.active_clinica_id).single());
 const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage();
 await page.route('**/*',route=>{const u=new URL(route.request().url());if(u.hostname.endsWith('.supabase.co')&&u.hostname!==host)return route.abort();return route.continue();});
 await page.goto(base+'/login');await page.waitForFunction(()=>{const f=document.querySelector('form');return f&&Object.keys(f).some(k=>k.startsWith('__reactProps')&&typeof Reflect.get(f,k).onSubmit==='function');});
 await page.locator('input[type=email]').fill(account.email);await page.locator('input[type=password]').fill(account.senha);await page.locator('button[type=submit]').click();await page.waitForURL(u=>u.pathname.startsWith('/dashboard'),{timeout:45000});
 const cookies=await context.cookies();assert(cookies.some(c=>c.name.startsWith('sb-uhuxteswtvgdnlixwrdu-auth-token')));assert(!cookies.some(c=>c.name.includes('zenfemoxvwerplrjgfqz')));
 sessions[role]={client,page,clinicId:d.clinica_id,dentistId:d.id};if(!e.identities.some(x=>x.role===role))e.identities.push({role,...d,qaCookie:true});save();return sessions[role];
}
async function state(){
 const patients=[ids.patient,ids.extraPatient,qaPatient],data={};
 for(const t of ['pacientes','fichas','atendimentos_clinicos','odontograma_eventos','assinaturas','orcamentos','pagamentos','orcamento_cobrancas','documentos_aceite','paciente_documentos','prontuario_exclusoes','prontuario_exclusoes_copias'])data[t]=await rows(db.from(t).select('*').in(t==='pacientes'?'id':'paciente_id',patients).order(t==='prontuario_exclusoes_copias'?'exclusao_id':'id'));
 const fichas=data.fichas.map(f=>f.id),visits=data.atendimentos_clinicos.map(f=>f.id),budgets=data.orcamentos.map(f=>f.id),charges=data.orcamento_cobrancas.map(f=>f.id);
 data.ficha_arquivos=fichas.length?await rows(db.from('ficha_arquivos').select('*').in('ficha_id',fichas).order('id')):[];
 data.ficha_evolucoes=fichas.length?await rows(db.from('ficha_evolucoes').select('*').in('ficha_id',fichas).order('id')):[];
 data.atendimento_eventos=visits.length?await rows(db.from('atendimento_eventos').select('*').in('atendimento_id',visits).order('atendimento_id').order('evento_id').order('papel')):[];
 data.orcamento_itens=budgets.length?await rows(db.from('orcamento_itens').select('*').in('orcamento_id',budgets).order('id')):[];
 data.orcamento_eventos=budgets.length?await rows(db.from('orcamento_eventos').select('*').in('orcamento_id',budgets).order('orcamento_id').order('evento_id').order('item_id')):[];
 data.orcamento_cobranca_itens=charges.length?await rows(db.from('orcamento_cobranca_itens').select('*').in('cobranca_id',charges).order('cobranca_id').order('orcamento_item_id')):[];
 return {tables:Object.fromEntries(Object.entries(data).map(([t,d])=>[t,{count:d.length,hash:hash(d),rows:d}])),permanent:hash({patient:data.pacientes.find(x=>x.id===ids.patient),ficha:data.fichas.find(x=>x.id===ids.ES),event:data.odontograma_eventos.find(x=>x.id===ids.ES_event),signature:data.assinaturas.find(x=>x.id===ids.ES_signature)})};
}
async function action(role,name,args,target='/dashboard/pacientes/'+ids.patient){
 const manifest=JSON.parse(fs.readFileSync(path.join(runtimeRoot,'.next/dev/server/server-reference-manifest.json'),'utf8'));
 const candidates=Object.entries(manifest.node).filter(([,v])=>v.exportedName===name);
 const chunk=fs.readFileSync(path.join(runtimeRoot,'.next/dev/static/chunks/_app-pages-browser_src_components_pacientes_ProntuarioTab_tsx.js'),'utf8');
 const id=(candidates.find(([candidate])=>chunk.includes(candidate))??candidates[0])?.[0];assert(id,'Action not compiled '+name);
 e.activeActionIds??={};e.activeActionIds[name]=id;save();
 const r=await sessions[role].page.request.post(base+target,{headers:{'next-action':id,'content-type':'text/plain;charset=UTF-8',accept:'text/x-component',origin:base},data:JSON.stringify(args),maxRedirects:0,timeout:60000});const text=await r.text();
 const objects=text.split('\n').filter(l=>/^[0-9a-f]+:\{/i.test(l)).map(l=>JSON.parse(l.slice(l.indexOf(':')+1),(_k,v)=>v==='$undefined'?undefined:v));const result=objects.find(x=>Object.hasOwn(x,'ok')||Object.hasOwn(x,'error'));
 if(!result){(e.actionDiagnostics??=[]).push({name,role,id,http:r.status(),body:mascarar(text,ctx.segredos).slice(0,12000)});save();}assert(result,'Missing action result');return {http:r.status(),result};
}
const capture=async(p,label)=>{await p.screenshot({path:path.join(captureDir,label+'.png'),animations:'disabled'});};
async function check(label,run,verify){const c={label,status:'NAO TESTADO',before:await state(),started:new Date().toISOString()};e.cases.push(c);save();try{c.response=await run(c);c.after=await state();assert.equal(c.after.permanent,c.before.permanent,'Permanent ES/patient changed');await verify(c);c.status='PASSOU';}catch(error){c.status='FALHOU';c.failure=error.message;c.after=await state();}save();console.log(c.status+' '+label);return c;}
const confirmation=(extra={})=>({motivo:'aberta_por_engano',nomePaciente:'Paciente Exclusao QA',confirmaOrcamentoAceito:false,...extra});
async function openFicha(p,id,patient=ids.patient){
 await p.goto(base+'/dashboard/pacientes/'+patient);await p.getByRole('tab',{name:'Prontuário',exact:true}).click({timeout:20000});
 const list=await rows(db.from('fichas').select('id,nome').eq('id',id).single());
 const target=p.getByRole('button',{name:new RegExp('^Abrir ficha.*'+list.nome)});await target.first().click({timeout:15000});await p.getByRole('region',{name:'Ficha aberta no prontuário',exact:true}).waitFor({timeout:15000});
}
async function openDelete(p){await p.getByRole('button',{name:'Mais ações da Ficha',exact:true}).click();await p.getByRole('menuitem',{name:'Apagar Ficha',exact:true}).click();return p.getByRole('dialog',{name:'Apagar esta ficha?',exact:true});}
async function fillDialog(d,{name='Paciente Exclusao QA',motivo='aberta_por_engano',detail}={}){await d.getByRole('combobox').selectOption(motivo);if(detail!==undefined)await d.getByRole('textbox',{name:'Descreva em poucas palavras, sem dados clínicos',exact:true}).fill(detail);await d.getByRole('textbox',{name:/Para confirmar, digite o nome do paciente/}).fill(name);}

try { const {run}=await import('./od015m3b-cases.mjs'); await run(stage,{assert,fs,path,expect,e,save,ids,db,rows,hash,login,sessions,state,action,capture,check,confirmation,openFicha,openDelete,fillDialog,base,dir,runtimeRoot,runtimeHead,ctx,qaPatient,qaName,qid});e.stages[stage].finished=new Date().toISOString();save(); } catch(error){e.stages[stage].error=error.message;save();console.error('INTERRUPCAO '+mascarar(error.message,ctx.segredos));process.exitCode=1;} finally {await browser.close();save();}
