-- Clears customers, sales entries, and customer stock checklists.
-- Keeps: skus (products/brands), warehouse_stock, profiles (logins),
-- atolls_islands (reference data).
--
-- Run in Supabase SQL Editor. Order matters — customer_sku_stock and
-- sales_entries both reference customers, so they're cleared first.

delete from customer_sku_stock;
delete from sales_entries;
delete from customers;

-- Quick confirmation of what's left:
select
  (select count(*) from customers) as customers,
  (select count(*) from sales_entries) as sales_entries,
  (select count(*) from customer_sku_stock) as customer_sku_stock,
  (select count(*) from skus) as skus_kept,
  (select count(*) from warehouse_stock) as warehouse_stock_kept,
  (select count(*) from profiles) as profiles_kept;
