-- Bookings module, Slice B1: bookings table (DB foundation).
-- Time-slot appointments (starts_at required, ends_at nullable for all-day /
-- open-ended). Customer-linked like orders; optional product_id names the
-- service (title denormalized so it survives product changes/deletion).
-- Conflict/double-booking detection is a soft create-time check in a later
-- slice, NOT a DB constraint -- some vendors legitimately double-book.

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete restrict,
  product_id uuid references public.products(id) on delete set null,
  title text not null,
  starts_at timestamptz not null,
  ends_at timestamptz,
  status text not null default 'pending'
    check (status in ('pending','confirmed','cancelled','completed')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bookings_end_after_start check (ends_at is null or ends_at > starts_at)
);

create index bookings_business_starts_idx on public.bookings(business_id, starts_at);
create index bookings_customer_idx on public.bookings(customer_id);

alter table public.bookings enable row level security;

create policy bookings_select_by_owner on public.bookings
  for select using (private.is_business_owner(business_id));

create policy bookings_insert_by_owner on public.bookings
  for insert with check (private.is_business_owner(business_id));

create policy bookings_update_by_owner on public.bookings
  for update using (private.is_business_owner(business_id))
  with check (private.is_business_owner(business_id));

create trigger bookings_set_updated_at
  before update on public.bookings
  for each row execute function public.tg_set_updated_at();
