-- 0024_restock_on_cancel.sql
-- Mirror of 0023 (decrement-on-paid): when a PAID order is cancelled, restore the
-- stock it consumed and reverse the customer rollup, once, on the paid -> cancelled
-- transition. Pending -> cancelled never decremented, so it never restocks.
-- Applied via Supabase MCP; this file is for repo history.

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
