-- Migration 0005: Public catalogue foundation
--
-- Adds slug, whatsapp_number, tagline, logo_path, catalogue_active to
-- businesses. Adds a SECURITY DEFINER RPC that returns a single business
-- + its active products as JSON for public consumption ? bypassing the
-- per-tenant RLS that products would otherwise enforce.

-- 1. Slug helpers (private schema)
create or replace function private.normalize_slug(input_text text)
returns text
language sql
immutable
as $$
  select substring(
    trim(both '-' from regexp_replace(
      regexp_replace(lower(coalesce(input_text, '')), '[^a-z0-9]+', '-', 'g'),
      '-+', '-', 'g'
    ))
    from 1 for 60
  );
$$;

revoke execute on function private.normalize_slug(text) from public;
grant execute on function private.normalize_slug(text) to authenticated;

create or replace function private.generate_unique_business_slug(
  base_name text,
  exclude_id uuid default null
)
returns text
language plpgsql
stable
as $$
declare
  base_slug text;
  candidate text;
  counter int := 1;
begin
  base_slug := private.normalize_slug(base_name);
  if base_slug is null or base_slug = '' then
    base_slug := 'business';
  end if;

  candidate := base_slug;
  while exists (
    select 1 from public.businesses
    where slug = candidate
      and (exclude_id is null or id <> exclude_id)
  ) loop
    counter := counter + 1;
    candidate := base_slug || '-' || counter::text;
  end loop;

  return candidate;
end;
$$;

revoke execute on function private.generate_unique_business_slug(text, uuid) from public;
grant execute on function private.generate_unique_business_slug(text, uuid) to authenticated;

-- 2. Add columns to businesses
alter table public.businesses
  add column if not exists slug              text,
  add column if not exists tagline           text,
  add column if not exists whatsapp_number   text,
  add column if not exists logo_path         text,
  add column if not exists catalogue_active  boolean not null default true;

comment on column public.businesses.slug is 'Public URL handle for /c/:slug. Auto-generated from name on insert.';
comment on column public.businesses.whatsapp_number is 'E.164 digits (no + prefix). Used for wa.me deep links.';
comment on column public.businesses.logo_path is 'Path within business-logos bucket. Public URL derived at render time.';
comment on column public.businesses.catalogue_active is 'When false, /c/:slug renders a paused state instead of the catalogue.';

-- 3. Auto-generate slug on insert trigger
create or replace function private.tg_business_slug_default()
returns trigger
language plpgsql
as $$
begin
  if new.slug is null or new.slug = '' then
    new.slug := private.generate_unique_business_slug(new.name, new.id);
  end if;
  return new;
end;
$$;

drop trigger if exists business_slug_default on public.businesses;
create trigger business_slug_default
  before insert on public.businesses
  for each row execute function private.tg_business_slug_default();

-- 4. Backfill existing rows
update public.businesses
set slug = private.generate_unique_business_slug(name, id)
where slug is null;

-- 5. Enforce slug uniqueness (partial ? only applies to non-null)
create unique index if not exists businesses_slug_unique
  on public.businesses (slug)
  where slug is not null;

-- 6. Public catalogue RPC
create or replace function public.get_public_catalogue(slug_input text)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  b record;
  products_array jsonb;
begin
  select id, name, tagline, logo_path, whatsapp_number, catalogue_active
  into b
  from public.businesses
  where slug = lower(coalesce(slug_input, ''));

  if not found then
    return null;
  end if;

  if b.catalogue_active = false then
    return jsonb_build_object(
      'status', 'paused',
      'business', jsonb_build_object(
        'name', b.name,
        'logo_path', b.logo_path
      )
    );
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', p.id,
        'name', p.name,
        'sku', p.sku,
        'price_kobo', p.price_kobo,
        'currency', p.currency,
        'stock_quantity', p.stock_quantity,
        'image_path', p.image_path
      )
      order by (p.stock_quantity = 0) asc, p.created_at desc
    ),
    '[]'::jsonb
  )
  into products_array
  from public.products p
  where p.business_id = b.id
    and p.status = 'active';

  return jsonb_build_object(
    'status', 'active',
    'business', jsonb_build_object(
      'name', b.name,
      'tagline', b.tagline,
      'logo_path', b.logo_path,
      'whatsapp_number', b.whatsapp_number
    ),
    'products', products_array
  );
end;
$$;

revoke execute on function public.get_public_catalogue(text) from public;
grant execute on function public.get_public_catalogue(text) to anon, authenticated;

-- 7. Storage bucket: business-logos
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'business-logos',
  'business-logos',
  true,
  1048576,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "business_logos_owner_insert" on storage.objects;
create policy "business_logos_owner_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'business-logos'
    and private.is_business_owner((storage.foldername(name))[1]::uuid)
  );

drop policy if exists "business_logos_owner_update" on storage.objects;
create policy "business_logos_owner_update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'business-logos'
    and private.is_business_owner((storage.foldername(name))[1]::uuid)
  )
  with check (
    bucket_id = 'business-logos'
    and private.is_business_owner((storage.foldername(name))[1]::uuid)
  );

drop policy if exists "business_logos_owner_delete" on storage.objects;
create policy "business_logos_owner_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'business-logos'
    and private.is_business_owner((storage.foldername(name))[1]::uuid)
  );
