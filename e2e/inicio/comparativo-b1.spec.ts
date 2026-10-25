import {createClient} from '@supabase/supabase-js';
import {randomUUID} from 'node:crypto';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {test,expect,before,baseURL,login,evidence} from './support';
test.describe.configure({retries:0,timeout:180000});
test('comparativo B1 ANTES uma única chamada autorizada',async({page,browser})=>{
  test.skip(!before||process.env.INICIO_COMPARATIVO_B1!=='1','Uma única comparação autorizada, somente ANTES.');
  if(!evidence)throw Error('Diretório de evidência necessário.');
  const file=join(evidence,'comparativo-B1-ANTES.json');
  if(existsSync(file))throw Error('Comparação já preparada/enviada: não repetir automaticamente.');
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL!,key=process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:(input,init)=>{if((init?.method??'GET').toUpperCase()!=='GET')throw Error('Observador só SELECT.');return fetch(input,init);}}});
  await login(page,'ANA');await page.goto(baseURL+'/dashboard/meu-dia');
  await expect(page.getByRole('button',{name:/^(Encaixe|Atender agora)$/})).toBeVisible({timeout:60000});
  const name='QA INICIO3 B1 ANTES '+Date.now();
  await page.getByRole('button',{name:/^(Encaixe|Atender agora)$/}).click();
  const dialog=page.getByRole('dialog',{name:'Atender agora',exact:true});
  await dialog.getByPlaceholder('Buscar por nome...', {exact:true}).fill(name);
  await dialog.getByRole('button',{name:'Cadastrar “'+name+'” e atender',exact:true}).click();
  let patientId='';
  await expect.poll(async()=>{const r=await db.from('pacientes').select('id').eq('nome',name).limit(1);patientId=r.data?.[0]?.id??'';return patientId;},{timeout:30000}).not.toBe('');
  const patient=await db.from('pacientes').select('id,nome,clinica_id').eq('id',patientId).single();
  let slotId='';
  await expect.poll(async()=>{const r=await db.from('agendamentos').select('id').eq('paciente_id',patientId).limit(1);slotId=r.data?.[0]?.id??'';return slotId;},{timeout:30000}).not.toBe('');
  const slot=await db.from('agendamentos').select('id,clinica_id,dentista_id,status').eq('id',slotId).single();
  if(patient.error||slot.error||patient.data.clinica_id!=='b0000000-0000-4000-8000-000000000001')throw Error('Fixture nova A não confirmada.');
  const input={visitaKey:randomUUID(),pacienteId:patientId,agendamentoId:slotId,textoVisita:'QA INICIO3 comparação B1 ANTES fictícia',eventosDraft:[],alertaNovo:null,ortoManutencao:null,destinoNovos:{fichaId:null}};
  const snapshot=async()=>{
    const rows=await Promise.all([
      db.from('atendimentos_clinicos').select('id,clinica_id,dentista_id,agendamento_id,estado').eq('paciente_id',patientId),
      db.from('fichas').select('id,clinica_id,dentista_id').eq('paciente_id',patientId),
      db.from('odontograma_eventos').select('id,clinica_id,status').eq('paciente_id',patientId)
    ]);
    if(rows.some(r=>r.error))throw Error('Snapshot próprio incompleto.');
    return {atendimentos:rows[0].data,fichas:rows[1].data,eventos:rows[2].data};
  };
  const initial=await snapshot();
  expect(initial.atendimentos).toHaveLength(0);expect(initial.fichas).toHaveLength(0);
  const manifest=JSON.parse(readFileSync(resolve(process.cwd(),'../Odonto.IA-qa3-antes/.next/dev/server/server-reference-manifest.json'),'utf8')) as {node:Record<string,{exportedName?:string}>};
  const action=Object.entries(manifest.node).find(([,entry])=>entry.exportedName==='salvarVisitaMeuDia')?.[0];
  if(!action)throw Error('Action de salvar não localizada; não houve chamada B.');
  const prepared={snapshot:'42c80a5',port:3014,host:new URL(url).host,patient:patient.data,slot:slot.data,input,initial,state:'fixture preparada; B ainda não chamado'};
  writeFileSync(file,JSON.stringify(prepared,null,2));
  const context=await browser.newContext();
  try{
    const bruno=await context.newPage();await login(bruno,'BRUNO');
    writeFileSync(file,JSON.stringify({...prepared,state:'chamada B iniciada; NÃO REPETIR'},null,2));
    const response=await bruno.request.post(baseURL+'/dashboard/meu-dia',{headers:{'next-action':action,'content-type':'text/plain;charset=UTF-8',accept:'text/x-component',origin:baseURL},data:JSON.stringify([input]),maxRedirects:0});
    const text=await response.text();
    const after=await snapshot();
    const result={...prepared,state:'chamada B concluída; NÃO REPETIR',http:response.status(),okTrue:/"ok":true/.test(text),okFalse:/"ok":false/.test(text),after,gravou:!!after.atendimentos?.length||!!after.fichas?.length};
    writeFileSync(file,JSON.stringify(result,null,2));
    console.log('COMPARATIVO B1 ANTES: '+(result.gravou?'GRAVOU':'SEM GRAVAÇÃO')+'; HTTP '+response.status()+'; evidência no vault.');
  }finally{await context.close();}
});
