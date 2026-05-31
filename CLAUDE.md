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

- **Always read the current file before editing**, even if you "remember" it. Files drift between sessions.
- **Preserve working code**. Only touch the scoped region. Avoid regressions.
- **Preserve page structure and layout**. When extending a file, insert new logic in-place. Do not rearrange or reflow front-end structure. Visual layout must remain consistent across iterations.
- **Per-item actions stay co-located** with the data they represent (in list maps, route/view elements).
- **Never expand scope mid-slice**. If you find more work, list it as "next slice" and stop.

### Stop conditions

- File you've never seen → ask for full contents.
- Layout change of any kind → confirm before touching.
- Locked decision (naming, route, schema) → produce a **Change Record** (what changes, why, impact, migration, rollback) and wait for explicit approval. Do not just proceed.

---

## 3. Architecture & Stack

### Monorepo (pnpm workspaces 9.15.9)

```
1manbiz/
├── apps/
│   ├── web/         ← Next.js 15.5.18, App Router, React 19, TS strict, Tailwind v4, shadcn/ui, framer-motion
│   └── mobile/      ← Expo + React Native + NativeWind (placeholder; MOB-1 will bootstrap)
├── packages/
│   ├── shared/      ← TypeScript types shared across surfaces (currently empty)
│   └── design/      ← Design tokens (colours, typography, spacing, radii) — already populated
├── supabase/
│   └── migrations/  ← Forward + rollback SQL, atomic, numbered 0001+
├── pnpm-workspace.yaml
├── package.json      ← workspace root, private
└── CLAUDE.md         ← this file
```

### Backend

- **Supabase project**: `lcffhrbadhjnyyzivoys` — name "1ManBiz", region eu-west-3, free tier.
- **Supabase organization ID**: `rdkucesroxvpqkwkooqz`.
- **Auth**: email + password. Site URL `https://1manbiz.vercel.app`. Redirect URLs include `localhost:3000/**` and preview wildcard.
- **Storage buckets**: `product-images`, `business-logos`.
- **RLS**: enforced on every user-data table. Helper functions in `private` schema: `is_business_member(uuid)`, `is_business_owner(uuid)`.

### Hosting

- **GitHub**: `github.com/tekforallorg-dotcom/1manbiz` — main branch, solo dev (no PRs, direct push to main is OK).
- **Vercel**: project `1manbiz` under team `tekforallorg-dotcoms-projects`. Root Directory set to `apps/web`. Include files outside root: **ON**.
- **Vercel IDs**: team `team_wH4R7DRuBcsRingXjOjXBZQR`, project `prj_EeyXQS3kesmdQ7IlSVPPlXhinPff`.
- **Production URL**: `https://1manbiz.vercel.app`.
- **Auto-deploy**: every push to `main` → ~2 min build → production.

### External integrations

- **Meta WhatsApp Cloud API**: App `1Man.biz` (id 989138553599749). Test number +1 555 669 8149 (phone_number_id 1192222053968757, WABA 27031650399817263). Webhook URL `/api/webhooks/whatsapp` verified by Meta. Subscribed field: `messages`.
- **Future**: Instagram (Meta Graph), Email (SMTP/ESP), Paystack, OPay, Moniepoint, bank webhooks. See PRD §7.

---

## 4. Quality Gate — 20-point Pre-Submit Checklist

Run before every checkpoint. Print ✅/⚠️ per item with one-line notes.

1. **Types** — strict; no `any` without comment justifying it.
2. **Imports** — complete, deduped, sorted; no dead imports.
3. **Build** — no syntax/TS errors; JSX/templating well-formed.
4. **Effects/State** — dependency arrays correct; no stale closures; memoize handlers passed down.
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
17. **Responsiveness** — layouts don't overflow; mobile/desktop sanity.
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
- **No barrel files** unless explicitly justified.
- **Components**: PascalCase. Files: kebab-case. Routes: kebab-case.
- **Imports**: use `@/` path alias for `apps/web` internals (configured in `tsconfig.json`).

### Database

- Every schema change is a numbered migration: `supabase/migrations/0012_thing.sql`.
- Each migration includes **forward + backward SQL** (rollback section commented at bottom or as separate `_down.sql`).
- RLS is mandatory on every public-schema table that holds user data.
- Trigger naming: `tg_<table>_<event>` under the `private` schema.

### Commits

- **Conventional Commits**: `feat(scope): subject`, `fix(scope): subject`, `chore(scope): ...`, `refactor:`, `docs:`, `test:`.
- Subject in imperative mood, lowercase except proper nouns, no trailing period.
- One feature = one commit. One slice = one commit. Migrations as separate commits from app code.

### Mobile workspace conventions (added by MOB-1)

- pnpm uses `shamefully-hoist=true` at the root (.npmrc). Required because Expo + Metro and expo-cli need every transitive dep visible at the workspace root node_modules; pnpm's default isolated layout breaks Metro resolution for Expo's peer graph (whatwg-fetch, ora, @react-navigation, semver sub-paths, etc.).
- Do NOT use `node-linker=hoisted`. It breaks Vercel CI: hoisted layout eliminates apps/web/node_modules/next/ entirely, but Vercel's bin shim for next hardcodes apps/web/node_modules/next/dist/bin/next, causing MODULE_NOT_FOUND. See deviation log entry 13.
- Root `package.json` carries `pnpm.overrides` pinning `react` and `react-dom` to `19.1.0`. Matches mobile's `expo install --fix` SDK 54 peg. Web tolerates via its `^19.0.0` range. Do not bump without coordinating with mobile SDK pin.
- For any `expo-*` or `@expo/*` package, ALWAYS use `pnpm exec expo install <pkg>`, never `pnpm add <pkg>`. expo install knows the SDK alignment matrix; plain pnpm add picks `latest` and silently pulls SDK-mismatched versions.
- For Metro resolution failures on transitive sub-path imports (e.g. `semver/functions/satisfies` from react-native-reanimated), add the leaf package as a direct dep of `apps/mobile` rather than chasing `public-hoist-pattern` globs. Metro cannot reliably follow pnpm's `.pnpm/<pkg>/node_modules/<dep>` symlink chain for sub-path imports even under shamefully-hoist. See deviation log entry 14.
- Peer-dep warnings from `expo install` need actioning, not assumption. Missing peers must be installed as direct deps even if pnpm reports them resolved-via-hoist (Metro's resolver does not see the hoist chain the way pnpm does).
- Supabase JS on RN requires `import "react-native-url-polyfill/auto"` as the FIRST import in `apps/mobile/lib/supabase.ts`. Without it, signInWithPassword throws silently because RN's URL implementation is partial.
- Use protected route group layouts for auth in expo-router: `app/(auth)/_layout.tsx` redirects signed-in users to `/home`; `app/(app)/_layout.tsx` redirects signed-out users to `/sign-in`. Required for cold-launch + sign-out from any route.
- Dual-Tailwind reality: `apps/web` runs Tailwind v4; `apps/mobile` runs Tailwind v3.4 (NativeWind v4 requirement). Do not bump mobile past `tailwindcss@^3.4.x` until NativeWind v5 ships stable.
- TypeScript drift across surfaces: `~5.6` (web) vs `~5.9` (mobile). Each workspace has its own tsc. Tokens in `packages/design` are pure data and compile under both.

### Pre-push checklist (Mac terminal)

```bash
cd ~/code/1manbiz
pnpm --filter web build       # must be green
git status --short             # review what's staged
git add .                      # stage all (solo dev on main, OK)
git commit -m "feat(scope): subject"
git push                       # auto-deploys via Vercel
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

If the owner's request seems to violate one of these, say so and ask for an explicit Change Record.

---

## 7. Current Build State (as of 2026-05-31)

### Phase 1 — Foundations (web): ✅ DONE

Auth flow, onboarding wizard, dashboard shell, mobile bottom nav, settings page.

### Phase 2 — Core business loops (web): ✅ DONE

- 3B Products/Inventory CRUD with image upload.
- 3C Public catalogue at `/c/[slug]`.
- 3D Customers directory with WhatsApp deep-link chat.
- 3E.A Manual order capture with line items.
- 3E.B Order detail page, mark-paid + cancel actions, real dashboard cards.
- 3F Public receipt page at `/r/[code]` + share controls.

### Phase 3 — WhatsApp + AI: PARTIAL

- ✅ 3G.A: `channel_accounts` table (RLS-protected), `/api/webhooks/whatsapp` route, Conversations connect UI. Webhook verified by Meta. Gadget Locker connected to test number +1 555 669 8149.
- 🟡 3G.B: PENDING — write conversations + messages migration, service-role admin client, webhook parser writes to DB, Conversations list + thread view UI.
- ❌ 3G.C: PENDING — outbound reply form, send via Meta Graph API.
- ❌ 3H: PENDING — AI inbound parsing (Claude/OpenAI), proposes customer/order/reply for vendor approval.

### Phase 4 — Mobile (Apple-grade iOS first): MOB-1 DONE

- ✅ **MOB-1**: Expo SDK 54 + RN 0.81.5 + NativeWind v4 + Supabase JS bootstrap. Working email/password sign-in flow with SecureStore-backed session persistence (chunked adapter for JWTs over 2KB). Tokens from `@1manbiz/design` via NativeWind. Protected route groups `(auth)` and `(app)`. Verified end-to-end on physical iPhone via Expo Go: sign-in, sign-out, cold-launch resume, sign-out clears SecureStore. Vercel production deploy READY for the underlying infra changes (commits `16dfe32` + `e2f5575`).
- ❌ **MOB-2** (next): mobile dashboard home — revenue today, orders today, pending, active products tiles + recent orders list. Mobile equivalent of web's `dashboard/page.tsx`.
- ❌ **MOB-3**: bottom tab navigation — Home, Conversations, Orders, Inventory, Settings.
- 🟡 **DESIGN-1** (backlog): `packages/design/src/tokens.ts` lacks `colors.danger` / `colors.dangerSoft` (mobile uses `text-red-600` fallback for error text) and `colors.border` / `colors.borderStrong` (mobile reuses `textMuted` as input border, which is semantic abuse). Add tokens and replace fallbacks across web + mobile in one slice.
- 🟡 **SDK upgrade** (backlog): when Xcode + iOS Simulator are ready, upgrade Expo 54 —> 56 in a dedicated slice for perf wins. Currently blocked by Expo Go App Store version lag.

### Infrastructure

- ✅ INFRA-1: pnpm workspaces monorepo restructure (commit `af39855`). Web deploys via `apps/web` root directory on Vercel.

### Live data (Gadget Locker — owner's own business, used as the dogfood tenant)

- 1 business: Gadget Locker, slug `gadget-locker`, whatsapp `+234 907 007 5520`, catalogue active.
- 3 products: iPhone 17 Pro (₦2.1M, 10 in stock), iPhone 17 Air (₦1.3M, 20), Pixel 9 Pro (₦1.8M, 0).
- 1 customer: Adaeze Kalu (+234 801 234 5678).
- 1 order: Adaeze, 1× iPhone 17 Air, ₦1,300,000, status `paid`, receipt code `QMJT5DT3`.
- 1 channel_account: WhatsApp connected to test number, status `connected`.

### DB migrations applied (11 total)

0001 profiles, 0002 businesses, 0003 business_members + RLS helpers,
0004 products + product-images bucket, 0005 catalogue RPC + business-logos bucket,
0006 search_path hardening, 0007 customers, 0008 orders + order_items, 0009 order status trigger, 0010 receipt_code + public.get_public_receipt RPC, 0011 channel_accounts.

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

Use Supabase MCP. NEVER paste actual user data into chat output unless owner explicitly requests it.

---

## 9. Locked Decisions (do not change without Change Record)

- Brand colours: `#00D26A` primary (from `packages/design/src/tokens.ts` — tokens.ts is source of truth, this line documents). White, black. No purple, pink, em-dashes.
- Wordmark: "1Man" (black) + "." (green) + "Biz" (black).
- Currency display: `₦` symbol, comma separators, no decimals on whole-naira amounts (e.g. `₦1,300,000`).
- Table naming: snake_case singular for utility, snake_case plural for entities (`businesses`, `products`, `customers`, `orders`, `order_items`, `conversations`, `messages`, `channel_accounts`).
- Foreign keys: `<table>_id` (e.g. `business_id`, `customer_id`).
- Timestamps: every table has `created_at timestamptz default now()` and `updated_at timestamptz default now()` with a trigger to bump `updated_at` on row update.
- Phone numbers: stored as E.164 (e.g. `+2348012345678`) in column `phone_e164`.
- Receipt codes: 8-char alphanumeric uppercase, unique per business, generated by `public.generate_receipt_code()`.

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

01. `full_name` vs `first_name` schema assumption — fixed with `firstNameFrom` client helper in `apps/mobile/lib/profile.ts`.
02. Tailwind v4 incompatible with NativeWind v4 — pinned mobile `tailwindcss` to `^3.4.x`.
03. Loose `expo` wildcard pin — tightened to `~54.0.0` explicit.
04. Em-dash in user-facing copy violates Section 1 design rules — substituted middle dot in app copy.
05. SDK 56 unsupported by App Store Expo Go — downgraded to SDK 54.
06. Bogus `expo-status-bar` config plugin entry — removed from `app.json` plugins.
07. `@expo/metro-runtime` missing as direct dep — added via `pnpm exec expo install`.
08. First install pulled SDK 56 version of metro-runtime — re-aligned to `~6.1.2` via expo install.
09. pnpm isolated layout hides Expo runtime polyfills from Metro — initially tried `node-linker=hoisted` (later reverted, see entry 13).
10. Hoisting exposed React 19.1 / 19.2 dual install in web bundle — fixed with `pnpm.overrides`.
11. Supabase JS RN URL parsing silent failure — fixed with `import "react-native-url-polyfill/auto"` as first import.
12. Cold-launch sign-out left stale Stack history — fixed with protected route group layouts.

### Entries 13—14 (resolved during MOB-1 deploy recovery, commit `e2f5575`)

13. **`node-linker=hoisted` broke Vercel CI.** Locally hoisted worked for Expo. On Vercel, hoisted eliminates `apps/web/node_modules/next/` entirely, but the next-build bin shim hardcodes that path. Result: `MODULE_NOT_FOUND` at the `next build` step. Fix: replace `node-linker=hoisted` with `shamefully-hoist=true`. Keeps pnpm's isolated linker (apps/web/node_modules/next/ stays a proper symlink, Vercel happy) while flattening every transitive dep to the workspace root for Metro. Best of both worlds.
14. **Metro cannot resolve sub-path imports through pnpm symlinks even with shamefully-hoist.** Specifically, react-native-reanimated 4.x imports `semver/functions/satisfies`. Metro's nodeModulesPaths walker stops at the first node_modules with a matching package name and does not descend through pnpm's virtual-store symlinks for sub-path imports. Fix: add the leaf package (`semver`) as a direct dep of `apps/mobile`. Generalises to: when Metro chokes on a transitive sub-path import, pull the leaf package up as a direct dep rather than chasing public-hoist-pattern globs.

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

_Last updated: 2026-05-31, end of slice DOCS-1 (post-MOB-1 deploy recovery). Maintained by Claude (the chat instance) on owner request._
