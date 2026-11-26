import type { E2EConfig } from 'e2e';
import { web } from '@e2e-dev/web';
import { anthropic } from '@ai-sdk/anthropic';
import './env';
import { urls, PORT_OFFSET } from '../../ports';

// PORT_OFFSET=200 for this lane. The runner boots the four apps itself.
const app = {
  url: urls.admin,
  command: {
    executable: 'bun',
    args: ['scripts/start.ts'],
    cwd: '../..',
    env: { PORT_OFFSET: String(PORT_OFFSET), TEST_MODE: '1' },
    reuseExisting: true,
    log: '.e2e/logs/app.log',
    startupTimeout: 90_000,
  },
  readyUrl: `${urls.api}/health`,
};

export default {
  agents: { default: { model: anthropic('claude-sonnet-5-5') } },
  targets: [{ engine: web(), app }],
  workers: 1,
  retries: 0,
  timeout: 120_000,
  reporters: ['list', 'junit'],
  video: 'retain-on-failure',
} satisfies E2EConfig;
