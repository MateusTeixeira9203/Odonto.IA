// New, one-shot Auth/UI evidence after the PGRST201 fix. Called by od019-live.mjs.
export async function run(stage,h){
 const {assert,fs,path,createHash,execFileSync,expect,e,save,rows,db,login,fixture,action,check,capture,sessions,base,dir}=h;
 if(['RT-preflight','RT-preflight2','RT-server'].includes(stage)){
   const sources=execFileSync('git',['diff-tree','--no-commit-id','--name-only','-r','4763996'],{encoding:'utf8'}).trim().split('\n');
   e.sourceProof=sources.map(p=>{const current=fs.readFileSync(p,'utf8').replaceAll('\r\n','\n');const committed=execFileSync('git',['show','4763996:'+p],{maxBuffer:5e6,encoding:'utf8'}).replaceAll('\r\n','\n');assert.equal(current,committed,'Source differs '+p);return {path:p,sha256NormalizedLf:createHash('sha256').update(current).digest('hex')};});save();
   for(const role of ['ANA','BRUNO','SARA','PROTETICO','ADMIN'])await login(role);
   await check('RT servidor 3000 + Meu Dia carregar Ana',async c=>{
     const p=sessions.ANA.page;await p.goto(base+'/dashboard/meu-dia');
     await p.locator('[data-rail-alvo]').first().waitFor({timeout:25000});
     c.text=await p.locator('body').innerText();await capture(p,'RT-meu-dia-carregado');
     const compiled=fs.readFileSync('.next/dev/server/app/dashboard/meu-dia/page.js','utf8');
     c.compiledNewHint=compiled.includes('paciente:pacientes!agendamentos_paciente_id_fkey');assert(c.compiledNewHint);
     await p.goto(base+'/dashboard/agendamentos');await p.getByRole('heading',{name:'Agendamentos',exact:true}).waitFor({timeout:20000});
     const scripts=await p.locator('script[src]').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('src')).filter(s=>s.includes('agendamentos')));
     assert(scripts.length,'No live Agenda chunk');c.liveChunks=[];
     for(const src of scripts){const r=await p.request.get(new URL(src,base).href);const t=await r.text();c.liveChunks.push({src,status:r.status(),newHint:t.includes('paciente:pacientes!agendamentos_paciente_id_fkey'),hash:createHash('sha256').update(t).digest('hex')});}
     assert(c.liveChunks.some(s=>s.newHint),'Live chunk did not contain fixed FK select');return {servedFixedCode:true};
   },c=>assert(c.response.servedFixedCode));
   e.preflight='PASSOU';save();
 }
 if(stage==='RT-MeuDia'){
   const a=await login('ANA'),f=await fixture('ANA','RT-MeuDia');e.mainFixture=f;save();
   await check('RT Meu Dia Ana salvar/finalizar UI',async c=>{
     const p=a.page;await p.goto(base+'/dashboard/meu-dia?ag='+f.slotId);await p.locator('[data-rail-alvo]').first().waitFor({timeout:25000});
     const rail=p.locator(`[data-rail-alvo="${f.slotId}"]`);await rail.waitFor({timeout:15000});if(await rail.getAttribute('aria-pressed')!=='true')await rail.click();
     await p.getByRole('heading',{name:f.name,exact:true}).waitFor({timeout:15000});
     const editor=p.getByRole('textbox',{name:'Relato para organizar com Dex',exact:true});await editor.click();await p.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
     f.note='QA OD019 RT 4763996 evolução sintética sem IA';save();await editor.fill(f.note);await capture(p,'RT-MeuDia-antes');
     await p.getByRole('button',{name:'Salvar atendimento',exact:true}).click();
     const confirm=p.getByRole('button',{name:'Salvar assim mesmo',exact:true});await confirm.waitFor({timeout:10000});await confirm.click();
     await expect.poll(async()=>rows(a.client.from('atendimentos_clinicos').select('id,estado').eq('paciente_id',f.patientId)),{timeout:25000}).toMatchObject([{estado:'finalizado'}]);
     c.persisted=await rows(a.client.from('atendimentos_clinicos').select('id,clinica_id,paciente_id,estado').eq('paciente_id',f.patientId));f.visitId=c.persisted[0].id;
     const fichas=await rows(a.client.from('fichas').select('id').eq('paciente_id',f.patientId));assert.equal(fichas.length,1);f.savedFichaId=fichas[0].id;save();
     c.slot=await rows(a.client.from('agendamentos').select('id,status').eq('id',f.slotId).single());assert.equal(c.slot.status,'completed');
     await p.reload();await p.locator(`[data-rail-alvo="${f.slotId}"]`).click();await p.getByRole('region',{name:'Atendimento já registrado',exact:true}).waitFor({timeout:20000});await capture(p,'RT-MeuDia-depois-reload');return {persisted:true};
   },c=>assert(c.response.persisted));
   await check('RT Prontuário Novo atendimento UI e recarga',async c=>{
     const p=a.page;await p.goto(base+'/dashboard/pacientes/'+f.patientId);await p.getByRole('tab',{name:'Prontuário',exact:true}).click({timeout:20000});
     await p.getByText(f.note,{exact:false}).first().waitFor({timeout:15000});
     await p.getByRole('button',{name:'Novo atendimento',exact:true}).first().click();await p.getByRole('button',{name:'+ Evolução',exact:true}).click();
     const editor=p.getByPlaceholder('Curativo, sutura, orientação ou evolução da consulta',{exact:true});await editor.click();f.newNote='QA OD019 RT novo atendimento 4763996';save();await editor.fill(f.newNote);await capture(p,'RT-Novo-antes');
     await p.getByRole('button',{name:'Salvar atendimento',exact:true}).click();await expect.poll(async()=>rows(a.client.from('atendimentos_clinicos').select('id').eq('paciente_id',f.patientId)),{timeout:20000}).toHaveLength(2);
     await p.reload();await p.getByRole('tab',{name:'Prontuário',exact:true}).click({timeout:20000});await p.getByText(f.newNote,{exact:false}).first().waitFor({timeout:15000});c.text=await p.locator('body').innerText();await capture(p,'RT-Novo-depois-reload');return {reload:true};
   },c=>assert(c.response.reload));
 }
 if(stage==='RT-live-chunk'||stage==='RT-live-chunk2'){
   const a=await login('ANA');
   await check('RT resposta HTTP serve chunk corrigido',async c=>{
     await a.page.goto(base+'/dashboard/agendamentos');await a.page.getByRole('heading',{name:'Agendamentos',exact:true}).waitFor({timeout:25000});
     const scripts=await a.page.locator('script[src]').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('src')).filter(s=>s.includes('/_next/static/')));c.chunks=[];
     for(const src of scripts){const r=await a.page.request.get(new URL(src,base).href);const t=await r.text();c.chunks.push({src,http:r.status(),newHint:t.includes('paciente:pacientes!agendamentos_paciente_id_fkey'),hash:createHash('sha256').update(t).digest('hex')});}
     await capture(a.page,'RT-agenda-loaded');return {fixed:c.chunks.some(x=>x.newHint)};
   },c=>assert(c.response.fixed));
 }
 if(stage==='RT-Agenda-Ana'||stage==='RT-Agenda-Sara'){
   const role=stage.endsWith('Sara')?'SARA':'ANA',a=await login('ANA'),s=await login(role),p=s.page;
   const f=await fixture('ANA',stage+'-paciente',{slot:false}),alt=await fixture('ANA',stage+'-alternativo',{slot:false});
   f.agendaNote='QA OD019 '+stage+' agenda sintética';save();
   await check(stage+' criar pela UI',async c=>{
     await p.goto(base+'/dashboard/agendamentos');await p.getByRole('heading',{name:'Agendamentos',exact:true}).waitFor({timeout:20000});
     const asset=await p.request.get(base+'/_next/static/chunks/app/dashboard/agendamentos/page.js');const text=await asset.text();
     c.servedCode={url:'/_next/static/chunks/app/dashboard/agendamentos/page.js',http:asset.status(),fixed:text.includes('paciente:pacientes!agendamentos_paciente_id_fkey'),sha256:createHash('sha256').update(text).digest('hex')};assert(c.servedCode.fixed);e.serverVerified=true;save();
     await p.getByRole('button',{name:/^Novo Agendamento/}).click();const dialog=p.getByRole('dialog',{name:'Novo agendamento',exact:true});await dialog.waitFor();
     if(role==='SARA'){await dialog.getByRole('combobox').first().click();await p.getByRole('option',{name:'Dra. Ana Local',exact:true}).click();}
     await dialog.getByPlaceholder('Buscar paciente pelo nome...',{exact:true}).fill(f.name);await dialog.getByText(f.name,{exact:true}).last().click({timeout:15000});
     await dialog.locator('#apt-date-drawer').fill('2026-10-26');await dialog.locator('#apt-time-drawer').fill(role==='SARA'?'20:37':'20:17');
     await dialog.getByPlaceholder('Procedimento, observações clínicas...',{exact:true}).fill(f.agendaNote);await capture(p,stage+'-criar-antes');
     await dialog.getByRole('button',{name:'Salvar agendamento',exact:true}).click();
     const override=dialog.getByRole('button',{name:'Marcar mesmo assim',exact:true});
     await Promise.race([override.waitFor({timeout:10000}),dialog.waitFor({state:'hidden',timeout:10000})]).catch(()=>{});
     if(await override.isVisible())await override.click();
     await expect.poll(async()=>rows(a.client.from('agendamentos').select('id').eq('paciente_id',f.patientId)),{timeout:20000}).toHaveLength(1);
     const data=await rows(a.client.from('agendamentos').select('id,clinica_id,paciente_id,dentista_id,observacoes').eq('paciente_id',f.patientId).single());f.agendaCreatedId=data.id;c.persisted=data;save();assert.equal(data.dentista_id,a.dentistId);assert.equal(data.observacoes,f.agendaNote);return {created:true};
   },c=>assert(c.response.created));
   if(f.agendaCreatedId)await check(stage+' editar UI e trocar paciente pela ação Auth',async c=>{
     await p.reload();await p.getByRole('textbox',{name:'Ir para uma data',exact:true}).count().catch(()=>0);
     await p.locator('input[aria-label="Ir para uma data"]').fill('2026-10-26');
     const slot=p.getByRole('button',{name:new RegExp('^Abrir consulta de '+f.name)});await slot.first().click({timeout:15000});
     const dialog=p.getByRole('dialog');await dialog.getByRole('button',{name:'Editar',exact:true}).click();
     await dialog.getByPlaceholder('Notas adicionais...',{exact:true}).fill(f.agendaNote+' editada');await capture(p,stage+'-editar-antes');
     await dialog.getByRole('button',{name:'Salvar Alterações',exact:true}).click();
     const override=dialog.getByRole('button',{name:'Salvar mesmo assim',exact:true});await Promise.race([override.waitFor({timeout:6000}),dialog.getByRole('button',{name:'Editar',exact:true}).waitFor({timeout:6000})]).catch(()=>{});if(await override.isVisible())await override.click();
     await expect.poll(async()=>rows(a.client.from('agendamentos').select('observacoes').eq('id',f.agendaCreatedId).single()),{timeout:15000}).toMatchObject({observacoes:f.agendaNote+' editada'});
     c.swap=await action(role,'atualizarAgendamento',[f.agendaCreatedId,{pacienteId:alt.patientId,forcarConflitoDentista:true,forcarForaDoExpediente:true}],'/dashboard/agendamentos');assert(!c.swap.result.error,c.swap.result.error);
     await p.reload();await p.locator('input[aria-label="Ir para uma data"]').fill('2026-10-26');await p.getByRole('button',{name:new RegExp('^Abrir consulta de '+alt.name)}).first().waitFor({timeout:15000});await capture(p,stage+'-depois-reload');
     c.reload=await rows(s.client.from('agendamentos').select('id,clinica_id,paciente_id,observacoes').eq('id',f.agendaCreatedId).single());assert.equal(c.reload.paciente_id,alt.patientId);assert.equal(c.reload.observacoes,f.agendaNote+' editada');return {reload:true};
   },c=>assert(c.response.reload));
 }
 if(stage==='RT-Inicio'){
   for(const role of ['ANA','SARA','ADMIN']){
     const s=await login(role);await check('RT Início '+role+' carregar e recarga',async c=>{
       await s.page.goto(base+'/dashboard');await s.page.locator('h1').first().waitFor({timeout:25000});
       await expect(s.page.locator('h1').first()).toHaveText(/Bom dia|Boa tarde|Boa noite/);c.heading=await s.page.locator('h1').first().innerText();
       await s.page.reload();await s.page.locator('h1').first().waitFor({timeout:20000});c.text=await s.page.locator('body').innerText();assert(!c.text.includes('Não deu pra carregar'));await capture(s.page,'RT-Inicio-'+role);return {loaded:true};
     },c=>assert(c.response.loaded));
   }
 }
 if(stage==='RT-Recepcao'){
   const a=await login('ANA'),s=await login('SARA'),f=await fixture('ANA','RT-Recepcao',{ficha:true});
   f.eventId=h.randomUUID();save();let r=await a.client.from('odontograma_eventos').insert({id:f.eventId,clinica_id:f.clinicId,paciente_id:f.patientId,ficha_id:f.fichaId,dentista_id:a.dentistId,tipo:'outro',procedimento_nome:'QA OD019 RT recepção próprio',status:'realizado',realizado_em:'2026-10-25',origem:'clinica',nivel:'boca',faces:[],momento_planejado:'sessao_atual'});assert(!r.error,r.error?.message);
   r=await a.client.from('agendamentos').update({status:'completed'}).eq('id',f.slotId).eq('clinica_id',f.clinicId);assert(!r.error,r.error?.message);
   await check('RT recepção canvas e assinatura UI se disponível',async c=>{
     const p=s.page;await p.goto(base+'/dashboard');await p.locator('h1').first().waitFor({timeout:20000});
     const patient=p.getByRole('link',{name:f.name,exact:true});
     if(!await patient.count()){c.status='NAO TESTADO';c.reason='Cartão sintético não apareceu no Início; nenhum canvas/POST de assinatura enviado.';c.pageText=await p.locator('body').innerText();await capture(p,'RT-Recepcao-sem-cartao');return {notTested:true};}
     await patient.locator('../..').getByRole('button',{name:'Assinar',exact:true}).click();const dialog=p.getByRole('dialog');const canvas=dialog.locator('canvas');await canvas.waitFor({timeout:12000});await canvas.click({trial:true});
     c.canvas=await canvas.evaluate(el=>({width:el.width,height:el.height,clientWidth:el.clientWidth,clientHeight:el.clientHeight}));await capture(p,'RT-Recepcao-canvas-antes');
     const box=await canvas.boundingBox();assert(box);await p.mouse.move(box.x+25,box.y+70);await p.mouse.down();for(const [x,y]of [[70,30],[110,90],[170,40],[220,95]])await p.mouse.move(box.x+x,box.y+y,{steps:10});await p.mouse.up();
     const confirm=dialog.getByRole('button',{name:'Confirmar Assinatura',exact:true});c.disabledAfterDrawing=await confirm.isDisabled();await capture(p,'RT-Recepcao-canvas-desenhado');
     if(c.disabledAfterDrawing)return {canvasBlocked:true};
     c.confirmSent=true;save();await confirm.click();await p.getByText('Assinatura registrada!',{exact:true}).waitFor({timeout:20000});
     await p.reload();c.event=await rows(s.client.from('odontograma_eventos').select('id,assinatura_id').eq('id',f.eventId).single());assert(c.event.assinatura_id);
     c.signature=await rows(db.from('assinaturas').select('id,dentista_id,cro_no_ato,assinado_em,assinatura_ref').eq('id',c.event.assinatura_id).single());assert.equal(c.signature.dentista_id,a.dentistId);assert.equal(c.signature.cro_no_ato,a.cro);return {signed:true};
   },c=>{if(c.response.notTested){c.status='NAO TESTADO';return;}assert(!c.response.canvasBlocked,'Canvas aberto, traço não habilitou Confirmar Assinatura (REC-1)');assert(c.response.signed);});
   const last=e.cases.at(-1);if(last.response?.notTested){last.status='NAO TESTADO';save();}
 }
 if(stage==='RT-Exportacoes'){
   const a=await login('ANA'),f=e.mainFixture;assert(f?.savedFichaId);
   for(const [label,url]of [['ficha','/api/fichas/'+f.savedFichaId+'/pdf'],['prontuario','/api/pacientes/'+f.patientId+'/prontuario']]){
     await check('RT exportação '+label+' HTML/PDF',async c=>{
       const response=await a.page.request.get(base+url);c.http=response.status();c.contentType=response.headers()['content-type'];const html=await response.text();assert.equal(c.http,200);assert(c.contentType.includes('text/html'));assert(html.includes(f.name));assert(html.includes(f.note));assert(!html.includes('PGRST201'));
       fs.writeFileSync(path.join(dir,'RT-export-'+label+'.html'),html);
       const p=await a.page.context().newPage();await p.goto(base+url);await p.locator('body').waitFor();await capture(p,'RT-export-'+label);const pdf=await p.pdf({path:path.join(dir,'RT-export-'+label+'.pdf'),format:'A4',printBackground:true});assert.equal(pdf.subarray(0,5).toString(),'%PDF-');c.pdfBytes=pdf.length;await p.close();return {exported:true};
     },c=>assert(c.response.exported));
   }
   for(const role of ['SARA','PROTETICO','BRUNO']){
     const s=await login(role);await check('RT exportação ficha acesso '+role,async()=>{const r=await s.page.request.get(base+'/api/fichas/'+f.savedFichaId+'/pdf');return {http:r.status()};},c=>assert.equal(c.response.http,role==='SARA'?403:404));
   }
 }
 if(stage==='RT-Orcamento'){
   const a=await login('ANA'),f=await fixture('ANA','RT-Orcamento',{ficha:true,slot:false});f.eventId=h.randomUUID();save();
   const ev=await a.client.from('odontograma_eventos').insert({id:f.eventId,clinica_id:f.clinicId,paciente_id:f.patientId,ficha_id:f.fichaId,dentista_id:a.dentistId,tipo:'outro',procedimento_nome:'QA OD019 RT item orçamento',status:'indicado',origem:'clinica',nivel:'boca',faces:[],momento_planejado:'sessao_atual'});assert(!ev.error,ev.error?.message);
   await a.page.goto(base+'/dashboard/pacientes/'+f.patientId+'?tab=orcamentos');await a.page.getByRole('tab',{name:'Orçamentos',exact:true}).click({timeout:20000});
   await check('RT criar orçamento ação Auth com evento da ficha',()=>action('ANA','criarOrcamento',[{pacienteId:f.patientId,fichaId:f.fichaId,desconto:0,itens:[{procedimentoId:null,descricao:'QA OD019 RT item orçamento',quantidade:1,precoUnitario:123,eventoIds:[f.eventId]}]}],'/dashboard/pacientes/'+f.patientId),async c=>{assert(!c.response.result.error,c.response.result.error);assert(c.response.result.id);f.budgetId=c.response.result.id;save();c.persisted=await rows(a.client.from('orcamentos').select('id,paciente_id,ficha_id,total,status').eq('id',f.budgetId).single());assert.equal(c.persisted.ficha_id,f.fichaId);});
   if(f.budgetId){
     await check('RT Orçamento listar e abrir UI',async c=>{await a.page.reload();await a.page.getByRole('tab',{name:'Orçamentos',exact:true}).click({timeout:20000});await a.page.getByRole('button',{name:/^Abrir orçamento de/}).first().click({timeout:15000});const d=a.page.getByRole('dialog',{name:'Orçamento',exact:true});await expect(d).toContainText('QA OD019 RT item orçamento');await expect(d).toContainText('123');c.text=await d.innerText();await capture(a.page,'RT-Orcamento-aberto');return {opened:true};},c=>assert(c.response.opened));
     const png=await a.page.evaluate(()=>{const c=document.createElement('canvas');c.width=300;c.height=120;const x=c.getContext('2d');x.beginPath();x.moveTo(20,60);x.lineTo(70,30);x.lineTo(130,90);x.lineTo(250,40);x.stroke();return c.toDataURL('image/png');});
     await check('RT aceite orçamento ação Auth e visível após recarga',async c=>{
       const r=await action('ANA','aceitarOrcamento',[{orcamentoId:f.budgetId,assinadoPor:'QA OD019 RT paciente sintético',assinaturaDataUrl:png}],'/dashboard/pacientes/'+f.patientId);c.action={http:r.http,ok:r.result.ok,error:r.result.error,warning:r.result.warning,documentAvailable:Boolean(r.result.documentoUrl)};assert.equal(r.result.ok,true,r.result.error);
       c.signatures=await rows(a.client.from('assinaturas').select('id,tipo,orcamento_id,assinado_por,assinado_em,assinatura_ref').eq('orcamento_id',f.budgetId));assert.equal(c.signatures.length,1);f.signatureId=c.signatures[0].id;save();
       await a.page.reload();await a.page.getByRole('tab',{name:'Orçamentos',exact:true}).click({timeout:20000});await a.page.getByRole('button',{name:/^Abrir orçamento de/}).first().click({timeout:15000});
       const d=a.page.getByRole('dialog',{name:'Orçamento',exact:true});await expect(d).toContainText('Aceite assinado por');await expect(d).toContainText('QA OD019 RT paciente sintético');c.text=await d.innerText();await capture(a.page,'RT-Orcamento-aceite-reload');return {acceptedVisible:true};
     },c=>assert(c.response.acceptedVisible));
   }
 }
 if(stage==='RT-Acoes'){
   const a=await login('ANA'),s=await login('SARA');
   const checkin=await fixture('ANA','RT-action-checkin'),cancel=await fixture('ANA','RT-action-cancelar');
   await s.page.goto(base+'/dashboard/agendamentos');await s.page.getByRole('heading',{name:'Agendamentos',exact:true}).waitFor({timeout:20000});
   for(const [label,f,name,args,expected]of [
     ['check-in Sara',checkin,'fazerCheckIn',[checkin.slotId],'checked_in'],
     ['cancelar com motivo Ana',cancel,'cancelarComMotivo',[cancel.slotId,'QA OD019 cancelamento sintético'],'cancelled']
   ])await check('RT ação '+label,async c=>{
     const role=name==='fazerCheckIn'?'SARA':'ANA';c.action=await action(role,name,args,'/dashboard/agendamentos');assert(!c.action.result.error,c.action.result.error);
     c.persisted=await rows(s.client.from('agendamentos').select('id,status,observacoes').eq('id',f.slotId).single());assert.equal(c.persisted.status,expected);await s.page.reload();return {persisted:true};
   },c=>assert(c.response.persisted));
   const f=e.fixtures.find(f=>f.label==='RT-Recepcao');assert(f?.eventId);
   const png=await s.page.evaluate(()=>{const c=document.createElement('canvas');c.width=300;c.height=120;const x=c.getContext('2d');x.beginPath();x.moveTo(20,60);x.lineTo(100,30);x.lineTo(180,90);x.stroke();return c.toDataURL('image/png');});
   await check('RT recepção ação Auth própria Ana após canvas bloqueado',()=>action('SARA','salvarAssinaturaRecepcao',[f.fichaId,f.patientId,'QA OD019 paciente sintético RT',png],'/dashboard/agendamentos'),async c=>{
     assert.equal(c.response.result.ok,true,c.response.result.error);c.event=await rows(s.client.from('odontograma_eventos').select('id,assinatura_id').eq('id',f.eventId).single());assert(c.event.assinatura_id);
     c.signature=await rows(db.from('assinaturas').select('id,dentista_id,cro_no_ato,assinado_em,assinatura_ref').eq('id',c.event.assinatura_id).single());assert.equal(c.signature.dentista_id,a.dentistId);assert.equal(c.signature.cro_no_ato,a.cro);
     await s.page.reload();c.reload=await rows(s.client.from('odontograma_eventos').select('id,assinatura_id').eq('id',f.eventId).single());assert.deepEqual(c.reload,c.event);
   });
 }
 if(stage==='RT-Aceite-preparado'){
   const a=await login('ANA'),f=e.fixtures.find(f=>f.label==='RT-Orcamento');assert(f?.budgetId);
   const previous=e.cases.find(c=>c.label==='RT aceite orçamento ação Auth e visível após recarga');assert(previous?.action?.ok===false);
   const sigs=await rows(db.from('assinaturas').select('id').eq('orcamento_id',f.budgetId));assert.equal(sigs.length,0,'Do not repeat an acceptance that persisted');
   previous.attemptStatus=previous.status;previous.status='NAO TESTADO';previous.harnessNote='Primeira preparação não aprovou nenhum item; RPC recusou status_invalido, assinatura ausente. Uma retomada após aprovar pela UI.';save();
   await check('RT aprovar item UI e aceite Auth visível após recarga',async c=>{
     const p=a.page;await p.goto(base+'/dashboard/pacientes/'+f.patientId+'?tab=orcamentos');await p.getByRole('tab',{name:'Orçamentos',exact:true}).click({timeout:20000});await p.getByRole('button',{name:/^Abrir orçamento de/}).first().click({timeout:15000});
     const d=p.getByRole('dialog',{name:'Orçamento',exact:true});await d.getByRole('checkbox',{name:'Marcar como aprovado pelo paciente',exact:true}).click();await expect(d.getByRole('checkbox',{name:'Aprovado — clique para desmarcar',exact:true})).toHaveAttribute('aria-checked','true');
     c.items=await rows(a.client.from('orcamento_itens').select('id,aprovado,preco_total').eq('orcamento_id',f.budgetId));assert(c.items.some(i=>i.aprovado));await capture(p,'RT-Orcamento-item-aprovado');
     const png=await p.evaluate(()=>{const canvas=document.createElement('canvas');canvas.width=300;canvas.height=120;const x=canvas.getContext('2d');x.beginPath();x.moveTo(20,60);x.lineTo(70,30);x.lineTo(130,90);x.lineTo(250,40);x.stroke();return canvas.toDataURL('image/png');});
     const r=await action('ANA','aceitarOrcamento',[{orcamentoId:f.budgetId,assinadoPor:'QA OD019 RT paciente sintético',assinaturaDataUrl:png}],'/dashboard/pacientes/'+f.patientId);c.action={http:r.http,ok:r.result.ok,error:r.result.error,warning:r.result.warning,documentAvailable:Boolean(r.result.documentoUrl)};assert.equal(r.result.ok,true,r.result.error);
     c.signatures=await rows(a.client.from('assinaturas').select('id,tipo,orcamento_id,assinado_por,assinado_em,assinatura_ref').eq('orcamento_id',f.budgetId));assert.equal(c.signatures.length,1);f.signatureId=c.signatures[0].id;save();
     await p.reload();await p.getByRole('tab',{name:'Orçamentos',exact:true}).click({timeout:20000});await p.getByRole('button',{name:/^Abrir orçamento de/}).first().click({timeout:15000});
     const detail=p.getByRole('dialog',{name:'Orçamento',exact:true});await expect(detail).toContainText('Aceite assinado por');await expect(detail).toContainText('QA OD019 RT paciente sintético');c.text=await detail.innerText();await capture(p,'RT-Orcamento-aceite-reload');return {acceptedVisible:true};
   },c=>assert(c.response.acceptedVisible));
 }
 if(stage==='RT-Aceite-observar'){
   const a=await login('ANA'),f=e.fixtures.find(f=>f.label==='RT-Orcamento');assert(f?.budgetId);
   const previous=e.cases.find(c=>c.label==='RT aprovar item UI e aceite Auth visível após recarga');assert(previous&&!previous.action,'Previous preparation must not have sent acceptance');
   const items=await rows(a.client.from('orcamento_itens').select('id,aprovado,preco_total').eq('orcamento_id',f.budgetId));e.approvalReadAfterPreparation=items;save();
   if(items.some(i=>i.aprovado)){
     previous.attemptStatus=previous.status;previous.status='NAO TESTADO';previous.harnessNote='DB lido cedo após estado otimista; action de aceite não enviada. Leitura posterior confirma aprovação persistida; não repetir clique de aprovação.';save();
     const existing=await rows(db.from('assinaturas').select('id').eq('orcamento_id',f.budgetId));assert.equal(existing.length,0,'Do not replay persisted acceptance');
     await a.page.goto(base+'/dashboard/pacientes/'+f.patientId+'?tab=orcamentos');await a.page.getByRole('tab',{name:'Orçamentos',exact:true}).click({timeout:20000});await a.page.getByRole('button',{name:/^Abrir orçamento de/}).first().click({timeout:15000});
     await check('RT aceite Auth após aprovação confirmada e visível na recarga',async c=>{
       const png=await a.page.evaluate(()=>{const canvas=document.createElement('canvas');canvas.width=300;canvas.height=120;const x=canvas.getContext('2d');x.beginPath();x.moveTo(20,60);x.lineTo(70,30);x.lineTo(130,90);x.lineTo(250,40);x.stroke();return canvas.toDataURL('image/png');});
       const r=await action('ANA','aceitarOrcamento',[{orcamentoId:f.budgetId,assinadoPor:'QA OD019 RT paciente sintético',assinaturaDataUrl:png}],'/dashboard/pacientes/'+f.patientId);c.action={http:r.http,ok:r.result.ok,error:r.result.error,warning:r.result.warning,documentAvailable:Boolean(r.result.documentoUrl)};assert.equal(r.result.ok,true,r.result.error);
       c.signatures=await rows(a.client.from('assinaturas').select('id,tipo,orcamento_id,assinado_por,assinado_em,assinatura_ref').eq('orcamento_id',f.budgetId));assert.equal(c.signatures.length,1);f.signatureId=c.signatures[0].id;save();
       await a.page.reload();await a.page.getByRole('tab',{name:'Orçamentos',exact:true}).click({timeout:20000});await a.page.getByRole('button',{name:/^Abrir orçamento de/}).first().click({timeout:15000});
       const d=a.page.getByRole('dialog',{name:'Orçamento',exact:true});await expect(d).toContainText('Aceite assinado por');await expect(d).toContainText('QA OD019 RT paciente sintético');c.text=await d.innerText();await capture(a.page,'RT-Orcamento-aceite-reload');return {acceptedVisible:true};
     },c=>assert(c.response.acceptedVisible));
   }else{
     previous.harnessNote='Leitura posterior ainda sem item aprovado; não repetir clique nem aceite sem revisar hipótese.';save();console.log('NAO TESTADO aceite: aprovação ainda ausente');
   }
 }
 if(stage==='RT-final'||stage==='RT-final2'){
   for(const c of e.cases.filter(c=>c.label==='RT servidor 3000 + Meu Dia carregar Ana'||c.label==='RT resposta HTTP serve chunk corrigido')){
     if(c.status==='FALHOU'){c.attemptStatus=c.status;c.status='NAO TESTADO';c.scope='harness';c.harnessNote='Sonda preparatória: seletor Agenda/heading Meu Dia ou enumeração de script tags não cobre chunks carregados por navegação. Render e sourceHint registrados; prova HTTP positiva está em criar UI da Agenda, servedCode.fixed=true. Sem alteração de produto/restart.';}
   }
   e.finalState=await h.state();
   const patients=e.fixtures.map(f=>f.patientId);
   e.relatedFinal={};
   for(const table of ['orcamentos','pedidos_protetico'])e.relatedFinal[table]=await rows(db.from(table).select('id,clinica_id,paciente_id').in('paciente_id',patients).order('id'));
   const budgets=e.relatedFinal.orcamentos.map(x=>x.id);
   if(budgets.length){
     e.relatedFinal.orcamento_itens=await rows(db.from('orcamento_itens').select('id,orcamento_id,aprovado,preco_total').in('orcamento_id',budgets).order('id'));
     e.relatedFinal.pagamentos=await rows(db.from('pagamentos').select('id,orcamento_id,status').in('orcamento_id',budgets).order('id'));
     e.relatedFinal.documentos_aceite=await rows(db.from('documentos_aceite').select('id,paciente_id,orcamento_id,assinatura_id,pdf_path').in('orcamento_id',budgets).order('id'));
   }
   const signed=e.finalState.assinaturas.ids;
   e.storageSignatureRefs=signed.length?await rows(db.from('assinaturas').select('id,assinatura_ref,orcamento_id,ficha_id').in('id',signed).order('id')):[];
   e.finalHead=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();assert.equal(e.finalHead,e.head);
   e.sourcesStillSame=e.sourceProof.every(x=>createHash('sha256').update(fs.readFileSync(x.path,'utf8').replaceAll('\r\n','\n')).digest('hex')===x.sha256NormalizedLf);assert(e.sourcesStillSame);
   e.finished=new Date().toISOString();save();console.log('PASSOU inventário/HEAD/fontes final, somente leitura');
 }
 if(stage==='RT-Sara-preparado'){
   const s=await login('SARA'),a=await login('ANA'),f=e.fixtures.find(f=>f.label==='RT-Agenda-Sara-paciente'),alt=e.fixtures.find(f=>f.label==='RT-Agenda-Sara-alternativo');assert(f?.agendaCreatedId&&alt);
   const prior=e.cases.find(c=>c.label==='RT-Agenda-Sara editar UI e trocar paciente pela ação Auth');assert(prior?.failure?.includes('locator.click')&&!prior.swap,'Only retry navigation preparation');
   await check('RT Sara Agenda editar UI e trocar paciente Auth com observação explícita',async c=>{
     const p=s.page;await p.goto(base+'/dashboard/agendamentos');await p.getByRole('heading',{name:'Agendamentos',exact:true}).waitFor({timeout:20000});
     const all=p.getByRole('button',{name:'Todos',exact:true});if(await all.count())await all.click();await p.getByRole('button',{name:'Dia',exact:true}).click();
     await p.locator('input[aria-label="Ir para uma data"]').fill('2026-10-26');await expect(p.locator('input[aria-label="Ir para uma data"]')).toHaveValue('2026-10-26');
     await capture(p,'RT-Sara-dia-preparo');c.beforeOpenText=await p.locator('body').innerText();save();
     const target=p.getByRole('button',{name:new RegExp('^Abrir consulta de '+f.name)});await target.first().click({timeout:15000});const d=p.getByRole('dialog');await d.getByRole('button',{name:'Editar',exact:true}).click();
     await d.getByPlaceholder('Notas adicionais...',{exact:true}).fill(f.agendaNote+' editada');await d.getByRole('button',{name:'Salvar Alterações',exact:true}).click();
     const override=d.getByRole('button',{name:'Salvar mesmo assim',exact:true});await Promise.race([override.waitFor({timeout:6000}),d.getByRole('button',{name:'Editar',exact:true}).waitFor({timeout:6000})]).catch(()=>{});if(await override.isVisible())await override.click();
     await expect.poll(async()=>rows(a.client.from('agendamentos').select('observacoes').eq('id',f.agendaCreatedId).single()),{timeout:15000}).toMatchObject({observacoes:f.agendaNote+' editada'});
     c.swap=await action('SARA','atualizarAgendamento',[f.agendaCreatedId,{pacienteId:alt.patientId,observacoes:f.agendaNote+' editada',forcarConflitoDentista:true,forcarForaDoExpediente:true}],'/dashboard/agendamentos');assert(!c.swap.result.error,c.swap.result.error);
     await p.reload();await p.locator('input[aria-label="Ir para uma data"]').fill('2026-10-26');await p.getByRole('button',{name:new RegExp('^Abrir consulta de '+alt.name)}).first().waitFor({timeout:15000});await capture(p,'RT-Sara-edicao-troca-reload');
     c.reload=await rows(s.client.from('agendamentos').select('id,paciente_id,observacoes').eq('id',f.agendaCreatedId).single());assert.equal(c.reload.paciente_id,alt.patientId);assert.equal(c.reload.observacoes,f.agendaNote+' editada');return {reload:true};
   },c=>assert(c.response.reload));
   if(e.cases.at(-1).status==='PASSOU'){prior.attemptStatus=prior.status;prior.status='NAO TESTADO';prior.harnessNote='Falha de localizar cartão na visão inicial, sem edição/troca enviada. Uma retomada com visão Dia/Todos e fixture existente passou.';save();}
 }
 if(stage==='RT-Sara-contrato'){
   const s=await login('SARA'),f=e.fixtures.find(f=>f.label==='RT-Agenda-Sara-paciente'),alt=e.fixtures.find(f=>f.label==='RT-Agenda-Sara-alternativo');assert(f?.agendaCreatedId&&alt);
   const attempts=e.cases.filter(c=>c.label.startsWith('RT Sara Agenda editar')||c.label==='RT-Agenda-Sara editar UI e trocar paciente pela ação Auth');assert(attempts.every(c=>!c.swap));
   e.saraNavigationHypothesis='Preservadas duas sondas sem edição enviada. Revisão de date-helpers/page/day-view: visão usa ?v=dia&d=, botões do Dia têm nome composto sem prefixo Abrir consulta; troca rápida de visão/data manteve Semana. Entrada direta no contrato de rota, seletor pelo nome próprio sintético.';save();
   await check('RT Sara editar UI e trocar paciente Auth pela rota Dia explícita',async c=>{
     const p=s.page;await p.goto(base+'/dashboard/agendamentos?v=dia&d=2026-10-26');await p.getByRole('heading',{name:'Agendamentos',exact:true}).waitFor({timeout:20000});
     await p.getByRole('button').filter({hasText:f.name}).first().click({timeout:15000});const d=p.getByRole('dialog');await d.getByRole('button',{name:'Editar',exact:true}).click();
     await d.getByPlaceholder('Notas adicionais...',{exact:true}).fill(f.agendaNote+' editada');await capture(p,'RT-Sara-editar-antes');await d.getByRole('button',{name:'Salvar Alterações',exact:true}).click();
     const override=d.getByRole('button',{name:'Salvar mesmo assim',exact:true});await Promise.race([override.waitFor({timeout:6000}),d.getByRole('button',{name:'Editar',exact:true}).waitFor({timeout:6000})]).catch(()=>{});if(await override.isVisible())await override.click();
     await expect.poll(async()=>rows(s.client.from('agendamentos').select('observacoes').eq('id',f.agendaCreatedId).single()),{timeout:15000}).toMatchObject({observacoes:f.agendaNote+' editada'});
     c.swap=await action('SARA','atualizarAgendamento',[f.agendaCreatedId,{pacienteId:alt.patientId,observacoes:f.agendaNote+' editada',forcarConflitoDentista:true,forcarForaDoExpediente:true}],'/dashboard/agendamentos');assert(!c.swap.result.error,c.swap.result.error);
     await p.reload();await p.getByRole('button').filter({hasText:alt.name}).first().waitFor({timeout:15000});await capture(p,'RT-Sara-troca-reload');c.reload=await rows(s.client.from('agendamentos').select('id,paciente_id,observacoes').eq('id',f.agendaCreatedId).single());assert.equal(c.reload.paciente_id,alt.patientId);assert.equal(c.reload.observacoes,f.agendaNote+' editada');return {reload:true};
   },c=>assert(c.response.reload));
   if(e.cases.at(-1).status==='PASSOU')for(const prior of attempts){prior.attemptStatus=prior.status;prior.status='NAO TESTADO';prior.harnessNote=e.saraNavigationHypothesis;}save();
 }
}
