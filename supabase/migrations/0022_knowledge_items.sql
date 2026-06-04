-- Business knowledge base. Free-form policy/FAQ entries (refunds, returns,
-- warranty, hours, payment methods, etc.) that ground the AI reply brain so it
-- can answer policy questions confidently instead of escalating. Plain text in
-- v1; embeddings (pgvector) are deferred to P2 per the AI architecture plan.
-- Structured facts that must be exact (prices, delivery fees) live in their own
-- tables, NOT here -- this is for prose the model relays verbatim.
create table public.knowledge_items (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  title text not null,
  content text not null,
  source_type text not null default 'manual'
    check (source_type in ('manual','document','ai_generated')),
  status text not null default 'active'
    check (status in ('active','archived')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index knowledge_items_business_idx
  on public.knowledge_items (business_id, status, sort_order);

alter table public.knowledge_items enable row level security;

create policy knowledge_items_select_by_owner on public.knowledge_items
  for select using (private.is_business_owner(business_id));
create policy knowledge_items_insert_by_owner on public.knowledge_items
  for insert with check (private.is_business_owner(business_id));
create policy knowledge_items_update_by_owner on public.knowledge_items
  for update using (private.is_business_owner(business_id))
  with check (private.is_business_owner(business_id));
create policy knowledge_items_delete_by_owner on public.knowledge_items
  for delete using (private.is_business_owner(business_id));

create trigger knowledge_items_set_updated_at
  before update on public.knowledge_items
  for each row execute function public.tg_set_updated_at();
