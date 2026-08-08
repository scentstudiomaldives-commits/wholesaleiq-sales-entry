-- ============================================================
-- WholesaleIQ — Test Data Seed Script
-- Run once in Supabase SQL Editor. See notes above each section
-- for how this maps to (and extends) your live schema.
-- Safe to re-run: customers and customer_sku_stock use ON CONFLICT
-- guards. skus, warehouse_stock, and sales_entries do NOT have a
-- natural unique key in your schema, so re-running duplicates
-- those three — clear them first if you re-run this.
-- ============================================================

-- 0. SCHEMA EXTENSIONS — your live tables don't have these yet;
--    added here so contact details / product codes / cost price
--    can actually be stored, not just seeded and lost.
alter table customers add column if not exists phone text;
alter table customers add column if not exists email text;
alter table skus add column if not exists product_code text;
alter table skus add column if not exists cost_price numeric;

-- 1. CUSTOMERS (10 across different atolls/business types) --------
insert into customers (customer_code, name, region, area, customer_type, phone, email, rep_id, monthly_target, credit_limit, status)
select v.customer_code, v.name, v.region, v.area, v.customer_type, v.phone, v.email,
  case when (select count(*) from profiles where role = 'rep') > 0
    then (
      select id from (
        select id, row_number() over (order by created_at) as rn
        from profiles where role = 'rep'
      ) reps
      where rn = ((v.idx - 1) % (select count(*) from profiles where role = 'rep')) + 1
    )
    else null
  end,
  v.monthly_target, v.credit_limit, 'active'
from (values
  (1, 'C-1001', 'Sunrise Supermarket',    'Kaafu Atoll',       'Hulhumale''', 'Supermarket',     '+960 771-2345', 'sunrise.hulhumale@example.mv',   45000, 80000),
  (2, 'C-1002', 'Lagoon Trading',         'Baa Atoll',         'Eydhafushi',  'Retail Store',    '+960 772-3456', 'lagoon.eydhafushi@example.mv',   28000, 50000),
  (3, 'C-1003', 'Blue Horizon Hotel',     'Kaafu Atoll',       'Male''',      'Hotel',           '+960 773-4567', 'procurement@bluehorizon.mv',     62000,120000),
  (4, 'C-1004', 'Fonadhoo General Store', 'Laamu Atoll',       'Fonadhoo',    'Retail Store',    '+960 774-5678', 'fonadhoo.general@example.mv',    19000, 35000),
  (5, 'C-1005', 'Addu City Mart',         'Seenu Atoll',       'Hithadhoo',   'Supermarket',     '+960 775-6789', 'addumart@example.mv',            38000, 65000),
  (6, 'C-1006', 'Rasdhoo Reef Cafe',      'Alif Alif Atoll',   'Rasdhoo',     'Cafe/Restaurant', '+960 776-7890', 'rasdhoocafe@example.mv',         15000, 25000),
  (7, 'C-1007', 'Manadhoo Wholesale',     'Noonu Atoll',       'Manadhoo',    'Retail Store',    '+960 777-8901', 'manadhoo.wholesale@example.mv',  24000, 45000),
  (8, 'C-1008', 'Palm Resort Maldives',   'Alif Dhaal Atoll',  'Mahibadhoo',  'Hotel',           '+960 778-9012', 'purchasing@palmresort.mv',       71000,150000),
  (9, 'C-1009', 'Naifaru Mini Mart',      'Lhaviyani Atoll',   'Naifaru',     'Mini Mart',       '+960 779-0123', 'naifaru.mart@example.mv',        12000, 20000),
  (10,'C-1010', 'Thinadhoo Traders',      'Gaafu Dhaalu Atoll','Thinadhoo',   'Retail Store',    '+960 770-1234', 'thinadhoo.traders@example.mv',   21000, 40000)
) as v(idx, customer_code, name, region, area, customer_type, phone, email, monthly_target, credit_limit)
on conflict (customer_code) do nothing;

-- 2. BRANDS & SKUs (3 brands, 15 products — real names/brands from
--    FMCG_LIST_IMPORT_FORMAT.xlsx; pricing/stock figures below are still
--    illustrative test data, not real prices) --------------------------
insert into skus (brand, category, product_code, sku, required_customers, available_customers, facing, shelf_share_pct, competitor_present, days_since_purchase, monthly_sales, gp_pct, prior_month_sales, avg_unit_value, cost_price)
select v.brand, v.category, v.product_code, v.sku,
  (select count(*) from customers) as required_customers,
  round((select count(*) from customers) * v.avail_ratio) as available_customers,
  v.facing, v.shelf_share_pct, v.competitor_present, v.days_since_purchase,
  v.monthly_sales,
  round(((v.unit_price - v.cost_price) / v.unit_price) * 100, 1) as gp_pct,
  v.prior_month_sales, v.unit_price, v.cost_price
from (values
  -- Campa / Juices
  ('Campa', 'Juices', 'CMP-001', 'CAMPA APPLE JUICE 100% 250ML',            0.90, 3, 22, true,  3, 24500, 22800, 28.00, 21.00),
  ('Campa', 'Juices', 'CMP-002', 'CAMPA ORANGE JUICE 100% 250ML',           0.75, 2, 16, true,  5, 18200, 17100, 26.00, 19.50),
  ('Campa', 'Tea & Coffee', 'CMP-003', 'CAMPA ICED TEA FORREST BERRIES 250ML', 0.85, 3, 14, false, 2, 12800, 12000, 14.00, 10.00),
  ('Campa', 'Juices', 'CMP-004', 'CAMPA BLOOD ORANGE JUICE DRINK 25% 250ML',0.60, 2, 11, true,  6,  9600,  9100, 12.00,  8.50),
  ('Campa', 'Juices', 'CMP-005', 'CAMPA SOUR CHERRY NECTAR 30% 250ML',      0.95, 4, 28, false, 1, 15400, 14200,  8.00,  5.50),
  -- QUICKBURY / Biscuits & Chocolates
  ('QUICKBURY', 'Biscuits', 'QBY-001', 'QUICKBURY BROWNIE CHOCO 285G',            0.70, 2, 19, true,  4, 16800, 15500, 18.00, 12.50),
  ('QUICKBURY', 'Biscuits', 'QBY-002', 'QUICKBURY COOKIE ALMOND 130G',            0.55, 2, 13, false, 7, 10200,  9800, 22.00, 16.00),
  ('QUICKBURY', 'Chocolates', 'QBY-003', 'QUICKBURY CHOCOLATE HAZELNUT S/F 75G',  0.80, 3, 24, true,  2, 13600, 12100,  9.00,  6.00),
  ('QUICKBURY', 'Biscuits', 'QBY-004', 'QUICKBURY COOKIE COCONUT 150G/130G',      0.45, 1,  9, false, 9,  7100,  6900, 15.00, 10.50),
  ('QUICKBURY', 'Biscuits', 'QBY-005', 'QUICKBURY COOKIES SALTED CARAMEL 128G',   0.65, 2, 17, true,  5, 11900, 11000, 20.00, 14.00),
  -- HUGGIES / Diapers & Wipes
  ('HUGGIES', 'Diapers', 'HUG-001', 'HUGGIES DIAPERS MEDIUM 60''S',       0.50, 1, 12, true,  8, 19800, 18200, 45.00, 32.00),
  ('HUGGIES', 'Diapers', 'HUG-002', 'HUGGIES DIAPERS LARGE 52''S',        0.88, 4, 26, false, 3, 14100, 13400, 12.00,  8.00),
  ('HUGGIES', 'Diapers', 'HUG-003', 'HUGGIES DRY PANTS M 58''S',          0.62, 2, 15, true,  6, 12700, 11900, 24.00, 17.00),
  ('HUGGIES', 'Wipes',   'HUG-004', 'HUGGIES WIPES CLEAN CARE 80''S',     0.35, 1,  7, false,11,  8200,  8000, 38.00, 27.00),
  ('HUGGIES', 'Diapers', 'HUG-005', 'HUGGIES WONDER PANTS LARGE 42''S',   0.58, 2, 14, true,  4, 10500,  9700, 16.00, 11.00)
) as v(brand, category, product_code, sku, avail_ratio, facing, shelf_share_pct, competitor_present, days_since_purchase, monthly_sales, prior_month_sales, unit_price, cost_price);

-- 3. WAREHOUSE STOCK (brand-level, matching your live schema) -----
insert into warehouse_stock (brand, stock_units, days_of_cover, out_of_stock, low_stock, near_expiry)
values
  ('Campa',     8500, 18, 1, 3, 2),
  ('QUICKBURY', 6200, 25, 0, 2, 1),
  ('HUGGIES',   4100, 30, 2, 4, 0);

-- 4. SALES ENTRIES (28 visits, spanning the last 1–58 days) --------
insert into sales_entries (customer_id, rep_id, entry_date, sale_amount, gp, portfolio_pct, outstanding_collected, visit_notes, next_visit_date)
select c.id, c.rep_id, current_date - v.days_ago,
  v.sale_amount, round(v.sale_amount * 0.18) as gp, v.portfolio_pct, v.outstanding_collected,
  nullif(v.notes, ''), (current_date - v.days_ago) + 10
from (values
  ('C-1001', 2,  5200, 88, 0,    'Restocked cola and water'),
  ('C-1001', 16, 4800, 85, 1200, 'Partial payment collected'),
  ('C-1001', 30, 6100, 90, 0,    'Good sales this visit'),
  ('C-1002', 5,  2100, 62, 0,    'Requested new snack line'),
  ('C-1002', 20, 1800, 58, 500,  ''),
  ('C-1003', 1,  9800, 95, 0,    'Large hotel order, all lines'),
  ('C-1003', 10,11200, 96, 3000, 'Settled part of outstanding'),
  ('C-1003', 24, 8700, 93, 0,    ''),
  ('C-1003', 45, 9400, 91, 0,    'Steady demand'),
  ('C-1004', 8,  1200, 45, 0,    'Small order, slow week'),
  ('C-1004', 38, 1500, 48, 300,  ''),
  ('C-1005', 3,  4300, 80, 0,    'Added iced tea to order'),
  ('C-1005', 19, 3900, 78, 800,  ''),
  ('C-1005', 50, 4600, 82, 0,    'Consistent customer'),
  ('C-1006', 7,   950, 40, 0,    'Cafe order, mostly drinks'),
  ('C-1006', 33, 1100, 42, 0,    ''),
  ('C-1007', 4,  2600, 65, 0,    'New crackers stocked'),
  ('C-1007', 21, 2300, 60, 600,  ''),
  ('C-1007', 55, 2900, 68, 0,    ''),
  ('C-1008', 2, 12500, 92, 0,    'Resort restock, full range'),
  ('C-1008', 14,13100, 94, 5000, 'Large payment collected'),
  ('C-1008', 28,11800, 90, 0,    ''),
  ('C-1008', 42,12200, 93, 0,    'Repeat large order'),
  ('C-1009', 9,   700, 35, 0,    'Mini mart, limited space'),
  ('C-1009', 40,  850, 38, 0,    ''),
  ('C-1010', 6,  2200, 55, 0,    'Sanitizer running low, restocked'),
  ('C-1010', 25, 2000, 52, 400,  ''),
  ('C-1010', 58, 2400, 58, 0,    'End of period order')
) as v(customer_code, days_ago, sale_amount, portfolio_pct, outstanding_collected, notes)
join customers c on c.customer_code = v.customer_code;

-- 5. CUSTOMER SKU STOCK CHECKLISTS (what each customer carries) ----
insert into customer_sku_stock (customer_id, sku_id, in_stock, updated_by, updated_at)
select c.id, s.id, true, c.rep_id, now()
from (values
  ('C-1001','CMP-001'),('C-1001','CMP-002'),('C-1001','CMP-003'),('C-1001','CMP-005'),
  ('C-1001','QBY-001'),('C-1001','QBY-002'),('C-1001','QBY-005'),('C-1001','HUG-001'),('C-1001','HUG-003'),
  ('C-1002','CMP-001'),('C-1002','CMP-004'),('C-1002','QBY-001'),('C-1002','QBY-003'),('C-1002','HUG-002'),
  ('C-1003','CMP-001'),('C-1003','CMP-002'),('C-1003','CMP-003'),('C-1003','CMP-004'),('C-1003','CMP-005'),
  ('C-1003','QBY-001'),('C-1003','QBY-002'),('C-1003','QBY-003'),('C-1003','QBY-004'),('C-1003','QBY-005'),
  ('C-1003','HUG-001'),('C-1003','HUG-002'),('C-1003','HUG-003'),('C-1003','HUG-004'),('C-1003','HUG-005'),
  ('C-1004','CMP-003'),('C-1004','CMP-005'),('C-1004','QBY-003'),('C-1004','HUG-002'),
  ('C-1005','CMP-001'),('C-1005','CMP-002'),('C-1005','CMP-004'),('C-1005','QBY-001'),
  ('C-1005','QBY-004'),('C-1005','HUG-001'),('C-1005','HUG-003'),('C-1005','HUG-005'),
  ('C-1006','CMP-003'),('C-1006','CMP-004'),('C-1006','CMP-005'),('C-1006','QBY-005'),
  ('C-1007','CMP-001'),('C-1007','CMP-003'),('C-1007','QBY-002'),('C-1007','QBY-004'),
  ('C-1007','HUG-002'),('C-1007','HUG-004'),
  ('C-1008','CMP-001'),('C-1008','CMP-002'),('C-1008','CMP-003'),('C-1008','CMP-004'),('C-1008','CMP-005'),
  ('C-1008','QBY-001'),('C-1008','QBY-002'),('C-1008','QBY-003'),
  ('C-1008','HUG-001'),('C-1008','HUG-002'),('C-1008','HUG-003'),('C-1008','HUG-004'),
  ('C-1009','CMP-003'),('C-1009','CMP-005'),('C-1009','QBY-003'),
  ('C-1010','CMP-001'),('C-1010','CMP-004'),('C-1010','QBY-002'),('C-1010','QBY-005'),
  ('C-1010','HUG-002'),('C-1010','HUG-005')
) as v(customer_code, sku_code)
join customers c on c.customer_code = v.customer_code
join skus s on s.product_code = v.sku_code
on conflict (customer_id, sku_id) do update set in_stock = excluded.in_stock, updated_at = excluded.updated_at;

-- 6. VERIFICATION ---------------------------------------------------
select
  (select count(*) from customers)          as customers,
  (select count(*) from skus)               as skus,
  (select count(distinct brand) from skus)  as brands,
  (select count(*) from warehouse_stock)    as warehouse_stock_rows,
  (select count(*) from sales_entries)      as sales_entries,
  (select count(*) from customer_sku_stock) as customer_sku_stock_rows,
  (select count(*) from profiles where role = 'rep') as reps_available;
