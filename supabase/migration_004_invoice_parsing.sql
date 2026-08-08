-- Run in Supabase SQL Editor. Adds what's needed for invoice OCR/AI
-- extraction: invoice metadata on sales_entries, a proper line-items
-- table (your schema had no per-SKU sale detail before this), and a
-- private Storage bucket to keep the uploaded invoice image for review.

-- 1. Invoice metadata on sales_entries ------------------------------
alter table sales_entries add column if not exists invoice_number text;
alter table sales_entries add column if not exists payment_status text
  default 'paid' check (payment_status in ('paid', 'pending', 'partial'));
alter table sales_entries add column if not exists invoice_image_path text; -- Storage object path, for the review UI / audit trail

-- 2. Line items — one row per SKU on an invoice ----------------------
create table if not exists sale_line_items (
  id uuid primary key default gen_random_uuid(),
  sales_entry_id uuid references sales_entries(id) on delete cascade not null,
  sku_id uuid references skus(id),
  sku_code_raw text,        -- what the AI actually read, even if it didn't match a real SKU
  quantity numeric not null default 1,
  unit_price numeric not null default 0,
  line_total numeric not null default 0,
  created_at timestamptz default now()
);
create index if not exists idx_sale_line_items_entry on sale_line_items(sales_entry_id);

alter table sale_line_items enable row level security;
drop policy if exists "sale_line_items_select" on sale_line_items;
create policy "sale_line_items_select" on sale_line_items for select
  using (exists (select 1 from sales_entries se where se.id = sales_entry_id and (se.rep_id = auth.uid() or is_admin())));
drop policy if exists "sale_line_items_insert" on sale_line_items;
create policy "sale_line_items_insert" on sale_line_items for insert
  with check (exists (select 1 from sales_entries se where se.id = sales_entry_id and se.rep_id = auth.uid()));

-- 3. Storage bucket for invoice images -------------------------------
insert into storage.buckets (id, name, public)
values ('invoices', 'invoices', false)
on conflict (id) do nothing;

-- Reps can upload/read their own invoice images (path convention:
-- invoices/{rep_id}/{filename}); admins can read all.
drop policy if exists "invoices_rep_upload" on storage.objects;
create policy "invoices_rep_upload" on storage.objects for insert
  with check (bucket_id = 'invoices' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "invoices_rep_read_own" on storage.objects;
create policy "invoices_rep_read_own" on storage.objects for select
  using (bucket_id = 'invoices' and ((storage.foldername(name))[1] = auth.uid()::text or is_admin()));
