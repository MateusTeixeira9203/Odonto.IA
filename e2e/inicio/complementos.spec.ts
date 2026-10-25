import { createClient } from '@supabase/supabase-js';
import {test,expect,baseURL,before,login,capture,theme} from './support';
test.describe.configure({retries:0,timeout:180000});
test.beforeEach(()=>test.skip(before,'Complementos no snapshot afdf3d0.'));
function db(){
  if(!process.env.NEXT_PUBLIC_SUPABASE_URL||!process.env.SUPABASE_SERVICE_ROLE_KEY)throw Error('Observador QA ausente.');
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{
    auth:{persistSession:false,autoRefreshToken:false},
    global:{fetch:(input,init)=>{if((init?.method??'GET').toUpperCase()!=='GET')throw Error('Só SELECT.');return fetch(input,init);}}
  });
}
async function ownPatient(label:string){
  const r=await db().from('pacientes').select('id,nome').like('nome','QA INICIO3 '+label+' %').order('created_at',{ascending:false}).limit(1);
  if(r.error||!r.data.length)throw Error('Fixture própria não localizada; não criar novamente.');
  return r.data[0] as {id:string;nome:string};
}
test('MD03 decíduos 390 e seleção móvel dos permanentes',async({page},info)=>{
  const own=await ownPatient('FacesDentes');
  const slots=await db().from('agendamentos').select('id').eq('paciente_id',own.id).limit(1);
  if(slots.error||!slots.data.length)throw Error('Slot próprio indisponível.');
  await login(page);await page.goto(baseURL+'/dashboard/meu-dia?ag='+slots.data[0].id);
  await page.locator('[data-rail-alvo="'+slots.data[0].id+'"]').click();
  await expect(page.getByRole('heading',{name:own.nome,exact:true})).toBeVisible({timeout:30000});
  for(const dark of [false,true]){
    await page.setViewportSize({width:1440,height:900});await theme(page,dark);await page.setViewportSize({width:390,height:900});
    await page.getByRole('button',{name:/^Decíduos/}).click();
    const teeth=page.getByRole('button',{name:/^Dente \d+ —/});await expect(teeth).toHaveCount(20);
    const rects=await teeth.evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect();return{width:r.width,y:Math.round(r.y)}}));
    expect(Math.min(...rects.map(r=>r.width))).toBeGreaterThanOrEqual(32);
    const rows=new Map<number,number>();for(const r of rects)rows.set(r.y,(rows.get(r.y)??0)+1);
    expect([...rows.values()]).toEqual([5,5,5,5]);
    for(const n of [55,65]){const b=page.getByRole('button',{name:new RegExp('^Dente '+n+' —')});await b.click();await expect(b).toHaveAttribute('aria-pressed','true');}
    await capture(page,info,'MD03-deciduos-390-'+(dark?'escuro':'claro'));
    await page.getByRole('button',{name:'Limpar seleção',exact:true}).click();
    await page.getByRole('button',{name:/^Permanentes/}).click();
    for(const n of [26,27]){const b=page.getByRole('button',{name:new RegExp('^Dente '+n+' —')});await b.click();await expect(b).toHaveAttribute('aria-pressed','true');}
    await capture(page,info,'MD03-selecao26-27-390-'+(dark?'escuro':'claro'));
    await page.getByRole('button',{name:'Limpar seleção',exact:true}).click();
  }
});
test('f1 redirect HTTP e paciente barrado ao protético e outra clínica',async({page,browser},info)=>{
  const own=await ownPatient('PSRNormal');
  await login(page,'PROTETICO');
  for(const path of ['/dashboard/meu-dia','/dashboard/pacientes/'+own.id]){
    const response=await page.request.get(baseURL+path,{maxRedirects:0});
    const body=await response.text();
    const redirect=response.headers()['location']??'';
    await info.attach('redirect-'+(path.includes('pacientes')?'paciente':'meu-dia'),{body:JSON.stringify({status:response.status(),location:redirect,streamRedirect:body.includes('NEXT_REDIRECT')}),contentType:'application/json'});
    expect([307,308].includes(response.status())||body.includes('NEXT_REDIRECT')).toBe(true);
    await page.goto(baseURL+path);await expect(page).toHaveURL(/\/dashboard\/protetico/);
    await expect(page.getByRole('heading',{name:own.nome,exact:true})).toHaveCount(0);
  }
  const context=await browser.newContext();try{
    const bruno=await context.newPage();await login(bruno,'BRUNO');
    await bruno.goto(baseURL+'/dashboard/pacientes/'+own.id);
    await expect(bruno.getByRole('heading',{name:own.nome,exact:true})).toHaveCount(0);
    await expect(bruno.getByText(/não encontrad|404/i).first()).toBeVisible();
    await capture(bruno,info,'f1-Bruno-outra-clinica-paciente-barrado');
  }finally{await context.close();}
});
test('MD01 consumidor Ficha mostra PSR salvo sem gravar novamente',async({page},info)=>{
  const own=await ownPatient('PSRNormal');
  await login(page);await page.goto(baseURL+'/dashboard/pacientes/'+own.id+'?tab=prontuario');
  await page.getByRole('tab',{name:'Prontuário',exact:true}).click();
  const ficha=page.getByRole('button',{name:/Abrir ficha/});await expect(ficha).toHaveCount(1,{timeout:30000});await ficha.click();
  await expect(page.getByText(/PSR|Exame periodontal/).first()).toBeVisible({timeout:30000});
  await capture(page,info,'MD01-consumidor-Ficha');
});
