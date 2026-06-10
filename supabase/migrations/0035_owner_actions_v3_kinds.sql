-- 0035: owner-mode v3 - admin CRUD kinds on the propose -> YES rail.
-- Applied to prod via Supabase MCP; this file is for migration history only.
-- Settings (fulfillment, autopay, bizbot, catalogue, low stock) stay app-only.
alter table public.owner_actions drop constraint owner_actions_kind_check;
alter table public.owner_actions add constraint owner_actions_kind_check
  check (kind = any (array[
    'set_stock', 'set_price',
    'add_product', 'set_product_active',
    'mark_order_paid', 'cancel_order',
    'set_policy'
  ]::text[]));
