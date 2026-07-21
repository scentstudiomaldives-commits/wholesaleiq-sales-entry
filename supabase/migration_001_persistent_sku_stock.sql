-- Run this in Supabase SQL Editor if you already ran the original schema.sql.
-- Safe to run even if partially applied — uses "if not exists".
-- Adds persistent storage for SKU/Portfolio and Warehouse Stock uploads,
-- so they survive logout/login instead of living only in browser memory.

create table if not exists skus (
  id uuid primary key default gen_random_uuid(),
  brand text not null,
  category text not null,
  sku text not null,
  required_customers numeric default 0,
  available_customers numeric default 0,
  facing numeric default 1,
  shelf_share_pct numeric default 0,
  competitor_present boolean default false,
  days_since_purchase numeric default 0,
  monthly_sales numeric default 0,
  gp_pct numeric default 18,
  prior_month_sales numeric default 0,
  avg_unit_value numeric default 25,
  uploaded_at timestamptz default now()
);

create table if not exists warehouse_stock (
  id uuid primary key default gen_random_uuid(),
  brand text not null,
  stock_units numeric default 0,
  days_of_cover numeric default 15,
  out_of_stock numeric default 0,
  low_stock numeric default 0,
  near_expiry numeric default 0,
  uploaded_at timestamptz default now()
);

alter table skus enable row level security;
alter table warehouse_stock enable row level security;

drop policy if exists "skus_admin_all" on skus;
drop policy if exists "warehouse_stock_admin_all" on warehouse_stock;
create policy "skus_admin_all" on skus for all using (is_admin()) with check (is_admin());
create policy "warehouse_stock_admin_all" on warehouse_stock for all using (is_admin()) with check (is_admin());
