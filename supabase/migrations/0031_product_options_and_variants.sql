-- Variant support for products: named option axes (product_options), sellable
-- variant rows (product_variants), and a variant link + label snapshot on
-- order_items. Additive only: existing simple products keep working with no
-- options/variants, and order_items.variant_id stays null for them.

create table public.product_options (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  product_id  uuid not null references public.products(id) on delete cascade,
  name        text not null,
  position    smallint not null default 1,
  created_at  timestamptz not null default now(),
  constraint product_options_position_range check (position between 1 and 2),
  constraint product_options_product_position_key unique (product_id, position),
  constraint product_options_product_name_key unique (product_id, name)
);

create table public.product_variants (
  id             uuid primary key default gen_random_uuid(),
  business_id    uuid not null references public.businesses(id) on delete cascade,
  product_id     uuid not null references public.products(id) on delete cascade,
  label          text not null,
  option1        text,
  option2        text,
  price_kobo     bigint check (price_kobo is null or price_kobo >= 0),
  stock_quantity integer not null default 0 check (stock_quantity >= 0),
  image_path     text,
  sku            text,
  is_active      boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index product_options_product_idx   on public.product_options(product_id);
create index product_variants_product_idx   on public.product_variants(product_id);
create index product_variants_business_idx  on public.product_variants(business_id);
create unique index product_variants_combo_key
  on public.product_variants (product_id, coalesce(option1, ''), coalesce(option2, ''));

create trigger set_updated_at
  before update on public.product_variants
  for each row execute function public.tg_set_updated_at();

alter table public.order_items
  add column variant_id uuid references public.product_variants(id) on delete set null,
  add column variant_label_snapshot text;

alter table public.product_options  enable row level security;
alter table public.product_variants enable row level security;

create policy product_options_select_by_member on public.product_options
  for select using (private.is_business_member(business_id));
create policy product_options_insert_by_owner on public.product_options
  for insert with check (private.is_business_owner(business_id));
create policy product_options_update_by_owner on public.product_options
  for update using (private.is_business_owner(business_id)) with check (private.is_business_owner(business_id));
create policy product_options_delete_by_owner on public.product_options
  for delete using (private.is_business_owner(business_id));

create policy product_variants_select_by_member on public.product_variants
  for select using (private.is_business_member(business_id));
create policy product_variants_insert_by_owner on public.product_variants
  for insert with check (private.is_business_owner(business_id));
create policy product_variants_update_by_owner on public.product_variants
  for update using (private.is_business_owner(business_id)) with check (private.is_business_owner(business_id));
create policy product_variants_delete_by_owner on public.product_variants
  for delete using (private.is_business_owner(business_id));
