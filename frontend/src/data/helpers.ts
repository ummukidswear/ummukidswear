import { BosData, Supplier } from "@/src/data/types";

// Kode Order dibuat otomatis oleh sistem: format INV-YYYYMM-NNN, unik & konsisten
// dalam bulan transaksi. Tidak ada input manual.
export const nextOrderCode = (data: BosData, date: string) => {
  const source = date && /^\d{4}-\d{2}/.test(date) ? date : new Date().toISOString().slice(0, 10);
  const ym = source.slice(0, 7).replace("-", "");
  const prefix = `INV-${ym}-`;
  const seqs = data.orders
    .map((order) => order.code)
    .filter((code): code is string => typeof code === "string" && code.startsWith(prefix))
    .map((code) => Number(code.slice(prefix.length)))
    .filter((value) => Number.isFinite(value));
  const next = (seqs.length ? Math.max(...seqs) : 0) + 1;
  return `${prefix}${String(next).padStart(3, "0")}`;
};

// Normalisasi nomor lokal 08xxx menjadi 62xxx agar bisa dibuka di WhatsApp.
export const normalizeWa = (phone: string) => {
  let digits = (phone || "").replace(/[^0-9]/g, "");
  if (!digits) return "";
  if (digits.startsWith("620")) digits = `62${digits.slice(3)}`;
  else if (digits.startsWith("0")) digits = `62${digits.slice(1)}`;
  else if (digits.startsWith("8")) digits = `62${digits}`;
  return digits;
};

export const waLink = (phone: string) => `https://wa.me/${normalizeWa(phone)}`;

// Produk yang terhubung ke supplier lewat Supplier Utama ATAU Supplier Alternatif.
export const supplierProducts = (data: BosData, supplierId: string) =>
  data.products.filter((product) => product.supplierId === supplierId || (product.altSupplierIds ?? []).includes(supplierId));

export const supplierProductCount = (data: BosData, supplierId: string) => supplierProducts(data, supplierId).length;

export const supplierPurchases = (data: BosData, supplierId: string) =>
  data.purchases.filter((purchase) => purchase.supplierId === supplierId);

// Proteksi hapus: supplier yang masih dipakai Produk atau riwayat Pembelian tidak boleh dihapus langsung.
export const isSupplierReferenced = (data: BosData, supplierId: string) =>
  supplierProductCount(data, supplierId) > 0 || supplierPurchases(data, supplierId).length > 0;

// Picker transaksi baru hanya menawarkan supplier Aktif. Supplier Tidak Aktif tetap
// tampil bila sudah terpilih pada data lama (agar riwayat tidak rusak), diberi label.
export const selectableSuppliers = (data: BosData, currentIds: string[]) => {
  const isActive = (supplier: Supplier) => (supplier.status ?? "Aktif") === "Aktif";
  const active = data.suppliers.filter(isActive);
  const inactiveCurrent = data.suppliers.filter((supplier) => !isActive(supplier) && currentIds.includes(supplier.id));
  return [...active, ...inactiveCurrent].map((supplier) => ({ value: supplier.id, label: isActive(supplier) ? supplier.name : `${supplier.name} (Tidak Aktif)` }));
};

// Deteksi kemungkinan duplikat berdasarkan nama atau nomor telepon/WA. Tidak menggabungkan otomatis.
export const possibleDuplicateSupplier = (data: BosData, name: string, phone: string, excludeId: string) => {
  const normName = (name || "").trim().toLowerCase();
  const normPhone = (phone || "").replace(/[^0-9]/g, "");
  return data.suppliers.find((supplier) => supplier.id !== excludeId && ((!!normName && supplier.name.trim().toLowerCase() === normName) || (!!normPhone && supplier.phone.replace(/[^0-9]/g, "") === normPhone)));
};

// Deteksi kemungkinan pelanggan duplikat berdasarkan nomor Telepon. Hanya memberi peringatan,
// tidak pernah menggabungkan data otomatis (Master Pelanggan tetap Single Source of Truth).
export const possibleDuplicateCustomer = (data: BosData, phone: string, excludeId: string) => {
  const normPhone = (phone || "").replace(/[^0-9]/g, "");
  if (!normPhone) return undefined;
  return data.customers.find((customer) => customer.id !== excludeId && (customer.phone || "").replace(/[^0-9]/g, "") === normPhone);
};

// SKU Produk dibuat otomatis oleh sistem: format SKU-0001, unik & permanen, tidak bisa diinput
// manual. Penomoran hanya menghitung SKU ber-format "SKU-####"; SKU lama non-format dibiarkan
// apa adanya (permanen) dan diabaikan dari penomoran agar tetap unik.
export const skuNumber = (sku: string) => { const match = /^SKU-(\d+)$/i.exec(String(sku ?? "").trim()); return match ? Number(match[1]) : 0; };
export const maxSkuNumber = (data: BosData) => data.products.reduce((max, product) => Math.max(max, skuNumber(product.sku)), 0);
export const formatSku = (value: number) => `SKU-${String(value).padStart(4, "0")}`;
export const nextProductSku = (data: BosData) => formatSku(maxSkuNumber(data) + 1);

// ID Pelanggan dibuat otomatis oleh sistem: format PLG-0001, unik & permanen, identifier utama
// seluruh relasi pelanggan. ID lama non-format (mis. seed "cst-1") dibiarkan apa adanya.
export const plgNumber = (id: string) => { const match = /^PLG-(\d+)$/i.exec(String(id ?? "").trim()); return match ? Number(match[1]) : 0; };
export const maxPlgNumber = (data: BosData) => data.customers.reduce((max, customer) => Math.max(max, plgNumber(customer.id)), 0);
export const formatPlg = (value: number) => `PLG-${String(value).padStart(4, "0")}`;
export const nextCustomerCode = (data: BosData) => formatPlg(maxPlgNumber(data) + 1);
