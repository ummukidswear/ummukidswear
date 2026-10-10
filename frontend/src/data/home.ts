import { BosData } from "@/src/data/types";
import { cashBalance, customerAnalytics, monthMetrics, productAnalytics, salesAnalytics, stockValueOf, targetFor } from "@/src/data/calc";
import { monthLabel, fullMonthLabel, previousMonthKey, toJt, formatThousands, compactRupiah } from "@/src/data/time";

export type Trend = { percent: number; direction: "up" | "down" | "flat" };
export type Kpi = { key: string; label: string; icon: string; value: string; unit?: string; trend: Trend; positiveWhenUp: boolean };
export type Factor = { label: string; icon: string; score: number };
export type Insight = { key: string; title: string; detail: string; icon: string; tone: "brand" | "success" | "warning" | "error" };

const clampScore = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

const trendOf = (current: number, previous: number): Trend => {
  if (!previous) return { percent: 0, direction: "flat" };
  const percent = Math.round(((current - previous) / previous) * 100);
  return { percent: Math.abs(percent), direction: percent > 0 ? "up" : percent < 0 ? "down" : "flat" };
};

// Executive summary. Every number comes from the calculation layer, driven by the
// source data and the Target / Parameter Bisnis / Threshold values set in More.
export function homeSummary(data: BosData, monthKey: string) {
  const previousKey = previousMonthKey(monthKey);
  const metrics = monthMetrics(data, monthKey);
  const previousMetrics = monthMetrics(data, previousKey);
  const customers = customerAnalytics(data, monthKey);
  const previousCustomers = customerAnalytics(data, previousKey);
  const products = productAnalytics(data, monthKey);
  const sales = salesAnalytics(data, monthKey);
  const target = targetFor(data, monthKey);
  const cash = cashBalance(data, monthKey);
  const previousCash = cashBalance(data, previousKey);
  const stockValue = stockValueOf(data, monthKey);
  const previousStockValue = stockValueOf(data, previousKey);

  const marginTarget = target?.marginTargetPct ?? data.thresholds.marginLowPct;
  const omzetTarget = target?.omzetTarget ?? 0;
  // Pencapaian Omzet: tanpa target & tanpa omzet = 0 (bukan 100). Tanpa target tetapi ada
  // omzet = tidak bisa dinilai → 0 pula, agar skor tidak pernah memakai nilai palsu.
  const targetPct = omzetTarget > 0 ? (metrics.omzet / omzetTarget) * 100 : 0;
  const normalCount = products.availability.find((item) => item.label === "Normal")?.count ?? 0;
  const stockHealthPct = products.availabilityTotal ? (normalCount / products.availabilityTotal) * 100 : 0;
  const repeatRatePct = customers.repeatRatePct;
  const cashCoverPct = metrics.omzet > 0 ? (cash / metrics.omzet) * 100 : 0;
  const hasOperationalData = metrics.orders > 0 || data.products.length > 0 || data.customers.length > 0 || data.accounts.length > 0;

  const factors: Factor[] = [
    { label: "Margin", icon: "cash-multiple", score: metrics.omzet > 0 ? clampScore((metrics.marginPct / Math.max(1, marginTarget)) * 100) : 0 },
    { label: "Pencapaian Omzet", icon: "target", score: clampScore(targetPct) },
    { label: "Kesehatan Stok", icon: "package-variant-closed", score: clampScore(stockHealthPct) },
    { label: "Saldo Kas", icon: "wallet-outline", score: clampScore((cashCoverPct / 50) * 100) },
    { label: "Repeat Rate", icon: "account-group-outline", score: clampScore(repeatRatePct) },
  ];
  const score = clampScore(factors.reduce((sum, factor) => sum + factor.score, 0) / factors.length);
  const status = !hasOperationalData && score === 0 ? { label: "Belum Ada Data", tone: "warning" as const, note: "Skor dihitung otomatis setelah ada data operasional" }
    : score >= 85 ? { label: "Sangat Sehat", tone: "success" as const, note: "Bisnis tumbuh sangat baik" }
    : score >= 70 ? { label: "Sehat", tone: "success" as const, note: "Bisnis dalam kondisi baik dan stabil" }
      : score >= 55 ? { label: "Perlu Perhatian", tone: "warning" as const, note: "Beberapa indikator mulai melemah" }
        : { label: "Kritis", tone: "error" as const, note: "Segera perbaiki indikator utama" };

  const kpis: Kpi[] = [
    { key: "omzet", label: "Omzet", icon: "chart-box-outline", value: compactRupiah(metrics.omzet), trend: trendOf(metrics.omzet, previousMetrics.omzet), positiveWhenUp: true },
    { key: "laba", label: "Laba Bersih", icon: "hand-coin-outline", value: compactRupiah(metrics.netProfit), trend: trendOf(metrics.netProfit, previousMetrics.netProfit), positiveWhenUp: true },
    { key: "order", label: "Total Order", icon: "cart-outline", value: formatThousands(metrics.orders), trend: trendOf(metrics.orders, previousMetrics.orders), positiveWhenUp: true },
    { key: "aov", label: "AOV", icon: "receipt-outline", value: compactRupiah(metrics.aov), trend: trendOf(metrics.aov, previousMetrics.aov), positiveWhenUp: true },
    { key: "pelanggan", label: "Pelanggan Aktif", icon: "account-group-outline", value: formatThousands(customers.active), trend: trendOf(customers.active, previousCustomers.active), positiveWhenUp: true },
    { key: "qty", label: "Qty Terjual", icon: "cube-outline", value: formatThousands(metrics.qty), trend: trendOf(metrics.qty, previousMetrics.qty), positiveWhenUp: true },
    { key: "kas", label: "Saldo Kas", icon: "wallet-outline", value: compactRupiah(cash), trend: trendOf(cash, previousCash), positiveWhenUp: true },
    { key: "stok", label: "Nilai Stok", icon: "archive-outline", value: compactRupiah(stockValue), trend: trendOf(stockValue, previousStockValue), positiveWhenUp: false },
  ];

  const omzetTrend = trendOf(metrics.omzet, previousMetrics.omzet);
  const activeTrend = trendOf(customers.active, previousCustomers.active);
  const slowMoving = products.turnover.find((item) => item.label === "Slow Moving")?.count ?? 0;
  const deadStock = products.turnover.find((item) => item.label === "Dead Stock")?.count ?? 0;
  const outOfStock = products.availability.find((item) => item.label === "Habis")?.count ?? 0;
  const lowStock = products.availability.find((item) => item.label === "Hampir Habis")?.count ?? 0;
  const topChannel = [...sales.channels].sort((left, right) => right.omzetJt - left.omzetJt)[0];

  const pool: (Insight & { weight: number })[] = [
    { key: "stok", weight: (outOfStock + lowStock) * 2.5, icon: "alert-outline", tone: outOfStock > 0 ? "error" : "warning", title: `${outOfStock} produk habis, ${lowStock} hampir habis`, detail: "Kesiapan stok memengaruhi potensi penjualan bulan depan." },
    { key: "slow", weight: slowMoving + deadStock, icon: "trending-down", tone: "warning", title: `${slowMoving} produk mulai melambat`, detail: "Perlu perhatian agar tidak menjadi dead stock." },
    { key: "omzet", weight: omzetTrend.percent + 20, icon: omzetTrend.direction === "down" ? "arrow-down" : "arrow-up", tone: omzetTrend.direction === "down" ? "error" : "success", title: `Omzet ${omzetTrend.direction === "down" ? "turun" : "naik"} ${omzetTrend.percent}%`, detail: topChannel ? `Kontribusi terbesar dari channel ${topChannel.name}.` : "Belum ada channel penjualan tercatat." },
    { key: "pelanggan", weight: activeTrend.percent + 8, icon: "account-group-outline", tone: activeTrend.direction === "down" ? "warning" : "brand", title: `Pelanggan aktif ${activeTrend.direction === "down" ? "turun" : "naik"} ${activeTrend.percent}%`, detail: "Tren pelanggan menunjukkan pertumbuhan positif." },
    { key: "target", weight: Math.abs(100 - targetPct) + 10, icon: "target", tone: targetPct >= 100 ? "success" : "warning", title: `Pencapaian omzet ${Math.round(targetPct)}%`, detail: `Target omzet ${toJt(omzetTarget)} Jt untuk ${monthLabel(monthKey)}.` },
    { key: "margin", weight: Math.abs(marginTarget - metrics.marginPct) * 4, icon: "percent-outline", tone: metrics.marginPct >= marginTarget ? "success" : "warning", title: `Margin ${Math.round(metrics.marginPct)}%`, detail: `Laba bersih ${toJt(metrics.netProfit)} Jt dari omzet ${toJt(metrics.omzet)} Jt.` },
  ];
  const insights: Insight[] = pool.sort((left, right) => right.weight - left.weight).slice(0, 4).map(({ weight, ...insight }) => { void weight; return insight; });

  return { score, status, factors, kpis, insights, monthLabel: monthLabel(monthKey), previousLabel: fullMonthLabel(previousKey) };
}
