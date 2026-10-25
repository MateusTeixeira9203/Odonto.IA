// QA3: opt-in, synthetic fixtures only, one foreign-event attempt, no cleanup.
import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { chromium } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { contexto, exigirHostQa } from '../../scripts/qa/_lib.mjs';

assert.equal(process.env.INICIO_SEC_B1_READY, '0c75582');
const root = process.cwd();
const snapshotDir = path.resolve(root, '../Odonto.IA-qa3-depois');
assert(execFileSync('git', ['rev-parse', 'HEAD'], {cwd:snapshotDir,encoding:'utf8'}).startsWith('0c75582'));
const ctx = await contexto(snapshotDir);
const host = exigirHostQa(ctx.env.NEXT_PUBLIC_SUPABASE_URL).hostname;
const base = 'http://localhost:3015';
const outDir = 'C:/Users/mateu/Desktop/Nex Lab/Projetos/Odonto-IA/log/QA-OD-005b-inicio-2026-10-24-evidencias';
const out = path.join(outDir, 'SEC-B1-0c75582-reteste.json');
const resume=process.env.INICIO_SEC_B1_RESUME==='read-recover';
assert(!fs.existsSync(out)||resume, 'Evidence already exists: do not repeat automatically');
const evidence = resume?JSON.parse(fs.readFileSync(out,'utf8')):{commit:'0c7558251308cb31c6628a3d0e49f30764773239',host,base,started:new Date().toISOString(),fixtures:[],cases:[]};
const save = () => fs.writeFileSync(out, JSON.stringify(evidence,null,2));
save();
const db = createClient(ctx.env.NEXT_PUBLIC_SUPABASE_URL,ctx.env.SUPABASE_SERVICE_ROLE_KEY,{
  auth:{persistSession:false,autoRefreshToken:false},global:{fetch:(input,init)=>{
    assert.equal(new URL(input instanceof Request?input.url:String(input)).hostname,host);
    assert(['GET','HEAD'].includes((init?.method??'GET').toUpperCase()));
    return fetch(input,init);
  }},
});
async function rows(query) {const r=await query; assert(!r.error,r.error?.message);return r.data;}
async function snapshot(fixture) {
  const fichas=await rows(db.from('fichas').select('*').eq('paciente_id',fixture.patientId).order('id'));
  const [atendimentos,eventos,evolucoes]=await Promise.all([
    rows(db.from('atendimentos_clinicos').select('*').eq('paciente_id',fixture.patientId).order('id')),
    rows(db.from('odontograma_eventos').select('*').eq('paciente_id',fixture.patientId).order('id')),
    fichas.length?rows(db.from('ficha_evolucoes').select('*').in('ficha_id',fichas.map(f=>f.id)).order('id')):[],
  ]);
  const links=atendimentos.length?await rows(db.from('atendimento_eventos').select('*').in('atendimento_id',atendimentos.map(a=>a.id)).order('atendimento_id').order('evento_id').order('papel')):[];
  return Object.fromEntries(Object.entries({atendimentos_clinicos:atendimentos,fichas,ficha_evolucoes:evolucoes,odontograma_eventos:eventos,atendimento_eventos:links})
    .map(([table,data])=>[table,{count:data.length,hash:createHash('sha256').update(JSON.stringify(data)).digest('hex'),ids:data.map(r=>r.id??`${r.atendimento_id}:${r.evento_id}:${r.papel}`)}]));
}
const roles={ANA:'dentista.a.r140@example.invalid',BRUNO:'dentista.b.r140@example.invalid',SECRETARIA:'secretaria.a.auditoria@example.invalid',PROTETICO:'protetico.a.qa@example.invalid'};
const browser=await chromium.launch({channel:'msedge',headless:true});
const sessions={};
async function login(role) {
  const account=ctx.accounts.contas.find(c=>c.email===roles[role]);assert(account);
  const context=await browser.newContext();const page=await context.newPage();
  await page.route('**/*',route=>{
    const u=new URL(route.request().url());
    if(u.hostname.endsWith('.supabase.co')&&u.hostname!==host)return route.abort();
    return route.continue();
  });
  await page.goto(base+'/login');
  await page.waitForFunction(()=>{const f=document.querySelector('form');return f&&Object.keys(f).some(k=>k.startsWith('__reactProps')&&typeof Reflect.get(f,k).onSubmit==='function');});
  await page.locator('input[type=email]').fill(account.email);
  await page.locator('input[type=password]').fill(account.senha);
  await page.locator('button[type=submit]').click();
  await page.waitForURL(u=>u.pathname.startsWith('/dashboard'),{timeout:60000});
  const client=createClient(ctx.env.NEXT_PUBLIC_SUPABASE_URL,ctx.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
  const auth=await client.auth.signInWithPassword({email:account.email,password:account.senha});assert(!auth.error);
  const user=await rows(client.from('users').select('active_clinica_id').eq('id',auth.data.user.id).single());
  const dentist=await rows(client.from('dentistas').select('id').eq('user_id',auth.data.user.id).eq('clinica_id',user.active_clinica_id).single());
  sessions[role]={page,client,clinicId:user.active_clinica_id,dentistId:dentist.id,userId:auth.data.user.id};
  console.log('LOGIN '+role+' confirmed');return sessions[role];
}
async function fixture(role,label) {
  const previous=evidence.fixtures.find(f=>f.role===role&&f.label===label);if(previous)return previous;
  const s=sessions[role];const f={role,label,patientId:randomUUID(),slotId:randomUUID(),clinicId:s.clinicId,name:'QA INICIO3 SEC-B1 '+label+' '+Date.now()};
  evidence.fixtures.push(f);save();
  let r=await s.client.from('pacientes').insert({id:f.patientId,clinica_id:s.clinicId,dentista_id:s.dentistId,nome:f.name});assert(!r.error,r.error?.message);
  r=await s.client.from('agendamentos').insert({id:f.slotId,clinica_id:s.clinicId,dentista_id:s.dentistId,paciente_id:f.patientId,data_hora:new Date().toISOString(),duracao_minutos:15,status:'scheduled',observacoes:'QA INICIO3 SEC-B1 synthetic',created_by:s.dentistId});assert(!r.error,r.error?.message);
  f.initial=await snapshot(f);save();return f;
}
function actionId(name) {
  const manifest=JSON.parse(fs.readFileSync(path.join(snapshotDir,'.next/dev/server/server-reference-manifest.json'),'utf8'));
  const found=Object.entries(manifest.node).find(([,v])=>v.exportedName===name)?.[0];assert(found,'Action not compiled: '+name);return found;
}
async function call(role,action,payload) {
  const target=action==='salvarVisitaMeuDia'?'/dashboard/meu-dia':'/dashboard/pacientes/'+payload.pacienteId;
  const response=await sessions[role].page.request.post(base+target,{headers:{'next-action':actionId(action),'content-type':'text/plain;charset=UTF-8',accept:'text/x-component',origin:base},data:JSON.stringify([payload]),maxRedirects:0,timeout:90000});
  const text=await response.text();
  const line=text.split('\n').find(l=>/^\d+:\{"ok":/.test(l));
  return {http:response.status(),result:line?JSON.parse(line.slice(line.indexOf(':')+1),(_k,v)=>v==='$undefined'?undefined:v):{transportError:true,redirect:text.includes('NEXT_REDIRECT'),digest:text.match(/"digest":"([^"]+)"/)?.[1]??null}};
}
const visit=f=>({visitaKey:randomUUID(),pacienteId:f.patientId,agendamentoId:f.slotId,textoVisita:'QA SEC-B1 registro sintético autorizado',eventosDraft:[],alertaNovo:null,ortoManutencao:null,destinoNovos:{fichaId:null}});
const ficha=f=>({pacienteId:f.patientId,origem:'manual',dataAtendimento:'2026-10-24',queixaPrincipal:'QA sintético',anotacoes:'QA SEC-B1 ficha sintética',dentesAfetados:[],dentesObservacoes:{},procedimentos:[],conduta:''});
const word=f=>({pacienteId:f.patientId,dataAtendimento:'2026-10-24',texto:'QA SEC-B1 histórico sintético autorizado'});
async function check(label,role,action,payload,f,expected) {
  const previous=evidence.cases.find(c=>c.label===label&&c.role===role&&c.action===action);
  if(previous){
    if(expected==='normal'&&previous.result.ok&&previous.result.eventosFalharam==='$undefined'){
      const persisted=await rows(db.from('fichas').select('id,clinica_id,paciente_id,origem,anotacoes').eq('id',previous.result.fichaId??payload.fichaId).single());
      previous.persisted=persisted;previous.status=persisted.clinica_id===f.clinicId&&persisted.paciente_id===f.patientId?'PASSOU':'FALHOU';
      previous.harnessNote='React Flight $undefined decoded; no repeat write';save();
    }
    return previous;
  }
  if(resume&&label==='Ana x A Meu Dia'){
    const recovered=await rows(db.from('atendimentos_clinicos').select('*').eq('paciente_id',f.patientId));
    assert.equal(recovered.length,1,'Recover exact prior visit without replay');
    const docs=await rows(db.from('fichas').select('*').eq('paciente_id',f.patientId));assert.equal(docs.length,1);
    const c={label,role,action,result:{ok:true,atendimentoId:recovered[0].id,fichaId:docs[0].id},status:recovered[0].estado==='finalizado'&&docs[0].clinica_id===f.clinicId?'PASSOU':'FALHOU',before:f.initial,after:await snapshot(f),persisted:docs[0],atendimento:recovered[0],harnessNote:'Prior HTTP result not retained after observer failure; persisted result recovered by SELECT; save not replayed'};
    evidence.cases.push(c);save();console.log(c.status+' '+label+' recovered read-only');return c;
  }
  const before=await snapshot(f);const answer=await call(role,action,payload);const after=await snapshot(f);
  const c={label,role,action,payload,before,...answer,after,status:'INCONCLUSIVO'};
  evidence.cases.push(c);save();
  if(expected==='normal') {
    c.status=answer.http===200&&answer.result.ok===true&&!answer.result.eventosFalharam?'PASSOU':'FALHOU';
    if(c.status==='PASSOU'){
      const id=answer.result.fichaId??payload.fichaId;
      const persisted=await rows(db.from('fichas').select('id,clinica_id,paciente_id,origem,anotacoes').eq('id',id).single());
      c.persisted=persisted;
      if(persisted.clinica_id!==f.clinicId||persisted.paciente_id!==f.patientId)c.status='FALHOU';
      if(answer.result.atendimentoId)c.atendimento=await rows(db.from('atendimentos_clinicos').select('id,clinica_id,paciente_id,estado,origem').eq('id',answer.result.atendimentoId).single());
    }
  } else {
    const unchanged=JSON.stringify(before)===JSON.stringify(after);
    c.zeroWrite=unchanged;
    const denied=answer.result.ok===false&&(expected==='foreign'?answer.result.error==='Registro nao encontrado.':true);
    c.status=denied&&unchanged?'PASSOU':'FALHOU';
  }
  save();console.log(c.status+' '+label+' / '+action+' '+JSON.stringify(answer.result));return c;
}
try {
  await login('ANA');await login('BRUNO');await login('SECRETARIA');await login('PROTETICO');
  const a=await fixture('ANA','A-guardas');const b=await fixture('BRUNO','B-inverso');
  const ana=sessions.ANA.page;
  await ana.goto(base+'/dashboard/meu-dia');await ana.getByRole('heading',{name:'Meu Dia',exact:true}).waitFor({timeout:60000});
  await ana.goto(base+'/dashboard/pacientes/'+a.patientId);await ana.getByRole('tab',{name:'Prontuário',exact:true}).waitFor({timeout:60000});
  // Persist editable fixtures through real server actions before negative edit cases.
  const seedA=await check('Ana A criar ficha','ANA','salvarFicha',ficha(a),a,'normal');a.editFichaId=seedA.result.fichaId;save();
  const seedB=await check('Bruno B criar ficha (fixture)','BRUNO','salvarFicha',ficha(b),b,'normal');b.editFichaId=seedB.result.fichaId;save();
  assert(a.editFichaId&&b.editFichaId,'Editable fixtures required');
  function operations(f){return [
    ['Meu Dia','salvarVisitaMeuDia',visit(f)],
    ['Prontuario Novo atendimento','salvarAtendimentoDoProntuario',visit(f)],
    ['Ficha criar','salvarFicha',ficha(f)],
    ['Ficha editar','salvarFicha',{...ficha(f),fichaId:f.editFichaId,anotacoes:'QA SEC-B1 edição sintética'}],
    ['Word','importarHistoricoDoWord',word(f)],
  ];}
  for(const role of ['BRUNO','SECRETARIA','PROTETICO'])for(const [label,action,payload]of operations(a))await check(role+' x A '+label,role,action,payload,a,role==='BRUNO'?'foreign':'denied');
  for(const [label,action,payload]of operations(b))await check('Ana x B '+label,'ANA',action,payload,b,'foreign');
  // Each positive visit has its own new appointment/patient; no finalized fixture reuse.
  for(const [label,action]of [['Meu Dia','salvarVisitaMeuDia'],['Prontuario','salvarAtendimentoDoProntuario'],['Word','importarHistoricoDoWord']]){
    const f=await fixture('ANA','A-normal-'+label);await check('Ana x A '+label,'ANA',action,action==='importarHistoricoDoWord'?word(f):visit(f),f,'normal');
  }
  await check('Ana x A Ficha editar','ANA','salvarFicha',{...ficha(a),fichaId:a.editFichaId,anotacoes:'QA SEC-B1 edição normal persistida'},a,'normal');
  // Own foreign-event fixture in B, created via Bruno's action. Exactly one adversarial call.
  const ev={id:randomUUID(),tipo:'outro',procedimentoNome:'QA evento estrangeiro próprio',status:'indicado',origem:'clinica',momento_planejado:'sessao_atual',ancora:{nivel:'dente',dente:26,faces:[]},grupo_id:null,papel_no_grupo:null,observacao:'QA SEC-B1 evento sintético',realizado_em:null};
  const eb=await fixture('BRUNO','B-evento');
  const made=await check('Bruno B evento (fixture)','BRUNO','salvarFicha',{...ficha(eb),odontogramaEventos:[ev]},eb,'normal');
  assert(made.result.ok&&!made.result.eventosFalharam,'Foreign-event fixture not ready');
  const target=await fixture('ANA','A-caso-B');
  const beforeA=await snapshot(target),beforeB=await snapshot(eb);
  assert(!evidence.foreignEventAttempt,'Foreign-event call must never repeat');
  evidence.foreignEventAttempt={started:true,eventId:ev.id,targetPatient:target.patientId,sourcePatient:eb.patientId,beforeA,beforeB};save();
  const answer=await call('ANA','salvarVisitaMeuDia',{...visit(target),eventosDraft:[ev]});
  const afterA=await snapshot(target),afterB=await snapshot(eb);
  const event=await rows(db.from('odontograma_eventos').select('*').eq('id',ev.id));
  const links=await rows(db.from('atendimento_eventos').select('*').eq('evento_id',ev.id));
  evidence.foreignEventAttempt={...evidence.foreignEventAttempt,...answer,afterA,afterB,event,links,finished:true};save();
  console.log('CASO B one attempt '+JSON.stringify(answer.result));
  for(const f of evidence.fixtures)f.final=await snapshot(f);
  evidence.finished=new Date().toISOString();save();
} catch(e) {
  evidence.interrupted={message:e instanceof Error?e.message:'Unknown error',time:new Date().toISOString()};save();
  console.error('INCONCLUSIVO: '+evidence.interrupted.message);process.exitCode=1;
} finally {await browser.close();save();console.log('EVIDENCE '+out);}
