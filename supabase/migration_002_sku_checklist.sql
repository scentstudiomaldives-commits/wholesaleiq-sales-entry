-- Run this in Supabase SQL Editor. Safe to run once; uses if-not-exists guards.

-- 1. Let any logged-in rep READ the SKU catalog (previously admin-only).
--    Writing/uploading SKUs is still admin-only.
drop policy if exists "skus_admin_all" on skus;
create policy "skus_admin_write" on skus for all using (is_admin()) with check (is_admin());
create policy "skus_read_all" on skus for select using (auth.uid() is not null);

-- 2. Per-customer SKU stock checklist — "does this customer currently
--    carry this SKU?" One row per (customer, sku), updated in place
--    each time a rep re-checks it (not a growing log).
create table if not exists customer_sku_stock (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references customers(id) not null,
  sku_id uuid references skus(id) not null,
  in_stock boolean not null default false,
  updated_by uuid references profiles(id),
  updated_at timestamptz default now(),
  unique (customer_id, sku_id)
);

create index if not exists idx_customer_sku_stock_customer on customer_sku_stock(customer_id);

alter table customer_sku_stock enable row level security;

-- Reps can read/write stock checklists only for their own customers.
-- Admins can read/write all.
create policy "customer_sku_stock_select" on customer_sku_stock for select
  using (
    exists (select 1 from customers c where c.id = customer_id and (c.rep_id = auth.uid() or is_admin()))
  );
create policy "customer_sku_stock_upsert" on customer_sku_stock for insert
  with check (
    exists (select 1 from customers c where c.id = customer_id and (c.rep_id = auth.uid() or is_admin()))
  );
create policy "customer_sku_stock_update" on customer_sku_stock for update
  using (
    exists (select 1 from customers c where c.id = customer_id and (c.rep_id = auth.uid() or is_admin()))
  );
