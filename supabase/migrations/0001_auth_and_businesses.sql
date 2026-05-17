-- ╔══════════════════════════════════════════════════════════════════╗
-- ║ 1Man.Biz — Migration 0001: Auth + Tenants Foundation             ║
-- ║ Tables: profiles, businesses, business_members                    ║
-- ║ Plus RLS policies, signup trigger, updated_at trigger.            ║
-- ║                                                                   ║
-- ║ This script is idempotent: safe to re-run.                        ║
-- ║ Apply via: Supabase Dashboard → SQL Editor → paste → Run          ║
-- ║      or:   supabase db push (if using Supabase CLI)               ║
-- ╚══════════════════════════════════════════════════════════════════╝

-- ─── PROFILES ───────────────────────────────────────────────────
create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  email text,
  full_name text,
  onboarded boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ─── BUSINESSES (the tenant entity) ─────────────────────────────
create table if not exists public.businesses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text,
  channels text[] not null default '{}',
  ai_tone text not null default 'friendly' check (ai_tone in ('friendly', 'formal', 'playful')),
  ai_language text not null default 'en',
  owner_id uuid not null references auth.users on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists businesses_owner_id_idx on public.businesses (owner_id);

-- ─── BUSINESS MEMBERS (user ↔ business join, role) ──────────────
create table if not exists public.business_members (
  business_id uuid not null references public.businesses on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  role text not null default 'owner' check (role in ('owner', 'admin', 'staff')),
  created_at timestamptz not null default now(),
  primary key (business_id, user_id)
);
create index if not exists business_members_user_id_idx on public.business_members (user_id);

-- ─── ROW LEVEL SECURITY ─────────────────────────────────────────
alter table public.profiles         enable row level security;
alter table public.businesses       enable row level security;
alter table public.business_members enable row level security;

-- Profiles: users see and modify only their own row.
drop policy if exists "profiles_read_own" on public.profiles;
create policy "profiles_read_own" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);

-- Businesses: visible to any member, mutable only by the owner.
drop policy if exists "businesses_read_members" on public.businesses;
create policy "businesses_read_members" on public.businesses
  for select using (
    exists (
      select 1 from public.business_members
      where business_id = businesses.id and user_id = auth.uid()
    )
  );

drop policy if exists "businesses_insert_self" on public.businesses;
create policy "businesses_insert_self" on public.businesses
  for insert with check (owner_id = auth.uid());

drop policy if exists "businesses_update_owner" on public.businesses;
create policy "businesses_update_owner" on public.businesses
  for update using (owner_id = auth.uid());

drop policy if exists "businesses_delete_owner" on public.businesses;
create policy "businesses_delete_owner" on public.businesses
  for delete using (owner_id = auth.uid());

-- Business members: users see their own memberships;
-- owners can read/insert/update/delete members of their businesses;
-- new users can self-insert their owner membership on signup.
drop policy if exists "members_read_own" on public.business_members;
create policy "members_read_own" on public.business_members
  for select using (user_id = auth.uid());

drop policy if exists "members_insert_self" on public.business_members;
create policy "members_insert_self" on public.business_members
  for insert with check (user_id = auth.uid());

drop policy if exists "members_manage_by_owner" on public.business_members;
create policy "members_manage_by_owner" on public.business_members
  for all using (
    exists (
      select 1 from public.businesses
      where id = business_id and owner_id = auth.uid()
    )
  );

-- ─── SIGNUP TRIGGER ─────────────────────────────────────────────
-- Auto-create a profile row when a new auth.users row is inserted.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.email)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─── UPDATED_AT TRIGGER ─────────────────────────────────────────
create or replace function public.tg_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_updated_at on public.profiles;
create trigger set_updated_at
  before update on public.profiles
  for each row execute function public.tg_set_updated_at();

drop trigger if exists set_updated_at on public.businesses;
create trigger set_updated_at
  before update on public.businesses
  for each row execute function public.tg_set_updated_at();
