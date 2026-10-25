import { createClient } from '@supabase/supabase-js';
import { createHash } from 'node:crypto';
import { test, expect, baseURL, before, login, capture, theme } from './support';
import type { Page, TestInfo } from '@playwright/test';

test.describe.configure({retries:0,timeout:240000});
test.beforeEach(()=>{test.skip(before || process.env.INICIO_RETEST_READY !== 'afdf3d0','Escritas exigem INICIO_RETEST_READY=afdf3d0 e fixture própria ainda sem gravação.');});
type Visit={name:string;slotId:string;patientId:string};
async function day(page:Page,visit?:Visit) {
  await page.goto(baseURL+'/dashboard/meu-dia'+(visit?'?ag='+visit.slotId:''));
  await expect(page.getByRole('heading',{name:'Meu Dia',exact:true})).toBeVisible({timeout:60000});
  if(visit) await page.locator('[data-rail-alvo="'+visit.slotId+'"]').click();
}
async function visit(page:Page,info:TestInfo,label:string):Promise<Visit> {
  const db=observer();
  const prior=await db.from('pacientes').select('id,nome').like('nome','QA INICIO3 '+label+' %').order('created_at',{ascending:false}).limit(1);
  if(prior.error)throw Error('Consulta da fixture própria indisponível.');
  if(prior.data.length){
    const patient=prior.data[0];
    const slots=await db.from('agendamentos').select('id').eq('paciente_id',patient.id).order('data_hora',{ascending:false}).limit(1);
    if(slots.error||!slots.data.length)throw Error('Fixture própria sem slot; não recriar automaticamente.');
    const own={name:String(patient.nome),patientId:String(patient.id),slotId:String(slots.data[0].id)};
    if((await snapshot(own)).counts[0]!==0)throw Error('Fixture já tem gravação; não repetir save automaticamente.');
    await info.attach('fixture-propria-reutilizada',{body:JSON.stringify(own),contentType:'application/json'});
    await day(page,own);
    await expect(page.getByRole('heading',{name:own.name,exact:true})).toBeVisible({timeout:30000});
    return own;
  }
  const name='QA INICIO3 '+label+' '+Date.now();
  await day(page);
  await page.getByRole('button',{name:/^(Encaixe|Atender agora)$/}).click();
  const dialog=page.getByRole('dialog',{name:'Atender agora',exact:true});
  await dialog.getByPlaceholder('Buscar por nome...', {exact:true}).fill(name);
  await dialog.getByRole('button',{name:'Cadastrar “'+name+'” e atender',exact:true}).click();
  await expect(page.getByRole('heading',{name,exact:true})).toBeVisible({timeout:30000});
  const selected=page.locator('[data-rail-alvo][aria-pressed=true]');
  const slotId=await selected.getAttribute('data-rail-alvo');
  const href=await page.getByRole('link',{name:/Ver perfil completo/}).getAttribute('href');
  const patientId=href?.match(/pacientes\/([\da-f-]{36})/i)?.[1];
  if(!slotId||!patientId)throw Error('Fixture criada mas IDs não confirmados; não repetir criação.');
  const own={name,slotId,patientId};
  await info.attach('fixture-propria',{body:JSON.stringify(own),contentType:'application/json'});
  return own;
}
function observer() {
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url||new URL(url).host!=='uhuxteswtvgdnlixwrdu.supabase.co'||!key)throw Error('Observador QA indisponível.');
  return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:(input,init)=>{
    if((init?.method??'GET').toUpperCase()!=='GET')throw Error('Observador QA só permite SELECT.');
    return fetch(input,init);
  }}});
}
async function snapshot(own:Visit) {
  const db=observer();
  const fichas=await db.from('fichas').select('*').eq('paciente_id',own.patientId).order('id');
  if(fichas.error)throw Error('Leitura de integridade indisponível.');
  const ids=(fichas.data??[]).map(f=>String(f.id));
  const rows=await Promise.all([
    db.from('atendimentos_clinicos').select('*').eq('paciente_id',own.patientId).order('id'),
    db.from('odontograma_eventos').select('*').eq('paciente_id',own.patientId).order('id'),
    ids.length?db.from('ficha_evolucoes').select('*').in('ficha_id',ids).order('id'):Promise.resolve({data:[],error:null}),
  ]);
  if(rows.some(r=>r.error))throw Error('Leitura de integridade indisponível.');
  const all=[fichas.data,...rows.map(r=>r.data)];
  return {counts:all.map(r=>r?.length??0),hash:createHash('sha256').update(JSON.stringify(all)).digest('hex')};
}
test('OD001r MD03 restauração exige face, dentes móveis e decíduos',async({page},info)=>{
  await login(page); const own=await visit(page,info,'FacesDentes');
  for(const width of [1440,900,390])for(const dark of [false,true]){
    await page.setViewportSize({width:1440,height:900});await theme(page,dark);
    await page.setViewportSize({width,height:900});
    const teeth=page.getByRole('button',{name:/^Dente \d+ —/});
    await expect(teeth).toHaveCount(32);
    const boxes=await teeth.evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect();return{w:r.width,y:Math.round(r.y)}}));
    const rows=new Map<number,number>();for(const b of boxes)rows.set(b.y,(rows.get(b.y)??0)+1);
    expect([...rows.values()]).toEqual(width===390?[8,8,8,8]:[16,16]);
    if(width===390)expect(Math.min(...boxes.map(b=>b.w))).toBeGreaterThanOrEqual(32);
    const m=await capture(page,info,'MD03-'+width+'-'+(dark?'escuro':'claro'));expect(m.scrollWidth).toBeLessThanOrEqual(width);
  }
  await page.setViewportSize({width:1440,height:900});
  for(const n of [26,27])await page.getByRole('button',{name:new RegExp('^Dente '+n+' —')}).click();
  const doc=page.getByRole('region',{name:'Documento do atendimento',exact:true});
  const initial=await doc.innerText();
  await page.getByRole('button',{name:'Restauração',exact:true}).click();
  await expect(page.getByText('Escolha ao menos uma face para a Restauração',{exact:true})).toBeVisible();
  expect(await doc.innerText()).toBe(initial);
  await page.getByRole('button',{name:'Face M',exact:true}).click();
  await page.getByRole('button',{name:'Face Oclusal',exact:true}).click();
  await page.getByRole('button',{name:'Restauração',exact:true}).click();
  for(const n of [26,27]) { await expect(doc.getByRole('combobox',{name:'Nome do procedimento '+n,exact:true})).toHaveValue('Restauração'); for(const face of ['M','O']) await expect(doc.getByRole('button',{name:'Face '+face+' do procedimento '+n,exact:true})).toHaveAttribute('aria-pressed','true'); }
  expect(await doc.innerText()).not.toBe(initial);
  await capture(page,info,'OD001r-com-faces');
  // Nada clínico é salvo neste teste.
  expect((await snapshot(own)).counts[0]).toBe(0);
});
test('MD01 f1 salvar normal PSR persiste em fixture própria',async({page},info)=>{
  await login(page); const own=await visit(page,info,'PSRNormal');
  await page.getByRole('button',{name:/Adicionar tabela/}).click();
  await page.getByRole('menuitem',{name:'Periodontia (PSR)',exact:true}).click();
  for(const code of [0,1,2]){
    await page.getByRole('button',{name:/^S1 —/}).click();
    await expect(page.getByRole('button',{name:new RegExp('^S1 —.*código '+code)})).toBeVisible();
  }
  await page.getByRole('button',{name:'Remover tabela',exact:true}).click();
  await page.getByRole('button',{name:'Desfazer',exact:true}).click();
  await page.getByRole('button',{name:/^S1 —/}).click();
  await expect(page.getByRole('button',{name:/^S1 —.*código 3/})).toBeVisible();
  await capture(page,info,'MD01-PSR-codigo3');
  await page.getByRole('button',{name:'Salvar atendimento',exact:true}).click();
  await expect(page.locator('[data-rail-alvo="'+own.slotId+'"]')).toContainText('registrado',{timeout:60000});
  const db=observer();
  const result=await db.from('odontograma_eventos').select('id,tipo,detalhe').eq('paciente_id',own.patientId);
  if(result.error)throw Error('Persistência do PSR não pôde ser consultada.');
  const psr=result.data.find(e=>e.tipo==='exame_periodontal');
  expect(psr).toBeTruthy();
  expect(psr?.detalhe?.psr?.s1?.codigo).toBe(3);
  const persisted=await snapshot(own);expect(persisted.counts[0]).toBe(1);expect(persisted.counts[1]).toBe(1);
  await day(page,own);
  await expect(page.getByRole('region',{name:'Atendimento já registrado',exact:true})).toBeVisible();
  await capture(page,info,'MD01-salvo-recarregado');
});
test('f1 retry finalizado mantém texto, não duplica, negativas HTTP de papéis',async({page,browser},info)=>{
  await login(page);const own=await visit(page,info,'Retry');
  const text=page.getByRole('textbox',{name:'Relato para organizar com Dex',exact:true}).last();
  const initial='QA INICIO3 evolução fictícia do retry '+Date.now();
  await text.fill(initial);
  let template:{body:string;headers:Record<string,string>}|undefined;
  let intercepted=false;
  await page.route('**/dashboard/meu-dia**',async route=>{
    const req=route.request();
    if(!intercepted&&req.method()==='POST'&&req.headers()['next-action']&&req.postData()?.includes(initial)){
      intercepted=true;
      const headers=req.headers();
      template={body:req.postData()!,headers:Object.fromEntries(['content-type','next-action','next-router-state-tree','accept'].filter(k=>headers[k]).map(k=>[k,headers[k]]))};
      const response=await route.fetch();
      if(response.status()!==200)throw Error('Primeiro save respondeu falha; não repetir automaticamente.');
      await route.abort('failed');
    }else await route.continue();
  });
  await page.getByRole('button',{name:'Salvar atendimento',exact:true}).click(); await page.getByRole('alertdialog').getByRole('button',{name:'Salvar assim mesmo',exact:true}).click();
  await expect(page.getByText(/Falha de conexão.*rascunho foi mantido/).first()).toBeVisible({timeout:60000});
  expect(intercepted).toBe(true);
  const baseline=await snapshot(own);
  expect(baseline.counts[0]).toBe(1);expect(baseline.counts[1]).toBe(1);
  const added=initial+' QA complemento não gravado';
  await text.fill(added);
  await page.getByRole('button',{name:'Salvar atendimento',exact:true}).click(); await page.getByRole('alertdialog').getByRole('button',{name:'Salvar assim mesmo',exact:true}).click();
  await expect(page.getByText('Esta visita já foi finalizada e está salva na Ficha. Se você acrescentou algo depois, isso não foi gravado: use Novo atendimento na Ficha do paciente.',{exact:true}).first()).toBeVisible({timeout:30000});
  await expect(text).toHaveValue(added);
  expect(await snapshot(own)).toEqual(baseline);
  await capture(page,info,'f1-finalizado-texto-preservado');
  if(!template)throw Error('Template HTTP próprio ausente.');
  for(const role of ['SECRETARIA','PROTETICO','BRUNO'] as const){
    const context=await browser.newContext();try{
      const actor=await context.newPage();await login(actor,role);
      const response=await actor.request.post(baseURL+'/dashboard/meu-dia',{headers:template.headers,data:template.body});
      const answer=await response.text();
      await info.attach('negativa-http-'+role,{body:JSON.stringify({status:response.status(),semPermissao:answer.includes('Sem permissão.'),recusado:answer.includes('"ok":false')}),contentType:'application/json'});
      expect(answer.includes('"ok":false'),'A ação deve recusar; resposta bruta omitida.').toBe(true);
      if(role!=='BRUNO')expect(answer).toContain('Sem permissão.');
      expect(await snapshot(own)).toEqual(baseline);
    }finally{await context.close();}
  }
});
test('f1 protético Meu Dia e paciente, secretária Meu Dia',async({page,browser},info)=>{
  await login(page,'PROTETICO');
  await page.goto(baseURL+'/dashboard/meu-dia');
  await expect(page).toHaveURL(/\/dashboard\/protetico/);
  await expect(page.getByRole('heading',{name:'Meu Dia',exact:true})).toHaveCount(0);
  await capture(page,info,'f1-protetico-barrado');
  const context=await browser.newContext();try{
    const secretary=await context.newPage();await login(secretary,'SECRETARIA');
    await secretary.goto(baseURL+'/dashboard/meu-dia');
    await expect(secretary).toHaveURL(/\/dashboard(?:\?.*)?$/);
    await expect(secretary.getByRole('heading',{name:'Meu Dia',exact:true})).toHaveCount(0);
  }finally{await context.close();}
});

test('MD04 Ana encaminha, Carlos conclui, histórico atribui executor',async({page,browser},info)=>{
  await login(page);const own=await visit(page,info,'Autoria');
  await page.route('**/api/dex/formatar-evolucao',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({
    queixa_principal:'QA fictício',dentes_observacoes:{},anotacoes:'QA fictício',conduta:'QA revisão',alerta_novo:null,
    dentes_afetados:[26,27],procedimentos:['QA procedimento 26','QA procedimento 27'],orto_manutencao:null,
    odontograma_eventos:[26,27].map(dente=>({tipo:'carie_restauracao',procedimentoNome:'QA procedimento '+dente,status:'indicado',origem:'clinica',momento_planejado:'sessao_atual',ancora:{nivel:'dente',dente,faces:[]},grupo_id:null,papel_no_grupo:null,observacao:'QA fictício',evidencia_status:'indicacao_explicita',revisar_status:false}))
  })}));
  await page.getByRole('textbox',{name:'Relato para organizar com Dex',exact:true}).last().fill('QA indiquei procedimentos fictícios nos dentes 26 e 27.');
  await page.getByRole('button',{name:/Organizar com o Dex/}).click();
  const line=page.locator('[data-documento-evento]').filter({has:page.getByRole('combobox',{name:'Nome do procedimento 26',exact:true})});
  await expect(line).toBeVisible();
  await line.getByRole('button',{name:/^Mais opções de/}).click();
  await page.getByRole('menuitem',{name:'Encaminhar',exact:true}).click();
  await line.getByRole('combobox',{name:/^Encaminhar /}).selectOption({label:'Dr. Carlos Local'});
  const ordinary=page.locator('[data-documento-evento]').filter({has:page.getByRole('combobox',{name:'Nome do procedimento 27',exact:true})});
  await ordinary.locator('[data-linha-situacao]').click();
  await expect(ordinary.locator('[data-linha-situacao]')).toHaveText('Realizado hoje');
  await page.getByRole('button',{name:'Salvar atendimento',exact:true}).click();
  await expect(page.locator('[data-rail-alvo="'+own.slotId+'"]')).toContainText('registrado',{timeout:60000});
  const context=await browser.newContext();try{
    const carlos=await context.newPage();await login(carlos,'CARLOS');await day(carlos);
    await carlos.getByRole('button',{name:/^(Encaixe|Atender agora)$/}).click();
    const dialog=carlos.getByRole('dialog',{name:'Atender agora',exact:true});
    await dialog.getByPlaceholder('Buscar por nome...', {exact:true}).fill(own.name);
    await dialog.getByText(own.name,{exact:true}).click();
    const pending=carlos.getByRole('region',{name:'Plano e histórico das sessões',exact:true}).locator('article').filter({hasText:'QA procedimento 26'}).filter({hasText:'encaminhado para você'});
    await expect(pending).toHaveCount(1);
    await pending.getByRole('button',{name:/Concluir encaminhado/}).click();
    await expect(pending).toHaveCount(0);
    await day(page,own);
    const history=page.getByRole('region',{name:'Plano e histórico das sessões',exact:true});
    await expect(history.getByText('concluído por Dr. Carlos Local',{exact:true})).toBeVisible();
    await expect(history.getByText(/^concluído por /)).toHaveCount(1);
    await capture(page,info,'MD04-historico-executor-Carlos');
  }finally{await context.close();}
});
