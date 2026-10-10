import { BosData, CollectionKey } from "@/src/data/types";
import { accountBalances, latestMonthKey, stockOf } from "@/src/data/calc";
import { formatRupiah, monthLabel } from "@/src/data/time";

export type FieldDef = {
  key: string;
  label: string;
  type: "text" | "number" | "date" | "month" | "select" | "multiselect" | "toggle" | "lines" | "province" | "city" | "shipping";
  options?: { value: string; label: string }[];
  from?: CollectionKey;
  lineValueKey?: "price" | "cost";
  optional?: boolean;
  searchable?: boolean;   // large/growing master data -> searchable picker
  provinceKey?: string;   // for type "city": draft key holding the selected province
  cityKey?: string;       // for type "province": draft key of the dependent city field
  lineReturns?: boolean;  // show per-item Qty Retur inside the lines editor
  lineDiscount?: boolean; // show per-item Diskon Seller inside the lines editor
  initialOnly?: boolean;  // value locked after creation (Stok Awal)
  money?: boolean;        // format ribuan Indonesia (nominal Rupiah), underlying numeric
  allowEmptyOption?: { label: string }; // prepend a blank option (e.g. "Default semua SKU")
  system?: boolean;       // identifier dibuat otomatis sistem (SKU/ID) — read-only, tak bisa diinput manual
  systemHint?: string;    // teks pengganti saat nilai system belum dibuat (form Tambah)
  customerPicker?: boolean; // Order: autocomplete pelanggan (cari Nama/Telepon) + Tambah Pelanggan Baru
};

export type CrudDef = {
  kind: "crud";
  slug: string;
  title: string;
  subtitle: string;
  icon: string;
  collection: CollectionKey;
  idPrefix: string;
  fields: FieldDef[];
  blank: Record<string, unknown>;
  rowTitle: (item: any, data: BosData) => string;
  rowSub: (item: any, data: BosData) => string;
  rowValue?: (item: any, data: BosData) => string;
  canAdd?: boolean;
  canDelete?: boolean;
  sortDesc?: boolean;
};

export type ModuleDef = CrudDef | {
  kind: "numbers" | "keuangan" | "laporan-penjualan" | "laporan-keuangan" | "laporan-stok" | "laba" | "laba-penjualan" | "rekomendasi-harga" | "import" | "export" | "quality" | "backup" | "pengaturan" | "notifikasi" | "audit" | "reset" | "tema";
  slug: string;
  title: string;
  subtitle: string;
  icon: string;
  target?: "params" | "thresholds";
};

export const moreMenu: { group: string; items: { slug: string; label: string; icon: string }[] }[] = [
  { group: "Operasional", items: [
    { slug: "order", label: "Order", icon: "cart-outline" },
    { slug: "produk", label: "Produk", icon: "package-variant-closed" },
    { slug: "inventori", label: "Inventori", icon: "clipboard-list-outline" },
    { slug: "pembelian", label: "Pembelian", icon: "truck-outline" },
    { slug: "supplier", label: "Supplier", icon: "handshake-outline" },
    { slug: "pelanggan", label: "Pelanggan", icon: "account-group-outline" },
    { slug: "channel", label: "Channel Penjualan", icon: "storefront-outline" },
  ] },  { group: "Keuangan", items: [
    { slug: "keuangan", label: "Keuangan", icon: "finance" },
    { slug: "pengeluaran", label: "Pengeluaran", icon: "receipt" },
    { slug: "akun-kas", label: "Akun Kas / Rekening", icon: "wallet-outline" },
  ] },
  { group: "Target & Setup", items: [
    { slug: "target", label: "Target", icon: "target" },
    { slug: "parameter", label: "Parameter Bisnis", icon: "tune-variant" },
    { slug: "threshold", label: "Threshold", icon: "speedometer" },
    { slug: "business-rules", label: "Business Rules", icon: "shield-check-outline" },
  ] },
  { group: "Laporan", items: [
    { slug: "laporan-penjualan", label: "Penjualan", icon: "chart-line" },
    { slug: "laporan-keuangan", label: "Keuangan", icon: "cash-multiple" },
    { slug: "laporan-stok", label: "Stok", icon: "archive-outline" },
    { slug: "laba", label: "Laba (Profit Engine)", icon: "chart-areaspline" },
    { slug: "laba-penjualan", label: "Laba Penjualan", icon: "chart-box-outline" },
  ] },
  { group: "Data", items: [
    { slug: "biaya-channel", label: "Biaya Channel", icon: "sale" },
    { slug: "import-data", label: "Impor Data", icon: "database-import-outline" },
    { slug: "export-data", label: "Ekspor Data", icon: "database-export-outline" },
    { slug: "data-quality", label: "Data Quality", icon: "check-decagram-outline" },
    { slug: "backup", label: "Backup & Restore", icon: "cloud-sync-outline" },
  ] },
  { group: "Sistem", items: [
    { slug: "pengaturan", label: "Pengaturan", icon: "cog-outline" },
    { slug: "tema", label: "Tema", icon: "theme-light-dark" },
    { slug: "notifikasi", label: "Notifikasi", icon: "bell-outline" },
    { slug: "audit-log", label: "Audit Log", icon: "history" },
    { slug: "reset-data", label: "Reset Data", icon: "delete-sweep-outline" },
  ] },
];

const nameOf = (data: BosData, collection: "suppliers" | "channels" | "products" | "customers" | "accounts", id: string) => {
  const list = data[collection] as { id: string; name: string }[];
  return list.find((item) => item.id === id)?.name ?? "-";
};

const orderTotal = (item: { items: { qty: number; price: number }[] }) => item.items.reduce((sum, line) => sum + line.qty * line.price, 0);
const purchaseTotal = (item: { items: { qty: number; cost: number }[] }) => item.items.reduce((sum, line) => sum + line.qty * line.cost, 0);

export const modules: ModuleDef[] = [
  {
    kind: "crud", slug: "order", title: "Order", subtitle: "Transaksi penjualan · sumber omzet, AOV & qty", icon: "cart-outline",
    collection: "orders", idPrefix: "ord", sortDesc: true,
    fields: [
      { key: "date", label: "Tanggal", type: "date" },
      { key: "customerId", label: "Pelanggan", type: "select", from: "customers", searchable: true, customerPicker: true },
      { key: "channelId", label: "Channel Penjualan", type: "select", from: "channels" },
      { key: "accountId", label: "Akun Kas Penerima", type: "select", from: "accounts", searchable: true },
      { key: "shippingTypeId", label: "Jenis Pengiriman", type: "shipping" },
      { key: "packageCount", label: "Jumlah Paket", type: "number" },
      { key: "items", label: "Item Produk", type: "lines", lineValueKey: "price", lineReturns: true, lineDiscount: true },
      { key: "status", label: "Status", type: "select", options: [{ value: "Selesai", label: "Selesai" }, { value: "Batal", label: "Batal" }] },
    ],
    blank: { code: "", date: new Date().toISOString().slice(0, 10), customerId: "", channelId: "", accountId: "", shippingTypeId: "", packageCount: 1, items: [], status: "Selesai" },
    rowTitle: (item) => item.code || "Order",
    rowSub: (item, data) => `${item.date} · ${nameOf(data, "customers", item.customerId)} · ${nameOf(data, "channels", item.channelId)} · ${item.packageCount ?? 1} paket${item.status === "Batal" ? " · Batal" : ""}`,
    rowValue: (item) => formatRupiah(orderTotal(item)),
  },
  {
    kind: "crud", slug: "produk", title: "Produk", subtitle: "Master produk · harga, HPP & ROP", icon: "package-variant-closed",
    collection: "products", idPrefix: "prd",
    fields: [
      { key: "sku", label: "SKU", type: "text", system: true, systemHint: "Dibuat otomatis saat disimpan (SKU-0001)" },
      { key: "name", label: "Nama Produk", type: "text" },
      { key: "price", label: "Harga Jual Master", type: "number", money: true },
      { key: "cost", label: "HPP Awal / Unit", type: "number", money: true },
      { key: "openingStock", label: "Stok Awal (setup awal saja)", type: "number", initialOnly: true },
      { key: "rop", label: "ROP (batas stok menipis)", type: "number" },
      { key: "targetMarginPct", label: "Target Gross Margin (%)", type: "number", optional: true },
      { key: "supplierId", label: "Supplier Utama", type: "select", from: "suppliers", searchable: true, optional: true },
      { key: "altSupplierIds", label: "Supplier Alternatif (opsional)", type: "multiselect", from: "suppliers" },
      { key: "status", label: "Status", type: "select", options: [{ value: "Aktif", label: "Aktif" }, { value: "Tidak Aktif", label: "Tidak Aktif" }] },
    ],
    blank: { sku: "", name: "", price: "", cost: "", openingStock: "", rop: "", targetMarginPct: "", supplierId: "", altSupplierIds: [], status: "Aktif" },
    rowTitle: (item) => item.name || "Produk",
    rowSub: (item, data) => `${item.sku} · ${formatRupiah(item.price)} · supplier ${nameOf(data, "suppliers", item.supplierId)}${(item.status && item.status !== "Aktif") ? " · Tidak Aktif" : ""}`,
    rowValue: (item, data) => `${stockOf(data, item, latestMonthKey(data))} pcs`,
  },
  {
    kind: "crud", slug: "inventori", title: "Inventori", subtitle: "Penyesuaian stok · opname, rusak, hilang", icon: "clipboard-list-outline",
    collection: "adjustments", idPrefix: "adj", sortDesc: true,
    fields: [
      { key: "date", label: "Tanggal", type: "date" },
      { key: "productId", label: "Produk", type: "select", from: "products", searchable: true },
      { key: "type", label: "Jenis Penyesuaian", type: "select", options: [{ value: "add", label: "Tambah Stok" }, { value: "reduce", label: "Kurangi Stok" }] },
      { key: "qty", label: "Qty", type: "number" },
      { key: "reason", label: "Alasan", type: "select", options: [{ value: "Stok Opname", label: "Stok Opname" }, { value: "Rusak", label: "Rusak" }, { value: "Hilang", label: "Hilang" }, { value: "Koreksi Stok", label: "Koreksi Stok" }, { value: "Lainnya", label: "Lainnya" }] },
      { key: "note", label: "Keterangan (opsional, untuk Lainnya)", type: "text", optional: true },
    ],
    blank: { date: new Date().toISOString().slice(0, 10), productId: "", type: "add", qty: "", reason: "Stok Opname", note: "" },
    rowTitle: (item, data) => nameOf(data, "products", item.productId),
    rowSub: (item) => `${item.date} · ${item.reason || "Penyesuaian"}${item.note ? ` · ${item.note}` : ""}`,
    rowValue: (item) => { const mag = Math.abs(Number(item.qty) || 0); const reduce = item.type ? item.type === "reduce" : Number(item.qty) < 0; return `${reduce ? "-" : "+"}${mag} pcs`; },
  },
  {
    kind: "crud", slug: "pembelian", title: "Pembelian", subtitle: "Pembelian ke supplier · menambah stok & kas keluar", icon: "truck-outline",
    collection: "purchases", idPrefix: "pur", sortDesc: true,
    fields: [
      { key: "code", label: "Kode Pembelian", type: "text" },
      { key: "date", label: "Tanggal", type: "date" },
      { key: "supplierId", label: "Supplier", type: "select", from: "suppliers", searchable: true },
      { key: "accountId", label: "Akun Kas Pembayar", type: "select", from: "accounts", searchable: true },
      { key: "items", label: "Item Produk", type: "lines", lineValueKey: "cost" },
    ],
    blank: { code: "", date: new Date().toISOString().slice(0, 10), supplierId: "", accountId: "", items: [] },
    rowTitle: (item) => item.code || "Pembelian",
    rowSub: (item, data) => `${item.date} · ${nameOf(data, "suppliers", item.supplierId)}`,
    rowValue: (item) => formatRupiah(purchaseTotal(item)),
  },
  {
    kind: "crud", slug: "supplier", title: "Supplier", subtitle: "Pemasok produk untuk pembelian", icon: "handshake-outline",
    collection: "suppliers", idPrefix: "sup",
    fields: [
      { key: "name", label: "Nama Supplier", type: "text" },
      { key: "phone", label: "Telepon", type: "text" },
      { key: "city", label: "Kota", type: "text" },
    ],
    blank: { name: "", phone: "", city: "" },
    rowTitle: (item) => item.name,
    rowSub: (item, data) => `${item.city || "-"} · ${data.products.filter((product) => product.supplierId === item.id).length} produk`,
  },
  {
    kind: "crud", slug: "pelanggan", title: "Pelanggan", subtitle: "Master pelanggan · dasar segmentasi otomatis", icon: "account-group-outline",
    collection: "customers", idPrefix: "cst",
    fields: [
      { key: "id", label: "ID Pelanggan", type: "text", system: true, systemHint: "Dibuat otomatis saat disimpan (PLG-0001)" },
      { key: "name", label: "Nama", type: "text" },
      { key: "phone", label: "Telepon", type: "text" },
      { key: "province", label: "Provinsi", type: "province", cityKey: "city" },
      { key: "city", label: "Kota / Kabupaten", type: "city", provinceKey: "province" },
      { key: "joinedAt", label: "Tanggal Gabung", type: "date" },
      { key: "notes", label: "Catatan (opsional)", type: "text", optional: true },
    ],
    blank: { name: "", phone: "", province: "", city: "", joinedAt: new Date().toISOString().slice(0, 10), notes: "" },
    rowTitle: (item) => item.name,
    rowSub: (item, data) => `${item.city || "-"} · ${data.orders.filter((order) => order.customerId === item.id).length} order`,
  },
  {
    kind: "crud", slug: "channel", title: "Channel Penjualan", subtitle: "Kanal jualan · aktif/nonaktif", icon: "storefront-outline",
    collection: "channels", idPrefix: "ch",
    fields: [
      { key: "name", label: "Nama Channel", type: "text" },
      { key: "status", label: "Status", type: "select", options: [{ value: "Aktif", label: "Aktif" }, { value: "Tidak Aktif", label: "Tidak Aktif" }] },
    ],
    blank: { name: "", status: "Aktif" },
    rowTitle: (item) => item.name,
    rowSub: (item, data) => `${data.orders.filter((order) => order.channelId === item.id).length} order tercatat`,
    rowValue: (item) => (item.status && item.status !== "Aktif") ? "Tidak Aktif" : "Aktif",
  },
  {
    kind: "crud", slug: "pengeluaran", title: "Pengeluaran", subtitle: "Biaya operasional · memengaruhi laba & kas", icon: "receipt",
    collection: "expenses", idPrefix: "exp", sortDesc: true,
    fields: [
      { key: "date", label: "Tanggal", type: "date" },
      { key: "category", label: "Kategori", type: "select", options: [
        { value: "Kuota Internet", label: "Kuota Internet" },
        { value: "Kemasan & Label", label: "Kemasan & Label" },
        { value: "Iklan Sosmed", label: "Iklan Sosmed" },
        { value: "Gaji & Upah", label: "Gaji & Upah" },
        { value: "Sewa Tempat", label: "Sewa Tempat" },
        { value: "Listrik & Air", label: "Listrik & Air" },
        { value: "Transportasi", label: "Transportasi" },
        { value: "Lainnya", label: "Lainnya" },
      ] },
      { key: "note", label: "Catatan (opsional)", type: "text", optional: true },
      { key: "amount", label: "Jumlah", type: "number", money: true },
      { key: "accountId", label: "Akun Kas", type: "select", from: "accounts", searchable: true },
    ],
    blank: { date: new Date().toISOString().slice(0, 10), category: "", note: "", amount: "", accountId: "" },
    rowTitle: (item) => item.category || "Pengeluaran",
    rowSub: (item, data) => `${item.date} · ${nameOf(data, "accounts", item.accountId)}`,
    rowValue: (item) => formatRupiah(item.amount),
  },
  {
    kind: "crud", slug: "akun-kas", title: "Akun Kas / Rekening", subtitle: "Kas, bank & e-wallet · sumber Saldo Kas", icon: "wallet-outline",
    collection: "accounts", idPrefix: "acc",
    fields: [
      { key: "name", label: "Nama Akun", type: "text" },
      { key: "type", label: "Jenis", type: "select", options: [{ value: "Kas", label: "Kas" }, { value: "Bank", label: "Bank" }, { value: "E-Wallet", label: "E-Wallet" }] },
      { key: "openingBalance", label: "Saldo Awal", type: "number", money: true },
      { key: "status", label: "Status", type: "select", options: [{ value: "Aktif", label: "Aktif" }, { value: "Tidak Aktif", label: "Tidak Aktif" }] },
      { key: "notes", label: "Catatan (opsional)", type: "text", optional: true },
    ],
    blank: { name: "", type: "Kas", openingBalance: "", status: "Aktif", notes: "" },
    rowTitle: (item) => item.name,
    rowSub: (item) => `${item.type} · saldo awal ${formatRupiah(item.openingBalance)}${(item.status && item.status !== "Aktif") ? " · Tidak Aktif" : ""}`,
    rowValue: (item, data) => formatRupiah(accountBalances(data, latestMonthKey(data)).find((account) => account.id === item.id)?.balance ?? item.openingBalance),
  },
  {
    kind: "crud", slug: "target", title: "Target", subtitle: "Target omzet & margin per bulan", icon: "target",
    collection: "targets", idPrefix: "tgt", sortDesc: true,
    fields: [
      { key: "monthKey", label: "Bulan", type: "month" },
      { key: "omzetTarget", label: "Target Omzet", type: "number", money: true },
      { key: "marginTargetPct", label: "Target Margin (%)", type: "number" },
    ],
    blank: { monthKey: new Date().toISOString().slice(0, 7), omzetTarget: "", marginTargetPct: 20 },
    rowTitle: (item) => monthLabel(item.monthKey),
    rowSub: (item) => `Target margin ${item.marginTargetPct}%`,
    rowValue: (item) => formatRupiah(item.omzetTarget),
  },
  {
    kind: "crud", slug: "business-rules", title: "Business Rules", subtitle: "Aturan yang menggerakkan Alert & Action", icon: "shield-check-outline",
    collection: "rules", idPrefix: "rul", canAdd: false, canDelete: false,
    fields: [
      { key: "enabled", label: "Aktif", type: "toggle" },
      { key: "severity", label: "Prioritas", type: "select", options: [{ value: "Tinggi", label: "Tinggi" }, { value: "Sedang", label: "Sedang" }, { value: "Rendah", label: "Rendah" }] },
    ],
    blank: { enabled: true, severity: "Sedang" },
    rowTitle: (item) => item.label,
    rowSub: (item) => (item.enabled ? "Aktif · memicu Alert & Action" : "Nonaktif"),
    rowValue: (item) => item.severity,
  },
  {
    kind: "crud", slug: "biaya-channel", title: "Biaya Channel", subtitle: "Master biaya channel · default channel & override SKU untuk Profit Engine", icon: "sale",
    collection: "channelCosts", idPrefix: "cc", sortDesc: false,
    fields: [
      { key: "channelId", label: "Channel", type: "select", from: "channels" },
      { key: "sku", label: "Product / SKU", type: "select", from: "products", searchable: true, allowEmptyOption: { label: "Default (semua SKU)" } },
      { key: "component", label: "Komponen Biaya", type: "text" },
      { key: "type", label: "Tipe", type: "select", options: [{ value: "percent", label: "% dari nilai jual" }, { value: "rp", label: "Rp / item" }] },
      { key: "value", label: "Nilai", type: "number" },
      { key: "basis", label: "Basis Perhitungan (untuk %)", type: "select", options: [{ value: "after_discount", label: "Setelah diskon" }, { value: "before_discount", label: "Sebelum diskon" }] },
      { key: "effectiveDate", label: "Tanggal Berlaku", type: "date" },
      { key: "status", label: "Status", type: "select", options: [{ value: "Aktif", label: "Aktif" }, { value: "Tidak Aktif", label: "Tidak Aktif" }] },
    ],
    blank: { channelId: "", sku: "", component: "", type: "percent", value: "", basis: "after_discount", effectiveDate: new Date().toISOString().slice(0, 10), status: "Aktif" },
    rowTitle: (item, data) => `${item.component || "Biaya"} · ${nameOf(data, "channels", item.channelId)}`,
    rowSub: (item, data) => `${item.sku ? `Override SKU: ${nameOf(data, "products", item.sku)}` : "Default channel (semua SKU)"} · sejak ${item.effectiveDate}${(item.status && item.status !== "Aktif") ? " · Tidak Aktif" : ""}`,
    rowValue: (item) => item.type === "percent" ? `${item.value}%` : `${formatRupiah(item.value)}/item`,
  },
  { kind: "laba", slug: "laba", title: "Laba (Profit Engine)", subtitle: "Rincian laba per order & item · sumber tunggal", icon: "chart-areaspline" },
  { kind: "laba-penjualan", slug: "laba-penjualan", title: "Laba Penjualan", subtitle: "Laba produk seluruh channel · terpisah dari Laba Bersih Bisnis", icon: "chart-box-outline" },
  { kind: "keuangan", slug: "keuangan", title: "Keuangan", subtitle: "Ringkasan kas, laba & saldo per akun · ketuk angka untuk telusuri", icon: "finance" },
  { kind: "numbers", slug: "parameter", title: "Parameter Bisnis", subtitle: "Dasar segmentasi pelanggan & perputaran stok", icon: "tune-variant", target: "params" },
  { kind: "numbers", slug: "threshold", title: "Threshold", subtitle: "Batas angka untuk setiap business rule", icon: "speedometer", target: "thresholds" },
  { kind: "laporan-penjualan", slug: "laporan-penjualan", title: "Laporan Penjualan", subtitle: "Per bulan & per channel dari data order", icon: "chart-line" },
  { kind: "laporan-keuangan", slug: "laporan-keuangan", title: "Laporan Keuangan", subtitle: "Pendapatan, biaya, laba & arus kas", icon: "cash-multiple" },
  { kind: "laporan-stok", slug: "laporan-stok", title: "Laporan Stok", subtitle: "Stok, nilai & status per produk", icon: "archive-outline" },
  { kind: "import", slug: "import-data", title: "Impor Data", subtitle: "Pilih jenis data, unggah file, pratinjau & validasi", icon: "database-import-outline" },
  { kind: "export", slug: "export-data", title: "Ekspor Data", subtitle: "Pilih jenis data & periode, ekspor ke PDF, Excel atau CSV", icon: "database-export-outline" },
  { kind: "quality", slug: "data-quality", title: "Data Quality", subtitle: "Deteksi otomatis masalah & warning data", icon: "check-decagram-outline" },
  { kind: "backup", slug: "backup", title: "Backup & Restore", subtitle: "Buat backup & pulihkan data", icon: "cloud-sync-outline" },
  { kind: "pengaturan", slug: "pengaturan", title: "Pengaturan", subtitle: "Identitas toko & mata uang", icon: "cog-outline" },
  { kind: "tema", slug: "tema", title: "Pengaturan Tema", subtitle: "Tampilan terang, gelap, atau ikuti sistem", icon: "theme-light-dark" },
  { kind: "notifikasi", slug: "notifikasi", title: "Notifikasi", subtitle: "Pilihan pengingat alert & ringkasan", icon: "bell-outline" },
  { kind: "audit", slug: "audit-log", title: "Audit Log", subtitle: "Riwayat perubahan data", icon: "history" },
  { kind: "reset", slug: "reset-data", title: "Reset Data", subtitle: "Hapus semua data operasional untuk testing", icon: "delete-sweep-outline" },
];

export const moduleBySlug = (slug: string) => modules.find((item) => item.slug === slug);

export const numberFieldsFor = (target: "params" | "thresholds"): { key: string; label: string; hint: string; money?: boolean }[] => target === "params" ? [
  { key: "loyalMinOrders", label: "Minimum transaksi Pelanggan Loyal", hint: "Dalam 90 hari (≥3)" },
  { key: "repeatMinOrders", label: "Minimum transaksi Pelanggan Berulang", hint: "Dalam 90 hari (2)" },
  { key: "newCustomerDays", label: "Masa Pelanggan Baru (hari)", hint: "Transaksi pertama ≤ N hari" },
  { key: "passiveDays", label: "Pelanggan Pasif mulai (hari)", hint: "Tanpa transaksi 31–90 hari" },
  { key: "turnoverWindowDays", label: "Jendela perputaran (hari)", hint: "Fast Moving = 30 hari" },
  { key: "fastMovingMinQty", label: "Minimum qty Fast Moving", hint: "Dalam jendela perputaran (12)" },
] : [
  { key: "stokMenipisFactor", label: "Faktor Stok Menipis", hint: "Stok ≤ ROP × faktor" },
  { key: "deadStockDays", label: "Dead Stock setelah (hari)", hint: "Tidak terjual" },
  { key: "marginLowPct", label: "Margin Rendah di bawah (%)", hint: "Terpisah dari Target Margin" },
  { key: "returnHighPct", label: "Retur Tinggi di atas (%)", hint: "Nilai retur / omzet" },
  { key: "salesBelowTargetPct", label: "Batas Penjualan vs Target (%)", hint: "Omzet < target × batas" },
  { key: "inactiveCustomerDays", label: "Pelanggan Tidak Aktif setelah (hari)", hint: "Transaksi terakhir > N hari" },
  { key: "channelCostHighPct", label: "Biaya Channel Tinggi di atas (%)", hint: "Biaya channel / omzet" },
  { key: "stokHabisMinCount", label: "Minimum SKU habis untuk alert", hint: "Jumlah produk" },
  { key: "lowCashBalance", label: "Saldo Kas Rendah di bawah (Rp)", hint: "Memicu alert Saldo Kas Rendah", money: true },
];
