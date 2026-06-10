-- 0036: owner-mode v3.1 - photo-add product drafting state.
-- Applied to prod via Supabase MCP; this file is for migration history only.
-- A 'drafting' owner_actions row accumulates a new product (image, name,
-- price, stock) across turns before it becomes a normal add_product proposal.
alter table public.owner_actions drop constraint owner_actions_status_check;
alter table public.owner_actions add constraint owner_actions_status_check
  check (status = any (array[
    'drafting', 'proposed', 'confirmed', 'cancelled', 'expired'
  ]::text[]));
