-- 0025_ai_sends_payment_link.sql
-- Per-business gate for the autonomous AI sending a Paystack checkout link on
-- order confirmation. Default false: money-moving stays opt-in, and flipping
-- this off is the kill switch. Additive and idempotent.

alter table public.businesses
  add column if not exists ai_sends_payment_link boolean not null default false;

comment on column public.businesses.ai_sends_payment_link is
  'When true, the autonomous AI sends a Paystack checkout link in its order-confirmation reply. Amount is always server-derived from the order; default false.';
