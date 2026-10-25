import assert from 'node:assert/strict';
import fs from 'node:fs';
import {randomUUID} from 'node:crypto';
import {commit,host,file,authenticate,auth,db,rows,save,fixture,event,snapshot,apiCase} from './migracoes-support.mjs';
assert(!fs.existsSync(file),'Evidence exists: do not repeat the API writes');
const e={commit,host,migrationsReported:['05600e8','8529e4e'],started:new Date().toISOString(),fixtures:[],identities:[],cases:[]};save(e);
try{
  for(const role of ['ANA','CARLOS','SARA','PROTETICO','BRUNO']){const a=await authenticate(role);e.identities.push({label:role,clinicId:a.clinicId,dentistId:a.dentistId,role:a.role,cro:a.cro});save(e);}
  const signed=await fixture(e,'API-ficha-assinada');
  const old=event(signed,{created_at:'2026-10-20T12:00:00Z',observacao:'QA M1M2 antes assinatura'});signed.oldEventId=old.id;save(e);
  let r=await auth.ANA.client.from('odontograma_eventos').insert(old).select('id');assert(!r.error,r.error?.message);
  r=await auth.ANA.client.from('fichas').update({assinado_em:'2026-10-24T12:00:00Z',assinatura_url:'qa/m1m2/synthetic-legacy-signature'}).eq('id',signed.fichaId).select('id');assert(!r.error&&r.data.length===1,'Signed fixture setup failed');
  signed.signedState=await snapshot(signed);save(e);
  const attempts=[['M1 INSERT Ana ficha assinada created_at antigo','ANA',event(signed,{created_at:'2026-10-19T12:00:00Z'})],['M1 INSERT Carlos ficha assinada Ana','CARLOS',event(signed,{dentista_id:auth.CARLOS.dentistId})],['M1 INSERT Bruno ficha A','BRUNO',event(signed,{dentista_id:auth.BRUNO.dentistId})]];
  for(const [label,role,payload]of attempts){signed.attemptIds??=[];signed.attemptIds.push(payload.id);save(e);await apiCase(e,label,role,signed,()=>auth[role].client.from('odontograma_eventos').insert(payload).select('id'),'denied');}
  await apiCase(e,'M1 UPDATE evento de ficha assinada','ANA',signed,()=>auth.ANA.client.from('odontograma_eventos').update({observacao:'QA alteração negada'}).eq('id',old.id).select('id'),'denied');
  await apiCase(e,'M1 DELETE evento de ficha assinada','ANA',signed,()=>auth.ANA.client.from('odontograma_eventos').delete().eq('id',old.id).select('id'),'denied');
  const open=await fixture(e,'API-ficha-aberta');const normal=event(open);open.eventId=normal.id;save(e);
  await apiCase(e,'M1 INSERT Ana ficha própria não assinada','ANA',open,()=>auth.ANA.client.from('odontograma_eventos').insert(normal).select('id'),'allowed');
  await apiCase(e,'M1 UPDATE evento próprio ficha não assinada','ANA',open,()=>auth.ANA.client.from('odontograma_eventos').update({observacao:'QA M1M2 alteração permitida'}).eq('id',normal.id).select('id'),'allowed');
  await apiCase(e,'M1 DELETE evento próprio ficha não assinada','ANA',open,()=>auth.ANA.client.from('odontograma_eventos').delete().eq('id',normal.id).select('id'),'allowed');
  const signs=await fixture(e,'API-assinar-autor');const own=event(signs,{status:'realizado',realizado_em:'2026-10-24'}),pending=event(signs,{status:'realizado',realizado_em:'2026-10-24'}),sara=event(signs,{status:'realizado',realizado_em:'2026-10-24'});
  signs.eventIds={own:own.id,pending:pending.id,sara:sara.id};save(e);
  r=await auth.ANA.client.from('odontograma_eventos').insert([own,pending,sara]);assert(!r.error,r.error?.message);
  const rpc=(role,id)=>auth[role].client.rpc('assinar_procedimentos',{p_evento_ids:[id],p_assinado_por:'QA paciente sintético',p_assinatura_ref:'qa/m1m2/synthetic/'+randomUUID()});
  for(const role of ['CARLOS','PROTETICO','BRUNO'])await apiCase(e,'M2 assinar não autor '+role,role,signs,()=>rpc(role,pending.id),'denied');
  const a=await apiCase(e,'M2 Ana assina próprios','ANA',signs,()=>rpc('ANA',own.id),'allowed');
  const s=await apiCase(e,'M2 Sara RPC assina autor Ana','SARA',signs,()=>rpc('SARA',sara.id),'allowed');
  for(const c of [a,s])if(c.status==='PASSOU'){
    c.signature=await rows(db.from('assinaturas').select('*').eq('id',c.response.data).single());
    c.croCorrect=c.signature.cro_no_ato===auth.ANA.cro&&c.signature.dentista_id===auth.ANA.dentistId;
    if(!c.croCorrect){c.status='FALHOU';c.failure='Author/CRO mismatch';}save(e);
  }
  await apiCase(e,'M2 repetir assinatura Ana','ANA',signs,()=>rpc('ANA',own.id),'denied');
  // UI fixtures are prepared once and preserved. UI caller must not recreate them.
  await fixture(e,'UI-Meu-Dia',{ficha:false,slot:true});
  await fixture(e,'UI-Ficha-criar-editar',{ficha:false});
  await fixture(e,'UI-Assinada-evolucao');
  const reception=await fixture(e,'UI-Sara-recepcao',{slot:true});
  const recevent=event(reception,{status:'realizado',realizado_em:'2026-10-24'});reception.eventId=recevent.id;save(e);
  r=await auth.ANA.client.from('odontograma_eventos').insert(recevent);assert(!r.error,r.error?.message);
  // Legacy signed fixture gets a readable pre-sign evolution, then a header signature.
  const sf=e.fixtures.find(f=>f.label==='UI-Assinada-evolucao');
  const ev=event(sf,{created_at:'2026-10-20T12:00:00Z',procedimento_nome:'QA M1M2 procedimento preservado'});sf.oldEventId=ev.id;
  sf.oldEvolutionId=randomUUID();save(e);
  r=await auth.ANA.client.from('odontograma_eventos').insert(ev);assert(!r.error,r.error?.message);
  r=await auth.ANA.client.from('ficha_evolucoes').insert({id:sf.oldEvolutionId,clinica_id:sf.clinicId,ficha_id:sf.fichaId,dentista_id:auth.ANA.dentistId,data:'2026-10-20',texto:'QA M1M2 evolução antiga preservada',created_at:'2026-10-20T12:00:00Z'});assert(!r.error,r.error?.message);
  r=await auth.ANA.client.from('fichas').update({assinado_em:'2026-10-24T12:00:00Z',assinatura_url:'qa/m1m2/synthetic-legacy-signature'}).eq('id',sf.fichaId).select('id');assert(!r.error&&r.data.length===1,'UI signed fixture setup failed');
  for(const f of e.fixtures)f.afterApi=await snapshot(f);
  e.apiFinished=new Date().toISOString();save(e);
}catch(error){e.apiError=error.message;save(e);console.error('INCONCLUSIVO setup '+error.message);process.exitCode=1;}
console.log('Evidence '+file);
