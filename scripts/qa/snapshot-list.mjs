import { cli, flags, contexto, registros, git, snapshotPath, responde } from './_lib.mjs';

await cli(async () => {
  flags({});
  await contexto();
  const records = registros();
  const trees = (await git(['worktree', 'list', '--porcelain'])).split('\n\n');
  for (const tree of trees) {
    const dir = tree.match(/^worktree (.+)$/m)?.[1];
    const commit = tree.match(/^HEAD (.+)$/m)?.[1];
    if (!dir || !commit) continue;
    const record = records.find(r => snapshotPath(r.nome).replaceAll('\\', '/').toLowerCase() === dir.toLowerCase());
    const status = record ? (await responde(record.porta) ? 'NO AR' : 'SEM RESPOSTA') : 'NÃO REGISTRADO';
    console.log(`${dir} · ${commit.slice(0, 7)} · porta ${record?.porta ?? '-'} · PID ${record?.pid ?? '-'} · ${status}`);
  }
});
