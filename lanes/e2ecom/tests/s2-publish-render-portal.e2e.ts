import { test } from '@e2e-dev/web';
import { expect } from 'e2e';
import { ADMIN, ALICE, resetStack, signIn, urls } from './support';

test.beforeEach(async ({ request }) => { await resetStack(request); });

test('S2 admin creates and publishes a letter, async render, Alice sees it ready in portal', async ({ app, agent, screen, browser }) => {
  // Session 1: admin tab.
  await app.open(urls.admin);
  await signIn(screen, ADMIN);
  await expect(screen.getByRole('heading', 'Letters Admin')).toBeVisible();

  await agent.act('create a letter titled {title} with body {body} for recipient Alice, then submit the New letter form', {
    params: { title: 'Welcome', body: 'Hello Alice, welcome aboard.' },
  });
  const row = screen.getByRole('row').filter({ hasText: 'Welcome' });
  await expect(row).toBeVisible();

  await row.getByRole('button', 'Publish').tap();
  await expect(row.getByText('rendering')).toBeVisible();
  await expect(row.getByText('ready')).toBeVisible({ timeout: 15_000 });

  // Session 2: portal origin in a second tab.
  await browser.newTab();
  await browser.goto(urls.portal);
  await signIn(screen, ALICE);
  const inboxRow = screen.getByRole('row').filter({ hasText: 'Welcome' });
  await expect(inboxRow.getByText('ready')).toBeVisible();
  await inboxRow.getByRole('link', 'Welcome').tap();
  await expect(screen.getByRole('article', 'Letter content')).toHaveText('Hello Alice, welcome aboard.');
});
