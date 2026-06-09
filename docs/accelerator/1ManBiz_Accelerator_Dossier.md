# 1Man.Biz — Accelerator Application Dossier

> A complete, structured profile of 1Man.Biz built for a top-tier accelerator application (Y Combinator and equivalents). It captures the company, the product, the functional requirements, the architecture, the market, and ready-to-paste answers to the standard application questions.
>
> Everything in Parts 1 to 5 is grounded in the shipped codebase (27 migrations, web + iOS, live BizBot AI). Numbers that need a primary source or a founder decision are tagged **[VERIFY]** or **[DECIDE]** so nothing invented is submitted as fact.
>
> Generated 2026-06-08. Single source of product truth: `CLAUDE.md`.

---

## Part 1 — Snapshot

| Field                | Value                                                                                                                                                                                            |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Company              | 1Man.Biz                                                                                                                                                                                         |
| One-liner (50 chars) | `AI staff that runs your WhatsApp business` (41)                                                                                                                                                 |
| What it is           | A WhatsApp-native, AI-run business operating system for African solo founders and micro-SMEs                                                                                                     |
| Founder              | Vitalis "Psalms" Mabia, Lagos, Nigeria (solo founder/engineer)                                                                                                                                   |
| Surfaces             | iOS app (primary), responsive web app (companion + admin + public storefront/receipts + API)                                                                                                     |
| Live product         | https://1manbiz.vercel.app                                                                                                                                                                       |
| Stage                | Working product, dogfooded on the founder's own retail business; pre-launch on third-party vendors **[VERIFY]**                                                                                  |
| Core wedge           | Turn the WhatsApp chat a vendor already sells in into a full back office with an AI employee that drafts orders and replies, then (with permission) closes the loop end to end including payment |
| AI engine            | Claude (Anthropic) `claude-haiku-4-5` with a four-step trust ladder: Off, Assisted, Semi, Autonomous                                                                                             |
| Backend              | Supabase (Postgres, Auth, Storage, Realtime), Vercel, Meta WhatsApp Cloud API, Paystack                                                                                                          |

**The 30-second pitch.** Across Africa, the majority of commerce runs through WhatsApp DMs. A vendor and their customer negotiate price, quantity, delivery, and payment entirely in chat. The vendor is the salesperson, the cashier, the bookkeeper, the dispatcher, and the support line, all at once, on their phone, all day. Orders get lost in the scroll, stock is tracked in their head, and there is no record when something goes wrong. 1Man.Biz reads that same WhatsApp conversation and acts as the missing staff: it drafts the order from the chat, checks it against real inventory and prices, books the pickup or delivery, sends a Paystack payment link, and issues a receipt, with the vendor approving each step until they trust it enough to let it run on its own.

---

## Part 2 — Company Profile

### 2.1 Mission

Give every one-person business in Africa the operational leverage of a full team, through an AI that works inside the channel they already sell on.

### 2.2 The problem (concrete, not abstract)

The target user is a solo or micro-business owner whose entire commercial surface is WhatsApp (and to a lesser extent Instagram and email). A typical day:

- 40 to 200 inbound chats, each a half-finished negotiation.
- Inventory tracked from memory or a paper book. Overselling and "sorry it's finished" are routine.
- No order record. When a customer disputes, there is nothing to point to.
- Payment is a screenshot of a bank transfer that the vendor manually reconciles.
- Pricing, delivery zones, and store policy re-typed by hand, 50 times a day.
- The owner cannot step away from the phone without the business stopping.

The status quo "tools" are a WhatsApp inbox, a notebook, a calculator, and the owner's memory. Generic SaaS (Shopify, QuickBooks, Square) assumes a card-present or web-checkout world that does not match how this commerce actually happens. The work is not "build me a website." The work is "answer this chat, take this order, take the money, and don't oversell."

### 2.3 The insight (what we understand that others miss)

1. **The channel is the product.** You do not move these vendors off WhatsApp. You put the back office inside the conversation. Every competitor that builds a separate dashboard loses, because the vendor lives in chat.
2. **The unit of work is a message, not a checkout.** The atomic action is "turn this chat into a confirmed, paid order." We instrument exactly that.
3. **Trust in AI must be earned in steps, not assumed.** Vendors will not hand a stranger's AI their customer relationships and their money on day one. So autonomy is a ladder (Off -> Assisted -> Semi -> Autonomous), and every AI decision is logged with the human's verdict, building the evidence that the AI is safe to promote.
4. **Money never goes through the model.** The AI proposes product IDs and quantities; the server resolves every price from the catalogue. The LLM literally never sees or computes naira. This is both a safety property and a trust story.

### 2.4 Who it is for (personas)

Drawn from the product's persona set (Aisha, Chinedu, Ngozi, Sola). Archetypes:

- **The gadget/retail reseller** (the dogfood tenant, "Gadget Locker"): high-value SKUs, stock-out risk, needs fast order capture and receipts.
- **The fashion/lifestyle vendor**: many variants, image-heavy catalogue, Instagram + WhatsApp.
- **The services/appointments seller** (salon, tutor, repair): needs bookings, not just orders.
- **The food/FMCG micro-vendor**: high message volume, delivery-zone pricing, repeat customers.

All four share one shape: one person, WhatsApp-first, no back office, no time.

### 2.5 Design ethos

Apple-grade refined minimalism. Green (`#00D26A`), white, black. International professional standard. The bar is explicitly "an amateur-looking interface is unacceptable," because the product is competing for the trust of someone who is about to route their livelihood through it.

---

## Part 3 — Product

### 3.1 The core loop

```
Customer messages on WhatsApp
        |
        v
1Man.Biz ingests the message (webhook, idempotent, RLS-scoped)
        |
        v
BizBot reads the thread + live catalogue + policies + delivery zones
        |
        v
 Drafts a reply  AND/OR  drafts an order (product IDs + quantities only)
        |
        v
Vendor approves / edits / rejects   <-- trust ladder gates how much is automatic
        |
        v
Order confirmed -> fulfillment fork (delivery zone fee OR pickup time/booking)
        |
        v
Paystack payment link sent -> webhook confirms payment (HMAC verified)
        |
        v
Stock decremented, receipt generated + auto-sent, customer + analytics updated
```

Every arrow above is shipped code, not a roadmap item.

### 3.2 Surfaces

- **iOS app (Expo, primary surface).** 10-tab operator console: Home, Chats, Orders, Bookings, Inventory, Customers, Receipts, Insights, BizBot, Settings. Realtime chat, optimistic order capture, pull-to-refresh everywhere, native confirm sheets.
- **Web app (Next.js App Router).** Same database, same business logic. Doubles as the admin console, the API host (webhooks, AI endpoints, the single outbound-message endpoint), and the **public surface**: every business gets a public catalogue at `/c/[slug]` and every paid order a public receipt at `/r/[code]`.
- **Public storefront + receipt.** Anonymous, RPC-backed, shareable links. The catalogue is the vendor's "website" without the vendor ever building one.

### 3.3 BizBot, the AI staff (the differentiator)

**Model.** Anthropic Claude `claude-haiku-4-5`, server-side only. Two specialized jobs: parse an order from a chat, and draft a customer reply. Both are grounded: the model is handed the live catalogue, the business's policy knowledge base, delivery zones, tone, and language, and is instructed to answer only from those blocks and never invent a product, price, or fact.

**The four-mode trust ladder** (stored on the business as `ai_mode`):

| Mode           | Behaviour                                                                                                                                                                                                                                    |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Off**        | BizBot is silent. The vendor replies manually.                                                                                                                                                                                               |
| **Assisted**   | BizBot drafts every reply and every order; the vendor approves, edits, or rejects each one.                                                                                                                                                  |
| **Semi**       | BizBot auto-sends routine, high-confidence replies; escalates the rest to the vendor.                                                                                                                                                        |
| **Autonomous** | BizBot runs the conversation end to end when three gates all hold: mode is autonomous, the message is inside the 24h service window, and model confidence is high. Low-confidence turns fall back to a safe clarifier, never a money action. |

**Money safety (a real moat, not a slogan).** The order parser sends the model only product `id` and `name`, never prices. The server re-resolves every price and computes every total from the catalogue. Hallucinated IDs are discarded; quantities are clamped. The LLM never sets, sees, or sums money.

**End-to-end fulfillment automation.** On order confirmation, BizBot forks on the business's fulfillment mode:

- Delivery-only: asks for the delivery area, validates it against configured zones, computes the fee.
- Pickup-only: asks for a pickup time (creating a booking) and surfaces the store address.
- Both: asks the customer to choose, then branches.
- It rejects impossible requests ("we offer pickup only, not delivery") based on the vendor's configured mode, then sets the payment method and, if autopay is enabled, sends a Paystack link.

**The evidence loop (the path to trust-at-scale).** Every AI decision is written to an `ai_decisions` table with the proposal, the mode, the confidence, and the eventual human verdict (`accepted` / `edited` / `rejected` / `auto_sent`). This is the dataset that proves, per business, that the AI is safe to promote up the ladder. It is also the foundation for future fine-tuning and for showing a vendor "BizBot has been right 94 of the last 100 times."

**Self-loop prevention.** AI-authored messages (`sender_role = 'ai'`) are excluded from the model's future input so it never trains on its own outputs mid-conversation.

### 3.4 What is shipped vs. in progress

- **Shipped:** WhatsApp two-way live messaging (web + iOS, realtime), inventory CRUD with images, public catalogue, customer directory/CRM, manual + AI order capture, order lifecycle with stock triggers, receipts (public + auto-send), bookings module, BizBot in all four modes, AI order parsing, AI reply drafting, autonomous auto-reply, fulfillment fork (delivery/pickup), Paystack init + HMAC-verified payment webhook, decision logging, insights/analytics on iOS.
- **In progress / next:** the `payments` table parity migration and `delivery_zones` table (both referenced by RPCs and code, formalization pending), Instagram and email channels, semi-autonomous promotion using the evidence log, team roles UI (the schema already supports owner/admin/staff).

---

## Part 4 — Functional Requirements

Status legend: ✅ Shipped · 🟡 Partial · 🔜 Planned.
IDs are stable handles for the spec.

### FR-A Authentication & Onboarding

- **FR-A1** ✅ Email + password sign-up with name and 8+ char password; email confirmation before access.
- **FR-A2** ✅ Sign-in routes the user to dashboard or onboarding based on completion state.
- **FR-A3** ✅ Onboarding wizard captures business name, category, channels, AI tone/language; creates the business, owner membership, and marks the profile onboarded.
- **FR-A4** 🔜 Password recovery (UI stubbed, not wired).

### FR-B Business Profile & Settings

- **FR-B1** ✅ Edit business name, tagline, URL slug, WhatsApp number, logo.
- **FR-B2** ✅ Catalogue pause toggle (`catalogue_active`).
- **FR-B3** ✅ Fulfillment mode selector: delivery / pickup / both, with store address required when pickup is enabled.
- **FR-B4** ✅ BizBot mode selector: off / assisted / semi / autonomous, with mode-specific help text.
- **FR-B5** ✅ AI tone (friendly/formal/playful) and language.
- **FR-B6** ✅ Autopay toggle (`ai_sends_payment_link`), available only in autonomous mode.
- **FR-B7** ✅ Slug validation (lowercase, URL-safe, unique) and phone normalization to E.164 on save.

### FR-C Inventory & Catalogue (private)

- **FR-C1** ✅ Create product: name, SKU, description, price (entered in naira, stored in kobo), stock quantity, image.
- **FR-C2** ✅ List products with price, stock, status, created date.
- **FR-C3** ✅ Edit product including status (active/archived).
- **FR-C4** ✅ Product images via Supabase Storage (`product-images`, 2 MB, jpeg/png/webp), owner-scoped.
- **FR-C5** ✅ Stock auto-decrements on payment and auto-restocks on cancellation (DB trigger, idempotent, floored at 0).

### FR-D Public Catalogue (anonymous)

- **FR-D1** ✅ Public storefront at `/c/[slug]` via `get_public_catalogue` RPC: business identity + active products with images, prices, stock status.
- **FR-D2** ✅ Paused catalogue shows a clean "currently unavailable" state.

### FR-E Customers (CRM)

- **FR-E1** ✅ Create customer: name, phone (E.164, unique per business), email, notes.
- **FR-E2** ✅ Directory with total orders, total spent, last purchase, sortable (recent/spend/orders on iOS).
- **FR-E3** ✅ Customer rollups (`total_orders`, `total_spent_kobo`) maintained by DB triggers on paid/cancel transitions.
- **FR-E4** ✅ Auto-create customer from an inbound WhatsApp number (webhook) and from an AI order proposal.
- **FR-E5** ✅ Export customers as text (iOS Share).

### FR-F Orders & Fulfillment

- **FR-F1** ✅ Manual order capture: pick customer, add line items (product + qty), notes; prices re-resolved server-side.
- **FR-F2** ✅ AI order capture from a conversation proposal (`source = 'whatsapp_ai'`), linking the conversation and auto-creating the customer if needed.
- **FR-F3** ✅ Order lifecycle: pending -> paid -> cancelled, with `confirmed_at`, `paid_at`, `cancelled_at` markers.
- **FR-F4** ✅ Line-item price snapshots (`name_snapshot`, `price_kobo_snapshot`) so historical orders survive catalogue edits/deletes.
- **FR-F5** ✅ Fulfillment fields: type (delivery/pickup), delivery address + fee, payment method (online/on_delivery/at_store), pickup time.
- **FR-F6** ✅ Mark-paid and cancel from web and iOS (dual-auth API twins).
- **FR-F7** ✅ Pickup orders can spawn a linked booking (`bookings.order_id`, `orders.pickup_at`).
- **FR-F8** 🟡 `delivery_zones` referenced by code; table formalization pending.

### FR-G Payments

- **FR-G1** ✅ Initialize Paystack checkout for a pending order (dual-auth `/api/payments/init`), money derived server-side only.
- **FR-G2** ✅ Send the payment link to the customer on WhatsApp automatically when a conversation exists, else return it for manual share.
- **FR-G3** ✅ Server-to-server payment confirmation webhook with HMAC-SHA512 verification, idempotent by reference, amount-match guard (mismatch marks failed and leaves the order pending, logged loudly).
- **FR-G4** ✅ Public payment status page `/pay/[reference]` via `get_payment_status` RPC.
- **FR-G5** 🟡 `payments` table parity migration (referenced by RPC, to be formalized in repo).

### FR-H Receipts

- **FR-H1** ✅ 8-char unique receipt code auto-generated on first paid transition.
- **FR-H2** ✅ Public receipt at `/r/[code]` via `get_public_receipt` RPC (business, customer, items, totals, paid time).
- **FR-H3** ✅ Auto-send receipt to the customer on WhatsApp on payment (idempotent via `receipt_sent_at`), plus manual resend.

### FR-I Messaging (WhatsApp inbox)

- **FR-I1** ✅ Connect a WhatsApp channel: verify phone number ID + access token against Meta before saving; temporary vs permanent token handling.
- **FR-I2** ✅ Inbound webhook: HMAC-SHA256 verify, E.164 normalize, upsert customer + conversation, idempotent message insert keyed on `meta_message_id`, unread bump, media-type awareness.
- **FR-I3** ✅ Single outbound endpoint `/api/messages/send` (cookie auth for web, Bearer for mobile) as the only send path; message keyed on the returned wamid.
- **FR-I4** ✅ Inbox + thread on web and iOS, live via Supabase Realtime (RLS-scoped `postgres_changes`), with server-render + focus-refetch fallback.
- **FR-I5** ✅ Unread counts; mark-read on open. Typing indicator (realtime broadcast).
- **FR-I6** ✅ Delivery/read status stamped back onto messages from Meta status callbacks.

### FR-J AI / BizBot

- **FR-J1** ✅ Order parser: role-labelled transcript (last 40 msgs) + catalogue (IDs + names only, no prices) -> structured proposal (product IDs, quantities, confidence). Server resolves prices; IDs validated; quantities clamped.
- **FR-J2** ✅ Reply drafter: two-step decide-then-write prompt grounded in catalogue (server-formatted prices), delivery zones, knowledge base, tone, language; returns reply + confidence + optional order/booking actions.
- **FR-J3** ✅ Autonomous auto-reply gated on (mode = autonomous) AND (24h window) AND (high confidence); low confidence yields a safe clarifier, never a money action.
- **FR-J4** ✅ End-to-end order automation: confirm, set fulfillment, validate delivery area/fee, set pickup time, set payment method, send Paystack link (autopay).
- **FR-J5** ✅ Decision audit log (`ai_decisions`): proposal, mode, confidence, human verdict, resulting order.
- **FR-J6** ✅ Human-verdict endpoint (`/api/ai/decision-outcome`), idempotent, feeding the trust-promotion evidence base.
- **FR-J7** ✅ BizBot knowledge base (FAQ/policy items) and delivery-zone config, editable on web and iOS.
- **FR-J8** ✅ AI messages tagged `sender_role = 'ai'`, excluded from future model input.

### FR-K Bookings

- **FR-K1** ✅ Create booking: customer, title, optional product/service, start (required) and end time, notes.
- **FR-K2** ✅ Soft double-booking detection (warns, never blocks, because some vendors legitimately overlap).
- **FR-K3** ✅ Lifecycle: pending -> confirmed -> completed | cancelled, with terminal-state edit guards.
- **FR-K4** ✅ Upcoming-bookings list on web and iOS.

### FR-L Insights & Analytics

- **FR-L1** ✅ Dashboard KPIs: today's revenue, orders, pending, active products, customers (web + iOS home).
- **FR-L2** ✅ iOS Insights tab: revenue, average order value, paid count, outstanding balance, sparkline, top products, range filter (7d/30d/90d/all).

### FR-M Mobile App (iOS-first)

- **FR-M1** ✅ Email/password auth with chunked SecureStore session, protected route groups.
- **FR-M2** ✅ Full operator parity: chats, orders, bookings, inventory, customers, receipts, insights, BizBot, settings.
- **FR-M3** ✅ Realtime chat, optimistic sends with rollback, keyboard-aware safe-area composer, native confirm sheets.

### FR-N Platform / Non-Functional

- **FR-N1** ✅ RLS on every user-data table; `is_business_member` / `is_business_owner` helpers in a `private` schema to avoid recursion.
- **FR-N2** ✅ Service-role admin client used only on webhook ingest + verified outbound paths, after explicit ownership checks; never client-exposed.
- **FR-N3** ✅ Idempotency boundaries: `meta_message_id` unique, Paystack reference lookup, `receipt_sent_at` guard.
- **FR-N4** ✅ Money in kobo (integer) end to end; divide by 100 only at the format boundary; narrow no-break space in the currency formatter.
- **FR-N5** ✅ Phone numbers normalized to E.164 on both surfaces.
- **FR-N6** ✅ Secrets (Meta token) live only in the DB or Vercel env, never in code or chat.
- **FR-N7** ✅ Auto-deploy on push to main via Vercel; type-check + lint pre-push gate for both apps.

---

## Part 5 — Technical Architecture

### 5.1 Stack

- **Frontend (web):** Next.js App Router, React 19, Tailwind v4, shadcn/ui. Server components by default; server actions for mutations.
- **Frontend (mobile):** Expo SDK 54, React Native 0.81, expo-router, NativeWind v4. Shares design tokens with web from `packages/design`.
- **Backend:** Supabase (Postgres + Auth + Storage + Realtime). Service-role client for webhook/outbound paths only.
- **AI:** Anthropic Claude `claude-haiku-4-5`, server-side, grounded prompts, structured outputs.
- **Integrations:** Meta WhatsApp Cloud API (Graph v22), Paystack (checkout + webhooks).
- **Infra:** pnpm workspaces monorepo, GitHub, Vercel (auto-deploy on push to main).

### 5.2 Data model (13 tables, 27 migrations)

`profiles` (1:1 with auth users) -> `businesses` (tenant root) -> {`business_members` (roles), `products`, `customers`, `orders` -> `order_items`, `conversations` -> `messages`, `channel_accounts`, `bookings`, `ai_decisions`, `knowledge_items`}.

Conventions enforced in SQL: money in **kobo** (bigint), phone in **E.164**, `created_at`/`updated_at` on every table with a bump trigger, snake_case plural entities, `<table>_id` foreign keys, 8-char receipt codes.

Key automated behaviours live in the database, not the app, so they hold regardless of which surface writes:

- Order status trigger: on paid, set `paid_at` + receipt code, roll up customer totals, decrement stock; on cancel-after-paid, reverse all of it.
- New-user trigger auto-creates a profile.
- Slug auto-generation and uniqueness.

### 5.3 Security posture

- RLS on every user-data table, backed by `private` helper functions to prevent policy recursion.
- Webhooks verify HMAC signatures (SHA-256 for Meta, SHA-512 for Paystack) before trusting a payload.
- The AI never receives or computes money; the server is the only price authority.
- Idempotency on every externally retried path.
- Defense in depth: every mutation resolves `business_id` from the authenticated user before scoping the write, on top of RLS.

### 5.4 Why this architecture is a moat

Most "WhatsApp + AI" attempts are a thin chatbot bolted onto a spreadsheet. The depth here, an RLS-correct multi-tenant Postgres, a price-safe AI boundary, a decision-audit evidence loop, realtime on two native surfaces, idempotent payment and messaging, is months of careful engineering that a fast follower cannot copy in a weekend. The hard part was never the chatbot. It was making the chatbot safe to trust with money and inventory.

---

## Part 6 — Market & Business Model

### 6.1 Market size (figures to confirm with primary sources)

- **Nigeria MSMEs:** roughly 39 to 40 million micro/small enterprises (SMEDAN/NBS national survey). **[VERIFY]**
- **WhatsApp penetration:** Nigeria is among WhatsApp's largest markets; a large majority of connected Nigerians use it daily, and informal commerce runs heavily through it. **[VERIFY]**
- **Africa-wide:** hundreds of millions of micro and informal traders across Nigeria, Kenya, Ghana, South Africa (the same normalization set the product already supports: NG/KE/ZA/GH). **[VERIFY with GSMA/World Bank]**

**Bottom-up sizing (the credible version for YC):**

- SOM (beachhead): WhatsApp-first Nigerian vendors doing structured product/service sales who would pay a monthly tool fee. Even 1% of 40M is 400,000 businesses.
- At a blended ₦X/month subscription plus an optional payment take-rate, capture of low single-digit percentages of that beachhead is a multi-billion-naira ARR business before expanding channel (Instagram, email) or geography.
- The expansion path is classic: land on order capture, expand to payments take-rate, then financial services (the `ai_decisions` + order history is an underwriting dataset over time).

### 6.2 Business model **[DECIDE — align with the live pricing page]**

Proposed, to confirm against the existing landing-page pricing:

1. **Subscription** (primary): tiered monthly SaaS in naira. Free/trial tier to get the vendor's data in, paid tiers unlock BizBot autonomy, multi-channel, and team seats.
2. **Payments take-rate** (secondary, high-leverage): a thin margin on Paystack-processed volume, since the product already sits on the payment rail.
3. **Future financial services**: working-capital advances underwritten on observed order history (long-term, not a launch claim).

The strategic reason subscription leads: it aligns with "AI staff you hire for a monthly salary," which is exactly the mental model the product sells.

### 6.3 Go-to-market

- **Dogfood first** (already happening): the founder runs a real gadget business on it ("Gadget Locker"), which is both proof and the fastest feedback loop.
- **Vendor-led, WhatsApp-native acquisition:** every public catalogue (`/c/[slug]`) and receipt (`/r/[code]`) a vendor shares carries the brand to their customers and to other vendors. The product is its own distribution.
- **Community + micro-influencer seeding** in Lagos vendor networks (the densest concentration of the target user).
- **The aha is fast:** connect WhatsApp, watch BizBot draft a real order from a real chat in minutes. Time-to-value is a single conversation.

---

## Part 7 — Competition & Moat

### 7.1 Landscape

- **Generic commerce SaaS** (Shopify, Square, QuickBooks): built for card-present or web-checkout markets. They do not live in WhatsApp, do not speak naira-first, and assume an operator with time.
- **WhatsApp Business + spreadsheets** (the real incumbent): free, universal, and exactly what we displace. Our job is to be so obviously better at "turn this chat into a paid order" that the notebook looks reckless.
- **Local order-management and storefront tools** (regional players): closer, but typically a separate dashboard the vendor has to leave WhatsApp to use, and without a price-safe autonomous AI layer.
- **Horizontal AI chatbots:** can answer messages, but do not own inventory, payments, receipts, and fulfillment as transactional state. A chatbot that cannot safely decrement stock or take money is a toy here.

### 7.2 What we understand that they do not

1. You win by going _into_ WhatsApp, not by pulling vendors out of it.
2. The product is not a chatbot; it is an operating system whose interface happens to be chat.
3. AI autonomy has to be _earned per vendor_ with an auditable track record, which is why the trust ladder and `ai_decisions` log exist from day one.
4. The defensible asset accrues quietly: a per-business dataset of decisions, outcomes, orders, and payments that improves the AI and, eventually, underwrites credit.

### 7.3 Why now (timing)

- Meta opened the WhatsApp Cloud API to programmatic two-way messaging at low cost.
- LLMs crossed the price/quality line where a grounded `claude-haiku` call per message is economically trivial relative to the order value it captures.
- African digital payments (Paystack, OPay, Moniepoint) matured into programmable rails.
- Three rails that did not exist together five years ago now do. The window to be the default operating layer on top of them is open.

---

## Part 8 — Traction & Roadmap

### 8.1 Current state (be honest, YC rewards it)

- **Product:** a genuinely working, multi-surface system (iOS + web), not a prototype. The hard infrastructure (realtime, payments, AI safety, multi-tenant security) is built and verified end to end on real devices and a real Meta number.
- **Usage:** dogfooded on the founder's own live business; one active connected WhatsApp number, real inbound/outbound delivered to a real customer device. Third-party paying vendors: **[VERIFY — state the real number, even if it is zero or a handful]**.
- **Revenue:** **[VERIFY — state precisely; pre-revenue is a fine answer at this stage]**.
- **Team:** solo founder/engineer, full-time status **[VERIFY]**.

### 8.2 Near-term roadmap (next 1 to 3 months)

1. Formalize the `payments` and `delivery_zones` tables in-repo (close the parity gap with the RPCs).
2. Onboard the first cohort of third-party vendors off the dogfood base; instrument activation (time-to-first-AI-order).
3. Turn on **Semi** mode using the `ai_decisions` evidence to auto-promote high-accuracy conversation types.
4. Ship product detail/edit and WhatsApp-connect natively on iOS (remove the last web bounce).
5. Instagram channel (the schema already anticipates it).

### 8.3 Milestones already cleared

Phase 1 (foundations) and Phase 2 (core business loops) done. Phase 3 (WhatsApp two-way live + AI) done through autonomous replies and end-to-end fulfillment. Phase 4 (iOS app) shipped to 10 functional tabs. 27 migrations applied with repo parity.

---

## Part 9 — The Application (ready-to-paste answers)

> Written in the founder's voice with real facts. Fill every **[VERIFY]/[DECIDE]** before submitting. Keep answers tight; YC rewards clarity over polish.

**Company name.** 1Man.Biz

**Describe what your company does in 50 characters or less.**
`AI staff that runs your WhatsApp business` (41 chars)

**Company URL.** https://1manbiz.vercel.app

**What is your company going to make?**
1Man.Biz is a WhatsApp-native business operating system for Africa's solo and micro businesses. Most commerce here happens inside WhatsApp chats: the vendor negotiates the order, takes payment by bank-transfer screenshot, and tracks stock in their head. We put an AI employee inside that conversation. BizBot reads the chat, drafts the order against real inventory and prices, books the pickup or delivery, sends a Paystack payment link, and issues a receipt. The vendor approves each step at first, then promotes the AI up a trust ladder (Assisted, Semi, Autonomous) as it proves itself. It runs on iOS and web off one backend. The product is live and I run my own retail business on it.

**Why did you pick this idea? Do you have domain expertise?**
I am the user. I run a gadget retail business in Lagos that sells through WhatsApp, and I built 1Man.Biz to solve my own daily pain: orders lost in the scroll, overselling stock I had already sold, no record when a customer disputed, and never being able to step away from my phone. I am a Staff-level engineer, so I could build the hard parts (multi-tenant security, payment webhooks, a price-safe AI boundary) properly rather than as a demo. I know people need this because I needed it, and because every vendor I know runs their business the exact same chaotic way. **[VERIFY: add the number of other vendors you have shown it to and what they said.]**

**How far along are you?**
Working product, not a prototype. Live on iOS and web off a shared Supabase backend: 27 database migrations, RLS-correct multi-tenancy, realtime WhatsApp inbox on both surfaces, AI order parsing and reply drafting, autonomous end-to-end fulfillment (delivery zones and pickup bookings), Paystack checkout with HMAC-verified payment confirmation, auto-generated public receipts and catalogues. Verified end to end on a real Meta WhatsApp number and a real customer device. I dogfood it on my own business daily. **[VERIFY: third-party vendor count and revenue.]**

**How long have you been working on this, full or part time?**
**[VERIFY: e.g., "X months, full-time since <date>."]**

**Are people using your product? How many? Revenue?**
**[VERIFY: state the real numbers. Pre-launch with one dogfood tenant is an honest and fine answer. If you have a waitlist or pilot vendors, say so with the count.]**

**What's new about what you're making? What substitutes do people resort to?**
The substitute is WhatsApp plus a notebook plus the owner's memory. Generic tools (Shopify, QuickBooks, Square) assume a web-checkout, card-present world that does not match how this commerce works. What is new: we do not move the vendor off WhatsApp, we put the back office inside the chat, and we make the AI safe to trust with money. The AI never sees or computes a single naira; it only proposes product IDs and quantities, and the server resolves every price. And autonomy is earned: every AI decision is logged with the human's verdict, so we can prove per vendor that BizBot is safe before it runs unattended.

**Who are your competitors? Who do you fear most?**
The real incumbent is "WhatsApp Business plus a spreadsheet," which is free and universal. Among software: generic commerce SaaS that does not live in WhatsApp, and regional order-management tools that make the vendor leave the chat for a separate dashboard. Horizontal AI chatbots can answer messages but do not own inventory, payments, and fulfillment as real transactional state. I fear most a well-funded local payments player (the Paystack/OPay/Moniepoint tier) deciding to build up into operations, because they already have the rail and the vendor relationship. My edge is depth and focus on the operating layer, and a head start on the trust-and-evidence problem.

**How will you make money? How much could you make?**
Monthly subscription in naira (the "hire an AI staffer for a salary" model), plus a thin take-rate on payments processed through the product, with working-capital lending on observed order history as a long-term layer. Nigeria alone has on the order of 40 million MSMEs **[VERIFY]**; the WhatsApp-first sellable beachhead is in the hundreds of thousands. Low single-digit-percent capture of that beachhead at a modest monthly fee is a multi-billion-naira ARR business before adding payment margin, new channels (Instagram, email), or new countries (the product already normalizes NG/KE/ZA/GH numbers). **[DECIDE: align exact pricing with the live landing page.]**

**How will you get users?**
The product is its own distribution: every public catalogue and receipt a vendor shares carries 1Man.Biz to their customers and to neighbouring vendors. On top of that, community and micro-influencer seeding inside Lagos vendor networks, where the target user is densest, and a near-instant aha (connect WhatsApp, watch BizBot draft a real order in minutes). I am also customer zero, so my own store is a live reference.

**Why this idea now?**
Three rails only recently lined up: Meta's WhatsApp Cloud API made programmatic two-way chat cheap, LLMs crossed the price/quality line where a grounded model call per message is economically trivial against the order it captures, and African digital payments matured into programmable APIs. None of this was possible together five years ago. The window to become the default operating layer on top of WhatsApp commerce in Africa is open now.

**Where will the company be based?**
Lagos, Nigeria (and the YC batch location for the program). **[VERIFY]**

**Founder video / product demo notes.** **[DECIDE]** Best demo: send a real WhatsApp message to the connected number, show BizBot draft the order against live stock, approve it, fire the Paystack link, pay, and watch the receipt auto-send and stock decrement, all in one take on a phone.

---

## Part 10 — Risk Register & Pre-Submit Checklist

### 10.1 Honest risks (name them before YC does)

- **Single founder.** Mitigation narrative: you are technical and shipped a deep product solo; be ready to talk about hiring and why solo so far.
- **Meta/WhatsApp platform dependency.** Mitigation: schema and channel abstraction already anticipate Instagram/email; not locked to one provider.
- **AI trust and liability with money.** Mitigation: this is the product's central design (money never touches the model, trust ladder, decision log). Lead with it; it is a strength.
- **Monetization unproven.** Mitigation: be honest about stage; show the fast aha and the dogfood proof.
- **Competition from payment incumbents.** Mitigation: focus and depth on the operating layer, plus the evidence-loop head start.

### 10.2 Before you submit, confirm/decide

- [ ] **[VERIFY]** Exact third-party user count and revenue (do not round up).
- [ ] **[VERIFY]** Full-time/part-time and months worked.
- [ ] **[DECIDE]** Pricing, aligned to the live landing page.
- [ ] **[VERIFY]** Market statistics against primary sources (NBS/SMEDAN, GSMA, World Bank, Statista) and cite them.
- [ ] **[DECIDE]** The one-take demo video script (Part 9).
- [ ] **[VERIFY]** Formalize `payments` and `delivery_zones` migrations so a fresh clone is fully consistent if a reviewer inspects the repo.
- [ ] Confirm the public repo contains no secrets and the live demo tenant looks pristine.

---

## Appendix A — Feature inventory at a glance

| Module                                 | Web        | iOS   | AI-driven         |
| -------------------------------------- | ---------- | ----- | ----------------- |
| Auth + onboarding                      | ✅         | ✅    | —                 |
| Dashboard KPIs                         | ✅         | ✅    | —                 |
| Inventory CRUD + images                | ✅         | ✅    | reads catalogue   |
| Public catalogue `/c/[slug]`           | ✅         | (web) | —                 |
| Customers / CRM                        | ✅         | ✅    | auto-create       |
| Orders (manual)                        | ✅         | ✅    | —                 |
| Orders (AI-drafted)                    | ✅         | ✅    | ✅                |
| Order lifecycle + stock triggers       | ✅         | ✅    | —                 |
| Bookings                               | ✅         | ✅    | ✅ (create/edit)  |
| Payments (Paystack)                    | ✅         | ✅    | ✅ (autopay link) |
| Receipts (public + auto-send)          | ✅         | ✅    | ✅ (auto-send)    |
| WhatsApp inbox (realtime)              | ✅         | ✅    | ✅                |
| BizBot config (knowledge, zones, mode) | ✅         | ✅    | ✅                |
| Reply drafting / autonomous            | ✅         | ✅    | ✅                |
| Insights / analytics                   | (web KPIs) | ✅    | —                 |
| Settings (fulfillment, autopay, tone)  | ✅         | ✅    | configures AI     |

## Appendix B — The trust ladder (BizBot autonomy)

```
OFF         vendor does everything; BizBot silent
 |
ASSISTED    BizBot drafts every reply + order; vendor approves/edits/rejects
 |          (every decision logged with the human verdict)
SEMI        BizBot auto-sends high-confidence routine replies; escalates the rest
 |
AUTONOMOUS  BizBot runs the conversation end to end when ALL hold:
            mode = autonomous  AND  inside 24h window  AND  confidence = high
            (low confidence -> safe clarifier, never a money action)
```

Promotion up the ladder is meant to be earned on the evidence in `ai_decisions`, per business. That is the durable asset.
