"use client";
import React, { useState, useMemo, useContext, createContext, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../lib/supabaseClient";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, Treemap,
  RadialBarChart, RadialBar, ComposedChart, Area, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ResponsiveContainer, PolarAngleAxis
} from "recharts";
import {
  LayoutDashboard, Map as MapIcon, Building2, Users, Package, Tags, UserCheck,
  Warehouse, TrendingDown, ChevronRight, Search, Calendar, Filter,
  ArrowUp, ArrowDown, AlertTriangle, CheckCircle2, XCircle, Circle,
  Bell, Upload, X, Download, RefreshCcw, Database, CloudUpload
} from "lucide-react";

/* ---------------------------------------------------------------
   DESIGN TOKENS
------------------------------------------------------------------*/
const COLORS = {
  bg: "#F4F7FB", surface: "#FFFFFF", line: "#E4EAF2",
  navy: "#0B2E52", navyLight: "#123B68", blue: "#1F6FEB", blueSoft: "#E8F0FE",
  green: "#0F9D63", greenSoft: "#E4F7EF", amber: "#C9821C", amberSoft: "#FBF0DF",
  red: "#D5433C", redSoft: "#FBE7E6", textPrimary: "#0B2036", textSecondary: "#5B6B80", textMuted: "#8B99AC",
};
const BRAND_PALETTE = ["#1F6FEB", "#0F9D63", "#C9821C", "#7C5CE0", "#D5433C", "#0EA5A0", "#5B6B80"];

const fmt = (n) => "MVR " + Math.round(n || 0).toLocaleString("en-US");
const fmtShort = (n) => {
  n = n || 0;
  if (n >= 1000000) return "MVR " + (n / 1000000).toFixed(2) + "M";
  if (n >= 1000) return "MVR " + (n / 1000).toFixed(0) + "K";
  return "MVR " + Math.round(n);
};
const pct = (n) => Math.round(n || 0) + "%";
const toNum = (v, def = 0) => { if (v === undefined || v === null || v === "") return def; const n = parseFloat(String(v).replace(/,/g, "")); return isNaN(n) ? def : n; };
const toBool = (v) => /^(y|yes|true|1)$/i.test(String(v || "").trim());

function seededRandom(seed) { let s = seed; return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; }; }
const rnd = seededRandom(Date.now() % 100000); // reseeded each page load so demo figures visibly differ from real data
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
const range = (n) => Array.from({ length: n }, (_, i) => i);

/* ---------------------------------------------------------------
   DEMO DATA GENERATION — produces RAW ROWS in the same shape as
   an uploaded CSV/Excel export, so demo and live data share one
   pipeline (buildModel).
------------------------------------------------------------------*/
const ATOLLS = [
  { name: "Kaafu Atoll", islands: ["Male' City", "Hulhumale'", "Villingili", "Guraidhoo"] },
  { name: "Alifu Alifu Atoll", islands: ["Rasdhoo", "Thoddoo", "Ukulhas"] },
  { name: "Baa Atoll", islands: ["Eydhafushi", "Goidhoo", "Dharavandhoo", "Kihaadhoo"] },
  { name: "Laamu Atoll", islands: ["Fonadhoo", "Gan", "Maabaidhoo"] },
  { name: "Addu City", islands: ["Hithadhoo", "Maradhoo", "Feydhoo", "Hulhudhoo"] },
];
const DEMO_BRANDS = [
  { name: "Coral Foods", category: "Grocery & Staples" },
  { name: "Reef Beverages", category: "Beverages" },
  { name: "AtollFresh Dairy", category: "Dairy & Chilled" },
  { name: "Palm Grove Snacks", category: "Snacks & Confectionery" },
  { name: "BlueWave Household", category: "Home Care" },
  { name: "LagoonCare Personal", category: "Personal Care" },
  { name: "Monsoon Tea Co.", category: "Beverages" },
];
const REPS = ["Ahmed Nizam", "Fathimath Shaha", "Hussain Rasheed", "Aminath Wisha", "Ibrahim Naail", "Mariyam Zulfa", "Moosa Faisal", "Aishath Reema"];
const CUSTOMER_TYPES = ["Supermarket", "Guesthouse Supplier", "Cafe/Restaurant", "Mini Mart", "Resort Store"];

function generateDemoCustomerRows() {
  const rows = [];
  ATOLLS.forEach((atoll) => {
    atoll.islands.forEach((island) => {
      const custCount = 3 + Math.floor(rnd() * 4);
      range(custCount).forEach((ci) => {
        const monthly = 4000 + rnd() * 28000;
        const target = monthly * (0.85 + rnd() * 0.3);
        const isLost = rnd() < 0.03;
        rows.push({
          region: atoll.name, area: island,
          customer_name: `${island} ${pick(["Trading", "Mart", "Stores", "Supply Co.", "General"])} ${ci + 1}`,
          customer_code: `C-${atoll.name[0]}${island[0]}${ci}${Math.floor(rnd() * 900 + 100)}`,
          rep: pick(REPS), customer_type: pick(CUSTOMER_TYPES),
          status: isLost ? "lost" : "active", is_new: rnd() < 0.08 ? "yes" : "no",
          monthly_sales: Math.round(monthly), target: Math.round(target),
          gp: Math.round(monthly * (0.14 + rnd() * 0.1)),
          portfolio_pct: Math.round(55 + rnd() * 44),
          last_visit_days: Math.floor(rnd() * 55),
          next_visit_days: Math.max(1, 14 - Math.floor(rnd() * 14)),
          credit_limit: Math.round(20000 + rnd() * 60000),
          outstanding: Math.round(rnd() * 45000),
          days_since_purchase: Math.floor(rnd() * 40),
          growth_pct: Math.round((rnd() * 24 - 8) * 10) / 10,
        });
      });
    });
  });
  return rows;
}

function generateDemoSkuRows(totalCustomers) {
  const rows = [];
  DEMO_BRANDS.forEach((b) => {
    range(3 + Math.floor(rnd() * 3)).forEach((i) => {
      const required = totalCustomers;
      const available = Math.round(required * (0.55 + rnd() * 0.42));
      const monthlySales = Math.round(8000 + rnd() * 34000);
      rows.push({
        brand: b.name, category: b.category,
        sku: `${b.name.split(" ")[0]} ${pick(["Classic", "Family Pack", "500ml", "1L", "Mini", "Value Pack", "Original"])} ${i + 1}`,
        required_customers: required, available_customers: available,
        facing: Math.round(1 + rnd() * 4), shelf_share_pct: Math.round(5 + rnd() * 30),
        competitor_present: rnd() > 0.5 ? "yes" : "no",
        days_since_purchase: Math.floor(rnd() * 45),
        monthly_sales: monthlySales, gp_pct: Math.round((13 + rnd() * 10) * 10) / 10,
        prior_month_sales: Math.round(monthlySales * (0.88 + rnd() * 0.2)),
        avg_unit_value: Math.round(8 + rnd() * 55),
      });
    });
  });
  return rows;
}

function generateDemoStockRows() {
  return DEMO_BRANDS.map((b) => ({
    brand: b.name,
    stock_units: Math.round(2000 + rnd() * 12000),
    days_of_cover: Math.round(8 + rnd() * 40),
    out_of_stock: Math.round(rnd() * 6),
    low_stock: Math.round(2 + rnd() * 8),
    near_expiry: Math.round(rnd() * 5),
  }));
}

/* ---------------------------------------------------------------
   BUILD MODEL — pure function: raw rows in, full computed
   dashboard data model out. Runs identically for demo or
   uploaded data.
------------------------------------------------------------------*/
function buildModel(customerRows, skuRows, stockRows, trendRows) {
  const activeRows = customerRows.filter((r) => String(r.status || "active").toLowerCase() !== "lost");
  const lostRows = customerRows.filter((r) => String(r.status || "active").toLowerCase() === "lost");

  const mkCustomer = (r, i) => {
    const monthlySales = toNum(r.monthly_sales);
    const gp = toNum(r.gp, monthlySales * 0.18);
    const target = toNum(r.target, monthlySales);
    return {
      id: r.customer_code || `${r.region}-${r.area}-${i}`,
      name: r.customer_name || `Customer ${i + 1}`,
      code: r.customer_code || `C-${i + 1}`,
      region: r.region, area: r.area, rep: r.rep || "Unassigned",
      type: r.customer_type || "General",
      monthlySales, annualSales: toNum(r.annual_sales, Math.round(monthlySales * 11.5)),
      target, achievement: target ? Math.round((monthlySales / target) * 100) : 0,
      gp, gpPct: monthlySales ? Math.round((gp / monthlySales) * 1000) / 10 : 0,
      portfolio: toNum(r.portfolio_pct, 70),
      ranking: 0,
      lastVisit: toNum(r.last_visit_days, 0),
      nextVisit: toNum(r.next_visit_days, 7),
      creditLimit: toNum(r.credit_limit, 0),
      outstanding: toNum(r.outstanding, 0),
      daysSincePurchase: toNum(r.days_since_purchase, 0),
      growth: toNum(r.growth_pct, 0),
      isNew: toBool(r.is_new),
    };
  };

  const regionMap = new Map();
  activeRows.forEach((r, i) => {
    if (!r.region || !r.area) return;
    if (!regionMap.has(r.region)) regionMap.set(r.region, new Map());
    const areaMap = regionMap.get(r.region);
    if (!areaMap.has(r.area)) areaMap.set(r.area, []);
    areaMap.get(r.area).push(mkCustomer(r, i));
  });

  const REGIONS = Array.from(regionMap.entries()).map(([regionName, areaMap]) => {
    const areas = Array.from(areaMap.entries()).map(([areaName, customers]) => {
      const sales = customers.reduce((s, c) => s + c.monthlySales, 0);
      const target = customers.reduce((s, c) => s + c.target, 0);
      const activeCust = customers.filter((c) => c.daysSincePurchase < 30).length;
      const repCounts = {};
      customers.forEach((c) => (repCounts[c.rep] = (repCounts[c.rep] || 0) + 1));
      const topRep = Object.entries(repCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "-";
      return {
        id: `${regionName}::${areaName}`, name: areaName, region: regionName, customers,
        sales, target, achievement: target ? Math.round((sales / target) * 100) : 0,
        portfolio: customers.length ? Math.round(customers.reduce((s, c) => s + c.portfolio, 0) / customers.length) : 0,
        coverage: customers.length ? Math.round((activeCust / customers.length) * 100) : 0,
        rep: topRep, lastVisit: customers.length ? Math.min(...customers.map((c) => c.lastVisit)) : 0,
      };
    });
    const sales = areas.reduce((s, a) => s + a.sales, 0);
    const target = areas.reduce((s, a) => s + a.target, 0);
    const custCount = areas.reduce((s, a) => s + a.customers.length, 0);
    const activeCustCount = areas.reduce((s, a) => s + a.customers.filter((c) => c.daysSincePurchase < 30).length, 0);
    const gpSum = areas.reduce((s, a) => s + a.customers.reduce((s2, c) => s2 + c.gp, 0), 0);
    const newCust = areas.reduce((s, a) => s + a.customers.filter((c) => c.isNew).length, 0);
    const lostCust = lostRows.filter((r) => r.region === regionName).length;
    return {
      id: regionName, name: regionName, areas, sales, target,
      achievement: target ? Math.round((sales / target) * 100) : 0,
      customers: custCount, activeCustomers: activeCustCount,
      portfolio: areas.length ? Math.round(areas.reduce((s, a) => s + a.portfolio, 0) / areas.length) : 0,
      gpPct: sales ? Math.round((gpSum / sales) * 1000) / 10 : 0,
      newCustomers: newCust, lostCustomers: lostCust,
    };
  });

  const ALL_CUSTOMERS = REGIONS.flatMap((r) => r.areas.flatMap((a) => a.customers))
    .sort((a, b) => b.monthlySales - a.monthlySales)
    .map((c, i) => ({ ...c, ranking: i + 1 }));

  const TOTAL_SALES = REGIONS.reduce((s, r) => s + r.sales, 0);
  const TOTAL_TARGET = REGIONS.reduce((s, r) => s + r.target, 0);
  const TOTAL_CUSTOMERS = ALL_CUSTOMERS.length;
  const ACTIVE_CUSTOMERS = ALL_CUSTOMERS.filter((c) => c.daysSincePurchase < 30).length;
  const TOTAL_GP = ALL_CUSTOMERS.reduce((s, c) => s + c.gp, 0);
  const AVG_PORTFOLIO = REGIONS.length ? Math.round(REGIONS.reduce((s, r) => s + r.portfolio, 0) / REGIONS.length) : 0;

  // Reps
  const repMap = new Map();
  ALL_CUSTOMERS.forEach((c) => {
    if (!repMap.has(c.rep)) repMap.set(c.rep, []);
    repMap.get(c.rep).push(c);
  });
  const REP_PERF = Array.from(repMap.entries()).map(([rep, custs]) => {
    const sales = custs.reduce((s, c) => s + c.monthlySales, 0);
    const target = custs.reduce((s, c) => s + c.target, 0);
    const lostCust = lostRows.filter((r) => r.rep === rep).length;
    const achievement = target ? Math.round((sales / target) * 100) : 0;
    return {
      rep, region: custs[0]?.region || "-", customers: custs.length,
      dailyVisits: Math.round(custs.length / 5) + 2, weeklyVisits: (Math.round(custs.length / 5) + 2) * 5,
      sales: Math.round(sales), target: Math.round(target), achievement,
      portfolio: custs.length ? Math.round(custs.reduce((s, c) => s + c.portfolio, 0) / custs.length) : 0,
      aov: custs.length ? Math.round(sales / custs.length) : 0,
      strikeRate: Math.min(99, Math.max(30, Math.round(achievement * 0.9))),
      newCust: custs.filter((c) => c.isNew).length, lostCust,
    };
  }).sort((a, b) => b.sales - a.sales).map((r, i) => ({ ...r, rank: i + 1 }));

  // SKUs
  const SKUS = skuRows.map((r) => {
    const required = toNum(r.required_customers, TOTAL_CUSTOMERS || 1);
    const available = Math.min(required, toNum(r.available_customers, required));
    const outOfStock = Math.max(0, required - available);
    const monthlySales = toNum(r.monthly_sales, 0);
    const priorSales = toNum(r.prior_month_sales, monthlySales);
    const avgUnitValue = toNum(r.avg_unit_value, 25);
    const estLostMonthly = Math.round(outOfStock * avgUnitValue * 3.5);
    return {
      brand: r.brand, category: r.category || "Uncategorised", sku: r.sku,
      required, available, outOfStock, facing: toNum(r.facing, 1),
      shelfShare: toNum(r.shelf_share_pct, 0), competitorPresent: toBool(r.competitor_present),
      daysSincePurchase: toNum(r.days_since_purchase, 0),
      portfolioScore: required ? Math.round((available / required) * 100) : 0,
      missingCustomers: outOfStock, estLostMonthly,
      potentialRevenue: estLostMonthly * 12,
      priority: estLostMonthly > 9000 ? "High" : estLostMonthly > 4000 ? "Medium" : "Low",
      monthlySales, growthPct: priorSales ? Math.round(((monthlySales - priorSales) / priorSales) * 1000) / 10 : 0,
      gpPct: toNum(r.gp_pct, 18),
    };
  });
  const LOST_OPPS = [...SKUS].sort((a, b) => b.estLostMonthly - a.estLostMonthly);

  // Brand distribution (aggregated from SKUs)
  const brandGroups = new Map();
  SKUS.forEach((s) => {
    if (!brandGroups.has(s.brand)) brandGroups.set(s.brand, []);
    brandGroups.get(s.brand).push(s);
  });
  const BRAND_DIST = Array.from(brandGroups.entries()).map(([brand, skus]) => {
    const sales = skus.reduce((s, x) => s + x.monthlySales, 0);
    const priorSales = skus.reduce((s, x) => s + (x.monthlySales / (1 + x.growthPct / 100 || 1)), 0);
    const reqCust = Math.max(...skus.map((s) => s.required));
    const availCust = Math.round(skus.reduce((s, x) => s + x.available, 0) / skus.length);
    const gpWeighted = sales ? skus.reduce((s, x) => s + x.gpPct * x.monthlySales, 0) / sales : 18;
    return {
      brand, category: skus[0].category, reqCust, availCust,
      distPct: reqCust ? Math.round((availCust / reqCust) * 1000) / 10 : 0,
      sales: Math.round(sales),
      growth: priorSales ? Math.round(((sales - priorSales) / priorSales) * 1000) / 10 : 0,
      gpPct: Math.round(gpWeighted * 10) / 10,
    };
  }).sort((a, b) => b.sales - a.sales);

  const catMap = new Map();
  SKUS.forEach((s) => catMap.set(s.category, (catMap.get(s.category) || 0) + s.monthlySales));
  const CATEGORY_SALES = Array.from(catMap.entries()).map(([category, sales]) => ({ category, sales: Math.round(sales) })).sort((a, b) => b.sales - a.sales);

  // ABC analysis
  const sortedByRevenue = [...SKUS].sort((a, b) => b.monthlySales - a.monthlySales);
  const totalSkuSales = sortedByRevenue.reduce((s, x) => s + x.monthlySales, 0) || 1;
  let cum = 0;
  const grades = { A: { sales: 0, count: 0 }, B: { sales: 0, count: 0 }, C: { sales: 0, count: 0 } };
  sortedByRevenue.forEach((s) => {
    cum += s.monthlySales;
    const cumPct = cum / totalSkuSales;
    const grade = cumPct <= 0.7 ? "A" : cumPct <= 0.9 ? "B" : "C";
    grades[grade].sales += s.monthlySales; grades[grade].count += 1;
  });
  const ABC_ANALYSIS = [
    { grade: "A (Top revenue SKUs)", value: Math.round((grades.A.sales / totalSkuSales) * 1000) / 10, count: grades.A.count },
    { grade: "B (Mid revenue SKUs)", value: Math.round((grades.B.sales / totalSkuSales) * 1000) / 10, count: grades.B.count },
    { grade: "C (Long tail SKUs)", value: Math.round((grades.C.sales / totalSkuSales) * 1000) / 10, count: grades.C.count },
  ];

  // Stock
  const WAREHOUSE_STOCK = stockRows.map((r) => ({
    brand: r.brand, stockUnits: toNum(r.stock_units), daysOfCover: toNum(r.days_of_cover, 15),
    outOfStock: toNum(r.out_of_stock, 0), lowStock: toNum(r.low_stock, 0), nearExpiry: toNum(r.near_expiry, 0),
  }));

  // Trend (uploaded or estimated)
  let TREND, trendEstimated = false;
  if (trendRows && trendRows.length) {
    TREND = trendRows.map((r) => ({ month: r.month, sales: toNum(r.sales), target: toNum(r.target, toNum(r.sales) * 1.05), gp: toNum(r.gp, toNum(r.sales) * 0.18) }));
  } else {
    trendEstimated = true;
    const ramp = [0.80, 0.83, 0.87, 0.90, 0.93, 0.95, 0.97, 0.99, 1.0];
    TREND = ramp.map((f, i) => ({
      month: ["M-8", "M-7", "M-6", "M-5", "M-4", "M-3", "M-2", "M-1", "Current"][i],
      sales: Math.round(TOTAL_SALES * f), target: Math.round(TOTAL_TARGET * (f + 0.02)), gp: Math.round(TOTAL_SALES * f * 0.19),
    }));
  }

  let STOCK_TREND, stockTrendEstimated = false;
  const totalStockUnits = WAREHOUSE_STOCK.reduce((s, w) => s + w.stockUnits, 0);
  const totalOOS = WAREHOUSE_STOCK.reduce((s, w) => s + w.outOfStock, 0);
  stockTrendEstimated = true;
  STOCK_TREND = TREND.map((t, i) => ({
    month: t.month,
    stockValue: Math.round(totalStockUnits * 22 * (0.9 + i * 0.012)),
    outOfStockItems: Math.max(1, Math.round(totalOOS * (1.3 - i * 0.03))),
  }));

  return {
    REGIONS, ALL_CUSTOMERS, TOTAL_SALES, TOTAL_TARGET, TOTAL_CUSTOMERS, ACTIVE_CUSTOMERS, TOTAL_GP, AVG_PORTFOLIO,
    REP_PERF, SKUS, LOST_OPPS, BRAND_DIST, CATEGORY_SALES, ABC_ANALYSIS, WAREHOUSE_STOCK, TREND, STOCK_TREND,
    trendEstimated, stockTrendEstimated, lostCustomersTotal: lostRows.length,
  };
}

const DataContext = createContext(null);

/* ---------------------------------------------------------------
   TEMPLATES
------------------------------------------------------------------*/
const TEMPLATES = {
  customers: {
    filename: "customers_template.csv",
    headers: ["region", "area", "customer_name", "customer_code", "rep", "customer_type", "status", "is_new", "monthly_sales", "target", "gp", "portfolio_pct", "last_visit_days", "next_visit_days", "credit_limit", "outstanding", "days_since_purchase", "growth_pct"],
    sample: [
      ["Kaafu Atoll", "Hulhumale'", "Sunrise Mart", "C-1001", "Ahmed Nizam", "Mini Mart", "active", "no", "18500", "20000", "3200", "82", "6", "8", "50000", "12000", "4", "6.2"],
      ["Baa Atoll", "Eydhafushi", "Lagoon Trading", "C-1002", "Fathimath Shaha", "Supermarket", "active", "yes", "31200", "28000", "5600", "91", "2", "12", "80000", "0", "1", "14.5"],
    ],
  },
  skus: {
    filename: "skus_template.csv",
    headers: ["brand", "category", "sku", "required_customers", "available_customers", "facing", "shelf_share_pct", "competitor_present", "days_since_purchase", "monthly_sales", "gp_pct", "prior_month_sales", "avg_unit_value"],
    sample: [
      ["Coral Foods", "Grocery & Staples", "Coral Rice 5kg", "130", "98", "3", "18", "yes", "5", "24500", "16.5", "22800", "22"],
      ["Reef Beverages", "Beverages", "Reef Cola 1.5L", "130", "70", "2", "9", "yes", "3", "15800", "14.2", "16100", "18"],
    ],
  },
  stock: {
    filename: "stock_template.csv",
    headers: ["brand", "stock_units", "days_of_cover", "out_of_stock", "low_stock", "near_expiry"],
    sample: [
      ["Coral Foods", "8200", "24", "1", "4", "2"],
      ["Reef Beverages", "5100", "11", "3", "6", "0"],
    ],
  },
  trend: {
    filename: "monthly_trend_template.csv",
    headers: ["month", "sales", "target", "gp"],
    sample: [
      ["Jan", "410000", "430000", "76000"],
      ["Feb", "425000", "435000", "79000"],
    ],
  },
};

function downloadTemplate(kind) {
  const t = TEMPLATES[kind];
  const csv = [t.headers.join(","), ...t.sample.map((row) => row.join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = t.filename; a.click();
  URL.revokeObjectURL(url);
}

async function parseSpreadsheet(file) {
  const ext = file.name.split(".").pop().toLowerCase();
  let rawRows;
  if (ext === "csv") {
    rawRows = await new Promise((resolve, reject) => {
      Papa.parse(file, { header: true, skipEmptyLines: true, complete: (res) => resolve(res.data), error: reject });
    });
  } else {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array" });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    rawRows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
  }
  return rawRows.map((r) => {
    const o = {};
    Object.keys(r).forEach((k) => { o[String(k).trim().toLowerCase().replace(/\s+/g, "_")] = r[k]; });
    return o;
  }).filter((r) => Object.values(r).some((v) => String(v).trim() !== ""));
}

const REQUIRED_COLS = {
  customers: ["region", "area", "customer_name", "monthly_sales", "target"],
  skus: ["brand", "category", "sku", "required_customers", "available_customers"],
  stock: ["brand", "stock_units"],
  trend: ["month", "sales"],
};

/* ---------------------------------------------------------------
   PRIMITIVE UI COMPONENTS
------------------------------------------------------------------*/
function KpiCard({ label, value, sub, trend, tone = "neutral", icon: Icon }) {
  const toneColor = tone === "good" ? COLORS.green : tone === "bad" ? COLORS.red : tone === "warn" ? COLORS.amber : COLORS.blue;
  const toneSoft = tone === "good" ? COLORS.greenSoft : tone === "bad" ? COLORS.redSoft : tone === "warn" ? COLORS.amberSoft : COLORS.blueSoft;
  return (
    <div style={{ background: COLORS.surface, border: `1px solid ${COLORS.line}`, borderRadius: 16, padding: "18px 20px", display: "flex", flexDirection: "column", gap: 10, minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontFamily: "Inter, sans-serif", fontSize: 12.5, color: COLORS.textSecondary, fontWeight: 600, letterSpacing: 0.2 }}>{label}</span>
        {Icon && <div style={{ width: 30, height: 30, borderRadius: 9, background: toneSoft, display: "flex", alignItems: "center", justifyContent: "center" }}><Icon size={15} color={toneColor} /></div>}
      </div>
      <div style={{ fontFamily: "Manrope, sans-serif", fontSize: 25, fontWeight: 800, color: COLORS.textPrimary, lineHeight: 1.1 }}>{value}</div>
      {(sub || trend !== undefined) && (
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {trend !== undefined && <span style={{ display: "flex", alignItems: "center", gap: 2, fontSize: 12, fontWeight: 700, color: trend >= 0 ? COLORS.green : COLORS.red, fontFamily: "Inter, sans-serif" }}>{trend >= 0 ? <ArrowUp size={12} /> : <ArrowDown size={12} />}{Math.abs(trend)}%</span>}
          {sub && <span style={{ fontSize: 12, color: COLORS.textMuted, fontFamily: "Inter, sans-serif" }}>{sub}</span>}
        </div>
      )}
    </div>
  );
}
function Card({ title, subtitle, children, style, right }) {
  return (
    <div style={{ background: COLORS.surface, border: `1px solid ${COLORS.line}`, borderRadius: 16, padding: "18px 20px", ...style }}>
      {(title || right) && (
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14 }}>
          <div>
            {title && <div style={{ fontFamily: "Manrope, sans-serif", fontSize: 15, fontWeight: 800, color: COLORS.textPrimary }}>{title}</div>}
            {subtitle && <div style={{ fontFamily: "Inter, sans-serif", fontSize: 12, color: COLORS.textMuted, marginTop: 2 }}>{subtitle}</div>}
          </div>
          {right}
        </div>
      )}
      {children}
    </div>
  );
}
function ProgressBar({ value, tone = "blue", height = 6 }) {
  const color = tone === "good" ? COLORS.green : tone === "bad" ? COLORS.red : tone === "warn" ? COLORS.amber : COLORS.blue;
  return <div style={{ width: "100%", height, background: COLORS.line, borderRadius: height }}><div style={{ width: `${Math.min(100, Math.max(0, value))}%`, height, background: color, borderRadius: height }} /></div>;
}
function Pill({ children, tone = "neutral" }) {
  const map = { good: [COLORS.greenSoft, COLORS.green], bad: [COLORS.redSoft, COLORS.red], warn: [COLORS.amberSoft, COLORS.amber], neutral: [COLORS.blueSoft, COLORS.blue] };
  const [bg, fg] = map[tone];
  return <span style={{ background: bg, color: fg, fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 999, fontFamily: "Inter, sans-serif", whiteSpace: "nowrap" }}>{children}</span>;
}
function Th({ children, align = "left" }) {
  return <th style={{ textAlign: align, fontFamily: "Inter, sans-serif", fontSize: 11, fontWeight: 700, color: COLORS.textMuted, textTransform: "uppercase", letterSpacing: 0.4, padding: "9px 12px", borderBottom: `1px solid ${COLORS.line}`, whiteSpace: "nowrap" }}>{children}</th>;
}
function Td({ children, align = "left", bold }) {
  return <td style={{ textAlign: align, fontFamily: "Inter, sans-serif", fontSize: 12.5, color: bold ? COLORS.textPrimary : COLORS.textSecondary, fontWeight: bold ? 700 : 500, padding: "10px 12px", borderBottom: `1px solid ${COLORS.line}`, whiteSpace: "nowrap" }}>{children}</td>;
}
function Gauge({ value, size = 150, label }) {
  const color = value >= 80 ? COLORS.green : value >= 60 ? COLORS.amber : COLORS.red;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      <ResponsiveContainer width={size} height={size}>
        <RadialBarChart innerRadius="72%" outerRadius="100%" data={[{ value }]} startAngle={90} endAngle={-270} barSize={14}>
          <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
          <RadialBar dataKey="value" cornerRadius={20} fill={color} background={{ fill: COLORS.line }} />
        </RadialBarChart>
      </ResponsiveContainer>
      <div style={{ marginTop: -size / 2 - 6, fontFamily: "Manrope, sans-serif", fontSize: size / 4.2, fontWeight: 800, color: COLORS.textPrimary }}>{value}%</div>
      <div style={{ marginTop: size / 2 - 4 }} />
      {label && <div style={{ fontFamily: "Inter, sans-serif", fontSize: 12, color: COLORS.textMuted, fontWeight: 600, marginTop: 4 }}>{label}</div>}
    </div>
  );
}
const CustomTooltip = ({ active, payload, label, valueFmt = fmtShort }) => {
  if (!active || !payload || !payload.length) return null;
  return (
    <div style={{ background: COLORS.navy, borderRadius: 10, padding: "10px 13px", boxShadow: "0 8px 24px rgba(11,46,82,0.25)" }}>
      {label && <div style={{ color: "#AFC4DE", fontSize: 11, fontFamily: "Inter, sans-serif", marginBottom: 4 }}>{label}</div>}
      {payload.map((p, i) => (
        <div key={i} style={{ color: "#fff", fontSize: 12.5, fontFamily: "Inter, sans-serif", fontWeight: 600, display: "flex", gap: 8, justifyContent: "space-between" }}>
          <span style={{ color: p.color || p.fill }}>{p.name}</span><span>{valueFmt(p.value)}</span>
        </div>
      ))}
    </div>
  );
};

const NAV = [
  { id: "executive", label: "Executive Dashboard", icon: LayoutDashboard },
  { id: "regional", label: "Regional Performance", icon: MapIcon },
  { id: "area", label: "Area Performance", icon: Building2 },
  { id: "customer", label: "Customer Performance", icon: Users },
  { id: "product", label: "Product Portfolio", icon: Package },
  { id: "brand", label: "Brand Distribution", icon: Tags },
  { id: "reps", label: "Sales Rep Performance", icon: UserCheck },
  { id: "stock", label: "Stock & Availability", icon: Warehouse },
  { id: "lost", label: "Lost Opportunity", icon: TrendingDown },
];

/* ---------------------------------------------------------------
   UPLOAD PANEL
------------------------------------------------------------------*/
function UploadRow({ kind, label, required, meta, error, onFile }) {
  const inputRef = useRef(null);
  return (
    <div style={{ border: `1px solid ${COLORS.line}`, borderRadius: 12, padding: "14px 16px", marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <div>
          <span style={{ fontFamily: "Manrope", fontWeight: 800, fontSize: 13, color: COLORS.textPrimary }}>{label}</span>
          {!required && <span style={{ fontSize: 10.5, color: COLORS.textMuted, marginLeft: 6 }}>optional</span>}
        </div>
        {meta ? <Pill tone="good">{meta.rows} rows loaded</Pill> : <Pill tone="neutral">Using demo data</Pill>}
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button
          onClick={() => inputRef.current?.click()}
          style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, color: "#fff", background: COLORS.blue, border: "none", borderRadius: 8, padding: "7px 12px", cursor: "pointer", fontFamily: "Inter" }}
        >
          <Upload size={13} /> Upload CSV / Excel
        </button>
        <input ref={inputRef} type="file" accept=".csv,.xlsx,.xls" style={{ display: "none" }} onChange={(e) => { if (e.target.files[0]) onFile(kind, e.target.files[0]); e.target.value = ""; }} />
        <button
          onClick={() => downloadTemplate(kind)}
          style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, color: COLORS.textSecondary, background: COLORS.bg, border: `1px solid ${COLORS.line}`, borderRadius: 8, padding: "7px 12px", cursor: "pointer", fontFamily: "Inter" }}
        >
          <Download size={13} /> Template
        </button>
      </div>
      {error && <div style={{ fontSize: 11, color: COLORS.red, marginTop: 8, fontWeight: 600 }}>{error}</div>}
      {meta && <div style={{ fontSize: 10.5, color: COLORS.textMuted, marginTop: 8 }}>Updated {meta.updated.toLocaleTimeString()}</div>}
    </div>
  );
}

function UploadPanel({ open, onClose, meta, errors, onFile, onReset }) {
  if (!open) return null;
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", justifyContent: "flex-end" }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(11,32,54,0.35)" }} />
      <div style={{ position: "relative", width: 420, maxWidth: "92vw", background: COLORS.surface, height: "100%", boxShadow: "-12px 0 32px rgba(11,32,54,0.18)", padding: "22px 22px 30px", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <CloudUpload size={18} color={COLORS.blue} />
            <span style={{ fontFamily: "Manrope", fontWeight: 800, fontSize: 16, color: COLORS.textPrimary }}>Connect Live Data</span>
          </div>
          <X size={18} style={{ cursor: "pointer", color: COLORS.textMuted }} onClick={onClose} />
        </div>
        <div style={{ fontSize: 12, color: COLORS.textMuted, lineHeight: 1.6, marginBottom: 18 }}>
          No ERP/POS connection needed. Export these tables from your system as CSV or Excel on whatever schedule works for you, and drop them in below — every page recalculates instantly from what you upload. Column headers must match the templates.
        </div>
        <div style={{ fontSize: 12, color: COLORS.textMuted, lineHeight: 1.6, marginBottom: 18 }}>
          Customer sales and visit data comes in live from your sales reps' daily entries — no upload needed for that. Product portfolio and warehouse stock change less often, so upload those here as CSV/Excel exports whenever they're updated.
        </div>
        <UploadRow kind="skus" label="SKU / Product Portfolio" required meta={meta.skus} error={errors.skus} onFile={onFile} />
        <UploadRow kind="stock" label="Warehouse Stock" required meta={meta.stock} error={errors.stock} onFile={onFile} />
        <div style={{ fontSize: 10.5, color: COLORS.textMuted, marginBottom: 16, lineHeight: 1.6 }}>
          Until you upload these, the Product Portfolio, Brand Distribution, Stock, and Lost Opportunity pages show illustrative demo figures — clearly separate from the live rep-entered customer data.
        </div>
        <button onClick={onReset} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 700, color: COLORS.textSecondary, background: COLORS.bg, border: `1px solid ${COLORS.line}`, borderRadius: 9, padding: "9px 14px", cursor: "pointer", fontFamily: "Inter", width: "100%", justifyContent: "center" }}>
          <RefreshCcw size={13} /> Reset portfolio/stock to demo data
        </button>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------
   MAIN APP — receives live customer + trend data from the server
   component (app/admin/page.jsx), which queries Supabase.
------------------------------------------------------------------*/
export default function App({ profile, liveCustomerRows, liveTrendRows, initialSkuRows, initialStockRows }) {
  const router = useRouter();
  const supabase = createClient();
  const [page, setPage] = useState("executive");
  const [selectedRegion, setSelectedRegion] = useState(null);
  const [selectedArea, setSelectedArea] = useState(null);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [custSearch, setCustSearch] = useState("");
  const [uploadOpen, setUploadOpen] = useState(false);

  const [skuRows, setSkuRows] = useState(initialSkuRows);
  const [stockRows, setStockRows] = useState(initialStockRows);
  const [meta, setMeta] = useState({
    skus: initialSkuRows ? { rows: initialSkuRows.length, updated: new Date() } : null,
    stock: initialStockRows ? { rows: initialStockRows.length, updated: new Date() } : null,
  });
  const [errors, setErrors] = useState({ skus: null, stock: null });
  const [saving, setSaving] = useState({ skus: false, stock: false });

  const demoSkuRows = useMemo(() => generateDemoSkuRows(liveCustomerRows.filter((r) => r.status !== "lost").length || 40), [liveCustomerRows]);
  const demoStockRows = useMemo(() => generateDemoStockRows(), []);

  const model = useMemo(
    () => buildModel(liveCustomerRows, skuRows || demoSkuRows, stockRows || demoStockRows, liveTrendRows),
    [liveCustomerRows, skuRows, stockRows, liveTrendRows, demoSkuRows, demoStockRows]
  );

  const isLive = true; // customer data is always live from Supabase
  const portfolioIsLive = !!(skuRows || stockRows);

  const handleFile = async (kind, file) => {
    try {
      const rows = await parseSpreadsheet(file);
      const missing = REQUIRED_COLS[kind].filter((c) => !(c in (rows[0] || {})));
      if (missing.length) { setErrors((p) => ({ ...p, [kind]: `Missing column(s): ${missing.join(", ")}` })); return; }

      setSaving((p) => ({ ...p, [kind]: true }));
      const table = kind === "skus" ? "skus" : "warehouse_stock";
      // Full-snapshot replace: clear the table, insert the new upload, so the
      // dashboard always reflects exactly what's in the latest file.
      const { error: delErr } = await supabase.from(table).delete().not("id", "is", null);
      if (delErr) { setErrors((p) => ({ ...p, [kind]: "Could not save to database: " + delErr.message })); setSaving((p) => ({ ...p, [kind]: false })); return; }

      const cleanRows = rows.map((r) => {
        if (kind === "skus") {
          return {
            brand: r.brand, category: r.category, sku: r.sku,
            required_customers: toNum(r.required_customers), available_customers: toNum(r.available_customers),
            facing: toNum(r.facing, 1), shelf_share_pct: toNum(r.shelf_share_pct, 0),
            competitor_present: toBool(r.competitor_present), days_since_purchase: toNum(r.days_since_purchase, 0),
            monthly_sales: toNum(r.monthly_sales, 0), gp_pct: toNum(r.gp_pct, 18),
            prior_month_sales: toNum(r.prior_month_sales, 0), avg_unit_value: toNum(r.avg_unit_value, 25),
          };
        }
        return {
          brand: r.brand, stock_units: toNum(r.stock_units), days_of_cover: toNum(r.days_of_cover, 15),
          out_of_stock: toNum(r.out_of_stock, 0), low_stock: toNum(r.low_stock, 0), near_expiry: toNum(r.near_expiry, 0),
        };
      });
      const { error: insErr } = await supabase.from(table).insert(cleanRows);
      setSaving((p) => ({ ...p, [kind]: false }));
      if (insErr) { setErrors((p) => ({ ...p, [kind]: "Could not save to database: " + insErr.message })); return; }

      if (kind === "skus") setSkuRows(rows);
      if (kind === "stock") setStockRows(rows);
      setMeta((p) => ({ ...p, [kind]: { rows: rows.length, updated: new Date() } }));
      setErrors((p) => ({ ...p, [kind]: null }));
    } catch (e) {
      setErrors((p) => ({ ...p, [kind]: "Could not read file — check it's a valid CSV/Excel export." }));
      setSaving((p) => ({ ...p, [kind]: false }));
    }
  };
  const handleReset = async () => {
    await supabase.from("skus").delete().not("id", "is", null);
    await supabase.from("warehouse_stock").delete().not("id", "is", null);
    setSkuRows(null); setStockRows(null);
    setMeta({ skus: null, stock: null });
    setErrors({ skus: null, stock: null });
  };
  const signOut = async () => { await supabase.auth.signOut(); router.push("/login"); router.refresh(); };

  const region = model.REGIONS.find((r) => r.id === selectedRegion);
  const area = region?.areas.find((a) => a.id === selectedArea);
  const customer = model.ALL_CUSTOMERS.find((c) => c.id === selectedCustomer);

  const goRegion = (id) => { setSelectedRegion(id); setSelectedArea(null); setPage("regional"); };
  const drillRegion = (id) => { setSelectedRegion(id); setSelectedArea(null); setPage("area"); };
  const drillArea = (rid, aid) => { setSelectedRegion(rid); setSelectedArea(aid); setPage("area"); };
  const drillCustomer = (id) => { setSelectedCustomer(id); setPage("customer"); };

  const alerts = useMemo(() => {
    const list = [];
    model.ALL_CUSTOMERS.forEach((c) => {
      if (c.achievement < 85) list.push({ type: "Sales below target", detail: `${c.name} at ${c.achievement}% of target`, tone: "bad" });
      if (c.lastVisit > 30) list.push({ type: "Not visited 30+ days", detail: `${c.name} — ${c.lastVisit} days since last visit`, tone: "warn" });
      if (c.portfolio < 80) list.push({ type: "Portfolio below 80%", detail: `${c.name} at ${c.portfolio}% portfolio`, tone: "warn" });
      if (c.outstanding > c.creditLimit && c.creditLimit > 0) list.push({ type: "Credit limit exceeded", detail: `${c.name} — ${fmtShort(c.outstanding)} outstanding`, tone: "bad" });
      if (c.growth < 0) list.push({ type: "Negative growth", detail: `${c.name} — ${c.growth}% growth`, tone: "bad" });
    });
    return list;
  }, [model.ALL_CUSTOMERS]);

  return (
    <DataContext.Provider value={model}>
      <div style={{ display: "flex", minHeight: "100vh", background: COLORS.bg, fontFamily: "Inter, sans-serif" }}>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Manrope:wght@500;700;800&family=Inter:wght@400;500;600;700&display=swap');
          * { box-sizing: border-box; }
          ::-webkit-scrollbar { width: 8px; height: 8px; }
          ::-webkit-scrollbar-thumb { background: #C7D3E2; border-radius: 8px; }
          table { border-collapse: collapse; width: 100%; }
          tr:hover td { background: #FAFCFF; }
          .navitem:hover { background: rgba(255,255,255,0.06) !important; }
          .rowclick:hover { cursor: pointer; background: #F5F9FF !important; }
        `}</style>

        <div style={{ width: 246, background: `linear-gradient(180deg, ${COLORS.navy} 0%, ${COLORS.navyLight} 100%)`, display: "flex", flexDirection: "column", flexShrink: 0, position: "sticky", top: 0, height: "100vh" }}>
          <div style={{ padding: "22px 20px 18px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
              <div style={{ width: 32, height: 32, borderRadius: 9, background: COLORS.blue, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Manrope, sans-serif", fontWeight: 800, color: "#fff", fontSize: 14 }}>W</div>
              <div>
                <div style={{ fontFamily: "Manrope, sans-serif", fontWeight: 800, color: "#fff", fontSize: 14.5, lineHeight: 1.2 }}>WholesaleIQ</div>
                <div style={{ fontFamily: "Inter, sans-serif", fontSize: 10.5, color: "#8FA8C4", fontWeight: 600, letterSpacing: 0.3 }}>ATOLL DISTRIBUTION</div>
              </div>
            </div>
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: "12px 10px" }}>
            {NAV.map((n) => {
              const active = page === n.id; const Icon = n.icon;
              return (
                <div key={n.id} className="navitem" onClick={() => setPage(n.id)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 10, marginBottom: 3, cursor: "pointer", background: active ? "rgba(31,111,235,0.22)" : "transparent", borderLeft: active ? `3px solid ${COLORS.blue}` : "3px solid transparent" }}>
                  <Icon size={16} color={active ? "#fff" : "#8FA8C4"} />
                  <span style={{ fontFamily: "Inter, sans-serif", fontSize: 12.8, fontWeight: active ? 700 : 500, color: active ? "#fff" : "#B9C9DC" }}>{n.label}</span>
                </div>
              );
            })}
          </div>
          <div style={{ padding: "14px 20px", borderTop: "1px solid rgba(255,255,255,0.08)" }}>
            <div
              onClick={() => setUploadOpen(true)}
              style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", background: "rgba(255,255,255,0.06)", borderRadius: 10, padding: "9px 12px", marginBottom: 10 }}
            >
              <Database size={14} color={COLORS.green} />
              <div>
                <div style={{ fontSize: 11.5, fontWeight: 700, color: "#fff", fontFamily: "Inter" }}>Rep data: live</div>
                <div style={{ fontSize: 10, color: "#8FA8C4" }}>Portfolio/stock: {portfolioIsLive ? "uploaded" : "demo — click to upload"}</div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 4 }}>
              <div>
                <div style={{ fontFamily: "Inter, sans-serif", fontSize: 11.5, color: "#fff", fontWeight: 700 }}>{profile?.full_name}</div>
                <div style={{ fontFamily: "Inter, sans-serif", fontSize: 10, color: "#6E86A3" }}>Male' Standard Time</div>
              </div>
              <button onClick={signOut} style={{ background: "rgba(255,255,255,0.08)", border: "none", color: "#B9C9DC", fontSize: 10.5, fontWeight: 700, padding: "6px 10px", borderRadius: 7, cursor: "pointer" }}>Sign out</button>
            </div>
          </div>
        </div>

        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
          <div style={{ background: COLORS.surface, borderBottom: `1px solid ${COLORS.line}`, padding: "13px 26px", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", position: "sticky", top: 0, zIndex: 5 }}>
            <div style={{ fontFamily: "Manrope, sans-serif", fontSize: 17, fontWeight: 800, color: COLORS.textPrimary, marginRight: 8 }}>{NAV.find((n) => n.id === page)?.label}</div>
            <div style={{ flex: 1 }} />
            <SlicerChip icon={Calendar} label="Current Period" />
            <SlicerChip icon={MapIcon} label={region ? region.name : "All Regions"} onClear={region ? () => { setSelectedRegion(null); setSelectedArea(null); } : null} />
            {area && <SlicerChip icon={Building2} label={area.name} onClear={() => setSelectedArea(null)} />}
            <SlicerChip icon={Filter} label="Status: Active" />
            <div style={{ position: "relative" }}>
              <Search size={13} style={{ position: "absolute", left: 10, top: 9, color: COLORS.textMuted }} />
              <input placeholder="Search customer, SKU, rep…" value={custSearch} onChange={(e) => setCustSearch(e.target.value)} style={{ padding: "7px 10px 7px 28px", borderRadius: 9, border: `1px solid ${COLORS.line}`, fontSize: 12.5, fontFamily: "Inter, sans-serif", width: 200, outline: "none" }} />
            </div>
            <div
              onClick={() => setUploadOpen(true)}
              title="Customer data is live from rep entries; click to manage portfolio/stock uploads"
              style={{ display: "flex", alignItems: "center", gap: 6, background: COLORS.greenSoft, borderRadius: 9, padding: "6px 10px", cursor: "pointer" }}
            >
              <Database size={13} color={COLORS.green} />
              <span style={{ fontSize: 11.5, fontWeight: 700, color: COLORS.green }}>Live</span>
            </div>
            <div style={{ width: 32, height: 32, borderRadius: 9, background: COLORS.blueSoft, display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
              <Bell size={15} color={COLORS.blue} />
              <div style={{ position: "absolute", top: -3, right: -3, width: 14, height: 14, borderRadius: 7, background: COLORS.red, color: "#fff", fontSize: 9, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>{Math.min(9, alerts.length)}</div>
            </div>
          </div>

          <div style={{ padding: "22px 26px 60px", flex: 1 }}>
            {page === "executive" && <ExecutivePage alerts={alerts} goRegion={goRegion} drillCustomer={drillCustomer} />}
            {page === "regional" && <RegionalPage region={region} drillRegion={drillRegion} />}
            {page === "area" && <AreaPage region={region} area={area} drillArea={drillArea} drillCustomer={drillCustomer} setSelectedRegion={setSelectedRegion} />}
            {page === "customer" && <CustomerPage customer={customer} search={custSearch} drillCustomer={drillCustomer} />}
            {page === "product" && <ProductPage />}
            {page === "brand" && <BrandPage />}
            {page === "reps" && <RepsPage />}
            {page === "stock" && <StockPage />}
            {page === "lost" && <LostPage />}
          </div>
        </div>

        <UploadPanel open={uploadOpen} onClose={() => setUploadOpen(false)} meta={meta} errors={errors} onFile={handleFile} onReset={handleReset} />
      </div>
    </DataContext.Provider>
  );
}

function SlicerChip({ icon: Icon, label, onClear }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, background: COLORS.bg, border: `1px solid ${COLORS.line}`, borderRadius: 9, padding: "6px 10px" }}>
      <Icon size={12.5} color={COLORS.textSecondary} />
      <span style={{ fontSize: 12, fontFamily: "Inter, sans-serif", fontWeight: 600, color: COLORS.textPrimary }}>{label}</span>
      {onClear && <XCircle size={13} color={COLORS.textMuted} style={{ cursor: "pointer" }} onClick={onClear} />}
    </div>
  );
}

/* ---------------------------------------------------------------
   EXECUTIVE DASHBOARD
------------------------------------------------------------------*/
function ExecutivePage({ alerts, goRegion, drillCustomer }) {
  const { REGIONS, TOTAL_SALES, TOTAL_TARGET, TOTAL_GP, TOTAL_CUSTOMERS, ACTIVE_CUSTOMERS, AVG_PORTFOLIO, TREND, BRAND_DIST, SKUS, CATEGORY_SALES, ALL_CUSTOMERS, trendEstimated } = useContext(DataContext);
  const achievement = TOTAL_TARGET ? Math.round((TOTAL_SALES / TOTAL_TARGET) * 100) : 0;
  const gpPct = TOTAL_SALES ? Math.round((TOTAL_GP / TOTAL_SALES) * 1000) / 10 : 0;
  const outOfStockAlerts = SKUS.filter((s) => s.outOfStock > TOTAL_CUSTOMERS * 0.15).length;
  const top10 = ALL_CUSTOMERS.slice(0, 10);
  const bottom10 = [...ALL_CUSTOMERS].sort((a, b) => a.monthlySales - b.monthlySales).slice(0, 10);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 14 }}>
        <KpiCard label="Total Sales (MTD)" value={fmtShort(TOTAL_SALES)} sub="current snapshot" icon={LayoutDashboard} />
        <KpiCard label="Sales Target" value={fmtShort(TOTAL_TARGET)} tone="neutral" />
        <KpiCard label="Target Achievement" value={pct(achievement)} tone={achievement >= 95 ? "good" : achievement >= 85 ? "warn" : "bad"} icon={CheckCircle2} />
        <KpiCard label="Gross Profit" value={fmtShort(TOTAL_GP)} tone="good" />
        <KpiCard label="GP %" value={pct(gpPct)} sub="blended margin" tone="good" />
        <KpiCard label="Out of Stock Alerts" value={outOfStockAlerts} sub="SKUs affected" tone="bad" icon={AlertTriangle} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 14 }}>
        <KpiCard label="Total Customers" value={TOTAL_CUSTOMERS} icon={Users} />
        <KpiCard label="Active Customers" value={ACTIVE_CUSTOMERS} sub={TOTAL_CUSTOMERS ? `${Math.round((ACTIVE_CUSTOMERS / TOTAL_CUSTOMERS) * 100)}% of base` : ""} tone="good" />
        <KpiCard label="Total Regions" value={REGIONS.length} icon={MapIcon} />
        <KpiCard label="Total Areas" value={REGIONS.reduce((s, r) => s + r.areas.length, 0)} icon={Building2} />
        <KpiCard label="Avg Portfolio Availability" value={pct(AVG_PORTFOLIO)} tone={AVG_PORTFOLIO >= 80 ? "good" : "warn"} />
        <KpiCard label="Customer Coverage" value={pct(TOTAL_CUSTOMERS ? Math.round((ACTIVE_CUSTOMERS / TOTAL_CUSTOMERS) * 100) : 0)} tone="good" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 14 }}>
        <Card title="Monthly Sales Trend vs Target" subtitle={trendEstimated ? "Estimated from current snapshot — upload a trend file for real history" : "From uploaded monthly trend data"}>
          <ResponsiveContainer width="100%" height={230}>
            <ComposedChart data={TREND}>
              <CartesianGrid stroke={COLORS.line} vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11.5, fill: COLORS.textMuted, fontFamily: "Inter" }} axisLine={{ stroke: COLORS.line }} tickLine={false} />
              <YAxis tickFormatter={fmtShort} tick={{ fontSize: 11, fill: COLORS.textMuted, fontFamily: "Inter" }} axisLine={false} tickLine={false} width={70} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 12, fontFamily: "Inter" }} />
              <defs><linearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={COLORS.blue} stopOpacity={0.25} /><stop offset="100%" stopColor={COLORS.blue} stopOpacity={0} /></linearGradient></defs>
              <Area type="monotone" dataKey="sales" name="Sales" stroke={COLORS.blue} fill="url(#salesFill)" strokeWidth={2.5} />
              <Line type="monotone" dataKey="target" name="Target" stroke={COLORS.amber} strokeWidth={2} strokeDasharray="5 4" dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </Card>
        <Card title="Gross Profit Trend">
          <ResponsiveContainer width="100%" height={230}>
            <BarChart data={TREND}>
              <CartesianGrid stroke={COLORS.line} vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11.5, fill: COLORS.textMuted, fontFamily: "Inter" }} axisLine={{ stroke: COLORS.line }} tickLine={false} />
              <YAxis tickFormatter={fmtShort} tick={{ fontSize: 11, fill: COLORS.textMuted, fontFamily: "Inter" }} axisLine={false} tickLine={false} width={65} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="gp" name="Gross Profit" fill={COLORS.green} radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
        <Card title="Sales by Region" subtitle="Click a bar to drill in">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={REGIONS} layout="vertical" margin={{ left: 10 }}>
              <CartesianGrid stroke={COLORS.line} horizontal={false} />
              <XAxis type="number" tickFormatter={fmtShort} tick={{ fontSize: 10.5, fill: COLORS.textMuted, fontFamily: "Inter" }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" width={95} tick={{ fontSize: 11, fill: COLORS.textSecondary, fontFamily: "Inter" }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="sales" name="Sales" fill={COLORS.blue} radius={[0, 6, 6, 0]} cursor="pointer" onClick={(d) => goRegion(d.id)} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
        <Card title="Sales by Brand">
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={BRAND_DIST} dataKey="sales" nameKey="brand" innerRadius={48} outerRadius={80} paddingAngle={2}>
                {BRAND_DIST.map((_, i) => <Cell key={i} fill={BRAND_PALETTE[i % BRAND_PALETTE.length]} />)}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8, justifyContent: "center" }}>
            {BRAND_DIST.slice(0, 4).map((b, i) => (
              <div key={b.brand} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <div style={{ width: 8, height: 8, borderRadius: 4, background: BRAND_PALETTE[i % BRAND_PALETTE.length] }} />
                <span style={{ fontSize: 10.5, color: COLORS.textSecondary, fontFamily: "Inter" }}>{b.brand}</span>
              </div>
            ))}
          </div>
        </Card>
        <Card title="Sales by Category">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={CATEGORY_SALES}>
              <CartesianGrid stroke={COLORS.line} vertical={false} />
              <XAxis dataKey="category" tick={{ fontSize: 9.5, fill: COLORS.textMuted, fontFamily: "Inter" }} axisLine={{ stroke: COLORS.line }} tickLine={false} interval={0} angle={-18} textAnchor="end" height={55} />
              <YAxis tickFormatter={fmtShort} tick={{ fontSize: 10.5, fill: COLORS.textMuted, fontFamily: "Inter" }} axisLine={false} tickLine={false} width={60} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="sales" name="Sales" fill={COLORS.green} radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
        <Card title="Top 10 Customers"><RankList list={top10} tone="good" onClick={drillCustomer} /></Card>
        <Card title="Bottom 10 Customers"><RankList list={bottom10} tone="bad" onClick={drillCustomer} /></Card>
        <Card title="Customer Locations" subtitle="By atoll — dot size = monthly sales"><AtollMap /></Card>
      </div>

      <AlertsPanel alerts={alerts} />
    </div>
  );
}

function RankList({ list, tone, onClick }) {
  const max = Math.max(1, ...list.map((c) => c.monthlySales));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
      {list.map((c, i) => (
        <div key={c.id} className="rowclick" onClick={() => onClick(c.id)} style={{ display: "flex", alignItems: "center", gap: 9, padding: "3px 4px", borderRadius: 8 }}>
          <span style={{ fontFamily: "Manrope", fontSize: 11, fontWeight: 800, color: COLORS.textMuted, width: 16 }}>{i + 1}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: COLORS.textPrimary, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.name}</div>
            <ProgressBar value={(c.monthlySales / max) * 100} tone={tone} height={5} />
          </div>
          <span style={{ fontSize: 11.5, fontWeight: 700, color: COLORS.textSecondary, whiteSpace: "nowrap" }}>{fmtShort(c.monthlySales)}</span>
        </div>
      ))}
      {!list.length && <div style={{ fontSize: 12, color: COLORS.textMuted }}>No customer data loaded.</div>}
    </div>
  );
}

function AtollMap() {
  const { REGIONS } = useContext(DataContext);
  const maxAreaSales = Math.max(1, ...REGIONS.flatMap((r) => r.areas.map((a) => a.sales)));
  return (
    <svg viewBox="0 0 300 220" width="100%" height={220}>
      <rect x="0" y="0" width="300" height="220" fill={COLORS.blueSoft} rx="12" opacity="0.4" />
      {REGIONS.map((r, ri) => {
        const cx = 30 + ri * (260 / Math.max(1, REGIONS.length - 1 || 1));
        return r.areas.map((a, ai) => {
          const cy = 30 + ai * 38 + (ri % 2 === 0 ? 0 : 14);
          const radius = 3 + (a.sales / maxAreaSales) * 10;
          return <circle key={a.id} cx={cx} cy={Math.min(cy, 195)} r={Math.min(radius, 12)} fill={COLORS.blue} fillOpacity={0.75} stroke="#fff" strokeWidth={1} />;
        });
      })}
      {REGIONS.map((r, ri) => (
        <text key={r.id} x={30 + ri * (260 / Math.max(1, REGIONS.length - 1 || 1))} y={208} fontSize="8.5" fill={COLORS.textSecondary} textAnchor="middle" fontFamily="Inter">{r.name.split(" ")[0]}</text>
      ))}
    </svg>
  );
}

function AlertsPanel({ alerts }) {
  const grouped = alerts.reduce((acc, a) => { acc[a.type] = acc[a.type] || []; acc[a.type].push(a); return acc; }, {});
  return (
    <Card title="Automated Alerts" subtitle={`${alerts.length} conditions flagged across the customer base`}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
        {Object.entries(grouped).map(([type, items]) => (
          <div key={type} style={{ border: `1px solid ${COLORS.line}`, borderRadius: 12, padding: "12px 14px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 6 }}>
              <AlertTriangle size={13} color={items[0].tone === "bad" ? COLORS.red : COLORS.amber} />
              <span style={{ fontSize: 12.5, fontWeight: 700, color: COLORS.textPrimary }}>{type}</span>
              <Pill tone={items[0].tone}>{items.length}</Pill>
            </div>
            <div style={{ fontSize: 11, color: COLORS.textMuted, lineHeight: 1.5 }}>
              {items.slice(0, 2).map((it, i) => <div key={i}>{it.detail}</div>)}
              {items.length > 2 && <div style={{ fontWeight: 600 }}>+{items.length - 2} more</div>}
            </div>
          </div>
        ))}
        {!Object.keys(grouped).length && <div style={{ fontSize: 12, color: COLORS.textMuted }}>No alerts triggered.</div>}
      </div>
    </Card>
  );
}

/* ---------------------------------------------------------------
   REGIONAL PAGE
------------------------------------------------------------------*/
function RegionalPage({ region, drillRegion }) {
  const { REGIONS } = useContext(DataContext);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {!region && <div style={{ fontFamily: "Inter", fontSize: 12.5, color: COLORS.textMuted }}>Showing all regions. Click a row or bar to drill down.</div>}
      {region && <RegionScorecards region={region} />}
      <Card title="Region Performance" subtitle="Company → Region level">
        <table>
          <thead><tr><Th>Region</Th><Th align="right">Customers</Th><Th align="right">Sales</Th><Th align="right">Target</Th><Th align="right">Achievement</Th><Th align="right">Portfolio %</Th><Th align="right">GP %</Th><Th></Th></tr></thead>
          <tbody>
            {REGIONS.map((r) => (
              <tr key={r.id} className="rowclick" onClick={() => drillRegion(r.id)}>
                <Td bold>{r.name}</Td><Td align="right">{r.customers}</Td><Td align="right">{fmt(r.sales)}</Td><Td align="right">{fmt(r.target)}</Td>
                <Td align="right"><Pill tone={r.achievement >= 95 ? "good" : r.achievement >= 85 ? "warn" : "bad"}>{r.achievement}%</Pill></Td>
                <Td align="right">{r.portfolio}%</Td><Td align="right">{r.gpPct}%</Td><Td align="right"><ChevronRight size={14} color={COLORS.textMuted} /></Td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <Card title="Sales by Region">
          <ResponsiveContainer width="100%" height={230}>
            <BarChart data={REGIONS}>
              <CartesianGrid stroke={COLORS.line} vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: COLORS.textMuted, fontFamily: "Inter" }} axisLine={{ stroke: COLORS.line }} tickLine={false} interval={0} angle={-15} textAnchor="end" height={55} />
              <YAxis tickFormatter={fmtShort} tick={{ fontSize: 10.5, fill: COLORS.textMuted, fontFamily: "Inter" }} axisLine={false} tickLine={false} width={65} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="sales" name="Sales" fill={COLORS.blue} radius={[6, 6, 0, 0]} cursor="pointer" onClick={(d) => drillRegion(d.id)} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
        <Card title="GP % by Region">
          <ResponsiveContainer width="100%" height={230}>
            <BarChart data={REGIONS}>
              <CartesianGrid stroke={COLORS.line} vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: COLORS.textMuted, fontFamily: "Inter" }} axisLine={{ stroke: COLORS.line }} tickLine={false} interval={0} angle={-15} textAnchor="end" height={55} />
              <YAxis tick={{ fontSize: 10.5, fill: COLORS.textMuted, fontFamily: "Inter" }} axisLine={false} tickLine={false} unit="%" width={40} />
              <Tooltip content={<CustomTooltip valueFmt={(v) => v + "%"} />} />
              <Bar dataKey="gpPct" name="GP %" fill={COLORS.green} radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
        <Card title="Customer Count by Region">
          <ResponsiveContainer width="100%" height={210}>
            <BarChart data={REGIONS}>
              <CartesianGrid stroke={COLORS.line} vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: COLORS.textMuted, fontFamily: "Inter" }} axisLine={{ stroke: COLORS.line }} tickLine={false} interval={0} angle={-15} textAnchor="end" height={55} />
              <YAxis tick={{ fontSize: 10.5, fill: COLORS.textMuted, fontFamily: "Inter" }} axisLine={false} tickLine={false} width={30} />
              <Tooltip content={<CustomTooltip valueFmt={(v) => v} />} />
              <Bar dataKey="customers" name="Customers" fill={COLORS.blue} radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
        <Card title="Portfolio Score by Region">
          <ResponsiveContainer width="100%" height={210}>
            <BarChart data={REGIONS}>
              <CartesianGrid stroke={COLORS.line} vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: COLORS.textMuted, fontFamily: "Inter" }} axisLine={{ stroke: COLORS.line }} tickLine={false} interval={0} angle={-15} textAnchor="end" height={55} />
              <YAxis tick={{ fontSize: 10.5, fill: COLORS.textMuted, fontFamily: "Inter" }} axisLine={false} tickLine={false} unit="%" width={40} />
              <Tooltip content={<CustomTooltip valueFmt={(v) => v + "%"} />} />
              <Bar dataKey="portfolio" name="Portfolio %" fill={COLORS.amber} radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>
    </div>
  );
}
function RegionScorecards({ region }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 14 }}>
      <KpiCard label="Total Sales" value={fmtShort(region.sales)} icon={LayoutDashboard} />
      <KpiCard label="Target" value={fmtShort(region.target)} />
      <KpiCard label="Achievement" value={pct(region.achievement)} tone={region.achievement >= 95 ? "good" : "warn"} />
      <KpiCard label="Customers" value={`${region.customers} (${region.activeCustomers} active)`} />
      <KpiCard label="Portfolio %" value={pct(region.portfolio)} tone={region.portfolio >= 80 ? "good" : "warn"} />
      <KpiCard label="GP %" value={pct(region.gpPct)} tone="good" />
      <KpiCard label="New Customers" value={region.newCustomers} tone="good" />
      <KpiCard label="Lost Customers" value={region.lostCustomers} tone="bad" />
    </div>
  );
}

/* ---------------------------------------------------------------
   AREA PAGE
------------------------------------------------------------------*/
function AreaPage({ region, area, drillArea, drillCustomer, setSelectedRegion }) {
  const { REGIONS } = useContext(DataContext);
  if (!region) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <div style={{ fontFamily: "Inter", fontSize: 12.5, color: COLORS.textMuted }}>Select a region from the Regional Performance page, or click a region below, to see its areas.</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 12 }}>
          {REGIONS.map((r) => (
            <div key={r.id} className="rowclick" onClick={() => setSelectedRegion(r.id)} style={{ background: COLORS.surface, border: `1px solid ${COLORS.line}`, borderRadius: 14, padding: 16 }}>
              <div style={{ fontWeight: 800, fontFamily: "Manrope", fontSize: 13.5, color: COLORS.textPrimary }}>{r.name}</div>
              <div style={{ fontSize: 11, color: COLORS.textMuted, marginTop: 3 }}>{r.areas.length} areas · {r.customers} customers</div>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <Card title={`${region.name} — Area Breakdown`} subtitle="Click a row to open the customer scorecard list for that area">
        <table>
          <thead><tr><Th>Area</Th><Th align="right">Customers</Th><Th align="right">Sales</Th><Th align="right">Target</Th><Th align="right">Achievement</Th><Th align="right">Portfolio %</Th><Th align="right">Coverage %</Th><Th>Sales Rep</Th><Th align="right">Last Visit</Th></tr></thead>
          <tbody>
            {region.areas.map((a) => (
              <tr key={a.id} className="rowclick" onClick={() => drillArea(region.id, a.id)} style={{ background: area?.id === a.id ? COLORS.blueSoft : undefined }}>
                <Td bold>{a.name}</Td><Td align="right">{a.customers.length}</Td><Td align="right">{fmt(a.sales)}</Td><Td align="right">{fmt(a.target)}</Td>
                <Td align="right"><Pill tone={a.achievement >= 95 ? "good" : a.achievement >= 85 ? "warn" : "bad"}>{a.achievement}%</Pill></Td>
                <Td align="right">{a.portfolio}%</Td><Td align="right">{a.coverage}%</Td><Td>{a.rep}</Td><Td align="right">{a.lastVisit}d ago</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <Card title="Area Performance Heatmap" subtitle="Green = strong achievement, red = at risk">
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.max(region.areas.length, 1)}, 1fr)`, gap: 10 }}>
          {region.areas.map((a) => {
            const t = a.achievement >= 95 ? COLORS.green : a.achievement >= 85 ? COLORS.amber : COLORS.red;
            const soft = a.achievement >= 95 ? COLORS.greenSoft : a.achievement >= 85 ? COLORS.amberSoft : COLORS.redSoft;
            return (
              <div key={a.id} style={{ background: soft, border: `1px solid ${t}33`, borderRadius: 12, padding: "16px 10px", textAlign: "center" }}>
                <div style={{ fontFamily: "Manrope", fontWeight: 800, fontSize: 20, color: t }}>{a.achievement}%</div>
                <div style={{ fontSize: 11, fontWeight: 600, color: COLORS.textSecondary, marginTop: 4 }}>{a.name}</div>
              </div>
            );
          })}
        </div>
      </Card>
      {area && (
        <Card title={`Customers in ${area.name}`}>
          <table>
            <thead><tr><Th>Customer</Th><Th>Type</Th><Th align="right">Monthly Sales</Th><Th align="right">Achievement</Th><Th align="right">Portfolio</Th><Th align="right">Last Visit</Th></tr></thead>
            <tbody>
              {area.customers.map((c) => (
                <tr key={c.id} className="rowclick" onClick={() => drillCustomer(c.id)}>
                  <Td bold>{c.name}</Td><Td>{c.type}</Td><Td align="right">{fmt(c.monthlySales)}</Td>
                  <Td align="right"><Pill tone={c.achievement >= 95 ? "good" : c.achievement >= 85 ? "warn" : "bad"}>{c.achievement}%</Pill></Td>
                  <Td align="right">{c.portfolio}%</Td><Td align="right">{c.lastVisit}d ago</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------
   CUSTOMER PAGE
------------------------------------------------------------------*/
function CustomerPage({ customer, search, drillCustomer }) {
  const { ALL_CUSTOMERS, TOTAL_CUSTOMERS, TREND, BRAND_DIST } = useContext(DataContext);
  const filtered = search ? ALL_CUSTOMERS.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()) || c.code.toLowerCase().includes(search.toLowerCase())) : ALL_CUSTOMERS;

  if (!customer) {
    return (
      <Card title="All Customers" subtitle={`${filtered.length} customers · click to open scorecard`}>
        <div style={{ maxHeight: 560, overflowY: "auto" }}>
          <table>
            <thead><tr><Th>Rank</Th><Th>Customer</Th><Th>Region</Th><Th>Area</Th><Th>Rep</Th><Th align="right">Monthly Sales</Th><Th align="right">Achievement</Th><Th align="right">Portfolio</Th></tr></thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id} className="rowclick" onClick={() => drillCustomer(c.id)}>
                  <Td>#{c.ranking}</Td><Td bold>{c.name}</Td><Td>{c.region}</Td><Td>{c.area}</Td><Td>{c.rep}</Td>
                  <Td align="right">{fmt(c.monthlySales)}</Td>
                  <Td align="right"><Pill tone={c.achievement >= 95 ? "good" : c.achievement >= 85 ? "warn" : "bad"}>{c.achievement}%</Pill></Td>
                  <Td align="right">{c.portfolio}%</Td>
                </tr>
              ))}
              {!filtered.length && <tr><Td>No customers match.</Td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
    );
  }

  const months = TREND.map((t) => t.month);
  const custTrend = months.map((m, i) => ({ month: m, sales: Math.round(customer.monthlySales * (0.8 + i * (0.2 / Math.max(1, months.length - 1)))) }));
  const brandMix = BRAND_DIST.slice(0, 5).map((b) => ({ brand: b.brand, value: Math.round(10 + rnd() * 30) }));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16 }}>
          <div>
            <div style={{ fontFamily: "Manrope", fontWeight: 800, fontSize: 20, color: COLORS.textPrimary }}>{customer.name}</div>
            <div style={{ fontSize: 12.5, color: COLORS.textMuted, marginTop: 3 }}>{customer.code} · {customer.region} → {customer.area} · {customer.type} · Rep: {customer.rep}</div>
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <Pill tone="neutral">Ranked #{customer.ranking} of {TOTAL_CUSTOMERS}</Pill>
              <Pill tone={customer.growth >= 0 ? "good" : "bad"}>{customer.growth >= 0 ? "+" : ""}{customer.growth}% growth</Pill>
              <Pill tone={customer.lastVisit > 30 ? "warn" : "good"}>Last visit {customer.lastVisit}d ago</Pill>
            </div>
          </div>
          <Gauge value={customer.portfolio} size={110} label="Portfolio Score" />
        </div>
      </Card>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(6,1fr)", gap: 14 }}>
        <KpiCard label="Monthly Sales" value={fmtShort(customer.monthlySales)} />
        <KpiCard label="Annual Sales" value={fmtShort(customer.annualSales)} />
        <KpiCard label="Target" value={fmtShort(customer.target)} />
        <KpiCard label="Achievement" value={pct(customer.achievement)} tone={customer.achievement >= 95 ? "good" : "warn"} />
        <KpiCard label="Gross Profit" value={fmtShort(customer.gp)} />
        <KpiCard label="GP %" value={pct(customer.gpPct)} />
        <KpiCard label="Credit Limit" value={fmtShort(customer.creditLimit)} />
        <KpiCard label="Outstanding Balance" value={fmtShort(customer.outstanding)} tone={customer.outstanding > customer.creditLimit ? "bad" : "neutral"} />
        <KpiCard label="Next Visit Due" value={`in ${customer.nextVisit}d`} />
        <KpiCard label="Days Since Last Purchase" value={customer.daysSincePurchase} tone={customer.daysSincePurchase > 21 ? "warn" : "good"} />
        <KpiCard label="Ranking" value={`#${customer.ranking}`} />
        <KpiCard label="Purchase Frequency" value={`${Math.max(1, Math.round(30 / (customer.daysSincePurchase + 3)))}/mo`} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 14 }}>
        <Card title="Monthly Sales Trend">
          <ResponsiveContainer width="100%" height={210}>
            <LineChart data={custTrend}>
              <CartesianGrid stroke={COLORS.line} vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: COLORS.textMuted, fontFamily: "Inter" }} axisLine={{ stroke: COLORS.line }} tickLine={false} />
              <YAxis tickFormatter={fmtShort} tick={{ fontSize: 10.5, fill: COLORS.textMuted, fontFamily: "Inter" }} axisLine={false} tickLine={false} width={62} />
              <Tooltip content={<CustomTooltip />} />
              <Line type="monotone" dataKey="sales" stroke={COLORS.blue} strokeWidth={2.5} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </Card>
        <Card title="Brand Contribution">
          <ResponsiveContainer width="100%" height={210}>
            <PieChart>
              <Pie data={brandMix} dataKey="value" nameKey="brand" innerRadius={45} outerRadius={78} paddingAngle={2}>
                {brandMix.map((_, i) => <Cell key={i} fill={BRAND_PALETTE[i % BRAND_PALETTE.length]} />)}
              </Pie>
              <Tooltip content={<CustomTooltip valueFmt={(v) => v + "%"} />} />
            </PieChart>
          </ResponsiveContainer>
        </Card>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------
   PRODUCT PORTFOLIO PAGE
------------------------------------------------------------------*/
function ProductPage() {
  const { SKUS } = useContext(DataContext);
  const avgScore = SKUS.length ? Math.round(SKUS.reduce((s, x) => s + x.portfolioScore, 0) / SKUS.length) : 0;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 14 }}>
        <Card title="Overall Portfolio Score" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Gauge value={avgScore} size={170} label="Company-wide SKU availability" />
        </Card>
        <Card title="Availability Status" subtitle="Traffic-light distribution across all SKUs">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, height: "100%", alignContent: "center" }}>
            {[
              { label: "Available (Green)", n: SKUS.filter((s) => s.portfolioScore >= 80).length, color: COLORS.green, soft: COLORS.greenSoft, icon: CheckCircle2 },
              { label: "Low Stock (Yellow)", n: SKUS.filter((s) => s.portfolioScore >= 60 && s.portfolioScore < 80).length, color: COLORS.amber, soft: COLORS.amberSoft, icon: AlertTriangle },
              { label: "Missing (Red)", n: SKUS.filter((s) => s.portfolioScore < 60).length, color: COLORS.red, soft: COLORS.redSoft, icon: XCircle },
            ].map((s) => (
              <div key={s.label} style={{ background: s.soft, borderRadius: 12, padding: "16px 14px", textAlign: "center" }}>
                <s.icon size={20} color={s.color} style={{ marginBottom: 6 }} />
                <div style={{ fontFamily: "Manrope", fontWeight: 800, fontSize: 22, color: s.color }}>{s.n}</div>
                <div style={{ fontSize: 11, color: COLORS.textSecondary, fontWeight: 600 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>
      <Card title="SKU-Level Portfolio" subtitle="Company → Brand → Category → SKU">
        <div style={{ maxHeight: 480, overflowY: "auto" }}>
          <table>
            <thead><tr><Th>Brand</Th><Th>Category</Th><Th>SKU</Th><Th align="right">Required</Th><Th align="right">Available</Th><Th align="right">Out of Stock</Th><Th align="right">Facing</Th><Th align="right">Shelf Share</Th><Th>Competitor</Th><Th align="right">Score</Th><Th>Status</Th></tr></thead>
            <tbody>
              {SKUS.map((s, i) => (
                <tr key={i}>
                  <Td bold>{s.brand}</Td><Td>{s.category}</Td><Td>{s.sku}</Td><Td align="right">{s.required}</Td><Td align="right">{s.available}</Td>
                  <Td align="right">{s.outOfStock}</Td><Td align="right">{s.facing}</Td><Td align="right">{s.shelfShare}%</Td>
                  <Td>{s.competitorPresent ? <Pill tone="warn">Present</Pill> : <Pill tone="good">None</Pill>}</Td>
                  <Td align="right" bold>{s.portfolioScore}%</Td>
                  <Td>{s.portfolioScore >= 80 ? <Circle size={10} fill={COLORS.green} color={COLORS.green} /> : s.portfolioScore >= 60 ? <Circle size={10} fill={COLORS.amber} color={COLORS.amber} /> : <Circle size={10} fill={COLORS.red} color={COLORS.red} />}</Td>
                </tr>
              ))}
              {!SKUS.length && <tr><Td>No SKU data loaded.</Td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

/* ---------------------------------------------------------------
   BRAND DISTRIBUTION PAGE
------------------------------------------------------------------*/
function TreemapCell({ x, y, width, height, name, fill, value }) {
  if (width < 2 || height < 2) return null;
  return (
    <g>
      <rect x={x} y={y} width={width} height={height} fill={fill} stroke="#fff" strokeWidth={2} rx={6} />
      {width > 60 && height > 30 && (<><text x={x + 8} y={y + 18} fontSize="11" fontWeight="700" fill="#fff" fontFamily="Inter">{name}</text><text x={x + 8} y={y + 32} fontSize="10" fill="#ffffffcc" fontFamily="Inter">{fmtShort(value)}</text></>)}
    </g>
  );
}
function BrandPage() {
  const { BRAND_DIST } = useContext(DataContext);
  const treemapData = BRAND_DIST.map((b, i) => ({ name: b.brand, size: b.sales, fill: BRAND_PALETTE[i % BRAND_PALETTE.length] }));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <Card title="Brand Distribution" subtitle="Numeric distribution and required-vs-available customer coverage">
        <table>
          <thead><tr><Th>Brand</Th><Th align="right">Required Customers</Th><Th align="right">Available Customers</Th><Th align="right">Distribution %</Th><Th align="right">Sales</Th><Th align="right">Growth %</Th><Th align="right">GP %</Th></tr></thead>
          <tbody>
            {BRAND_DIST.map((b) => (
              <tr key={b.brand}>
                <Td bold>{b.brand}</Td><Td align="right">{b.reqCust}</Td><Td align="right">{b.availCust}</Td>
                <Td align="right"><div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "flex-end" }}><div style={{ width: 60 }}><ProgressBar value={b.distPct} tone={b.distPct >= 80 ? "good" : b.distPct >= 60 ? "warn" : "bad"} /></div><span>{b.distPct}%</span></div></Td>
                <Td align="right">{fmt(b.sales)}</Td>
                <Td align="right"><Pill tone={b.growth >= 0 ? "good" : "bad"}>{b.growth >= 0 ? "+" : ""}{b.growth}%</Pill></Td>
                <Td align="right">{b.gpPct}%</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <Card title="Brand Distribution — Bar Chart">
          <ResponsiveContainer width="100%" height={230}>
            <BarChart data={BRAND_DIST}>
              <CartesianGrid stroke={COLORS.line} vertical={false} />
              <XAxis dataKey="brand" tick={{ fontSize: 9, fill: COLORS.textMuted, fontFamily: "Inter" }} axisLine={{ stroke: COLORS.line }} tickLine={false} interval={0} angle={-20} textAnchor="end" height={60} />
              <YAxis unit="%" tick={{ fontSize: 10.5, fill: COLORS.textMuted, fontFamily: "Inter" }} axisLine={false} tickLine={false} width={40} />
              <Tooltip content={<CustomTooltip valueFmt={(v) => v + "%"} />} />
              <Bar dataKey="distPct" name="Distribution %" radius={[6, 6, 0, 0]}>
                {BRAND_DIST.map((b, i) => <Cell key={i} fill={b.distPct >= 80 ? COLORS.green : b.distPct >= 60 ? COLORS.amber : COLORS.red} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
        <Card title="Sales Contribution — Treemap">
          <ResponsiveContainer width="100%" height={230}><Treemap data={treemapData} dataKey="size" stroke="#fff" content={<TreemapCell />} /></ResponsiveContainer>
        </Card>
        <Card title="Sales Mix — Pie Chart">
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={BRAND_DIST} dataKey="sales" nameKey="brand" outerRadius={85} label={(d) => d.brand.split(" ")[0]} labelLine={false}>
                {BRAND_DIST.map((_, i) => <Cell key={i} fill={BRAND_PALETTE[i % BRAND_PALETTE.length]} />)}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </Card>
        <Card title="Distribution Heat Map" subtitle="Darker = stronger coverage">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8 }}>
            {BRAND_DIST.map((b) => {
              const opacity = 0.25 + (b.distPct / 100) * 0.75;
              return (
                <div key={b.brand} style={{ background: `rgba(31,111,235,${opacity})`, borderRadius: 10, padding: "12px 8px", textAlign: "center" }}>
                  <div style={{ fontSize: 10.5, color: "#fff", fontWeight: 700, marginBottom: 4 }}>{b.brand}</div>
                  <div style={{ fontSize: 15, color: "#fff", fontWeight: 800, fontFamily: "Manrope" }}>{b.distPct}%</div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------
   SALES REP PAGE
------------------------------------------------------------------*/
function RepsPage() {
  const { REP_PERF } = useContext(DataContext);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <Card title="Leaderboard" subtitle="Ranked by monthly sales">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12 }}>
          {REP_PERF.slice(0, 4).map((r) => (
            <div key={r.rep} style={{ border: `1px solid ${COLORS.line}`, borderRadius: 12, padding: "14px 16px", position: "relative" }}>
              <div style={{ position: "absolute", top: 10, right: 12, fontFamily: "Manrope", fontWeight: 800, fontSize: 18, color: r.rank === 1 ? COLORS.amber : COLORS.textMuted }}>#{r.rank}</div>
              <div style={{ fontFamily: "Manrope", fontWeight: 800, fontSize: 14, color: COLORS.textPrimary }}>{r.rep}</div>
              <div style={{ fontSize: 11, color: COLORS.textMuted, marginBottom: 8 }}>{r.region}</div>
              <div style={{ fontFamily: "Manrope", fontWeight: 800, fontSize: 18, color: COLORS.blue }}>{fmtShort(r.sales)}</div>
              <ProgressBar value={r.achievement} tone={r.achievement >= 95 ? "good" : "warn"} />
              <div style={{ fontSize: 10.5, color: COLORS.textMuted, marginTop: 4 }}>{r.achievement}% of target</div>
            </div>
          ))}
        </div>
      </Card>
      <Card title="Sales Representative Performance">
        <table>
          <thead><tr><Th>Rank</Th><Th>Rep</Th><Th>Region</Th><Th align="right">Customers</Th><Th align="right">Daily Visits</Th><Th align="right">Weekly Visits</Th><Th align="right">Monthly Sales</Th><Th align="right">Target</Th><Th align="right">Achievement</Th><Th align="right">Portfolio %</Th><Th align="right">Avg Order Value</Th><Th align="right">Strike Rate</Th><Th align="right">New</Th><Th align="right">Lost</Th></tr></thead>
          <tbody>
            {REP_PERF.map((r) => (
              <tr key={r.rep}>
                <Td>#{r.rank}</Td><Td bold>{r.rep}</Td><Td>{r.region}</Td><Td align="right">{r.customers}</Td><Td align="right">{r.dailyVisits}</Td>
                <Td align="right">{r.weeklyVisits}</Td><Td align="right">{fmt(r.sales)}</Td><Td align="right">{fmt(r.target)}</Td>
                <Td align="right"><Pill tone={r.achievement >= 95 ? "good" : r.achievement >= 85 ? "warn" : "bad"}>{r.achievement}%</Pill></Td>
                <Td align="right">{r.portfolio}%</Td><Td align="right">{fmt(r.aov)}</Td><Td align="right">{r.strikeRate}%</Td><Td align="right">{r.newCust}</Td><Td align="right">{r.lostCust}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

/* ---------------------------------------------------------------
   STOCK & AVAILABILITY PAGE
------------------------------------------------------------------*/
function StockPage() {
  const { WAREHOUSE_STOCK, ABC_ANALYSIS, STOCK_TREND, SKUS, stockTrendEstimated } = useContext(DataContext);
  const movementData = SKUS.slice(0, 8).map((s) => ({ sku: s.sku.split(" ").slice(0, 2).join(" "), movement: Math.max(5, Math.min(100, Math.round(100 - s.daysSincePurchase * 2))) }));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <Card title="Warehouse Stock by Brand">
        <table>
          <thead><tr><Th>Brand</Th><Th align="right">Stock (units)</Th><Th align="right">Days of Cover</Th><Th align="right">Out of Stock</Th><Th align="right">Low Stock</Th><Th align="right">Near Expiry</Th></tr></thead>
          <tbody>
            {WAREHOUSE_STOCK.map((w) => (
              <tr key={w.brand}>
                <Td bold>{w.brand}</Td><Td align="right">{w.stockUnits.toLocaleString()}</Td>
                <Td align="right"><Pill tone={w.daysOfCover >= 20 ? "good" : w.daysOfCover >= 10 ? "warn" : "bad"}>{w.daysOfCover}d</Pill></Td>
                <Td align="right">{w.outOfStock}</Td><Td align="right">{w.lowStock}</Td><Td align="right">{w.nearExpiry}</Td>
              </tr>
            ))}
            {!WAREHOUSE_STOCK.length && <tr><Td>No stock data loaded.</Td></tr>}
          </tbody>
        </table>
      </Card>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <Card title="ABC Analysis" subtitle="Revenue contribution by SKU tier">
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={ABC_ANALYSIS} dataKey="value" nameKey="grade" innerRadius={50} outerRadius={82} paddingAngle={3}>
                {ABC_ANALYSIS.map((_, i) => <Cell key={i} fill={[COLORS.blue, COLORS.green, COLORS.amber][i]} />)}
              </Pie>
              <Tooltip content={<CustomTooltip valueFmt={(v) => v + "%"} />} />
              <Legend wrapperStyle={{ fontSize: 11, fontFamily: "Inter" }} />
            </PieChart>
          </ResponsiveContainer>
        </Card>
        <Card title="Fast vs Slow Moving SKUs" subtitle="Based on recency of last purchase per SKU">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={movementData}>
              <CartesianGrid stroke={COLORS.line} vertical={false} />
              <XAxis dataKey="sku" tick={{ fontSize: 9, fill: COLORS.textMuted, fontFamily: "Inter" }} axisLine={{ stroke: COLORS.line }} tickLine={false} interval={0} angle={-20} textAnchor="end" height={55} />
              <YAxis tick={{ fontSize: 10.5, fill: COLORS.textMuted, fontFamily: "Inter" }} axisLine={false} tickLine={false} width={30} />
              <Tooltip content={<CustomTooltip valueFmt={(v) => v} />} />
              <Bar dataKey="movement" radius={[6, 6, 0, 0]}>{movementData.map((m, i) => <Cell key={i} fill={m.movement < 40 ? COLORS.red : COLORS.blue} />)}</Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
        <Card title="Inventory Value Trend" subtitle={stockTrendEstimated ? "Estimated from current stock snapshot" : undefined}>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={STOCK_TREND}>
              <CartesianGrid stroke={COLORS.line} vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: COLORS.textMuted, fontFamily: "Inter" }} axisLine={{ stroke: COLORS.line }} tickLine={false} />
              <YAxis tickFormatter={fmtShort} tick={{ fontSize: 10.5, fill: COLORS.textMuted, fontFamily: "Inter" }} axisLine={false} tickLine={false} width={62} />
              <Tooltip content={<CustomTooltip />} />
              <Line type="monotone" dataKey="stockValue" name="Stock Value" stroke={COLORS.blue} strokeWidth={2.5} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </Card>
        <Card title="Warehouse Availability">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={STOCK_TREND}>
              <CartesianGrid stroke={COLORS.line} vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: COLORS.textMuted, fontFamily: "Inter" }} axisLine={{ stroke: COLORS.line }} tickLine={false} />
              <YAxis tick={{ fontSize: 10.5, fill: COLORS.textMuted, fontFamily: "Inter" }} axisLine={false} tickLine={false} width={30} />
              <Tooltip content={<CustomTooltip valueFmt={(v) => v} />} />
              <Bar dataKey="outOfStockItems" name="Out of Stock Items" fill={COLORS.red} radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------
   LOST OPPORTUNITY PAGE
------------------------------------------------------------------*/
function LostPage() {
  const { LOST_OPPS } = useContext(DataContext);
  const totalLost = LOST_OPPS.reduce((s, o) => s + o.estLostMonthly, 0) || 1;
  const paretoData = LOST_OPPS.slice(0, 10).map((o, i, arr) => {
    const cum = arr.slice(0, i + 1).reduce((s, x) => s + x.estLostMonthly, 0);
    return { sku: o.sku.split(" ").slice(0, 2).join(" "), lost: o.estLostMonthly, cumPct: Math.round((cum / totalLost) * 1000) / 10 };
  });
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14 }}>
        <KpiCard label="Est. Monthly Lost Sales" value={fmtShort(totalLost)} tone="bad" icon={TrendingDown} />
        <KpiCard label="Potential Annual Revenue" value={fmtShort(totalLost * 12)} tone="warn" />
        <KpiCard label="High Priority SKUs" value={LOST_OPPS.filter((o) => o.priority === "High").length} tone="bad" />
        <KpiCard label="Avg Missing Customers / SKU" value={LOST_OPPS.length ? Math.round(LOST_OPPS.reduce((s, o) => s + o.missingCustomers, 0) / LOST_OPPS.length) : 0} />
      </div>
      <Card title="Pareto Analysis" subtitle="Top 10 SKUs by lost revenue opportunity, with cumulative %">
        <ResponsiveContainer width="100%" height={260}>
          <ComposedChart data={paretoData}>
            <CartesianGrid stroke={COLORS.line} vertical={false} />
            <XAxis dataKey="sku" tick={{ fontSize: 9.5, fill: COLORS.textMuted, fontFamily: "Inter" }} axisLine={{ stroke: COLORS.line }} tickLine={false} interval={0} angle={-20} textAnchor="end" height={60} />
            <YAxis yAxisId="left" tickFormatter={fmtShort} tick={{ fontSize: 10, fill: COLORS.textMuted, fontFamily: "Inter" }} axisLine={false} tickLine={false} width={60} />
            <YAxis yAxisId="right" orientation="right" unit="%" domain={[0, 100]} tick={{ fontSize: 10, fill: COLORS.textMuted, fontFamily: "Inter" }} axisLine={false} tickLine={false} width={40} />
            <Tooltip content={<CustomTooltip />} />
            <Bar yAxisId="left" dataKey="lost" name="Lost Sales" fill={COLORS.red} radius={[6, 6, 0, 0]} />
            <Line yAxisId="right" type="monotone" dataKey="cumPct" name="Cumulative %" stroke={COLORS.navy} strokeWidth={2} dot={{ r: 3 }} />
          </ComposedChart>
        </ResponsiveContainer>
      </Card>
      <Card title="Lost Opportunity Detail" subtitle="Ranked by estimated monthly lost sales">
        <div style={{ maxHeight: 460, overflowY: "auto" }}>
          <table>
            <thead><tr><Th>Brand</Th><Th>SKU</Th><Th align="right">Missing Customers</Th><Th align="right">Est. Monthly Lost</Th><Th align="right">Potential Revenue</Th><Th>Priority</Th></tr></thead>
            <tbody>
              {LOST_OPPS.map((o, i) => (
                <tr key={i}>
                  <Td bold>{o.brand}</Td><Td>{o.sku}</Td><Td align="right">{o.missingCustomers}</Td>
                  <Td align="right">{fmt(o.estLostMonthly)}</Td><Td align="right">{fmt(o.potentialRevenue)}</Td>
                  <Td><Pill tone={o.priority === "High" ? "bad" : o.priority === "Medium" ? "warn" : "neutral"}>{o.priority}</Pill></Td>
                </tr>
              ))}
              {!LOST_OPPS.length && <tr><Td>No SKU data loaded.</Td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
