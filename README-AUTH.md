# 1Man.Biz — Auth & Onboarding Setup (Slice 3A)

This is the **one-time setup** for the auth and onboarding foundation.
After running these steps, sign-up and sign-in work locally.

---

## 1. Install Supabase client packages

```powershell
cd $env:USERPROFILE\Downloads\1manbiz-web
pnpm add @supabase/supabase-js @supabase/ssr
```

## 2. Fill in `.env.local`

If you don't already have one:

```powershell
Copy-Item .env.local.example .env.local
```

Open `.env.local` and paste your **project URL** and **anon key** from
**Supabase Dashboard → Project Settings → API**.

> Reusing your project from the previous attempt? Same place — just copy
> the values.

## 3. Apply the database migration

Open **Supabase Dashboard → SQL Editor → New Query**.
Paste the contents of `supabase/migrations/0001_auth_and_businesses.sql` and click **Run**.

The migration:
- Creates `profiles`, `businesses`, `business_members` tables
- Enables RLS with sensible policies
- Installs an `on_auth_user_created` trigger that auto-creates a profile row
- Installs `updated_at` triggers on `profiles` and `businesses`

It's **idempotent** — safe to re-run if anything fails partway.

> If your project has OLD tables with the same names from the previous attempt,
> drop them first via SQL editor (`drop table if exists public.<name> cascade;`)
> then run the migration.

## 4. Supabase Auth settings

In **Supabase Dashboard → Authentication → URL Configuration**:
- **Site URL**: `http://localhost:3000`
- **Redirect URLs**: add `http://localhost:3000/auth/callback`

In **Authentication → Providers → Email**:
- Make sure **Email** is enabled
- (Recommended for dev) Confirm email is optional, or use the **Email Confirmations** toggle as you prefer

## 5. Run the app

```powershell
pnpm dev
```

Open `http://localhost:3000/sign-up`.

---

## Test flow

1. **Sign up** at `/sign-up`
2. If email confirmation is on, click the link from your inbox
3. You land on `/onboarding` — complete the 3 steps
4. You land on `/dashboard`
5. Sign out from the sidebar (desktop) or top-right icon (mobile)
6. Sign back in at `/sign-in` → goes straight to `/dashboard`

## What's in the database after onboarding

For each completed sign-up:
- 1 row in `auth.users` (Supabase managed)
- 1 row in `public.profiles` (auto-created by trigger, `onboarded=true` after wizard)
- 1 row in `public.businesses` (created by the wizard)
- 1 row in `public.business_members` (you as `owner`)

You can inspect these via **Supabase Dashboard → Table Editor**.

## Files added in this slice

```
lib/supabase/
  client.ts          browser client (Client Components)
  server.ts          server client (RSC + Server Actions)
  middleware.ts      session refresh + redirects

middleware.ts        root middleware orchestration

app/auth/callback/
  route.ts           exchanges email-link code for session

app/(auth)/
  layout.tsx
  actions.ts         signUp / signIn / signOut server actions
  sign-up/page.tsx
  sign-in/page.tsx

app/(app)/onboarding/
  page.tsx           server: redirect-if-onboarded gate
  onboarding-wizard.tsx   client: 3-step wizard
  actions.ts         completeOnboarding server action

app/(app)/dashboard/
  layout.tsx         sidebar + topbar + signOut, auth gate
  page.tsx           welcome / KPI placeholder

components/ui/
  input.tsx
  label.tsx

supabase/migrations/
  0001_auth_and_businesses.sql
```

## Next slice (3B)

Once you've verified the flow works end-to-end, we wire the first real
dashboard feature. Probable choice: **Inventory** (simplest to test, no
external integrations).
