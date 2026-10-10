import { BosData, RuleKey } from "@/src/data/types";
import { cashBalance, customerStatus, monthMetrics, productStatus, targetFor, latestMonthKey, accountBalances, stockOf } from "@/src/data/calc";
import { formatRupiah, monthLabel, toJt } from "@/src/data/time";

// Business Rules + Threshold -> Alert -> Action. Only the eight agreed rules exist here;
// each one reads its limit from data.thresholds and can be switched off in More.
export type Severity = "Tinggi" | "Sedang" | "Rendah";

export type Alert = {
  id: string;
  ruleKey: RuleKey;
  label: string;
  title: string;
  detail: string;
  severity: Severity;
  count: number;
  action: string;
  actionDetail: string;
  module: string;
};

export function evaluateAlerts(data: BosData, monthKey: string): Alert[] {
  const metrics = monthMetrics(data, monthKey);
  const products = productStatus(data, monthKey);
  const customers = customerStatus(data, monthKey);
  const limits = data.thresholds;
  const target = targetFor(data, monthKey);

  const outOfStock = products.filter((item) => item.availability === "Habis");
  const lowStock = products.filter((item) => item.availability === "Hampir Habis");
  const deadStock = products.filter((item) => item.turnover === "Dead Stock");
  const inactive = customers.filter((item) => item.segment === "Pelanggan Tidak Aktif");
  const costlyChannels = metrics.channels.filter((channel) => channel.omzet > 0 && channel.feePct > limits.channelCostHighPct);
  const cash = cashBalance(data, monthKey);
  const targetFloor = target ? (target.omzetTarget * limits.salesBelowTargetPct) / 100 : 0;

  const candidates: (Omit<Alert, "id" | "severity" | "label"> & { active: boolean })[] = [
    {
      ruleKey: "stok_habis", active: outOfStock.length >= limits.stokHabisMinCount, count: outOfStock.length,
      title: `${outOfStock.length} produk stok habis`,
      detail: outOfStock.slice(0, 2).map((item) => item.product.name).join(", ") || "Tidak ada produk habis",
      action: `Restock ${outOfStock.length} produk habis`, actionDetail: "Buat pembelian ke supplier terkait", module: "/more/pembelian",
    },
    {
      ruleKey: "stok_menipis", active: lowStock.length > 0, count: lowStock.length,
      title: `${lowStock.length} produk mendekati ROP`,
      detail: lowStock.slice(0, 2).map((item) => `${item.product.name} (sisa ${item.stock})`).join(", "),
      action: `Siapkan restock ${lowStock.length} produk menipis`, actionDetail: "Cek ROP dan jadwalkan pembelian", module: "/more/inventori",
    },
    {
      ruleKey: "dead_stock", active: deadStock.length > 0, count: deadStock.length,
      title: `${deadStock.length} produk dead stock`,
      detail: `Tidak terjual ${limits.deadStockDays} hari atau lebih`,
      action: `Evaluasi ${deadStock.length} produk dead stock`, actionDetail: "Diskon, bundling, atau hentikan pembelian", module: "/more/produk",
    },
    {
      ruleKey: "margin_rendah", active: metrics.omzet > 0 && metrics.marginPct < limits.marginLowPct, count: 1,
      title: `Margin ${Math.round(metrics.marginPct)}% di bawah ${limits.marginLowPct}%`,
      detail: `Laba bersih ${toJt(metrics.netProfit)} Jt dari omzet ${toJt(metrics.omzet)} Jt`,
      action: "Perbaiki margin bulan ini", actionDetail: "Tinjau harga jual, biaya, dan diskon", module: "/more/pengeluaran",
    },
    {
      ruleKey: "retur_tinggi", active: metrics.returnPct > limits.returnHighPct, count: 1,
      title: `Retur ${metrics.returnPct.toFixed(1)}% di atas ${limits.returnHighPct}%`,
      detail: `Nilai retur ${toJt(metrics.returnsValue)} Jt pada ${monthLabel(monthKey)}`,
      action: "Telusuri penyebab retur", actionDetail: "Periksa kualitas produk dan pengiriman", module: "/more/order",
    },
    {
      ruleKey: "penjualan_bawah_target", active: !!target && metrics.omzet < targetFloor, count: 1,
      title: `Omzet ${toJt(metrics.omzet)} Jt di bawah target`,
      detail: `Target ${toJt(target?.omzetTarget ?? 0)} Jt · minimum ${limits.salesBelowTargetPct}%`,
      action: "Kejar sisa target bulan ini", actionDetail: "Fokus channel dan produk terlaris", module: "/more/target",
    },
    {
      ruleKey: "pelanggan_tidak_aktif", active: inactive.length > 0, count: inactive.length,
      title: `${inactive.length} pelanggan tidak aktif`,
      detail: `Tidak bertransaksi ${limits.inactiveCustomerDays} hari atau lebih`,
      action: `Follow up ${inactive.length} pelanggan tidak aktif`, actionDetail: "Hubungi via WhatsApp dengan penawaran", module: "/more/pelanggan",
    },
    {
      ruleKey: "biaya_channel_tinggi", active: costlyChannels.length > 0, count: costlyChannels.length,
      title: `Biaya channel di atas ${limits.channelCostHighPct}%`,
      detail: costlyChannels.map((channel) => `${channel.name} ${channel.feePct}%`).join(", "),
      action: "Tinjau biaya channel penjualan", actionDetail: "Bandingkan margin per channel", module: "/more/channel",
    },
    {
      ruleKey: "saldo_kas_rendah", active: cash < limits.lowCashBalance, count: 1,
      title: `Saldo kas ${formatRupiah(cash)} di bawah batas`,
      detail: `Batas Saldo Kas Rendah ${formatRupiah(limits.lowCashBalance)}`,
      action: "Jaga arus kas", actionDetail: "Tunda pembelian besar & tagih piutang", module: "/more/akun-kas",
    },
    {
      ruleKey: "laba_bersih_negatif", active: metrics.netProfit < 0, count: 1,
      title: `Laba bersih negatif ${formatRupiah(metrics.netProfit)}`,
      detail: `Biaya melebihi pendapatan pada ${monthLabel(monthKey)}`,
      action: "Perbaiki laba bulan ini", actionDetail: "Tinjau harga, biaya & pengeluaran", module: "/more/pengeluaran",
    },
  ];

  return candidates.flatMap((candidate) => {
    const rule = data.rules.find((item) => item.key === candidate.ruleKey);
    if (!rule || !rule.enabled || !candidate.active) return [];
    const { active, ...rest } = candidate; void active;
    return [{ ...rest, id: `${monthKey}-${candidate.ruleKey}`, label: rule.label, severity: rule.severity }];
  });
}

export const severityRank: Record<Severity, number> = { Tinggi: 0, Sedang: 1, Rendah: 2 };

export function deriveActions(data: BosData, monthKey: string) {
  return evaluateAlerts(data, monthKey)
    .sort((left, right) => severityRank[left.severity] - severityRank[right.severity])
    .map((alert) => ({ id: alert.id, title: alert.action, detail: alert.actionDetail, level: alert.severity, ruleLabel: alert.label, module: alert.module, status: data.actionStatus[alert.id] ?? "open" }));
}

// Data Quality: gaps in the source data that would distort the KPI calculations.
export function dataQualityIssues(data: BosData) {
  const issues: { id: string; severity: Severity; title: string; detail: string; module: string }[] = [];
  const push = (id: string, severity: Severity, title: string, detail: string, module: string) => issues.push({ id, severity, title, detail, module });

  const noCost = data.products.filter((product) => product.cost <= 0);
  if (noCost.length) push("prd-cost", "Tinggi", `${noCost.length} produk tanpa harga beli`, "Laba dan margin tidak dapat dihitung akurat", "/more/produk");
  const noRop = data.products.filter((product) => product.rop <= 0);
  if (noRop.length) push("prd-rop", "Sedang", `${noRop.length} produk tanpa ROP`, "Alert stok menipis tidak akan aktif", "/more/produk");
  const noSupplier = data.products.filter((product) => !product.supplierId && (!product.altSupplierIds || product.altSupplierIds.length === 0));
  if (noSupplier.length) push("prd-sup", "Rendah", `${noSupplier.length} produk tanpa supplier`, "Restock sulit ditelusuri", "/more/supplier");
  const orderNoCustomer = data.orders.filter((order) => !order.customerId);
  if (orderNoCustomer.length) push("ord-cst", "Sedang", `${orderNoCustomer.length} order tanpa pelanggan`, "Segmentasi pelanggan jadi tidak lengkap", "/more/order");
  const orderNoChannel = data.orders.filter((order) => !order.channelId);
  if (orderNoChannel.length) push("ord-ch", "Sedang", `${orderNoChannel.length} order tanpa channel`, "Omzet per channel tidak lengkap", "/more/order");
  const orderNoAccount = data.orders.filter((order) => !order.accountId);
  if (orderNoAccount.length) push("ord-acc", "Tinggi", `${orderNoAccount.length} order tanpa akun kas`, "Saldo kas tidak sinkron dengan penjualan", "/more/akun-kas");
  const emptyOrders = data.orders.filter((order) => order.items.length === 0);
  if (emptyOrders.length) push("ord-item", "Tinggi", `${emptyOrders.length} order tanpa item`, "Omzet dan qty terjual berkurang", "/more/order");
  const expenseNoAccount = data.expenses.filter((expense) => !expense.accountId);
  if (expenseNoAccount.length) push("exp-acc", "Sedang", `${expenseNoAccount.length} pengeluaran tanpa akun kas`, "Kas keluar tidak terhubung ke rekening", "/more/akun-kas");
  const monthsWithoutTarget = [...new Set(data.orders.map((order) => order.date.slice(0, 7)))].filter((key) => !data.targets.some((target) => target.monthKey === key));
  if (monthsWithoutTarget.length) push("tgt", "Sedang", `${monthsWithoutTarget.length} bulan tanpa target`, "Pencapaian target tidak dapat dinilai", "/more/target");
  if (!data.accounts.length) push("acc", "Tinggi", "Belum ada akun kas", "Saldo kas tidak dapat dihitung", "/more/akun-kas");

  const monthKey = latestMonthKey(data);
  // Data wajib kosong
  const noName = data.products.filter((product) => !product.name || !product.sku);
  if (noName.length) push("prd-name", "Tinggi", `${noName.length} produk tanpa nama/SKU`, "Data master produk tidak lengkap", "/more/produk");
  // Duplikasi
  const skuSeen = new Map<string, number>();
  data.products.forEach((product) => { const key = (product.sku || "").trim().toLowerCase(); if (key) skuSeen.set(key, (skuSeen.get(key) ?? 0) + 1); });
  const dupSku = [...skuSeen.values()].filter((count) => count > 1).length;
  if (dupSku) push("prd-dup", "Sedang", `${dupSku} SKU duplikat`, "SKU seharusnya unik antar produk", "/more/produk");
  const phoneSeen = new Map<string, number>();
  data.customers.forEach((customer) => { const key = (customer.phone || "").replace(/\D/g, ""); if (key) phoneSeen.set(key, (phoneSeen.get(key) ?? 0) + 1); });
  const dupPhone = [...phoneSeen.values()].filter((count) => count > 1).length;
  if (dupPhone) push("cst-dup", "Rendah", `${dupPhone} nomor pelanggan duplikat`, "Kemungkinan pelanggan tercatat ganda", "/more/pelanggan");
  // Stok tidak konsisten (negatif)
  const negativeStock = data.products.filter((product) => stockOf(data, product, monthKey) < 0);
  if (negativeStock.length) push("stk-neg", "Tinggi", `${negativeStock.length} produk stok negatif`, "Penjualan melebihi stok tercatat", "/more/inventori");
  // Biaya channel belum lengkap (channel dipakai order tapi tanpa konfigurasi biaya)
  const channelsUsed = [...new Set(data.orders.filter((order) => order.channelId).map((order) => order.channelId))];
  const channelNoCost = channelsUsed.filter((channelId) => !(data.channelCosts ?? []).some((cost) => cost.channelId === channelId && (cost.status ?? "Aktif") !== "Tidak Aktif"));
  if (channelNoCost.length) push("ch-cost", "Sedang", `${channelNoCost.length} channel tanpa biaya channel`, "Laba per channel jadi estimasi", "/more/biaya-channel");
  // Kas tidak reconcile (saldo akun negatif)
  const negativeAccounts = accountBalances(data, monthKey).filter((account) => account.balance < 0);
  if (negativeAccounts.length) push("acc-neg", "Tinggi", `${negativeAccounts.length} akun kas saldo negatif`, "Kas keluar melebihi kas masuk + saldo awal", "/more/akun-kas");
  // Profit tidak lengkap (order estimasi karena konfigurasi biaya belum lengkap)
  const estimatedOrders = data.orders.filter((order) => order.status === "Selesai" && order.items.some((item) => item.costSnapshot ? item.costSnapshot.estimated : true));
  if (estimatedOrders.length) push("pe-est", "Rendah", `${estimatedOrders.length} order laba estimasi`, "Konfigurasi biaya channel belum lengkap saat transaksi", "/more/laba");

  return issues;
}
