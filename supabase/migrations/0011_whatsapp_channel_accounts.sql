-- Migration 0011: Channel accounts (WhatsApp + Instagram)
-- See live DB for canonical version.

create table if not exists public.channel_accounts (
  id                          uuid primary key default gen_random_uuid(),
  business_id                 uuid not null references public.businesses(id) on delete cascade,
  channel                     text not null check (channel in ('whatsapp','instagram')),
  meta_phone_number_id        text,
  meta_business_account_id    text,
  meta_display_phone_number   text,
  access_token                text not null,
  token_type                  text not null default 'permanent'
                                check (token_type in ('temporary','permanent')),
  token_expires_at            timestamptz,
  status                      text not null default 'pending'
                                check (status in ('pending','connected','failed','disconnected')),
  last_verified_at            timestamptz,
  last_error                  text,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now()
);

create unique index if not exists channel_accounts_business_channel_active
  on public.channel_accounts (business_id, channel)
  where status <> 'disconnected';

create index if not exists channel_accounts_business_idx on public.channel_accounts (business_id);

drop trigger if exists set_updated_at on public.channel_accounts;
create trigger set_updated_at
  before update on public.channel_accounts
  for each row execute function public.tg_set_updated_at();

alter table public.channel_accounts enable row level security;

create policy "channel_accounts_select_by_member" on public.channel_accounts
  for select using (private.is_business_member(business_id));
create policy "channel_accounts_insert_by_owner" on public.channel_accounts
  for insert with check (private.is_business_owner(business_id));
create policy "channel_accounts_update_by_owner" on public.channel_accounts
  for update using (private.is_business_owner(business_id))
  with check (private.is_business_owner(business_id));
create policy "channel_accounts_delete_by_owner" on public.channel_accounts
  for delete using (private.is_business_owner(business_id));
