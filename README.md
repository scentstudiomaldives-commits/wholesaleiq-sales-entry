# STO General Trading — Wholesale Dashboard

Two logins, one database:
- **Reps** → `/entry` — a mobile-friendly form to log today's visits and sales, per customer. No dashboard access.
- **Admin (you)** → `/admin` — the full BI dashboard, with customer/sales data live from what reps enter, and SKU/portfolio/stock data still uploaded by you as CSV (same panel as before).

Everything below is doable from a browser — no local installs needed, matching your existing GitHub/Supabase/Vercel workflow.

---

## 1. Create the Supabase project

1. Go to [supabase.com](https://supabase.com) → New Project. Pick a name and password, wait ~2 min for it to provision.
2. In the left sidebar, go to **SQL Editor → New query**, paste the entire contents of `supabase/schema.sql`, and click **Run**. This creates the tables, security rules, and the views the dashboard reads from.
3. Go to **Project Settings → API**. Copy the **Project URL** and the **anon public key** — you'll need both in step 3.

## 2. Create logins for yourself and each rep

Supabase splits this into two steps: create the login, then tell the app who they are.

1. Go to **Authentication → Users → Add user** (use "Create new user", not invite-by-email unless you want to set up email sending). Set an email (e.g. `ahmed@sto.mv`) and a temporary password. Repeat for each sales rep.
2. Go to **Table Editor → profiles → Insert row** for each person you just created:
   - `id`: copy their **User UID** from the Authentication → Users list
   - `full_name`: their name
   - `role`: `admin` for you, `rep` for each sales rep
   - `region`: optional, just for reference

Give each rep their email + temporary password — ask them to change it after first login (Supabase handles this automatically if you enable it, or you can reset manually from the Users tab).

## 3. Add your customers

Two ways to get customers into the system:
- **Bulk**: Table Editor → `customers` → you can paste/import a CSV directly in Supabase Studio's table editor.
- **As you go**: reps can add new customers themselves from the entry screen ("+ Add New Customer").

Either way, make sure each customer has a `rep_id` set (the rep's User UID) so it shows up on the right person's entry screen.

## 4. Run it

**Editing/testing in the browser (GitHub Codespaces):** this repo includes a `.devcontainer/` config, so you can get a full VS Code + terminal in your browser with no local install:
1. On the repo's GitHub page, click **Code → Codespaces → Create codespace on main**. First launch takes a minute or two while it installs dependencies automatically.
2. Before running the app, add your Supabase keys as Codespaces secrets so they're available every time you open this repo, without ever being committed: GitHub → your profile → **Settings → Codespaces → Repository secrets → New secret**, add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` (same values from step 1.3), and grant access to this repo. Restart the codespace once for them to load.
3. In the Codespace's terminal: `npm run dev`. VS Code will pop up a "port 3000" notification — click it to preview the app in a browser tab, right inside Codespaces.
4. Edit files directly in the VS Code editor; the dev server hot-reloads as you save.

This is purely for editing/testing — deploying to reps still goes through Vercel as below, not the Codespace itself.

**Locally testing (optional, if you ever have a machine without restrictions):** copy `.env.local.example` to `.env.local`, fill in your Project URL and anon key, then `npm install && npm run dev`.

**Deploying (your usual flow):**
1. Push this folder to a new GitHub repo (GitHub's web uploader works fine, or the web-based editor you already use — or commit directly from the Codespace terminal with `git add -A && git commit -m "..." && git push`).
2. In Vercel, **New Project → Import** that repo.
3. In Vercel's project settings → Environment Variables, add:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   (same values from step 1.3)
4. Deploy. Vercel gives you a URL — that's what you share with reps for daily entry, and what you use yourself for `/admin`.

## 5. Invoice scanning (optional)

Reps can tap "Scan Invoice" in the entry app, photograph a paper invoice, and get the customer/items/totals pre-filled instead of typing everything by hand. They review and correct the results before anything saves — nothing goes into the database automatically without a rep confirming it first.

**Setup:**
1. Get an API key at [console.anthropic.com/settings/keys](https://console.anthropic.com/settings/keys) — this feature uses Claude Haiku 4.5 (fast + vision-capable, chosen partly to fit under Vercel's function time limits), and runs against your existing Anthropic account/credits rather than a separate OpenAI account
2. Add `ANTHROPIC_API_KEY` to your Vercel project's Environment Variables (same place as the Supabase keys)
3. Run `supabase/migration_004_invoice_parsing.sql` in the SQL Editor — adds invoice number/payment status to `sales_entries`, a new `sale_line_items` table for per-product detail, and a private Storage bucket to keep the scanned image on file
4. Redeploy

**Known limitations, worth knowing before rolling this out:**
- **Images only (PNG/JPG), not PDF.** Vision models read images, not raw PDF files, and rendering a PDF to an image reliably on Vercel's serverless functions needs native dependencies I didn't want to ship unverified. If a rep has a PDF invoice, they should photograph it instead.
- **Accuracy depends on photo quality.** Blurry or angled photos will produce incomplete or wrong reads — the review screen exists specifically so a rep always checks before it saves, and low-confidence reads come back with visible warnings.
- **Customer/product matching is exact-or-fuzzy text matching**, not fuzzy AI matching — if an invoice's customer or product name doesn't reasonably resemble what's in your database, the rep picks it manually from a dropdown rather than the system guessing.
- Unlike the earlier OpenAI version, I was able to reach `api.anthropic.com` directly from my environment and confirm the request shape (model, image encoding, headers) is valid — it returns a clean authentication error rather than a malformed-request error when tested with a fake key. What I still can't verify without a real key is actual read *accuracy* on a real invoice — validate that with a few real scans after deploying.

## What reps see vs what you see

| | Reps (`/entry`) | You (`/admin`) |
|---|---|---|
| Log a sale/visit | ✅ | — |
| Add a new customer | ✅ | — |
| See only their own customers | ✅ | sees all |
| Full BI dashboard | ❌ | ✅ |
| Upload SKU/stock CSV | ❌ | ✅ |

## Notes on the numbers

- **Customer sales, targets, portfolio %, visits, GP** on the dashboard are all live from `sales_entries` — no upload needed, updates the moment a rep saves an entry.
- **Monthly trend chart** is now real history (grouped by actual entry dates), not estimated.
- **Outstanding balance** is a simplified placeholder (`credit limit − this month's sales`) — if you want real accounts-receivable tracking, that needs a proper payments/invoices table, which I can add next.
- **SKU/Brand/Stock/Lost Opportunity pages** read from the `skus` and `warehouse_stock` tables — uploading a CSV replaces their contents, so it persists across logins/devices for any admin. Until you upload, these show demo figures that visibly change on every page load, so they're never mistaken for real data.

## Reasonable next steps, if useful
- A "forgot password" flow for reps (currently you'd reset manually via Supabase Studio)
- Push notifications / SMS reminder for reps with overdue visits
- A proper accounts-receivable table instead of the simplified outstanding-balance estimate
