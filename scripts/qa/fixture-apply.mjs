import { cli, flags, aplicarFixture } from './_lib.mjs';

await cli(async () => {
  const args = flags({ arquivo: { type: 'string' }, ensaio: { type: 'boolean' } }, ['arquivo']);
  await aplicarFixture(args.arquivo, { ensaio: args.ensaio });
});
