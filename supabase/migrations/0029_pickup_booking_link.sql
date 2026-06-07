-- 0029_pickup_booking_link.sql
-- Pickup-as-booking (Slice 2b). A pickup order schedules a booking (so it shows
-- in Bookings) and the order carries pickup_at as its scheduled-time marker.
-- bookings.order_id links the pickup booking back to its order. Additive,
-- idempotent, non-destructive. Already applied to the DB via MCP.

alter table public.bookings
  add column if not exists order_id uuid references public.orders(id) on delete set null;

create index if not exists bookings_order_idx on public.bookings(order_id);

alter table public.orders
  add column if not exists pickup_at timestamptz;

comment on column public.bookings.order_id is
  'When set, this booking is the pickup slot for the given order.';
comment on column public.orders.pickup_at is
  'Scheduled pickup time for a pickup order; mirrors the linked booking starts_at.';
