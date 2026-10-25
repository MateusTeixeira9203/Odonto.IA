import fs from 'node:fs';
import path from 'node:path';
import { cli, flags, contexto, ROOT, contasQa, lerVariavel, QaError } from './_lib.mjs';

await cli(async () => {
  const args = flags({ saida: { type: 'string' } }, ['saida']);
  if (!fs.existsSync(args.saida) || !fs.statSync(args.saida).isFile()) throw new QaError('SAIDA', 'arquivo de saída não encontrado');
  await contexto();
  const secrets = [];
  for (const entry of fs.readdirSync(ROOT, { withFileTypes: true })) {
    if (!entry.isFile() || entry.isSymbolicLink() || !(entry.name.startsWith('.env') || entry.name === 'env.local')) continue;
    const file = path.join(ROOT, entry.name);
    const text = fs.readFileSync(file, 'utf8');
    if (entry.name === '.env.qa-contas') {
      const accounts = contasQa(text);
      secrets.push({ nome: 'SENHA_QA_CONTAS', valor: accounts.senha });
      for (const [index, account] of accounts.contas.entries()) secrets.push({ nome: `EMAIL_QA_${index + 1}`, valor: account.email });
    } else {
      for (const name of new Set([...text.matchAll(/^\s*(?:export\s+)?([A-Z_][A-Z\d_]*)\s*=/gmi)].map(m => m[1]))) {
        secrets.push({ nome: name, valor: await lerVariavel(file, name) });
      }
    }
  }
  const output = fs.readFileSync(args.saida, 'utf8');
  const names = [...new Set(secrets.filter(s => s.valor?.length >= 8 &&
    [s.valor, encodeURIComponent(s.valor)].some(v => output.includes(v))).map(s => s.nome))];
  console.log(names.length ? `${names.length} vazamentos: ${names.join(', ')}` : '0 vazamentos');
  process.exitCode = names.length ? 1 : 0;
});
