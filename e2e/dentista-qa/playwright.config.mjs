import path from 'node:path';
import {tmpdir} from 'node:os';
import {defineConfig} from '@playwright/test';
// Configuração e descoberta são puras. O guard valida o destino na execução.
const evidence=process.env.DENTISTA_QA_EVIDENCE_DIR;
export default defineConfig({testDir:'.',fullyParallel:false,workers:1,retries:0,reporter:'list',outputDir:evidence&&path.isAbsolute(evidence)?path.join(evidence,'playwright-output'):path.join(tmpdir(),'odonto-dentista-qa-sem-env'),use:{browserName:'chromium',channel:'msedge',viewport:{width:1440,height:1000},trace:'off',video:'off',screenshot:'off'}});
