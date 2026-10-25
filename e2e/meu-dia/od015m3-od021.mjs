// OD-021 read-only UI coverage on the same frozen snapshot; no financial actions.
export async function run(stage,h){
 const {assert,fs,path,expect,e,save,db,rows,hash,login,check,capture,base,dir}=h;
 const patient='e0210000-0000-4000-8000-000000000001';
 const dates={'e0210000-0000-4000-8000-000000000601':'25/10/2026','e0210000-0000-4000-8000-000000000602':'24/10/2026','e0210000-0000-4000-8000-000000000603':'23/10/2026','e0210000-0000-4000-8000-000000000604':'22/10/2026'};
 const role=stage.split('-').at(-1);assert(['ANA','SARA','ADMIN'].includes(role));const s=await login(role),p=s.page;
 const all=await rows(db.from('orcamentos').select('id,dentista_id,aprovado_por_id,dentista:dentistas!orcamentos_dentista_id_fkey(nome)').eq('paciente_id',patient).order('id'));
 const visible=await rows(s.client.from('orcamentos').select('id,dentista_id,dentista:dentistas!orcamentos_dentista_id_fkey(nome)').eq('paciente_id',patient).order('id'));
 e.od021??={patient,fixtures:all,roles:{}};e.od021.roles[role]={visibleIds:visible.map(x=>x.id),started:new Date().toISOString()};save();
 const ownState=async()=>{
   const budgets=await rows(db.from('orcamentos').select('*').eq('paciente_id',patient).order('id'));
   const items=await rows(db.from('orcamento_itens').select('*').in('orcamento_id',Object.keys(dates)).order('id'));
   return {budgets:hash(budgets),items:hash(items)};
 };
 const initial=await ownState();e.od021.initial??=initial;(e.od021.fixturePhases??=[]).push({stage,initial,visibleIds:visible.map(x=>x.id)});assert(visible.length>0,'No visible budget: fixture precondition, not a rendering verdict');
 if(role==='ANA'){
   await p.goto(base+'/dashboard/pacientes/'+patient+'?tab=orcamentos',{waitUntil:'commit'});
   const status=p.getByRole('status').first();const c={label:'OD021 carregando natural',status:'NAO TESTADO'};
   if(await status.isVisible().catch(()=>false)){c.text=await status.innerText();await capture(p,'OD021-carregando-natural');c.status='PASSOU';}else c.reason='Estado transitório não observável na amostra sem injetar falha/atraso no servidor.';
   e.cases.push(c);save();
 }
 for(const width of [1440,390])for(const theme of ['light','dark']){
   await p.setViewportSize({width,height:width===390?844:1000});await p.goto(base+'/dashboard/pacientes/'+patient+'?tab=orcamentos');await p.evaluate(theme=>localStorage.setItem('theme',theme),theme);await p.reload();
   await check(`OD021 ${role} ${width} ${theme} lista/detalhe/reload/PDF`,async c=>{
     await p.getByRole('tab',{name:'Orçamentos',exact:true}).click({timeout:20000});
     const cards=p.getByRole('button',{name:/^Abrir orçamento de/});await cards.first().waitFor({timeout:15000});assert.equal(await cards.count(),visible.length,'UI/Auth visibility differs');
     c.budgets=[];await capture(p,`OD021-${role}-${width}-${theme}-lista`);
     for(const item of visible){
       const expected=item.dentista?.nome??'—';const card=p.getByRole('button',{name:new RegExp('^Abrir orçamento de '+dates[item.id])});await expect(card).toContainText('Dentista responsável: '+expected);const listText=await card.innerText();
       await card.click();const d=p.getByRole('dialog',{name:'Orçamento',exact:true});await expect(d).toContainText('Dentista responsável: '+expected);
       const label=d.locator('p').filter({hasText:'Dentista responsável:'}).first();const box=await label.boundingBox();assert(box);assert(box.x>=-1&&box.x+box.width<=width+1,'Doctor label overflows');
       const record={id:item.id,expected,listText,detailText:await label.innerText()};
       if(width===1440&&theme==='light'){
         const r=await p.request.get(base+'/api/orcamentos/'+item.id+'/pdf');record.pdfHttp=r.status();assert.equal(r.status(),200);const html=await r.text();record.pdfContainsName=item.dentista?.nome?html.includes(item.dentista.nome):null;if(item.dentista?.nome)assert(record.pdfContainsName);
         fs.writeFileSync(path.join(dir,'snapshot3012',`OD021-${role}-${item.id}-pdf.html`),html);
         const pdfFile=path.join(dir,'snapshot3012',`OD021-${item.id}.pdf`);
         if(!fs.existsSync(pdfFile)){
           const pdfPage=await p.context().newPage();await pdfPage.goto(base+'/api/orcamentos/'+item.id+'/pdf');await pdfPage.pdf({path:pdfFile,format:'A4',printBackground:true});await pdfPage.close();
         }
       }
       c.budgets.push(record);await capture(p,`OD021-${role}-${width}-${theme}-${dates[item.id].slice(0,2)}-detalhe`);await d.getByRole('button',{name:'Fechar',exact:true}).last().click();
     }
     await p.reload();await p.getByRole('tab',{name:'Orçamentos',exact:true}).click({timeout:20000});await expect(p.getByRole('button',{name:/^Abrir orçamento de/})).toHaveCount(visible.length);
     for(const item of visible)await expect(p.getByRole('button',{name:new RegExp('^Abrir orçamento de '+dates[item.id])})).toContainText('Dentista responsável: '+(item.dentista?.nome??'—'));
     c.reloaded=true;return {verified:true};
   },async c=>{assert(c.response.verified);assert.deepEqual(await ownState(),initial,'Read-only OD021 changed fixture');});
 }
 e.od021.roles[role].finished=new Date().toISOString();e.od021.final=await ownState();assert.deepEqual(e.od021.final,initial);save();
 if(role==='ADMIN'){
   for(const old of e.cases.filter(c=>c.label.startsWith('OD021 ADMIN')&&c.failure?.includes("cards")).concat(e.cases.filter(c=>c.label.startsWith('OD021 ADMIN')&&c.failure?.includes('Abrir orçamento de')))){old.attemptStatus=old.status;old.status='NAO TESTADO';old.harnessNote='Fixture inicial não tinha orçamento de autoria admin; Auth retornava zero. Acrescentado orçamento próprio sintético, sem mudar RLS; rodada corrigida preservada.';}
   e.cases.push({label:'OD021 erro do leitor SSR/releitura',status:'NAO TESTADO',reason:'Nenhuma falha do leitor ocorreu com Auth real; provocar erro do fetch SSR exigiria alterar servidor/banco ou simular payload. Sem injeção de falha global no snapshot compartilhado e sem alegar prova de erro.'});save();
 }
}
