-- 0027_orders_confirmed_at.sql
-- Marks the moment the customer confirms the cart, so the flow can tell
-- "still building cart" from "confirmed, now collecting fulfillment" (both have
-- fulfillment_type null otherwise). The order stays pending until paid.
-- Additive, idempotent, non-destructive.

alter table public.orders
  add column if not exists confirmed_at timestamptz;

comment on column public.orders.confirmed_at is
  'Set when the customer confirms the cart items; transition point from cart-building to fulfillment collection. Order stays pending until paid.';
