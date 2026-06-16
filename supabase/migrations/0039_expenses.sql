-- Money pillar, Slice M1: expenses table (DB foundation).
-- The outflow half of the ledger. Income already lives in orders (paid); this
-- is the only missing piece to compute profit (income minus expenses). Built
-- tax-ready from day one so the later Tax summary is a pure read-and-group over
-- this table, never a migration: category groups the lines and occurred_at
-- carries the real spend date (not the row-created timestamp), so monthly and
-- annual rollups are correct. Amounts are kobo (bigint), matching
-- payments.amount_kobo. Single currency (NGN) for MVP; a currency column is an
-- additive follow-on if the business ever goes multi-currency.
--
-- RLS mirrors the bookings pattern (private.is_business_owner). One deliberate
-- deviation from bookings: bookings has no delete policy (it cancels via
-- status), but an expense is a plain ledger line a vendor must be able to
-- remove when fat-fingered, so expenses_delete_by_owner is included. Hard
-- delete for MVP; if audit-grade soft-delete is wanted later, swap to a
-- voided_at column (additive, no rewrite).

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  amount_kobo bigint not null check (amount_kobo > 0),
  category text not null default 'other',
  occurred_at date not null default current_date,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index expenses_business_occurred_idx
  on public.expenses(business_id, occurred_at desc);

alter table public.expenses enable row level security;

create policy expenses_select_by_owner on public.expenses
  for select using (private.is_business_owner(business_id));

create policy expenses_insert_by_owner on public.expenses
  for insert with check (private.is_business_owner(business_id));

create policy expenses_update_by_owner on public.expenses
  for update using (private.is_business_owner(business_id))
  with check (private.is_business_owner(business_id));

create policy expenses_delete_by_owner on public.expenses
  for delete using (private.is_business_owner(business_id));

create trigger expenses_set_updated_at
  before update on public.expenses
  for each row execute function public.tg_set_updated_at();
