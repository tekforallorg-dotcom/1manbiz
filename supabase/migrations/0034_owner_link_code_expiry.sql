-- 0034: owner-mode v2 - short-lived single-use link codes
-- Applied to prod via Supabase MCP; this file is for migration history only.
-- owner_link_code_expires_at gates the LINK handshake. A code past expiry, or
-- already consumed (owner_link_code nulled on link), no longer links a number.
alter table public.businesses
  add column owner_link_code_expires_at timestamptz;
