import { createClient } from "../../lib/supabaseServer";
import { redirect } from "next/navigation";
import AdminDashboardClient from "./AdminDashboardClient";

export default async function AdminPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  if (profile?.role !== "admin") redirect("/entry");

  // Independent of each other — fetch together instead of one at a time.
  const [customerSnapshotRes, buyingStatusRes, monthlyTrendRes, skuRowsRes, stockRowsRes] = await Promise.all([
    supabase.from("v_customer_snapshot").select("*"),
    supabase.from("v_customer_buying_status").select("customer_code, is_buying, last_purchase_date"),
    supabase.from("v_monthly_trend").select("month, sales, gp").order("month_sort"),
    supabase.from("skus").select("*").order("uploaded_at", { ascending: false }),
    supabase.from("warehouse_stock").select("*").order("uploaded_at", { ascending: false }),
  ]);

  const monthlyTrend = monthlyTrendRes.data;
  const skuRows = skuRowsRes.data;
  const stockRows = stockRowsRes.data;

  // Merge buying status onto the customer snapshot by customer_code so
  // buildModel() can carry it through without a second data shape to thread.
  const buyingByCode = new Map((buyingStatusRes.data || []).map((r) => [r.customer_code, r]));
  const liveCustomerRows = (customerSnapshotRes.data || []).map((r) => ({
    ...r,
    is_buying: buyingByCode.get(r.customer_code)?.is_buying ?? false,
    last_purchase_date: buyingByCode.get(r.customer_code)?.last_purchase_date ?? null,
  }));

  return (
    <AdminDashboardClient
      profile={profile}
      liveCustomerRows={liveCustomerRows}
      liveTrendRows={monthlyTrend && monthlyTrend.length ? monthlyTrend : null}
      initialSkuRows={skuRows && skuRows.length ? skuRows : null}
      initialStockRows={stockRows && stockRows.length ? stockRows : null}
    />
  );
}
