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

export default function EntryClient({ profile, customers, todaysEntries }) {
  const router = useRouter();
  const supabase = createClient();
  const [selected, setSelected] = useState(null);
  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");

  const [form, setForm] = useState({ sale_amount: "", gp: "", portfolio_pct: "", outstanding_collected: "", visit_notes: "", next_visit_date: "" });
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

  const openEntry = (customer) => {
    setSelected(customer);
    setForm({ sale_amount: "", gp: "", portfolio_pct: "", outstanding_collected: "", visit_notes: "", next_visit_date: "" });
  };

  const submitEntry = async (e) => {
    e.preventDefault();
    setSaving(true);
    const { error } = await supabase.from("sales_entries").insert({
      customer_id: selected.id,
      rep_id: profile.id,
      sale_amount: Number(form.sale_amount) || 0,
      gp: Number(form.gp) || 0,
      portfolio_pct: form.portfolio_pct ? Number(form.portfolio_pct) : null,
      outstanding_collected: Number(form.outstanding_collected) || 0,
      visit_notes: form.visit_notes || null,
      next_visit_date: form.next_visit_date || null,
    });
    setSaving(false);
    if (error) { setToast("Could not save — check your connection and try again."); return; }
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
          <form onClick={(e) => e.stopPropagation()} onSubmit={submitEntry} style={{ background: "#fff", width: "100%", maxHeight: "88vh", overflowY: "auto", borderRadius: "18px 18px 0 0", padding: "20px 20px 28px" }}>
            <div style={{ fontFamily: "Manrope", fontWeight: 800, fontSize: 16, color: C.text, marginBottom: 2 }}>{selected.name}</div>
            <div style={{ fontSize: 11.5, color: C.muted, marginBottom: 18 }}>{selected.area}, {selected.region}</div>

            <Field label="Sale amount (MVR)" type="number" required value={form.sale_amount} onChange={(v) => setForm({ ...form, sale_amount: v })} />
            <Field label="Gross profit (MVR)" type="number" value={form.gp} onChange={(v) => setForm({ ...form, gp: v })} />
            <Field label="Portfolio availability (%)" type="number" min="0" max="100" value={form.portfolio_pct} onChange={(v) => setForm({ ...form, portfolio_pct: v })} />
            <Field label="Outstanding collected (MVR)" type="number" value={form.outstanding_collected} onChange={(v) => setForm({ ...form, outstanding_collected: v })} />
            <Field label="Next visit date" type="date" value={form.next_visit_date} onChange={(v) => setForm({ ...form, next_visit_date: v })} />
            <label style={{ fontSize: 12, fontWeight: 700, color: C.text, display: "block", marginBottom: 6, marginTop: 4 }}>Visit notes</label>
            <textarea rows={3} value={form.visit_notes} onChange={(e) => setForm({ ...form, visit_notes: e.target.value })} style={{ width: "100%", padding: "10px 12px", borderRadius: 9, border: `1px solid ${C.line}`, fontSize: 14, fontFamily: "Inter", marginBottom: 18, resize: "none" }} />

            <div style={{ display: "flex", gap: 10 }}>
              <button type="button" onClick={() => setSelected(null)} style={{ flex: 1, padding: "12px", borderRadius: 10, border: `1px solid ${C.line}`, background: "#fff", color: C.text, fontWeight: 700, fontSize: 14 }}>Cancel</button>
              <button type="submit" disabled={saving} style={{ flex: 2, padding: "12px", borderRadius: 10, border: "none", background: C.blue, color: "#fff", fontWeight: 700, fontSize: 14, opacity: saving ? 0.7 : 1 }}>{saving ? "Saving…" : "Save Visit"}</button>
            </div>
          </form>
        </div>
      )}

      {/* New customer modal */}
      {showNewCustomer && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(11,32,54,0.4)", display: "flex", alignItems: "flex-end", zIndex: 20 }} onClick={() => setShowNewCustomer(false)}>
          <form onClick={(e) => e.stopPropagation()} onSubmit={submitNewCustomer} style={{ background: "#fff", width: "100%", maxHeight: "88vh", overflowY: "auto", borderRadius: "18px 18px 0 0", padding: "20px 20px 28px" }}>
            <div style={{ fontFamily: "Manrope", fontWeight: 800, fontSize: 16, color: C.text, marginBottom: 18 }}>New Customer</div>
            <Field label="Customer name" required value={newCust.name} onChange={(v) => setNewCust({ ...newCust, name: v })} />
            <Field label="Region / Atoll" required value={newCust.region} onChange={(v) => setNewCust({ ...newCust, region: v })} />
            <Field label="Area / Island" required value={newCust.area} onChange={(v) => setNewCust({ ...newCust, area: v })} />
            <label style={{ fontSize: 12, fontWeight: 700, color: C.text, display: "block", marginBottom: 6 }}>Customer type</label>
            <select value={newCust.customer_type} onChange={(e) => setNewCust({ ...newCust, customer_type: e.target.value })} style={{ width: "100%", padding: "10px 12px", borderRadius: 9, border: `1px solid ${C.line}`, fontSize: 14, marginBottom: 14, fontFamily: "Inter" }}>
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
      <input required={required} {...props} onChange={(e) => props.onChange(e.target.value)} style={{ width: "100%", padding: "10px 12px", borderRadius: 9, border: "1px solid #E4EAF2", fontSize: 14, fontFamily: "Inter" }} />
    </div>
  );
}
