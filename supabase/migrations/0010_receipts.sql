-- Migration 0010: Receipt codes + public receipt RPC
-- Adds receipt_code to orders (auto-set by trigger on paid transition).
-- Public RPC get_public_receipt(code) bypasses RLS, returns null for
-- unknown or unpaid codes. See live DB for canonical version.

alter table public.orders
  add column if not exists receipt_code text;

create unique index if not exists orders_receipt_code_unique
  on public.orders (receipt_code)
  where receipt_code is not null;

create or replace function private.generate_receipt_code()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  candidate text;
  attempts integer := 0;
begin
  loop
    candidate := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8));
    perform 1 from public.orders where receipt_code = candidate;
    if not found then
      return candidate;
    end if;
    attempts := attempts + 1;
    if attempts > 16 then
      raise exception 'Could not generate unique receipt_code';
    end if;
  end loop;
end;
$$;

revoke execute on function private.generate_receipt_code() from public;

create or replace function private.tg_order_status_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status is distinct from 'paid' and new.status = 'paid' then
    if new.paid_at is null then new.paid_at := now(); end if;
    if new.receipt_code is null then new.receipt_code := private.generate_receipt_code(); end if;

    update public.customers
    set
      total_orders = total_orders + 1,
      total_spent_kobo = total_spent_kobo + new.subtotal_kobo,
      last_purchase_at = new.paid_at,
      updated_at = now()
    where id = new.customer_id;
  end if;

  if old.status is distinct from 'cancelled' and new.status = 'cancelled' then
    if new.cancelled_at is null then new.cancelled_at := now(); end if;
  end if;

  return new;
end;
$$;

drop function if exists public.get_public_receipt(text);

create function public.get_public_receipt(code_input text)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  result json;
begin
  if code_input is null or length(trim(code_input)) < 4 then
    return null;
  end if;

  select json_build_object(
    'order', json_build_object(
      'receipt_code', o.receipt_code,
      'subtotal_kobo', o.subtotal_kobo,
      'currency', o.currency,
      'paid_at', o.paid_at,
      'created_at', o.created_at
    ),
    'business', json_build_object(
      'name', b.name,
      'tagline', b.tagline,
      'logo_path', b.logo_path,
      'slug', b.slug,
      'whatsapp_number', b.whatsapp_number
    ),
    'customer', json_build_object('name', c.name),
    'items', coalesce(
      (select json_agg(json_build_object(
        'name', oi.name_snapshot,
        'price_kobo', oi.price_kobo_snapshot,
        'quantity', oi.quantity,
        'line_total_kobo', oi.line_total_kobo
      ) order by oi.created_at)
      from public.order_items oi where oi.order_id = o.id),
      '[]'::json
    )
  ) into result
  from public.orders o
  join public.businesses b on b.id = o.business_id
  join public.customers c on c.id = o.customer_id
  where o.receipt_code = trim(code_input) and o.status = 'paid';

  return result;
end;
$$;

grant execute on function public.get_public_receipt(text) to anon, authenticated;
