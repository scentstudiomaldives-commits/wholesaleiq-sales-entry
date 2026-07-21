-- ============================================================
-- Wholesale Sales — Rep Data Entry Schema
-- Run this once in Supabase Studio → SQL Editor → New query.
-- ============================================================

-- 1. PROFILES ---------------------------------------------------
-- One row per login (rep or admin). Created after you add the
-- person in Authentication → Users (see README for the two-step
-- process — Supabase doesn't let us insert into auth.users directly).
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role text not null check (role in ('rep','admin')),
  region text,               -- optional: rep's home region, for reference only
  created_at timestamptz default now()
);

-- 2. CUSTOMERS ---------------------------------------------------
create table if not exists customers (
  id uuid primary key default gen_random_uuid(),
  customer_code text unique,
  name text not null,
  region text not null,
  area text not null,
  customer_type text default 'General',
  rep_id uuid references profiles(id),
  monthly_target numeric default 0,
  credit_limit numeric default 0,
  status text not null default 'active' check (status in ('active','lost')),
  created_at timestamptz default now()
);

-- 3. SALES ENTRIES -------------------------------------------------
-- One row per visit/sale a rep logs. This is the "daily upload".
create table if not exists sales_entries (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references customers(id) not null,
  rep_id uuid references profiles(id) not null,
  entry_date date not null default current_date,
  sale_amount numeric not null default 0,
  gp numeric default 0,
  portfolio_pct numeric check (portfolio_pct between 0 and 100),
  outstanding_collected numeric default 0,
  visit_notes text,
  next_visit_date date,
  created_at timestamptz default now()
);

create index if not exists idx_sales_entries_customer on sales_entries(customer_id);
create index if not exists idx_sales_entries_rep on sales_entries(rep_id);
create index if not exists idx_sales_entries_date on sales_entries(entry_date);
create index if not exists idx_customers_rep on customers(rep_id);

-- 4. HELPER: is_admin() ------------------------------------------
-- security definer so it can check profiles without recursive RLS.
create or replace function is_admin() returns boolean
language sql security definer stable as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin');
$$;

-- 5. ROW LEVEL SECURITY --------------------------------------------
alter table profiles enable row level security;
alter table customers enable row level security;
alter table sales_entries enable row level security;

-- profiles: see your own row, or all rows if admin
create policy "profiles_select_own_or_admin" on profiles for select
  using (id = auth.uid() or is_admin());
create policy "profiles_update_own" on profiles for update
  using (id = auth.uid());

-- customers: reps see/manage only their own customers; admins see all
create policy "customers_select" on customers for select
  using (rep_id = auth.uid() or is_admin());
create policy "customers_insert" on customers for insert
  with check (rep_id = auth.uid() or is_admin());
create policy "customers_update" on customers for update
  using (rep_id = auth.uid() or is_admin());

-- sales_entries: reps insert/see only their own entries; admins see all
create policy "sales_entries_select" on sales_entries for select
  using (rep_id = auth.uid() or is_admin());
create policy "sales_entries_insert" on sales_entries for insert
  with check (rep_id = auth.uid());
create policy "sales_entries_update_own" on sales_entries for update
  using (rep_id = auth.uid() and entry_date = current_date); -- reps can only fix same-day entries

-- 6. LIVE DASHBOARD VIEW --------------------------------------------
-- Produces one row per active customer, current-month snapshot,
-- in the same shape the dashboard's buildModel() already expects.
create or replace view v_customer_snapshot as
with this_month as (
  select customer_id, sum(sale_amount) as sales, sum(gp) as gp
  from sales_entries
  where entry_date >= date_trunc('month', current_date)
  group by customer_id
),
last_month as (
  select customer_id, sum(sale_amount) as sales
  from sales_entries
  where entry_date >= date_trunc('month', current_date) - interval '1 month'
    and entry_date < date_trunc('month', current_date)
  group by customer_id
),
latest_entry as (
  select distinct on (customer_id)
    customer_id, portfolio_pct, next_visit_date, entry_date as last_visit_date
  from sales_entries
  order by customer_id, entry_date desc
)
select
  c.region,
  c.area,
  c.name as customer_name,
  c.customer_code,
  p.full_name as rep,
  c.customer_type,
  c.status,
  case when c.created_at >= current_date - interval '30 days' then 'yes' else 'no' end as is_new,
  coalesce(tm.sales, 0) as monthly_sales,
  c.monthly_target as target,
  coalesce(tm.gp, 0) as gp,
  coalesce(le.portfolio_pct, 70) as portfolio_pct,
  coalesce(current_date - le.last_visit_date, 999) as last_visit_days,
  coalesce(le.next_visit_date - current_date, 7) as next_visit_days,
  c.credit_limit,
  greatest(c.credit_limit - coalesce(tm.sales,0), 0) as outstanding, -- simplified: refine with a real ledger if needed
  coalesce(current_date - le.last_visit_date, 999) as days_since_purchase,
  case when coalesce(lm.sales,0) > 0
       then round(((coalesce(tm.sales,0) - lm.sales) / lm.sales * 100)::numeric, 1)
       else 0 end as growth_pct
from customers c
left join profiles p on p.id = c.rep_id
left join this_month tm on tm.customer_id = c.id
left join last_month lm on lm.customer_id = c.id
left join latest_entry le on le.customer_id = c.id;

-- 7. LIVE MONTHLY TREND VIEW (company-wide, real history) -----------
create or replace view v_monthly_trend as
select
  to_char(date_trunc('month', entry_date), 'Mon') as month,
  date_trunc('month', entry_date) as month_sort,
  sum(sale_amount) as sales,
  sum(gp) as gp
from sales_entries
group by date_trunc('month', entry_date)
order by month_sort;

-- 8. "CUSTOMERS DUE FOR A VISIT" — used by the rep entry screen -----
create or replace view v_my_customers_today as
select
  c.*,
  (select max(entry_date) from sales_entries se where se.customer_id = c.id) as last_visit_date,
  (select next_visit_date from sales_entries se where se.customer_id = c.id
     order by entry_date desc limit 1) as next_visit_date
from customers c
where c.status = 'active';
