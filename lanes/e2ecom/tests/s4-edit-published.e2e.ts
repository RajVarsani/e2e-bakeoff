import { test } from '@e2e-dev/web';
import { expect } from 'e2e';
import { ADMIN, ALICE, resetStack, seedLetter, signIn, urls } from './support';

test.beforeEach(async ({ request }) => { await resetStack(request); });

test('S4 admin edits a published letter, re-renders, portal shows new body', async ({ app, agent, screen, browser, request }) => {
  const letter = await seedLetter(request, { title: 'Welcome', body: 'Old body text.', recipientEmail: ALICE.email, status: 'ready' });

  await app.open(urls.admin);
  await signIn(screen, ADMIN);
  const row = screen.getByRole('row').filter({ hasText: 'Welcome' });
  await expect(row.getByText('ready')).toBeVisible();

  await row.getByRole('button', 'Edit').tap();
  await screen.getByLabel('Body').fill('Brand new body text.');
  await screen.getByRole('button', 'Save changes').tap();
  await expect(row.getByText('rendering')).toBeVisible();
  await agent.waitFor('the Welcome letter row shows status ready and the form heading is New letter', { timeout: 30_000 });

  await browser.newTab();
  await browser.goto(urls.portal);
  await signIn(screen, ALICE);
  await expect(screen.getByRole('heading', 'Inbox')).toBeVisible();
  await browser.goto(`${urls.portal}/letters/${letter.id}`);
  await expect(screen.getByRole('article', 'Letter content')).toHaveText('Brand new body text.');
  await expect(screen.getByText('Old body text.')).toBeHidden();
});
