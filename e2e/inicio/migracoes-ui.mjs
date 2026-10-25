import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium,expect} from '@playwright/test';
import {file,base,snapshotDir,authenticate,auth,db,rows,save,snapshot,browserLogin,capture,recordUi} from './migracoes-support.mjs';
const e=JSON.parse(fs.readFileSync(file,'utf8'));assert(e.apiFinished&&!e.apiError);assert(!e.uiStarted,'No UI write replay');e.uiStarted=new Date().toISOString();save(e);
const browser=await chromium.launch({channel:'msedge',headless:true});
const pending=[];
function watch(page,c){
  const handler=response=>{
    const req=response.request(),action=req.headers()['next-action'];if(!action)return;
    const task=(async()=>{const text=await response.text().catch(()=>null);if(!text)return;const line=text.split('\n').find(l=>/^\d+:\{"ok":/.test(l));
      const r=line?JSON.parse(line.slice(line.indexOf(':')+1),(_k,v)=>v==='$undefined'?undefined:v):null;
      let name=null;try{const m=JSON.parse(fs.readFileSync(snapshotDir+'/.next/dev/server/server-reference-manifest.json','utf8'));name=m.node[action]?.exportedName??null;}catch{}
      c.actions??=[];c.actions.push({name,http:response.status(),ok:r?.ok,error:r?.error??null});save(e);
    })();pending.push(task);
  };page.on('response',handler);return()=>page.off('response',handler);
}
async function prontuario(page,f){await page.goto(base+'/dashboard/pacientes/'+f.patientId);await page.getByRole('tab',{name:'Prontuário',exact:true}).click({timeout:60000});await page.getByRole('button',{name:'Novo atendimento',exact:true}).waitFor({timeout:60000});}
async function openFicha(page){await page.getByRole('button',{name:/Abrir ficha/}).first().click({timeout:15000});await page.getByRole('region',{name:'Ficha aberta no prontuário',exact:true}).waitFor({timeout:15000});}
try{
 await authenticate('ANA');
 const ana=await browserLogin(browser,'ANA');
 const md=e.fixtures.find(f=>f.label==='UI-Meu-Dia');
 await recordUi(e,'TELA Meu Dia salvar visita',md,async c=>{
   await ana.goto(base+'/dashboard/meu-dia?ag='+md.slotId);await ana.locator('[data-rail-alvo="'+md.slotId+'"]').click({timeout:60000});
   await expect(ana.getByRole('heading',{name:md.name,exact:true})).toBeVisible();await capture(ana,'tela-meu-dia-antes');
   await ana.getByRole('textbox',{name:'Relato para organizar com Dex',exact:true}).last().fill('QA M1M2 visita normal pela tela sem IA');
   const unwatch=watch(ana,c);await ana.getByRole('button',{name:'Salvar atendimento',exact:true}).click();
   const confirm=ana.getByRole('alertdialog');await confirm.waitFor({timeout:10000});
   c.confirmation=await confirm.innerText();
   const options=await confirm.getByRole('button').allTextContents();c.confirmOptions=options;save(e);
   await confirm.getByRole('button',{name:/Salvar assim mesmo/}).click();
   await expect(ana.locator('[data-rail-alvo="'+md.slotId+'"]')).toContainText('registrado',{timeout:60000});
   unwatch();await capture(ana,'tela-meu-dia-depois');
   await ana.reload();await ana.locator('[data-rail-alvo="'+md.slotId+'"]').click({timeout:60000});await expect(ana.locator('[data-rail-alvo="'+md.slotId+'"]')).toContainText('registrado');c.reload='PASSOU';
 },async c=>{
   assert.equal(c.after.atendimentos_clinicos.count,c.before.atendimentos_clinicos.count+1);assert.equal(c.after.fichas.count,c.before.fichas.count+1);assert.equal(c.after.ficha_evolucoes.count,c.before.ficha_evolucoes.count+1);
   c.persisted=await rows(db.from('ficha_evolucoes').select('*').in('ficha_id',c.after.fichas.ids));assert(c.persisted.some(r=>r.texto==='QA M1M2 visita normal pela tela sem IA'));
 });
 const created=e.fixtures.find(f=>f.label==='UI-Ficha-criar-editar');
 const create=await recordUi(e,'TELA Ficha criar via Novo atendimento',created,async c=>{
   await prontuario(ana,created);await capture(ana,'tela-ficha-criar-antes');await ana.getByRole('button',{name:'Novo atendimento',exact:true}).click();
   await ana.getByRole('button',{name:'+ Evolução',exact:true}).click();await ana.getByPlaceholder('Curativo, sutura, orientação ou evolução da consulta',{exact:true}).fill('QA M1M2 ficha criada pela tela');
   const unwatch=watch(ana,c);await ana.getByRole('button',{name:'Salvar atendimento',exact:true}).click();
   await expect.poll(async()=>{const r=await rows(db.from('fichas').select('id').eq('paciente_id',created.patientId));return r.length;},{timeout:30000}).toBe(1);unwatch();
   await prontuario(ana,created);await ana.getByText('QA M1M2 ficha criada pela tela',{exact:true}).first().waitFor({timeout:15000});await capture(ana,'tela-ficha-criar-depois');c.reload='PASSOU';
 },async c=>{assert.equal(c.after.fichas.count,1);assert.equal(c.after.atendimentos_clinicos.count,1);assert.equal(c.after.ficha_evolucoes.count,1);created.fichaId=c.after.fichas.ids[0];save(e);});
 if(create.status==='PASSOU')await recordUi(e,'TELA Ficha editar evolução clínica',created,async c=>{
   await prontuario(ana,created);await openFicha(ana);await capture(ana,'tela-ficha-editar-antes');
   await ana.getByRole('button',{name:'Editar evolução clínica',exact:true}).click();await ana.getByRole('textbox',{name:'Evolução clínica',exact:true}).fill('QA M1M2 ficha editada pela tela');
   const unwatch=watch(ana,c);await ana.getByRole('button',{name:'Salvar evolução',exact:true}).click();await ana.getByText('QA M1M2 ficha editada pela tela',{exact:true}).first().waitFor({timeout:20000});unwatch();
   await prontuario(ana,created);await ana.getByText('QA M1M2 ficha editada pela tela',{exact:true}).first().waitFor();await capture(ana,'tela-ficha-editar-depois');c.reload='PASSOU';
 },async c=>{assert.equal(c.after.fichas.count,c.before.fichas.count);assert.equal(c.after.ficha_evolucoes.count,c.before.ficha_evolucoes.count);assert.notEqual(c.after.ficha_evolucoes.hash,c.before.ficha_evolucoes.hash);assert.equal(c.after.odontograma_eventos.hash,c.before.odontograma_eventos.hash);});
 const signed=e.fixtures.find(f=>f.label==='UI-Assinada-evolucao');
 await recordUi(e,'TELA OD015a Novo atendimento em ficha assinada só evolução',signed,async c=>{
   c.originalFicha=await rows(db.from('fichas').select('*').eq('id',signed.fichaId).single());
   c.originalEvolution=await rows(db.from('ficha_evolucoes').select('*').eq('id',signed.oldEvolutionId).single());
   await prontuario(ana,signed);await openFicha(ana);await capture(ana,'tela-assinada-antes');
   await ana.getByRole('region',{name:'Ficha aberta no prontuário',exact:true}).getByRole('button',{name:'Novo atendimento',exact:true}).click();
   await ana.getByRole('button',{name:'+ Evolução',exact:true}).click();await ana.getByPlaceholder('Curativo, sutura, orientação ou evolução da consulta',{exact:true}).fill('QA M1M2 evolução posterior na ficha assinada pela tela');
   const unwatch=watch(ana,c);await ana.getByRole('button',{name:'Salvar atendimento',exact:true}).click();
   await expect.poll(async()=>{const r=await rows(db.from('ficha_evolucoes').select('id').eq('ficha_id',signed.fichaId));return r.length;},{timeout:30000}).toBe(2);unwatch();
   await prontuario(ana,signed);await ana.getByText('QA M1M2 evolução posterior na ficha assinada pela tela',{exact:true}).first().waitFor({timeout:15000});await capture(ana,'tela-assinada-depois');c.reload='PASSOU';
 },async c=>{
   c.persistedFicha=await rows(db.from('fichas').select('*').eq('id',signed.fichaId).single());
   c.persistedOldEvolution=await rows(db.from('ficha_evolucoes').select('*').eq('id',signed.oldEvolutionId).single());
   const normalize=value=>{const result={...value};delete result.updated_at;return result;};
   assert.deepEqual(normalize(c.originalFicha),normalize(c.persistedFicha));assert.deepEqual(c.originalEvolution,c.persistedOldEvolution);
   assert.equal(c.after.fichas.count,c.before.fichas.count);assert.equal(c.after.ficha_evolucoes.count,c.before.ficha_evolucoes.count+1);assert.equal(c.after.atendimentos_clinicos.count,c.before.atendimentos_clinicos.count+1);assert.equal(c.after.odontograma_eventos.hash,c.before.odontograma_eventos.hash);
 });
 const reception=e.fixtures.find(f=>f.label==='UI-Sara-recepcao');
 // Own synthetic slot moved into the first 50 cards and made eligible; no shared slot changed.
 e.receptionPreparation={before:await rows(db.from('agendamentos').select('*').eq('id',reception.slotId).single())};save(e);
 const prep=await auth.ANA.client.from('agendamentos').update({status:'checked_in',data_hora:'2026-10-24T09:10:00-03:00'}).eq('id',reception.slotId).select('id');assert(!prep.error&&prep.data.length===1);
 e.receptionPreparation.after=await rows(db.from('agendamentos').select('*').eq('id',reception.slotId).single());save(e);
 const sara=await browserLogin(browser,'SARA');
 await recordUi(e,'TELA Sara recepção assina procedimentos Ana e CRO Ana',reception,async c=>{
   await sara.goto(base+'/dashboard');const patient=sara.getByRole('link',{name:reception.name,exact:true});await patient.waitFor({timeout:60000});
   const card=patient.locator('../..');await capture(sara,'tela-recepcao-antes');await card.getByRole('button',{name:'Assinar',exact:true}).click();
   const dialog=sara.getByRole('dialog');await dialog.locator('canvas').waitFor({timeout:20000});
   const box=await dialog.locator('canvas').boundingBox();assert(box);
   await sara.mouse.move(box.x+40,box.y+65);await sara.mouse.down();await sara.mouse.move(box.x+90,box.y+120,{steps:12});await sara.mouse.move(box.x+160,box.y+55,{steps:12});await sara.mouse.move(box.x+230,box.y+115,{steps:12});await sara.mouse.up();
   await capture(sara,'tela-recepcao-desenho');const unwatch=watch(sara,c);await dialog.getByRole('button',{name:'Confirmar Assinatura',exact:true}).click();
   await sara.getByText('Assinatura registrada!',{exact:true}).waitFor({timeout:30000});c.successShown=true;await capture(sara,'tela-recepcao-sucesso');unwatch();
   await sara.reload();await sara.getByRole('link',{name:reception.name,exact:true}).waitFor({timeout:60000});
   c.event=await rows(db.from('odontograma_eventos').select('*').eq('id',reception.eventId).single());
   c.ficha=await rows(db.from('fichas').select('id,assinado_em,assinatura_url').eq('id',reception.fichaId).single());
   c.signatures=await rows(db.from('assinaturas').select('*').eq('paciente_id',reception.patientId));await capture(sara,'tela-recepcao-reload');
 },async c=>{
   assert(c.event.assinatura_id,'Procedure remains unsigned despite success');
   const signature=c.signatures.find(s=>s.id===c.event.assinatura_id);assert(signature,'Signature row absent');assert.equal(signature.dentista_id,auth.ANA.dentistId);assert.equal(signature.cro_no_ato,auth.ANA.cro);
 });
 await Promise.allSettled(pending);
 for(const f of e.fixtures)f.final=await snapshot(f);e.uiFinished=new Date().toISOString();save(e);
}catch(error){e.uiError=error.message;save(e);console.error('INCONCLUSIVO setup UI '+error.message);process.exitCode=1;}
finally{await Promise.allSettled(pending);await browser.close();save(e);console.log('Evidence '+file);}
