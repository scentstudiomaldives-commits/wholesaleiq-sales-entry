import { createClient } from "../../lib/supabaseServer";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import AdminDashboardClient from "./AdminDashboardClient";

export default async function AdminPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  if (profile?.role !== "admin") redirect("/entry");

  // Independent of each other — fetch together instead of one at a time.
  // Note: raw customers + sales_entries (not the old pre-aggregated
  // "this month" view) so the Current Period selector can recompute
  // sales/GP/growth for any date range entirely client-side, with no
  // extra round-trip per period change.
  const [customersRes, salesEntriesRes, buyingStatusRes, monthlyTrendRes, skuRowsRes, stockRowsRes] = await Promise.all([
    supabase.from("customers").select("*, profiles(full_name)"),
    supabase.from("sales_entries").select("customer_id, entry_date, sale_amount, gp, portfolio_pct, next_visit_date"),
    supabase.from("v_customer_buying_status").select("customer_code, is_buying, last_purchase_date"),
    supabase.from("v_monthly_trend").select("month, sales, gp").order("month_sort"),
    supabase.from("skus").select("*").order("uploaded_at", { ascending: false }),
    supabase.from("warehouse_stock").select("*").order("uploaded_at", { ascending: false }),
  ]);

  const monthlyTrend = monthlyTrendRes.data;
  const skuRows = skuRowsRes.data;
  const stockRows = stockRowsRes.data;

  return (
    <Suspense fallback={<div style={{ minHeight: "100vh", background: "#F4F7FB" }} />}>
      <AdminDashboardClient
        profile={profile}
        rawCustomers={customersRes.data || []}
        rawSalesEntries={salesEntriesRes.data || []}
        buyingStatusRows={buyingStatusRes.data || []}
        liveTrendRows={monthlyTrend && monthlyTrend.length ? monthlyTrend : null}
        initialSkuRows={skuRows && skuRows.length ? skuRows : null}
        initialStockRows={stockRows && stockRows.length ? stockRows : null}
      />
    </Suspense>
  );
}
