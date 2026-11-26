import { test } from '@e2e-dev/web';
import { expect } from 'e2e';
import { ADMIN, resetStack, urls } from './support';

test.beforeEach(async ({ request }) => { await resetStack(request); });

test('S1 admin login: wrong password rejected, correct password lands on Letters Admin', async ({ app, screen }) => {
  await app.open(urls.admin);

  await screen.getByLabel('Email').fill(ADMIN.email);
  await screen.getByLabel('Password').fill('wrong-password');
  await screen.getByRole('button', 'Sign in').tap();
  await expect(screen.getByRole('alert')).toHaveText('Invalid email or password');
  await expect(screen.getByRole('form', 'Sign in')).toBeVisible();

  await screen.getByLabel('Password').fill(ADMIN.password);
  await screen.getByRole('button', 'Sign in').tap();
  await expect(screen.getByRole('heading', 'Letters Admin')).toBeVisible();
  await expect(screen.getByRole('form', 'New letter')).toBeVisible();
});
