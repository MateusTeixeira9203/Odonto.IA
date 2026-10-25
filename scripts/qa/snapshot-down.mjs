import fs from 'node:fs';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { cli, flags, validarNome, validarPorta, contexto, ROOT, snapshotPath, comTrava, registros, gravarRegistros, pidDaPorta, comandoPid, processoSnapshot, pararPid, executar, git, desfazerJuncao, verificarEnvSnapshot, QaError } from './_lib.mjs';

await cli(async () => {
  const args = flags({ porta: { type: 'string' }, remover: { type: 'boolean' }, nome: { type: 'string' } }, ['porta']);
  const porta = validarPorta(args.porta);
  if (Boolean(args.remover) !== Boolean(args.nome)) throw new QaError('FLAGS', '--remover e --nome devem ser usados juntos');
  if (args.nome) validarNome(args.nome);
  await contexto();
  await comTrava(async () => {
    const all = registros();
    const record = all.find(r => r.porta === porta);
    let nome = record?.nome;
    let pid = record?.pid;
    const listener = await pidDaPorta(porta);
    if (!record && listener) {
      const command = (await comandoPid(listener)).replaceAll('\\', '/');
      const prefix = path.dirname(ROOT).replaceAll('\\', '/') + '/' + path.basename(ROOT) + '-';
      const start = command.toLowerCase().indexOf(prefix.toLowerCase());
      const end = command.toLowerCase().indexOf('/node_modules/next/', start);
      if (start < 0 || end < 0) throw new QaError('PID', 'servidor sem registro não é um snapshot reconhecido');
      nome = command.slice(start + prefix.length, end);
      validarNome(nome);
      pid = listener;
      if (!processoSnapshot(command, porta, snapshotPath(nome))) throw new QaError('PID', 'linha de comando não identifica este Next e porta');
    }
    if (!nome) throw new QaError('REGISTRO', 'nenhum snapshot registrado ou servidor reconhecido nesta porta');
    if (args.nome && args.nome !== nome) throw new QaError('NOME', 'nome não corresponde ao snapshot da porta');
    const dir = snapshotPath(nome);
    if (path.resolve(dir) === ROOT || !fs.existsSync(dir)) throw new QaError('CAMINHO', 'worktree não encontrado ou é o repositório principal');
    verificarEnvSnapshot(dir);
    await contexto(dir);
    if (args.remover) {
      const branch = await executar('git', ['symbolic-ref', '-q', 'HEAD'], { cwd: dir });
      if (branch.code !== 1) throw new QaError('BRANCH', 'nunca remover worktree com branch');
      if (await git(['status', '--porcelain'], dir)) throw new QaError('SUJO', 'worktree tem alterações; não será removido');
      const common = await git(['rev-parse', '--git-common-dir'], dir);
      const mainCommon = await git(['rev-parse', '--git-common-dir']);
      if (fs.realpathSync(path.resolve(dir, common)) !== fs.realpathSync(path.resolve(ROOT, mainCommon))) {
        throw new QaError('CAMINHO', 'worktree não pertence ao repositório principal');
      }
      const link = path.join(dir, 'node_modules');
      if (fs.existsSync(link) && (!fs.lstatSync(link).isSymbolicLink() || fs.realpathSync(link) !== fs.realpathSync(path.join(ROOT, 'node_modules')))) {
        throw new QaError('JUNCAO', 'junção inesperada; não será removida');
      }
    }
    if (pid) await pararPid(pid, porta, dir);
    for (let i = 0; i < 30 && await pidDaPorta(porta); i++) await delay(150);
    if (await pidDaPorta(porta)) throw new QaError('PORTA', 'porta ainda ocupada; worktree preservado');
    if (args.remover) {
      desfazerJuncao(dir);
      await git(['worktree', 'remove', dir]);
    }
    gravarRegistros(all.filter(r => r.porta !== porta));
    console.log(`PARADO http://localhost:${porta}${args.remover ? ` · snapshot ${nome} removido · node_modules principal preservado` : ''}`);
  });
});
