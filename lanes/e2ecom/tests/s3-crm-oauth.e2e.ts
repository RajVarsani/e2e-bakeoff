import { test } from '@e2e-dev/web';
import { expect } from 'e2e';
import { ALICE, CRM_USER, resetStack, signIn, urls } from './support';

test.beforeEach(async ({ request }) => { await resetStack(request); });

test('S3 portal connects CRM via cross-origin OAuth (portal -> crm -> portal)', async ({ app, agent, screen, browser }) => {
  await app.open(urls.portal);
  await signIn(screen, ALICE);
  await expect(browser).toHaveURL(/portal\.localhost/);

  await screen.getByRole('button', 'Connect CRM').tap();
  await browser.waitForURL(/crm\.localhost/);

  // Cross-origin leg driven by the agent: CRM login form then consent page.
  await agent.act('sign in with email {email} and password {password}, then click Allow on the authorization page', {
    params: { email: CRM_USER.email, password: CRM_USER.password },
  });

  await browser.waitForURL(/portal\.localhost/);
  await expect(screen.getByRole('status')).toHaveText('CRM connected');
  const clients = screen.getByRole('list', 'CRM clients');
  await expect(clients.getByText('Jordan Lee', { exact: false })).toBeVisible();
  await expect(clients.getByText('Sam Patel', { exact: false })).toBeVisible();
  await expect(clients.getByText('Riley Chen', { exact: false })).toBeVisible();
});
