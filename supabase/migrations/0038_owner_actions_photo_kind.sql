-- Allow the set_product_photo owner action kind (photo swap for an existing
-- product, proposed from WhatsApp and confirmed with YES).
-- Applied to production via MCP on 2026-06-12; kept here for history.
alter table public.owner_actions drop constraint owner_actions_kind_check;
alter table public.owner_actions add constraint owner_actions_kind_check
  check (kind = any (array['set_stock'::text, 'set_price'::text, 'add_product'::text, 'set_product_active'::text, 'mark_order_paid'::text, 'cancel_order'::text, 'set_policy'::text, 'set_product_photo'::text]));
