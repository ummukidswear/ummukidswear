import { BosData, ChannelCost, ChannelPrice, Order, PackagingConfig, Purchase, Expense, StockAdjustment, Target } from "@/src/data/types";

// Small, hand-authored seed for a home-based shop ("Ummu Abdullah Shop") that launched in
// Jul 2026 and now has three months of activity (Jul, Aug, Sep 2026). Every transaction is
// written explicitly so the data is easy to audit; no KPI value is hard-coded — the
// calculation layer derives every dashboard, chart, alert and action from these records.
//
// Scenarios intentionally covered so the whole system can be exercised from source data:
//  - New customers (cst-5, cst-6) and repeat customers (cst-1 loyal, cst-2, cst-3)
//  - An inactive customer (cst-4, last order Jul) and a passive one (cst-7, order early Aug)
//  - All four sales channels used, with each channel settling into its correct account
//  - Normal stock (majority), 1 stockout (prd-6), 1 near-ROP (prd-3)
//  - Fast moving (prd-1), slow moving (most), dead stock (prd-4 never sold, prd-10 stale)
//  - Varied product margins including a deliberate low-margin item (prd-8, ~10%)
//  - Purchases add inventory; orders reduce it; expenses and channel fees leave the accounts

const suppliers = [
  { id: "sup-1", name: "CV Sumber Rezeki", phone: "0811-2100-01", city: "Makassar", address: "Jl. Perintis Kemerdekaan No. 12, Makassar", notes: "MOQ 1 dus · kirim setiap Senin", status: "Aktif" as const },
  { id: "sup-2", name: "UD Berkah Tani", phone: "0811-2100-02", city: "Maros", address: "", notes: "", status: "Aktif" as const },
  { id: "sup-3", name: "PT Nusantara Pangan", phone: "0811-2100-03", city: "Makassar", address: "", notes: "Kontak sales: Pak Budi", status: "Aktif" as const },
  { id: "sup-4", name: "CV Aneka Boga", phone: "0811-2100-04", city: "Gowa", address: "", notes: "", status: "Tidak Aktif" as const },
];

const channels = [
  { id: "ch-1", name: "Shopee", status: "Aktif" as const },
  { id: "ch-2", name: "WhatsApp", status: "Aktif" as const },
  { id: "ch-3", name: "Facebook", status: "Aktif" as const },
  { id: "ch-4", name: "Toko Fisik", status: "Aktif" as const },
];

// Jenis Pengiriman untuk model Packaging per paket (Rp/paket). Id konsisten agar order
// dapat mereferensikannya. Reguler Rp3.000/paket, Instan Rp500/paket.
const SHIP_REG = "ship-reg";
const SHIP_INS = "ship-ins";
const packagingByShipping = (): PackagingConfig => ({ model: "by_shipping", shippingTypes: [{ id: SHIP_REG, name: "Reguler", value: 3000 }, { id: SHIP_INS, name: "Instan", value: 500 }] });
// Contoh Jumlah Paket & Jenis Pengiriman per order (default Reguler 1 paket).
const orderPackagingSeed: Record<string, { shippingTypeId: string; packageCount: number }> = {
  "ord-2026-09-1": { shippingTypeId: SHIP_REG, packageCount: 2 }, // demo: 1 order dikirim 2 paket
  "ord-2026-09-3": { shippingTypeId: SHIP_INS, packageCount: 1 }, // demo: pengiriman Instan
};

// Harga jual per Produk × Channel (master produk hanya referensi). Contoh: Kopi lebih mahal
// di Shopee (menutup biaya admin) dan sedikit beda di Facebook.
const channelPrices: ChannelPrice[] = [
  { id: "cp-1", productId: "prd-1", channelId: "ch-1", price: 89000 },
  { id: "cp-2", productId: "prd-1", channelId: "ch-3", price: 87000 },
];

// Biaya Channel — master konfigurasi. Default channel (sku "") untuk biaya konstan; override
// SKU untuk biaya yang berbeda per SKU. Untuk Shopee: Pesanan & Packaging pakai default channel,
// sedangkan Admin/Ongkir XTRA bersifat spesifik SKU. Pajak TIDAK pernah di sini (global 0,5%).
const channelCosts: ChannelCost[] = [
  { id: "cc-1", channelId: "ch-1", sku: "", component: "Admin", type: "percent", value: 7.5, basis: "after_discount", effectiveDate: "2026-01-01", status: "Aktif" },
  { id: "cc-2", channelId: "ch-1", sku: "", component: "Pesanan", type: "rp", value: 1250, effectiveDate: "2026-01-01", status: "Aktif" },
  { id: "cc-3", channelId: "ch-1", sku: "", component: "Packaging", type: "rp", value: 3000, effectiveDate: "2026-01-01", status: "Aktif", packaging: packagingByShipping() },
  { id: "cc-4", channelId: "ch-1", sku: "prd-1", component: "Ongkir XTRA", type: "rp", value: 2000, effectiveDate: "2026-01-01", status: "Aktif" },
  { id: "cc-5", channelId: "ch-3", sku: "", component: "Admin", type: "percent", value: 2.5, basis: "after_discount", effectiveDate: "2026-01-01", status: "Aktif" },
  { id: "cc-6", channelId: "ch-3", sku: "", component: "Packaging", type: "rp", value: 3000, effectiveDate: "2026-01-01", status: "Aktif", packaging: packagingByShipping() },
  { id: "cc-7", channelId: "ch-2", sku: "", component: "Packaging", type: "rp", value: 3000, effectiveDate: "2026-01-01", status: "Aktif", packaging: packagingByShipping() },
  // PPh 0,5% dikelola di Biaya Channel (single source) — satu komponen global per channel.
  { id: "cc-pph-1", channelId: "ch-1", sku: "", component: "PPh", type: "percent", value: 0.5, basis: "after_discount", effectiveDate: "2026-01-01", status: "Aktif" },
  { id: "cc-pph-2", channelId: "ch-2", sku: "", component: "PPh", type: "percent", value: 0.5, basis: "after_discount", effectiveDate: "2026-01-01", status: "Aktif" },
  { id: "cc-pph-3", channelId: "ch-3", sku: "", component: "PPh", type: "percent", value: 0.5, basis: "after_discount", effectiveDate: "2026-01-01", status: "Aktif" },
  { id: "cc-pph-4", channelId: "ch-4", sku: "", component: "PPh", type: "percent", value: 0.5, basis: "after_discount", effectiveDate: "2026-01-01", status: "Aktif" },
];

export const SCHEMA_VERSION = 4;

// openingStock is the stock before the first recorded transaction (Jul 2026). Combined with
// purchases (add) and orders (subtract), the calc layer derives the live stock at any month.
// Scenario tags below show the intended state at the latest month (Sep 2026).
const products = [
  // Fast Moving (14 sold in Sep >= fastMovingMinQty) + restocked; ends Normal (40 + 30 - 25 = 45, ROP 30)
  { id: "prd-1", sku: "KOP-250", name: "Kopi Arabika 250g", price: 85000, cost: 53000, openingStock: 40, rop: 30, supplierId: "sup-1", altSupplierIds: ["sup-3"] },
  // Slow Moving, Normal stock (55 - 13 = 42, ROP 20)
  { id: "prd-2", sku: "TEH-020", name: "Teh Hijau Celup 20s", price: 32000, cost: 19500, openingStock: 55, rop: 20, supplierId: "sup-2" },
  // NEAR ROP / Hampir Habis (60 - 25 - 2 opname = 33, ROP 40)
  { id: "prd-3", sku: "KRP-180", name: "Keripik Singkong 180g", price: 18000, cost: 11000, openingStock: 60, rop: 40, supplierId: "sup-2" },
  // DEAD STOCK - never sold, stock stays Normal (24, ROP 8)
  { id: "prd-4", sku: "SRP-600", name: "Sirup Leci 600ml", price: 27000, cost: 17000, openingStock: 24, rop: 8, supplierId: "sup-3" },
  // Slow Moving, high value, Normal (30 - 7 = 23, ROP 10)
  { id: "prd-5", sku: "MDU-500", name: "Madu Hutan 500ml", price: 145000, cost: 89000, openingStock: 30, rop: 10, supplierId: "sup-1" },
  // STOCKOUT / Habis (20 - 20 = 0, ROP 12)
  { id: "prd-6", sku: "GLA-350", name: "Gula Aren Cair 350ml", price: 42000, cost: 25000, openingStock: 20, rop: 12, supplierId: "sup-2" },
  // Slow Moving, high value, restocked (10 + 10 - 4 = 16, ROP 8)
  { id: "prd-7", sku: "KRM-1KG", name: "Kurma Sukari 1kg", price: 165000, cost: 102000, openingStock: 10, rop: 8, supplierId: "sup-3" },
  // LOW MARGIN (~10%), Slow Moving, Normal (45 - 10 = 35, ROP 20)
  { id: "prd-8", sku: "MKL-250", name: "Minyak Kelapa 250ml", price: 30000, cost: 27000, openingStock: 45, rop: 20, supplierId: "sup-1" },
  // Moderate margin (~23%), Slow Moving, restocked (25 + 20 - 11 = 34, ROP 15)
  { id: "prd-9", sku: "BRS-5KG", name: "Beras Organik 5kg", price: 78000, cost: 60000, openingStock: 25, rop: 15, supplierId: "sup-4", altSupplierIds: ["sup-1"] },
  // DEAD STOCK - last sold in Jul (>45 days at Sep), stock stays Normal (30 - 4 = 26, ROP 10)
  { id: "prd-10", sku: "SBN-100", name: "Sabun Herbal 100g", price: 25000, cost: 15000, openingStock: 30, rop: 10, supplierId: "sup-4" },
  // Slow Moving, Normal (40 - 7 = 33, ROP 12)
  { id: "prd-11", sku: "KCP-300", name: "Kecap Manis 300ml", price: 22000, cost: 14000, openingStock: 40, rop: 12, supplierId: "sup-3" },
  // Slow Moving, Normal (40 - 10 = 30, ROP 12)
  { id: "prd-12", sku: "TPG-1KG", name: "Tepung Premium 1kg", price: 16000, cost: 10500, openingStock: 40, rop: 12, supplierId: "sup-4" },
];

// Segment tags reflect the intended status at the latest month (Sep 2026), driven by order
// history + Parameter Bisnis (loyalMinOrders 5, repeatMinOrders 2, newCustomerDays 60,
// passiveDays 45) and Threshold inactiveCustomerDays 60.
const customers = [
  { id: "cst-1", name: "Ibu Aisyah", phone: "0812-3001-01", city: "Makassar", joinedAt: "2025-11-12" },  // Loyal (5 orders, active)
  { id: "cst-2", name: "Pak Hasan", phone: "0812-3001-02", city: "Maros", joinedAt: "2025-12-03" },       // Berulang (2 orders)
  { id: "cst-3", name: "Ibu Salma", phone: "0812-3001-03", city: "Gowa", joinedAt: "2026-01-18" },        // Berulang (2 orders)
  { id: "cst-4", name: "Toko Amanah", phone: "0812-3001-04", city: "Bone", joinedAt: "2026-02-08" },      // Tidak Aktif (last order Jul)
  { id: "cst-5", name: "Ibu Nurul", phone: "0812-3001-05", city: "Parepare", joinedAt: "2026-08-20" },    // Baru (joined & ordered recently)
  { id: "cst-6", name: "Pak Ridwan", phone: "0812-3001-06", city: "Pangkep", joinedAt: "2026-09-05" },    // Baru (joined & ordered in Sep)
  { id: "cst-7", name: "Ibu Hasnah", phone: "0812-3001-07", city: "Makassar", joinedAt: "2025-10-01" },   // Pasif (order early Aug, 45-59 days)
];

const accounts = [
  { id: "acc-1", name: "Kas Toko", type: "Kas" as const, openingBalance: 3_500_000 },
  { id: "acc-2", name: "Bank BSI", type: "Bank" as const, openingBalance: 11_000_000 },
  { id: "acc-3", name: "DANA", type: "E-Wallet" as const, openingBalance: 1_500_000 },
];

// Correct receiving account per channel (used by every order below):
//   Shopee (ch-1, 7.5% fee) -> Bank BSI (acc-2)   |  WhatsApp (ch-2, 0%) -> DANA (acc-3)
//   Facebook (ch-3, 2.5% fee) -> DANA (acc-3)      |  Toko Fisik (ch-4, 0%) -> Kas Toko (acc-1)
// Prices below equal each product's list price; returnedQty is 0 and every order is "Selesai"
// to keep the stock/omzet arithmetic transparent and easy to audit.
const orders: Order[] = [
  // ----- July 2026 (launch month): 4 orders -----
  { id: "ord-2026-07-1", code: "INV-202607-001", date: "2026-07-05", customerId: "cst-1", channelId: "ch-4", accountId: "acc-1", returnedQty: 0, status: "Selesai",
    items: [{ productId: "prd-1", qty: 5, price: 85000 }, { productId: "prd-3", qty: 4, price: 18000 }, { productId: "prd-6", qty: 3, price: 42000 }] },
  { id: "ord-2026-07-2", code: "INV-202607-002", date: "2026-07-12", customerId: "cst-2", channelId: "ch-1", accountId: "acc-2", returnedQty: 0, status: "Selesai",
    items: [{ productId: "prd-2", qty: 4, price: 32000 }, { productId: "prd-8", qty: 3, price: 30000 }] },
  { id: "ord-2026-07-3", code: "INV-202607-003", date: "2026-07-18", customerId: "cst-3", channelId: "ch-2", accountId: "acc-3", returnedQty: 0, status: "Selesai",
    items: [{ productId: "prd-3", qty: 4, price: 18000 }, { productId: "prd-9", qty: 3, price: 78000 }, { productId: "prd-12", qty: 3, price: 16000 }] },
  { id: "ord-2026-07-4", code: "INV-202607-004", date: "2026-07-10", customerId: "cst-4", channelId: "ch-3", accountId: "acc-3", returnedQty: 0, status: "Selesai",
    items: [{ productId: "prd-5", qty: 2, price: 145000 }, { productId: "prd-6", qty: 3, price: 42000 }, { productId: "prd-10", qty: 4, price: 25000 }] },

  // ----- August 2026: 4 orders -----
  { id: "ord-2026-08-1", code: "INV-202608-001", date: "2026-08-06", customerId: "cst-1", channelId: "ch-1", accountId: "acc-2", returnedQty: 0, status: "Selesai",
    items: [{ productId: "prd-1", qty: 6, price: 85000 }, { productId: "prd-3", qty: 5, price: 18000 }, { productId: "prd-6", qty: 4, price: 42000 }] },
  { id: "ord-2026-08-2", code: "INV-202608-002", date: "2026-08-14", customerId: "cst-1", channelId: "ch-4", accountId: "acc-1", returnedQty: 0, status: "Selesai",
    items: [{ productId: "prd-2", qty: 4, price: 32000 }, { productId: "prd-9", qty: 3, price: 78000 }, { productId: "prd-11", qty: 3, price: 22000 }] },
  { id: "ord-2026-08-3", code: "INV-202608-003", date: "2026-08-20", customerId: "cst-3", channelId: "ch-2", accountId: "acc-3", returnedQty: 0, status: "Selesai",
    items: [{ productId: "prd-3", qty: 4, price: 18000 }, { productId: "prd-6", qty: 3, price: 42000 }, { productId: "prd-12", qty: 3, price: 16000 }] },
  { id: "ord-2026-08-4", code: "INV-202608-004", date: "2026-08-10", customerId: "cst-7", channelId: "ch-3", accountId: "acc-3", returnedQty: 0, status: "Selesai",
    items: [{ productId: "prd-5", qty: 2, price: 145000 }, { productId: "prd-7", qty: 2, price: 165000 }, { productId: "prd-8", qty: 3, price: 30000 }] },

  // ----- September 2026 (latest month): 5 orders -----
  { id: "ord-2026-09-1", code: "INV-202609-001", date: "2026-09-05", customerId: "cst-1", channelId: "ch-1", accountId: "acc-2", returnedQty: 0, status: "Selesai",
    items: [{ productId: "prd-1", qty: 8, price: 85000 }, { productId: "prd-3", qty: 4, price: 18000 }, { productId: "prd-6", qty: 4, price: 42000 }] },
  { id: "ord-2026-09-2", code: "INV-202609-002", date: "2026-09-12", customerId: "cst-1", channelId: "ch-4", accountId: "acc-1", returnedQty: 0, status: "Selesai",
    items: [{ productId: "prd-1", qty: 6, price: 85000 }, { productId: "prd-2", qty: 5, price: 32000 }, { productId: "prd-9", qty: 5, price: 78000 }] },
  { id: "ord-2026-09-3", code: "INV-202609-003", date: "2026-09-18", customerId: "cst-2", channelId: "ch-2", accountId: "acc-3", returnedQty: 0, status: "Selesai",
    items: [{ productId: "prd-3", qty: 4, price: 18000 }, { productId: "prd-6", qty: 3, price: 42000 }, { productId: "prd-8", qty: 4, price: 30000 }] },
  { id: "ord-2026-09-4", code: "INV-202609-004", date: "2026-09-22", customerId: "cst-5", channelId: "ch-3", accountId: "acc-3", returnedQty: 0, status: "Selesai",
    items: [{ productId: "prd-5", qty: 3, price: 145000 }, { productId: "prd-7", qty: 2, price: 165000 }, { productId: "prd-11", qty: 4, price: 22000 }] },
  { id: "ord-2026-09-5", code: "INV-202609-005", date: "2026-09-25", customerId: "cst-6", channelId: "ch-4", accountId: "acc-1", returnedQty: 0, status: "Selesai",
    items: [{ productId: "prd-12", qty: 4, price: 16000 }] },
];

// Purchases add inventory and are paid from Bank BSI (acc-2). Suppliers match each product.
const purchases: Purchase[] = [
  { id: "pur-2026-07-1", code: "PO-202607-01", date: "2026-07-08", supplierId: "sup-1", accountId: "acc-2", items: [{ productId: "prd-1", qty: 30, cost: 53000 }] },
  { id: "pur-2026-08-1", code: "PO-202608-01", date: "2026-08-15", supplierId: "sup-4", accountId: "acc-2", items: [{ productId: "prd-9", qty: 20, cost: 60000 }] },
  { id: "pur-2026-09-1", code: "PO-202609-01", date: "2026-09-10", supplierId: "sup-3", accountId: "acc-2", items: [{ productId: "prd-7", qty: 10, cost: 102000 }] },
];

// Modest operating expenses for a home business: internet quota (DANA) + packaging (Kas Toko),
// plus one social-media ad in August (DANA).
const expenses: Expense[] = [
  { id: "exp-2026-07-1", date: "2026-07-03", category: "Kuota Internet", note: "Kuota Internet Jul 2026", amount: 150000, accountId: "acc-3" },
  { id: "exp-2026-07-2", date: "2026-07-06", category: "Kemasan & Label", note: "Kemasan & Label Jul 2026", amount: 100000, accountId: "acc-1" },
  { id: "exp-2026-08-1", date: "2026-08-03", category: "Kuota Internet", note: "Kuota Internet Agu 2026", amount: 150000, accountId: "acc-3" },
  { id: "exp-2026-08-2", date: "2026-08-07", category: "Kemasan & Label", note: "Kemasan & Label Agu 2026", amount: 120000, accountId: "acc-1" },
  { id: "exp-2026-08-3", date: "2026-08-18", category: "Iklan Sosmed", note: "Iklan Sosmed Agu 2026", amount: 100000, accountId: "acc-3" },
  { id: "exp-2026-09-1", date: "2026-09-03", category: "Kuota Internet", note: "Kuota Internet Sep 2026", amount: 150000, accountId: "acc-3" },
  { id: "exp-2026-09-2", date: "2026-09-08", category: "Kemasan & Label", note: "Kemasan & Label Sep 2026", amount: 100000, accountId: "acc-1" },
];

// One stock opname reduces prd-3 by 2 units in August (keeps it in the Hampir Habis band).
const adjustments: StockAdjustment[] = [
  { id: "adj-2026-08", date: "2026-08-28", productId: "prd-3", type: "reduce", qty: 2, reason: "Rusak", note: "" },
];

// Monthly omzet targets. Sep is met (healthy); the launch month (Jul) intentionally lags.
const targets: Target[] = [
  { id: "tgt-2026-07", monthKey: "2026-07", omzetTarget: 2_000_000, marginTargetPct: 20 },
  { id: "tgt-2026-08", monthKey: "2026-08", omzetTarget: 2_200_000, marginTargetPct: 20 },
  { id: "tgt-2026-09", monthKey: "2026-09", omzetTarget: 3_000_000, marginTargetPct: 20 },
];

function buildTransactions() {
  // Setiap order memakai model packaging baru: Jenis Pengiriman + Jumlah Paket (default Reguler, 1 paket).
  const shippedOrders: Order[] = orders.map((order) => ({ ...order, ...(orderPackagingSeed[order.id] ?? { shippingTypeId: SHIP_REG, packageCount: 1 }) }));
  return { orders: shippedOrders, purchases, expenses, adjustments, targets };
}

export function createSeedData(): BosData {
  const { orders, purchases, expenses, adjustments, targets } = buildTransactions();
  const seededProducts = products.map((product) => ({ status: "Aktif" as const, ...product }));
  const seededCustomers = customers.map((customer) => ({ province: "Sulawesi Selatan", notes: "", ...customer }));
  const seededSuppliers = suppliers.map((supplier) => ({ province: "Sulawesi Selatan", ...supplier }));
  const seededAccounts = accounts.map((account) => ({ status: "Aktif" as const, notes: "", ...account }));
  return {
    schemaVersion: SCHEMA_VERSION,
    suppliers: seededSuppliers, channels, channelPrices, channelCosts, products: seededProducts, customers: seededCustomers, accounts: seededAccounts,
    orders, purchases, expenses, adjustments, targets,
    params: { loyalMinOrders: 3, repeatMinOrders: 2, newCustomerDays: 30, passiveDays: 31, turnoverWindowDays: 30, fastMovingMinQty: 12 },
    thresholds: { stokMenipisFactor: 1, deadStockDays: 45, marginLowPct: 20, returnHighPct: 3, salesBelowTargetPct: 95, inactiveCustomerDays: 90, channelCostHighPct: 6, stokHabisMinCount: 1, lowCashBalance: 2_000_000 },
    rules: [
      { id: "rul-1", key: "stok_habis", label: "Stok Habis", enabled: true, severity: "Tinggi" },
      { id: "rul-2", key: "stok_menipis", label: "Stok Menipis", enabled: true, severity: "Tinggi" },
      { id: "rul-3", key: "dead_stock", label: "Dead Stock", enabled: true, severity: "Sedang" },
      { id: "rul-4", key: "margin_rendah", label: "Margin Rendah", enabled: true, severity: "Tinggi" },
      { id: "rul-5", key: "retur_tinggi", label: "Retur Tinggi", enabled: true, severity: "Sedang" },
      { id: "rul-6", key: "penjualan_bawah_target", label: "Penjualan Di Bawah Target", enabled: true, severity: "Tinggi" },
      { id: "rul-7", key: "pelanggan_tidak_aktif", label: "Pelanggan Tidak Aktif", enabled: true, severity: "Sedang" },
      { id: "rul-8", key: "biaya_channel_tinggi", label: "Biaya Channel Tinggi", enabled: true, severity: "Rendah" },
      { id: "rul-9", key: "saldo_kas_rendah", label: "Saldo Kas Rendah", enabled: true, severity: "Tinggi" },
      { id: "rul-10", key: "laba_bersih_negatif", label: "Laba Bersih Negatif", enabled: true, severity: "Tinggi" },
    ],
    settings: { shopName: "Ummu Abdullah Shop", ownerName: "Ummu Abdullah", currency: "IDR", notifyAlert: true, notifyDailySummary: true, notifyWeeklyReport: false },
    audit: [],
    actionStatus: {},
  };
}
