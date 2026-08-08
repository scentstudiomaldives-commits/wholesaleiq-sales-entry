-- Run in Supabase SQL Editor. Adds two views:
--   v_customer_buying_status  — per-customer: did they buy in the last 30 days?
--   v_island_penetration      — per island/region: buying vs non-buying counts + rate
--
-- "Buying" here means an actual sale (sale_amount > 0) logged in the last
-- 30 days — deliberately stricter than the dashboard's existing "active"
-- concept, which counts any logged visit even with no sale (a rep can log
-- "No sale today"). This is a separate, more precise metric on purpose.

create or replace view v_customer_buying_status as
select
  c.id as customer_id,
  c.customer_code,
  c.name,
  c.region,
  c.area,
  c.rep_id,
  (select max(se.entry_date) from sales_entries se where se.customer_id = c.id and se.sale_amount > 0) as last_purchase_date,
  exists (
    select 1 from sales_entries se
    where se.customer_id = c.id
      and se.sale_amount > 0
      and se.entry_date >= current_date - interval '30 days'
  ) as is_buying
from customers c
where c.status = 'active';

create or replace view v_island_penetration as
select
  region,
  area,
  count(*) as total_customers,
  count(*) filter (where is_buying) as buying_customers,
  count(*) filter (where not is_buying) as non_buying_customers,
  round(100.0 * count(*) filter (where is_buying) / nullif(count(*), 0), 1) as penetration_rate_pct
from v_customer_buying_status
group by region, area
order by region, area;

create or replace view v_region_penetration as
select
  region,
  count(*) as total_customers,
  count(*) filter (where is_buying) as buying_customers,
  count(*) filter (where not is_buying) as non_buying_customers,
  round(100.0 * count(*) filter (where is_buying) / nullif(count(*), 0), 1) as penetration_rate_pct
from v_customer_buying_status
group by region
order by region;
