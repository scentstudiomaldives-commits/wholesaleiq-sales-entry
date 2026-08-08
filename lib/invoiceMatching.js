// Matches AI-parsed invoice fields against real database rows.
// Pure function, no I/O — kept separate from the API route so it can be
// unit-tested directly (see lib/__tests__/invoiceMatching.test.js) without
// spinning up Next.js or hitting a real database.

function norm(s) {
  return (s || "").toString().trim().toLowerCase();
}

function findCustomer(parsed, customers) {
  if (parsed.customer_code) {
    const byCode = customers.find((c) => norm(c.customer_code) === norm(parsed.customer_code));
    if (byCode) return byCode;
  }
  if (parsed.customer_name) {
    const target = norm(parsed.customer_name);
    const exact = customers.find((c) => norm(c.name) === target);
    if (exact) return exact;
    const partial = customers.find((c) => norm(c.name).includes(target) || target.includes(norm(c.name)));
    if (partial) return partial;
  }
  return null;
}

function findSku(item, skus) {
  if (item.sku_code) {
    const byCode = skus.find((s) => norm(s.product_code) === norm(item.sku_code));
    if (byCode) return byCode;
  }
  if (item.description) {
    const target = norm(item.description);
    const exact = skus.find((s) => norm(s.sku) === target);
    if (exact) return exact;
    const partial = skus.find((s) => norm(s.sku).includes(target) || target.includes(norm(s.sku)));
    if (partial) return partial;
  }
  return null;
}

/**
 * @param {object} parsed - the AI-extracted invoice JSON (customer_name,
 *   customer_code, items: [{sku_code, description, quantity, unit_price, total}], ...)
 * @param {Array} customers - active customers from the database:
 *   [{id, customer_code, name, region, area}]
 * @param {Array} skus - product catalog: [{id, product_code, sku, brand}]
 * @returns {object} match result the review UI can render and edit
 */
function matchInvoiceToDatabase(parsed, customers, skus) {
  const customerMatch = findCustomer(parsed, customers || []);

  const items = (parsed.items || []).map((item) => {
    const skuMatch = findSku(item, skus || []);
    return {
      sku_code_raw: item.sku_code || null,
      description: item.description || null,
      quantity: Number(item.quantity) || 0,
      unit_price: Number(item.unit_price) || 0,
      total: Number(item.total) || 0,
      matched_sku_id: skuMatch ? skuMatch.id : null,
      matched_sku_name: skuMatch ? skuMatch.sku : null,
      matched_sku_brand: skuMatch ? skuMatch.brand : null,
      matched: !!skuMatch,
    };
  });

  // Up to 5 "did you mean" suggestions when there's no confident customer match.
  const customerCandidates = customerMatch
    ? []
    : (customers || [])
        .filter((c) => parsed.customer_name && norm(c.name).includes(norm(parsed.customer_name).slice(0, 4)))
        .slice(0, 5)
        .map((c) => ({ id: c.id, name: c.name, customer_code: c.customer_code, region: c.region, area: c.area }));

  return {
    customer_id: customerMatch ? customerMatch.id : null,
    customer_matched: !!customerMatch,
    customer_candidates: customerCandidates,
    items,
    unmatched_item_count: items.filter((i) => !i.matched).length,
    computed_total: Math.round(items.reduce((s, i) => s + i.total, 0) * 100) / 100,
  };
}

module.exports = { matchInvoiceToDatabase, norm };
