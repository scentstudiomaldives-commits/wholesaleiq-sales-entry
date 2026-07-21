import { createClient } from "../../lib/supabaseServer";
import { redirect } from "next/navigation";
import AdminDashboardClient from "./AdminDashboardClient";

export default async function AdminPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  if (profile?.role !== "admin") redirect("/entry");

  const { data: customerSnapshot } = await supabase.from("v_customer_snapshot").select("*");
  const { data: monthlyTrend } = await supabase.from("v_monthly_trend").select("month, sales, gp").order("month_sort");

  return (
    <AdminDashboardClient
      profile={profile}
      liveCustomerRows={customerSnapshot || []}
      liveTrendRows={monthlyTrend && monthlyTrend.length ? monthlyTrend : null}
    />
  );
}
