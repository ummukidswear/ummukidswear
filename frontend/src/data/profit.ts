import { BosData, ChannelCost, CostBasis, Order, OrderItem, PackagingConfig } from "@/src/data/types";
import { monthKeyOf } from "@/src/data/time";

// Profit Engine — the SINGLE source of truth for Net Profit & Margin. Home, Analytics,
// Reports and rules all consume these results; no other module implements a profit formula.
// Precision is kept internally; callers round only the final displayed Rupiah.

export const TAX_RATE = 0.005; // Fallback legacy HANYA untuk snapshot order lama tanpa field tax. PPh kini master Biaya Channel.

export const isTaxComponent = (name: string) => /^(pph|pajak)/i.test((name || "").trim());
export const isPackagingComponent = (name: string) => (name || "").trim().toLowerCase() === "packaging";

const productOf = (data: BosData, id: string) => data.products.find((product) => product.id === id);
const clampReturn = (item: OrderItem) => Math.max(0, Math.min(item.qty, item.returnedQty ?? 0));

// HPP — Moving Weighted Average. Karena penjualan pada harga rata-rata tidak mengubah
// rata-rata, nilai rata-rata hanya bergantung pada Stok Awal (Qty × HPP Awal/unit =
// openingStock × cost) plus pembelian dengan tanggal <= tanggal transaksi. Perubahan data
// masa depan tidak pernah mengubah HPP historis.
export function movingAvgHpp(data: BosData, productId: string, date: string): number {
  const product = productOf(data, productId);
  if (!product) return 0;
  let qty = product.openingStock || 0;
  let value = (product.openingStock || 0) * (product.cost || 0);
  data.purchases
    .filter((purchase) => purchase.date <= date)
    .sort((left, right) => left.date.localeCompare(right.date))
    .forEach((purchase) => {
      purchase.items.filter((item) => item.productId === productId).forEach((item) => { qty += item.qty; value += item.qty * item.cost; });
    });
  if (qty <= 0) return product.cost || 0;
  return value / qty;
}

// Harga jual per Produk × Channel; null bila belum dikonfigurasi (master produk hanya referensi).
export function channelPriceOf(data: BosData, productId: string, channelId: string): number | null {
  const entry = (data.channelPrices ?? []).find((price) => price.productId === productId && price.channelId === channelId);
  return entry ? entry.price : null;
}

export type ResolvedCost = { component: string; type: "percent" | "rp"; value: number; basis: CostBasis };
type FlatCost = { type: "percent" | "rp"; value: number } | null;

// Resolusi Biaya Channel: override SKU mengalahkan default; untuk komponen yang sama, ambil
// effectiveDate terbaru yang <= tanggal transaksi. Biaya Channel = Single Source of Truth
// seluruh biaya penjualan: komponen "Packaging" dan "PPh/Pajak" dipisah ke baris sendiri
// (tidak dihitung ulang di modul lain, tidak double counting). Tidak menyalin biaya dari
// channel lain; komponen yang tidak dikonfigurasi = Rp0.
export function resolveChannelCosts(data: BosData, productId: string, channelId: string, date: string): { components: ResolvedCost[]; packaging: FlatCost; tax: FlatCost; hasConfig: boolean } {
  const all = (data.channelCosts ?? []).filter((cost) => cost.channelId === channelId && (cost.status ?? "Aktif") !== "Tidak Aktif" && cost.effectiveDate <= date);
  const hasConfig = all.length > 0;
  const componentNames = [...new Set(all.map((cost) => cost.component))];
  const pick = (component: string): ChannelCost | undefined => {
    const matches = all.filter((cost) => cost.component === component);
    const sku = matches.filter((cost) => cost.sku === productId).sort((left, right) => right.effectiveDate.localeCompare(left.effectiveDate))[0];
    const def = matches.filter((cost) => cost.sku === "").sort((left, right) => right.effectiveDate.localeCompare(left.effectiveDate))[0];
    return sku ?? def;
  };
  const components: ResolvedCost[] = [];
  let packaging: FlatCost = null;
  let tax: FlatCost = null;
  componentNames.forEach((component) => {
    const chosen = pick(component);
    if (!chosen) return;
    if (isPackagingComponent(chosen.component)) { packaging = { type: chosen.type, value: chosen.value }; return; }
    if (isTaxComponent(chosen.component)) { tax = { type: chosen.type, value: chosen.value }; return; }
    components.push({ component: chosen.component, type: chosen.type, value: chosen.value, basis: chosen.basis ?? "after_discount" });
  });
  return { components, packaging, tax, hasConfig };
}

// Packaging PER PAKET berdasarkan Jenis Pengiriman — Single Source of Truth di Biaya Channel.
// Konfigurasi diambil dari komponen "Packaging" (scope global channel sku="" diprioritaskan),
// effectiveDate terbaru <= tanggal transaksi. Row lama tanpa konfigurasi diperlakukan flat.
export function resolvePackagingConfig(data: BosData, channelId: string, date: string): PackagingConfig | null {
  const rows = (data.channelCosts ?? []).filter((cost) => cost.channelId === channelId && (cost.status ?? "Aktif") !== "Tidak Aktif" && cost.effectiveDate <= date && isPackagingComponent(cost.component));
  if (rows.length === 0) return null;
  const globals = rows.filter((cost) => cost.sku === "");
  const chosen = (globals.length ? globals : rows).sort((left, right) => right.effectiveDate.localeCompare(left.effectiveDate))[0];
  if (chosen.packaging) return chosen.packaging;
  return { model: "flat", shippingTypes: [], flatValue: chosen.value };
}

// Biaya packaging per paket untuk jenis pengiriman terpilih (fallback jenis pertama).
export function packagingUnitFor(config: PackagingConfig | null, shippingTypeId: string, shippingTypeName?: string): number {
  if (!config) return 0;
  if (config.model === "flat") return config.flatValue ?? 0;
  const match = config.shippingTypes.find((type) => type.id === shippingTypeId) ?? (shippingTypeName ? config.shippingTypes.find((type) => type.name === shippingTypeName) : undefined);
  return match ? match.value : (config.shippingTypes[0]?.value ?? 0);
}

// Biaya packaging per unit paket: dikunci di order (snapshot) atau diresolusi dari master.
export function orderPackagingUnit(data: BosData, order: Order): number {
  if (order.packagingSnapshot) return order.packagingSnapshot.unit;
  return packagingUnitFor(resolvePackagingConfig(data, order.channelId, order.date), order.shippingTypeId ?? "", order.shippingTypeName);
}

// Total packaging satu order = biaya/paket × Jumlah Paket. TIDAK bergantung jumlah item/SKU:
// 1 order 1 paket = 1×, 1 order 2 paket = 2×.
export function orderPackagingTotal(data: BosData, order: Order): number {
  return orderPackagingUnit(data, order) * Math.max(1, Math.floor(order.packageCount ?? 1));
}

const orderUsesNewPackaging = (order: Order) => order.packageCount !== undefined && order.packageCount !== null;

export type ItemProfit = {
  productId: string; qtySold: number; qtyReturned: number; effQty: number;
  actualPriceUnit: number; sellerDiscountUnit: number; basePriceUnit: number; actualSellingValue: number;
  channelCosts: { component: string; amount: number }[]; channelCostTotal: number; netProceeds: number;
  packaging: number; tax: number; hppUnit: number; hpp: number; netProfit: number; estimated: boolean;
};

// Laba per Order Item. Memakai snapshot bila tersedia (dikunci saat transaksi); jika tidak,
// menghitung estimasi dari master saat ini (ditandai estimated). Biaya % memakai basis yang
// dikonfigurasi (sebelum/sesudah diskon) — Profit Engine tidak menebak.
export function itemProfit(data: BosData, order: Order, item: OrderItem, packagingOverride: number | null = null): ItemProfit {
  const qtySold = item.qty;
  const qtyReturned = clampReturn(item);
  const effQty = qtySold - qtyReturned;
  const snap = item.costSnapshot;
  const sellerDiscountUnit = snap ? snap.sellerDiscountUnit : (item.sellerDiscount ?? 0);
  const actualPriceUnit = snap ? snap.actualPriceUnit : ((channelPriceOf(data, item.productId, order.channelId) ?? item.price) - sellerDiscountUnit);
  const basePriceUnit = actualPriceUnit + sellerDiscountUnit;
  const actualSellingValue = actualPriceUnit * effQty;
  const resolved = snap
    ? { components: snap.channelCosts, packaging: snap.packaging, tax: snap.tax === undefined ? ({ type: "percent", value: TAX_RATE * 100 } as FlatCost) : snap.tax, hasConfig: snap.hasConfig }
    : resolveChannelCosts(data, item.productId, order.channelId, order.date);
  const channelCosts = resolved.components.map((cost) => {
    const basisValue = cost.basis === "before_discount" ? basePriceUnit * effQty : actualSellingValue;
    const amount = cost.type === "percent" ? (basisValue * cost.value) / 100 : cost.value * effQty;
    return { component: cost.component, amount };
  });
  const channelCostTotal = channelCosts.reduce((sum, cost) => sum + cost.amount, 0);
  const netProceeds = actualSellingValue - channelCostTotal;
  // Packaging kini PER PAKET (order-level). Order model baru mengirim porsi biaya paket lewat
  // packagingOverride; order/snapshot lama (tanpa Jumlah Paket) tetap memakai perhitungan
  // legacy dari master agar laba historis tidak berubah.
  const legacyPackaging = resolved.packaging ? (resolved.packaging.type === "percent" ? (actualSellingValue * resolved.packaging.value) / 100 : resolved.packaging.value * qtySold) : 0;
  const packaging = packagingOverride !== null ? packagingOverride : legacyPackaging;
  // PPh/pajak dari Biaya Channel (single source); mengikuti nilai jual aktual pasca-retur.
  const tax = resolved.tax ? (resolved.tax.type === "percent" ? (actualSellingValue * resolved.tax.value) / 100 : resolved.tax.value * effQty) : 0;
  const hppUnit = snap ? snap.hppUnit : movingAvgHpp(data, item.productId, order.date);
  const hpp = hppUnit * effQty;
  const netProfit = netProceeds - packaging - tax - hpp;
  const estimated = snap ? !!snap.estimated : true;
  return { productId: item.productId, qtySold, qtyReturned, effQty, actualPriceUnit, sellerDiscountUnit, basePriceUnit, actualSellingValue, channelCosts, channelCostTotal, netProceeds, packaging, tax, hppUnit, hpp, netProfit, estimated };
}

// Laba per Order = jumlah item. Hanya order "Selesai" masuk Profit Engine; "Batal" = 0.
export function orderProfit(data: BosData, order: Order) {
  if (order.status !== "Selesai") return { items: [] as ItemProfit[], omzet: 0, channelCostTotal: 0, packaging: 0, tax: 0, hpp: 0, netProfit: 0, qty: 0, returnsValue: 0, estimated: false };
  // Model baru: packaging per paket (order-level) dialokasikan ke item sesuai porsi qty agar
  // rincian per produk konsisten dan totalnya = biaya/paket × Jumlah Paket.
  let overrides: (number | null)[] = order.items.map(() => null);
  if (orderUsesNewPackaging(order)) {
    const total = orderPackagingTotal(data, order);
    const weights = order.items.map((item) => Math.max(0, item.qty));
    const weightSum = weights.reduce((sum, weight) => sum + weight, 0);
    overrides = order.items.map((_, index) => (weightSum > 0 ? (total * weights[index]) / weightSum : total / (order.items.length || 1)));
  }
  const items = order.items.map((item, index) => itemProfit(data, order, item, overrides[index]));
  const sum = (pick: (item: ItemProfit) => number) => items.reduce((total, item) => total + pick(item), 0);
  return {
    items,
    omzet: sum((item) => item.actualSellingValue),
    channelCostTotal: sum((item) => item.channelCostTotal),
    packaging: sum((item) => item.packaging),
    tax: sum((item) => item.tax),
    hpp: sum((item) => item.hpp),
    netProfit: sum((item) => item.netProfit),
    qty: sum((item) => item.effQty),
    returnsValue: sum((item) => item.actualPriceUnit * item.qtyReturned),
    estimated: items.some((item) => item.estimated),
  };
}

export function profitForMonth(data: BosData, monthKey: string) {
  const orders = data.orders.filter((order) => order.status === "Selesai" && monthKeyOf(order.date) === monthKey);
  const perOrder = orders.map((order) => ({ order, ...orderProfit(data, order) }));
  const sum = (pick: (entry: (typeof perOrder)[number]) => number) => perOrder.reduce((total, entry) => total + pick(entry), 0);
  const expenses = data.expenses.filter((expense) => monthKeyOf(expense.date) === monthKey).reduce((total, expense) => total + expense.amount, 0);
  const netProfitTransactions = sum((entry) => entry.netProfit);
  const channels = data.channels.map((channel) => {
    const entries = perOrder.filter((entry) => entry.order.channelId === channel.id);
    const omzet = entries.reduce((total, entry) => total + entry.omzet, 0);
    const channelCost = entries.reduce((total, entry) => total + entry.channelCostTotal, 0);
    // feePct kini = biaya channel aktual / omzet (dari Profit Engine), bukan angka master lama.
    return { id: channel.id, name: channel.name, feePct: omzet > 0 ? (channelCost / omzet) * 100 : 0, channelCost, omzet };
  });
  return {
    monthKey,
    omzet: sum((entry) => entry.omzet),
    channelCostTotal: sum((entry) => entry.channelCostTotal),
    packaging: sum((entry) => entry.packaging),
    tax: sum((entry) => entry.tax),
    hpp: sum((entry) => entry.hpp),
    qty: sum((entry) => entry.qty),
    returnsValue: sum((entry) => entry.returnsValue),
    orders: orders.length,
    netProfitTransactions,
    expenses,
    netProfitBusiness: netProfitTransactions - expenses,
    channels,
    perOrder,
  };
}

// Laba Penjualan (fokus produk, seluruh channel) — turunan langsung dari Profit Engine, tanpa
// rumus baru: Laba Penjualan = Pendapatan Neto − HPP − biaya channel − Packaging − PPh.
// Laba Bersih Bisnis = Laba Penjualan − Biaya Operasional (netProfitBusiness).
export function salesProfitBreakdown(data: BosData, monthKey: string) {
  const pe = profitForMonth(data, monthKey);
  const byProduct = new Map<string, { productId: string; qty: number; revenue: number; hpp: number; costs: number; profit: number }>();
  pe.perOrder.forEach((entry) => entry.items.forEach((item) => {
    const row = byProduct.get(item.productId) ?? { productId: item.productId, qty: 0, revenue: 0, hpp: 0, costs: 0, profit: 0 };
    row.qty += item.effQty; row.revenue += item.actualSellingValue; row.hpp += item.hpp;
    row.costs += item.channelCostTotal + item.packaging + item.tax; row.profit += item.netProfit;
    byProduct.set(item.productId, row);
  }));
  const products = [...byProduct.values()].map((row) => ({ ...row, product: data.products.find((product) => product.id === row.productId), marginPct: row.revenue > 0 ? (row.profit / row.revenue) * 100 : 0 })).sort((left, right) => right.revenue - left.revenue);
  const channels = data.channels.map((channel) => {
    const entries = pe.perOrder.filter((entry) => entry.order.channelId === channel.id);
    const sum = (pick: (entry: (typeof entries)[number]) => number) => entries.reduce((total, entry) => total + pick(entry), 0);
    const revenue = sum((entry) => entry.omzet);
    const profit = sum((entry) => entry.netProfit);
    return { id: channel.id, name: channel.name, orders: entries.length, revenue, hpp: sum((entry) => entry.hpp), channelCost: sum((entry) => entry.channelCostTotal), packaging: sum((entry) => entry.packaging), tax: sum((entry) => entry.tax), profit, marginPct: revenue > 0 ? (profit / revenue) * 100 : 0 };
  }).filter((channel) => channel.orders > 0);
  return { ...pe, salesProfit: pe.netProfitTransactions, salesMarginPct: pe.omzet > 0 ? (pe.netProfitTransactions / pe.omzet) * 100 : 0, channels, products };
}

// Rekomendasi Harga per Produk × Channel dari Target Gross Margin (bukan markup). Tidak
// mengubah harga aktual maupun transaksi historis. null bila target tak tercapai.
export function recommendedPrice(data: BosData, productId: string, channelId: string, targetPct: number, date: string): number | null {
  const hpp = movingAvgHpp(data, productId, date);
  const resolved = resolveChannelCosts(data, productId, channelId, date);
  let percentTotal = 0;
  let fixedPerUnit = 0;
  resolved.components.forEach((cost) => { if (cost.type === "percent") percentTotal += cost.value / 100; else fixedPerUnit += cost.value; });
  if (resolved.packaging) { if (resolved.packaging.type === "percent") percentTotal += resolved.packaging.value / 100; else fixedPerUnit += resolved.packaging.value; }
  if (resolved.tax) { if (resolved.tax.type === "percent") percentTotal += resolved.tax.value / 100; else fixedPerUnit += resolved.tax.value; }
  const margin = (targetPct || 0) / 100;
  const denom = 1 - percentTotal - margin;
  if (denom <= 0) return null;
  return (hpp + fixedPerUnit) / denom;
}
