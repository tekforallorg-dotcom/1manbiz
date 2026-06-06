-- Decrement product stock when an order transitions to paid.
-- Extends the existing BEFORE UPDATE trigger fn so the decrement happens once,
-- inside the same pending -> paid guard (idempotent; floored at zero).
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

  return new;
end;
$function$;
