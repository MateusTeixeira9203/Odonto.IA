import fs from 'node:fs';
import path from 'node:path';
import { cli, flags, validarPorta, contexto, ROOT, QA_DIR, registros, snapshotPath, verificarEnvSnapshot, responde, executar, planoE2e, QaError } from './_lib.mjs';

await cli(async () => {
  const args = flags({ porta: { type: 'string' }, pasta: { type: 'string' }, escopo: { type: 'string' } }, ['porta', 'pasta']);
  const porta = validarPorta(args.porta);
  const plan = planoE2e({ porta, pasta: args.pasta, escopo: args.escopo, records: registros() });
  const folder = path.join(ROOT, args.pasta);
  const base = path.join(ROOT, 'e2e');
  if (!fs.existsSync(folder) || !fs.statSync(folder).isDirectory() ||
      !fs.realpathSync(folder).startsWith(fs.realpathSync(base) + path.sep)) {
    throw new QaError('PASTA', 'pasta fora de e2e/ ou inexistente');
  }
  const dir = snapshotPath(plan.record.nome);
  verificarEnvSnapshot(dir);
  await contexto(dir);
  const ctx = await contexto();
  if (!await responde(porta)) throw new QaError('PORTA', 'snapshot registrado não responde');
  const env = { ...ctx.env, ...plan.env };
  const roles = [
    ['QA', account => account.email === 'dentista.a.r140@example.invalid'],
    ['QA_CARLOS', account => /carlos/i.test(account.descricao)],
    ['QA_SECRETARIA', account => account.email === 'secretaria.a.auditoria@example.invalid'],
  ];
  for (const [prefix, predicate] of roles) {
    const account = ctx.accounts.contas.find(predicate);
    if (!account) throw new QaError('CONTAS', 'conta fictícia necessária não foi encontrada');
    env[`${prefix}_EMAIL`] = account.email;
    env[`${prefix}_PASSWORD`] = account.senha;
  }
  env.QA_CARLOS_NAME = 'Dr. Carlos Local';
  fs.mkdirSync(QA_DIR, { recursive: true });
  const log = path.join(QA_DIR, `e2e-${porta}-${Date.now()}.log`);
  const result = await executar(process.execPath, plan.args, {
    cwd: ROOT, env, log, segredos: ctx.segredos,
  });
  console.log(`${result.code ? 'FALHOU' : 'PASSOU'} · ${args.pasta} · QA_BASE_URL=http://localhost:${porta} · log .qa/${path.basename(log)}`);
  process.exitCode = result.code ? 1 : 0;
});
