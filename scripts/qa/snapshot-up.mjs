import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { cli, flags, validarNome, validarPorta, validarCommit, contexto, comTrava, registros, gravarRegistros, snapshotPath, ROOT, QA_DIR, git, executar, verificarEnvSnapshot, REF_PROD, pidDaPorta, comandoPid, processoSnapshot, responde, pararPid, childEnv, QaError } from './_lib.mjs';

await cli(async () => {
  const args = flags({ nome: { type: 'string' }, commit: { type: 'string' }, porta: { type: 'string' } }, ['nome', 'commit', 'porta']);
  const nome = validarNome(args.nome), porta = validarPorta(args.porta);
  validarCommit(args.commit);
  const ctx = await contexto();
  const commit = await git(['rev-parse', '--verify', `${args.commit}^{commit}`]);
  const dir = snapshotPath(nome);
  await comTrava(async () => {
    const all = registros();
    const previous = all.find(r => r.porta === porta || r.nome === nome);
    if (previous && (previous.porta !== porta || previous.nome !== nome || previous.commit !== commit)) {
      throw new QaError('SNAPSHOT', 'nome ou porta já registrados com outra configuração');
    }
    if (fs.existsSync(dir)) {
      const head = await git(['rev-parse', 'HEAD'], dir);
      if (head !== commit) throw new QaError('COMMIT', `o snapshot ${nome} está em outro commit; use outro nome`);
      const branch = await executar('git', ['symbolic-ref', '-q', 'HEAD'], { cwd: dir });
      if (branch.code !== 1) throw new QaError('BRANCH', 'worktree com branch não pode ser usado pelo script');
      verificarEnvSnapshot(dir);
    }
    const occupied = await pidDaPorta(porta);
    if (occupied) {
      if (previous && processoSnapshot(await comandoPid(previous.pid), porta, dir) && await responde(porta)) {
        console.log(`JÁ NO AR http://localhost:${porta} · ${nome} @ ${commit.slice(0, 7)} · host odonto-qa conferido`);
        return;
      }
      throw new QaError('PORTA', 'porta ocupada; nenhum servidor foi iniciado');
    }
    // Inspect tracked environment files before creating or changing the worktree.
    const tracked = await git(['ls-tree', '-r', '--name-only', commit]);
    for (const file of tracked.split('\n').filter(f => !f.includes('/') && (f.startsWith('.env') || f === 'env.local'))) {
      if (['.env', '.env.local', '.env.development', '.env.production', '.env.production.local'].includes(file) ||
          (await git(['show', `${commit}:${file}`])).toLowerCase().includes(REF_PROD)) {
        throw new QaError('ENV', 'commit contém ambiente concorrente ou de produção');
      }
    }
    if (!fs.existsSync(path.join(ROOT, 'node_modules/next/package.json'))) throw new QaError('DEPENDENCIAS', 'instale as dependências no repositório principal');
    if (!fs.existsSync(dir)) await git(['worktree', 'add', '--detach', dir, commit]);
    const link = path.join(dir, 'node_modules');
    if (fs.existsSync(link)) {
      if (!fs.lstatSync(link).isSymbolicLink() || fs.realpathSync(link) !== fs.realpathSync(path.join(ROOT, 'node_modules'))) {
        throw new QaError('JUNCAO', 'node_modules existente não é a junção esperada');
      }
    } else fs.symlinkSync(path.join(ROOT, 'node_modules'), link, 'junction');
    for (const file of ['.env.development.local', '.env.qa-contas']) fs.copyFileSync(path.join(ROOT, file), path.join(dir, file));
    verificarEnvSnapshot(dir);
    await contexto(dir);
    const pidFile = path.join(QA_DIR, `start-${porta}.json`);
    if (fs.existsSync(pidFile)) fs.unlinkSync(pidFile);
    fs.writeFileSync(path.join(QA_DIR, `next-${porta}.log`), '');
    const supervisor = spawn(process.execPath, [path.join(ROOT, 'scripts/qa/_server.mjs'), '--nome', nome, '--porta', String(porta)], {
      cwd: ROOT, env: childEnv(ctx.env), detached: true, shell: false, windowsHide: true, stdio: 'ignore',
    });
    supervisor.unref();
    let spawnError = false;
    supervisor.on('error', () => { spawnError = true; });
    const start = Date.now();
    while (!fs.existsSync(pidFile) && !spawnError && Date.now() - start < 15000) await delay(150);
    if (!fs.existsSync(pidFile)) throw new QaError('INICIO', 'Next não iniciou; consulte .qa/next-<porta>.log', 1);
    const { pid } = JSON.parse(fs.readFileSync(pidFile, 'utf8'));
    if (!Number.isSafeInteger(pid) || pid <= 0) throw new QaError('PID', 'supervisor não informou um PID válido', 1);
    const record = { nome, commit, porta, pid, inicio: new Date().toISOString() };
    gravarRegistros([...all.filter(r => r.porta !== porta && r.nome !== nome), record]);
    fs.unlinkSync(pidFile);
    while (Date.now() - start < 120000) {
      if (await responde(porta)) {
        console.log(`PRONTO http://localhost:${porta} · ${nome} @ ${commit.slice(0, 7)} · host odonto-qa conferido`);
        return;
      }
      await delay(600);
    }
    await pararPid(pid, porta, dir);
    gravarRegistros(registros().filter(r => r.porta !== porta));
    throw new QaError('INICIO', `FALHOU (ver .qa/next-${porta}.log)`, 1);
  });
});
