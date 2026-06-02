-- Payments arc P4a: public RPC for the /pay/[reference] status page.
-- SECURITY DEFINER + locked search_path, mirroring get_public_receipt. Lets the
-- unauthenticated customer landing page read payment+order status by reference
-- without exposing the payments table via RLS.
create or replace function public.get_payment_status(reference_input text)
returns json
language plpgsql
security definer
set search_path to ''
as $function$
declare
  result json;
begin
  if reference_input is null or length(trim(reference_input)) < 4 then
    return null;
  end if;

  select json_build_object(
    'payment_status', p.status,
    'amount_kobo', p.amount_kobo,
    'currency', p.currency,
    'order_status', o.status,
    'receipt_code', case when o.status = 'paid' then o.receipt_code else null end,
    'business', json_build_object(
      'name', b.name,
      'logo_path', b.logo_path
    )
  ) into result
  from public.payments p
  join public.orders o on o.id = p.order_id
  join public.businesses b on b.id = p.business_id
  where p.provider = 'paystack'
    and p.provider_reference = trim(reference_input);

  return result;
end;
$function$;
