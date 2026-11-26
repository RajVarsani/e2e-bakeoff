import { test } from '@e2e-dev/web';
import { expect } from 'e2e';
import { ADMIN, ALICE, resetStack, signIn, urls } from './support';

test.beforeEach(async ({ request }) => { await resetStack(request); });

test('S5 render failure surfaces in admin (Retry) and portal (failed, not openable)', async ({ app, agent, screen, browser }) => {
  await app.open(`${urls.admin}/?forceFail=1`);
  await signIn(screen, ADMIN);

  await agent.act('create a letter titled {title} with body {body} for recipient Alice, then submit the New letter form', {
    params: { title: 'Doomed', body: 'This render will fail.' },
  });
  const row = screen.getByRole('row').filter({ hasText: 'Doomed' });
  await row.getByRole('button', 'Publish').tap();
  await expect(row.getByText('failed')).toBeVisible({ timeout: 15_000 });
  await expect(row.getByRole('button', 'Retry')).toBeVisible();
  await expect(row.getByText('ready')).toBeHidden();

  await browser.newTab();
  await browser.goto(urls.portal);
  await signIn(screen, ALICE);
  const inboxRow = screen.getByRole('row').filter({ hasText: 'Doomed' });
  await expect(inboxRow.getByText('failed')).toBeVisible();
  await expect(inboxRow.getByRole('link')).toHaveCount(0);
  await agent.assert('the Doomed letter is listed as failed and is not a clickable link');
});
