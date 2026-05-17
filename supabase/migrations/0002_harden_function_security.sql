-- ╔══════════════════════════════════════════════════════════════════╗
-- ║ 1Man.Biz — Migration 0002: Security hardening for foundation     ║
-- ║                                                                   ║
-- ║ Addresses Supabase advisors:                                      ║
-- ║   - function_search_path_mutable on tg_set_updated_at             ║
-- ║   - anon/authenticated_security_definer_function_executable       ║
-- ║     on handle_new_user                                            ║
-- ║                                                                   ║
-- ║ Already applied to project lcffhrbadhjnyyzivoys via MCP.          ║
-- ║ This file is here for repo/version-control parity.                ║
-- ╚══════════════════════════════════════════════════════════════════╝

-- 1. Lock search_path on tg_set_updated_at (no privilege change, just hygiene)
create or replace function public.tg_set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- 2. Revoke EXECUTE on handle_new_user from public-facing roles.
-- The trigger on auth.users still works because SECURITY DEFINER functions
-- run with the privileges of the function owner (postgres), not the caller.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
