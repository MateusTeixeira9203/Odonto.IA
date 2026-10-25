import fs from 'node:fs';
import path from 'node:path';
import { cli, flags, contexto, ROOT, QA_DIR, snapshotPath, validarNome, verificarEnvSnapshot, executar, QaError } from './_lib.mjs';

await cli(async () => {
  const args = flags({ 'com-build': { type: 'boolean' }, dir: { type: 'string' } });
  const dir = args.dir ? snapshotPath(validarNome(args.dir)) : ROOT;
  if (!fs.existsSync(dir)) throw new QaError('CAMINHO', 'snapshot não encontrado');
  if (args.dir) verificarEnvSnapshot(dir);
  const ctx = await contexto(dir);
  // The build also receives the QA environment in memory: Next production mode
  // would not load .env.development.local by itself.
  for (const name of ['.env', '.env.local', '.env.development', '.env.production', '.env.production.local']) {
    if (fs.existsSync(path.join(dir, name))) throw new QaError('ENV', 'ambiente concorrente do Next; use somente QA');
  }
  fs.mkdirSync(QA_DIR, { recursive: true });
  const stamp = new Date().toISOString().replaceAll(':', '-');
  const log = path.join(QA_DIR, `suite-${stamp}.log`);
  const bin = relative => path.join(ROOT, 'node_modules', relative);
  const steps = [
    ['typecheck app', bin('typescript/bin/tsc'), ['--noEmit']],
    ['typecheck e2e', bin('typescript/bin/tsc'), ['--noEmit', '-p', 'e2e/tsconfig.json']],
    ['lint', bin('eslint/bin/eslint.js'), ['.']],
    ['testes', bin('tsx/dist/cli.mjs'), ['--test']],
    ['Playwright --list', bin('@playwright/test/cli.js'), ['test', '--list']],
  ];
  if (args['com-build']) steps.push(['build', bin('next/dist/bin/next'), ['build', '--webpack']]);
  for (const [label, executable, argv] of steps) {
    fs.appendFileSync(log, `\n=== ${label} ===\n`);
    const result = await executar(process.execPath, [executable, ...argv], { cwd: dir, env: ctx.env, log, segredos: ctx.segredos });
    console.log(`${result.code ? 'FALHOU' : 'PASSOU'} · ${label}`);
    if (result.code) process.exitCode = 1;
  }
  console.log(`LOG .qa/${path.basename(log)}`);
});
