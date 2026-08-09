-- Run in Supabase SQL Editor.
-- v_customer_snapshot previously excluded lost customers entirely
-- (where c.status = 'active'), which meant:
--   1. "Lost Customers" counts on the dashboard were always 0
--   2. There was no way to see lost customers anywhere in the app
-- This removes that filter. The dashboard's region/area sales rollups
-- still only count active customers (that logic lives in the app, not
-- here) — this migration only makes lost customers visible where
-- they're meant to be: the Lost Customers count, and an optional
-- "show all statuses" view on the Customer list.

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
  greatest(c.credit_limit - coalesce(tm.sales,0), 0) as outstanding,
  coalesce(current_date - le.last_visit_date, 999) as days_since_purchase,
  case when coalesce(lm.sales,0) > 0
       then round(((coalesce(tm.sales,0) - lm.sales) / lm.sales * 100)::numeric, 1)
       else 0 end as growth_pct
from customers c
left join profiles p on p.id = c.rep_id
left join this_month tm on tm.customer_id = c.id
left join last_month lm on lm.customer_id = c.id
left join latest_entry le on le.customer_id = c.id;
-- (no "where c.status = 'active'" — that's the entire fix)
