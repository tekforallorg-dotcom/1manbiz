# 1Man.Biz — Claude Code Project Briefing

> This file is the canonical project memory. Claude Code reads it automatically and treats it as standing context for every session. Do not delete or restructure without owner approval.

---

## 1. Identity & Mission

**Product**: 1Man.Biz — a native-mobile AI business OS for African SMEs (vendors on WhatsApp, Instagram, email).
**Owner**: Vitalis "Psalms" Mabia. Single-developer project. Based in Lagos.
**Target user**: Aisha, Chinedu, Ngozi, Sola (personas in `/mnt/project/1ManBiz_User_Personas_User_Stories_and_Journey_Maps_v2.docx`).
**Design ethos**: Apple-grade refined minimalism. Green, white, black. No purple, pink, or em-dashes (middle dots OK).
**Quality bar**: International professional standards. Amateur-looking interfaces are unacceptable.

**Strategic shape (PRD v2.0)**:

- iOS app first, Android second — primary surface.
- Web (this repo's `apps/web`) is the companion + admin + API + public catalogue/receipt surface.
- Both ship in parallel. Same Supabase database. Same business logic. Two presentation layers.

Full PRD: `/mnt/project/1ManBiz_PRD_v2_0.docx`.

---

## 2. Working Methodology (NON-NEGOTIABLE)

The owner works as Staff+ Engineer / 30-year architect. Every change follows this loop. Claude Code MUST follow the same loop.

### The Tight Iteration

1. **Confirm target**: 1–2 lines restating goal, listing files/data touched. Ask for missing context if needed.
2. **Plan thinnest vertical slice**: UI → API → DB (or equivalent). Explicit acceptance criteria + rollback.
3. **Diff-first output**: for each file, show path and unified diff (or full file when new). 2-line rationale per file.
4. **Runbook + self-review**: exact steps to test locally + 20-point Quality Gate (§4 below).
5. **Stop for checkpoint**: wait for owner confirmation before next slice.

### Non-negotiable file rules

- **Always read the current file before editing**, even if you "remember" it. Files drift between sessions. Reading from the pushed commit on GitHub (raw.githubusercontent.com) is a valid way to get the authoritative current state.
- **Preserve working code**. Only touch the scoped region. Avoid regressions.
- **Preserve page structure and layout**. When extending a file, insert new logic in-place. Do not rearrange or reflow front-end structure. Visual layout must remain consistent across iterations.
- **Per-item actions stay co-located** with the data they represent (in list maps, route/view elements).
- **Never expand scope mid-slice**. If you find more work, list it as "next slice" and stop.
- **Python heredoc with `assert src.count(old) == 1`** on every replace; for multi-file edits, validate all anchors first, then write. Audit for `\n` escape corruption and run a truncation guard (biggest file must end in `}`, `;`, or `>`) after every multi-file write.

### Stop conditions

- File you've never seen → read it first (GitHub raw or local).
- Layout change of any kind → confirm before touching.
- Locked decision (naming, route, schema) → produce a **Change Record** (what changes, why, impact, migration, rollback) and wait for explicit approval. Do not just proceed.

---

## 3. Architecture & Stack

### Monorepo (pnpm workspaces 9.15.9)

### Backend

- **Supabase project**: `lcffhrbadhjnyyzivoys` — name "1ManBiz", region eu-west-3, free tier.
- **Supabase organization ID**: `rdkucesroxvpqkwkooqz`.
- **Auth**: email + password. Site URL `https://1manbiz.vercel.app`. Redirect URLs include `localhost:3000/**` and preview wildcard.
- **Storage buckets**: `product-images`, `business-logos`.
- **RLS**: enforced on every user-data table. Helper functions in `private` schema: `is_business_member(uuid)`, `is_business_owner(uuid)`.
- **Realtime**: `messages` + `conversations` are in the `supabase_realtime` publication with `REPLICA IDENTITY FULL` (migration 0013). Subscriptions are RLS-scoped — vendors stream only their own business.
- **Service-role client**: `apps/web/lib/supabase/admin.ts` bypasses RLS for the webhook ingest and outbound send paths ONLY, and only after explicit ownership verification. Never exposed to the client.

### Hosting

- **GitHub**: `github.com/tekforallorg-dotcom/1manbiz` — main branch, solo dev (no PRs, direct push to main is OK). Repo is public.
- **Vercel**: project `1manbiz` under team `tekforallorg-dotcoms-projects`. Root Directory set to `apps/web`. Include files outside root: **ON**.
- **Vercel IDs**: team `team_wH4R7DRuBcsRingXjOjXBZQR`, project `prj_EeyXQS3kesmdQ7IlSVPPlXhinPff`.
- **Production URL**: `https://1manbiz.vercel.app`.
- **Auto-deploy**: every push to `main` → ~2 min build → production.

### External integrations

- **Meta WhatsApp Cloud API**: App `1Man.biz`. Test number +1 555 669 8149 (phone_number_id 1192222053968757). Graph API v22.0. Webhook `/api/webhooks/whatsapp` verified by Meta (HMAC enforced when `WHATSAPP_APP_SECRET` is set). Subscribed field: `messages`. **The access token lives ONLY in `channel_accounts.access_token` (DB) — never in chat, never in commits. If a token is exposed, revoke and regenerate.**
- **Future**: Instagram (Meta Graph), Email (SMTP/ESP), Paystack, OPay, Moniepoint, bank webhooks. See PRD §7.

---

## 4. Quality Gate — 20-point Pre-Submit Checklist

Run before every checkpoint. Print ✅/⚠️ per item with one-line notes.

1. **Types** — strict; no `any` without comment justifying it. Prefer `unknown` / `Record<string, unknown>` + narrowing.
2. **Imports** — complete, deduped, sorted; no dead imports (remove imports that move into extracted components).
3. **Build** — no syntax/TS errors; JSX/templating well-formed.
4. **Effects/State** — dependency arrays correct; no stale closures; memoize handlers passed down; tear down subscriptions/listeners on unmount.
5. **Error handling** — predictable branches; user-facing message + developer log.
6. **Loading/Empty** — skeletons/placeholder text; no flicker due to race conditions.
7. **No drift** — naming, routes, contracts, data shapes match prior decisions.
8. **Data access** — minimal selects/projections; clear `.single()` vs maybe semantics; null/undefined safe.
9. **Security** — authz at boundary; least privilege; input validation; output encoding; safe file I/O.
10. **A11y** — labels, roles, keyboard nav; contrast sensible.
11. **Performance** — no N+1; debounce/throttle where needed; lazy load heavy bits; memoize hot paths.
12. **Testing hooks** — stable IDs/selectors; logic testable in isolation.
13. **Observability** — log levels consistent; metrics/events emit on success/failure.
14. **Idempotence** — API handlers and jobs safe on retries.
15. **Transactions/Consistency** — migrations atomic; multi-step writes guarded.
16. **Feature flags** — default safe; flags gated near entry (when applicable).
17. **Responsiveness** — layouts don't overflow; mobile/desktop sanity; safe-area insets honoured.
18. **i18n/Copy** — user text centralised; no hard-coded magic strings.
19. **Dependency hygiene** — pin or range with reason; no unnecessary libs.
20. **Docs** — top-of-file comments for tricky decisions; CHANGELOG/README snippet when needed.

---

## 5. Coding Conventions

### TypeScript

- `strict: true`. `noUncheckedIndexedAccess: true` where supported.
- Server components are the default in `apps/web` (Next.js App Router). Mark client components explicitly with `"use client"`.
- Server actions (`"use server"`) for all mutations. No client-side direct DB writes outside of the Supabase auth flow.

### Styling

- **Web**: Tailwind v4 utility-first. shadcn/ui for primitives. framer-motion only when motion is necessary.
- **Mobile**: NativeWind (Tailwind for RN). Reuses design tokens from `packages/design/src/tokens.ts`.
- **Tokens are the source of truth**: colours, type scale, spacing live in `packages/design`. Never hardcode hex outside tokens.

### Files & layout

- **App Router**: `apps/web/app/(group)/route/page.tsx`, with `actions.ts` for server actions, and feature components co-located.
- **Route-specific client components co-locate with their route** (e.g. `conversations/conversations-live.tsx`, `conversations/[id]/thread-messages.tsx`, `conversations/whatsapp-connect.tsx`). Truly shared dumb components live in `@/components`.
- **No barrel files** unless explicitly justified.
- **Components**: PascalCase. Files: kebab-case. Routes: kebab-case.
- **Imports**: use `@/` path alias for `apps/web` internals (configured in `tsconfig.json`).

### Database

- Every schema change is a numbered migration: `supabase/migrations/0013_thing.sql`.
- Each migration includes **forward + backward SQL** (rollback section commented at bottom or as separate `_down.sql`).
- RLS is mandatory on every public-schema table that holds user data.
- Trigger naming: `tg_<table>_<event>` under the `private` schema.
- When applying via Supabase MCP to production, ALSO commit the matching migration file to the repo for parity. Never leave prod and repo out of sync.

### Commits

- **Conventional Commits**: `feat(scope): subject`, `fix(scope): subject`, `chore(scope): ...`, `refactor:`, `docs:`, `test:`.
- Subject in imperative mood, lowercase except proper nouns, no trailing period.
- One feature = one commit. One slice = one commit. Migrations as separate commits from app code. Do not reuse a commit message body for a follow-up (e.g. a lint fix gets its own `fix(lint): ...`).
- Commit bodies are ASCII-only (no em-dash, emoji, or HTML tags).

### Mobile workspace conventions (added by MOB-1)

- pnpm uses `shamefully-hoist=true` at the root (.npmrc). Required because Expo + Metro and expo-cli need every transitive dep visible at the workspace root node_modules; pnpm's default isolated layout breaks Metro resolution for Expo's peer graph (whatwg-fetch, ora, @react-navigation, semver sub-paths, etc.).
- Do NOT use `node-linker=hoisted`. It breaks Vercel CI: hoisted layout eliminates apps/web/node_modules/next/ entirely, but Vercel's bin shim for next hardcodes apps/web/node_modules/next/dist/bin/next, causing MODULE_NOT_FOUND. See deviation log entry 13.
- Root `package.json` carries `pnpm.overrides` pinning `react` and `react-dom` to `19.1.0`. Matches mobile's `expo install --fix` SDK 54 peg. Web tolerates via its `^19.0.0` range. Do not bump without coordinating with mobile SDK pin.
- For any `expo-*` or `@expo/*` package, ALWAYS use `pnpm exec expo install <pkg>`, never `pnpm add <pkg>`. expo install knows the SDK alignment matrix; plain pnpm add picks `latest` and silently pulls SDK-mismatched versions.
- For Metro resolution failures on transitive sub-path imports (e.g. `semver/functions/satisfies` from react-native-reanimated), add the leaf package as a direct dep of `apps/mobile` rather than chasing `public-hoist-pattern` globs. Metro cannot reliably follow pnpm's `.pnpm/<pkg>/node_modules/<dep>` symlink chain for sub-path imports even under shamefully-hoist. See deviation log entry 14.
- Peer-dep warnings from `expo install` need actioning, not assumption. Missing peers must be installed as direct deps even if pnpm reports them resolved-via-hoist (Metro's resolver does not see the hoist chain the way pnpm does).
- Supabase JS on RN requires `import "react-native-url-polyfill/auto"` as the FIRST import in `apps/mobile/lib/supabase.ts`. Without it, signInWithPassword throws silently because RN's URL implementation is partial.
- Use protected route group layouts for auth in expo-router: `app/(auth)/_layout.tsx` redirects signed-in users to `/home`; `app/(app)/_layout.tsx` redirects signed-out users to `/sign-in`. Required for cold-launch + sign-out from any route.
- `SafeAreaView` is ALWAYS imported from `react-native-safe-area-context`, never `react-native`. For bottom-edge composers, drop the `bottom` edge and apply `useSafeAreaInsets().bottom` as paddingBottom (keyboard-aware: full inset when keyboard hidden, small base when shown).
- Dual-Tailwind reality: `apps/web` runs Tailwind v4; `apps/mobile` runs Tailwind v3.4 (NativeWind v4 requirement). Do not bump mobile past `tailwindcss@^3.4.x` until NativeWind v5 ships stable.
- TypeScript drift across surfaces: `~5.6` (web) vs `~5.9` (mobile). Each workspace has its own tsc. Tokens in `packages/design` are pure data and compile under both.
- Metro can serve a STALE bundle after a correct push. After any mobile rewrite, `git --no-pager diff -- apps/mobile/<path>` to confirm, then `expo start -c` + device reload. See deviation log entry 17.

### Messaging & realtime conventions (3G.B—3G.E)

- Money is stored in **kobo** (integer; 1 NGN = 100 kobo). Divide by 100 ONLY at the format boundary. The currency formatter inserts a narrow no-break space (`\u202f`) between ₦ and the digits to avoid iOS glyph collision.
- Inbound phone numbers are normalised through `lib/phone.ts` (`normalizePhoneE164`) on both surfaces. Never store raw digits or a naive `+` prefix.
- Outbound WhatsApp ALWAYS goes through the single endpoint `apps/web/app/api/messages/send`. Web sends with cookie auth; mobile sends with a Bearer token from `supabase.auth.getSession()`. The endpoint is the single source of truth.
- `meta_message_id UNIQUE` on `messages` is the idempotency boundary — the webhook insert and the outbound send both rely on it, and Meta retries are safe.
- Realtime: subscribe via `supabase.channel(...).on("postgres_changes", { event, schema: "public", table, filter: "<col>=eq.<id>" }, cb)`, filtered by `conversation_id` (thread) or `business_id` (inbox); `removeChannel` on cleanup. Dedupe inserts by `id` so an optimistic send is not doubled. Web inbox/thread are server components, so realtime lives in client wrappers (`ThreadMessages`, `ConversationsLive`) seeded by server-rendered data; mobile screens subscribe directly. Server render + focus-refetch / router.refresh() remain as fallbacks if the socket never connects.

### Pre-push checklist (Mac terminal)

```bash
cd ~/code/1manbiz

# 1. Type-check BOTH apps (tsc is NOT a lint check — see deviation log 16)
pnpm --filter web    exec tsc --noEmit
pnpm --filter mobile exec tsc --noEmit

# 2. Lint web — matches the Vercel build pipeline; tsc does NOT run ESLint
pnpm --filter web exec next lint
#    NOTE: `next lint` is deprecated and removed in Next 16. Before any Next 16
#    bump, migrate: npx @next/codemod@canary next-lint-to-eslint-cli .

# 3. Audit Python-heredoc edits for escape corruption (count should stay flat)
grep -rn '\\n' apps packages | grep -v node_modules | grep -v '.next' | wc -l

# 4. Truncation guard on the biggest file touched (must end in } ; or >)
tail -c 50 <biggest_file_path>

# 5. Visual-diff every mobile rewrite (catches silent heredoc misses — deviation 17)
git --no-pager diff -- apps/mobile/<path>

# 6. Optional: prove Vercel will pass before pushing
pnpm --filter web exec next build

# 7. Commit (Conventional Commits, ASCII-only body) + push
git add -A
git commit -m "<type>(<scope>): <subject>" -m "<body>"
git push                                  # auto-deploys via Vercel
```

---

## 6. Stop / Ask Before Acting

Claude Code must STOP and ask the owner before:

- Running any destructive command (`rm -rf`, `git reset --hard`, `git push --force`, `DROP TABLE`, anything irreversible).
- Modifying files in `supabase/migrations/` that already have higher-numbered siblings (these are already-applied; new changes go in a NEW migration).
- Touching `.env.local` or env vars (read-only awareness; the owner manages these manually).
- Changing locked decisions: brand colours, package names, route structure, table names, column names, primary tech stack.
- Installing new dependencies (must justify why existing libs can't do the job).
- Changing CI, build config, or Vercel project settings.
- Putting any production secret in chat (Meta token etc.). Secrets go to Supabase Studio or Vercel env directly.

If the owner's request seems to violate one of these, say so and ask for an explicit Change Record.

---

## 7. Current Build State (as of 2026-06-01)

### Phase 1 — Foundations (web): ✅ DONE

Auth flow, onboarding wizard, dashboard shell, mobile bottom nav, settings page.

### Phase 2 — Core business loops (web): ✅ DONE

- 3B Products/Inventory CRUD with image upload.
- 3C Public catalogue at `/c/[slug]`.
- 3D Customers directory with WhatsApp deep-link chat.
- 3E.A Manual order capture with line items.
- 3E.B Order detail page, mark-paid + cancel actions, real dashboard cards.
- 3F Public receipt page at `/r/[code]` + share controls.

### Phase 3 — WhatsApp + AI: 3G DONE (two-way live), AI pending

- ✅ 3G.A: `channel_accounts` table (RLS), `/api/webhooks/whatsapp` route, Conversations connect UI. Webhook verified by Meta.
- ✅ 3G.B: migration 0012 (conversations + messages), service-role admin client, webhook ingest pipeline (HMAC verify, E.164 normalise, upsert customer + conversation, idempotent message insert keyed on `meta_message_id`), web inbox + thread view.
- ✅ 3G.C: outbound reply via single dual-auth endpoint `/api/messages/send` (cookie for web, Bearer for mobile), ownership-scoped, Meta Graph POST, message keyed on returned wamid. Verified end-to-end on web AND iPhone (customer received on real WhatsApp).
- ✅ 3G.D: mobile Chats tab wired to real conversations/messages.
- ✅ 3G.E: Supabase Realtime on `messages` + `conversations` (migration 0013). Inbox + thread update live on web and mobile with no refresh, via RLS-scoped `postgres_changes` subscriptions. Web uses client wrappers (`ThreadMessages`, `ConversationsLive`) over server-rendered initial data; mobile subscribes directly.
- ❌ 3H: PENDING — AI inbound parsing (Claude/OpenAI) proposing customer/order/reply for vendor approval. `sender_role='ai'` already exists in `messages`. Needs a v1 product spec before build.

### Phase 4 — Mobile (Apple-grade iOS first): MOB-1..6 DONE

- ✅ **MOB-1**: Expo SDK 54 + RN 0.81.5 + NativeWind v4 + Supabase JS bootstrap. Email/password sign-in, SecureStore chunked session, protected route groups `(auth)`/`(app)`.
- ✅ **MOB-2**: dashboard home — 4 tiles (revenue today, orders today, pending, active products) + recent orders, pull-to-refresh, useFocusEffect.
- ✅ **MOB-3**: bottom tab navigation (Home, Chats, Orders, Inventory, Settings); Stack > Tabs hierarchy.
- ✅ **MOB-4 + MOB-5**: orders + inventory tabs with status-filter pills, pull-to-refresh.
- ✅ **MOB-4.1**: order detail + mark-paid (native Alert confirm, optimistic flip, DB-trigger receipt code, View receipt deep link).
- ✅ **MOB-6**: capture new order from iPhone (customer picker + product multi-select modal + qty steppers + sequential insert with orphan recovery).
- ✅ **DESIGN-1**: design tokens wired into mobile NativeWind (flat aliases on `colors`); hardcoded hex eliminated.
- ✅ **3G.C-mobile + padding**: thread composer (TextInput + Send + optimistic + rollback) with keyboard-aware safe-area bottom padding. Verified on iPhone.
- 🟡 **SDK upgrade** (backlog): Expo 54 → 56 when Xcode + Simulator ready.
- ❌ **MOB-7** (candidate): product detail + edit (closes the inventory loop the way MOB-4.1 closed orders).
- ❌ **MOB-WhatsApp-Connect** (candidate): native Connect flow (currently bounces users to web for the Meta OAuth dance).

### Infrastructure

- ✅ INFRA-1: pnpm workspaces monorepo restructure (commit `af39855`). Web deploys via `apps/web` root directory on Vercel.
- ✅ INFRA-2: `.npmrc` `shamefully-hoist=true` + `pnpm.overrides` pinning react/react-dom to 19.1.0 (commit `e2f5575`).

### Live data (Gadget Locker — owner's own business, used as the dogfood tenant)

- 1 business: Gadget Locker, id `38bef9fa-c63d-4370-8382-acd1eed1a89a`, catalogue active.
- 3 products: iPhone 17 Pro (₦2.1M), iPhone 17 Air (₦1.3M), Pixel 9 Pro (out of stock).
- Customers include Adaeze and "P" (`+2347031064144` — a real WhatsApp-enabled device used for end-to-end testing).
- 1 active conversation `605e24ac-5e19-47c3-9ba3-faa07019315a` (customer P): 4 messages (1 inbound "Hello", 3 outbound incl. one sent from the iPhone, delivered).
- 1 channel_account: connected to the Meta test number (phone_number_id 1192222053968757), status `connected`. Access token in DB only.

### DB migrations applied (13 total)

0001 profiles, 0002 businesses, 0003 business_members + RLS helpers,
0004 products + product-images bucket, 0005 catalogue RPC + business-logos bucket,
0006 search_path hardening, 0007 customers, 0008 orders + order_items, 0009 order status trigger, 0010 receipt_code + public.get_public_receipt RPC, 0011 channel_accounts,
0012 conversations + messages (RLS, meta_message_id UNIQUE idempotency, inbox + thread indexes),
0013 realtime_messaging (messages + conversations added to supabase_realtime publication, REPLICA IDENTITY FULL).

---

## 8. Common Operations Cheat Sheet

### Apply a new migration

```bash
# 1. Create file
cat > supabase/migrations/00XX_thing.sql << 'EOF'
-- forward
...
-- rollback (comment)
EOF

# 2. Apply via Supabase MCP (claude-code session) OR via SQL editor in Supabase dashboard
# Never apply ad-hoc SQL to production without a migration file in the repo.
```

### Run local build

```bash
pnpm --filter web build
```

### Check production deploy state

Ask the Vercel MCP: `list_deployments` for project `1manbiz`. Look for state `READY` on the most recent commit SHA.

### Read/query production DB

Use Supabase MCP. NEVER paste actual user data into chat output unless owner explicitly requests it. Return booleans/counts for sensitive fields (e.g. token presence), never the value.

---

## 9. Locked Decisions (do not change without Change Record)

- Brand colours: `#00D26A` primary (from `packages/design/src/tokens.ts` — tokens.ts is source of truth, this line documents). White, black. No purple, pink, em-dashes.
- Wordmark: "1Man" (black) + "." (green) + "Biz" (black).
- Currency display: `₦` symbol, comma separators, no decimals on whole-naira amounts (e.g. `₦1,300,000`).
- Money is stored in kobo (integer; 1 NGN = 100 kobo). Divide by 100 only at the format boundary. Formatter uses a narrow no-break space (`\u202f`) between `₦` and digits.
- Table naming: snake_case singular for utility, snake_case plural for entities (`businesses`, `products`, `customers`, `orders`, `order_items`, `conversations`, `messages`, `channel_accounts`).
- Foreign keys: `<table>_id` (e.g. `business_id`, `customer_id`).
- Timestamps: every table has `created_at timestamptz default now()` and `updated_at timestamptz default now()` with a trigger to bump `updated_at` on row update.
- Phone numbers: stored as E.164 (e.g. `+2348012345678`) in column `phone_e164`; normalised via `lib/phone.ts`.
- Receipt codes: 8-char alphanumeric uppercase, unique per business, generated by `public.generate_receipt_code()`.
- Outbound WhatsApp always goes through `apps/web/app/api/messages/send` (single source of truth). `meta_message_id UNIQUE` on `messages` is the idempotency boundary. The service-role admin client is used only after explicit ownership verification.
- Realtime: `messages` + `conversations` are in the `supabase_realtime` publication with REPLICA IDENTITY FULL; subscriptions are RLS-scoped.
- Production secrets (Meta access token) live only in the DB (`channel_accounts.access_token`) or Vercel env vars — never in chat or commits.

---

## 10. File Pointers (for project knowledge)

When more context is needed, see these files in `/mnt/project/`:

- `1ManBiz_PRD_v2_0.docx` — Product Requirements v2.0 (the current source of truth).
- `1ManBiz_System_Architecture_Document_v2.docx` — system architecture.
- `1ManBiz_Database_Schema_ERD_and_Data_Dictionary_v2.docx` — DB ERD.
- `1ManBiz_User_Personas_User_Stories_and_Journey_Maps_v2.docx` — personas + stories.
- `1ManBiz_Wireframes_Screen_Specifications_and_Design_System_v2.docx` — UX + design system.
- `1ManBiz_AI_Architecture_Prompt_and_Agent_Design_Document_v2.docx` — AI Staff design.
- `1ManBiz_API_Webhooks_and_Integration_Specification_v2.docx` — integrations.
- `1ManBiz_Security_NFR_and_Analytics_Specification_v2.docx` — NFRs + telemetry.
- `1ManBiz_Implementation_Blueprint_Sprint_and_Delivery_Plan_v2.docx` — sprint plan.
- `1ManBiz_Feature_Bible_and_Functional_Requirements_Specification_v2.docx` — feature spec.
- `coding_behaviour_and_coding_style.docx` — owner's coding preferences (this CLAUDE.md is the distilled version).

---

## 11. Deviation Log

Permanent record of unexpected setup hurdles and how they were resolved. Future debugging starts here when something looks off in the build/deploy pipeline.

### Entries 01—12 (resolved during MOB-1 slice, commit `16dfe32`)

1.  `full_name` vs `first_name` schema assumption — fixed with `firstNameFrom` client helper in `apps/mobile/lib/profile.ts`.
2.  Tailwind v4 incompatible with NativeWind v4 — pinned mobile `tailwindcss` to `^3.4.x`.
3.  Loose `expo` wildcard pin — tightened to `~54.0.0` explicit.
4.  Em-dash in user-facing copy violates Section 1 design rules — substituted middle dot in app copy.
5.  SDK 56 unsupported by App Store Expo Go — downgraded to SDK 54.
6.  Bogus `expo-status-bar` config plugin entry — removed from `app.json` plugins.
7.  `@expo/metro-runtime` missing as direct dep — added via `pnpm exec expo install`.
8.  First install pulled SDK 56 version of metro-runtime — re-aligned to `~6.1.2` via expo install.
9.  pnpm isolated layout hides Expo runtime polyfills from Metro — initially tried `node-linker=hoisted` (later reverted, see entry 13).
10. Hoisting exposed React 19.1 / 19.2 dual install in web bundle — fixed with `pnpm.overrides`.
11. Supabase JS RN URL parsing silent failure — fixed with `import "react-native-url-polyfill/auto"` as first import.
12. Cold-launch sign-out left stale Stack history — fixed with protected route group layouts.

### Entries 13—14 (resolved during MOB-1 deploy recovery, commit `e2f5575`)

13. **`node-linker=hoisted` broke Vercel CI.** Locally hoisted worked for Expo. On Vercel, hoisted eliminates `apps/web/node_modules/next/` entirely, but the next-build bin shim hardcodes that path. Result: `MODULE_NOT_FOUND` at the `next build` step. Fix: replace `node-linker=hoisted` with `shamefully-hoist=true`. Keeps pnpm's isolated linker (apps/web/node_modules/next/ stays a proper symlink, Vercel happy) while flattening every transitive dep to the workspace root for Metro. Best of both worlds.
14. **Metro cannot resolve sub-path imports through pnpm symlinks even with shamefully-hoist.** Specifically, react-native-reanimated 4.x imports `semver/functions/satisfies`. Metro's nodeModulesPaths walker stops at the first node_modules with a matching package name and does not descend through pnpm's virtual-store symlinks for sub-path imports. Fix: add the leaf package (`semver`) as a direct dep of `apps/mobile`. Generalises to: when Metro chokes on a transitive sub-path import, pull the leaf package up as a direct dep rather than chasing public-hoist-pattern globs.

### Entries 15—20 (resolved across the 3G.B—3G.E messaging slices)

15. **Meta access tokens pasted in chat were compromised (twice).** Two tokens were exposed in chat and revoked. Rule: permanent production secrets NEVER appear in chat — they go directly into Supabase Studio (`channel_accounts.access_token`) or Vercel env vars. Never offer a "paste it in chat" path. Before pasting into a populated DB field, select-all-delete first (see entry 18).
16. **`tsc --noEmit` is NOT a lint check.** 3G.C passed tsc locally but failed Vercel with `@typescript-eslint/no-explicit-any`. Next.js runs ESLint during its build; tsc does not. Pre-push must run BOTH tsc (each app) AND `next lint` (web).
17. **Metro can serve a stale bundle after a correct push.** The 3G.C mobile composer shipped in `cdcde69` (confirmed by reading the pushed file on GitHub) but the iPhone still showed the old screen — stale Metro cache, not a missing rewrite. Fix: `expo start -c` + device reload. Process: visual-diff every mobile rewrite immediately after applying it.
18. **DB string-field concatenation bug.** Pasting a new token into a non-empty field produced a ~600-char corrupted value (old + new) and continuous 401 OAuthException code 190. Always select-all-delete before pasting into a populated DB field.
19. **`unknown` over `any`.** ESLint blocks `any` even with a rationale. Use `unknown` / `Record<string, unknown>` + narrowing, including in catch params and realtime payloads.
20. **`next lint` deprecated in Next 16.** Before any Next 16 bump, migrate the pre-push gate to the ESLint CLI: `npx @next/codemod@canary next-lint-to-eslint-cli .`

### Entries 21—22 (resolved across the AI-parser + product-edit slices)

21. **Selective `git add <list>` leaks files (hit 3x in one session).** When edits span more files than the explicit `git add` list, some changes stay unstaged. `main` then fails a fresh-clone `tsc` (a committed file references an uncommitted edit) even though local `pnpm verify` passes, because the working tree still holds the unstaged edits. Hit 3x: the 3H.3 thread screen, the Chunk 1 web migration files, and the two mobile libs (order-create source param + conversation customer_id). Rule: before every commit run `git add -A` then `git status --short` and eyeball that every intended file is staged. Never hand-type a file list.
22. **AI order parser is customer+vendor role-aware, customer-as-buyer.** `/api/ai/parse-order` feeds the model a role-labelled transcript of BOTH sides (`Customer:` / `Shop:`, excluding prior `ai`-role drafts) and extracts what the CUSTOMER is buying, using shop lines as corroboration. Consequence: vendor-typed-as-buyer text does NOT draft an order (the shop is not the buyer), so dogfooding must use real inbound customer messages. Tooling notes from the same arc: Supabase MCP multi-statement SQL returns only the LAST statement's rows (run constraint/policy/column checks as single statements); and `esbuild --bundle=false` syntax-checks TS/TSX without resolving imports, so bare `@1manbiz/*` and `@/` imports need no stubbing.

### Entries 23—26 (resolved across the bookings module + mobile parity slices)

23. **`pnpm verify` is NOT `next build` — build-only lint rules escape it.** `verify` runs `next lint`, which passes `@next/next/no-html-link-for-pages` as a non-fatal info, but the production `next build` treats it as a hard ERROR. A raw `<a href="/dashboard/...">` for internal nav (a conflict-banner link in the bookings create form) passed `pnpm verify` locally yet failed the Vercel build (`7d7332b` ERROR → fixed in `5194c6e`). Rules: (a) always use Next `<Link>` for internal navigation, never `<a>`; (b) treat a green `pnpm verify` as necessary-not-sufficient — the real gate is the Vercel build going READY. Consider adding `next build` to a pre-push check.
24. **Mobile `TypeError: Network request failed` is device→Supabase connectivity, not a code bug.** Surfaced at `order-create.ts` on the insert; the error is thrown by the Supabase JS fetch layer when it can't reach the REST endpoint (wifi/Metro-tunnel drop, env not loaded, transient blip). The `http://192.168.x.x:8081/...node_modules/.pnpm/...` URL in the stack is a RED HERRING — that's just the Metro bundler address where the JS came from, not the failing request. Confirmed not-a-bug by: backend healthy (Supabase responded), client config sound (it throws at launch if env is missing, so reaching a screen proves env loaded), and the same path worked before. Fix is environmental: toggle wifi / reload / confirm same-LAN + Metro host IP. (Future polish: friendlier "couldn't reach the server" message for network-class failures.)
25. **`arr.length > 0` does NOT narrow `arr[0]` under strict indexed access.** With `noUncheckedIndexedAccess`, `if (clashes && clashes.length > 0) { ...clashes[0].title... }` still errors `Object is possibly 'undefined'` (TS2532) — the length check doesn't teach TS that index 0 exists. Idiom: bind then check — `const clash = clashes?.[0]; if (clash) { ...clash.title... }`. Cleaner than a non-null assertion. (Hit in the bookings soft-conflict check, web + mobile.)
26. **Multi-line generic type annotations are heredoc-paste-fragile.** A `const X: Record<\n  K,\n  { a: string; b: string }\n> = {` spanning multiple lines got mangled on paste into the user's editor; `tsc` then read the inline object type as a value expression (cascading TS1005 `,`/`;` expected, TS1109/TS1128). `esbuild --bundle=false` tolerated it (loose parse), so it escaped sandbox validation and only `tsc` caught it. Two surgical patches failed against the invisible mangled file; a full-file `cat >` rewrite fixed it (`9d6fecea`). Rules: (a) keep type annotations on a SINGLE line (mirror the working `STATUS_STYLES` one-liner); (b) hoist shared shapes to NAMED module-scope types (`type TransitionKind = ...`) so they can't be misparsed in statement position; (c) when two anchored patches fail against a file Claude can't see, stop patching and do a full-file rewrite.

---

## 12. Final Slice Footer Template

Every slice ends with this footer. Copy it verbatim:

```
### What I changed
- 1–3 bullet summary.

### How to verify now
1. Numbered steps with exact routes/commands/selectors.

### Known limitations / Next slice
- Short list of out-of-scope items observed.

### Quality Gate
[Print the 20-point checklist with ✅/⚠️ + one-line notes]

Stop here for review.
```

---

_Last updated: 2026-06-03, end of the bookings module + mobile-parity + ConfirmSheet arc, HEAD on main `9d6fecea`. Maintained by Claude on owner request._
