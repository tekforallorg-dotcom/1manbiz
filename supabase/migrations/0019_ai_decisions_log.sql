-- AI decision log. Records every AI proposal and the human verdict, so the
-- semi-autonomous testing phase produces measurable evidence (AI-vs-human
-- agreement) before the autonomous switch is enabled.
--
-- mode    : which gate the decision passed through (assisted/semi/autonomous).
-- outcome : the human verdict (pending until acted on) -- the gold signal for
--           proving autonomy is safe. final_order_id links to the order that
--           was actually created, if any.
-- proposal: the full OrderProposal JSON the model returned (items/qty/customer/
--           notes/confidence). Money is NOT trusted from here; this is a record,
--           not a source of truth for pricing.
create table public.ai_decisions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  conversation_id uuid references public.conversations(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  kind text not null default 'order_proposal'
    check (kind in ('order_proposal','reply')),
  mode text not null default 'assisted'
    check (mode in ('assisted','semi','autonomous')),
  model text,
  input_message_count integer not null default 0,
  item_count integer not null default 0,
  confidence text check (confidence in ('high','low')),
  proposal jsonb,
  outcome text not null default 'pending'
    check (outcome in ('pending','accepted','edited','rejected','auto_sent')),
  outcome_at timestamptz,
  final_order_id uuid references public.orders(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index ai_decisions_business_created_idx
  on public.ai_decisions (business_id, created_at desc);
create index ai_decisions_conversation_idx
  on public.ai_decisions (conversation_id);

alter table public.ai_decisions enable row level security;

create policy ai_decisions_select_by_owner on public.ai_decisions
  for select using (private.is_business_owner(business_id));
create policy ai_decisions_insert_by_owner on public.ai_decisions
  for insert with check (private.is_business_owner(business_id));
create policy ai_decisions_update_by_owner on public.ai_decisions
  for update using (private.is_business_owner(business_id))
  with check (private.is_business_owner(business_id));

create trigger ai_decisions_set_updated_at
  before update on public.ai_decisions
  for each row execute function public.tg_set_updated_at();
