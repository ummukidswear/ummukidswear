import { BosData, Order, Product } from "@/src/data/types";
import { daysBetween, monthEndDate, monthKeyOf, monthLabel, previousMonthKey, shortMonthLabel, toJt, toRibu, trailingMonths } from "@/src/data/time";
import { orderProfit, profitForMonth } from "@/src/data/profit";

// Calculation layer. Everything Home / Analytics / Alert / Action shows is derived here
// from the source data written by the More modules. No dashboard value is stored.

const isSale = (order: Order) => order.status === "Selesai";
const itemReturn = (item: Order["items"][number]) => Math.max(0, Math.min(item.qty, item.returnedQty ?? 0));
// orderGross = nilai jual bersih (qty efektif × harga item), dipakai untuk metrik pelanggan
// & arus kas. Perhitungan LABA & HPP kini bersumber tunggal dari Profit Engine (profit.ts).
const orderGross = (order: Order) => order.items.reduce((sum, item) => sum + (item.qty - itemReturn(item)) * item.price, 0);

export const availableMonthKeys = (data: BosData) => {
  const keys = new Set<string>();
  data.orders.forEach((order) => keys.add(monthKeyOf(order.date)));
  data.purchases.forEach((purchase) => keys.add(monthKeyOf(purchase.date)));
  data.expenses.forEach((expense) => keys.add(monthKeyOf(expense.date)));
  if (keys.size === 0) keys.add(new Date().toISOString().slice(0, 7));
  return [...keys].sort();
};

export const latestMonthKey = (data: BosData) => availableMonthKeys(data).slice(-1)[0];

export const targetFor = (data: BosData, monthKey: string) => data.targets.find((target) => target.monthKey === monthKey);

// ---------------------------------------------------------------------------
// Monthly money metrics: Order + Pembelian + Pengeluaran + Akun Kas -> Keuangan
// ---------------------------------------------------------------------------
export function monthMetrics(data: BosData, monthKey: string) {
  const sales = data.orders.filter((order) => isSale(order) && monthKeyOf(order.date) === monthKey);
  // Single source of truth: LABA, HPP (rata-rata bergerak), biaya channel, packaging & pajak
  // semuanya dari Profit Engine. Home/Analytics/Reports/Rules memakai hasil yang sama.
  const pe = profitForMonth(data, monthKey);
  const expenses = data.expenses.filter((expense) => monthKeyOf(expense.date) === monthKey).reduce((sum, expense) => sum + expense.amount, 0);
  const purchases = data.purchases.filter((purchase) => monthKeyOf(purchase.date) === monthKey).reduce((sum, purchase) => sum + purchase.items.reduce((total, item) => total + item.qty * item.cost, 0), 0);
  // Biaya channel = SATU sumber (Profit Engine). Arus kas keluar memakai biaya channel aktual
  // agar rekonsiliasi Saldo Kas tetap utuh (channel.feePct master sudah dihapus).
  const cashChannelFee = pe.channelCostTotal;
  const omzet = pe.omzet;
  const returnsValue = pe.returnsValue;
  const qty = pe.qty;
  const cogs = pe.hpp;
  const channelFee = pe.channelCostTotal;
  const tax = pe.tax;
  const packaging = pe.packaging;
  const netProfit = pe.netProfitBusiness;
  const cashIn = omzet;
  const cashOut = purchases + expenses + cashChannelFee;
  const channels = pe.channels;
  return {
    monthKey, omzet, returnsValue, qty, orders: sales.length, cogs, channelFee, tax, packaging, expenses, purchases,
    grossProfit: omzet - cogs, netProfit, netProfitTransactions: pe.netProfitTransactions, cashIn, cashOut,
    aov: sales.length ? omzet / sales.length : 0,
    marginPct: omzet > 0 ? (netProfit / omzet) * 100 : 0,
    returnPct: omzet > 0 ? (returnsValue / (omzet + returnsValue)) * 100 : 0,
    channels,
  };
}

// Saldo Kas = jumlah saldo seluruh Akun Kas (satu sumber dengan detail akun & Keuangan):
// Saldo Awal akun + Kas Masuk (settlement order Selesai) − Kas Keluar (pembelian, pengeluaran,
// biaya channel) sampai akhir bulan terpilih. Saldo Awal TIDAK pernah dihitung sebagai Kas Masuk.
export function cashBalance(data: BosData, monthKey: string) {
  return accountBalances(data, monthKey).reduce((sum, account) => sum + account.balance, 0);
}

export function accountBalances(data: BosData, monthKey: string) {
  return data.accounts.map((account) => {
    const ownOrders = data.orders.filter((order) => isSale(order) && order.accountId === account.id && monthKeyOf(order.date) <= monthKey);
    // Kas masuk = nilai jual aktual dari Profit Engine (sumber yang sama dengan Pendapatan).
    const cashIn = ownOrders.reduce((sum, order) => sum + orderProfit(data, order).omzet, 0);
    // Channel cost is settled from the account that received the order payment, sourced from
    // the Profit Engine (single source), so per-account balances reconcile with cashBalance.
    const channelFeeOut = ownOrders.reduce((sum, order) => sum + orderProfit(data, order).channelCostTotal, 0);
    const purchaseOut = data.purchases.filter((purchase) => purchase.accountId === account.id && monthKeyOf(purchase.date) <= monthKey).reduce((sum, purchase) => sum + purchase.items.reduce((total, item) => total + item.qty * item.cost, 0), 0);
    const expenseOut = data.expenses.filter((expense) => expense.accountId === account.id && monthKeyOf(expense.date) <= monthKey).reduce((sum, expense) => sum + expense.amount, 0);
    return { ...account, cashIn, cashOut: purchaseOut + expenseOut + channelFeeOut, balance: account.openingBalance + cashIn - purchaseOut - expenseOut - channelFeeOut };
  });
}

// ---------------------------------------------------------------------------
// Inventori: Produk + Pembelian + Order + Penyesuaian -> stock, status, turnover
// ---------------------------------------------------------------------------
// Bulan aktivitas paling awal dari seluruh movement stok (pembelian, penyesuaian, order).
// openingStock = "stok sebelum transaksi pertama" → hanya berlaku sejak bulan ini, bukan
// retroaktif. Bulan sebelum ada data (mis. setelah Reset Data) = stok 0. Jika belum ada
// movement sama sekali, anchor = bulan data terakhir (default bulan berjalan).
export function firstStockMonth(data: BosData): string {
  let earliest: string | null = null;
  const consider = (date: string) => { const key = monthKeyOf(date); if (!earliest || key < earliest) earliest = key; };
  data.purchases.forEach((purchase) => consider(purchase.date));
  data.adjustments.forEach((adjustment) => consider(adjustment.date));
  data.orders.forEach((order) => consider(order.date));
  return earliest ?? latestMonthKey(data);
}

export function stockOf(data: BosData, product: Product, monthKey: string) {
  // Tidak ada stok sebelum bulan aktivitas pertama — openingStock tidak dihitung mundur.
  if (monthKey < firstStockMonth(data)) return 0;
  const untilMonth = (date: string) => monthKeyOf(date) <= monthKey;
  const purchased = data.purchases.filter((purchase) => untilMonth(purchase.date)).reduce((sum, purchase) => sum + purchase.items.filter((item) => item.productId === product.id).reduce((total, item) => total + item.qty, 0), 0);
  const adjusted = data.adjustments.filter((adjustment) => adjustment.productId === product.id && untilMonth(adjustment.date)).reduce((sum, adjustment) => sum + (adjustment.type ? (adjustment.type === "reduce" ? -Math.abs(adjustment.qty) : Math.abs(adjustment.qty)) : adjustment.qty), 0);
  const sold = data.orders.filter((order) => isSale(order) && untilMonth(order.date)).reduce((sum, order) => sum + order.items.filter((item) => item.productId === product.id).reduce((total, item) => total + (item.qty - itemReturn(item)), 0), 0);
  return Math.round(product.openingStock + purchased + adjusted - sold);
}

export function productStatus(data: BosData, monthKey: string) {
  const reference = monthEndDate(monthKey);
  const windowStart = new Date(reference.getTime() - data.params.turnoverWindowDays * 86400000);
  return data.products.map((product) => {
    const stock = stockOf(data, product, monthKey);
    const salesOf = data.orders.filter((order) => isSale(order) && monthKeyOf(order.date) <= monthKey && order.items.some((item) => item.productId === product.id));
    const lastSale = salesOf.map((order) => order.date).sort().slice(-1)[0];
    const qtyWindow = salesOf.filter((order) => new Date(`${order.date}T00:00:00`) >= windowStart).reduce((sum, order) => sum + order.items.filter((item) => item.productId === product.id).reduce((total, item) => total + item.qty, 0), 0);
    const daysSinceSale = lastSale ? daysBetween(lastSale, reference) : Number.POSITIVE_INFINITY;
    const availability = stock <= 0 ? "Habis" : stock <= product.rop * data.thresholds.stokMenipisFactor ? "Hampir Habis" : "Normal";
    const turnover = daysSinceSale >= data.thresholds.deadStockDays ? "Dead Stock" : qtyWindow >= data.params.fastMovingMinQty ? "Fast Moving" : "Slow Moving";
    return { product, stock, stockValue: stock * product.cost, lastSale, daysSinceSale, qtyWindow, availability, turnover };
  });
}

export const stockValueOf = (data: BosData, monthKey: string) => productStatus(data, monthKey).reduce((sum, item) => sum + Math.max(0, item.stockValue), 0);

// ---------------------------------------------------------------------------
// Pelanggan: segmentation from transaction history + Parameter Bisnis
// ---------------------------------------------------------------------------
export function customerStatus(data: BosData, monthKey: string) {
  const reference = monthEndDate(monthKey);
  const passiveDays = data.params.passiveDays;                 // mulai Pasif (31)
  const inactiveDays = data.thresholds.inactiveCustomerDays;   // Tidak Aktif (>90)
  const newDays = data.params.newCustomerDays;                 // Baru (<=30)
  const window = 90;
  return data.customers.filter((customer) => customer.joinedAt.slice(0, 7) <= monthKey).map((customer) => {
    const history = data.orders.filter((order) => isSale(order) && order.customerId === customer.id && monthKeyOf(order.date) <= monthKey);
    const dates = history.map((order) => order.date).sort();
    const lastOrder = dates.slice(-1)[0];
    const firstOrder = dates[0];
    const daysSinceOrder = lastOrder ? daysBetween(lastOrder, reference) : Number.POSITIVE_INFINITY;
    const daysSinceFirst = firstOrder ? daysBetween(firstOrder, reference) : Number.POSITIVE_INFINITY;
    const daysSinceJoined = daysBetween(customer.joinedAt, reference);
    const ordersIn90 = history.filter((order) => daysBetween(order.date, reference) <= window).length;
    const spend = history.reduce((sum, order) => sum + orderGross(order), 0);
    // Definisi final: Loyal >=3 tx/90h · Berulang =2 tx/90h · Baru = tx pertama <=30h ·
    // Pasif = tidak tx 31-90h · Tidak Aktif = tx terakhir >90h. Prioritas recency dulu.
    const segment = history.length === 0
      ? (daysSinceJoined <= newDays ? "Pelanggan Baru" : "Pelanggan Tidak Aktif")
      : daysSinceOrder > inactiveDays ? "Pelanggan Tidak Aktif"
        : daysSinceOrder >= passiveDays ? "Pelanggan Pasif"
          : ordersIn90 >= data.params.loyalMinOrders ? "Pelanggan Loyal"
            : ordersIn90 >= data.params.repeatMinOrders ? "Pelanggan Berulang"
              : daysSinceFirst <= newDays ? "Pelanggan Baru"
                : "Pelanggan Berulang";
    return { customer, orders: history.length, lastOrder, daysSinceOrder, spend, segment };
  });
}

const segmentOrder = ["Pelanggan Loyal", "Pelanggan Berulang", "Pelanggan Baru", "Pelanggan Pasif", "Pelanggan Tidak Aktif"] as const;
const segmentColors = { "Pelanggan Loyal": "brand", "Pelanggan Berulang": "success", "Pelanggan Baru": "warning", "Pelanggan Pasif": "brandSecondary", "Pelanggan Tidak Aktif": "error" } as const;

// ---------------------------------------------------------------------------
// Selectors consumed by the screens (shapes kept stable for the existing UI)
// ---------------------------------------------------------------------------
export function customerAnalytics(data: BosData, monthKey: string) {
  const statuses = customerStatus(data, monthKey);
  const segments = segmentOrder.map((label) => ({ label, count: statuses.filter((item) => item.segment === label).length, colorKey: segmentColors[label] }));
  // Repeat Rate: customers with lifetime orders >= repeatMinOrders (Parameter Bisnis)
  // divided by customers who ordered at least once. Independent of the segment labels,
  // so a recently-joined customer with repeat orders is still counted as repeat.
  const buyers = statuses.filter((item) => item.orders >= 1).length;
  const repeatCustomers = statuses.filter((item) => item.orders >= data.params.repeatMinOrders).length;
  const repeatRatePct = buyers > 0 ? (repeatCustomers / buyers) * 100 : 0;
  const activeOf = (key: string) => { const list = customerStatus(data, key); return list.filter((item) => ["Pelanggan Loyal", "Pelanggan Berulang", "Pelanggan Baru"].includes(item.segment)).length; };
  const cityCounts = new Map<string, number>();
  statuses.forEach((item) => cityCounts.set(item.customer.city || "Lainnya", (cityCounts.get(item.customer.city || "Lainnya") ?? 0) + 1));
  // Fully dynamic distribution: one entry per city that actually has at least one customer
  // in the selected period, sorted by customer count descending. Cities with zero customers
  // are never shown, so the list always reflects the real customer data.
  const regions = [...cityCounts.entries()]
    .map(([name, count]) => ({ name, count }))
    .filter((region) => region.count > 0)
    .sort((left, right) => right.count - left.count || left.name.localeCompare(right.name));
  const reference = monthEndDate(monthKey);
  // #14 Tren Pelanggan Lama vs Baru — TIDAK memakai batas 30/90 hari.
  // Baru = transaksi PERTAMA sepanjang seluruh riwayat jatuh pada bulan tsb.
  // Lama = pernah transaksi sebelum bulan tsb dan kembali transaksi pada bulan tsb.
  const firstOrderMonthByCustomer = new Map<string, string>();
  data.orders.filter((order) => isSale(order)).forEach((order) => {
    const current = firstOrderMonthByCustomer.get(order.customerId);
    const key = monthKeyOf(order.date);
    if (!current || key < current) firstOrderMonthByCustomer.set(order.customerId, key);
  });
  const newVsReturning = (key: string) => {
    const buyersThisMonth = new Set(data.orders.filter((order) => isSale(order) && monthKeyOf(order.date) === key).map((order) => order.customerId));
    let baru = 0; let lama = 0;
    buyersThisMonth.forEach((customerId) => { if (firstOrderMonthByCustomer.get(customerId) === key) baru += 1; else lama += 1; });
    return { baru, lama };
  };
  const newTrend = trailingMonths(monthKey).map((key) => ({ key, label: shortMonthLabel(key), value: newVsReturning(key).baru }));
  const returningTrend = trailingMonths(monthKey).map((key) => ({ key, label: shortMonthLabel(key), value: newVsReturning(key).lama }));
  return {
    active: segments.slice(0, 3).reduce((sum, segment) => sum + segment.count, 0),
    segments,
    regions,
    repeatRatePct,
    repeatCustomers,
    buyers,
    trend: trailingMonths(monthKey).map((key) => ({ key, label: shortMonthLabel(key), value: activeOf(key) })),
    newTrend,
    returningTrend,
    monthLabel: monthLabel(monthKey),
    segmentsTotal: statuses.length,
    referenceDate: `${reference.getDate()} ${monthLabel(monthKey)}`,
  };
}

export function productAnalytics(data: BosData, monthKey: string) {
  const statuses = productStatus(data, monthKey);
  const countOf = (list: typeof statuses, key: "availability" | "turnover", label: string) => list.filter((item) => item[key] === label).length;
  const reference = monthEndDate(monthKey);
  return {
    stockValueJt: toJt(stockValueOf(data, monthKey)),
    availability: [
      { label: "Normal", count: countOf(statuses, "availability", "Normal"), colorKey: "brand" as const },
      { label: "Hampir Habis", count: countOf(statuses, "availability", "Hampir Habis"), colorKey: "warning" as const },
      { label: "Habis", count: countOf(statuses, "availability", "Habis"), colorKey: "error" as const },
    ],
    turnover: [
      { label: "Fast Moving", count: countOf(statuses, "turnover", "Fast Moving"), colorKey: "brand" as const },
      { label: "Slow Moving", count: countOf(statuses, "turnover", "Slow Moving"), colorKey: "warning" as const },
      { label: "Dead Stock", count: countOf(statuses, "turnover", "Dead Stock"), colorKey: "error" as const },
    ],
    trend: trailingMonths(monthKey).map((key) => ({ key, label: shortMonthLabel(key), value: Math.round(stockValueOf(data, key) / 100_000) / 10 })),
    availabilityTotal: statuses.length,
    turnoverTotal: statuses.length,
    monthLabel: monthLabel(monthKey),
    referenceDate: `${reference.getDate()} ${monthLabel(monthKey)}`,
  };
}

export function salesAnalytics(data: BosData, monthKey: string) {
  const metrics = monthMetrics(data, monthKey);
  const months = trailingMonths(monthKey);
  // Keep the raw rupiah omzet per channel so the UI can display it precisely. toJt (whole
  // millions) is retained only for backward-compatible callers, but at a small-business scale
  // it collapses distinct channels to "1 Jt" and hides sub-million channels, so the screens
  // now use the raw `omzet` for bars, share and labels.
  const channels = metrics.channels.map((channel) => ({ name: channel.name, omzet: channel.omzet, omzetJt: toJt(channel.omzet) }));
  return {
    orders: metrics.orders,
    qty: metrics.qty,
    omzetJt: toJt(metrics.omzet),
    channels,
    channelTotal: channels.reduce((sum, channel) => sum + channel.omzet, 0) || 1,
    aovRibu: toRibu(metrics.aov),
    omzetTrend: months.map((key) => ({ key, label: shortMonthLabel(key), value: toJt(monthMetrics(data, key).omzet) })),
    orderTrend: months.map((key) => ({ key, label: shortMonthLabel(key), value: monthMetrics(data, key).orders })),
    monthLabel: monthLabel(monthKey),
  };
}

// #15 Metrik untuk rentang tanggal bebas (YYYY-MM-DD inklusif). Read-only; dari Profit Engine.
// Nama field dibuat sama dengan monthMetrics agar laporan bisa memakai keduanya konsisten.
export function rangeMetrics(data: BosData, start: string, end: string) {
  const lo = start <= end ? start : end;
  const hi = start <= end ? end : start;
  const orders = data.orders.filter((order) => order.status === "Selesai" && order.date >= lo && order.date <= hi);
  const perOrder = orders.map((order) => ({ order, ...orderProfit(data, order) }));
  const sum = (pick: (entry: (typeof perOrder)[number]) => number) => perOrder.reduce((total, entry) => total + pick(entry), 0);
  const omzet = sum((entry) => entry.omzet);
  const expenses = data.expenses.filter((expense) => expense.date >= lo && expense.date <= hi).reduce((total, expense) => total + expense.amount, 0);
  const purchases = data.purchases.filter((purchase) => purchase.date >= lo && purchase.date <= hi).reduce((total, purchase) => total + purchase.items.reduce((sub, item) => sub + item.qty * item.cost, 0), 0);
  const channelFee = sum((entry) => entry.channelCostTotal);
  const cogs = sum((entry) => entry.hpp);
  const tax = sum((entry) => entry.tax);
  const packaging = sum((entry) => entry.packaging);
  const netProfitTransactions = sum((entry) => entry.netProfit);
  const cashIn = omzet;
  const cashOut = purchases + expenses + channelFee;
  const channels = data.channels.map((channel) => ({ name: channel.name, omzet: perOrder.filter((entry) => entry.order.channelId === channel.id).reduce((total, entry) => total + entry.omzet, 0) }));
  return { start: lo, end: hi, omzet, qty: sum((entry) => entry.qty), orders: orders.length, cogs, channelFee, tax, packaging, expenses, purchases, cashIn, cashOut, grossProfit: omzet - cogs, netProfit: netProfitTransactions - expenses, aov: orders.length ? omzet / orders.length : 0, channels };
}

export function financeAnalytics(data: BosData, monthKey: string) {
  const months = trailingMonths(monthKey);
  const now = monthMetrics(data, monthKey);
  const previous = monthMetrics(data, previousMonthKey(monthKey));
  const changeOf = (current: number, before: number) => {
    if (!before) return { percent: 0, direction: "flat" as const };
    const percent = Math.round(((current - before) / before) * 100);
    return { percent: Math.abs(percent), direction: percent > 0 ? ("up" as const) : percent < 0 ? ("down" as const) : ("flat" as const) };
  };
  const series = (pick: (metrics: ReturnType<typeof monthMetrics>) => number) => months.map((key) => ({ key, label: shortMonthLabel(key), value: pick(monthMetrics(data, key)) }));
  return {
    kpis: [
      { key: "kas-masuk", label: "Kas Masuk", icon: "arrow-down-circle-outline", value: `Rp${toJt(now.cashIn)}`, unit: "Jt", positiveWhenUp: true, ...changeOf(now.cashIn, previous.cashIn) },
      { key: "kas-keluar", label: "Kas Keluar", icon: "arrow-up-circle-outline", value: `Rp${toJt(now.cashOut)}`, unit: "Jt", positiveWhenUp: false, ...changeOf(now.cashOut, previous.cashOut) },
      { key: "pendapatan", label: "Pendapatan", icon: "cash-multiple", value: `Rp${toJt(now.omzet)}`, unit: "Jt", positiveWhenUp: true, ...changeOf(now.omzet, previous.omzet) },
      { key: "biaya", label: "Biaya", icon: "receipt", value: `Rp${toJt(now.cogs + now.expenses + now.channelFee + now.tax + now.packaging)}`, unit: "Jt", positiveWhenUp: false, ...changeOf(now.cogs + now.expenses + now.channelFee + now.tax + now.packaging, previous.cogs + previous.expenses + previous.channelFee + previous.tax + previous.packaging) },
    ],
    cashInTrend: series((metrics) => toJt(metrics.cashIn)),
    cashOutTrend: series((metrics) => toJt(metrics.cashOut)),
    revenueTrend: series((metrics) => toJt(metrics.omzet)),
    expenseTrend: series((metrics) => toJt(metrics.cogs + metrics.expenses + metrics.channelFee + metrics.tax + metrics.packaging)),
    profitTrend: series((metrics) => toJt(metrics.netProfit)),
    monthLabel: monthLabel(monthKey),
    previousLabel: monthLabel(previousMonthKey(monthKey)).split(" ")[0],
  };
}
