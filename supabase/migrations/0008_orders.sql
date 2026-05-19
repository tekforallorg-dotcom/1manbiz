-- Migration 0008: Orders + Order Items
--
-- Phase 2 business operations core. Captures vendor orders against existing
-- customers and products. Status starts as pending; mark-paid and cancel
-- transitions ship in slice 3E.B.

create table if not exists public.orders (
  id                uuid primary key default gen_random_uuid(),
  business_id       uuid not null references public.businesses(id) on delete cascade,
  customer_id       uuid not null references public.customers(id) on delete restrict,
  source            text not null default 'manual'
                      check (source in ('manual','whatsapp','instagram','catalogue')),
  status            text not null default 'pending'
                      check (status in ('pending','paid','cancelled')),
  subtotal_kobo     bigint  not null default 0 check (subtotal_kobo >= 0),
  currency          text    not null default 'NGN',
  notes             text,
  paid_at           timestamptz,
  cancelled_at      timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create table if not exists public.order_items (
  id                    uuid primary key default gen_random_uuid(),
  order_id              uuid not null references public.orders(id) on delete cascade,
  product_id            uuid references public.products(id) on delete set null,
  name_snapshot         text   not null,
  price_kobo_snapshot   bigint not null check (price_kobo_snapshot >= 0),
  quantity              integer not null check (quantity > 0),
  line_total_kobo       bigint not null check (line_total_kobo >= 0),
  created_at            timestamptz not null default now()
);

create index if not exists orders_business_created_idx on public.orders (business_id, created_at desc);
create index if not exists orders_business_status_idx on public.orders (business_id, status);
create index if not exists orders_customer_idx on public.orders (customer_id, created_at desc);
create index if not exists order_items_order_idx on public.order_items (order_id);

drop trigger if exists set_updated_at on public.orders;
create trigger set_updated_at before update on public.orders
  for each row execute function public.tg_set_updated_at();

alter table public.orders enable row level security;

create policy "orders_select_by_member" on public.orders
  for select using (private.is_business_member(business_id));
create policy "orders_insert_by_owner" on public.orders
  for insert with check (private.is_business_owner(business_id));
create policy "orders_update_by_owner" on public.orders
  for update using (private.is_business_owner(business_id))
  with check (private.is_business_owner(business_id));
create policy "orders_delete_by_owner" on public.orders
  for delete using (private.is_business_owner(business_id));

alter table public.order_items enable row level security;

create policy "order_items_select_by_member" on public.order_items
  for select using (exists (
    select 1 from public.orders o
    where o.id = order_items.order_id and private.is_business_member(o.business_id)
  ));
create policy "order_items_insert_by_owner" on public.order_items
  for insert with check (exists (
    select 1 from public.orders o
    where o.id = order_items.order_id and private.is_business_owner(o.business_id)
  ));
create policy "order_items_update_by_owner" on public.order_items
  for update using (exists (
    select 1 from public.orders o
    where o.id = order_items.order_id and private.is_business_owner(o.business_id)
  )) with check (exists (
    select 1 from public.orders o
    where o.id = order_items.order_id and private.is_business_owner(o.business_id)
  ));
create policy "order_items_delete_by_owner" on public.order_items
  for delete using (exists (
    select 1 from public.orders o
    where o.id = order_items.order_id and private.is_business_owner(o.business_id)
  ));
