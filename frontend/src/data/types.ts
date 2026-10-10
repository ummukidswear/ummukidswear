// Single integrated data model for BOS. Every module in More writes into this shape and
// the calculation layer (src/data/calc.ts) derives every KPI, chart, alert and action
// from it, so Home / Analytics / Alert / Action never hold their own numbers.
export type ID = string;

export type Supplier = { id: ID; name: string; phone: string; province?: string; city: string; address?: string; notes?: string; status: "Aktif" | "Tidak Aktif" };

export type Channel = { id: ID; name: string; status: "Aktif" | "Tidak Aktif" };

// Profit Engine masters — Harga jual per Produk × Channel, dan Biaya Channel (master
// konfigurasi biaya: default channel + override SKU). Ini satu-satunya sumber konfigurasi
// biaya channel untuk Profit Engine.
export type ChannelPrice = { id: ID; productId: ID; channelId: ID; price: number };

export type CostBasis = "before_discount" | "after_discount";

// Packaging kini dihitung PER PAKET berdasarkan Jenis Pengiriman (Rp/paket), bukan per item.
// Jenis pengiriman dapat ditambah/ubah/hapus. Konfigurasi ini melekat pada komponen
// "Packaging" di Biaya Channel (Single Source of Truth) dan dikonsumsi Profit Engine.
export type ShippingType = { id: ID; name: string; value: number };
export type PackagingModel = "by_shipping" | "flat";
export type PackagingConfig = {
  model: PackagingModel;         // by_shipping = beda per jenis pengiriman; flat = satu biaya
  shippingTypes: ShippingType[]; // dipakai saat model "by_shipping"
  flatValue?: number;            // dipakai saat model "flat"
};

export type ChannelCost = {
  id: ID;
  channelId: ID;
  sku: ID | "";            // "" = Default (semua SKU); isi = override SKU
  component: string;       // Admin, Pesanan, Packaging, Ongkir XTRA, Promo XTRA, dll
  type: "percent" | "rp";  // % dari nilai jual, atau Rp/item
  value: number;
  basis?: CostBasis;       // basis perhitungan untuk tipe %
  effectiveDate: string;   // YYYY-MM-DD, wajib
  status?: "Aktif" | "Tidak Aktif";
  packaging?: PackagingConfig; // HANYA komponen Packaging: biaya per paket per jenis pengiriman
};

// Snapshot biaya per Order Item, dikunci saat transaksi (harga aktual, diskon, HPP,
// biaya channel, packaging). Perubahan master di kemudian hari tidak mengubah laba historis.
export type ItemCostSnapshot = {
  actualPriceUnit: number;
  sellerDiscountUnit: number;
  channelCosts: { component: string; type: "percent" | "rp"; value: number; basis: CostBasis }[];
  packaging: { type: "percent" | "rp"; value: number } | null;
  // PPh/pajak dari master Biaya Channel (single source). undefined = snapshot lama sebelum
  // PPh dikelola di Biaya Channel → Profit Engine memakai fallback legacy 0,5%.
  tax?: { type: "percent" | "rp"; value: number } | null;
  hppUnit: number;
  hasConfig: boolean;
  estimated: boolean;
};

export type Product = {
  id: ID;
  sku: string;
  name: string;
  price: number;        // selling price per unit (Rp)
  cost: number;         // purchase cost per unit (Rp)
  openingStock: number; // stock before the first recorded transaction
  rop: number;          // reorder point, drives "Hampir Habis"
  supplierId: ID | "";      // Supplier Utama (preferred/default), boleh kosong
  altSupplierIds?: ID[];    // Supplier Alternatif (0..n)
  targetMarginPct?: number; // Target Gross Margin (%) untuk rekomendasi harga
  status?: "Aktif" | "Tidak Aktif";
};

// province = Provinsi, city = Kota/Kabupaten. Alamat lengkap bukan master (mengikuti Order).
export type Customer = { id: ID; name: string; phone: string; province?: string; city: string; joinedAt: string; notes?: string };

export type OrderItem = { productId: ID; qty: number; price: number; returnedQty?: number; sellerDiscount?: number; costSnapshot?: ItemCostSnapshot };

export type Order = {
  id: ID;
  code: string;
  date: string;          // YYYY-MM-DD
  customerId: ID | "";
  channelId: ID | "";
  accountId: ID | "";    // cash account that received the payment
  items: OrderItem[];
  returnedQty?: number;  // deprecated: retur kini per item (OrderItem.returnedQty)
  status: "Selesai" | "Batal";
  // Packaging per paket: order menyimpan Jenis Pengiriman + Jumlah Paket. Biaya packaging =
  // biaya/paket (dikunci di packagingSnapshot) × packageCount. Tidak bergantung jumlah item.
  shippingTypeId?: ID;
  shippingTypeName?: string;
  packageCount?: number;
  packagingSnapshot?: { unit: number } | null;
};

export type PurchaseItem = { productId: ID; qty: number; cost: number };

export type Purchase = { id: ID; code: string; date: string; supplierId: ID | ""; accountId: ID | ""; items: PurchaseItem[] };

export type Expense = { id: ID; date: string; category: string; note: string; amount: number; accountId: ID | "" };

export type CashAccount = { id: ID; name: string; type: "Kas" | "Bank" | "E-Wallet"; openingBalance: number; status?: "Aktif" | "Tidak Aktif"; notes?: string };

export type StockAdjustment = { id: ID; date: string; productId: ID; type?: "add" | "reduce"; qty: number; reason: string; note?: string };

export type Target = { id: ID; monthKey: string; omzetTarget: number; marginTargetPct: number };

export type BusinessParams = {
  loyalMinOrders: number;
  repeatMinOrders: number;
  newCustomerDays: number;
  passiveDays: number;
  turnoverWindowDays: number;
  fastMovingMinQty: number;
};

export type Thresholds = {
  stokMenipisFactor: number;      // multiplier applied to the product ROP
  deadStockDays: number;          // no sale for N days -> Dead Stock
  marginLowPct: number;           // margin below N% -> Margin Rendah
  returnHighPct: number;          // returns above N% of omzet -> Retur Tinggi
  salesBelowTargetPct: number;    // omzet below N% of target -> Penjualan Di Bawah Target
  inactiveCustomerDays: number;   // no order for N days -> Pelanggan Tidak Aktif
  channelCostHighPct: number;     // channel fee above N% of its omzet -> Biaya Channel Tinggi
  stokHabisMinCount: number;      // minimum out-of-stock SKU count before alerting
  lowCashBalance: number;         // saldo kas di bawah Rp N -> Saldo Kas Rendah
};

export type RuleKey =
  | "stok_habis"
  | "stok_menipis"
  | "dead_stock"
  | "margin_rendah"
  | "retur_tinggi"
  | "penjualan_bawah_target"
  | "pelanggan_tidak_aktif"
  | "biaya_channel_tinggi"
  | "saldo_kas_rendah"
  | "laba_bersih_negatif";

export type BusinessRule = { id: ID; key: RuleKey; label: string; enabled: boolean; severity: "Tinggi" | "Sedang" | "Rendah" };

export type Settings = { shopName: string; ownerName: string; currency: string; notifyAlert: boolean; notifyDailySummary: boolean; notifyWeeklyReport: boolean };

export type AuditEntry = { id: ID; at: string; action: "Tambah" | "Ubah" | "Hapus" | "Import" | "Reset"; entity: string; label: string };

export type BosData = {
  schemaVersion?: number;
  suppliers: Supplier[];
  channels: Channel[];
  channelPrices: ChannelPrice[];
  channelCosts: ChannelCost[];
  products: Product[];
  customers: Customer[];
  orders: Order[];
  purchases: Purchase[];
  expenses: Expense[];
  accounts: CashAccount[];
  adjustments: StockAdjustment[];
  targets: Target[];
  params: BusinessParams;
  thresholds: Thresholds;
  rules: BusinessRule[];
  settings: Settings;
  audit: AuditEntry[];
  actionStatus: Record<string, "open" | "done">;
};

export type CollectionKey = "suppliers" | "channels" | "channelPrices" | "channelCosts" | "products" | "customers" | "orders" | "purchases" | "expenses" | "accounts" | "adjustments" | "targets" | "rules";
