// Run with: node lib/__tests__/invoiceMatching.test.js
// No framework needed — plain assertions, exits non-zero on failure.
const assert = require("assert");
const { matchInvoiceToDatabase } = require("../invoiceMatching");

const customers = [
  { id: "c1", customer_code: "C-1001", name: "Sunrise Supermarket", region: "Kaafu Atoll", area: "Hulhumale'" },
  { id: "c2", customer_code: "C-1003", name: "Blue Horizon Hotel", region: "Kaafu Atoll", area: "Male'" },
];
const skus = [
  { id: "s1", product_code: "CMP-001", sku: "CAMPA APPLE JUICE 100% 250ML", brand: "Campa" },
  { id: "s2", product_code: "QBY-001", sku: "QUICKBURY BROWNIE CHOCO 285G", brand: "QUICKBURY" },
];

// Exact code match — the easy, expected case.
{
  const r = matchInvoiceToDatabase(
    { customer_code: "C-1001", customer_name: "Sunrise Supermarket",
      items: [{ sku_code: "CMP-001", description: "Campa Apple Juice", quantity: 10, unit_price: 28, total: 280 }] },
    customers, skus
  );
  assert.strictEqual(r.customer_matched, true);
  assert.strictEqual(r.customer_id, "c1");
  assert.strictEqual(r.items[0].matched, true);
  assert.strictEqual(r.items[0].matched_sku_id, "s1");
}

// AI missed the code, only extracted a fuzzy/mis-cased name — still resolves.
{
  const r = matchInvoiceToDatabase(
    { customer_code: null, customer_name: "sunrise supermarket ",
      items: [{ sku_code: null, description: "CAMPA APPLE JUICE 100% 250ML", quantity: 5, unit_price: 28, total: 140 }] },
    customers, skus
  );
  assert.strictEqual(r.customer_matched, true);
  assert.strictEqual(r.customer_id, "c1");
  assert.strictEqual(r.items[0].matched, true);
}

// Critical safety case: unrelated data must NEVER silently match the wrong record.
{
  const r = matchInvoiceToDatabase(
    { customer_code: "ZZZ-999", customer_name: "Totally Unknown Shop",
      items: [{ sku_code: "XXX-999", description: "Mystery Product", quantity: 1, unit_price: 10, total: 10 }] },
    customers, skus
  );
  assert.strictEqual(r.customer_matched, false);
  assert.strictEqual(r.customer_id, null);
  assert.strictEqual(r.items[0].matched, false);
  assert.strictEqual(r.unmatched_item_count, 1);
}

console.log("invoiceMatching: all tests passed");
