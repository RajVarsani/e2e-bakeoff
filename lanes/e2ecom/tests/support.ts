import '../env';
import { urls } from '../../../ports';

export { urls };
export const ADMIN = { email: 'admin@example.test', password: 'admin-pass-1' };
export const ALICE = { email: 'alice@example.test', password: 'alice-pass-1' };
export const BOB = { email: 'bob@example.test', password: 'bob-pass-1' };
export const CRM_USER = { email: 'crm.user@example.test', password: 'crm-pass-1' };

type Req = { post(url: string, o?: { json?: unknown; headers?: Record<string, string> }): Promise<{ status: number; json(): Promise<any> }> };

export async function resetStack(request: Req) {
  for (const base of [urls.api, urls.crm]) {
    const r = await request.post(`${base}/test/reset`);
    if (r.status !== 200) throw new Error(`reset ${base} -> ${r.status}`);
  }
}

export async function seedLetter(request: Req, l: { title: string; body: string; recipientEmail: string; status: 'draft' | 'ready' }) {
  const r = await request.post(`${urls.api}/test/seed`, { json: { letters: [l] } });
  return (await r.json()).letters[0] as { id: number };
}

export async function login(request: Req, who: { email: string; password: string }) {
  const r = await request.post(`${urls.api}/auth/login`, { json: who });
  return (await r.json()).token as string;
}

// Locator-only sign-in used by both admin and portal login forms.
export async function signIn(screen: any, who: { email: string; password: string }) {
  await screen.getByLabel('Email').fill(who.email);
  await screen.getByLabel('Password').fill(who.password);
  await screen.getByRole('button', 'Sign in').tap();
}
