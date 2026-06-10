-- 0032: variant-aware stock triggers
-- Applied to prod via Supabase MCP; this file is for migration history only.
-- Makes private.tg_order_status_change() also move the chosen variant's stock.
-- The existing product decrement/restock is unchanged (a product stays the sum
-- of its variants, so decrementing the product by the line qty still holds);
-- two new blocks additionally move public.product_variants.stock_quantity for
-- order_items that carry a variant_id. Dormant until order lines set variant_id.
-- Rollback: re-create the function without the two "product_variants v" blocks
-- (the 0023/0024 version).

create or replace function private.tg_order_status_change()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if old.status is distinct from 'paid' and new.status = 'paid' then
    if new.paid_at is null then
      new.paid_at := now();
    end if;

    if new.receipt_code is null then
      new.receipt_code := private.generate_receipt_code();
    end if;

    update public.customers
    set
      total_orders = total_orders + 1,
      total_spent_kobo = total_spent_kobo + new.subtotal_kobo,
      last_purchase_at = new.paid_at,
      updated_at = now()
    where id = new.customer_id;

    -- Decrement stock for each ordered product, once, on the paid transition.
    update public.products p
    set stock_quantity = greatest(0, p.stock_quantity - oi.qty),
        updated_at = now()
    from (
      select product_id, sum(quantity)::int as qty
      from public.order_items
      where order_id = new.id and product_id is not null
      group by product_id
    ) oi
    where p.id = oi.product_id;

    -- Also decrement the chosen variant for variant lines. Products stay the
    -- sum of their variants, so the product decrement above still holds.
    update public.product_variants v
    set stock_quantity = greatest(0, v.stock_quantity - oiv.qty),
        updated_at = now()
    from (
      select variant_id, sum(quantity)::int as qty
      from public.order_items
      where order_id = new.id and variant_id is not null
      group by variant_id
    ) oiv
    where v.id = oiv.variant_id;
  end if;

  if old.status is distinct from 'cancelled' and new.status = 'cancelled' then
    if new.cancelled_at is null then
      new.cancelled_at := now();
    end if;
  end if;

  -- Reverse the paid effects when a paid order is cancelled: restore stock and
  -- roll back the customer totals, once, on the paid -> cancelled transition.
  if old.status = 'paid' and new.status = 'cancelled' then
    update public.products p
    set stock_quantity = p.stock_quantity + oi.qty,
        updated_at = now()
    from (
      select product_id, sum(quantity)::int as qty
      from public.order_items
      where order_id = new.id and product_id is not null
      group by product_id
    ) oi
    where p.id = oi.product_id;

    -- Mirror for the chosen variants.
    update public.product_variants v
    set stock_quantity = v.stock_quantity + oiv.qty,
        updated_at = now()
    from (
      select variant_id, sum(quantity)::int as qty
      from public.order_items
      where order_id = new.id and variant_id is not null
      group by variant_id
    ) oiv
    where v.id = oiv.variant_id;

    update public.customers
    set
      total_orders = greatest(0, total_orders - 1),
      total_spent_kobo = greatest(0, total_spent_kobo - new.subtotal_kobo),
      updated_at = now()
    where id = new.customer_id;
  end if;

  return new;
end;
$function$;
