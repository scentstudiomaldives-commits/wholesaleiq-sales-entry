import { NextResponse } from "next/server";
import { createClient } from "../../../lib/supabaseServer";
import { matchInvoiceToDatabase } from "../../../lib/invoiceMatching";

// Needs Buffer/fetch-with-large-bodies — not compatible with the edge runtime.
export const runtime = "nodejs";
// Vision calls can run long, especially on a cold start. This asks Vercel
// for more time than the default — actual cap depends on your plan (10s
// on Hobby regardless of this setting, up to 60s+ on Pro).
export const maxDuration = 60;

const MAX_FILE_BYTES = 8 * 1024 * 1024; // 8MB
const ALLOWED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/jpg", "image/webp"];

const EXTRACTION_PROMPT = `You are reading a photo of a wholesale invoice or receipt for an FMCG distributor in the Maldives.

Return ONLY a single valid JSON object — no markdown fences, no commentary — matching exactly this shape:
{
  "customer_name": string or null,
  "customer_code": string or null,
  "island": string or null,
  "invoice_number": string or null,
  "date": string in YYYY-MM-DD format, or null,
  "items": [
    { "sku_code": string or null, "description": string, "quantity": number, "unit_price": number, "total": number }
  ],
  "grand_total": number or null,
  "payment_status": "paid" or "pending" or "partial" or null,
  "warnings": [string]
}

Rules:
- If a field is unreadable, smudged, or simply not present on the document, use null — do NOT guess or invent a value.
- If the image is too blurry to read reliably, still return your best-effort JSON but add a clear note to "warnings" (e.g. "image is blurry, totals may be inaccurate").
- If the items' totals don't sum to the grand total, add a note to "warnings" rather than silently adjusting numbers.
- "sku_code" is whatever product code/SKU is printed on the invoice, if any — leave it null if the invoice only shows a product name.`;

export async function POST(request) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "Invoice scanning isn't set up yet — ask your admin to add an OPENAI_API_KEY to the server." },
        { status: 500 }
      );
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "You're not signed in." }, { status: 401 });
    }

    let formData;
    try {
      formData = await request.formData();
    } catch {
      return NextResponse.json({ error: "Could not read the upload. Try again." }, { status: 400 });
    }

    const file = formData.get("file");
    if (!file || typeof file === "string") {
      return NextResponse.json({ error: "No file was received." }, { status: 400 });
    }
    if (file.type === "application/pdf") {
      return NextResponse.json(
        { error: "PDF isn't supported yet — please take a photo of the invoice instead (PNG/JPG works)." },
        { status: 400 }
      );
    }
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: `Unsupported file type (${file.type || "unknown"}). Upload a PNG or JPG photo.` },
        { status: 400 }
      );
    }
    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json({ error: "That file is too large (max 8MB) — try a smaller photo." }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");
    const dataUrl = `data:${file.type};base64,${base64}`;

    const extraction = await extractInvoiceWithOpenAI(dataUrl);
    if (extraction.error) {
      return NextResponse.json({ error: extraction.error }, { status: 502 });
    }

    // Store the original image in Supabase Storage so admin/rep can review
    // the source document later, not just the AI's interpretation of it.
    let invoiceImagePath = null;
    try {
      const ext = file.type === "image/png" ? "png" : "jpg";
      const path = `${user.id}/${Date.now()}.${ext}`;
      const { error: uploadErr } = await supabase.storage.from("invoices").upload(path, arrayBuffer, {
        contentType: file.type,
      });
      if (!uploadErr) invoiceImagePath = path;
    } catch {
      // Non-fatal — the review flow still works without the stored image,
      // it just won't have a saved copy for later audit.
    }

    const [{ data: customers }, { data: skus }] = await Promise.all([
      supabase.from("customers").select("id, customer_code, name, region, area").eq("status", "active"),
      supabase.from("skus").select("id, product_code, sku, brand"),
    ]);

    const match = matchInvoiceToDatabase(extraction.data, customers || [], skus || []);

    return NextResponse.json({
      parsed: extraction.data,
      warnings: extraction.data.warnings || [],
      match,
      invoice_image_path: invoiceImagePath,
    });
  } catch (err) {
    console.error("parse-invoice error:", err);
    return NextResponse.json(
      { error: "Something went wrong reading that invoice. Try a clearer photo, or enter it manually." },
      { status: 500 }
    );
  }
}

async function extractInvoiceWithOpenAI(dataUrl) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45000);

  let resp;
  try {
    resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        response_format: { type: "json_object" },
        temperature: 0,
        max_tokens: 1500,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: EXTRACTION_PROMPT },
              { type: "image_url", image_url: { url: dataUrl } },
            ],
          },
        ],
      }),
    });
  } catch (e) {
    if (e.name === "AbortError") {
      return { error: "The invoice-reading service took too long to respond. Try again, or enter this invoice manually." };
    }
    return { error: "Could not reach the invoice-reading service. Check your connection and try again." };
  } finally {
    clearTimeout(timeout);
  }

  if (!resp.ok) {
    const body = await resp.text().catch(() => "");
    return { error: `Invoice-reading service returned an error (status ${resp.status}). ${body.slice(0, 200)}` };
  }

  let json;
  try {
    json = await resp.json();
  } catch {
    return { error: "The invoice-reading service returned an unreadable response." };
  }

  const content = json?.choices?.[0]?.message?.content;
  if (!content) {
    return { error: "The invoice-reading service returned an empty response." };
  }

  let data;
  try {
    data = JSON.parse(content);
  } catch {
    return { error: "Could not understand the invoice-reading service's response. Try again, or enter this invoice manually." };
  }

  if (!data || typeof data !== "object" || !Array.isArray(data.items)) {
    return { error: "The invoice-reading service returned data in an unexpected shape. Try again, or enter this invoice manually." };
  }

  return { data };
}
