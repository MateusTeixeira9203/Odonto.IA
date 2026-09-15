import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const route = readFileSync(fileURLToPath(new URL('./route.ts', import.meta.url)), 'utf8');
const provider = readFileSync(fileURLToPath(new URL('../../../../lib/ai/provider.ts', import.meta.url)), 'utf8');

test('a rota paraleliza só os gates independentes e conserva a cota por identidade', () => {
  assert.match(route, /Promise\.all\(\[\s*withRateLimit\(req, 'dex:formatar-evolucao', 60, 60_000\),\s*getDexActorCached\(\),\s*\]\)/s);
  assert.match(route, /20, 60_000, `\$\{actor\.clinicaId\}:\$\{actor\.dentistaId\}`/);
  assert.match(route, /'Server-Timing': formatDexServerTiming\(/);
  assert.doesNotMatch(route, /getDentistaCached/);
});

test('a integração preserva a configuração clínica publicada no R169', () => {
  assert.match(route, /const DEX_PROMPT_VERSION = 'r169-curativo-2026-09-14';/);
  assert.match(route, /generateStructuredGemini<EvolucaoWire>\(\{\s*prompt,\s*responseSchema: EVOLUCAO_SCHEMA,\s*feature: 'formatar-evolucao',\s*thinkingBudget: 1024,\s*\}\)/s);
  assert.match(provider, /const GEMINI_STRUCT_MODEL = 'gemini-2\.5-flash';/);
  assert.match(provider, /temperature: 0\.2,/);
  assert.match(provider, /maxOutputTokens: options\.maxOutputTokens \?\? 16_384,/);
  assert.match(provider, /thinkingConfig: \{ thinkingBudget: options\.thinkingBudget \?\? 0 \}/);
  assert.match(provider, /const MAX_RETRIES\s+= 3;/);
  assert.match(provider, /const DEFAULT_TIMEOUT_MS = 30_000;/);
});
