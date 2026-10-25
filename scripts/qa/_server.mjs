// Detached log supervisor: it keeps masking Next's output after snapshot-up exits.
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { cli, flags, validarNome, validarPorta, snapshotPath, contexto, childEnv, QA_DIR, mascarar, verificarEnvSnapshot } from './_lib.mjs';

await cli(async () => {
  const args = flags({ nome: { type: 'string' }, porta: { type: 'string' } }, ['nome', 'porta']);
  const nome = validarNome(args.nome);
  const porta = validarPorta(args.porta);
  const dir = snapshotPath(nome);
  verificarEnvSnapshot(dir);
  const ctx = await contexto(dir);
  const log = path.join(QA_DIR, `next-${porta}.log`);
  const child = spawn(process.execPath, [path.join(dir, 'node_modules/next/dist/bin/next'), 'dev', '--webpack', '-p', String(porta)], {
    cwd: dir, env: childEnv(ctx.env), shell: false, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.on('spawn', () => fs.writeFileSync(path.join(QA_DIR, `start-${porta}.json`), JSON.stringify({ pid: child.pid })));
  for (const stream of [child.stdout, child.stderr]) {
    let pending = '';
    stream.on('data', chunk => {
      pending += chunk.toString();
      const lines = pending.split('\n');
      pending = lines.pop();
      if (lines.length) fs.appendFileSync(log, mascarar(lines.join('\n') + '\n', ctx.segredos));
    });
    stream.on('end', () => { if (pending) fs.appendFileSync(log, mascarar(pending, ctx.segredos)); });
  }
  child.on('error', () => { fs.appendFileSync(log, 'FALHOU INICIO · Next não iniciou\n'); process.exitCode = 1; });
  child.on('close', code => { process.exitCode = code ?? 1; });
});
