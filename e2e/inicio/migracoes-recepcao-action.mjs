// Independent server-action integration test, not a third UI/canvas attempt.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from '@playwright/test';
import {file,base,snapshotDir,authenticate,auth,db,rows,save,browserLogin,capture,snapshot} from './migracoes-support.mjs';
const e=JSON.parse(fs.readFileSync(file,'utf8'));assert(e.receptionRetryFinished&&!e.receptionActionStarted);
const f=e.fixtures.find(f=>f.label==='UI-Sara-recepcao');const before=await snapshot(f);
assert.equal(before.assinaturas.count,0);assert.equal((await rows(db.from('fichas').select('assinado_em').eq('id',f.fichaId).single())).assinado_em,null);
e.receptionActionStarted=new Date().toISOString();save(e);
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 await authenticate('ANA');const sara=await browserLogin(browser,'SARA');await sara.goto(base+'/dashboard');
 const manifest=JSON.parse(fs.readFileSync(snapshotDir+'/.next/dev/server/server-reference-manifest.json','utf8'));
 const action=Object.entries(manifest.node).find(([,v])=>v.exportedName==='salvarAssinaturaRecepcao')?.[0];assert(action);
 const png=await sara.evaluate(()=>{const c=document.createElement('canvas');c.width=300;c.height=120;const x=c.getContext('2d');x.fillStyle='#ffffff';x.fillRect(0,0,300,120);x.strokeStyle='#000000';x.beginPath();x.moveTo(30,70);x.lineTo(60,40);x.lineTo(100,90);x.lineTo(160,40);x.lineTo(250,80);x.stroke();return c.toDataURL('image/png');});
 const c={label:'API Server Action recepção Sara com PNG sintético',role:'SARA',status:'INCONCLUSIVO',before,sent:true};e.cases.push(c);save(e);
 const response=await sara.request.post(base+'/dashboard',{headers:{'next-action':action,'content-type':'text/plain;charset=UTF-8',accept:'text/x-component',origin:base},data:JSON.stringify([f.fichaId,f.patientId,'QA paciente sintético M1M2',png]),maxRedirects:0,timeout:60000});
 const text=await response.text();const line=text.split('\n').find(l=>/^\d+:\{"ok":/.test(l));assert(line,'Action return absent');c.response={http:response.status(),result:JSON.parse(line.slice(line.indexOf(':')+1))};
 c.after=await snapshot(f);c.event=await rows(db.from('odontograma_eventos').select('*').eq('id',f.eventId).single());
 c.ficha=await rows(db.from('fichas').select('id,assinado_em,assinatura_url').eq('id',f.fichaId).single());
 c.signatures=await rows(db.from('assinaturas').select('*').eq('paciente_id',f.patientId));
 const sig=c.signatures.find(s=>s.id===c.event.assinatura_id);
 c.status=c.response.result.ok&&sig&&sig.cro_no_ato===auth.ANA.cro&&sig.dentista_id===auth.ANA.dentistId?'PASSOU':'FALHOU';
 c.failure=c.status==='FALHOU'?'Success result but procedure signature/author CRO not persisted':null;save(e);
 await sara.reload();await sara.getByRole('link',{name:f.name,exact:true}).waitFor({timeout:60000});
 c.cardAfterReload=await sara.getByRole('link',{name:f.name,exact:true}).locator('../..').innerText();await capture(sara,'tela-recepcao-apos-action-reload');save(e);
 for(const f of e.fixtures)f.final=await snapshot(f);e.receptionActionFinished=new Date().toISOString();save(e);console.log(c.status+' '+c.label+' '+JSON.stringify(c.response));
}catch(error){e.receptionActionError=error.message;save(e);console.error('INCONCLUSIVO action '+error.message);process.exitCode=1;}
finally{await browser.close();save(e);}
