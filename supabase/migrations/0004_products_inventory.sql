-- Migration 0004: Inventory — products table + product-images storage bucket
--
-- Multi-tenant inventory. Re-uses SECURITY DEFINER helpers from 0003 so
-- policies never recurse. Money stored as kobo (1 Naira = 100 kobo) in
-- bigint to avoid floating-point drift. Currency kept on row for future
-- multi-currency support (today everything is NGN).

-- 1. products table
create table if not exists public.products (
  id              uuid primary key default gen_random_uuid(),
  business_id     uuid not null references public.businesses(id) on delete cascade,
  name            text not null,
  sku             text,
  description     text,
  price_kobo      bigint not null check (price_kobo >= 0),
  currency        text not null default 'NGN',
  stock_quantity  integer not null default 0 check (stock_quantity >= 0),
  image_path      text,
  status          text not null default 'active' check (status in ('active','archived')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

comment on column public.products.price_kobo is 'Price in kobo (1 Naira = 100 kobo)';
comment on column public.products.image_path is 'Path within product-images bucket. Public URL derived at render time.';

-- 2. indexes
create index if not exists products_business_status_created_idx
  on public.products (business_id, status, created_at desc);

create index if not exists products_business_name_idx
  on public.products (business_id, lower(name));

-- 3. updated_at trigger
drop trigger if exists set_updated_at on public.products;
create trigger set_updated_at
  before update on public.products
  for each row execute function public.tg_set_updated_at();

-- 4. enable RLS
alter table public.products enable row level security;

-- 5. per-command policies, helper-backed
drop policy if exists "products_select_by_member" on public.products;
create policy "products_select_by_member" on public.products
  for select using (private.is_business_member(business_id));

drop policy if exists "products_insert_by_owner" on public.products;
create policy "products_insert_by_owner" on public.products
  for insert with check (private.is_business_owner(business_id));

drop policy if exists "products_update_by_owner" on public.products;
create policy "products_update_by_owner" on public.products
  for update using (private.is_business_owner(business_id))
  with check (private.is_business_owner(business_id));

drop policy if exists "products_delete_by_owner" on public.products;
create policy "products_delete_by_owner" on public.products
  for delete using (private.is_business_owner(business_id));

-- 6. storage bucket: product-images
-- Public read so customer-facing surfaces use direct, CDN-cacheable URLs.
-- Writes locked to owner of the business in the first folder of the path.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-images',
  'product-images',
  true,
  2097152,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- 7. storage object policies
-- Path convention: {business_id}/{uuid}.{ext}
drop policy if exists "product_images_owner_insert" on storage.objects;
create policy "product_images_owner_insert" on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'product-images'
    and private.is_business_owner((storage.foldername(name))[1]::uuid)
  );

drop policy if exists "product_images_owner_update" on storage.objects;
create policy "product_images_owner_update" on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'product-images'
    and private.is_business_owner((storage.foldername(name))[1]::uuid)
  )
  with check (
    bucket_id = 'product-images'
    and private.is_business_owner((storage.foldername(name))[1]::uuid)
  );

drop policy if exists "product_images_owner_delete" on storage.objects;
create policy "product_images_owner_delete" on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'product-images'
    and private.is_business_owner((storage.foldername(name))[1]::uuid)
  );
