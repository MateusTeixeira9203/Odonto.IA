// One read-only comparison explicitly requested across three versions. No confirm/save.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {chromium} from '@playwright/test';
import {execFileSync} from 'node:child_process';
import {file,dir,ctx,host,names,snapshot} from './migracoes-support.mjs';
const out=path.join(dir,'comparacao-canvas-tres-versoes.json');assert(!fs.existsSync(out),'Unique comparison already exists; do not rerun');
const e=JSON.parse(fs.readFileSync(file,'utf8'));const f=e.fixtures.find(f=>f.label==='UI-Sara-recepcao');
const evidence={time:new Date().toISOString(),host,patientId:f.patientId,slotId:f.slotId,before:await snapshot(f),versions:[],noConfirmation:true};
const save=()=>fs.writeFileSync(out,JSON.stringify(evidence,null,2));save();
const browser=await chromium.launch({channel:'msedge',headless:true});
const versions=[{port:3014,sha:'42c80a5',dir:path.resolve('../Odonto.IA-qa3-antes')},{port:3021,sha:'af303ad',dir:path.resolve('../Odonto.IA-ref-af303ad')},{port:3015,sha:'2c6eeff',dir:path.resolve('../Odonto.IA-qa3-depois')}];
const account=ctx.accounts.contas.find(c=>c.email===names.SARA);assert(account);
async function dimensions(canvas){return canvas.evaluate(c=>{
 const box=c.getBoundingClientRect(),context=c.getContext('2d'),pixels=context.getImageData(0,0,c.width,c.height).data;let ink=0;
 for(let i=0;i<pixels.length;i+=4)if(pixels[i+3]>0&&(pixels[i]<220||pixels[i+1]<220||pixels[i+2]<220))ink++;
 return {backingWidth:c.width,backingHeight:c.height,clientWidth:c.clientWidth,clientHeight:c.clientHeight,dpr:devicePixelRatio,box:{x:box.x,y:box.y,width:box.width,height:box.height},inkPixels:ink};
});}
try{
 for(const version of versions){
  const record={port:version.port,expectedSha:version.sha,head:execFileSync('git',['rev-parse','HEAD'],{cwd:version.dir,encoding:'utf8'}).trim(),blockedRequests:[],pageErrors:[],requests:[]};assert(record.head.startsWith(version.sha));
  evidence.versions.push(record);save();
  const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage();
  page.on('pageerror',error=>record.pageErrors.push(error.message));
  await page.route('**/*',route=>{
   const req=route.request(),u=new URL(req.url());
   if(u.hostname.endsWith('.supabase.co')&&u.hostname!==host)return route.abort();
   if(!['GET','HEAD'].includes(req.method())&&u.hostname==='localhost'&&u.pathname.startsWith('/dashboard')){
    let name=null;try{const manifest=JSON.parse(fs.readFileSync(version.dir+'/.next/dev/server/server-reference-manifest.json','utf8'));name=manifest.node[req.headers()['next-action']]?.exportedName??null;}catch{}
    record.requests.push({path:u.pathname,method:req.method(),action:name});
    if(name!=='buscarFichaParaAssinar'){record.blockedRequests.push({path:u.pathname,action:name});return route.abort();}
   }
   return route.continue();
  });
  try{
   await page.goto('http://localhost:'+version.port+'/login');
   await page.waitForFunction(()=>{const form=document.querySelector('form');return form&&Object.keys(form).some(k=>k.startsWith('__reactProps')&&typeof Reflect.get(form,k).onSubmit==='function');});
   await page.locator('input[type=email]').fill(account.email);await page.locator('input[type=password]').fill(account.senha);await page.locator('button[type=submit]').click();await page.waitForURL(u=>u.pathname.startsWith('/dashboard'),{timeout:60000});
   await page.goto('http://localhost:'+version.port+'/dashboard');
   const patient=page.getByRole('link',{name:f.name,exact:true});await patient.waitFor({timeout:60000});
   await patient.locator('../..').getByRole('button',{name:'Assinar',exact:true}).click();
   const dialog=page.getByRole('dialog'),canvas=dialog.locator('canvas');await canvas.waitFor({timeout:20000});await canvas.click({trial:true});
   // Wait for animation/document fonts only; no backing-size assertion that could prevent drawing.
   await page.evaluate(()=>document.fonts.ready);
   record.before=await dimensions(canvas);record.buttonBefore=await dialog.getByRole('button',{name:'Confirmar Assinatura',exact:true}).isEnabled();
   const cdp=await context.newCDPSession(page);
   const remote=await cdp.send('Runtime.evaluate',{expression:'document.querySelector("[role=dialog] canvas")',objectGroup:'qa-canvas-readonly'});
   if(remote.result.objectId){const listeners=await cdp.send('DOMDebugger.getEventListeners',{objectId:remote.result.objectId});record.listenerTypes=listeners.listeners.map(l=>l.type);}
   await cdp.detach();
   const b=await canvas.boundingBox();assert(b);
   await page.mouse.move(b.x+45,b.y+65);await page.mouse.down();for(const [x,y]of [[75,100],[105,50],[140,125],[185,60],[240,120]])await page.mouse.move(b.x+x,b.y+y,{steps:12});await page.mouse.up();
   record.after=await dimensions(canvas);record.buttonAfter=await dialog.getByRole('button',{name:'Confirmar Assinatura',exact:true}).isEnabled();
   record.buttonDom=await dialog.getByRole('button',{name:'Confirmar Assinatura',exact:true}).evaluate(b=>b.outerHTML);
   record.canvasDom=await canvas.evaluate(c=>c.outerHTML);
   record.outcome=record.after.inkPixels>record.before.inkPixels&&record.buttonAfter?'PASSOU':'FALHOU';
   await page.screenshot({path:path.join(dir,'canvas-comparativo-'+version.sha+'.png'),animations:'disabled'});
   record.afterTables=await snapshot(f);assert.deepEqual(record.afterTables,evidence.before,'Clinical mutation during read-only comparison');
   save();console.log(version.sha+' '+record.outcome+' '+JSON.stringify({before:record.before,after:record.after,buttonAfter:record.buttonAfter,listeners:record.listenerTypes}));
  }catch(error){record.outcome='INCONCLUSIVO';record.error=error.message;save();console.log(version.sha+' INCONCLUSIVO '+error.message);}
  finally{await context.close();}
 }
 evidence.after=await snapshot(f);assert.deepEqual(evidence.before,evidence.after);evidence.finished=new Date().toISOString();save();
}finally{await browser.close();save();}
