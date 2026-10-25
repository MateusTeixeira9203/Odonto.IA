// Credenciais somente em memória; não salvar storageState, HAR, trace ou vídeo.
const fs=require('node:fs');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
const repo=path.resolve(__dirname,'../..');
const raw=fs.readFileSync(path.join(repo,'.env.qa-contas'),'utf8');
const password=raw.match(/^#\s*Senha de todas:\s*(.+)\r?$/m)?.[1]?.trim();
if(!password) throw Error('Senha QA ausente; conteúdo omitido.');
const accounts={ANA:'dentista.a.r140@example.invalid',CARLOS:'dentista.c.auditoria@example.invalid',ADMIN:'admin.a.auditoria@example.invalid',SECRETARIA:'secretaria.a.auditoria@example.invalid',PROTETICO:'protetico.a.qa@example.invalid',BRUNO:'dentista.b.r140@example.invalid'};
const env={...process.env,INICIO_PASSWORD:password};
for(const [role,email] of Object.entries(accounts)) {
  if(!raw.includes(email)) throw Error('Conta fictícia esperada não encontrada.');
  env['INICIO_'+role+'_EMAIL']=email;
}
const url=new URL(env.QA_BASE_URL||'http://localhost:3015');
if(url.protocol!=='http:'||url.hostname!=='localhost'||!['3014','3015'].includes(url.port)) throw Error('URL fora dos snapshots QA3.');
const snapshot=path.resolve(repo,'../Odonto.IA-qa3-'+(url.port==='3014'?'antes':'depois'));
const config=fs.readFileSync(path.join(snapshot,'.env.development.local'),'utf8');
const host=config.match(/^NEXT_PUBLIC_SUPABASE_URL\s*=\s*["']?https:\/\/([^/\s"']+)/m)?.[1];
if(host!=='uhuxteswtvgdnlixwrdu.supabase.co') throw Error('Snapshot não confirmado no odonto-qa.');
env.INICIO_QA_HOST=host;
for (const name of ['NEXT_PUBLIC_SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY','NEXT_PUBLIC_SUPABASE_ANON_KEY']) {
  const value=config.split(/\r?\n/).find(line=>line.startsWith(name+'='))?.slice(name.length+1).trim().replace(/^["']|["']$/g,'');
  if(value)env[name]=value;
}
const cli=require.resolve('@playwright/test/cli');
const result=spawnSync(process.execPath,[cli,'test',...process.argv.slice(2)],{cwd:repo,env,stdio:'inherit'});
process.exit(result.status??1);
