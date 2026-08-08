-- Prevents the same invoice from being recorded twice for the same
-- customer — a database-level guarantee, not just a UI safeguard, so it
-- also protects against duplicate submissions across different devices
-- or sessions, not only a double-tap on one screen.
--
-- Partial index (only applies when invoice_number is set) because plain
-- visit entries — the normal, non-scanned flow — don't use invoice_number
-- at all and shouldn't be constrained by this.
create unique index if not exists idx_unique_invoice_per_customer
  on sales_entries (customer_id, invoice_number)
  where invoice_number is not null;
