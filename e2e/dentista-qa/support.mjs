import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
import {test,expect} from '@playwright/test';
import {contexto,exigirHostQa,mascarar} from '../../scripts/qa/_lib.mjs';
export {test,expect};
const snapshot=process.env.DENTISTA_QA_SNAPSHOT??'baseline';
const configs={baseline:{name:'dentistaqa',ref:'3d14edb',port:3012},embeds69:{name:'dentistareteste',ref:'69b5dde',port:3014},rec3a:{name:'dentistarec',ref:'3a45088',port:3016}};
if(snapshot==='final'){assert(/^[a-f0-9]{7,40}$/.test(process.env.DENTISTA_QA_FINAL_COMMIT??''),'Commit final explicito obrigatorio');configs.final={name:'dentistafinal',ref:process.env.DENTISTA_QA_FINAL_COMMIT,port:3012};}
assert(Object.hasOwn(configs,snapshot),'Snapshot nao autorizado');const config=configs[snapshot],reteste=snapshot==='embeds69';
export const runtime=path.resolve('../Odonto.IA-'+config.name),base='http://localhost:'+config.port,commit=execFileSync('git',['rev-parse',config.ref+'^{commit}'],{encoding:'utf8'}).trim();
export const dir='C:/Users/mateu/Desktop/Nex Lab/Projetos/Odonto-IA/log/QA-DENTISTA-3d14edb-2026-10-25'+(snapshot==='baseline'?'':'/reteste-'+config.ref);
export const reception=snapshot==='rec3a'?{patient:9,prefix:'QA DENTISTA Recepcao RT3a',slot:601,event:309,ficha:109}:{patient:6,prefix:'QA DENTISTA Recepcao',slot:501,event:306,ficha:106};
export function guard(write=false){assert.equal(process.env.DENTISTA_QA_READY,'3d14edb-QA');assert.equal(execFileSync('git',['rev-parse','HEAD'],{cwd:runtime,encoding:'utf8'}).trim(),commit);execFileSync('git',['diff','--exit-code','--','src'],{cwd:runtime});if(write){assert(!reteste,'Reteste embeds e somente leitura');assert.equal(process.env.DENTISTA_QA_WRITE,snapshot==='final'?'OWN-e026da01':'OWN-e026da00');}}
export const ctx=await contexto(runtime),host=exigirHostQa(ctx.env.NEXT_PUBLIC_SUPABASE_URL).hostname;
assert.equal(host,'uhuxteswtvgdnlixwrdu.supabase.co');
export const namespace=snapshot==='final'?'e026da01':'e026da00';
export const id=n=>namespace+'-0000-4000-8000-'+String(n).padStart(12,'0');
export const clinic='b0000000-0000-4000-8000-000000000001',ana='b0000000-0000-4000-8000-0000000000a1';
export const names={1:'QA DENTISTA Novo',2:'QA DENTISTA Antigo',3:'QA DENTISTA Sem responsavel',4:'QA DENTISTA Varias fichas',5:'QA DENTISTA Dia',6:'QA DENTISTA Recepcao',7:'QA DENTISTA Assinada',8:'QA DENTISTA Orcamento',9:'QA DENTISTA Recepcao RT3a',10:'QA DENTISTA Toque'};
if(snapshot==='final')for(const n of Object.keys(names))names[n]+=' FINAL01';
export const fetchQa=(readOnly=false)=>(input,init)=>{assert.equal(new URL(input instanceof Request?input.url:String(input)).hostname,host);if(readOnly)assert(['GET','HEAD'].includes((init?.method??'GET').toUpperCase()));return fetch(input,init);};
export const db=createClient(ctx.env.NEXT_PUBLIC_SUPABASE_URL,ctx.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:fetchQa(true)}});
export const rows=async q=>{const r=await q;if(r.error)throw Error(r.error.code+' '+r.error.message);return r.data;};
export const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
fs.mkdirSync(dir,{recursive:true});
const accounts={ANA:'dentista.a.r140@example.invalid',SARA:'secretaria.a.auditoria@example.invalid',BRUNO:'dentista.b.r140@example.invalid',ADMIN:'admin.a.auditoria@example.invalid',PROTETICO:'protetico.a.qa@example.invalid'};
export async function login(page,role='ANA'){
 guard();const a=ctx.accounts.contas.find(a=>a.email===accounts[role]);assert(a);await page.route('**/*',route=>{const u=new URL(route.request().url());if(u.hostname.endsWith('.supabase.co')&&u.hostname!==host)return route.abort();return route.continue();});
 await page.goto(base+'/login');await page.waitForFunction(()=>{const f=document.querySelector('form');return f&&Object.keys(f).some(k=>k.startsWith('__reactProps')&&typeof Reflect.get(f,k).onSubmit==='function');});
 try{await page.locator('input[type=email]').fill(a.email);await page.locator('input[type=password]').fill(a.senha);await page.locator('button[type=submit]').click();await page.waitForURL(u=>u.pathname.startsWith('/dashboard'),{timeout:60000});}catch{throw Error('Login QA nao concluiu; credenciais omitidas');}
}
export async function auth(role='ANA'){guard();const a=ctx.accounts.contas.find(a=>a.email===accounts[role]);assert(a);const client=createClient(ctx.env.NEXT_PUBLIC_SUPABASE_URL,ctx.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:fetchQa()}});const r=await client.auth.signInWithPassword({email:a.email,password:a.senha});assert(!r.error,'Auth QA falhou');return client;}
export async function capture(page,label){if(new URL(page.url()).pathname==='/login')return;fs.writeFileSync(path.join(dir,label+'.txt'),mascarar(await page.locator('body').innerText(),ctx.segredos));await page.screenshot({path:path.join(dir,label+'.png'),animations:'disabled'});}
export async function patient(page,n,tab='Prontuário'){await page.goto(base+'/dashboard/pacientes/'+id(n));if(tab)await page.getByRole('tab',{name:tab,exact:true}).click();}
﻿export async function openFicha(page,n,ficha){
 await patient(page,n);const f=await rows(db.from('fichas').select('*').eq('id',ficha).single());let buttons;
 if(f.nome){buttons=page.getByRole('button',{name:new RegExp('^Abrir ficha.*'+f.nome)});}else{
  const evol=await rows(db.from('ficha_evolucoes').select('texto').eq('ficha_id',ficha).order('created_at',{ascending:false}));const marker=evol.find(x=>x.texto)?.texto??f.anotacoes;
  buttons=marker?page.locator('ol > li').filter({hasText:marker}).getByRole('button',{name:/^Abrir ficha/}):page.getByRole('button',{name:/^Abrir ficha/});
 }
 await expect(buttons).toHaveCount(1);await buttons.click();await page.getByRole('region',{name:'Ficha aberta no prontuário',exact:true}).waitFor();
}
export async function inventory(){const data={};const patients=Object.keys(names).map(Number).map(id);for(const t of ['pacientes','fichas','agendamentos','atendimentos_clinicos','odontograma_eventos','assinaturas','orcamentos','pagamentos','orcamento_cobrancas','documentos_aceite','paciente_documentos','prontuario_exclusoes','prontuario_exclusoes_copias'])data[t]=await rows(db.from(t).select('*').in(t==='pacientes'?'id':'paciente_id',patients));const fichaIds=data.fichas.map(x=>x.id),budgetIds=data.orcamentos.map(x=>x.id);data.ficha_evolucoes=fichaIds.length?await rows(db.from('ficha_evolucoes').select('*').in('ficha_id',fichaIds)):[];data.orcamento_itens=budgetIds.length?await rows(db.from('orcamento_itens').select('*').in('orcamento_id',budgetIds)):[];fs.writeFileSync(path.join(dir,'inventario-ids-exatos.json'),JSON.stringify(data,null,2));return data;}
export function suite(){test.describe.configure({timeout:120000,retries:0});test.beforeEach(async({page})=>{guard();page.setDefaultTimeout(15000);page.setDefaultNavigationTimeout(60000);page.on('pageerror',error=>fs.appendFileSync(path.join(dir,'pageerrors.log'),mascarar(error.message,ctx.segredos)+'\n'));});test.afterEach(async({page},info)=>{const label=info.title.replace(/[^a-z0-9-]/gi,'_').slice(0,120)+'-'+Date.now();try{await capture(page,label);}catch{/* Login e pagina fechada nao sao capturados. */}const status=info.status==='passed'?'PASSOU':info.status==='skipped'?'PULOU':'FALHOU';fs.appendFileSync(path.join(dir,'resultados.jsonl'),JSON.stringify({scenario:info.title,status,error:mascarar(info.error?.message??'',ctx.segredos),evidence:label,at:new Date().toISOString()})+'\n');await inventory();guard();});}
export async function draw(page,canvas){await expect(canvas).toBeVisible();const b=await canvas.boundingBox();assert(b&&b.width>0);await page.mouse.move(b.x+30,b.y+b.height/2);await page.mouse.down();for(let i=1;i<20;i++)await page.mouse.move(b.x+30+i*5,b.y+b.height/2+Math.sin(i)*15);await page.mouse.up();}

