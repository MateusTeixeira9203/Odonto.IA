import fs from 'node:fs';
import { cli, flags, detectarVazamentos, QaError } from './_lib.mjs';

await cli(async () => {
  const args = flags({ saida: { type: 'string' } }, ['saida']);
  if (!fs.existsSync(args.saida) || !fs.statSync(args.saida).isFile()) throw new QaError('SAIDA', 'arquivo de saida nao encontrado');
  const names = detectarVazamentos(fs.readFileSync(args.saida, 'utf8'));
  console.log(names.length ? `${names.length} vazamentos: ${names.join(', ')}` : '0 vazamentos');
  process.exitCode = names.length ? 1 : 0;
});
