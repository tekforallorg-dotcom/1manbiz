-- Money pillar, Slice M3b: tag the origin of an expense.
-- Manual vendor entry today; the future BizBot chat-capture ("bought fuel 5k")
-- will write 'ai_chat', and bulk import or receipt-photo paths their own values.
-- Defaulting to 'manual' backfills every existing row with no separate step, and
-- the already-deployed create path (which does not set source yet) stays valid
-- because the default fills it in.
alter table public.expenses
  add column source text not null default 'manual'
  check (source in ('manual', 'ai_chat', 'import', 'receipt_upload'));
