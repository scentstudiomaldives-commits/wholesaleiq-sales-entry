"use client";
import { useState, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../lib/supabaseClient";

const C = {
  navy: "#0B2E52", blue: "#1F6FEB", blueSoft: "#E8F0FE", green: "#0F9D63", greenSoft: "#E4F7EF",
  amber: "#C9821C", amberSoft: "#FBF0DF", red: "#D5433C", redSoft: "#FBE7E6",
  line: "#E4EAF2", text: "#0B2036", muted: "#8B99AC", surface: "#FFFFFF",
};

// Reps don't enter gross profit directly — it's estimated from the sale
// amount using this assumed blended margin. Adjust to match your actual
// average margin, or replace with a per-customer/per-brand rate later.
const DEFAULT_GP_MARGIN = 0.18;

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

  // Refs update instantly; state-driven `disabled` on a button only takes
  // effect on the next render, which leaves a real gap for a fast
  // double-tap (very common on phones) to fire a handler twice before the
  // button visually locks. Each submit-style action checks its own ref
  // synchronously, first line, before doing anything else.
  const submittingVisitRef = useRef(false);
  const submittingCustomerRef = useRef(false);
  const parsingInvoiceRef = useRef(false);
  const submittingInvoiceRef = useRef(false);

  // Invoice scanning: fileRef -> upload -> parse -> review/edit -> submit.
  const invoiceFileInputRef = useRef(null);
  const [showInvoiceUpload, setShowInvoiceUpload] = useState(false);
  const [invoiceFile, setInvoiceFile] = useState(null);
  const [invoicePreviewUrl, setInvoicePreviewUrl] = useState(null);
  const [invoiceParsing, setInvoiceParsing] = useState(false);
  const [invoiceError, setInvoiceError] = useState("");
  const [invoiceReview, setInvoiceReview] = useState(null); // populated once parsing succeeds

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

  const [form, setForm] = useState({ sale_amount: "", outstanding_collected: "", visit_notes: "", next_visit_date: "" });
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
    setForm({ sale_amount: "", outstanding_collected: "", visit_notes: "", next_visit_date: "" });
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
    if (submittingVisitRef.current) return;
    submittingVisitRef.current = true;
    setSaving(true);
    try {
      const totalSkus = (skus || []).length;
      const checkedCount = Object.values(stockChecks).filter(Boolean).length;
      const portfolioPct = totalSkus ? Math.round((checkedCount / totalSkus) * 100) : null;

      const { error } = await supabase.from("sales_entries").insert({
        customer_id: selected.id,
        rep_id: profile.id,
        sale_amount: hadSale ? Number(form.sale_amount) || 0 : 0,
        gp: hadSale ? Math.round((Number(form.sale_amount) || 0) * DEFAULT_GP_MARGIN) : 0,
        portfolio_pct: portfolioPct,
        outstanding_collected: Number(form.outstanding_collected) || 0,
        visit_notes: form.visit_notes || null,
        next_visit_date: form.next_visit_date || null,
      });
      if (error) { setToast("Could not save — check your connection and try again."); return; }

      if ((skus || []).length) {
        const stockRows = skus.map((s) => ({
          customer_id: selected.id, sku_id: s.id, in_stock: !!stockChecks[s.id],
          updated_by: profile.id, updated_at: new Date().toISOString(),
        }));
        const { error: stockErr } = await supabase.from("customer_sku_stock").upsert(stockRows, { onConflict: "customer_id,sku_id" });
        if (stockErr) { setToast("Visit saved, but the stock checklist didn't save — try re-opening this customer."); setSelected(null); router.refresh(); setTimeout(() => setToast(""), 3500); return; }
      }

      setToast(`Saved: ${selected.name}`);
      setSelected(null);
      router.refresh();
      setTimeout(() => setToast(""), 2500);
    } finally {
      setSaving(false);
      submittingVisitRef.current = false;
    }
  };

  const submitNewCustomer = async (e) => {
    e.preventDefault();
    if (submittingCustomerRef.current) return;
    submittingCustomerRef.current = true;
    setSaving(true);
    try {
      const { error } = await supabase.from("customers").insert({
        name: newCust.name, region: newCust.region, area: newCust.area,
        customer_type: newCust.customer_type, rep_id: profile.id,
        monthly_target: Number(newCust.monthly_target) || 0,
        credit_limit: Number(newCust.credit_limit) || 0,
      });
      if (error) { setToast("Could not add customer."); return; }
      setToast(`Added: ${newCust.name}`);
      setShowNewCustomer(false);
      setNewCust({ name: "", region: "", area: "", customer_type: "Mini Mart", monthly_target: "", credit_limit: "" });
      router.refresh();
      setTimeout(() => setToast(""), 2500);
    } finally {
      setSaving(false);
      submittingCustomerRef.current = false;
    }
  };

  const signOut = async () => { await supabase.auth.signOut(); router.push("/login"); router.refresh(); };

  // --- Invoice scanning -------------------------------------------------
  const openInvoiceUpload = () => {
    setInvoiceFile(null); setInvoicePreviewUrl(null); setInvoiceError(""); setInvoiceReview(null);
    setShowInvoiceUpload(true);
  };
  const closeInvoiceUpload = () => {
    if (invoicePreviewUrl) URL.revokeObjectURL(invoicePreviewUrl);
    setShowInvoiceUpload(false); setInvoiceFile(null); setInvoicePreviewUrl(null); setInvoiceError(""); setInvoiceReview(null);
  };

  // Phone camera photos are often 3000px+ wide — way more detail than a
  // vision model needs to read text, and it slows down both the upload
  // and OpenAI's own processing. Resizing client-side before we ever send
  // it noticeably cuts round-trip time, which matters a lot on Vercel's
  // Hobby plan (hard 10s function limit).
  const compressImage = (file) =>
    new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const MAX_DIM = 1600;
        let { width, height } = img;
        if (width > MAX_DIM || height > MAX_DIM) {
          const scale = MAX_DIM / Math.max(width, height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }
        const canvas = document.createElement("canvas");
        canvas.width = width; canvas.height = height;
        canvas.getContext("2d").drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => resolve(blob ? new File([blob], "invoice.jpg", { type: "image/jpeg" }) : file),
          "image/jpeg", 0.82
        );
      };
      img.onerror = () => resolve(file); // fall back to the original if anything goes wrong
      img.src = URL.createObjectURL(file);
    });

  const handleInvoiceFileChosen = async (file) => {
    if (!file) return;
    setInvoiceError("");
    const compressed = await compressImage(file);
    setInvoiceFile(compressed);
    setInvoicePreviewUrl(URL.createObjectURL(compressed));
  };

  const parseInvoice = async () => {
    if (!invoiceFile) return;
    if (parsingInvoiceRef.current) return;
    parsingInvoiceRef.current = true;
    setInvoiceParsing(true);
    setInvoiceError("");
    try {
      const formData = new FormData();
      formData.append("file", invoiceFile);
      const resp = await fetch("/api/parse-invoice", { method: "POST", body: formData });
      const body = await resp.json().catch(() => null);
      if (!resp.ok || !body || body.error) {
        setInvoiceError(
          body?.error ||
          (resp.status === 504 || resp.status === 502
            ? "The invoice-reading service took too long or crashed before responding — this usually means a server timeout, not a bad photo. Try again in a moment, or enter it manually."
            : "Could not read that invoice. Try a clearer photo, or enter it manually.")
        );
        return;
      }
      const { parsed, match, warnings, invoice_image_path } = body;
      setInvoiceReview({
        customerId: match.customer_id || "",
        customerCandidates: match.customer_candidates || [],
        invoiceNumber: parsed.invoice_number || "",
        date: parsed.date || new Date().toISOString().slice(0, 10),
        paymentStatus: parsed.payment_status || "paid",
        items: match.items.map((it, i) => ({
          key: i, skuId: it.matched_sku_id || "", descriptionRaw: it.description || it.sku_code_raw || "Unrecognized item",
          quantity: it.quantity || 1, unitPrice: it.unit_price || 0, matched: it.matched,
        })),
        aiGrandTotal: parsed.grand_total,
        warnings: warnings || [],
        invoiceImagePath: invoice_image_path || null,
      });
    } catch {
      setInvoiceError("Could not reach the server. Check your connection and try again.");
    } finally {
      setInvoiceParsing(false);
      parsingInvoiceRef.current = false;
    }
  };

  const updateInvoiceItem = (key, patch) => {
    setInvoiceReview((prev) => ({ ...prev, items: prev.items.map((it) => (it.key === key ? { ...it, ...patch } : it)) }));
  };
  const removeInvoiceItem = (key) => {
    setInvoiceReview((prev) => ({ ...prev, items: prev.items.filter((it) => it.key !== key) }));
  };

  const invoiceComputedTotal = invoiceReview
    ? Math.round(invoiceReview.items.reduce((s, it) => s + Number(it.quantity || 0) * Number(it.unitPrice || 0), 0) * 100) / 100
    : 0;

  const submitInvoice = async (e) => {
    e.preventDefault();
    if (!invoiceReview?.customerId) { setInvoiceError("Select which customer this invoice belongs to before saving."); return; }
    if (submittingInvoiceRef.current) return;
    submittingInvoiceRef.current = true;
    setSaving(true);
    try {
      const gp = Math.round(invoiceComputedTotal * DEFAULT_GP_MARGIN);

      const { data: entryRows, error: entryErr } = await supabase.from("sales_entries").insert({
        customer_id: invoiceReview.customerId,
        rep_id: profile.id,
        entry_date: invoiceReview.date,
        sale_amount: invoiceComputedTotal,
        gp,
        outstanding_collected: invoiceReview.paymentStatus === "paid" ? invoiceComputedTotal : 0,
        visit_notes: "Logged from scanned invoice",
        invoice_number: invoiceReview.invoiceNumber || null,
        payment_status: invoiceReview.paymentStatus,
        invoice_image_path: invoiceReview.invoiceImagePath,
      }).select("id").single();

      if (entryErr) {
        // 23505 = unique_violation — this exact invoice number was already
        // logged for this customer. The database is the source of truth
        // here, not just a UI double-click guard, so this catches repeat
        // submissions from a different session/device too.
        if (entryErr.code === "23505") {
          setInvoiceError(`Invoice ${invoiceReview.invoiceNumber || ""} was already logged for this customer — this looks like a duplicate, so it wasn't saved again. Check Customer Performance if you need to review the original entry.`);
        } else {
          setInvoiceError("Could not save this invoice — " + entryErr.message);
        }
        return;
      }

      const lineItems = invoiceReview.items
        .filter((it) => Number(it.quantity) > 0)
        .map((it) => ({
          sales_entry_id: entryRows.id,
          sku_id: it.skuId || null,
          sku_code_raw: it.descriptionRaw,
          quantity: Number(it.quantity) || 0,
          unit_price: Number(it.unitPrice) || 0,
          line_total: Math.round(Number(it.quantity || 0) * Number(it.unitPrice || 0) * 100) / 100,
        }));
      if (lineItems.length) {
        const { error: itemsErr } = await supabase.from("sale_line_items").insert(lineItems);
        if (itemsErr) { setInvoiceError("Invoice saved, but line items didn't save: " + itemsErr.message); return; }
      }

      // Items the AI matched to a real SKU are now known to be on this
      // customer's shelf — reflect that in their stock checklist.
      const matchedSkuIds = [...new Set(invoiceReview.items.filter((it) => it.skuId).map((it) => it.skuId))];
      if (matchedSkuIds.length) {
        const stockRows = matchedSkuIds.map((skuId) => ({
          customer_id: invoiceReview.customerId, sku_id: skuId, in_stock: true,
          updated_by: profile.id, updated_at: new Date().toISOString(),
        }));
        await supabase.from("customer_sku_stock").upsert(stockRows, { onConflict: "customer_id,sku_id" });
      }

      setToast("Invoice saved");
      closeInvoiceUpload();
      router.refresh();
      setTimeout(() => setToast(""), 2500);
    } finally {
      setSaving(false);
      submittingInvoiceRef.current = false;
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#F4F7FB", paddingBottom: 40 }}>
      {/* Header */}
      <div style={{ background: C.navy, padding: "16px 18px", display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ background: "#fff", borderRadius: 7, padding: "4px 7px", display: "flex", alignItems: "center", flexShrink: 0 }}>
            <img src="/logo.png" alt="STO" style={{ height: 16, width: "auto", display: "block" }} />
          </div>
          <div>
            <div style={{ color: "#fff", fontFamily: "Manrope", fontWeight: 800, fontSize: 15 }}>{profile.full_name}</div>
            <div style={{ color: "#8FA8C4", fontSize: 11 }}>{new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short" })}</div>
          </div>
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

      {/* Add customer / scan invoice */}
      <div style={{ padding: "10px 16px", display: "flex", gap: 10 }}>
        <button onClick={() => setShowNewCustomer(true)} style={{ flex: 1, padding: "11px", borderRadius: 10, border: `1.5px dashed ${C.blue}`, background: C.blueSoft, color: C.blue, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
          + Add New Customer
        </button>
        <button onClick={openInvoiceUpload} style={{ flex: 1, padding: "11px", borderRadius: 10, border: `1.5px dashed ${C.green}`, background: C.greenSoft, color: C.green, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
          Scan Invoice
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

      {/* Invoice scan modal */}
      {showInvoiceUpload && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(11,32,54,0.4)", display: "flex", alignItems: "flex-end", zIndex: 20 }} onClick={closeInvoiceUpload}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", width: "100%", maxHeight: "92vh", overflowY: "auto", borderRadius: "18px 18px 0 0", padding: "20px 20px calc(28px + env(safe-area-inset-bottom))" }}>
            <div style={{ fontFamily: "Manrope", fontWeight: 800, fontSize: 16, color: C.text, marginBottom: 18 }}>Scan Invoice</div>

            {!invoiceReview && (
              <>
                <input
                  ref={invoiceFileInputRef} type="file" accept="image/png,image/jpeg,image/webp" capture="environment"
                  style={{ display: "none" }}
                  onChange={(e) => handleInvoiceFileChosen(e.target.files?.[0] || null)}
                />
                {!invoicePreviewUrl && (
                  <button
                    type="button" onClick={() => invoiceFileInputRef.current?.click()}
                    style={{ width: "100%", padding: "34px 16px", borderRadius: 12, border: `1.5px dashed ${C.line}`, background: "#F4F7FB", color: C.muted, fontWeight: 600, fontSize: 13, cursor: "pointer", marginBottom: 14 }}
                  >
                    Tap to take a photo or choose an image<br />
                    <span style={{ fontSize: 11, fontWeight: 500 }}>PNG or JPG — PDF isn't supported yet</span>
                  </button>
                )}
                {invoicePreviewUrl && (
                  <div style={{ marginBottom: 14 }}>
                    <img src={invoicePreviewUrl} alt="Invoice preview" style={{ width: "100%", maxHeight: 320, objectFit: "contain", borderRadius: 12, border: `1px solid ${C.line}`, background: "#F4F7FB" }} />
                    <button type="button" onClick={() => invoiceFileInputRef.current?.click()} style={{ marginTop: 8, fontSize: 12, fontWeight: 700, color: C.blue, background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                      Choose a different photo
                    </button>
                  </div>
                )}
                {invoiceError && <div style={{ background: C.redSoft, color: C.red, fontSize: 12.5, fontWeight: 600, padding: "10px 12px", borderRadius: 9, marginBottom: 14 }}>{invoiceError}</div>}
                <div style={{ display: "flex", gap: 10 }}>
                  <button type="button" onClick={closeInvoiceUpload} style={{ flex: 1, padding: "12px", borderRadius: 10, border: `1px solid ${C.line}`, background: "#fff", color: C.text, fontWeight: 700, fontSize: 14 }}>Cancel</button>
                  <button type="button" onClick={parseInvoice} disabled={!invoiceFile || invoiceParsing} style={{ flex: 2, padding: "12px", borderRadius: 10, border: "none", background: C.green, color: "#fff", fontWeight: 700, fontSize: 14, opacity: (!invoiceFile || invoiceParsing) ? 0.6 : 1 }}>
                    {invoiceParsing ? "Reading invoice…" : "Read Invoice"}
                  </button>
                </div>
              </>
            )}

            {invoiceReview && (
              <form onSubmit={submitInvoice}>
                {invoicePreviewUrl && (
                  <img src={invoicePreviewUrl} alt="Invoice preview" style={{ width: "100%", maxHeight: 220, objectFit: "contain", borderRadius: 12, border: `1px solid ${C.line}`, background: "#F4F7FB", marginBottom: 14 }} />
                )}

                {invoiceReview.warnings.length > 0 && (
                  <div style={{ background: C.amberSoft, color: C.amber, fontSize: 12, fontWeight: 600, padding: "10px 12px", borderRadius: 9, marginBottom: 14, lineHeight: 1.5 }}>
                    {invoiceReview.warnings.map((w, i) => <div key={i}>• {w}</div>)}
                  </div>
                )}

                <label style={{ fontSize: 12, fontWeight: 700, color: C.text, display: "block", marginBottom: 6 }}>Customer *</label>
                <select
                  required value={invoiceReview.customerId}
                  onChange={(e) => setInvoiceReview({ ...invoiceReview, customerId: e.target.value })}
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 9, border: `1.5px solid ${invoiceReview.customerId ? C.line : C.red}`, fontSize: 16, marginBottom: 4, fontFamily: "Inter" }}
                >
                  <option value="">
                    {invoiceReview.customerCandidates.length ? "Not auto-matched — pick manually" : "Select customer…"}
                  </option>
                  {customers.map((c) => <option key={c.id} value={c.id}>{c.name} — {c.area}</option>)}
                </select>
                {!invoiceReview.customerId && invoiceReview.customerCandidates.length > 0 && (
                  <div style={{ fontSize: 11, color: C.muted, marginBottom: 14 }}>
                    Did you mean: {invoiceReview.customerCandidates.map((c) => c.name).join(", ")}?
                  </div>
                )}
                {(invoiceReview.customerId || !invoiceReview.customerCandidates.length) && <div style={{ marginBottom: 10 }} />}

                <Field label="Invoice number" value={invoiceReview.invoiceNumber} onChange={(v) => setInvoiceReview({ ...invoiceReview, invoiceNumber: v })} />
                <Field label="Date" type="date" value={invoiceReview.date} onChange={(v) => setInvoiceReview({ ...invoiceReview, date: v })} />

                <label style={{ fontSize: 12, fontWeight: 700, color: C.text, display: "block", marginBottom: 6 }}>Payment status</label>
                <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                  {["paid", "pending", "partial"].map((s) => (
                    <button
                      type="button" key={s} onClick={() => setInvoiceReview({ ...invoiceReview, paymentStatus: s })}
                      style={{ flex: 1, padding: "9px", borderRadius: 9, border: `1.5px solid ${invoiceReview.paymentStatus === s ? C.blue : C.line}`, background: invoiceReview.paymentStatus === s ? C.blueSoft : "#fff", color: invoiceReview.paymentStatus === s ? C.blue : C.text, fontWeight: 700, fontSize: 12.5, textTransform: "capitalize" }}
                    >
                      {s}
                    </button>
                  ))}
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <span style={{ fontFamily: "Manrope", fontWeight: 800, fontSize: 13.5, color: C.text }}>Items</span>
                  {invoiceReview.aiGrandTotal != null && Math.abs(invoiceReview.aiGrandTotal - invoiceComputedTotal) > 0.5 && (
                    <span style={{ fontSize: 10.5, fontWeight: 700, color: C.amber }}>Invoice shows MVR {invoiceReview.aiGrandTotal} — check quantities/prices</span>
                  )}
                </div>

                {invoiceReview.items.map((it) => (
                  <div key={it.key} style={{ border: `1px solid ${it.matched ? C.line : C.amber}`, borderRadius: 10, padding: "10px 12px", marginBottom: 8 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: C.text, flex: 1 }}>{it.descriptionRaw}</div>
                      <button type="button" onClick={() => removeInvoiceItem(it.key)} style={{ background: "none", border: "none", color: C.red, fontSize: 11, fontWeight: 700, cursor: "pointer", padding: "0 0 0 8px" }}>Remove</button>
                    </div>
                    {!it.matched && (
                      <select
                        value={it.skuId} onChange={(e) => updateInvoiceItem(it.key, { skuId: e.target.value })}
                        style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: `1px solid ${C.amber}`, fontSize: 13, marginBottom: 8, fontFamily: "Inter", background: C.amberSoft }}
                      >
                        <option value="">Not matched — pick the product manually</option>
                        {Object.entries(skusByBrand).map(([brand, brandSkus]) => (
                          <optgroup key={brand} label={brand}>
                            {brandSkus.map((s) => <option key={s.id} value={s.id}>{s.sku}</option>)}
                          </optgroup>
                        ))}
                      </select>
                    )}
                    <div style={{ display: "flex", gap: 8 }}>
                      <div style={{ flex: 1 }}>
                        <label style={{ fontSize: 10.5, color: C.muted, fontWeight: 600 }}>Qty</label>
                        <input type="number" value={it.quantity} onChange={(e) => updateInvoiceItem(it.key, { quantity: e.target.value })} style={{ width: "100%", padding: "7px 9px", borderRadius: 7, border: `1px solid ${C.line}`, fontSize: 15 }} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <label style={{ fontSize: 10.5, color: C.muted, fontWeight: 600 }}>Unit price</label>
                        <input type="number" value={it.unitPrice} onChange={(e) => updateInvoiceItem(it.key, { unitPrice: e.target.value })} style={{ width: "100%", padding: "7px 9px", borderRadius: 7, border: `1px solid ${C.line}`, fontSize: 15 }} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <label style={{ fontSize: 10.5, color: C.muted, fontWeight: 600 }}>Line total</label>
                        <div style={{ padding: "7px 9px", fontSize: 15, fontWeight: 700, color: C.text }}>MVR {(Number(it.quantity || 0) * Number(it.unitPrice || 0)).toFixed(2)}</div>
                      </div>
                    </div>
                  </div>
                ))}
                {!invoiceReview.items.length && <div style={{ fontSize: 12, color: C.muted, marginBottom: 10 }}>No items left — add them back by re-scanning, or save as a plain visit instead.</div>}

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderTop: `1px solid ${C.line}`, marginTop: 4, marginBottom: 14 }}>
                  <span style={{ fontFamily: "Manrope", fontWeight: 800, fontSize: 14, color: C.text }}>Total</span>
                  <span style={{ fontFamily: "Manrope", fontWeight: 800, fontSize: 18, color: C.green }}>MVR {invoiceComputedTotal.toFixed(2)}</span>
                </div>

                {invoiceError && <div style={{ background: C.redSoft, color: C.red, fontSize: 12.5, fontWeight: 600, padding: "10px 12px", borderRadius: 9, marginBottom: 14 }}>{invoiceError}</div>}

                <div style={{ display: "flex", gap: 10 }}>
                  <button type="button" onClick={closeInvoiceUpload} style={{ flex: 1, padding: "12px", borderRadius: 10, border: `1px solid ${C.line}`, background: "#fff", color: C.text, fontWeight: 700, fontSize: 14 }}>Cancel</button>
                  <button type="submit" disabled={saving || !invoiceReview.customerId || !invoiceReview.items.length} style={{ flex: 2, padding: "12px", borderRadius: 10, border: "none", background: C.blue, color: "#fff", fontWeight: 700, fontSize: 14, opacity: (saving || !invoiceReview.customerId || !invoiceReview.items.length) ? 0.6 : 1 }}>
                    {saving ? "Saving…" : "Save Invoice"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
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
