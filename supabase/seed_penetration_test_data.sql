-- Adds 6 more customers, deliberately without a purchase in the last 30
-- days, so the new penetration widget has real non-buying customers to
-- show. Run AFTER seed_test_data.sql. Safe to re-run (ON CONFLICT guard
-- on customers; sales_entries for these customers use old, fixed dates
-- so duplicate rows are the only re-run risk — clear first if re-seeding).

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
  (1, 'C-1011', 'Villingili Trading',      'Kaafu Atoll',     'Villingili', 'Retail Store', '+960 781-1111', 'villingili.trading@example.mv', 16000, 30000),
  (2, 'C-1012', 'Guraidhoo Store',         'Kaafu Atoll',     'Guraidhoo',  'Mini Mart',    '+960 781-2222', 'guraidhoo.store@example.mv',    9000,  15000),
  (3, 'C-1013', 'Male Corner Shop',        'Kaafu Atoll',     'Male''',     'Mini Mart',    '+960 781-3333', 'malecorner@example.mv',         11000, 18000),
  (4, 'C-1014', 'Eydhafushi Corner Store', 'Baa Atoll',       'Eydhafushi','Mini Mart',    '+960 781-4444', 'eydhafushi.corner@example.mv',  8500,  14000),
  (5, 'C-1015', 'Rasdhoo Trading Co',      'Alif Alif Atoll', 'Rasdhoo',    'Retail Store', '+960 781-5555', 'rasdhoo.trading@example.mv',    13000, 22000),
  (6, 'C-1016', 'Hithadhoo Wholesale',     'Seenu Atoll',     'Hithadhoo',  'Retail Store', '+960 781-6666', 'hithadhoo.wholesale@example.mv',17500, 28000)
) as v(idx, customer_code, name, region, area, customer_type, phone, email, monthly_target, credit_limit)
on conflict (customer_code) do nothing;

-- Old sales only (outside the 30-day window) — these customers will
-- correctly show as "non-buying" once today's date has moved past them.
-- C-1011 (Villingili Trading) gets no entry at all: never purchased.
insert into sales_entries (customer_id, rep_id, entry_date, sale_amount, gp, portfolio_pct, outstanding_collected, visit_notes, next_visit_date)
select c.id, c.rep_id, current_date - v.days_ago,
  v.sale_amount, round(v.sale_amount * 0.18) as gp, v.portfolio_pct, 0,
  v.notes, (current_date - v.days_ago) + 14
from (values
  ('C-1012', 45, 1400, 50, 'Last order over a month ago'),
  ('C-1013', 60, 2100, 55, 'Hasn''t reordered in two months'),
  ('C-1014', 38, 900,  42, 'Slow-moving account'),
  ('C-1015', 50, 1700, 48, 'Overdue for a follow-up visit'),
  ('C-1016', 35, 3200, 60, 'Was a regular, has gone quiet')
) as v(customer_code, days_ago, sale_amount, portfolio_pct, notes)
join customers c on c.customer_code = v.customer_code;

-- Verification: shows the mix this creates, e.g. Kaafu Atoll should now
-- have a healthy blend of buying and non-buying customers to demo with.
select * from v_island_penetration;
