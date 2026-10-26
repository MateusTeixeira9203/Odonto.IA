import assert from 'node:assert/strict';
import path from 'node:path';
import {defineConfig} from '@playwright/test';
assert(path.isAbsolute(process.env.DENTISTA_QA_EVIDENCE_DIR??''),'Defina DENTISTA_QA_EVIDENCE_DIR absoluto');
export default defineConfig({testDir:'.',fullyParallel:false,workers:1,retries:0,reporter:'list',outputDir:path.join(process.env.DENTISTA_QA_EVIDENCE_DIR,'playwright-output'),use:{browserName:'chromium',channel:'msedge',viewport:{width:1440,height:1000},trace:'off',video:'off',screenshot:'off'}});
