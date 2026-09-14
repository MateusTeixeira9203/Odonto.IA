import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { ImplanteForm } from '../src/components/fichas/implante-form';
import { EndoForm } from '../src/components/fichas/endo-form';

// No conflito são exibidas a versão salva e a edição, sem compartilhar IDs/labels.
const html = renderToStaticMarkup(<>
  <ImplanteForm valor={null} onChange={() => undefined} readOnly />
  <ImplanteForm valor={null} onChange={() => undefined} />
  <EndoForm valor={null} onChange={() => undefined} readOnly />
  <EndoForm valor={null} onChange={() => undefined} />
</>);
const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
assert.equal(new Set(ids).size, ids.length, 'IDs devem ser únicos entre as versões dos formulários');
for (const match of html.matchAll(/\b(?:for|list)="([^"]+)"/g)) {
  assert.ok(ids.includes(match[1]), `Associação inválida: ${match[1]}`);
}
console.log(`PASS: ${ids.length} IDs únicos; labels e datalists resolvem suas próprias instâncias.`);
