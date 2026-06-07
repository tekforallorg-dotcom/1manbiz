-- 0026_orders_fulfillment.sql
-- Fulfillment + payment-method state for the autonomous order flow.
-- subtotal_kobo stays goods-only (the paid trigger rolls only goods into the
-- customer's lifetime spend); the payable charge is subtotal_kobo + delivery_fee_kobo,
-- computed server-side. Additive, idempotent, non-destructive.

alter table public.orders
  add column if not exists fulfillment_type  text,
  add column if not exists delivery_zone_id  uuid references public.delivery_zones(id) on delete set null,
  add column if not exists delivery_address  text,
  add column if not exists delivery_fee_kobo bigint not null default 0,
  add column if not exists payment_method    text;

comment on column public.orders.fulfillment_type  is 'delivery | pickup | null. How the confirmed order is fulfilled.';
comment on column public.orders.delivery_zone_id  is 'Resolved delivery_zones row when fulfillment_type = delivery; fee is taken from this zone server-side.';
comment on column public.orders.delivery_address  is 'Raw delivery area/address text the customer provided.';
comment on column public.orders.delivery_fee_kobo is 'Delivery fee in kobo, server-resolved from delivery_zone. 0 for pickup. Added to subtotal_kobo for the charge, but excluded from lifetime spend.';
comment on column public.orders.payment_method    is 'online (Paystack link) | on_delivery | at_store | null. Cash methods stay unpaid until the vendor marks paid.';
