const fs=require('node:fs');const path=require('node:path');const {createClient}=require('@supabase/supabase-js');
const root=path.resolve(__dirname,'../..');process.loadEnvFile(path.join(root,'.env.development.local'));
const url=process.env.NEXT_PUBLIC_SUPABASE_URL;if(new URL(url).host!=='uhuxteswtvgdnlixwrdu.supabase.co')throw Error('Host incorreto');
const db=createClient(url,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:(input,init)=>{if((init?.method??'GET').toUpperCase()!=='GET')throw Error('Só SELECT');return fetch(input,init)}}});
(async()=>{
const p=await db.from('pacientes').select('id,nome,clinica_id').like('nome','QA INICIO3 %').order('nome');
if(p.error)throw Error('Consulta própria indisponível');
for(const patient of p.data){
 const [a,f,e,s]=await Promise.all([
 db.from('atendimentos_clinicos').select('id,clinica_id,dentista_id,agendamento_id,estado').eq('paciente_id',patient.id),
 db.from('fichas').select('id,clinica_id').eq('paciente_id',patient.id),
 db.from('odontograma_eventos').select('id,clinica_id,dentista_id,encaminhado_para,status,procedimento_nome,detalhe').eq('paciente_id',patient.id),
 db.from('agendamentos').select('id,clinica_id,dentista_id,status').eq('paciente_id',patient.id)]);
 if([a,f,e,s].some(r=>r.error))throw Error('Consulta de integridade indisponível');
 const evolucoes=f.data.length?await db.from('ficha_evolucoes').select('id,ficha_id').in('ficha_id',f.data.map(r=>r.id)):{data:[],error:null};
 const vinculos=a.data.length?await db.from('atendimento_eventos').select('atendimento_id,evento_id,papel').in('atendimento_id',a.data.map(r=>r.id)):{data:[],error:null};
 if(evolucoes.error||vinculos.error)throw Error('Consulta de dependências indisponível');
 console.log(JSON.stringify({patient,atendimentos:a.data,fichas:f.data,eventos:e.data,slots:s.data,evolucoes:evolucoes.data,vinculos:vinculos.data}));
}
})().catch(()=>{console.error('Inspeção QA incompleta; detalhes sensíveis omitidos.');process.exitCode=1});
