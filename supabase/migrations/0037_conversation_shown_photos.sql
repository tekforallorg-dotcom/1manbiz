-- Tracks which product photos BizBot has already sent to a customer within a
-- conversation, so a product's photo is shown once (the first time it enters
-- the order) and never re-sent on later held-order recomposes. The webhook and
-- auto-reply paths touch this via the admin (service-role) client only, so RLS
-- is enabled with no policies, matching owner_messages.
create table if not exists public.conversation_shown_photos (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  shown_at timestamptz not null default now(),
  primary key (conversation_id, product_id)
);

alter table public.conversation_shown_photos enable row level security;
