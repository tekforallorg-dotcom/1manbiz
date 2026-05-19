-- Migration 0009: Order status change trigger
-- See live DB for canonical version. Trigger updates customers totals
-- on first paid transition and auto-stamps paid_at/cancelled_at.

create or replace function private.tg_order_status_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status is distinct from 'paid' and new.status = 'paid' then
    if new.paid_at is null then
      new.paid_at := now();
    end if;
    update public.customers
    set
      total_orders = total_orders + 1,
      total_spent_kobo = total_spent_kobo + new.subtotal_kobo,
      last_purchase_at = new.paid_at,
      updated_at = now()
    where id = new.customer_id;
  end if;

  if old.status is distinct from 'cancelled' and new.status = 'cancelled' then
    if new.cancelled_at is null then
      new.cancelled_at := now();
    end if;
  end if;

  return new;
end;
$$;

revoke execute on function private.tg_order_status_change() from public;

drop trigger if exists order_status_change on public.orders;
create trigger order_status_change
  before update on public.orders
  for each row
  when (old.status is distinct from new.status)
  execute function private.tg_order_status_change();
