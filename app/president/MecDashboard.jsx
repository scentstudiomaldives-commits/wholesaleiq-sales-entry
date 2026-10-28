"use client";
import React, { useState, useEffect, useMemo, useRef } from "react";
import "leaflet/dist/leaflet.css";

/* ------------------------------------------------------------------
   Maldives Essential Commodities (MEC) dashboard - Presidents Office.
   Three pages, following the Policy Office's sample:
   01 Availability and coverage, 02 Prices and supply, 03 Alerts and reports.
   All data comes from the mec_* database functions (no table access).
------------------------------------------------------------------*/
const C = {
  bg: "#F4F7FB", surface: "#FFFFFF", line: "#E4EAF2", navy: "#0B2E52",
  blue: "#1F6FEB", blueSoft: "#E8F0FE", green: "#0F9D63", greenSoft: "#E4F7EF",
  amber: "#C9821C", amberSoft: "#FBF0DF", red: "#D5433C", redSoft: "#FBE7E6",
  purple: "#6B4FC8", purpleSoft: "#EEE9FB", grey: "#8B99AC",
  text: "#0B2036", text2: "#5B6B80", muted: "#8B99AC",
};
const STATUS = { green: C.green, amber: C.amber, red: C.red, grey: C.grey };
const STATUS_LABEL = { green: "All items available", amber: "Partial availability", red: "Critical shortage", grey: "No current verified report" };
const CATS = ["Greater Male", "Cities", "Over 3000", "3000 or below"];
const CAT_LABEL = { "Greater Male": "Greater Malé", Cities: "Cities excluding Greater Malé", "Over 3000": "Other islands: above 3,000 people", "3000 or below": "Other islands: 3,000 or below" };
const CAT_SHORT = { "Greater Male": "Greater Malé", Cities: "Cities", "Over 3000": "Above 3,000", "3000 or below": "3,000 or below" };
const CAT_TONE = {
  "Greater Male": [C.blueSoft, C.blue], Cities: [C.purpleSoft, C.purple],
  "Over 3000": [C.greenSoft, C.green], "3000 or below": [C.amberSoft, C.amber],
};

// Approximate atoll centres (north at the top). Island dots are spread around their
// atoll for a schematic picture; production should use real island coordinates.
const ATOLL_POS = {
  "Haa Alif Atoll": [6.9, 73.1], "Haa Dhaalu Atoll": [6.55, 73.1], "Shaviyani Atoll": [6.2, 73.15],
  "Noonu Atoll": [5.85, 73.35], "Raa Atoll": [5.55, 72.95], "Baa Atoll": [5.2, 72.95],
  "Lhaviyani Atoll": [5.4, 73.5], "Kaafu Atoll (incl. Malé City)": [4.3, 73.5],
  "Alif Alif Atoll (North Ari)": [4.0, 72.85], "Alif Dhaal Atoll (South Ari)": [3.6, 72.85],
  "Vaavu Atoll": [3.5, 73.55], "Meemu Atoll": [3.0, 73.55], "Faafu Atoll": [3.2, 72.95],
  "Dhaalu Atoll": [2.75, 72.95], "Thaa Atoll": [2.2, 73.1], "Laamu Atoll": [1.9, 73.4],
  "Gaafu Alif Atoll": [0.7, 73.3], "Gaafu Dhaalu Atoll": [0.3, 73.4],
  "Gnaviyani Atoll": [-0.3, 73.4], "Seenu Atoll (Addu City)": [-0.65, 73.15],
};
const hash = (str) => { let h = 0; for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0; return Math.abs(h); };

const fmtDT = (s) => (s ? new Date(s).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Indian/Maldives" }) : "No report");
const fmtD = (s) => (s ? new Date(s).toLocaleDateString("en-GB", { day: "2-digit", month: "short" }) : "-");
const num = (n, d = 0) => (n === null || n === undefined ? "-" : Number(n).toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d }));
const money = (n) => (n === null || n === undefined ? "-" : Number(n).toFixed(2));
const pctTxt = (v) => (v === null || v === undefined ? "-" : (v > 0 ? "+" : "") + v + "%");

function downloadCsv(name, rows) {
  const esc = (v) => { const s = v === null || v === undefined ? "" : String(v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  const blob = new Blob(["﻿" + rows.map((r) => r.map(esc).join(",")).join("\n")], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove();
}

const box = { background: C.surface, border: `1px solid ${C.line}`, borderRadius: 16, padding: "16px 18px", minWidth: 0, overflowX: "auto" };
const th = { textAlign: "left", fontSize: 10.5, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: 0.4, padding: "8px 10px", borderBottom: `1px solid ${C.line}`, whiteSpace: "nowrap" };
const td = { fontSize: 12.5, color: C.text2, padding: "9px 10px", borderBottom: `1px solid ${C.line}`, whiteSpace: "nowrap" };
const h2 = { fontFamily: "Manrope, sans-serif", fontSize: 14.5, fontWeight: 800, color: C.text, marginBottom: 2 };
const sub = { fontSize: 11.5, color: C.muted, marginBottom: 10, lineHeight: 1.5 };
const sel = { padding: "6px 8px", borderRadius: 8, border: `1px solid ${C.line}`, fontSize: 12.5, fontWeight: 600, color: C.text, background: "#fff", maxWidth: "100%" };

function Dot({ status, size = 9 }) {
  return <span title={STATUS_LABEL[status]} style={{ display: "inline-block", width: size, height: size, borderRadius: "50%", background: STATUS[status], marginRight: 7, flexShrink: 0 }} />;
}
function Bar({ value, color = C.green }) {
  return <div style={{ height: 6, background: C.line, borderRadius: 6, width: "100%" }}><div style={{ height: 6, width: `${Math.min(100, Math.max(0, value))}%`, background: color, borderRadius: 6 }} /></div>;
}
function Chg({ v }) {
  if (v === null || v === undefined) return <span style={{ color: C.muted }}>-</span>;
  return <span style={{ fontWeight: 700, color: v > 0 ? C.red : v < 0 ? C.green : C.muted }}>{pctTxt(v)}</span>;
}

function useRpc(supabase, name, args, deps) {
  const [state, setState] = useState({ data: null, error: null, loading: true });
  useEffect(() => {
    let live = true;
    setState((s) => ({ ...s, loading: true }));
    supabase.rpc(name, args || {}).then(({ data, error }) => { if (live) setState({ data: error ? null : data, error: error ? error.message : null, loading: false }); });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return state;
}

/* ============================ MAIN ============================ */
export default function MecDashboard({ supabase, narrow }) {
  const [page, setPage] = useState(1);
  const [fCat, setFCat] = useState("");
  const [fAtoll, setFAtoll] = useState("");
  const [fIsland, setFIsland] = useState("");
  const [itemId, setItemId] = useState(null);

  const overview = useRpc(supabase, "mec_overview", {}, []);
  const itemsRes = useRpc(supabase, "mec_items_list", {}, []);
  const items = itemsRes.data || [];

  useEffect(() => {
    if (!itemId && items.length) setItemId((items.find((i) => i.name === "Red onion") || items[0]).id);
  }, [items, itemId]);

  const all = overview.data?.islands || [];
  const atolls = useMemo(() => [...new Set(all.map((i) => i.atoll))].sort(), [all]);
  const islandsOfAtoll = useMemo(() => all.filter((i) => !fAtoll || i.atoll === fAtoll).sort((a, b) => a.island.localeCompare(b.island) || a.atoll.localeCompare(b.atoll)), [all, fAtoll]);
  const filtered = useMemo(() => all.filter((i) => (!fCat || i.category === fCat) && (!fAtoll || i.atoll === fAtoll) && (!fIsland || i.island === fIsland)), [all, fCat, fAtoll, fIsland]);
  const mapList = useMemo(() => all.filter((i) => !fCat || i.category === fCat), [all, fCat]);

  const selectIsland = (atoll, island) => { setFAtoll(atoll); setFIsland(island); setPage(1); };
  const clearFilters = () => { setFCat(""); setFAtoll(""); setFIsland(""); };
  const item = items.find((i) => i.id === itemId);

  if (overview.error) return <div style={{ ...box, color: C.red, fontSize: 13 }}>Could not load the dashboard: {overview.error}. Run migration_007_mec_dashboard.sql and seed_mec_test_data.sql in Supabase.</div>;

  return (
    <div>
      <div style={{ background: C.amberSoft, border: `1px solid #EBD3A8`, borderRadius: 10, padding: "8px 12px", fontSize: 12, color: "#7A5310", marginBottom: 10 }}>
        TEST DATA ONLY. No verified STO figures. Only the 23 announced Ministry items are real names; the other 57 of the 80 items, the 189-island list and the island categories are placeholders until confirmed.
      </div>

      <div className="mec-noprint" style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
        {[[1, "01 Availability and coverage"], [2, "02 Prices and supply"], [3, "03 Alerts and reports"]].map(([n, l]) => (
          <button key={n} onClick={() => setPage(n)} style={{ padding: "8px 14px", borderRadius: 999, border: "none", cursor: "pointer", fontSize: 12.5, fontWeight: 700, background: page === n ? C.navy : "#fff", color: page === n ? "#fff" : C.text2, boxShadow: page === n ? "none" : `inset 0 0 0 1px ${C.line}` }}>{l}</button>
        ))}
      </div>

      <div className="mec-noprint" style={{ ...box, background: "#EAF0F8", border: "none", padding: "10px 12px", marginBottom: 14, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: C.text }}>Updated {overview.data ? fmtDT(overview.data.asof) : "..."}</span>
        <select style={sel} value={fCat} onChange={(e) => setFCat(e.target.value)}>
          <option value="">Category: all</option>
          {CATS.map((c) => <option key={c} value={c}>{CAT_LABEL[c]}</option>)}
        </select>
        <select style={sel} value={fAtoll} onChange={(e) => { setFAtoll(e.target.value); setFIsland(""); }}>
          <option value="">Atoll: all</option>
          {atolls.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <select style={sel} value={fIsland ? fAtoll + "|" + fIsland : ""} onChange={(e) => { const v = e.target.value; if (!v) setFIsland(""); else { const [a, ...r] = v.split("|"); setFAtoll(a); setFIsland(r.join("|")); } }}>
          <option value="">Island: all</option>
          {islandsOfAtoll.map((i) => <option key={i.atoll + "|" + i.island} value={i.atoll + "|" + i.island}>{fAtoll ? i.island : `${i.island} (${i.atoll.replace(/\s*\(.*?\)/g, "").replace(/ Atoll$/, "")})`}</option>)}
        </select>
        <select style={sel} value={itemId || ""} onChange={(e) => setItemId(Number(e.target.value))}>
          <optgroup label="Ministry list (23 announced items)">
            {items.filter((i) => i.official).map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
          </optgroup>
          <optgroup label="Other items (placeholders)">
            {items.filter((i) => !i.official).map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
          </optgroup>
        </select>
        {(fCat || fAtoll || fIsland) && <button onClick={clearFilters} style={{ ...sel, cursor: "pointer", color: C.blue }}>Clear filters</button>}
        <button onClick={() => window.print()} style={{ ...sel, cursor: "pointer", marginLeft: "auto" }}>Print / save as PDF</button>
      </div>

      {overview.loading && <div style={{ ...box, fontSize: 13, color: C.muted }}>Loading...</div>}
      {!overview.loading && page === 1 && <PageAvailability supabase={supabase} narrow={narrow} all={all} filtered={filtered} mapList={mapList} itemId={itemId} item={item} total={overview.data.items_total} selectIsland={selectIsland} fAtoll={fAtoll} fIsland={fIsland} />}
      {!overview.loading && page === 2 && <PagePrices supabase={supabase} narrow={narrow} itemId={itemId} setItemId={setItemId} />}
      {!overview.loading && page === 3 && <PageAlerts supabase={supabase} narrow={narrow} all={all} itemId={itemId} item={item} meta={overview.data} />}
      <style>{`@media print { .mec-noprint { display: none !important; } body { background: #fff; } }`}</style>
    </div>
  );
}

/* ====================== PAGE 1 ====================== */
function PageAvailability({ supabase, narrow, all, filtered, mapList, itemId, item, total, selectIsland, fAtoll, fIsland }) {
  const stat = (list) => ({
    n: list.length,
    all80: list.filter((i) => i.status === "green").length,
    agents: list.filter((i) => i.agent_operating).length,
    current: list.filter((i) => i.fresh > 0).length,
  });
  const nat = stat(filtered);
  const unknown = nat.n - nat.current;
  const prioShort = filtered.filter((i) => i.priority_short > 0).length;

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div style={{ display: "grid", gridTemplateColumns: narrow ? "1fr 1fr" : "repeat(4, 1fr)", gap: 12 }}>
        {CATS.map((c) => {
          const s = stat(filtered.filter((i) => i.category === c));
          const [bg, fg] = CAT_TONE[c];
          return (
            <div key={c} style={{ background: bg, borderRadius: 14, padding: "12px 14px" }}>
              <div style={{ fontWeight: 800, fontSize: 12.5, color: fg }}>{CAT_SHORT[c]}</div>
              <div style={{ fontSize: 10.5, color: C.text2 }}>{s.n} islands</div>
              <div style={{ fontFamily: "Manrope, sans-serif", fontWeight: 800, fontSize: 26, color: fg, marginTop: 4 }}>{s.all80} / {s.n}</div>
              <div style={{ fontSize: 11.5, color: C.text2 }}>islands with all {total} items</div>
              <div style={{ fontSize: 11, color: C.text2, marginTop: 6 }}>Operating agents {s.agents} / {s.n}</div>
              <div style={{ fontSize: 11, color: C.muted }}>Current reports {s.current} / {s.n}</div>
            </div>
          );
        })}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: narrow ? "1fr" : "minmax(380px, 1fr) minmax(320px, 1fr)", gap: 14, alignItems: "start" }}>
        <div style={box}>
          <div style={h2}>Availability map</div>
          <div style={sub}>One dot per island. Hover for details; select a dot to open the island, and use + / - to zoom.</div>
          <div style={{ fontSize: 11.5, color: C.text2, display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 8 }}>
            {["green", "amber", "red", "grey"].map((s) => (
              <span key={s}><Dot status={s} />{s === "green" ? `All ${total} verified` : s === "amber" ? "Partial" : s === "red" ? "Critical" : "No current report"} <span style={{ color: C.muted }}>({mapList.filter((i) => i.status === s).length})</span></span>
            ))}
          </div>
          <IslandMap list={mapList.length ? mapList : all} selected={fIsland ? fAtoll + "|" + fIsland : ""} focusAtoll={fAtoll} onPick={selectIsland} height={narrow ? 420 : 740} />
          <div style={{ fontSize: 11, color: C.muted, marginTop: 6 }}>Amber and red thresholds are proposals to be agreed. Island positions are from a public dataset and must be checked against official coordinates.</div>
        </div>
        <div style={{ display: "grid", gap: 14, minWidth: 0 }}>
          <div style={box}>
            <div style={h2}>National availability</div>
            <div style={sub}>{nat.n} islands in the current selection</div>
            <div style={{ display: "flex", gap: 28, flexWrap: "wrap", marginBottom: 12 }}>
              <div><div style={{ fontFamily: "Manrope", fontWeight: 800, fontSize: 30, color: C.green }}>{nat.all80} / {nat.n}</div><div style={{ fontSize: 11.5, color: C.text2 }}>all {total} items available</div></div>
              <div><div style={{ fontFamily: "Manrope", fontWeight: 800, fontSize: 30, color: C.green }}>{nat.agents} / {nat.n}</div><div style={{ fontSize: 11.5, color: C.text2 }}>operating STO agents</div></div>
            </div>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: C.text }}>{nat.current} / {nat.n} current reports</div>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: C.text }}>{unknown} islands unknown</div>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: C.red, margin: "6px 0" }}>{prioShort} islands with priority-item shortages</div>
            <div style={{ fontSize: 11, color: C.muted }}>Available means verified stock for purchase on the island. A report older than 48 hours does not count. Missing is not the same as zero stock.</div>
          </div>
          <CommodityPanel supabase={supabase} itemId={itemId} item={item} narrow={true} />
          <SelectedIsland supabase={supabase} all={all} fAtoll={fAtoll} fIsland={fIsland} />
        </div>
      </div>

      <AtollTable supabase={supabase} list={filtered} total={total} selectIsland={selectIsland} fAtoll={fAtoll} fIsland={fIsland} narrow={narrow} />
    </div>
  );
}

function IslandMap({ list, selected, focusAtoll, onPick, height = 540 }) {
  const holder = useRef(null);
  const state = useRef({ map: null, layer: null, L: null });
  const pick = useRef(onPick);
  pick.current = onPick;
  const [ready, setReady] = useState(false);
  const [tilesFailed, setTilesFailed] = useState(false);

  // create the map once (Leaflet is loaded in the browser only)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !holder.current || state.current.map) return;
      const map = L.map(holder.current, { scrollWheelZoom: false, zoomControl: true, minZoom: 5, maxZoom: 13, zoomSnap: 0.25, worldCopyJump: false });
      const tiles = L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
        subdomains: "abcd", maxZoom: 13, attribution: "&copy; OpenStreetMap contributors &copy; CARTO",
      });
      tiles.on("tileerror", () => setTilesFailed(true));
      tiles.addTo(map);
      map.setView([3.2, 73.2], 6);
      state.current = { map, layer: L.layerGroup().addTo(map), L };
      setReady(true);
    })();
    return () => { cancelled = true; if (state.current.map) { state.current.map.remove(); state.current = { map: null, layer: null, L: null }; } };
  }, []);

  // draw the islands whenever the list or selection changes
  useEffect(() => {
    const { map, layer, L } = state.current;
    if (!ready || !map) return;
    layer.clearLayers();
    const pts = [];
    list.forEach((i) => {
      if (i.lat == null || i.lng == null) return;
      const key = i.atoll + "|" + i.island;
      const sel = selected === key;
      const m = L.circleMarker([Number(i.lat), Number(i.lng)], {
        radius: sel ? 10 : 6.5, color: sel ? "#0B2E52" : "#FFFFFF", weight: sel ? 3 : 1.5,
        fillColor: STATUS[i.status], fillOpacity: 0.95,
      });
      m.bindTooltip(`<b>${i.island}</b> (${i.atoll.replace(/\s*\(.*?\)/g, "")})<br/>${i.fresh ? `${i.avail}/${i.total} items available` : "No current report"}<br/>${STATUS_LABEL[i.status]}`, { direction: "top", offset: [0, -6] });
      m.on("click", () => pick.current(i.atoll, i.island));
      m.addTo(layer);
      pts.push([Number(i.lat), Number(i.lng)]);
    });
    if (selected) {
      const s = list.find((i) => i.atoll + "|" + i.island === selected);
      if (s && s.lat != null) { map.setView([Number(s.lat), Number(s.lng)], 11); return; }
    }
    const focus = focusAtoll ? list.filter((i) => i.atoll === focusAtoll && i.lat != null).map((i) => [Number(i.lat), Number(i.lng)]) : [];
    const target = focus.length ? focus : pts;
    if (target.length) map.fitBounds(target, { padding: [20, 20], maxZoom: focus.length ? 10.5 : 9.5 });
  }, [ready, list, selected, focusAtoll]);

  const missing = list.filter((i) => i.lat == null).length;
  return (
    <div style={{ position: "relative", width: "100%" }}>
      <div ref={holder} style={{ height, width: "100%", borderRadius: 12, background: "#DCEBF5", overflow: "hidden", zIndex: 0 }} role="img" aria-label="Island availability map" />
      {tilesFailed && <div style={{ position: "absolute", left: 10, bottom: 10, background: "rgba(255,255,255,0.92)", fontSize: 11, color: C.text2, padding: "4px 8px", borderRadius: 6, zIndex: 500 }}>Base map unavailable. Island positions are still shown.</div>}
      {missing > 0 && <div style={{ fontSize: 11, color: C.muted, marginTop: 6 }}>{missing} islands have no coordinates and are not shown on the map.</div>}
    </div>
  );
}

function SelectedIsland({ supabase, all, fAtoll, fIsland }) {
  const row = fIsland ? all.find((i) => i.atoll === fAtoll && i.island === fIsland) : null;
  if (!row) return (
    <div style={{ ...box, color: C.muted, fontSize: 12.5 }}>
      <div style={h2}>Island detail</div>
      Select an island on the map or in the list below to see its unavailable items, shops, agents, prices and stock.
    </div>
  );
  return (
    <div style={box}>
      <div style={h2}><Dot status={row.status} />{row.island} <span style={{ fontWeight: 500, color: C.muted, fontSize: 12 }}>{row.atoll} · {CAT_SHORT[row.category]}</span></div>
      <div style={sub}>{row.fresh ? `${row.avail} of ${row.total} items verified available` : "No current verified report"} · last verified {fmtDT(row.last_verified)}</div>
      <div style={{ fontSize: 12.5, color: C.text2, lineHeight: 1.6 }}><IslandDetail supabase={supabase} row={row} /></div>
    </div>
  );
}

function CommodityPanel({ supabase, itemId, item, narrow }) {
  const v = useRpc(supabase, "mec_item_view", { p_item: itemId }, [itemId]);
  if (!itemId) return null;
  const cov = v.data?.coverage || [];
  const totAvail = cov.reduce((s, c) => s + c.available, 0);
  const totIslands = cov.reduce((s, c) => s + c.islands, 0);
  return (
    <div style={box}>
      <div style={h2}>Selected commodity: {item ? item.name : ""}</div>
      <div style={sub}>Islands where this item is verified available (current reports only). Change the commodity in the filter bar.</div>
      {v.error && <div style={{ color: C.red, fontSize: 12.5 }}>{v.error}</div>}
      {v.data && (
        <div style={{ display: "grid", gridTemplateColumns: narrow ? "1fr" : "1fr 1.4fr", gap: 18, alignItems: "center" }}>
          <div>
            <div style={{ fontFamily: "Manrope", fontWeight: 800, fontSize: 30, color: C.green }}>{totAvail} / {totIslands} islands</div>
            <div style={{ fontSize: 12, color: C.text2 }}>verified available · {totIslands ? Math.round((totAvail / totIslands) * 100) : 0}% national coverage</div>
          </div>
          <div style={{ display: "grid", gap: 8 }}>
            {cov.map((c) => (
              <div key={c.category} style={{ display: "grid", gridTemplateColumns: "150px 1fr 70px", gap: 10, alignItems: "center", fontSize: 12 }}>
                <span style={{ color: C.text2 }}>{CAT_SHORT[c.category]}</span>
                <Bar value={c.islands ? (c.available / c.islands) * 100 : 0} />
                <span style={{ fontWeight: 700, color: C.text }}>{c.available}/{c.islands}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function AtollTable({ supabase, list, total, selectIsland, fAtoll, fIsland, narrow }) {
  const [open, setOpen] = useState({});
  const groups = useMemo(() => {
    const m = new Map();
    list.forEach((i) => { if (!m.has(i.atoll)) m.set(i.atoll, []); m.get(i.atoll).push(i); });
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [list]);
  const toggle = (k) => setOpen((o) => ({ ...o, [k]: !o[k] }));
  useEffect(() => { if (fAtoll) setOpen((o) => ({ ...o, [fAtoll]: true, ...(fIsland ? { [fAtoll + "|" + fIsland]: true } : {}) })); }, [fAtoll, fIsland]);

  const exportRows = () => downloadCsv("island_availability.csv", [
    ["Atoll", "Island", "Category", "Status", "Items available", "Items total", "Last verified", "STO shop", "Agent appointed", "Agent operating", "Unavailable items"],
    ...list.map((i) => [i.atoll, i.island, CAT_LABEL[i.category], STATUS_LABEL[i.status], i.avail, i.total, i.last_verified || "", i.shop ? "yes" : "no", i.agent_appointed ? "yes" : "no", i.agent_operating ? "yes" : "no", (i.missing || []).join("; ")]),
  ]);

  return (
    <div style={box}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, flexWrap: "wrap" }}>
        <div><div style={h2}>Atoll, island and item records</div><div style={sub}>Select an atoll, then an island, to see unavailable items, shops and agents, prices and stock.</div></div>
        <button className="mec-noprint" onClick={exportRows} style={{ ...sel, cursor: "pointer", color: C.blue }}>Download CSV</button>
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead><tr><th style={th}>Atoll / island</th><th style={th}>Category</th><th style={{ ...th, textAlign: "right" }}>Items</th><th style={th}>STO agent</th><th style={th}>Verified</th></tr></thead>
        <tbody>
          {groups.map(([atoll, rows]) => {
            const ok = rows.filter((r) => r.status === "green").length;
            return (
              <React.Fragment key={atoll}>
                <tr onClick={() => toggle(atoll)} style={{ cursor: "pointer", background: "#F8FAFD" }}>
                  <td style={{ ...td, fontWeight: 700, color: C.text }}>{open[atoll] ? "▾" : "▸"} {atoll} <span style={{ fontWeight: 500, color: C.muted }}>({rows.length} islands)</span></td>
                  <td style={td}></td>
                  <td style={{ ...td, textAlign: "right" }}>{ok} / {rows.length} complete</td>
                  <td style={td}>{rows.filter((r) => r.agent_operating).length} operating</td>
                  <td style={td}></td>
                </tr>
                {open[atoll] && rows.map((r) => {
                  const k = atoll + "|" + r.island;
                  return (
                    <React.Fragment key={k}>
                      <tr onClick={() => toggle(k)} style={{ cursor: "pointer", background: fIsland === r.island && fAtoll === atoll ? C.blueSoft : "transparent" }}>
                        <td style={{ ...td, paddingLeft: 28, color: C.text, fontWeight: 600 }}><Dot status={r.status} />{r.island}</td>
                        <td style={td}>{CAT_SHORT[r.category]}</td>
                        <td style={{ ...td, textAlign: "right" }}>{r.fresh ? `${r.avail} / ${r.total}` : "Unknown"}</td>
                        <td style={td}>{r.agent_operating ? "Operating" : r.agent_appointed ? "Appointed, not operating" : "None"}{r.shop ? " · STO shop" : ""}</td>
                        <td style={td}>{fmtDT(r.last_verified)}</td>
                      </tr>
                      {open[k] && <tr><td colSpan={5} style={{ ...td, whiteSpace: "normal", background: "#FBFCFE" }}><IslandDetail supabase={supabase} row={r} /></td></tr>}
                    </React.Fragment>
                  );
                })}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function IslandDetail({ supabase, row }) {
  const d = useRpc(supabase, "mec_island_detail", { p_atoll: row.atoll, p_island: row.island }, [row.atoll, row.island]);
  const [showAll, setShowAll] = useState(false);
  if (d.loading) return <span style={{ color: C.muted }}>Loading...</span>;
  if (d.error) return <span style={{ color: C.red }}>{d.error}</span>;
  const its = d.data.items || [];
  const shown = showAll ? its : its.filter((i) => !i.fresh || !i.available);
  return (
    <div style={{ display: "grid", gap: 10 }}>
      <div>
        <b style={{ color: C.text }}>Unavailable items ({row.missing.length}):</b>{" "}
        {row.fresh === 0 ? "No current report for this island." : row.missing.length ? row.missing.join(", ") : "None. All items verified available."}
      </div>
      <div>
        <b style={{ color: C.text }}>STO shops and agents:</b>{" "}
        {d.data.outlets.length ? d.data.outlets.map((o, i) => <span key={i} style={{ marginRight: 12 }}>{o.name} ({o.status.replace("_", " ")}, last delivery {fmtD(o.last_delivery)}, verified {fmtDT(o.last_verified)})</span>) : "None registered."}
        <div style={{ fontSize: 11, color: C.muted }}>Agent appointment is not evidence of availability. Availability comes from the verified reports above.</div>
      </div>
      <div>
        <button onClick={() => setShowAll((s) => !s)} style={{ ...sel, cursor: "pointer", color: C.blue }}>{showAll ? "Show only items to follow up" : "Show all items with price and stock"}</button>
        {shown.length > 0 && (
          <div style={{ maxHeight: 260, overflowY: "auto", marginTop: 8 }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr><th style={th}>Item</th><th style={th}>Status</th><th style={{ ...th, textAlign: "right" }}>Stock</th><th style={{ ...th, textAlign: "right" }}>Price (MVR)</th><th style={th}>Verified</th></tr></thead>
              <tbody>{shown.map((i) => (
                <tr key={i.id}>
                  <td style={td}>{i.name} <span style={{ color: C.muted }}>/ {i.unit}</span></td>
                  <td style={{ ...td, color: !i.fresh ? C.grey : i.available ? C.green : C.red, fontWeight: 700 }}>{!i.fresh ? "No current report" : i.available ? "Available" : "Not available"}</td>
                  <td style={{ ...td, textAlign: "right" }}>{i.available && i.stock != null ? num(i.stock) : "-"}</td>
                  <td style={{ ...td, textAlign: "right" }}>{money(i.price)}</td>
                  <td style={td}>{fmtDT(i.verified_at)}</td>
                </tr>))}</tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

/* ====================== PAGE 2 ====================== */
function PagePrices({ supabase, narrow, itemId, setItemId }) {
  const prices = useRpc(supabase, "mec_prices_overview", {}, []);
  const supply = useRpc(supabase, "mec_supply", {}, []);
  const detail = useRpc(supabase, "mec_item_view", { p_item: itemId }, [itemId]);
  const [q, setQ] = useState("");
  const rows = (prices.data || []).filter((r) => !q || r.name.toLowerCase().includes(q.toLowerCase()));
  const d = detail.data;
  const gm = d?.prices?.find((p) => p.category === "Greater Male");

  const exportPrices = () => downloadCsv("prices_by_category.csv", [
    ["Item", "Unit", "Greater Male", "Cities", "Above 3000", "3000 or below", "National average", "Weekly change %", "Monthly change %", "Islands reporting", "Islands with no price"],
    ...(prices.data || []).map((r) => [r.name, r.unit, r.gm, r.cities, r.over3000, r.under3000, r.national, r.week_change_pct, r.month_change_pct, r.reporting, r.missing_islands]),
  ]);

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div style={box}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
          <div><div style={h2}>Average retail prices across the four categories (MVR per standard unit)</div>
            <div style={sub}>Current reports only. Same unit and pack size for each item; islands with no current price are counted separately. Select a row for detail.</div></div>
          <div className="mec-noprint" style={{ display: "flex", gap: 8 }}>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search item" style={{ ...sel, width: 140 }} />
            <button onClick={exportPrices} style={{ ...sel, cursor: "pointer", color: C.blue }}>Download CSV</button>
          </div>
        </div>
        {prices.error && <div style={{ color: C.red, fontSize: 12.5 }}>{prices.error}</div>}
        <div style={{ maxHeight: 360, overflowY: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr><th style={th}>Item / unit</th><th style={{ ...th, textAlign: "right" }}>Greater Malé</th><th style={{ ...th, textAlign: "right" }}>Cities</th><th style={{ ...th, textAlign: "right" }}>Above 3,000</th><th style={{ ...th, textAlign: "right" }}>3,000 or below</th><th style={{ ...th, textAlign: "right" }}>Weekly</th><th style={{ ...th, textAlign: "right" }}>Monthly</th><th style={{ ...th, textAlign: "right" }}>Islands reporting</th></tr></thead>
            <tbody>{rows.map((r) => (
              <tr key={r.id} onClick={() => setItemId(r.id)} style={{ cursor: "pointer", background: r.id === itemId ? C.blueSoft : "transparent" }}>
                <td style={{ ...td, color: C.text, fontWeight: 600 }}>{r.name} <span style={{ color: C.muted, fontWeight: 400 }}>/ {r.unit}</span>{r.official ? <span style={{ marginLeft: 8, fontSize: 10, fontWeight: 700, color: C.green, background: C.greenSoft, borderRadius: 999, padding: "2px 7px" }}>Ministry list</span> : null}</td>
                <td style={{ ...td, textAlign: "right" }}>{money(r.gm)}</td><td style={{ ...td, textAlign: "right" }}>{money(r.cities)}</td>
                <td style={{ ...td, textAlign: "right" }}>{money(r.over3000)}</td><td style={{ ...td, textAlign: "right" }}>{money(r.under3000)}</td>
                <td style={{ ...td, textAlign: "right" }}><Chg v={r.week_change_pct} /></td><td style={{ ...td, textAlign: "right" }}><Chg v={r.month_change_pct} /></td>
                <td style={{ ...td, textAlign: "right" }}>{r.reporting}{r.missing_islands > 0 ? <span style={{ color: C.muted }}> ({r.missing_islands} no price)</span> : null}</td>
              </tr>))}</tbody>
          </table>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: narrow ? "1fr" : "1.3fr 1fr", gap: 14 }}>
        <div style={box}>
          <div style={h2}>Price detail: {d?.item?.name || ""}</div>
          <div style={sub}>Per island category. Difference is against Greater Malé. Shops are STO shops on islands reporting a current price.</div>
          {detail.loading && <span style={{ color: C.muted }}>Loading...</span>}
          {d && (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr><th style={th}>Category</th><th style={{ ...th, textAlign: "right" }}>Average</th><th style={{ ...th, textAlign: "right" }}>Lowest</th><th style={{ ...th, textAlign: "right" }}>Highest</th><th style={{ ...th, textAlign: "right" }}>Week</th><th style={{ ...th, textAlign: "right" }}>Month</th><th style={{ ...th, textAlign: "right" }}>vs Malé</th><th style={{ ...th, textAlign: "right" }}>Islands / shops</th></tr></thead>
              <tbody>{CATS.map((c) => {
                const p = d.prices.find((x) => x.category === c) || {};
                const wk = p.week_ago ? Math.round((p.avg_price / p.week_ago - 1) * 1000) / 10 : null;
                const mo = p.month_ago ? Math.round((p.avg_price / p.month_ago - 1) * 1000) / 10 : null;
                const vs = gm?.avg_price && c !== "Greater Male" && p.avg_price ? Math.round((p.avg_price / gm.avg_price - 1) * 1000) / 10 : null;
                return (<tr key={c}><td style={{ ...td, color: C.text, fontWeight: 600 }}>{CAT_SHORT[c]}</td><td style={{ ...td, textAlign: "right" }}>{money(p.avg_price)}</td><td style={{ ...td, textAlign: "right" }}>{money(p.min_price)}</td><td style={{ ...td, textAlign: "right" }}>{money(p.max_price)}</td><td style={{ ...td, textAlign: "right" }}><Chg v={wk} /></td><td style={{ ...td, textAlign: "right" }}><Chg v={mo} /></td><td style={{ ...td, textAlign: "right" }}>{vs === null ? "-" : pctTxt(vs)}</td><td style={{ ...td, textAlign: "right" }}>{p.n_islands ?? 0} / {p.n_shops ?? 0}</td></tr>);
              })}</tbody>
            </table>
          )}
        </div>
        <div style={box}>
          <div style={h2}>Country of production: {d?.item?.name || ""}</div>
          <div style={sub}>Share of supply by origin (placeholder data). A single source is flagged.</div>
          {d && (d.origins.length ? (
            <div style={{ display: "grid", gap: 10 }}>
              {d.origins.map((o) => (
                <div key={o.country}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 700, color: C.text }}><span>{o.country}</span><span>{o.share_pct}%</span></div>
                  <Bar value={o.share_pct} color={o.alternative ? C.purple : C.green} />
                  {o.supplier_country && <div style={{ fontSize: 11, color: C.muted }}>Supplier country: {o.supplier_country}</div>}
                </div>))}
              {d.origins.length === 1 && <div style={{ fontSize: 12, color: C.red, fontWeight: 700 }}>Single-source dependence: no alternative source recorded.</div>}
            </div>
          ) : <div style={{ fontSize: 12.5, color: C.muted }}>No origin recorded for this item yet.</div>)}
        </div>
      </div>

      <div style={box}>
        <div style={h2}>Stock adequacy and incoming supply</div>
        <div style={sub}>National warehouse stock, incoming shipments and island stock are kept separate. Days of cover = usable stock divided by daily use. Cover under {supply.data?.low_stock_days ?? 7} days raises a gap ticket (proposed threshold).</div>
        {supply.error && <div style={{ color: C.red, fontSize: 12.5 }}>{supply.error}</div>}
        {supply.data && (
          <div style={{ display: "grid", gridTemplateColumns: narrow ? "1fr" : "1fr 1.4fr", gap: 16 }}>
            <div style={{ maxHeight: 320, overflowY: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead><tr><th style={th}>Warehouse item</th><th style={{ ...th, textAlign: "right" }}>Usable</th><th style={{ ...th, textAlign: "right" }}>Days</th></tr></thead>
                <tbody>{supply.data.warehouse.map((w) => (
                  <tr key={w.item_id} onClick={() => setItemId(w.item_id)} style={{ cursor: "pointer", background: w.item_id === itemId ? C.blueSoft : "transparent" }}>
                    <td style={td}>{w.name}</td><td style={{ ...td, textAlign: "right" }}>{num(w.usable_qty)} {w.unit}</td>
                    <td style={{ ...td, textAlign: "right", fontWeight: 700, color: w.days < supply.data.low_stock_days ? C.red : C.text2 }}>{w.days}</td>
                  </tr>))}</tbody>
              </table>
            </div>
            <div style={{ maxHeight: 320, overflowY: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead><tr><th style={th}>Incoming</th><th style={{ ...th, textAlign: "right" }}>Quantity</th><th style={th}>ETA</th><th style={{ ...th, textAlign: "right" }}>Island allocation</th><th style={th}>Delivery status</th></tr></thead>
                <tbody>{supply.data.shipments.map((s, i) => (
                  <tr key={i} onClick={() => setItemId(s.item_id)} style={{ cursor: "pointer", background: s.item_id === itemId ? C.blueSoft : "transparent" }}>
                    <td style={td}>{s.name}</td><td style={{ ...td, textAlign: "right" }}>{num(s.qty)} {s.unit}</td><td style={td}>{fmtD(s.eta)}</td>
                    <td style={{ ...td, textAlign: "right" }}>{num(s.island_allocation)}</td>
                    <td style={{ ...td, color: s.status === "Delayed" ? C.red : C.text2, fontWeight: s.status === "Delayed" ? 700 : 500 }}>{s.status}{s.status === "Delayed" ? ` (${s.delay_reason}; revised ${fmtD(s.revised_date)})` : ""}</td>
                  </tr>))}</tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ====================== PAGE 3 ====================== */
function PageAlerts({ supabase, narrow, all, itemId, item, meta }) {
  const alerts = useRpc(supabase, "mec_alerts", {}, []);
  const cov = useRpc(supabase, "mec_item_coverage_all", {}, []);
  const prices = useRpc(supabase, "mec_prices_overview", {}, []);
  const A = alerts.data;
  const fresh = all.filter((i) => i.fresh > 0).length;
  const ag = all.filter((i) => i.agent_operating).length;
  const all80 = all.filter((i) => i.status === "green").length;
  const prev = A?.snapshots?.[0];
  const itemNow = cov.data?.find((c) => c.id === itemId)?.available;
  const statusColor = { Open: C.red, "Dispatch Scheduled": C.amber, "In Transit": C.blue, Resolved: C.green };

  const exportShops = () => downloadCsv("shops_and_agents.csv", [
    ["Atoll", "Island", "Category", "STO shop", "Agent appointed", "Agent operating"],
    ...all.map((i) => [i.atoll, i.island, CAT_LABEL[i.category], i.shop ? "yes" : "no", i.agent_appointed ? "yes" : "no", i.agent_operating ? "yes" : "no"]),
  ]);
  const exportCoverage = () => downloadCsv("item_island_coverage.csv", [
    ["Item", "Unit", "Islands with item available", "Islands in scope"], ...(cov.data || []).map((c) => [c.name, c.unit, c.available, all.length]),
  ]);
  const exportIslands = () => downloadCsv("islands_and_items.csv", [
    ["Atoll", "Island", "Category", "Status", "Items available", "Unavailable items"],
    ...all.map((i) => [i.atoll, i.island, CAT_LABEL[i.category], STATUS_LABEL[i.status], `${i.avail}/${i.total}`, (i.missing || []).join("; ")]),
  ]);
  const exportPrices = () => downloadCsv("prices_by_category.csv", [
    ["Item", "Unit", "Greater Male", "Cities", "Above 3000", "3000 or below", "Weekly change %", "Monthly change %", "Islands reporting"],
    ...(prices.data || []).map((r) => [r.name, r.unit, r.gm, r.cities, r.over3000, r.under3000, r.week_change_pct, r.month_change_pct, r.reporting]),
  ]);
  const exportTickets = () => downloadCsv("gap_tickets.csv", [
    ["Issue", "Affected", "Item", "Owner", "Deadline", "Status", "Raised by"], ...(A?.tickets || []).map((t) => [t.issue, t.affected, t.item || "", t.owner, t.deadline, t.status, t.auto ? "system" : "manual"]),
  ]);

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div style={{ display: "grid", gridTemplateColumns: narrow ? "1fr" : "1.6fr 1fr", gap: 14 }}>
        <div style={box}>
          <div style={h2}>Corrective action register</div>
          <div style={sub}>Tickets are raised automatically from the agreed thresholds (proposed: under 7 days of stock, price rise above 15% in a week) and tracked to resolution.</div>
          {alerts.error && <div style={{ color: C.red, fontSize: 12.5 }}>{alerts.error}</div>}
          {A && (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr><th style={th}>Issue</th><th style={th}>Affected</th><th style={th}>Owner / deadline</th><th style={th}>Status</th></tr></thead>
              <tbody>{A.tickets.map((t) => (
                <tr key={t.id}><td style={{ ...td, color: C.text, fontWeight: 600, whiteSpace: "normal" }}>{t.issue}</td><td style={td}>{t.affected}</td><td style={td}>{t.owner} / {fmtD(t.deadline)}</td>
                  <td style={{ ...td, fontWeight: 700, color: statusColor[t.status] }}>{t.status}</td></tr>))}</tbody>
            </table>
          )}
        </div>
        <div style={box}>
          <div style={h2}>Reporting status</div>
          <div style={{ fontFamily: "Manrope", fontWeight: 800, fontSize: 30, color: C.green }}>{fresh} / {all.length}</div>
          <div style={{ fontSize: 12, color: C.text2, marginBottom: 6 }}>islands with current reports · {all.length ? ((fresh / all.length) * 100).toFixed(1) : 0}%</div>
          <Bar value={all.length ? (fresh / all.length) * 100 : 0} />
          <div style={{ fontSize: 11.5, color: C.text2, marginTop: 10 }}>Last dashboard refresh: {fmtDT(meta.asof)}</div>
          <div style={{ fontSize: 11.5, color: C.text2 }}>{all.length - fresh} island positions need verification.</div>
          <div style={{ fontSize: 11.5, color: C.red, fontWeight: 700, marginTop: 8 }}>Missing is not zero stock. Stale is not verified available.</div>
          <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>A report turns Grey after {meta.stale_hours} hours without verification.</div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: narrow ? "1fr" : "1.6fr 1fr", gap: 14 }}>
        <div style={box}>
          <div style={h2}>Trends since previous reporting period</div>
          <div style={sub}>Compared with the snapshot of {prev ? fmtD(prev.snap_date) : "-"}.</div>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr><th style={th}>Indicator</th><th style={{ ...th, textAlign: "right" }}>Previous</th><th style={{ ...th, textAlign: "right" }}>Current</th><th style={{ ...th, textAlign: "right" }}>Change</th></tr></thead>
            <tbody>
              {[["Islands with all items available", prev?.all_items_islands, all80], ["Operating STO agents", prev?.operating_agents, ag],
                [`${item?.name || "Item"}: island coverage`, prev?.item_islands?.[item?.name], itemNow]].map(([k, p, c]) => (
                <tr key={k}><td style={{ ...td, color: C.text, fontWeight: 600 }}>{k}</td><td style={{ ...td, textAlign: "right" }}>{p ?? "n/a"}{p != null ? ` / ${all.length}` : ""}</td><td style={{ ...td, textAlign: "right" }}>{c ?? "-"} / {all.length}</td>
                  <td style={{ ...td, textAlign: "right", fontWeight: 700, color: p != null && c > p ? C.green : p != null && c < p ? C.red : C.muted }}>{p != null && c != null ? (c - p > 0 ? "+" : "") + (c - p) + " islands" : "-"}</td></tr>))}
            </tbody>
          </table>
        </div>
        <div style={box}>
          <div style={h2}>Alerts to configure</div>
          <ul style={{ margin: "6px 0 0", paddingLeft: 18, fontSize: 12.5, color: C.text2, lineHeight: 1.9 }}>
            <li>Priority items unavailable</li><li>Stockout before next delivery</li><li>Price spikes and persistent shortages</li>
            <li>Delayed deliveries and outdated reports</li><li>Weather and sea-state disruption (not yet connected)</li>
          </ul>
        </div>
      </div>

      <div style={box}>
        <div style={h2}>Download reports</div>
        <div style={sub}>CSV files open in Excel. Each file reflects the data at the time of download. PDF: use Print / save as PDF above.</div>
        <div style={{ display: "grid", gridTemplateColumns: narrow ? "1fr" : "repeat(3, 1fr)", gap: 14 }}>
          {[["Islands and items", "Island names, categories, available and unavailable items, island coverage per item.", [["Islands and items", exportIslands], ["Coverage per item", exportCoverage]]],
            ["STO shops and agents", "Islands with shops, appointed agents and operating agents.", [["Shops and agents", exportShops]]],
            ["Prices, origins and actions", "Prices across the four categories, gap tickets.", [["Prices", exportPrices], ["Gap tickets", exportTickets]]]].map(([t, d, btns]) => (
            <div key={t}><div style={{ fontWeight: 800, fontSize: 12.5, color: C.text }}>{t}</div><div style={{ fontSize: 11.5, color: C.muted, margin: "2px 0 8px" }}>{d}</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{btns.map(([l, f]) => <button key={l} onClick={f} style={{ ...sel, cursor: "pointer", color: C.blue }}>{l} (CSV)</button>)}</div></div>))}
        </div>
      </div>
    </div>
  );
}
