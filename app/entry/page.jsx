import { createClient } from "../../lib/supabaseServer";
import { redirect } from "next/navigation";
import EntryClient from "./EntryClient";

export default async function EntryPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const today = new Date().toISOString().slice(0, 10);

  // None of these depend on each other's results — only on user.id —
  // so run them together instead of one after another.
  const [profileRes, customersRes, todaysEntriesRes, atollsRes, skusRes] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    supabase.from("v_my_customers_today").select("*").eq("rep_id", user.id).order("name"),
    supabase.from("sales_entries").select("*, customers(name)").eq("rep_id", user.id).eq("entry_date", today).order("created_at", { ascending: false }),
    supabase.from("atolls_islands").select("atoll_name, island").order("atoll_name").order("is_capital", { ascending: false }).order("island"),
    supabase.from("skus").select("id, brand, category, sku").order("brand").order("sku"),
  ]);

  const profile = profileRes.data;
  if (profile?.role === "admin") redirect("/admin");

  return (
    <EntryClient
      profile={profile}
      customers={customersRes.data || []}
      todaysEntries={todaysEntriesRes.data || []}
      atolls={atollsRes.data || []}
      skus={skusRes.data || []}
    />
  );
}
