-- 0028_businesses_address_fulfillment_mode.sql
-- Store configuration for the fulfillment flow: a physical/pickup address and
-- which fulfillment modes the store supports. fulfillment_mode defaults to
-- 'both' so existing stores keep today's "delivery or pickup?" behavior.
-- Additive, idempotent, non-destructive. Already applied to the DB via MCP.

alter table public.businesses
  add column if not exists address text,
  add column if not exists fulfillment_mode text not null default 'both';

comment on column public.businesses.address is
  'Store physical / pickup address, shown to customers for pickup orders.';
comment on column public.businesses.fulfillment_mode is
  'delivery | pickup | both. Which fulfillment options the autonomous order flow offers. Default both.';
