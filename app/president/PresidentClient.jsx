"use client";
import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../lib/supabaseClient";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";

const COLORS = {
  bg: "#F4F7FB", surface: "#FFFFFF", line: "#E4EAF2", navy: "#0B2E52",
  green: "#0F9D63", greenSoft: "#E4F7EF", amber: "#C9821C", red: "#D5433C",
  textPrimary: "#0B2036", textSecondary: "#5B6B80", textMuted: "#8B99AC",
};
const fmtQty = (n) => Math.round(n || 0).toLocaleString("en-US") + " KG";
const fmtShort = (n) => (n >= 1000 ? (n / 1000).toFixed(1) + "K" : String(Math.round(n || 0)));
const shortAtoll = (r) => String(r || "").replace(/\s*\(.*?\)/g, "").replace(/\s+Atoll$/, "");

const PERIODS = [
  { key: "this_week", label: "This Week" },
  { key: "last_week", label: "Last Week" },
  { key: "this_month", label: "This Month" },
  { key: "last_month", label: "Last Month" },
  { key: "last_3_months", label: "Last 3 Months" },
  { key: "ytd", label: "Year to Date" },
  { key: "all_time", label: "All Time" },
];
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
function windowFor(key) {
  const now = new Date();
  const y = now.getFullYear(), m = now.getMonth();
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7));
  const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
  switch (key) {
    case "this_week": return [iso(monday), iso(now)];
    case "last_week": return [iso(addDays(monday, -7)), iso(addDays(monday, -1))];
    case "last_month": return [iso(new Date(y, m - 1, 1)), iso(new Date(y, m, 0))];
    case "last_3_months": return [iso(new Date(y, m - 2, 1)), iso(now)];
    case "ytd": return [iso(new Date(y, 0, 1)), iso(now)];
    case "all_time": return ["2000-01-01", iso(now)];
    default: return [iso(new Date(y, m, 1)), iso(now)];
  }
}

function weekWindows() {
  const now = new Date();
  const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
  const monday = addDays(now, -((now.getDay() + 6) % 7));
  const lastMonday = addDays(monday, -7);
  const dayIdx = (now.getDay() + 6) % 7; // 0 = Monday
  return {
    thisWeek: [iso(monday), iso(now)],
    lastWeek: [iso(lastMonday), iso(addDays(monday, -1))],
    lastWeekSame: [iso(lastMonday), iso(addDays(lastMonday, dayIdx))],
    thisLabel: `${iso(monday)} to ${iso(now)}`,
    lastLabel: `${iso(lastMonday)} to ${iso(addDays(monday, -1))}`,
    daysSoFar: dayIdx + 1,
  };
}
const sumBy = (rows) => {
  const m = new Map();
  (rows || []).forEach((r) => m.set(r.atoll, (m.get(r.atoll) || 0) + Number(r.qty_uom)));
  return m;
};
const chg = (cur, prev) => (prev > 0 ? Math.round(((cur - prev) / prev) * 100) : cur > 0 ? null : 0);
function Chg({ v }) {
  if (v === null) return <span style={{ color: COLORS.green, fontWeight: 700 }}>New</span>;
  const c = v > 0 ? COLORS.green : v < 0 ? COLORS.red : COLORS.textMuted;
  return <span style={{ color: c, fontWeight: 700 }}>{v > 0 ? "+" : ""}{v}%</span>;
}

const th = { textAlign: "left", fontSize: 11, fontWeight: 700, color: COLORS.textMuted, textTransform: "uppercase", letterSpacing: 0.4, padding: "9px 12px", borderBottom: `1px solid ${COLORS.line}`, whiteSpace: "nowrap" };
const td = { fontSize: 13, color: COLORS.textSecondary, padding: "10px 12px", borderBottom: `1px solid ${COLORS.line}`, whiteSpace: "nowrap" };
const card = { background: COLORS.surface, border: `1px solid ${COLORS.line}`, borderRadius: 16, padding: "18px 20px", marginBottom: 16, overflowX: "auto" };

function Bar100({ value }) {
  const color = value >= 60 ? COLORS.green : value > 0 ? COLORS.amber : COLORS.red;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 110 }}>
      <div style={{ flex: 1, height: 6, background: COLORS.line, borderRadius: 6 }}>
        <div style={{ width: `${Math.min(100, value)}%`, height: 6, background: color, borderRadius: 6 }} />
      </div>
      <span style={{ fontSize: 11.5, fontWeight: 700, color: COLORS.textSecondary, width: 34 }}>{value}%</span>
    </div>
  );
}

export default function PresidentClient({ profile }) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [periodKey, setPeriodKey] = useState("this_month");
  const [rows, setRows] = useState(null);
  const [weekly, setWeekly] = useState(null);
  const [error, setError] = useState(null);
  const [open, setOpen] = useState({});
  const [narrow, setNarrow] = useState(false);

  useEffect(() => {
    const f = () => setNarrow(window.innerWidth < 860);
    f(); window.addEventListener("resize", f);
    return () => window.removeEventListener("resize", f);
  }, []);

  useEffect(() => {
    let live = true;
    setRows(null); setError(null);
    const [s, e] = windowFor(periodKey);
    supabase.rpc("fresh_produce_by_island", { p_start: s, p_end: e }).then(({ data, error }) => {
      if (!live) return;
      if (error) setError(error.message); else setRows(data || []);
    });
    return () => { live = false; };
  }, [periodKey, supabase]);

  useEffect(() => {
    let live = true;
    const w = weekWindows();
    Promise.all([w.thisWeek, w.lastWeek, w.lastWeekSame].map(([a, b]) => supabase.rpc("fresh_produce_by_island", { p_start: a, p_end: b })))
      .then(([t, l, ls]) => {
        if (!live) return;
        const err = t.error || l.error || ls.error;
        if (err) { setWeekly({ error: err.message }); return; }
        const tm = sumBy(t.data), lm = sumBy(l.data), sm = sumBy(ls.data);
        const names = [...new Set([...tm.keys(), ...lm.keys()])];
        const list = names.map((a) => ({ atoll: a, name: shortAtoll(a), thisWeek: tm.get(a) || 0, lastWeek: lm.get(a) || 0, same: sm.get(a) || 0 }))
          .sort((x, y) => y.thisWeek - x.thisWeek || y.lastWeek - x.lastWeek);
        const sum = (k) => list.reduce((s, r) => s + r[k], 0);
        setWeekly({ list, thisWeek: sum("thisWeek"), lastWeek: sum("lastWeek"), same: sum("same"), w });
      });
    return () => { live = false; };
  }, [supabase]);

  const atolls = useMemo(() => {
    const aMap = new Map();
    (rows || []).forEach((r) => {
      let a = aMap.get(r.atoll);
      if (!a) { a = { atoll: r.atoll, name: shortAtoll(r.atoll), qty: 0, islandMap: new Map() }; aMap.set(r.atoll, a); }
      let i = a.islandMap.get(r.island);
      if (!i) { i = { island: r.island, customers: r.customers, qty: 0, stockedSum: 0, itemsStocked: 0, items: [] }; a.islandMap.set(r.island, i); }
      const q = Number(r.qty_uom);
      i.qty += q; i.stockedSum += r.stocked; if (r.stocked > 0) i.itemsStocked += 1;
      i.items.push({ item: r.item, uom: r.uom, qty: q, stocked: r.stocked, customers: r.customers });
      a.qty += q;
    });
    const nItems = rows && rows.length ? new Set(rows.map((r) => r.item)).size : 0;
    return [...aMap.values()].map((a) => {
      const islands = [...a.islandMap.values()].map((i) => ({
        ...i, nItems, availability: i.customers && nItems ? Math.round((i.stockedSum / (i.customers * nItems)) * 100) : 0,
        items: i.items.sort((x, y) => x.item.localeCompare(y.item)),
      })).sort((x, y) => y.qty - x.qty || x.island.localeCompare(y.island));
      const cust = islands.reduce((s, i) => s + i.customers, 0);
      return { ...a, islands, nItems, reached: islands.filter((i) => i.qty > 0).length,
        availability: cust && nItems ? Math.round((islands.reduce((s, i) => s + i.stockedSum, 0) / (cust * nItems)) * 100) : 0 };
    }).sort((x, y) => y.qty - x.qty || x.name.localeCompare(y.name));
  }, [rows]);

  const totals = useMemo(() => ({
    qty: atolls.reduce((s, a) => s + a.qty, 0),
    atollsReached: atolls.filter((a) => a.qty > 0).length,
    atolls: atolls.length,
    islandsReached: atolls.reduce((s, a) => s + a.reached, 0),
    islands: atolls.reduce((s, a) => s + a.islands.length, 0),
  }), [atolls]);

  const signOut = async () => { await supabase.auth.signOut(); router.push("/login"); router.refresh(); };
  const toggle = (a) => setOpen((o) => ({ ...o, [a]: !o[a] }));
  const periodLabel = PERIODS.find((p) => p.key === periodKey)?.label;

  const tip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    const a = payload[0].payload;
    return (
      <div style={{ background: COLORS.navy, borderRadius: 10, padding: "9px 12px", color: "#fff", fontSize: 12 }}>
        <div style={{ fontWeight: 700, marginBottom: 4 }}>{a.atoll}</div>
        <div>Quantity: {fmtQty(a.qty)}</div>
        <div>Islands reached: {a.reached} of {a.islands.length}</div>
      </div>
    );
  };

  return (
    <div style={{ minHeight: "100vh", background: COLORS.bg, fontFamily: "Inter, sans-serif" }}>
      <div style={{ background: COLORS.navy, color: "#fff", padding: "14px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontFamily: "Manrope, sans-serif", fontWeight: 800, fontSize: 16 }}>STO General Trading</div>
          <div style={{ fontSize: 12, color: "#B9C9DC" }}>Fresh Produce - Atoll and Island Performance</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <select value={periodKey} onChange={(e) => setPeriodKey(e.target.value)} style={{ padding: "7px 10px", borderRadius: 8, border: "none", fontSize: 12.5, fontWeight: 600 }}>
            {PERIODS.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
          </select>
          <span style={{ fontSize: 12, color: "#B9C9DC" }}>{profile?.full_name}</span>
          <button onClick={signOut} style={{ background: "rgba(255,255,255,0.12)", border: "none", color: "#fff", fontSize: 11.5, fontWeight: 700, padding: "7px 12px", borderRadius: 8, cursor: "pointer" }}>Sign out</button>
        </div>
      </div>

      <div style={{ maxWidth: 1180, margin: "0 auto", padding: "20px 16px" }}>
        {error && <div style={{ ...card, color: COLORS.red, fontSize: 13 }}>Could not load data: {error}</div>}
        {!error && rows === null && <div style={{ ...card, color: COLORS.textMuted, fontSize: 13 }}>Loading...</div>}
        {rows && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: narrow ? "1fr 1fr" : "repeat(4, 1fr)", gap: 12, marginBottom: 16 }}>
              {[
                ["Quantity Supplied", fmtQty(totals.qty)],
                ["Atolls Reached", `${totals.atollsReached} of ${totals.atolls}`],
                ["Islands Reached", `${totals.islandsReached} of ${totals.islands}`],
                ["Top Atoll", atolls[0] && atolls[0].qty > 0 ? atolls[0].name : "-"],
              ].map(([k, v]) => (
                <div key={k} style={{ background: COLORS.greenSoft, borderRadius: 12, padding: "12px 14px" }}>
                  <div style={{ fontSize: 11.5, color: COLORS.textSecondary, fontWeight: 600 }}>{k}</div>
                  <div style={{ fontFamily: "Manrope, sans-serif", fontWeight: 800, fontSize: 20, color: COLORS.green, marginTop: 2 }}>{v}</div>
                </div>
              ))}
            </div>

            <div style={card}>
              <div style={{ fontFamily: "Manrope, sans-serif", fontSize: 15, fontWeight: 800, color: COLORS.textPrimary }}>Weekly Progress: Last Week to This Week</div>
              {!weekly && <div style={{ fontSize: 13, color: COLORS.textMuted, marginTop: 8 }}>Loading...</div>}
              {weekly && weekly.error && <div style={{ fontSize: 13, color: COLORS.red, marginTop: 8 }}>Could not load weekly progress: {weekly.error}</div>}
              {weekly && !weekly.error && (
                <>
                  <div style={{ fontSize: 12, color: COLORS.textMuted, margin: "2px 0 12px" }}>
                    Quantity supplied (KG). Last week {weekly.w.lastLabel}; this week {weekly.w.thisLabel} ({weekly.w.daysSoFar} day{weekly.w.daysSoFar > 1 ? "s" : ""} so far). The like-for-like column compares the same days of last week.
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: narrow ? "1fr 1fr" : "repeat(4, 1fr)", gap: 12, marginBottom: 14 }}>
                    {[
                      ["Last Week (full)", fmtQty(weekly.lastWeek), null],
                      ["This Week (so far)", fmtQty(weekly.thisWeek), null],
                      ["Same Days Last Week", fmtQty(weekly.same), null],
                      ["Progress (like-for-like)", null, chg(weekly.thisWeek, weekly.same)],
                    ].map(([k, v, c]) => (
                      <div key={k} style={{ background: COLORS.greenSoft, borderRadius: 12, padding: "12px 14px" }}>
                        <div style={{ fontSize: 11.5, color: COLORS.textSecondary, fontWeight: 600 }}>{k}</div>
                        <div style={{ fontFamily: "Manrope, sans-serif", fontWeight: 800, fontSize: 20, color: COLORS.green, marginTop: 2 }}>{v !== null ? v : <Chg v={c} />}</div>
                      </div>
                    ))}
                  </div>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead><tr><th style={th}>Atoll</th><th style={{ ...th, textAlign: "right" }}>Last week (KG)</th><th style={{ ...th, textAlign: "right" }}>This week so far (KG)</th><th style={{ ...th, textAlign: "right" }}>Same days last week (KG)</th><th style={{ ...th, textAlign: "right" }}>Progress</th></tr></thead>
                    <tbody>
                      {weekly.list.map((r) => (
                        <tr key={r.atoll}>
                          <td style={{ ...td, fontWeight: 700, color: COLORS.textPrimary }}>{r.atoll}</td>
                          <td style={{ ...td, textAlign: "right" }}>{Math.round(r.lastWeek).toLocaleString("en-US")}</td>
                          <td style={{ ...td, textAlign: "right" }}>{Math.round(r.thisWeek).toLocaleString("en-US")}</td>
                          <td style={{ ...td, textAlign: "right" }}>{Math.round(r.same).toLocaleString("en-US")}</td>
                          <td style={{ ...td, textAlign: "right" }}><Chg v={chg(r.thisWeek, r.same)} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}
            </div>

            <div style={card}>
              <div style={{ fontFamily: "Manrope, sans-serif", fontSize: 15, fontWeight: 800, color: COLORS.textPrimary }}>Quantity Supplied by Atoll (KG)</div>
              <div style={{ fontSize: 12, color: COLORS.textMuted, margin: "2px 0 10px" }}>{periodLabel} · Apple, Orange, Grapes, Banana, Avocado, Carrot, Lime, Tomato, Cabbage</div>
              {totals.qty === 0 ? (
                <div style={{ fontSize: 13, color: COLORS.textMuted }}>No Fresh Produce supplied in this period. Try a longer period.</div>
              ) : (
                <ResponsiveContainer width="100%" height={Math.max(260, atolls.length * 26 + 30)}>
                  <BarChart data={atolls} layout="vertical" margin={{ left: 4, right: 18, top: 4, bottom: 4 }}>
                    <CartesianGrid stroke={COLORS.line} horizontal={false} />
                    <XAxis type="number" tickFormatter={fmtShort} tick={{ fontSize: 10.5, fill: COLORS.textMuted }} axisLine={{ stroke: COLORS.line }} tickLine={false} />
                    <YAxis type="category" dataKey="name" width={90} interval={0} tick={{ fontSize: 11, fill: COLORS.textSecondary }} axisLine={false} tickLine={false} />
                    <Tooltip content={tip} cursor={{ fill: COLORS.greenSoft }} />
                    <Bar dataKey="qty" fill={COLORS.green} radius={[0, 5, 5, 0]} barSize={14} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            <div style={card}>
              <div style={{ fontFamily: "Manrope, sans-serif", fontSize: 15, fontWeight: 800, color: COLORS.textPrimary }}>Atoll, Island and Item Availability</div>
              <div style={{ fontSize: 12, color: COLORS.textMuted, margin: "2px 0 10px" }}>Select an atoll to see its islands, and an island to see each item. Quantity is what was supplied to wholesale customers in the period (not a live stock balance). Availability is the share of customer-item pairs currently in stock.</div>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead><tr><th style={th}>Atoll / Island / Item</th><th style={{ ...th, textAlign: "right" }}>Quantity</th><th style={th}>UOM</th><th style={{ ...th, textAlign: "right" }}>Customers stocking</th><th style={th}>Availability</th></tr></thead>
                <tbody>
                  {atolls.map((a) => (
                    <React.Fragment key={a.atoll}>
                      <tr onClick={() => toggle(a.atoll)} style={{ cursor: "pointer", background: "#F8FAFD" }}>
                        <td style={{ ...td, fontWeight: 700, color: COLORS.textPrimary }}>{open[a.atoll] ? "▾" : "▸"} {a.atoll} <span style={{ fontWeight: 500, color: COLORS.textMuted }}>({a.reached}/{a.islands.length} islands supplied)</span></td>
                        <td style={{ ...td, textAlign: "right", fontWeight: 700, color: COLORS.textPrimary }}>{Math.round(a.qty).toLocaleString("en-US")}</td>
                        <td style={td}>KG</td>
                        <td style={{ ...td, textAlign: "right" }}>-</td>
                        <td style={td}><Bar100 value={a.availability} /></td>
                      </tr>
                      {open[a.atoll] && a.islands.map((i) => {
                        const k = a.atoll + "|" + i.island;
                        return (
                          <React.Fragment key={k}>
                            <tr onClick={() => toggle(k)} style={{ cursor: "pointer" }}>
                              <td style={{ ...td, paddingLeft: 30, color: COLORS.textPrimary, fontWeight: 600 }}>{open[k] ? "▾" : "▸"} {i.island} <span style={{ fontWeight: 500, color: COLORS.textMuted }}>({i.itemsStocked}/{i.nItems} items)</span></td>
                              <td style={{ ...td, textAlign: "right" }}>{Math.round(i.qty).toLocaleString("en-US")}</td>
                              <td style={td}>KG</td>
                              <td style={{ ...td, textAlign: "right" }}>{i.customers} registered</td>
                              <td style={td}><Bar100 value={i.availability} /></td>
                            </tr>
                            {open[k] && i.items.map((it) => (
                              <tr key={k + it.item}>
                                <td style={{ ...td, paddingLeft: 56 }}>{it.item}</td>
                                <td style={{ ...td, textAlign: "right" }}>{it.qty ? Math.round(it.qty * 10) / 10 : "-"}</td>
                                <td style={td}>{it.uom === "EA" ? "EA" : "KG"}</td>
                                <td style={{ ...td, textAlign: "right" }}>{it.stocked}/{it.customers}</td>
                                <td style={td}><Bar100 value={it.customers ? Math.round((it.stocked / it.customers) * 100) : 0} /></td>
                              </tr>
                            ))}
                          </React.Fragment>
                        );
                      })}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
