-- Migration 0003: Fix RLS infinite recursion between businesses and business_members
--
-- The previous policies created a cycle:
--   businesses_read_members SELECTs business_members
--   -> triggers members_manage_by_owner (FOR ALL includes SELECT)
--   -> SELECTs businesses
--   -> triggers businesses_read_members
--   -> recursion.
--
-- Fix: SECURITY DEFINER helpers in a `private` schema (not exposed via
-- PostgREST) bypass RLS for the membership/ownership checks, breaking
-- the cycle. Also split the FOR ALL members policy into per-command
-- policies so SELECT can never cascade.

-- 1. Private schema for internal helpers (not exposed via PostgREST)
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

-- 2. Helper: is current user a member of the business?
create or replace function private.is_business_member(_business_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.business_members
    where business_id = _business_id and user_id = auth.uid()
  );
$$;

revoke execute on function private.is_business_member(uuid) from public;
grant execute on function private.is_business_member(uuid) to authenticated;

-- 3. Helper: is current user the owner of the business?
create or replace function private.is_business_owner(_business_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.businesses
    where id = _business_id and owner_id = auth.uid()
  );
$$;

revoke execute on function private.is_business_owner(uuid) from public;
grant execute on function private.is_business_owner(uuid) to authenticated;

-- 4. Replace recursive businesses SELECT policy.
-- Owner can always see their own businesses (essential for INSERT...RETURNING).
-- Members can see via the helper (no recursion since helper is SECURITY DEFINER).
drop policy if exists "businesses_read_members" on public.businesses;
create policy "businesses_select_owner_or_member" on public.businesses
  for select using (
    owner_id = auth.uid()
    or private.is_business_member(id)
  );

-- 5. Replace recursive FOR ALL policy with per-command policies.
drop policy if exists "members_manage_by_owner" on public.business_members;

create policy "members_read_by_owner" on public.business_members
  for select using (private.is_business_owner(business_id));

create policy "members_insert_by_owner" on public.business_members
  for insert with check (private.is_business_owner(business_id));

create policy "members_update_by_owner" on public.business_members
  for update using (private.is_business_owner(business_id));

create policy "members_delete_by_owner" on public.business_members
  for delete using (private.is_business_owner(business_id));
