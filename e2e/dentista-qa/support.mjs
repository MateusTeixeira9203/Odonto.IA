import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
import {test,expect} from '@playwright/test';
import {contexto,exigirHostQa,mascarar,registros,validarPorta} from '../../scripts/qa/_lib.mjs';
import {collectInventory} from './inventory.mjs';
export {test,expect};
export const root=path.resolve(import.meta.dirname,'../..');
export let runtime,commit,base,dir,ctx,host,db;
let lockedConfig;
export const namespace='e026da02';
export const id=n=>namespace+'-0000-4000-8000-'+String(n).padStart(12,'0');
export const reception={patient:6,prefix:'QA DENTISTA Recepcao',slot:501,event:306,ficha:106};
function configuration(){
 const snapshot=process.env.DENTISTA_QA_SNAPSHOT;
 assert.match(snapshot??'',/^dentista[a-z0-9-]{0,12}$/,'DENTISTA_QA_SNAPSHOT deve identificar snapshot local');
 const sha=process.env.DENTISTA_QA_COMMIT;
 assert.match(sha??'',/^[a-f0-9]{40}$/,'DENTISTA_QA_COMMIT deve ser o SHA completo aprovado');
 const port=validarPorta(process.env.DENTISTA_QA_PORT);
 assert(path.isAbsolute(process.env.DENTISTA_QA_EVIDENCE_DIR??''),'DENTISTA_QA_EVIDENCE_DIR absoluto obrigatorio');
 return {snapshot,commit:sha,port,runtime:path.resolve(root,'../'+path.basename(root)+'-'+snapshot),base:'http://localhost:'+port,dir:path.resolve(process.env.DENTISTA_QA_EVIDENCE_DIR)};
}
export function guard(write=false){
 const config=configuration();
 assert.equal(process.env.DENTISTA_QA_READY,config.commit.slice(0,7)+'-odonto-qa','opt-in obrigatorio por versao');
 if(write)assert.equal(process.env.DENTISTA_QA_WRITE,'OWN-e026da02','Escrita so na faixa nova e026da02');
 if(lockedConfig)assert.deepEqual(config,lockedConfig,'Configuracao do snapshot mudou durante a rodada');
 assert.equal(execFileSync('git',['rev-parse','HEAD'],{cwd:config.runtime,encoding:'utf8'}).trim(),config.commit);
 assert.equal(execFileSync('git',['status','--porcelain','--untracked-files=all','--','src'],{cwd:config.runtime,encoding:'utf8'}).trim(),'','src do snapshot deve estar limpa, inclusive arquivos novos');
 const record=registros().find(r=>r.porta===config.port);
 assert.equal(record?.nome,config.snapshot,'Porta deve estar registrada para este snapshot');
 assert.equal(record?.commit,config.commit,'Porta deve servir o commit aprovado');
 if(ctx)assert.equal(exigirHostQa(ctx.env.NEXT_PUBLIC_SUPABASE_URL).hostname,'uhuxteswtvgdnlixwrdu.supabase.co');
 lockedConfig??=config;
 ({runtime,commit,base,dir}=config);
}
export async function initialize(write=false){
 guard(write);
 if(ctx)return;
 const loaded=await contexto(runtime),qaHost=exigirHostQa(loaded.env.NEXT_PUBLIC_SUPABASE_URL).hostname;
 assert.equal(qaHost,'uhuxteswtvgdnlixwrdu.supabase.co');
 // Nenhum ambiente, cliente, mkdir ou comando e carregado no import/--list.
 fs.mkdirSync(dir,{recursive:true});
 const observer=createClient(loaded.env.NEXT_PUBLIC_SUPABASE_URL,loaded.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:fetchQa(true)}});
 ctx=loaded;host=qaHost;db=observer;
}
export const clinic='b0000000-0000-4000-8000-000000000001',ana='b0000000-0000-4000-8000-0000000000a1';
export const names={1:'QA DENTISTA Novo',2:'QA DENTISTA Antigo',3:'QA DENTISTA Sem responsavel',4:'QA DENTISTA Varias fichas',5:'QA DENTISTA Dia',6:'QA DENTISTA Recepcao',7:'QA DENTISTA Assinada',8:'QA DENTISTA Orcamento',9:'QA DENTISTA Recepcao RT3a',10:'QA DENTISTA Toque'};
for(const n of Object.keys(names))names[n]+=' FINAL02';
export const fetchQa=(readOnly=false)=>(input,init)=>{assert.equal(new URL(input instanceof Request?input.url:String(input)).hostname,host);if(readOnly)assert(['GET','HEAD'].includes((init?.method??'GET').toUpperCase()));return fetch(input,init);};
export const rows=async q=>{const r=await q;if(r.error)throw Error(r.error.code+' '+r.error.message);return r.data;};
export const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const accounts={ANA:'dentista.a.r140@example.invalid',SARA:'secretaria.a.auditoria@example.invalid',BRUNO:'dentista.b.r140@example.invalid',ADMIN:'admin.a.auditoria@example.invalid',PROTETICO:'protetico.a.qa@example.invalid'};
const guardedContexts=new WeakSet();
export async function blockBrowser(context){
 if(guardedContexts.has(context))return;
 await context.route('**/*',route=>{
  const u=new URL(route.request().url());
  if(['data:','blob:','about:'].includes(u.protocol))return route.continue();
  if(u.origin===base||u.origin==='https://'+host)return route.continue();
  return route.abort();
 });
 guardedContexts.add(context);
}
export async function login(page,role='ANA'){

 await initialize();const a=ctx.accounts.contas.find(a=>a.email===accounts[role]);assert(a);await blockBrowser(page.context());
 await page.goto(base+'/login');await page.waitForFunction(()=>{const f=document.querySelector('form');return f&&Object.keys(f).some(k=>k.startsWith('__reactProps')&&typeof Reflect.get(f,k).onSubmit==='function');});
 try{await page.locator('input[type=email]').fill(a.email);await page.locator('input[type=password]').fill(a.senha);await page.locator('button[type=submit]').click();await page.waitForURL(u=>u.pathname.startsWith('/dashboard'),{timeout:60000});}catch{throw Error('Login QA nao concluiu; credenciais omitidas');}
}
export async function auth(role='ANA'){await initialize();const a=ctx.accounts.contas.find(a=>a.email===accounts[role]);assert(a);const client=createClient(ctx.env.NEXT_PUBLIC_SUPABASE_URL,ctx.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:fetchQa()}});const r=await client.auth.signInWithPassword({email:a.email,password:a.senha});assert(!r.error,'Auth QA falhou');return client;}
export async function capture(page,label){if(new URL(page.url()).pathname==='/login')return;fs.writeFileSync(path.join(dir,label+'.txt'),mascarar(await page.locator('body').innerText(),ctx.segredos));await page.screenshot({path:path.join(dir,label+'.png'),animations:'disabled'});}
export async function patient(page,n,tab='Prontuário'){await page.goto(base+'/dashboard/pacientes/'+id(n));if(tab)await page.getByRole('tab',{name:tab,exact:true}).click();}
export async function openFicha(page,n,ficha){
 await patient(page,n);const f=await rows(db.from('fichas').select('*').eq('id',ficha).single());let buttons;
 if(f.nome){buttons=page.getByRole('button',{name:new RegExp('^Abrir ficha.*'+f.nome)});}else{
  const evol=await rows(db.from('ficha_evolucoes').select('texto').eq('ficha_id',ficha).order('created_at',{ascending:false}));const marker=evol.find(x=>x.texto)?.texto??f.anotacoes;
  buttons=marker?page.locator('ol > li').filter({hasText:marker}).getByRole('button',{name:/^Abrir ficha/}):page.getByRole('button',{name:/^Abrir ficha/});
 }
 await expect(buttons).toHaveCount(1);await buttons.click();await page.getByRole('region',{name:'Ficha aberta no prontuário',exact:true}).waitFor();
}
export async function inventory(){await initialize();return collectInventory({root,dir,patients:Object.keys(names).map(Number).map(id),clinicId:clinic,patientNames:Object.values(names),secrets:ctx.segredos});}
export function suite(){test.describe.configure({timeout:120000,retries:0});test.beforeAll(async()=>{await initialize();});test.beforeEach(async({page})=>{guard();await blockBrowser(page.context());page.setDefaultTimeout(15000);page.setDefaultNavigationTimeout(60000);page.on('pageerror',error=>fs.appendFileSync(path.join(dir,'pageerrors.log'),mascarar(error.message,ctx.segredos)+'\n'));});test.afterEach(async({page},info)=>{if(!ctx)return;const label=info.title.replace(/[^a-z0-9-]/gi,'_').slice(0,120)+'-'+Date.now();try{await capture(page,label);}catch{/* Login e pagina fechada nao sao capturados. */}let hookError;try{await inventory();guard();}catch(error){hookError=error;}const status=hookError?'FALHOU':info.status==='passed'?'PASSOU':info.status==='skipped'?'PULOU':'FALHOU';fs.appendFileSync(path.join(dir,'resultados.jsonl'),JSON.stringify({scenario:info.title,status,error:mascarar([info.error?.message,hookError?.message].filter(Boolean).join('\n'),ctx.segredos),hookError:hookError?true:undefined,evidence:label,at:new Date().toISOString()})+'\n');if(hookError)throw hookError;});}
export async function draw(page,canvas){await expect(canvas).toBeVisible();const b=await canvas.boundingBox();assert(b&&b.width>0);await page.mouse.move(b.x+30,b.y+b.height/2);await page.mouse.down();for(let i=1;i<20;i++)await page.mouse.move(b.x+30+i*5,b.y+b.height/2+Math.sin(i)*15);await page.mouse.up();}
