-- 3G.E: enable Supabase Realtime on the messaging surfaces.
-- Already applied to production via MCP on 2026-06-01; this file is repo parity.
alter table public.messages      replica identity full;
alter table public.conversations replica identity full;

do $$
begin
  if not exists (select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='messages') then
    alter publication supabase_realtime add table public.messages;
  end if;
  if not exists (select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='conversations') then
    alter publication supabase_realtime add table public.conversations;
  end if;
end $$;

-- Rollback:
--   alter publication supabase_realtime drop table public.messages;
--   alter publication supabase_realtime drop table public.conversations;
--   alter table public.messages      replica identity default;
--   alter table public.conversations replica identity default;
