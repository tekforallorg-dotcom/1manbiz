-- The AI autonomy switch, per business. This is the home for the semi/autonomous
-- toggle the product is built around.
--   off        : AI does nothing automatically.
--   assisted   : AI drafts only when the vendor asks (human-pull). Today's behaviour.
--   semi       : AI auto-drafts on inbound, queues the draft for vendor approval.
--   autonomous : AI auto-drafts and auto-sends when confident and inside the 24h window.
-- Default 'assisted' preserves current behaviour for every existing business.
alter table public.businesses
  add column ai_mode text not null default 'assisted'
  check (ai_mode in ('off','assisted','semi','autonomous'));
