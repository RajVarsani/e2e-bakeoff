# Letters Plan

## Application Overview

Test plan for the letters system: admin app (http://admin.localhost:5201), portal (http://portal.localhost:5202), crm (http://crm.localhost:5203), api (5200). Admin manages letters (CRUD, Publish, async render 2-6s: draft/rendering/ready/failed, ?forceFail=1 forces failure with Retry). Portal shows inbox, letter view and Connect CRM via cross-origin OAuth. Credentials: admin admin@example.test/admin-pass-1; portal alice@example.test/alice-pass-1, bob@example.test/bob-pass-1; crm crm.user@example.test/crm-pass-1.

## Test Scenarios

### 1. Letters

**Seed:** `seed.spec.ts`

#### 1.1. S1 Admin login: wrong password then correct login

**File:** `tests/letters/s1-admin-login.spec.ts`

**Steps:**
  1. Start from seed state: admin app at http://admin.localhost:5201 showing Sign in form.
    - expect: Heading 'Sign in' and Email/Password fields are visible
  2. Enter admin@example.test and password 'wrong-pass', click Sign in.
    - expect: An error message is shown
    - expect: User remains on the Sign in form; no letters list is shown
  3. Clear password, enter admin-pass-1, click Sign in.
    - expect: Sign in succeeds and the letters admin view is displayed
    - expect: Sign in heading is no longer visible

#### 1.2. S2 Create and publish letter, Alice sees it in portal

**File:** `tests/letters/s2-publish-alice.spec.ts`

**Steps:**
  1. Sign in to admin as admin@example.test / admin-pass-1.
    - expect: Letters list is shown
  2. Create a new letter titled 'Welcome for Alice' addressed to Alice with a body, and save.
    - expect: Letter appears in list with status draft
  3. Click Publish.
    - expect: Status changes to rendering
  4. Wait up to ~10s for the render.
    - expect: Status becomes ready
  5. In a second browser context/session open http://portal.localhost:5202 and sign in as alice@example.test / alice-pass-1.
    - expect: Alice inbox is shown
  6. Open the 'Welcome for Alice' letter from the inbox.
    - expect: Letter view shows title 'Welcome for Alice' and the body entered in admin

#### 1.3. S3 Portal Alice connects CRM via OAuth and sees clients

**File:** `tests/letters/s3-connect-crm.spec.ts`

**Steps:**
  1. Open portal and sign in as alice@example.test / alice-pass-1.
    - expect: Inbox is shown
  2. Click Connect CRM.
    - expect: Browser redirects cross-origin to http://crm.localhost:5203 login/consent
  3. Sign in to crm as crm.user@example.test / crm-pass-1 if prompted, then click Allow on the consent screen.
    - expect: Browser redirects back to portal at http://portal.localhost:5202
  4. View the CRM clients on the portal.
    - expect: CRM shown as connected
    - expect: Clients Jordan Lee, Sam Patel and Riley Chen are listed

#### 1.4. S4 Edit published letter re-renders and Alice sees new body

**File:** `tests/letters/s4-edit-published.spec.ts`

**Steps:**
  1. In admin, sign in, create letter 'Welcome for Alice' for Alice, publish and wait for ready.
    - expect: Status is ready
  2. Edit the letter body to 'Updated body text' and save.
    - expect: Status changes to rendering
  3. Wait up to ~10s.
    - expect: Status returns to ready
  4. In a second session sign in to portal as Alice and open the letter from inbox.
    - expect: Letter body shows 'Updated body text', not the old body

#### 1.5. S5 forceFail publish ends failed with Retry; Alice inbox shows failed

**File:** `tests/letters/s5-force-fail.spec.ts`

**Steps:**
  1. Sign in to admin, then open http://admin.localhost:5201/?forceFail=1 and create letter 'Welcome for Alice' for Alice.
    - expect: Letter is in draft
  2. Click Publish.
    - expect: Status goes to rendering
  3. Wait up to ~10s.
    - expect: Status becomes failed
    - expect: A Retry button is visible
  4. In a second session sign in to portal as alice@example.test / alice-pass-1.
    - expect: Inbox lists the letter with status failed

#### 1.6. S6 Bob cannot access Alice's letter

**File:** `tests/letters/s6-bob-isolation.spec.ts`

**Steps:**
  1. In admin, create and publish 'Welcome for Alice' for Alice, wait for ready, and note the letter id from the URL or Alice's inbox link (/letters/<id>).
    - expect: Letter is ready; id captured
  2. In a separate session sign in to portal as bob@example.test / bob-pass-1.
    - expect: Bob inbox is shown and does not contain 'Welcome for Alice'
  3. Navigate directly to http://portal.localhost:5202/letters/<id>.
    - expect: Page shows 'Letter not found'
    - expect: Letter title and body are not disclosed
