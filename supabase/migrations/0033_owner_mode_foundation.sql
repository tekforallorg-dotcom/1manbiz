-- 0033: owner-mode foundation
-- Applied to prod via Supabase MCP; this file is for migration history only.
-- The shop owner manages the business from their own personal WhatsApp.
-- owner_phone is claimed via a LINK <code> handshake (possession of the phone
-- is the proof); owner_messages is the management chat history and audit
-- trail (separate from the customer CRM); owner_actions is the
-- propose -> YES-confirm -> execute rail for chat writes.

alter table public.businesses
  add column owner_phone text,
  add column owner_phone_verified_at timestamptz,
  add column owner_link_code text,
  add column low_stock_threshold integer not null default 3;

create table public.owner_messages (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  direction text not null check (direction in ('in', 'out')),
  body text not null,
  created_at timestamptz not null default now()
);
create index owner_messages_business_created_idx
  on public.owner_messages (business_id, created_at desc);
alter table public.owner_messages enable row level security;

create table public.owner_actions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  kind text not null check (kind in ('set_stock', 'set_price')),
  payload jsonb not null,
  summary text not null,
  status text not null default 'proposed'
    check (status in ('proposed', 'confirmed', 'cancelled', 'expired')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
create index owner_actions_business_status_idx
  on public.owner_actions (business_id, status, created_at desc);
alter table public.owner_actions enable row level security;
