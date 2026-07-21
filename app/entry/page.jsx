import { createClient } from "../../lib/supabaseServer";
import { redirect } from "next/navigation";
import EntryClient from "./EntryClient";

export default async function EntryPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();

  const { data: customers } = await supabase
    .from("v_my_customers_today")
    .select("*")
    .eq("rep_id", user.id)
    .order("name");

  const { data: todaysEntries } = await supabase
    .from("sales_entries")
    .select("*, customers(name)")
    .eq("rep_id", user.id)
    .eq("entry_date", new Date().toISOString().slice(0, 10))
    .order("created_at", { ascending: false });

  return <EntryClient profile={profile} customers={customers || []} todaysEntries={todaysEntries || []} />;
}
