-- Migration 0007: Customers
--
-- Per-tenant customer directory. Phone required (WhatsApp-first product).
-- Uniqueness on (business_id, phone_e164) prevents duplicates per business.
-- total_orders and total_spent_kobo default to 0 and will be incremented by
-- the orders slice (3E). RLS: read for member, write for owner.

create table if not exists public.customers (
  id                  uuid primary key default gen_random_uuid(),
  business_id         uuid not null references public.businesses(id) on delete cascade,
  name                text not null,
  phone_e164          text not null,
  email               text,
  notes               text,
  last_purchase_at    timestamptz,
  total_orders        integer not null default 0 check (total_orders >= 0),
  total_spent_kobo    bigint  not null default 0 check (total_spent_kobo >= 0),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

comment on column public.customers.phone_e164 is 'E.164 digits, no plus prefix. Normalised by lib/whatsapp.normalizePhone before insert.';
comment on column public.customers.total_orders is 'Maintained by orders slice. Read-only from inventory and customer surfaces.';
comment on column public.customers.total_spent_kobo is 'Sum of fulfilled order totals in kobo. Maintained by orders slice.';

create unique index if not exists customers_business_phone_unique
  on public.customers (business_id, phone_e164);

create index if not exists customers_business_created_idx
  on public.customers (business_id, created_at desc);

create index if not exists customers_business_name_idx
  on public.customers (business_id, lower(name));

drop trigger if exists set_updated_at on public.customers;
create trigger set_updated_at
  before update on public.customers
  for each row execute function public.tg_set_updated_at();

alter table public.customers enable row level security;

drop policy if exists "customers_select_by_member" on public.customers;
create policy "customers_select_by_member" on public.customers
  for select using (private.is_business_member(business_id));

drop policy if exists "customers_insert_by_owner" on public.customers;
create policy "customers_insert_by_owner" on public.customers
  for insert with check (private.is_business_owner(business_id));

drop policy if exists "customers_update_by_owner" on public.customers;
create policy "customers_update_by_owner" on public.customers
  for update using (private.is_business_owner(business_id))
  with check (private.is_business_owner(business_id));

drop policy if exists "customers_delete_by_owner" on public.customers;
create policy "customers_delete_by_owner" on public.customers
  for delete using (private.is_business_owner(business_id));
