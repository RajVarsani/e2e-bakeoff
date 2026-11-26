import { test } from '@e2e-dev/web';
import { expect } from 'e2e';
import { ALICE, BOB, resetStack, seedLetter, signIn, urls } from './support';

test.beforeEach(async ({ request }) => { await resetStack(request); });

test('S6 Bob cannot see or open Alice\'s letter', async ({ app, screen, request }) => {
  const letter = await seedLetter(request, { title: 'Alice private', body: 'Secret for Alice only.', recipientEmail: ALICE.email, status: 'ready' });

  await app.open(urls.portal);
  await signIn(screen, BOB);
  await expect(screen.getByRole('heading', 'Inbox')).toBeVisible();
  await expect(screen.getByText('No letters yet.')).toBeVisible();
  await expect(screen.getByText('Alice private')).toBeHidden();

  await app.open(`${urls.portal}/letters/${letter.id}`);
  await expect(screen.getByText('Letter not found.')).toBeVisible();
  await expect(screen.getByText('Secret for Alice only.')).toBeHidden();
});
