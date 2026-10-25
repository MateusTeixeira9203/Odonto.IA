// Small final-commit QA: two negative calls and two normal saves. Never replay.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {chromium} from '@playwright/test';
import {createClient} from '@supabase/supabase-js';
import {contexto,exigirHostQa} from '../../scripts/qa/_lib.mjs';
assert.equal(process.env.INICIO_SEC_B1_FINAL_READY,'2c6eeff');
const snapshotDir=path.resolve('../Odonto.IA-qa3-depois');
const commit=execFileSync('git',['rev-parse','HEAD'],{cwd:snapshotDir,encoding:'utf8'}).trim();assert(commit.startsWith('2c6eeff'));
const ctx=await contexto(snapshotDir),host=exigirHostQa(ctx.env.NEXT_PUBLIC_SUPABASE_URL).hostname;
const base='http://localhost:3015';
const file='C:/Users/mateu/Desktop/Nex Lab/Projetos/Odonto-IA/log/QA-OD-005b-inicio-2026-10-24-evidencias/final-2c6eeff/sec-b1-curto.json';
assert(!fs.existsSync(file),'Do not replay: evidence exists');
const e={commit,host,base,started:new Date().toISOString(),fixtures:[],cases:[]};
const save=()=>fs.writeFileSync(file,JSON.stringify(e,null,2));save();
const db=createClient(ctx.env.NEXT_PUBLIC_SUPABASE_URL,ctx.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:(input,init)=>{assert.equal(new URL(input instanceof Request?input.url:String(input)).hostname,host);assert(['GET','HEAD'].includes((init?.method??'GET').toUpperCase()));return fetch(input,init);}}});
async function rows(q){const r=await q;assert(!r.error,r.error?.message);return r.data;}
async function state(f){
  const fichas=await rows(db.from('fichas').select('*').eq('paciente_id',f.patientId).order('id'));
  const [atendimentos_clinicos,odontograma_eventos,ficha_evolucoes]=await Promise.all([
    rows(db.from('atendimentos_clinicos').select('*').eq('paciente_id',f.patientId).order('id')),
    rows(db.from('odontograma_eventos').select('*').eq('paciente_id',f.patientId).order('id')),
    fichas.length?rows(db.from('ficha_evolucoes').select('*').in('ficha_id',fichas.map(x=>x.id)).order('id')):[],
  ]);
  const atendimento_eventos=atendimentos_clinicos.length?await rows(db.from('atendimento_eventos').select('*').in('atendimento_id',atendimentos_clinicos.map(x=>x.id)).order('atendimento_id').order('evento_id').order('papel')):[];
  return Object.fromEntries(Object.entries({atendimentos_clinicos,fichas,ficha_evolucoes,odontograma_eventos,atendimento_eventos}).map(([table,data])=>[table,{count:data.length,hash:createHash('sha256').update(JSON.stringify(data)).digest('hex'),ids:data.map(x=>x.id??`${x.atendimento_id}:${x.evento_id}:${x.papel}`)}]));
}
const browser=await chromium.launch({channel:'msedge',headless:true});const sessions={};
try{
  for(const [role,email]of [['ANA','dentista.a.r140@example.invalid'],['BRUNO','dentista.b.r140@example.invalid']]){
    const account=ctx.accounts.contas.find(c=>c.email===email);assert(account);
    const context=await browser.newContext(),page=await context.newPage();
    await page.goto(base+'/login');await page.waitForFunction(()=>{const f=document.querySelector('form');return f&&Object.keys(f).some(k=>k.startsWith('__reactProps')&&typeof Reflect.get(f,k).onSubmit==='function');});
    await page.locator('input[type=email]').fill(email);await page.locator('input[type=password]').fill(account.senha);await page.locator('button[type=submit]').click();await page.waitForURL(u=>u.pathname.startsWith('/dashboard'),{timeout:60000});
    sessions[role]={page};
    if(role==='ANA'){
      const client=createClient(ctx.env.NEXT_PUBLIC_SUPABASE_URL,ctx.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
      const auth=await client.auth.signInWithPassword({email,password:account.senha});assert(!auth.error);
      const u=await rows(client.from('users').select('active_clinica_id').eq('id',auth.data.user.id).single());
      const d=await rows(client.from('dentistas').select('id').eq('user_id',auth.data.user.id).eq('clinica_id',u.active_clinica_id).single());
      for(const label of ['visita','ficha']){
        const f={label,patientId:randomUUID(),slotId:randomUUID(),clinicId:u.active_clinica_id};e.fixtures.push(f);save();
        let r=await client.from('pacientes').insert({id:f.patientId,clinica_id:f.clinicId,dentista_id:d.id,nome:'QA INICIO3 FINAL SEC-B1 '+label+' '+Date.now()});assert(!r.error,r.error?.message);
        r=await client.from('agendamentos').insert({id:f.slotId,clinica_id:f.clinicId,dentista_id:d.id,paciente_id:f.patientId,data_hora:new Date().toISOString(),duracao_minutos:15,status:'scheduled',observacoes:'QA FINAL SEC-B1 sintético',created_by:d.id});assert(!r.error,r.error?.message);
        f.initial=await state(f);save();
      }
    }
  }
  const ana=sessions.ANA.page;
  await ana.goto(base+'/dashboard/meu-dia');await ana.getByRole('heading',{name:'Meu Dia',exact:true}).waitFor({timeout:60000});
  await ana.goto(base+'/dashboard/pacientes/'+e.fixtures[0].patientId);await ana.getByRole('tab',{name:'Prontuário',exact:true}).waitFor({timeout:60000});
  const manifest=JSON.parse(fs.readFileSync(path.join(snapshotDir,'.next/dev/server/server-reference-manifest.json'),'utf8'));
  for(const [label,action]of [['visita','salvarVisitaMeuDia'],['ficha','salvarFicha']]){
    const f=e.fixtures.find(f=>f.label===label);
    const data=action==='salvarVisitaMeuDia'?{visitaKey:randomUUID(),pacienteId:f.patientId,agendamentoId:f.slotId,textoVisita:'QA FINAL SEC-B1 registro sintético',eventosDraft:[],alertaNovo:null,ortoManutencao:null,destinoNovos:{fichaId:null}}:{pacienteId:f.patientId,origem:'manual',dataAtendimento:'2026-10-24',queixaPrincipal:'',anotacoes:'QA FINAL SEC-B1 ficha sintética',dentesAfetados:[],dentesObservacoes:{},procedimentos:[],conduta:''};
    const id=Object.entries(manifest.node).find(([,v])=>v.exportedName===action)?.[0];assert(id);
    for(const role of ['BRUNO','ANA']){
      const c={role,action,payload:data,before:await state(f),status:'INCONCLUSIVO',sent:true};e.cases.push(c);save();
      const target=action==='salvarVisitaMeuDia'?'/dashboard/meu-dia':'/dashboard/pacientes/'+f.patientId;
      const response=await sessions[role].page.request.post(base+target,{headers:{'next-action':id,'content-type':'text/plain;charset=UTF-8',accept:'text/x-component',origin:base},data:JSON.stringify([data]),maxRedirects:0,timeout:60000});
      c.http=response.status();const text=await response.text();const line=text.split('\n').find(l=>/^\d+:\{"ok":/.test(l));assert(line,'No action result');
      c.result=JSON.parse(line.slice(line.indexOf(':')+1),(_k,v)=>v==='$undefined'?undefined:v);c.after=await state(f);save();
      if(role==='BRUNO'){assert.equal(c.result.ok,false);assert.equal(c.result.error,'Registro nao encontrado.');assert.deepEqual(c.after,c.before);}
      else{
        assert(c.result.ok&&!c.result.eventosFalharam);
        c.persisted=await rows(db.from('fichas').select('id,clinica_id,paciente_id,anotacoes,origem').eq('id',c.result.fichaId).single());
        assert.equal(c.persisted.clinica_id,f.clinicId);assert.equal(c.persisted.paciente_id,f.patientId);
        if(c.result.atendimentoId){c.atendimento=await rows(db.from('atendimentos_clinicos').select('id,clinica_id,paciente_id,estado').eq('id',c.result.atendimentoId).single());assert.equal(c.atendimento.estado,'finalizado');}
      }
      c.status='PASSOU';save();console.log('PASSOU '+role+' '+action);
    }
    await ana.goto(base+'/dashboard/pacientes/'+f.patientId);await ana.getByRole('tab',{name:'Prontuário',exact:true}).click({timeout:60000});
    const text=action==='salvarVisitaMeuDia'?'QA FINAL SEC-B1 registro sintético':'QA FINAL SEC-B1 ficha sintética';
    await ana.getByText(text,{exact:false}).first().waitFor({timeout:15000});await ana.reload();await ana.getByRole('tab',{name:'Prontuário',exact:true}).click({timeout:60000});await ana.getByText(text,{exact:false}).first().waitFor({timeout:15000});
    f.reload='PASSOU';f.final=await state(f);save();
  }
  e.finished=new Date().toISOString();save();
}catch(error){e.error=error.message;save();console.error('FALHOU/INCONCLUSIVO '+error.message);process.exitCode=1;}
finally{await browser.close();save();console.log('Evidence: '+file);}
