# WholesaleIQ — Sales Entry App

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

**Locally testing (optional):** copy `.env.local.example` to `.env.local`, fill in your Project URL and anon key, then `npm install && npm run dev`.

**Deploying (your usual flow):**
1. Push this folder to a new GitHub repo (GitHub's web uploader works fine, or the web-based editor you already use).
2. In Vercel, **New Project → Import** that repo.
3. In Vercel's project settings → Environment Variables, add:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   (same values from step 1.3)
4. Deploy. Vercel gives you a URL — that's what you share with reps for daily entry, and what you use yourself for `/admin`.

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
