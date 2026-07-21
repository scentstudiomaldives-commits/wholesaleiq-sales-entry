"use client";
import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../lib/supabaseClient";

const C = {
  navy: "#0B2E52", blue: "#1F6FEB", blueSoft: "#E8F0FE", green: "#0F9D63", greenSoft: "#E4F7EF",
  amber: "#C9821C", amberSoft: "#FBF0DF", red: "#D5433C", redSoft: "#FBE7E6",
  line: "#E4EAF2", text: "#0B2036", muted: "#8B99AC", surface: "#FFFFFF",
};

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr); const today = new Date();
  d.setHours(0,0,0,0); today.setHours(0,0,0,0);
  return Math.round((d - today) / 86400000);
}

export default function EntryClient({ profile, customers, todaysEntries, atolls, skus }) {
  const router = useRouter();
  const supabase = createClient();
  const [selected, setSelected] = useState(null);
  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");
  const [loadingChecklist, setLoadingChecklist] = useState(false);
  const [hadSale, setHadSale] = useState(null); // null = not answered yet, true/false once picked
  const [stockChecks, setStockChecks] = useState({}); // { [sku_id]: boolean }

  const atollNames = [...new Set((atolls || []).map((a) => a.atoll_name))];
  const islandsByAtoll = (atolls || []).reduce((acc, a) => {
    acc[a.atoll_name] = acc[a.atoll_name] || [];
    acc[a.atoll_name].push(a.island);
    return acc;
  }, {});

  const skusByBrand = (skus || []).reduce((acc, s) => {
    acc[s.brand] = acc[s.brand] || [];
    acc[s.brand].push(s);
    return acc;
  }, {});

  const [form, setForm] = useState({ sale_amount: "", gp: "", outstanding_collected: "", visit_notes: "", next_visit_date: "" });
  const [newCust, setNewCust] = useState({ name: "", region: "", area: "", customer_type: "Mini Mart", monthly_target: "", credit_limit: "" });

  const loggedIds = new Set(todaysEntries.map((e) => e.customer_id));

  const sorted = useMemo(() => {
    return [...customers].sort((a, b) => {
      const da = daysUntil(a.next_visit_date) ?? 999;
      const db = daysUntil(b.next_visit_date) ?? 999;
      return da - db;
    });
  }, [customers]);

  const todayTotal = todaysEntries.reduce((s, e) => s + Number(e.sale_amount || 0), 0);

  const openEntry = async (customer) => {
    setSelected(customer);
    setHadSale(null);
    setForm({ sale_amount: "", gp: "", outstanding_collected: "", visit_notes: "", next_visit_date: "" });
    setStockChecks({});
    setLoadingChecklist(true);
    const { data } = await supabase.from("customer_sku_stock").select("sku_id, in_stock").eq("customer_id", customer.id);
    const checks = {};
    (data || []).forEach((r) => { checks[r.sku_id] = r.in_stock; });
    setStockChecks(checks);
    setLoadingChecklist(false);
  };

  const toggleSku = (skuId) => setStockChecks((prev) => ({ ...prev, [skuId]: !prev[skuId] }));

  const submitEntry = async (e) => {
    e.preventDefault();
    setSaving(true);
    const totalSkus = (skus || []).length;
    const checkedCount = Object.values(stockChecks).filter(Boolean).length;
    const portfolioPct = totalSkus ? Math.round((checkedCount / totalSkus) * 100) : null;

    const { error } = await supabase.from("sales_entries").insert({
      customer_id: selected.id,
      rep_id: profile.id,
      sale_amount: hadSale ? Number(form.sale_amount) || 0 : 0,
      gp: hadSale ? Number(form.gp) || 0 : 0,
      portfolio_pct: portfolioPct,
      outstanding_collected: Number(form.outstanding_collected) || 0,
      visit_notes: form.visit_notes || null,
      next_visit_date: form.next_visit_date || null,
    });
    if (error) { setSaving(false); setToast("Could not save — check your connection and try again."); return; }

    if ((skus || []).length) {
      const stockRows = skus.map((s) => ({
        customer_id: selected.id, sku_id: s.id, in_stock: !!stockChecks[s.id],
        updated_by: profile.id, updated_at: new Date().toISOString(),
      }));
      const { error: stockErr } = await supabase.from("customer_sku_stock").upsert(stockRows, { onConflict: "customer_id,sku_id" });
      if (stockErr) { setSaving(false); setToast("Visit saved, but the stock checklist didn't save — try re-opening this customer."); setSelected(null); router.refresh(); setTimeout(() => setToast(""), 3500); return; }
    }

    setSaving(false);
    setToast(`Saved: ${selected.name}`);
    setSelected(null);
    router.refresh();
    setTimeout(() => setToast(""), 2500);
  };

  const submitNewCustomer = async (e) => {
    e.preventDefault();
    setSaving(true);
    const { error } = await supabase.from("customers").insert({
      name: newCust.name, region: newCust.region, area: newCust.area,
      customer_type: newCust.customer_type, rep_id: profile.id,
      monthly_target: Number(newCust.monthly_target) || 0,
      credit_limit: Number(newCust.credit_limit) || 0,
    });
    setSaving(false);
    if (error) { setToast("Could not add customer."); return; }
    setToast(`Added: ${newCust.name}`);
    setShowNewCustomer(false);
    setNewCust({ name: "", region: "", area: "", customer_type: "Mini Mart", monthly_target: "", credit_limit: "" });
    router.refresh();
    setTimeout(() => setToast(""), 2500);
  };

  const signOut = async () => { await supabase.auth.signOut(); router.push("/login"); router.refresh(); };

  return (
    <div style={{ minHeight: "100vh", background: "#F4F7FB", paddingBottom: 40 }}>
      {/* Header */}
      <div style={{ background: C.navy, padding: "16px 18px", display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", top: 0, zIndex: 10 }}>
        <div>
          <div style={{ color: "#fff", fontFamily: "Manrope", fontWeight: 800, fontSize: 15 }}>{profile.full_name}</div>
          <div style={{ color: "#8FA8C4", fontSize: 11 }}>{new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short" })}</div>
        </div>
        <button onClick={signOut} style={{ background: "rgba(255,255,255,0.1)", border: "none", color: "#fff", fontSize: 12, fontWeight: 600, padding: "8px 12px", borderRadius: 8, cursor: "pointer" }}>Sign out</button>
      </div>

      {/* Today summary */}
      <div style={{ display: "flex", gap: 10, padding: "14px 16px 4px" }}>
        <div style={{ flex: 1, background: C.surface, borderRadius: 12, border: `1px solid ${C.line}`, padding: "12px 14px" }}>
          <div style={{ fontSize: 10.5, color: C.muted, fontWeight: 700 }}>VISITS TODAY</div>
          <div style={{ fontFamily: "Manrope", fontWeight: 800, fontSize: 20, color: C.text }}>{todaysEntries.length}</div>
        </div>
        <div style={{ flex: 1, background: C.surface, borderRadius: 12, border: `1px solid ${C.line}`, padding: "12px 14px" }}>
          <div style={{ fontSize: 10.5, color: C.muted, fontWeight: 700 }}>SALES TODAY</div>
          <div style={{ fontFamily: "Manrope", fontWeight: 800, fontSize: 20, color: C.green }}>MVR {Math.round(todayTotal).toLocaleString()}</div>
        </div>
      </div>

      {/* Add customer button */}
      <div style={{ padding: "10px 16px" }}>
        <button onClick={() => setShowNewCustomer(true)} style={{ width: "100%", padding: "11px", borderRadius: 10, border: `1.5px dashed ${C.blue}`, background: C.blueSoft, color: C.blue, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
          + Add New Customer
        </button>
      </div>

      {/* Customer list */}
      <div style={{ padding: "6px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
        {sorted.map((c) => {
          const due = daysUntil(c.next_visit_date);
          const logged = loggedIds.has(c.id);
          const tone = logged ? "logged" : due !== null && due <= 0 ? "due" : due !== null && due <= 2 ? "soon" : "ok";
          const toneStyle = {
            logged: { bg: C.greenSoft, fg: C.green, label: "Logged today" },
            due: { bg: C.redSoft, fg: C.red, label: due === 0 ? "Due today" : `Overdue ${Math.abs(due)}d` },
            soon: { bg: C.amberSoft, fg: C.amber, label: `Due in ${due}d` },
            ok: { bg: "#F4F7FB", fg: C.muted, label: c.next_visit_date ? `Due in ${due}d` : "No visit scheduled" },
          }[tone];
          return (
            <div key={c.id} onClick={() => !logged && openEntry(c)} style={{ background: C.surface, border: `1px solid ${C.line}`, borderRadius: 12, padding: "13px 15px", display: "flex", justifyContent: "space-between", alignItems: "center", cursor: logged ? "default" : "pointer", opacity: logged ? 0.7 : 1 }}>
              <div>
                <div style={{ fontFamily: "Manrope", fontWeight: 700, fontSize: 13.5, color: C.text }}>{c.name}</div>
                <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{c.area}, {c.region} · {c.customer_type}</div>
              </div>
              <span style={{ fontSize: 11, fontWeight: 700, color: toneStyle.fg, background: toneStyle.bg, padding: "4px 9px", borderRadius: 999, whiteSpace: "nowrap" }}>{toneStyle.label}</span>
            </div>
          );
        })}
        {!sorted.length && <div style={{ fontSize: 13, color: C.muted, textAlign: "center", padding: "30px 0" }}>No customers assigned yet. Add your first one above.</div>}
      </div>

      {/* Entry modal */}
      {selected && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(11,32,54,0.4)", display: "flex", alignItems: "flex-end", zIndex: 20 }} onClick={() => setSelected(null)}>
          <form onClick={(e) => e.stopPropagation()} onSubmit={submitEntry} style={{ background: "#fff", width: "100%", maxHeight: "88vh", overflowY: "auto", borderRadius: "18px 18px 0 0", padding: "20px 20px calc(28px + env(safe-area-inset-bottom))" }}>
            <div style={{ fontFamily: "Manrope", fontWeight: 800, fontSize: 16, color: C.text, marginBottom: 2 }}>{selected.name}</div>
            <div style={{ fontSize: 11.5, color: C.muted, marginBottom: 18 }}>{selected.area}, {selected.region}</div>

            <label style={{ fontSize: 12, fontWeight: 700, color: C.text, display: "block", marginBottom: 6 }}>Did they buy anything today?</label>
            <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
              <button
                type="button"
                onClick={() => setHadSale(true)}
                style={{ flex: 1, padding: 12, borderRadius: 10, border: `1.5px solid ${hadSale === true ? C.green : C.line}`, background: hadSale === true ? C.greenSoft : "#fff", color: hadSale === true ? C.green : C.text, fontWeight: 700, fontSize: 14 }}
              >
                Yes, they bought
              </button>
              <button
                type="button"
                onClick={() => setHadSale(false)}
                style={{ flex: 1, padding: 12, borderRadius: 10, border: `1.5px solid ${hadSale === false ? C.muted : C.line}`, background: hadSale === false ? C.line : "#fff", color: C.text, fontWeight: 700, fontSize: 14 }}
              >
                No sale today
              </button>
            </div>

            {hadSale === true && (
              <div style={{ borderLeft: `3px solid ${C.greenSoft}`, paddingLeft: 12 }}>
                <Field label="Sale amount (MVR)" type="number" required value={form.sale_amount} onChange={(v) => setForm({ ...form, sale_amount: v })} />
                <Field label="Gross profit (MVR)" type="number" value={form.gp} onChange={(v) => setForm({ ...form, gp: v })} />
              </div>
            )}

            <Field label="Outstanding collected (MVR)" type="number" value={form.outstanding_collected} onChange={(v) => setForm({ ...form, outstanding_collected: v })} />
            <Field label="Next follow-up date" type="date" value={form.next_visit_date} onChange={(v) => setForm({ ...form, next_visit_date: v })} />
            <label style={{ fontSize: 12, fontWeight: 700, color: C.text, display: "block", marginBottom: 6, marginTop: 4 }}>Visit notes</label>
            <textarea rows={2} value={form.visit_notes} onChange={(e) => setForm({ ...form, visit_notes: e.target.value })} style={{ width: "100%", padding: "10px 12px", borderRadius: 9, border: `1px solid ${C.line}`, fontSize: 16, fontFamily: "Inter", marginBottom: 18, resize: "none" }} />

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6, marginBottom: 2 }}>
              <span style={{ fontFamily: "Manrope", fontWeight: 800, fontSize: 13.5, color: C.text }}>Items customer currently stocks</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: C.blue, background: C.blueSoft, padding: "3px 9px", borderRadius: 999 }}>
                {Object.values(stockChecks).filter(Boolean).length} / {(skus || []).length}
                {(skus || []).length ? ` (${Math.round((Object.values(stockChecks).filter(Boolean).length / skus.length) * 100)}%)` : ""}
              </span>
            </div>
            <div style={{ fontSize: 11, color: C.muted, marginBottom: 10 }}>Tick everything you can see on their shelf right now — this replaces typing in a portfolio %.</div>

            {loadingChecklist && <div style={{ fontSize: 12, color: C.muted, padding: "10px 0" }}>Loading checklist…</div>}
            {!loadingChecklist && Object.entries(skusByBrand).map(([brand, brandSkus]) => {
              const checkedInBrand = brandSkus.filter((s) => stockChecks[s.id]).length;
              return (
                <div key={brand} style={{ border: `1px solid ${C.line}`, borderRadius: 12, overflow: "hidden", marginBottom: 12 }}>
                  <div style={{ background: "#F4F7FB", padding: "9px 12px", fontSize: 12, fontWeight: 700, color: C.text, display: "flex", justifyContent: "space-between" }}>
                    <span>{brand}</span>
                    <span style={{ color: C.muted, fontWeight: 600 }}>{checkedInBrand}/{brandSkus.length}</span>
                  </div>
                  {brandSkus.map((s) => (
                    <label key={s.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderTop: `1px solid ${C.line}`, fontSize: 12.5, color: C.text, fontWeight: 500 }}>
                      <input type="checkbox" checked={!!stockChecks[s.id]} onChange={() => toggleSku(s.id)} style={{ width: 18, height: 18, margin: 0, accentColor: C.blue, flexShrink: 0 }} />
                      {s.sku}
                    </label>
                  ))}
                </div>
              );
            })}
            {!loadingChecklist && !(skus || []).length && <div style={{ fontSize: 12, color: C.muted, marginBottom: 10 }}>No SKU catalog uploaded yet — ask your admin to upload the product list.</div>}

            <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
              <button type="button" onClick={() => setSelected(null)} style={{ flex: 1, padding: "12px", borderRadius: 10, border: `1px solid ${C.line}`, background: "#fff", color: C.text, fontWeight: 700, fontSize: 14 }}>Cancel</button>
              <button type="submit" disabled={saving || hadSale === null} style={{ flex: 2, padding: "12px", borderRadius: 10, border: "none", background: C.blue, color: "#fff", fontWeight: 700, fontSize: 14, opacity: (saving || hadSale === null) ? 0.6 : 1 }}>{saving ? "Saving…" : "Save Visit"}</button>
            </div>
          </form>
        </div>
      )}

      {/* New customer modal */}
      {showNewCustomer && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(11,32,54,0.4)", display: "flex", alignItems: "flex-end", zIndex: 20 }} onClick={() => setShowNewCustomer(false)}>
          <form onClick={(e) => e.stopPropagation()} onSubmit={submitNewCustomer} style={{ background: "#fff", width: "100%", maxHeight: "88vh", overflowY: "auto", borderRadius: "18px 18px 0 0", padding: "20px 20px calc(28px + env(safe-area-inset-bottom))" }}>
            <div style={{ fontFamily: "Manrope", fontWeight: 800, fontSize: 16, color: C.text, marginBottom: 18 }}>New Customer</div>
            <Field label="Customer name" required value={newCust.name} onChange={(v) => setNewCust({ ...newCust, name: v })} />
            <label style={{ fontSize: 12, fontWeight: 700, color: "#0B2036", display: "block", marginBottom: 6 }}>Region / Atoll *</label>
            <select
              required
              value={newCust.region}
              onChange={(e) => setNewCust({ ...newCust, region: e.target.value, area: "" })}
              style={{ width: "100%", padding: "10px 12px", borderRadius: 9, border: "1px solid #E4EAF2", fontSize: 16, marginBottom: 14, fontFamily: "Inter" }}
            >
              <option value="">Select an atoll…</option>
              {atollNames.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
            <label style={{ fontSize: 12, fontWeight: 700, color: "#0B2036", display: "block", marginBottom: 6 }}>Area / Island *</label>
            <select
              required
              value={newCust.area}
              disabled={!newCust.region}
              onChange={(e) => setNewCust({ ...newCust, area: e.target.value })}
              style={{ width: "100%", padding: "10px 12px", borderRadius: 9, border: "1px solid #E4EAF2", fontSize: 16, marginBottom: 14, fontFamily: "Inter", opacity: newCust.region ? 1 : 0.6 }}
            >
              <option value="">{newCust.region ? "Select an island…" : "Select an atoll first"}</option>
              {(islandsByAtoll[newCust.region] || []).map((i) => <option key={i} value={i}>{i}</option>)}
            </select>
            <label style={{ fontSize: 12, fontWeight: 700, color: C.text, display: "block", marginBottom: 6 }}>Customer type</label>
            <select value={newCust.customer_type} onChange={(e) => setNewCust({ ...newCust, customer_type: e.target.value })} style={{ width: "100%", padding: "10px 12px", borderRadius: 9, border: `1px solid ${C.line}`, fontSize: 16, marginBottom: 14, fontFamily: "Inter" }}>
              {["Supermarket", "Guesthouse Supplier", "Cafe/Restaurant", "Mini Mart", "Resort Store"].map((t) => <option key={t}>{t}</option>)}
            </select>
            <Field label="Monthly target (MVR)" type="number" value={newCust.monthly_target} onChange={(v) => setNewCust({ ...newCust, monthly_target: v })} />
            <Field label="Credit limit (MVR)" type="number" value={newCust.credit_limit} onChange={(v) => setNewCust({ ...newCust, credit_limit: v })} />
            <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
              <button type="button" onClick={() => setShowNewCustomer(false)} style={{ flex: 1, padding: "12px", borderRadius: 10, border: `1px solid ${C.line}`, background: "#fff", color: C.text, fontWeight: 700, fontSize: 14 }}>Cancel</button>
              <button type="submit" disabled={saving} style={{ flex: 2, padding: "12px", borderRadius: 10, border: "none", background: C.blue, color: "#fff", fontWeight: 700, fontSize: 14, opacity: saving ? 0.7 : 1 }}>{saving ? "Saving…" : "Add Customer"}</button>
            </div>
          </form>
        </div>
      )}

      {toast && (
        <div style={{ position: "fixed", bottom: 20, left: "50%", transform: "translateX(-50%)", background: C.navy, color: "#fff", padding: "10px 18px", borderRadius: 999, fontSize: 12.5, fontWeight: 600, zIndex: 30 }}>{toast}</div>
      )}
    </div>
  );
}

function Field({ label, required, ...props }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ fontSize: 12, fontWeight: 700, color: "#0B2036", display: "block", marginBottom: 6 }}>{label}{required && " *"}</label>
      <input required={required} {...props} onChange={(e) => props.onChange(e.target.value)} style={{ width: "100%", padding: "10px 12px", borderRadius: 9, border: "1px solid #E4EAF2", fontSize: 16, fontFamily: "Inter" }} />
    </div>
  );
}
