// Single safe continuation: first UI attempt sent no save and left all hashes equal.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium,expect} from '@playwright/test';
import {file,base,dir,authenticate,auth,db,rows,save,browserLogin,capture,snapshot,recordUi} from './migracoes-support.mjs';
const e=JSON.parse(fs.readFileSync(file,'utf8'));assert(!e.receptionRetryStarted);
const previous=e.cases.find(c=>c.label==='TELA Sara recepção assina procedimentos Ana e CRO Ana');assert(previous);
assert.deepEqual(previous.before,previous.after);assert(!previous.actions?.some(a=>a.name==='salvarAssinaturaRecepcao'));
previous.status='INCONCLUSIVO';previous.harnessNote='Canvas not initialized/stable before first drawing; no save sent, all seven table hashes unchanged. One preparation retry allowed.';
e.receptionRetryStarted=new Date().toISOString();save(e);
const browser=await chromium.launch({channel:'msedge',headless:true});const pending=[];
try{
 await authenticate('ANA');const sara=await browserLogin(browser,'SARA');const f=e.fixtures.find(f=>f.label==='UI-Sara-recepcao');
 await recordUi(e,'TELA Sara recepção assina procedimentos Ana e CRO Ana - reteste preparado',f,async c=>{
  await sara.goto(base+'/dashboard');const patient=sara.getByRole('link',{name:f.name,exact:true});await patient.waitFor({timeout:60000});
  const card=patient.locator('../..');await card.getByRole('button',{name:'Assinar',exact:true}).click();
  const dialog=sara.getByRole('dialog'),canvas=dialog.locator('canvas');await canvas.waitFor({timeout:15000});
  await expect.poll(()=>canvas.evaluate(c=>c.width===Math.round(c.clientWidth*window.devicePixelRatio)&&c.height===Math.round(c.clientHeight*window.devicePixelRatio)),{timeout:10000}).toBe(true);
  await canvas.click({trial:true});
  const box=await canvas.boundingBox();assert(box);
  await sara.mouse.move(box.x+45,box.y+70);await sara.mouse.down();
  for(const [x,y]of [[70,90],[95,130],[130,65],[180,135],[230,60],[275,105]])await sara.mouse.move(box.x+x,box.y+y,{steps:10});
  await sara.mouse.up();await expect(dialog.getByRole('button',{name:'Confirmar Assinatura',exact:true})).toBeEnabled({timeout:5000});
  await capture(sara,'tela-recepcao-desenho-estavel');
  const listener=response=>{if(response.request().headers()['next-action'])pending.push((async()=>{
    const text=await response.text().catch(()=>null);if(!text)return;const line=text.split('\n').find(l=>/^\d+:\{"ok":/.test(l));if(!line)return;
    const r=JSON.parse(line.slice(line.indexOf(':')+1));c.actions??=[];c.actions.push({http:response.status(),ok:r.ok,error:r.error??null});save(e);
  })());};sara.on('response',listener);
  await dialog.getByRole('button',{name:'Confirmar Assinatura',exact:true}).click();
  await sara.getByText('Assinatura registrada!',{exact:true}).waitFor({timeout:30000});c.successShown=true;await capture(sara,'tela-recepcao-sucesso-confirmado');
  await sara.reload();await sara.getByRole('link',{name:f.name,exact:true}).waitFor({timeout:60000});
  c.event=await rows(db.from('odontograma_eventos').select('*').eq('id',f.eventId).single());
  c.ficha=await rows(db.from('fichas').select('id,assinado_em,assinatura_url').eq('id',f.fichaId).single());
  c.signatures=await rows(db.from('assinaturas').select('*').eq('paciente_id',f.patientId));
  c.cardAfterReload=await sara.getByRole('link',{name:f.name,exact:true}).locator('../..').innerText();
  await capture(sara,'tela-recepcao-reload-confirmado');sara.off('response',listener);await Promise.allSettled(pending);
  fs.writeFileSync(dir+'/recepcao-observacao.json',JSON.stringify({fixture:f,event:c.event,ficha:c.ficha,signatures:c.signatures,successShown:c.successShown,cardAfterReload:c.cardAfterReload},null,2));
 },async c=>{
   assert(c.event.assinatura_id,'Procedure remains unsigned despite UI success');
   const s=c.signatures.find(s=>s.id===c.event.assinatura_id);assert(s,'Signature row absent');assert.equal(s.dentista_id,auth.ANA.dentistId);assert.equal(s.cro_no_ato,auth.ANA.cro);
 });
 for(const f of e.fixtures)f.final=await snapshot(f);e.receptionRetryFinished=new Date().toISOString();save(e);
}catch(error){e.receptionRetryError=error.message;save(e);console.error('INCONCLUSIVO reception '+error.message);process.exitCode=1;}
finally{await Promise.allSettled(pending);await browser.close();save(e);console.log('Evidence '+file);}
