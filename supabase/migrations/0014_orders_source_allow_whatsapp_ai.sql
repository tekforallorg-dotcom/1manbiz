-- 3H.2: allow AI-drafted orders to record provenance (source='whatsapp_ai').
-- Applied to prod via MCP on 2026-06-01; file added for repo parity so a fresh
-- `supabase db reset` reproduces the live constraint.
alter table public.orders drop constraint orders_source_check;
alter table public.orders add constraint orders_source_check
  check (source = any (array['manual','whatsapp','instagram','catalogue','whatsapp_ai']));
