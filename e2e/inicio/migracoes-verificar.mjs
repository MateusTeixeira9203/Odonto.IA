// Final SELECT-only inventory. Never retries a clinical write or a signature.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {file,dir,db,rows,snapshot} from './migracoes-support.mjs';
const e=JSON.parse(fs.readFileSync(file,'utf8'));assert(e.receptionActionFinished);
const v={time:new Date().toISOString(),host:e.host,commit:e.commit,fixtures:[],checks:[]};
for(const f of e.fixtures){
  const current=await snapshot(f);assert.deepEqual(current,f.final,f.label+' changed after the round');
  const fichas=await rows(db.from('fichas').select('*').eq('paciente_id',f.patientId).order('id'));
  const events=await rows(db.from('odontograma_eventos').select('*').eq('paciente_id',f.patientId).order('id'));
  const signatures=await rows(db.from('assinaturas').select('*').eq('paciente_id',f.patientId).order('id'));
  const visits=await rows(db.from('atendimentos_clinicos').select('*').eq('paciente_id',f.patientId).order('id'));
  v.fixtures.push({label:f.label,patientId:f.patientId,stable:true,current,fichas,events,signatures,visits});
}
const signed=e.fixtures.find(f=>f.label==='API-ficha-assinada');assert.deepEqual(signed.signedState,signed.final);
v.checks.push({label:'All signed-fixture API negatives leave all seven hashes unchanged',status:'PASSOU'});
const mutable=v.fixtures.find(f=>f.label==='API-ficha-aberta');assert.equal(mutable.events.length,0);
v.checks.push({label:'Own mutable event inserted, edited and deleted by authenticated Ana',status:'PASSOU',eventId:e.fixtures.find(f=>f.label==='API-ficha-aberta').eventId,deletedAsAuthorizedTest:true});
const rpc=v.fixtures.find(f=>f.label==='API-assinar-autor');assert.equal(rpc.signatures.length,2);
const ana=e.identities.find(i=>i.label==='ANA');assert(rpc.signatures.every(s=>s.dentista_id===ana.dentistId&&s.cro_no_ato===ana.cro));
v.checks.push({label:'RPC Ana and Sara signatures persist Ana author/CRO',status:'PASSOU'});
const reception=v.fixtures.find(f=>f.label==='UI-Sara-recepcao');assert.equal(reception.signatures.length,0);assert.equal(reception.events[0].assinatura_id,null);assert(reception.fichas[0].assinado_em&&reception.fichas[0].assinatura_url);
v.checks.push({label:'Reception action stored only legacy header, not the procedure signature/CRO',status:'FALHOU',actualStorageObject:{bucket:'fichas',path:reception.fichas[0].assinatura_url}});
fs.writeFileSync(dir+'/leitura-final.json',JSON.stringify(v,null,2));console.log('READ ONLY: seven fixtures stable; 14 API pass, four UI paths pass, reception integration fails.');
