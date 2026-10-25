import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: 'list',
  use: {
    browserName: 'chromium',
    channel: 'msedge',
    trace: 'off',
    video: 'off',
    screenshot: 'off',
  },
});
