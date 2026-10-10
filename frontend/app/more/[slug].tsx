import { useEffect, useMemo, useState } from "react";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import * as XLSX from "xlsx";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Pressable, ScrollView, View } from "react-native";
import { Text } from "@/src/components/text";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { EntityList } from "@/src/components/entity-list";
import { ConfirmSheet, DateField, EmptyState, Field, IconName, ModuleHeader, Pill, Sheet, ThemedStatusBar, ToggleField, useKit } from "@/src/components/ui-kit";
import { accountBalances, availableMonthKeys, latestMonthKey, monthMetrics, productStatus, rangeMetrics, stockValueOf, targetFor } from "@/src/data/calc";
import { profitForMonth, salesProfitBreakdown } from "@/src/data/profit";
import { CrudDef, FieldDef, moduleBySlug, numberFieldsFor } from "@/src/data/modules";
import { dataQualityIssues } from "@/src/data/rules";
import { newId, useBos } from "@/src/data/store";
import { formatPlg, formatSku, maxPlgNumber, maxSkuNumber } from "@/src/data/helpers";
import { BackupEntry, backupSummary, createBackup, deleteBackup, listBackups } from "@/src/data/backup";
import { formatRupiah, monthLabel, toDisplayDate } from "@/src/data/time";
import { exportTable, nowStamp, ExportFormat } from "@/src/data/exporter";
import { downloadImportTemplate } from "@/src/data/import-template";
import { CollectionKey } from "@/src/data/types";
import { ThemePreference, setThemePreference, useTheme, useThemePreference } from "@/src/theme";

// Single route for every More module: CRUD modules render the shared EntityList, the
// read-only modules render straight from the calculation layer (no duplicate datasets).
export default function ModuleScreen() {
  const kit = useKit(); const insets = useSafeAreaInsets(); const router = useRouter();
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const def = moduleBySlug(String(slug));

  if (!def) return <View style={kit.screen}><View style={{ paddingTop: insets.top + 6 }}><ModuleHeader title="Modul" subtitle="Tidak ditemukan" onBack={() => router.back()} /></View><EmptyState text="Modul tidak ditemukan." /></View>;

  return <View style={kit.screen}><ThemedStatusBar />
    <View style={{ paddingTop: insets.top + 6 }}><ModuleHeader title={def.title} subtitle={def.subtitle} onBack={() => router.back()} /></View>
    {def.kind === "crud" ? <EntityList def={def} /> : <ScrollView contentContainerStyle={[kit.body, { paddingBottom: insets.bottom + 24 }]} showsVerticalScrollIndicator={false}>
      {def.kind === "numbers" ? <NumbersForm target={def.target ?? "params"} /> : null}
      {def.kind === "keuangan" ? <KeuanganOverview /> : null}
      {def.kind === "laporan-penjualan" ? <LaporanPenjualan /> : null}
      {def.kind === "laporan-keuangan" ? <LaporanKeuangan /> : null}
      {def.kind === "laporan-stok" ? <LaporanStok /> : null}
      {def.kind === "laba" ? <LabaReport /> : null}
      {def.kind === "laba-penjualan" ? <LabaPenjualan /> : null}
      {def.kind === "import" ? <ImportData /> : null}
      {def.kind === "export" ? <ExportData /> : null}
      {def.kind === "quality" ? <DataQuality /> : null}
      {def.kind === "backup" ? <BackupRestore /> : null}
      {def.kind === "pengaturan" ? <Pengaturan /> : null}
      {def.kind === "tema" ? <PengaturanTema /> : null}
      {def.kind === "notifikasi" ? <Notifikasi /> : null}
      {def.kind === "audit" ? <AuditLog /> : null}
      {def.kind === "reset" ? <ResetData /> : null}
    </ScrollView>}
  </View>;
}

function StatRow({ label, value, tone }: { label: string; value: string; tone?: string }) {
  const kit = useKit();
  return <View style={kit.row}><View style={kit.rowCopy}><Text style={kit.rowTitle}>{label}</Text></View><Text style={[kit.rowValue, tone ? { color: tone } : null]}>{value}</Text></View>;
}

// Baris angka yang dapat ditelusuri (drill-down) ke sumber transaksi lewat /detail. Read-only.
function LinkRow({ label, value, tone, sub, onPress, testID }: { label: string; value: string; tone?: string; sub?: string; onPress: () => void; testID: string }) {
  const kit = useKit(); const { colors } = useTheme();
  return <Pressable testID={testID} accessibilityRole="button" onPress={onPress} style={({ pressed }) => [kit.row, pressed && { opacity: 0.85 }]}>
    <View style={kit.rowCopy}><Text style={kit.rowTitle}>{label}</Text>{sub ? <Text style={kit.rowSub}>{sub}</Text> : null}</View>
    <Text style={[kit.rowValue, tone ? { color: tone } : null]}>{value}</Text>
    <MaterialCommunityIcons name="chevron-right" size={18} color={colors.onSurfaceTertiary} style={{ marginLeft: 4 }} />
  </Pressable>;
}

// Chip bulan yang tersedia dari data (terbaru di kiri). Dipakai modul Keuangan & Laba Penjualan.
function MonthChips({ months, value, onChange, testPrefix }: { months: string[]; value: string; onChange: (key: string) => void; testPrefix: string }) {
  const { colors } = useTheme();
  return <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 2, paddingRight: 12, marginBottom: 8 }}>
    {months.slice().reverse().map((key) => { const on = key === value; return <Pressable key={key} testID={`${testPrefix}-${key}`} accessibilityRole="button" onPress={() => onChange(key)} style={({ pressed }) => [{ flexShrink: 0, minHeight: 36, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, alignItems: "center", justifyContent: "center", backgroundColor: on ? colors.brandPrimary : colors.surfaceSecondary, borderColor: on ? colors.brandPrimary : colors.border }, pressed && { opacity: 0.85 }]}><Text style={{ fontSize: 11, fontWeight: "800", color: on ? colors.onBrandPrimary : colors.onSurfaceSecondary }}>{monthLabel(key)}</Text></Pressable>; })}
  </ScrollView>;
}

function NumbersForm({ target }: { target: "params" | "thresholds" }) {
  const kit = useKit(); const { data, patchParams, patchThresholds } = useBos();
  const current = target === "params" ? data.params : data.thresholds;
  const [draft, setDraft] = useState<Record<string, string>>(Object.fromEntries(Object.entries(current).map(([key, value]) => [key, String(value)])));
  const [saved, setSaved] = useState(false);
  const save = () => {
    const parsed = Object.fromEntries(Object.entries(draft).map(([key, value]) => [key, Number(value) || 0]));
    if (target === "params") patchParams(parsed as never); else patchThresholds(parsed as never);
    setSaved(true);
  };
  return <View>
    <View style={kit.card}>{numberFieldsFor(target).map((field) => <View key={field.key}>
      <Field label={`${field.label} · ${field.hint}`} money={!!field.money} keyboardType="numeric" value={draft[field.key] ?? ""} onChangeText={(value) => setDraft({ ...draft, [field.key]: value })} />
    </View>)}</View>
    <Pressable testID="save-numbers" accessibilityRole="button" onPress={save} style={({ pressed }) => [kit.primaryButton, pressed && kit.primaryButtonPressed]}><Text style={kit.primaryText}>Simpan</Text></Pressable>
    {saved ? <Text style={[kit.cardSub, { textAlign: "center", marginTop: 8 }]}>Tersimpan · semua perhitungan, alert dan action mengikuti nilai baru</Text> : null}
  </View>;
}

function KeuanganOverview() {
  const kit = useKit(); const { colors } = useTheme(); const router = useRouter(); const { data } = useBos();
  const months = availableMonthKeys(data);
  const [monthKey, setMonthKey] = useState(latestMonthKey(data));
  const metrics = monthMetrics(data, monthKey);
  const balances = accountBalances(data, monthKey);
  const target = targetFor(data, monthKey);
  const open = (type: string, value = "") => router.push({ pathname: "/detail", params: { type, value, month: monthKey } });
  return <View>
    <View style={kit.card}><Text style={kit.cardTitle}>Ringkasan {monthLabel(monthKey)}</Text><Text style={kit.cardSub}>Dihitung dari order, pembelian, pengeluaran & akun kas · ketuk angka untuk menelusuri sumber transaksi</Text></View>
    <MonthChips months={months} value={monthKey} onChange={setMonthKey} testPrefix="keu-period-chip" />
    <LinkRow testID="keu-pendapatan" label="Pendapatan" value={formatRupiah(metrics.omzet)} onPress={() => open("finance-pendapatan")} />
    <LinkRow testID="keu-hpp" label="HPP" value={formatRupiah(metrics.cogs)} onPress={() => open("finance-hpp")} />
    <LinkRow testID="keu-biaya-channel" label="Biaya channel" value={formatRupiah(metrics.channelFee)} onPress={() => open("finance-biaya-channel")} />
    <LinkRow testID="keu-packaging" label="Packaging" value={formatRupiah(metrics.packaging)} onPress={() => open("finance-packaging")} />
    <LinkRow testID="keu-pajak" label="Pajak / PPh" value={formatRupiah(metrics.tax)} onPress={() => open("finance-pajak")} />
    <LinkRow testID="keu-pengeluaran" label="Pengeluaran" value={formatRupiah(metrics.expenses)} onPress={() => open("finance-pengeluaran")} />
    <LinkRow testID="keu-laba" label="Laba bersih" value={formatRupiah(metrics.netProfit)} tone={metrics.netProfit >= 0 ? colors.success : colors.error} onPress={() => open("finance-laba")} />
    <LinkRow testID="keu-margin" label="Margin" value={`${Math.round(metrics.marginPct)}%`} tone={metrics.marginPct >= (target?.marginTargetPct ?? 0) ? colors.success : colors.warning} onPress={() => open("finance-margin")} />
    <LinkRow testID="keu-kas-masuk" label="Kas masuk" value={formatRupiah(metrics.cashIn)} onPress={() => open("finance-kas-masuk")} />
    <LinkRow testID="keu-kas-keluar" label="Kas keluar" value={formatRupiah(metrics.cashOut)} onPress={() => open("finance-kas-keluar")} />
    <View style={[kit.card, { marginTop: 8 }]}><Text style={kit.cardTitle}>Saldo per akun</Text><Text style={kit.cardSub}>Saldo awal + kas masuk − kas keluar s/d akhir {monthLabel(monthKey)}</Text></View>
    {balances.length === 0 ? <EmptyState text="Belum ada akun kas." /> : balances.map((account) => <LinkRow key={account.id} testID={`keu-akun-${account.id}`} label={`${account.name} · ${account.type}`} sub={`Awal ${formatRupiah(account.openingBalance)} · masuk ${formatRupiah(account.cashIn)} · keluar ${formatRupiah(account.cashOut)}`} value={formatRupiah(account.balance)} onPress={() => open("finance-saldo-akun", account.id)} />)}
    <LinkRow testID="keu-saldo-total" label="Total Saldo Kas" value={formatRupiah(balances.reduce((sum, account) => sum + account.balance, 0))} tone={colors.brand} onPress={() => open("finance-saldo-akun")} />
  </View>;
}

// Laba Penjualan: fokus penjualan produk seluruh channel, terpisah dari Laba Bersih Bisnis.
// Ringkasan → Per Channel → Per Produk → Transaksi. Semua angka dari Profit Engine yang sama.
function LabaPenjualan() {
  const kit = useKit(); const { colors } = useTheme(); const { data } = useBos();
  const months = availableMonthKeys(data);
  const [monthKey, setMonthKey] = useState(latestMonthKey(data));
  const [openOrder, setOpenOrder] = useState<string | null>(null);
  const report = salesProfitBreakdown(data, monthKey);
  const pct = (value: number) => `${Math.round(value)}%`;
  const productName = (id: string) => data.products.find((product) => product.id === id)?.name ?? id;
  const customerName = (id: string) => data.customers.find((customer) => customer.id === id)?.name ?? "Tanpa pelanggan";
  const channelName = (id: string) => data.channels.find((channel) => channel.id === id)?.name ?? "-";
  return <View>
    <View style={kit.card}><Text style={kit.cardTitle}>Ringkasan · {monthLabel(monthKey)}</Text><Text style={kit.cardSub}>Laba Penjualan = Pendapatan Neto − HPP − Biaya Channel − Packaging − PPh · sumber Profit Engine</Text></View>
    <MonthChips months={months} value={monthKey} onChange={setMonthKey} testPrefix="lp-period-chip" />
    <StatRow label="Pendapatan Neto" value={formatRupiah(report.omzet)} tone={colors.brand} />
    <StatRow label="− HPP" value={formatRupiah(report.hpp)} />
    <StatRow label="− Biaya Channel" value={formatRupiah(report.channelCostTotal)} />
    <StatRow label="− Packaging" value={formatRupiah(report.packaging)} />
    <StatRow label="− Pajak / PPh" value={formatRupiah(report.tax)} />
    <StatRow label="Laba Penjualan" value={formatRupiah(report.salesProfit)} tone={report.salesProfit >= 0 ? colors.success : colors.error} />
    <StatRow label="Margin Penjualan" value={pct(report.salesMarginPct)} tone={report.salesMarginPct >= 0 ? colors.success : colors.error} />
    <View style={[kit.row, { opacity: 0.8 }]}><View style={kit.rowCopy}><Text style={kit.rowSub}>Laba Bersih Bisnis = Laba Penjualan − Biaya Operasional ({formatRupiah(report.expenses)})</Text></View><Text style={kit.rowSub}>{formatRupiah(report.netProfitBusiness)}</Text></View>

    <View style={[kit.card, { marginTop: 8 }]}><Text style={kit.cardTitle}>Per Channel</Text><Text style={kit.cardSub}>Hanya channel yang memiliki transaksi pada periode ini</Text></View>
    {report.channels.length === 0 ? <EmptyState text="Tidak ada transaksi pada periode ini." /> : report.channels.map((channel) => <View key={channel.id} testID={`lp-channel-${channel.id}`} style={kit.row}>
      <View style={kit.rowCopy}><Text style={kit.rowTitle}>{channel.name}</Text><Text style={kit.rowSub}>{`${channel.orders} order · pendapatan ${formatRupiah(channel.revenue)} · HPP ${formatRupiah(channel.hpp)} · biaya ${formatRupiah(channel.channelCost + channel.packaging + channel.tax)}`}</Text></View>
      <View style={{ alignItems: "flex-end" }}><Text style={[kit.rowValue, { color: channel.profit >= 0 ? colors.success : colors.error }]}>{formatRupiah(channel.profit)}</Text><Text style={kit.rowSub}>{pct(channel.marginPct)}</Text></View>
    </View>)}

    <View style={[kit.card, { marginTop: 8 }]}><Text style={kit.cardTitle}>Per Produk</Text><Text style={kit.cardSub}>Produk · Qty · Pendapatan · HPP · Biaya · Laba · Margin</Text></View>
    {report.products.length === 0 ? <EmptyState text="Tidak ada transaksi pada periode ini." /> : report.products.map((row) => <View key={row.productId} testID={`lp-product-${row.productId}`} style={kit.row}>
      <View style={kit.rowCopy}><Text numberOfLines={1} style={kit.rowTitle}>{row.product?.name ?? row.productId}</Text><Text style={kit.rowSub}>{`${row.qty} pcs · pendapatan ${formatRupiah(row.revenue)} · HPP ${formatRupiah(row.hpp)} · biaya ${formatRupiah(row.costs)}`}</Text></View>
      <View style={{ alignItems: "flex-end" }}><Text style={[kit.rowValue, { color: row.profit >= 0 ? colors.success : colors.error }]}>{formatRupiah(row.profit)}</Text><Text style={kit.rowSub}>{pct(row.marginPct)}</Text></View>
    </View>)}

    <View style={[kit.card, { marginTop: 8 }]}><Text style={kit.cardTitle}>Transaksi</Text><Text style={kit.cardSub}>Ketuk order untuk menelusuri sampai Order Item</Text></View>
    {report.perOrder.length === 0 ? <EmptyState text="Tidak ada transaksi pada periode ini." /> : report.perOrder.map((entry) => { const expanded = openOrder === entry.order.id; return <View key={entry.order.id}>
      <Pressable testID={`lp-order-${entry.order.id}`} accessibilityRole="button" onPress={() => setOpenOrder(expanded ? null : entry.order.id)} style={({ pressed }) => [kit.row, pressed && { opacity: 0.85 }]}>
        <View style={kit.rowCopy}><Text style={kit.rowTitle}>{entry.order.code || "Order"}</Text><Text numberOfLines={1} style={kit.rowSub}>{`${toDisplayDate(entry.order.date)} · ${customerName(entry.order.customerId)} · ${channelName(entry.order.channelId)} · ${formatRupiah(entry.omzet)}`}</Text></View>
        <Text style={[kit.rowValue, { color: entry.netProfit >= 0 ? colors.success : colors.error }]}>{formatRupiah(entry.netProfit)}</Text>
        <MaterialCommunityIcons name={expanded ? "chevron-up" : "chevron-down"} size={18} color={colors.onSurfaceTertiary} style={{ marginLeft: 4 }} />
      </Pressable>
      {expanded ? <View style={[kit.card, { marginTop: -2 }]}>{entry.items.map((item, index) => <View key={index} style={{ paddingVertical: 4, borderTopWidth: index ? 1 : 0, borderTopColor: colors.border }}>
        <Text style={kit.rowTitle}>{`${productName(item.productId)} · ${item.effQty} pcs${item.qtyReturned ? ` (retur ${item.qtyReturned})` : ""}`}</Text>
        <Text style={kit.rowSub}>{`Jual ${formatRupiah(item.actualSellingValue)} − HPP ${formatRupiah(item.hpp)} − channel ${formatRupiah(item.channelCostTotal)} − pack ${formatRupiah(item.packaging)} − PPh ${formatRupiah(item.tax)} = ${formatRupiah(item.netProfit)}`}</Text>
      </View>)}</View> : null}
    </View>; })}
  </View>;
}

function LaporanPenjualan() {
  const kit = useKit(); const { colors } = useTheme(); const { data } = useBos();
  const months = availableMonthKeys(data);
  const latest = latestMonthKey(data);
  const [mode, setMode] = useState<"month" | "custom">("month");
  const [month, setMonth] = useState(latest);
  const daysInMonth = (key: string) => new Date(Number(key.slice(0, 4)), Number(key.slice(5)), 0).getDate();
  const [start, setStart] = useState(`${latest}-01`);
  const [end, setEnd] = useState(`${latest}-${String(daysInMonth(latest)).padStart(2, "0")}`);
  const metrics = mode === "month" ? monthMetrics(data, month) : rangeMetrics(data, start, end);
  const channels = metrics.channels;
  const periodLabel = mode === "month" ? monthLabel(month) : `${toDisplayDate(start)} s/d ${toDisplayDate(end)}`;
  const [busy, setBusy] = useState<ExportFormat | null>(null); const [note, setNote] = useState("");
  const runExport = async (format: ExportFormat) => {
    setNote(""); setBusy(format);
    try {
      const rows: (string | number)[][] = [
        ["Omzet", formatRupiah(metrics.omzet)],
        ["Jumlah Order", `${metrics.orders} order`],
        ["Qty Terjual", `${metrics.qty} pcs`],
        ["AOV", formatRupiah(metrics.aov)],
        ...channels.filter((channel) => channel.omzet > 0).map((channel) => [`Channel · ${channel.name}`, formatRupiah(channel.omzet)] as (string | number)[]),
      ];
      await exportTable({ fileBase: `laporan-penjualan-${mode === "month" ? month : `${start}_${end}`}`, title: "Laporan Penjualan", meta: [data.settings.shopName || "BOS", `Periode: ${periodLabel}`, `Dibuat: ${nowStamp()}`, "Sumber: data order (Selesai)"], headers: ["Keterangan", "Nilai"], rows }, format);
      setNote(`Laporan Penjualan diekspor sebagai ${format === "pdf" ? "PDF" : "Excel"}.`);
    } catch { setNote("Gagal menyiapkan file ekspor. Coba lagi."); } finally { setBusy(null); }
  };
  return <View>
    <View style={kit.card}><Text style={kit.cardTitle}>Filter Periode</Text><Text style={kit.cardSub}>Seluruh laporan mengikuti periode terpilih · Read-Only</Text></View>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 2, paddingRight: 12 }}>
      {months.slice().reverse().map((key) => { const on = mode === "month" && key === month; return <Pressable key={key} testID={`period-chip-${key}`} accessibilityRole="button" onPress={() => { setMode("month"); setMonth(key); }} style={({ pressed }) => [{ flexShrink: 0, minHeight: 36, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, alignItems: "center", justifyContent: "center", backgroundColor: on ? colors.brandPrimary : colors.surfaceSecondary, borderColor: on ? colors.brandPrimary : colors.border }, pressed && { opacity: 0.85 }]}><Text style={{ fontSize: 11, fontWeight: "800", color: on ? colors.onBrandPrimary : colors.onSurfaceSecondary }}>{monthLabel(key)}</Text></Pressable>; })}
      <Pressable testID="period-chip-custom" accessibilityRole="button" onPress={() => setMode("custom")} style={({ pressed }) => [{ flexShrink: 0, minHeight: 36, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, alignItems: "center", justifyContent: "center", backgroundColor: mode === "custom" ? colors.brandPrimary : colors.surfaceSecondary, borderColor: mode === "custom" ? colors.brandPrimary : colors.border }, pressed && { opacity: 0.85 }]}><Text style={{ fontSize: 11, fontWeight: "800", color: mode === "custom" ? colors.onBrandPrimary : colors.onSurfaceSecondary }}>Custom</Text></Pressable>
    </ScrollView>
    {mode === "custom" ? <View style={[kit.card, { marginTop: 8 }]}>
      <DateField label="Dari Tanggal" value={start} onChange={setStart} />
      <DateField label="Sampai Tanggal" value={end} onChange={setEnd} />
    </View> : null}

    <View style={[kit.card, { marginTop: 8 }]}><Text style={kit.cardTitle}>Ringkasan · {periodLabel}</Text><Text style={kit.cardSub}>Sumber: data order (Selesai)</Text></View>
    <StatRow label="Omzet" value={formatRupiah(metrics.omzet)} tone={colors.brand} />
    <StatRow label="Jumlah Order" value={`${metrics.orders} order`} />
    <StatRow label="Qty Terjual" value={`${metrics.qty} pcs`} />
    <StatRow label="AOV" value={formatRupiah(metrics.aov)} />

    <View style={[kit.card, { marginTop: 8 }]}><Text style={kit.cardTitle}>Omzet per Channel</Text><Text style={kit.cardSub}>Kontribusi kanal pada periode</Text></View>
    {channels.filter((channel) => channel.omzet > 0).length === 0 ? <EmptyState text="Belum ada penjualan pada periode ini." /> : channels.filter((channel) => channel.omzet > 0).map((channel) => <StatRow key={channel.name} label={channel.name} value={formatRupiah(channel.omzet)} />)}

    <View style={[kit.card, { marginTop: 8 }]}><Text style={kit.cardTitle}>Ekspor Laporan</Text><Text style={kit.cardSub}>Laporan siap cetak/pengolahan · {periodLabel}</Text></View>
    <ExportBar formats={["pdf", "xlsx"]} onExport={runExport} busy={busy} note={note} />
  </View>;
}

function LaporanKeuangan() {
  const kit = useKit(); const { colors } = useTheme(); const { data } = useBos();
  const months = availableMonthKeys(data);
  const latest = latestMonthKey(data);
  const [mode, setMode] = useState<"month" | "custom">("month");
  const [month, setMonth] = useState(latest);
  const daysInMonth = (key: string) => new Date(Number(key.slice(0, 4)), Number(key.slice(5)), 0).getDate();
  const [start, setStart] = useState(`${latest}-01`);
  const [end, setEnd] = useState(`${latest}-${String(daysInMonth(latest)).padStart(2, "0")}`);
  const metrics = mode === "month" ? monthMetrics(data, month) : rangeMetrics(data, start, end);
  const periodLabel = mode === "month" ? monthLabel(month) : `${toDisplayDate(start)} s/d ${toDisplayDate(end)}`;
  const biaya = metrics.cogs + metrics.expenses + metrics.channelFee + metrics.tax + metrics.packaging;
  const [busy, setBusy] = useState<ExportFormat | null>(null); const [note, setNote] = useState("");
  const runExport = async (format: ExportFormat) => {
    setNote(""); setBusy(format);
    try {
      const rows: (string | number)[][] = [
        ["Pendapatan", formatRupiah(metrics.omzet)],
        ["HPP", formatRupiah(metrics.cogs)],
        ["Biaya channel", formatRupiah(metrics.channelFee)],
        ["Packaging", formatRupiah(metrics.packaging)],
        ["Pajak / PPh", formatRupiah(metrics.tax)],
        ["Pengeluaran", formatRupiah(metrics.expenses)],
        ["Total biaya", formatRupiah(biaya)],
        ["Laba bersih", formatRupiah(metrics.netProfit)],
        ["Kas masuk", formatRupiah(metrics.cashIn)],
        ["Kas keluar", formatRupiah(metrics.cashOut)],
        ["Arus kas bersih", formatRupiah(metrics.cashIn - metrics.cashOut)],
      ];
      await exportTable({ fileBase: `laporan-keuangan-${mode === "month" ? month : `${start}_${end}`}`, title: "Laporan Keuangan", meta: [data.settings.shopName || "BOS", `Periode: ${periodLabel}`, `Dibuat: ${nowStamp()}`, "Sumber: order, pembelian & pengeluaran"], headers: ["Keterangan", "Nilai"], rows }, format);
      setNote(`Laporan Keuangan diekspor sebagai ${format === "pdf" ? "PDF" : "Excel"}.`);
    } catch { setNote("Gagal menyiapkan file ekspor. Coba lagi."); } finally { setBusy(null); }
  };
  return <View>
    <View style={kit.card}><Text style={kit.cardTitle}>Filter Periode</Text><Text style={kit.cardSub}>Kinerja & Arus Kas mengikuti periode terpilih · Read-Only</Text></View>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 2, paddingRight: 12 }}>
      {months.slice().reverse().map((key) => { const on = mode === "month" && key === month; return <Pressable key={key} testID={`fin-period-chip-${key}`} accessibilityRole="button" onPress={() => { setMode("month"); setMonth(key); }} style={({ pressed }) => [{ flexShrink: 0, minHeight: 36, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, alignItems: "center", justifyContent: "center", backgroundColor: on ? colors.brandPrimary : colors.surfaceSecondary, borderColor: on ? colors.brandPrimary : colors.border }, pressed && { opacity: 0.85 }]}><Text style={{ fontSize: 11, fontWeight: "800", color: on ? colors.onBrandPrimary : colors.onSurfaceSecondary }}>{monthLabel(key)}</Text></Pressable>; })}
      <Pressable testID="fin-period-chip-custom" accessibilityRole="button" onPress={() => setMode("custom")} style={({ pressed }) => [{ flexShrink: 0, minHeight: 36, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, alignItems: "center", justifyContent: "center", backgroundColor: mode === "custom" ? colors.brandPrimary : colors.surfaceSecondary, borderColor: mode === "custom" ? colors.brandPrimary : colors.border }, pressed && { opacity: 0.85 }]}><Text style={{ fontSize: 11, fontWeight: "800", color: mode === "custom" ? colors.onBrandPrimary : colors.onSurfaceSecondary }}>Custom</Text></Pressable>
    </ScrollView>
    {mode === "custom" ? <View style={[kit.card, { marginTop: 8 }]}>
      <DateField label="Dari Tanggal" value={start} onChange={setStart} />
      <DateField label="Sampai Tanggal" value={end} onChange={setEnd} />
    </View> : null}

    <View style={[kit.card, { marginTop: 8 }]}><Text style={kit.cardTitle}>Kinerja · {periodLabel}</Text><Text style={kit.cardSub}>Sumber: order, pembelian & pengeluaran</Text></View>
    <StatRow label="Pendapatan" value={formatRupiah(metrics.omzet)} tone={colors.brand} />
    <StatRow label="HPP" value={formatRupiah(metrics.cogs)} />
    <StatRow label="Biaya channel" value={formatRupiah(metrics.channelFee)} />
    <StatRow label="Packaging" value={formatRupiah(metrics.packaging)} />
    <StatRow label="Pajak / PPh" value={formatRupiah(metrics.tax)} />
    <StatRow label="Pengeluaran" value={formatRupiah(metrics.expenses)} />
    <StatRow label="Total biaya" value={formatRupiah(biaya)} />
    <StatRow label="Laba bersih" value={formatRupiah(metrics.netProfit)} tone={metrics.netProfit >= 0 ? colors.success : colors.error} />

    <View style={[kit.card, { marginTop: 8 }]}><Text style={kit.cardTitle}>Arus Kas · {periodLabel}</Text><Text style={kit.cardSub}>Kas masuk − kas keluar</Text></View>
    <StatRow label="Kas masuk" value={formatRupiah(metrics.cashIn)} />
    <StatRow label="Kas keluar" value={formatRupiah(metrics.cashOut)} />
    <StatRow label="Arus kas bersih" value={formatRupiah(metrics.cashIn - metrics.cashOut)} tone={(metrics.cashIn - metrics.cashOut) >= 0 ? colors.success : colors.error} />

    <View style={[kit.card, { marginTop: 8 }]}><Text style={kit.cardTitle}>Ekspor Laporan</Text><Text style={kit.cardSub}>Laporan siap cetak/pengolahan · {periodLabel}</Text></View>
    <ExportBar formats={["pdf", "xlsx"]} onExport={runExport} busy={busy} note={note} />
  </View>;
}

function LaporanStok() {
  const kit = useKit(); const { colors } = useTheme(); const { data } = useBos();
  const monthKey = latestMonthKey(data);
  const statuses = productStatus(data, monthKey);
  const toneOf = (label: string) => (label === "Habis" || label === "Dead Stock" ? colors.error : label === "Hampir Habis" || label === "Slow Moving" ? colors.warning : colors.brand);
  const [busy, setBusy] = useState<ExportFormat | null>(null); const [note, setNote] = useState("");
  const runExport = async (format: ExportFormat) => {
    setNote(""); setBusy(format);
    try {
      const rows: (string | number)[][] = statuses.map((item) => [item.product.name, `${item.stock} pcs`, formatRupiah(item.stockValue), String(item.product.rop), item.availability, item.turnover]);
      await exportTable({ fileBase: `laporan-stok-${monthKey}`, title: "Laporan Stok", meta: [data.settings.shopName || "BOS", `Periode: ${monthLabel(monthKey)}`, `Dibuat: ${nowStamp()}`, `Nilai stok total ${formatRupiah(stockValueOf(data, monthKey))}`], headers: ["Produk", "Stok", "Nilai Stok", "ROP", "Ketersediaan", "Perputaran"], rows }, format);
      setNote(`Laporan Stok diekspor sebagai ${format === "pdf" ? "PDF" : "Excel"}.`);
    } catch { setNote("Gagal menyiapkan file ekspor. Coba lagi."); } finally { setBusy(null); }
  };
  return <View>
    <View style={kit.card}><Text style={kit.cardTitle}>Stok per produk · {monthLabel(monthKey)}</Text><Text style={kit.cardSub}>Nilai stok total {formatRupiah(stockValueOf(data, monthKey))}</Text></View>
    {statuses.map((item) => <View key={item.product.id} style={kit.row}>
      <View style={kit.rowCopy}><Text numberOfLines={1} style={kit.rowTitle}>{item.product.name}</Text><Text style={kit.rowSub}>{`${item.stock} pcs · ${formatRupiah(item.stockValue)} · ROP ${item.product.rop}`}</Text></View>
      <View style={{ alignItems: "flex-end", gap: 4 }}>
        <Pill label={item.availability} color={toneOf(item.availability)} />
        <Pill label={item.turnover} color={toneOf(item.turnover)} />
      </View>
    </View>)}

    <View style={[kit.card, { marginTop: 8 }]}><Text style={kit.cardTitle}>Ekspor Laporan</Text><Text style={kit.cardSub}>Laporan siap cetak/pengolahan · {monthLabel(monthKey)}</Text></View>
    <ExportBar formats={["pdf", "xlsx"]} onExport={runExport} busy={busy} note={note} />
  </View>;
}

function LabaReport() {
  const kit = useKit(); const { colors } = useTheme(); const { data } = useBos();
  const monthKey = latestMonthKey(data);
  const pe = profitForMonth(data, monthKey);
  const [feeOpen, setFeeOpen] = useState(false);
  // Rincian Biaya Channel per jenis, diagregasi dari komponen biaya channel tiap item
  // (mengikuti logic Profit Engine yang sama). Jumlah baris ini = pe.channelCostTotal persis.
  const feeByComponent: Record<string, number> = {};
  pe.perOrder.forEach((entry) => entry.items.forEach((item) => item.channelCosts.forEach((cost) => { feeByComponent[cost.component] = (feeByComponent[cost.component] ?? 0) + cost.amount; })));
  const canonicalFees = ["Admin", "Pesanan", "Ongkir XTRA", "Promo XTRA"];
  const otherFees = Object.keys(feeByComponent).filter((name) => !canonicalFees.includes(name)).sort();
  const feeRows = [...canonicalFees, ...otherFees].map((name) => ({ name, amount: feeByComponent[name] ?? 0 }));
  return <View>
    <View style={kit.card}><Text style={kit.cardTitle}>Ringkasan Laba · {monthLabel(monthKey)}</Text><Text style={kit.cardSub}>Sumber tunggal Profit Engine · hanya order Selesai</Text></View>
    <StatRow label="Nilai penjualan aktual" value={formatRupiah(pe.omzet)} />
    <Pressable testID="laba-biaya-channel" accessibilityRole="button" onPress={() => setFeeOpen(true)} style={({ pressed }) => [kit.row, pressed && { opacity: 0.85 }]}>
      <View style={kit.rowCopy}><Text style={kit.rowTitle}>− Biaya channel</Text><Text style={kit.rowSub}>Ketuk untuk lihat rincian per jenis</Text></View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
        <Text style={kit.rowValue}>{formatRupiah(pe.channelCostTotal)}</Text>
        <MaterialCommunityIcons name="chevron-right" size={18} color={colors.brand} />
      </View>
    </Pressable>
    <StatRow label="− Packaging" value={formatRupiah(pe.packaging)} />
    <StatRow label="− Pajak / PPh" value={formatRupiah(pe.tax)} />
    <StatRow label="− HPP (rata-rata bergerak)" value={formatRupiah(pe.hpp)} />
    <StatRow label="Laba transaksi" value={formatRupiah(pe.netProfitTransactions)} tone={pe.netProfitTransactions >= 0 ? colors.success : colors.error} />
    <StatRow label="− Biaya operasional" value={formatRupiah(pe.expenses)} />
    <StatRow label="Laba bersih bisnis" value={formatRupiah(pe.netProfitBusiness)} tone={pe.netProfitBusiness >= 0 ? colors.success : colors.error} />
    <View style={[kit.card, { marginTop: 8 }]}><Text style={kit.cardTitle}>Rincian per order</Text><Text style={kit.cardSub}>Dapat ditelusuri sampai tiap komponen item</Text></View>
    {pe.perOrder.length === 0 ? <EmptyState text="Belum ada order selesai pada periode ini." /> : pe.perOrder.map((entry) => <View key={entry.order.id} style={kit.card}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Text style={kit.rowTitle}>{entry.order.code || "Order"}</Text>
        <Text style={[kit.rowValue, { color: entry.netProfit >= 0 ? colors.success : colors.error }]}>{formatRupiah(entry.netProfit)}</Text>
      </View>
      <Text style={kit.cardSub}>{`${entry.order.date}${entry.estimated ? " · estimasi (konfigurasi biaya belum lengkap)" : ""}`}</Text>
      {entry.items.map((item, index) => { const product = data.products.find((candidate) => candidate.id === item.productId); return <View key={index} style={{ marginTop: 6, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 6 }}>
        <Text style={kit.rowSub}>{`${product?.name ?? item.productId} · ${item.effQty} pcs${item.qtyReturned ? ` (retur ${item.qtyReturned})` : ""}${item.sellerDiscountUnit ? ` · diskon ${formatRupiah(item.sellerDiscountUnit)}/unit` : ""}`}</Text>
        <Text style={kit.rowSub}>{`Jual ${formatRupiah(item.actualSellingValue)} − channel ${formatRupiah(item.channelCostTotal)} − pack ${formatRupiah(item.packaging)} − pajak ${formatRupiah(item.tax)} − HPP ${formatRupiah(item.hpp)} = ${formatRupiah(item.netProfit)}`}</Text>
      </View>; })}
    </View>)}
    <Sheet visible={feeOpen} title="Rincian Biaya Channel" onClose={() => setFeeOpen(false)}>
      <Text style={kit.cardSub}>{`Periode ${monthLabel(monthKey)} · dihitung dari transaksi order Selesai`}</Text>
      {feeRows.map((row) => <StatRow key={row.name} label={row.name} value={formatRupiah(row.amount)} />)}
      <View style={{ marginTop: 4 }}><StatRow label="Total Biaya Channel" value={formatRupiah(pe.channelCostTotal)} tone={colors.brand} /></View>
      <Text style={[kit.cardSub, { marginTop: 10 }]}>Komponen Biaya Channel yang ditampilkan terpisah pada Laba Bersih:</Text>
      <StatRow label="Packaging" value={formatRupiah(pe.packaging)} />
      <StatRow label="Pajak / PPh" value={formatRupiah(pe.tax)} />
    </Sheet>
  </View>;
}

const IMPORTABLE: { slug: string; label: string }[] = [
  { slug: "produk", label: "Produk" },
  { slug: "pelanggan", label: "Pelanggan" },
  { slug: "supplier", label: "Supplier" },
  { slug: "channel", label: "Channel Penjualan" },
  { slug: "akun-kas", label: "Akun Kas / Rekening" },
  { slug: "inventori", label: "Inventori" },
  { slug: "pembelian", label: "Pembelian" },
  { slug: "order", label: "Order" },
  { slug: "pengeluaran", label: "Pengeluaran" },
  { slug: "target", label: "Target" },
];

type ParsedRow = { raw: Record<string, any>; status: "Valid" | "Duplicate" | "Warning" | "Error"; issues: string[] };

// Normalisasi header untuk Pemetaan Kolom: cocokkan label field BOS ATAU key teknis tanpa
// terpengaruh huruf besar/kecil, spasi & tanda baca (mis. "HPP Awal / Unit" == "hppawalunit").
const normHeader = (value: string) => String(value ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");

// #17 Impor Data: pilih jenis data → unggah file (CSV/Excel) → pratinjau/pemetaan → validasi
// (Valid/Warning/Error) → konfirmasi. Hanya MENAMBAH baris valid ke master/source BOS yang ada;
// duplikat ditandai sebagai Warning dan tidak disimpan. JSON hanya dipakai Backup & Restore.
function ImportData() {
  const kit = useKit(); const { colors } = useTheme(); const { data, upsert } = useBos();
  const [slug, setSlug] = useState("");
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [imported, setImported] = useState("");
  const [downloading, setDownloading] = useState(false);
  const def = slug ? (moduleBySlug(slug) as CrudDef | undefined) : undefined;
  const requiredKeys = def ? def.fields.filter((field) => !field.optional && !field.system && field.type !== "multiselect" && field.type !== "lines" && field.type !== "toggle" && field.type !== "shipping").map((field) => field.key) : [];
  const numberKeys = def ? def.fields.filter((field) => field.type === "number").map((field) => field.key) : [];

  // Pemetaan Kolom: peta header file (label BOS ATAU key teknis) -> key field.
  const headerMap = useMemo(() => {
    const map = new Map<string, string>();
    if (def) def.fields.forEach((field) => { map.set(normHeader(field.label), field.key); map.set(normHeader(field.key), field.key); });
    map.set(normHeader("id"), "id");
    return map;
  }, [def]);

  const labelOfKey = (key: string) => def?.fields.find((field) => field.key === key)?.label ?? key;

  const validateRow = (rawInput: Record<string, any>): ParsedRow => {
    // 1) Pemetaan Kolom — remap header apa pun ke key field BOS.
    const raw: Record<string, any> = {};
    Object.keys(rawInput).forEach((header) => { const mapped = headerMap.get(normHeader(header)) ?? header; raw[mapped] = rawInput[header]; });

    const issues: string[] = []; let hasError = false; let hasWarning = false; let hasDuplicate = false;

    // 2) Resolusi pilihan (label -> value) & referensi master (nama -> id) agar tulis ke SSOT benar.
    (def?.fields ?? []).forEach((field) => {
      const value = raw[field.key];
      if (value === undefined || String(value).trim() === "") return;
      if (field.options && field.options.length) {
        const match = field.options.find((option) => normHeader(option.value) === normHeader(value) || normHeader(option.label) === normHeader(value));
        if (match) raw[field.key] = match.value;
        else { issues.push(`${field.label}: pilihan "${value}" tidak dikenal`); hasWarning = true; }
      } else if (field.from) {
        const list = (data[field.from] as { id: string; name?: string }[]) ?? [];
        const match = list.find((entry) => entry.id === String(value) || normHeader(entry.name ?? "") === normHeader(value));
        if (match) raw[field.key] = match.id;
        else { issues.push(`${field.label}: "${value}" tidak ditemukan di master`); hasWarning = true; raw[field.key] = ""; }
      }
    });

    // 3) Field wajib & format angka.
    requiredKeys.forEach((key) => { const value = raw[key]; if (value === undefined || value === null || String(value).trim() === "") { issues.push(`${labelOfKey(key)} kosong`); hasError = true; } });
    numberKeys.forEach((key) => { const value = raw[key]; if (value !== undefined && String(value).trim() !== "" && !Number.isFinite(Number(String(value).replace(/\./g, "").replace(/,/g, ".")))) { issues.push(`${labelOfKey(key)} bukan angka`); hasError = true; } });

    // 4) Deteksi Duplicate terhadap master (ditampilkan, tidak dihapus diam-diam).
    if (def && !hasError) {
      const dup = (message: string) => { issues.push(message); hasDuplicate = true; };
      if (slug === "produk" && raw.sku && data.products.some((product) => normHeader(product.sku || "") === normHeader(raw.sku))) dup("SKU sudah ada di master");
      if (slug === "supplier" && raw.name && data.suppliers.some((supplier) => normHeader(supplier.name) === normHeader(raw.name))) dup("Nama supplier sudah ada");
      if (slug === "channel" && raw.name && data.channels.some((channel) => normHeader(channel.name) === normHeader(raw.name))) dup("Nama channel sudah ada");
      if (slug === "akun-kas" && raw.name && data.accounts.some((account) => normHeader(account.name) === normHeader(raw.name))) dup("Nama akun sudah ada");
      if (slug === "pelanggan" && raw.phone && data.customers.some((customer) => (customer.phone || "").replace(/\D/g, "") === String(raw.phone).replace(/\D/g, ""))) dup("Nomor telepon sudah ada");
      if (raw.id && (data[def.collection] as { id: string }[]).some((entry) => entry.id === raw.id)) dup("ID sudah ada di master");
    }

    const status: ParsedRow["status"] = hasError ? "Error" : hasDuplicate ? "Duplicate" : hasWarning ? "Warning" : "Valid";
    return { raw, status, issues };
  };

  const parseCsv = (text: string): Record<string, any>[] => {
    const lines = text.trim().split(/\r?\n/).filter((line) => line.trim());
    if (lines.length === 0) return [];
    const headers = lines[0].split(",").map((header) => header.trim());
    return lines.slice(1).map((line) => { const cells = line.split(","); const obj: Record<string, any> = {}; headers.forEach((header, index) => { obj[header] = (cells[index] ?? "").trim(); }); return obj; });
  };

  const parseExcel = (buffer: ArrayBuffer): Record<string, any>[] => {
    const workbook = XLSX.read(buffer, { type: "array" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    if (!sheet) return [];
    return XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: "" });
  };

  const pickFile = async () => {
    setImported("");
    try {
      const res = await DocumentPicker.getDocumentAsync({ type: ["text/csv", "text/comma-separated-values", "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"], copyToCacheDirectory: true });
      if (res.canceled || !res.assets?.[0]) return;
      const asset = res.assets[0];
      const isExcel = /\.xlsx?$/i.test(asset.name);
      const parsed = isExcel ? parseExcel(await (await fetch(asset.uri)).arrayBuffer()) : parseCsv(await (await fetch(asset.uri)).text());
      setFileName(asset.name);
      setRows(parsed.map(validateRow));
    } catch { setRows([]); setFileName(""); setImported("Gagal membaca file · gunakan CSV atau Excel (.xlsx) yang valid"); }
  };

  const importable = rows.filter((row) => row.status === "Valid" || row.status === "Warning");
  const validCount = rows.filter((row) => row.status === "Valid").length;
  const duplicates = rows.filter((row) => row.status === "Duplicate").length;
  const errors = rows.filter((row) => row.status === "Error").length;
  const warnings = rows.filter((row) => row.status === "Warning").length;

  const downloadTemplate = async () => {
    if (!def) return;
    setImported(""); setDownloading(true);
    try { await downloadImportTemplate(def, data); setImported(`Template ${def.title} (.xlsx) diunduh. Isi kolom sesuai Petunjuk, lalu unggah kembali di sini.`); }
    catch { setImported("Gagal membuat template. Coba lagi."); }
    finally { setDownloading(false); }
  };

  const confirmImport = () => {
    if (!def) return;
    let count = 0;
    let skuInc = maxSkuNumber(data); let plgInc = maxPlgNumber(data);
    importable.forEach((row) => {
      const item: Record<string, any> = { id: row.raw.id || newId(def.idPrefix), ...def.blank, ...row.raw };
      numberKeys.forEach((key) => { if (item[key] !== undefined && String(item[key]).trim() !== "") item[key] = Number(String(item[key]).replace(/\./g, "").replace(/,/g, ".")) || 0; });
      // SKU Produk & ID Pelanggan tetap dibuat otomatis meski via impor (unik & permanen, tanpa input manual).
      if (def.collection === "products" && !String(item.sku ?? "").trim()) { skuInc += 1; item.sku = formatSku(skuInc); }
      if (def.collection === "customers" && !String(row.raw.id ?? "").trim()) { plgInc += 1; item.id = formatPlg(plgInc); }
      upsert(def.collection, item as never, String(item.name ?? item.code ?? item.sku ?? "Import"));
      count += 1;
    });
    setRows([]); setFileName("");
    setImported(`${count} data ditambahkan ke ${def.title}. KPI, Analytics & laporan dihitung ulang otomatis.`);
  };

  const toneOf = (status: ParsedRow["status"]) => (status === "Error" ? colors.error : status === "Duplicate" ? colors.info : status === "Warning" ? colors.warning : colors.success);

  return <View>
    <View style={kit.card}><Text style={kit.cardTitle}>1 · Pilih Jenis Data</Text><Text style={kit.cardSub}>Impor menambahkan data baru dan mendeteksi data duplikat sebelum disimpan.</Text></View>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 2, paddingRight: 12 }}>
      {IMPORTABLE.map((option) => { const on = slug === option.slug; return <Pressable key={option.slug} testID={`import-type-${option.slug}`} accessibilityRole="button" onPress={() => { setSlug(option.slug); setRows([]); setFileName(""); setImported(""); }} style={({ pressed }) => [{ flexShrink: 0, minHeight: 36, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, alignItems: "center", justifyContent: "center", backgroundColor: on ? colors.brandPrimary : colors.surfaceSecondary, borderColor: on ? colors.brandPrimary : colors.border }, pressed && { opacity: 0.85 }]}><Text style={{ fontSize: 11, fontWeight: "800", color: on ? colors.onBrandPrimary : colors.onSurfaceSecondary }}>{option.label}</Text></Pressable>; })}
    </ScrollView>

    <View style={[kit.card, { marginTop: 8 }]}><Text style={kit.cardTitle}>2 · Download Template</Text><Text style={kit.cardSub}>Unduh template Excel (.xlsx) sesuai field BOS: nama kolom, penanda Wajib/Optional, format & 1 baris contoh (lihat sheet Petunjuk). Template hanya panduan — tidak memasukkan data contoh ke BOS.</Text></View>
    <Pressable testID="import-download-template" accessibilityRole="button" disabled={!slug || downloading} onPress={downloadTemplate} style={({ pressed }) => [kit.ghostButton, { flexDirection: "row", gap: 8, minHeight: 46 }, (!slug || downloading) && { opacity: 0.4 }, pressed && slug && !downloading && { opacity: 0.85 }]}>
      <MaterialCommunityIcons name="file-excel-box" size={18} color={colors.brand} />
      <Text style={[kit.ghostText, { color: colors.brand }]}>{downloading ? "Menyiapkan template..." : def ? `Download Template ${def.title} (.xlsx)` : "Download Template (.xlsx)"}</Text>
    </Pressable>

    <View style={[kit.card, { marginTop: 10 }]}><Text style={kit.cardTitle}>3 · Unggah File</Text><Text style={kit.cardSub}>Format CSV atau Excel (.xlsx). Kolom dipetakan otomatis dari nama field BOS (label atau key).</Text></View>
    <Pressable testID="import-pick-file" accessibilityRole="button" disabled={!slug} onPress={pickFile} style={({ pressed }) => [kit.primaryButton, !slug && { opacity: 0.4 }, pressed && slug && { opacity: 0.85 }]}><Text style={kit.primaryText}>{fileName ? `File: ${fileName}` : "Pilih File"}</Text></Pressable>

    {rows.length > 0 ? <View>
      <View style={[kit.card, { marginTop: 10 }]}><Text style={kit.cardTitle}>4 · Pratinjau, Pemetaan & Validasi</Text><Text style={kit.cardSub}>{`${rows.length} baris · ${validCount} valid · ${duplicates} duplicate · ${warnings} warning · ${errors} error`}</Text><Text style={[kit.cardSub, { marginTop: 2 }]}>Baris Error & Duplicate tidak ikut diimpor dan tetap ditampilkan di bawah.</Text></View>
      {rows.slice(0, 30).map((row, index) => <View key={index} style={kit.row}>
        <View style={kit.rowCopy}><Text numberOfLines={1} style={kit.rowTitle}>{String(row.raw.name ?? row.raw.code ?? row.raw.sku ?? `Baris ${index + 1}`)}</Text><Text numberOfLines={1} style={kit.rowSub}>{row.issues.length ? row.issues.join(" · ") : "Siap diimpor"}</Text></View>
        <Pill label={row.status} color={toneOf(row.status)} />
      </View>)}
      {rows.length > 30 ? <Text style={[kit.cardSub, { textAlign: "center", marginVertical: 6 }]}>{`+${rows.length - 30} baris lainnya`}</Text> : null}
      <Pressable testID="import-confirm" accessibilityRole="button" disabled={importable.length === 0} onPress={confirmImport} style={({ pressed }) => [kit.primaryButton, { marginTop: 10 }, importable.length === 0 && { opacity: 0.4 }, pressed && importable.length > 0 && { opacity: 0.85 }]}><Text style={kit.primaryText}>{`Konfirmasi Impor ${importable.length} Data`}</Text></Pressable>
    </View> : null}
    {imported ? <Text testID="import-done" style={[kit.cardSub, { textAlign: "center", marginTop: 8 }]}>{imported}</Text> : null}
  </View>;
}

// Bar tombol ekspor dipakai ulang di modul Ekspor Data & ketiga Laporan. Setiap tombol
// hanya memformat payload yang sudah dihitung dari SSOT; tidak menyentuh/menyalin data.
function ExportBar({ formats, onExport, busy, note }: { formats: ExportFormat[]; onExport: (format: ExportFormat) => void; busy: ExportFormat | null; note?: string }) {
  const kit = useKit(); const { colors } = useTheme();
  const labelOf = (format: ExportFormat) => (format === "pdf" ? "PDF" : format === "xlsx" ? "Excel (.xlsx)" : "CSV");
  const iconOf = (format: ExportFormat) => (format === "pdf" ? "file-pdf-box" : format === "xlsx" ? "file-excel-box" : "file-delimited-outline");
  return <View>
    <View style={kit.buttonRow}>
      {formats.map((format) => <Pressable key={format} testID={`export-${format}`} accessibilityRole="button" disabled={busy !== null} onPress={() => onExport(format)} style={({ pressed }) => [kit.ghostButton, { flexDirection: "row", gap: 6 }, busy !== null && { opacity: 0.5 }, pressed && busy === null && { opacity: 0.85 }]}>
        <MaterialCommunityIcons name={iconOf(format) as never} size={16} color={colors.brand} />
        <Text style={kit.ghostText}>{busy === format ? "Menyiapkan…" : labelOf(format)}</Text>
      </Pressable>)}
    </View>
    {note ? <Text style={[kit.cardSub, { textAlign: "center", marginTop: 8 }]}>{note}</Text> : null}
  </View>;
}

// Ekspor Data: pilih jenis data (dinamis) → periode (untuk data bertanggal) → format → ekspor.
// Membaca langsung data[def.collection] + kolom dari FieldDef & nilai turunan rowValue (engine BOS).
function ExportData() {
  const kit = useKit(); const { colors } = useTheme(); const { data } = useBos();
  const [slug, setSlug] = useState("");
  const [busy, setBusy] = useState<ExportFormat | null>(null);
  const [note, setNote] = useState("");
  const def = slug ? (moduleBySlug(slug) as CrudDef | undefined) : undefined;

  const dateField = def?.fields.find((field) => field.type === "date");
  const monthField = def?.fields.find((field) => field.type === "month");
  const dated = !!(dateField || monthField);

  const records = def ? ((data[def.collection] as Record<string, any>[]) ?? []) : [];
  const monthsOf = (): string[] => {
    if (!def) return [];
    const keys = new Set<string>();
    records.forEach((item) => {
      const value = monthField ? String(item[monthField.key] ?? "") : String(item[dateField!.key] ?? "").slice(0, 7);
      if (value) keys.add(value);
    });
    return Array.from(keys).sort();
  };
  const months = dated ? monthsOf() : [];
  const [period, setPeriod] = useState<string>("all"); // "all" | monthKey

  const nameFrom = (collection: CollectionKey | undefined, id: any) => {
    if (!collection || !id) return id ?? "";
    const found = (data[collection] as { id: string; name?: string }[] | undefined)?.find((entry) => entry.id === id);
    return found?.name ?? String(id);
  };
  const valueForField = (item: Record<string, any>, field: FieldDef): string => {
    const raw = item[field.key];
    if (field.type === "lines") { const arr = Array.isArray(raw) ? raw : []; return `${arr.length} item`; }
    if (field.type === "multiselect") { const ids = Array.isArray(raw) ? raw : []; return ids.map((id) => nameFrom(field.from, id)).join(", "); }
    if (field.type === "select" && field.from) return nameFrom(field.from, raw);
    if (field.type === "select" && field.options) return field.options.find((option) => option.value === raw)?.label ?? String(raw ?? "");
    if (field.type === "month") return raw ? monthLabel(String(raw)) : "";
    if (field.money) return formatRupiah(Number(raw) || 0);
    if (raw === undefined || raw === null) return "";
    return String(raw);
  };

  const filtered = (): Record<string, any>[] => {
    if (!dated || period === "all") return records;
    return records.filter((item) => {
      const value = monthField ? String(item[monthField.key] ?? "") : String(item[dateField!.key] ?? "").slice(0, 7);
      return value === period;
    });
  };

  const periodLabel = !dated ? "Semua data" : period === "all" ? "Semua periode" : monthLabel(period);

  const runExport = async (format: ExportFormat) => {
    if (!def) return;
    setNote(""); setBusy(format);
    try {
      const rows = filtered();
      const headers = ["ID", ...def.fields.map((field) => field.label), ...(def.rowValue ? ["Ringkasan"] : [])];
      const body = rows.map((item) => [
        String(item.id ?? ""),
        ...def.fields.map((field) => valueForField(item, field)),
        ...(def.rowValue ? [def.rowValue(item, data)] : []),
      ]);
      const periodSlug = !dated || period === "all" ? "semua" : period;
      await exportTable({
        fileBase: `${slug}-${periodSlug}`,
        title: `Ekspor ${def.title}`,
        meta: [data.settings.shopName || "BOS", `Periode: ${periodLabel}`, `Dibuat: ${nowStamp()}`, `${body.length} baris`],
        headers,
        rows: body,
      }, format);
      setNote(`${body.length} baris ${def.title} diekspor sebagai ${format === "pdf" ? "PDF" : format === "xlsx" ? "Excel" : "CSV"}. Data sumber tidak berubah.`);
    } catch {
      setNote("Gagal menyiapkan file ekspor. Coba lagi.");
    } finally {
      setBusy(null);
    }
  };

  return <View>
    <View style={kit.card}><Text style={kit.cardTitle}>1 · Pilih Jenis Data</Text><Text style={kit.cardSub}>Ekspor membaca data & perhitungan BOS yang ada — tanpa membuat data baru.</Text></View>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 2, paddingRight: 12 }}>
      {IMPORTABLE.map((option) => { const on = slug === option.slug; return <Pressable key={option.slug} testID={`export-type-${option.slug}`} accessibilityRole="button" onPress={() => { setSlug(option.slug); setPeriod("all"); setNote(""); }} style={({ pressed }) => [{ flexShrink: 0, minHeight: 36, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, alignItems: "center", justifyContent: "center", backgroundColor: on ? colors.brandPrimary : colors.surfaceSecondary, borderColor: on ? colors.brandPrimary : colors.border }, pressed && { opacity: 0.85 }]}><Text style={{ fontSize: 11, fontWeight: "800", color: on ? colors.onBrandPrimary : colors.onSurfaceSecondary }}>{option.label}</Text></Pressable>; })}
    </ScrollView>

    {slug && dated ? <View>
      <View style={[kit.card, { marginTop: 8 }]}><Text style={kit.cardTitle}>2 · Periode</Text><Text style={kit.cardSub}>Data bertanggal · pilih bulan atau seluruh periode</Text></View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 2, paddingRight: 12 }}>
        {["all", ...months.slice().reverse()].map((key) => { const on = key === period; return <Pressable key={key} testID={`export-period-${key}`} accessibilityRole="button" onPress={() => setPeriod(key)} style={({ pressed }) => [{ flexShrink: 0, minHeight: 36, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, alignItems: "center", justifyContent: "center", backgroundColor: on ? colors.brandPrimary : colors.surfaceSecondary, borderColor: on ? colors.brandPrimary : colors.border }, pressed && { opacity: 0.85 }]}><Text style={{ fontSize: 11, fontWeight: "800", color: on ? colors.onBrandPrimary : colors.onSurfaceSecondary }}>{key === "all" ? "Semua Periode" : monthLabel(key)}</Text></Pressable>; })}
      </ScrollView>
    </View> : null}

    {slug ? <View>
      <View style={[kit.card, { marginTop: 8 }]}><Text style={kit.cardTitle}>{dated ? "3" : "2"} · Format & Ekspor</Text><Text style={kit.cardSub}>{`${filtered().length} baris · ${periodLabel}. PDF untuk arsip/cetak · Excel & CSV untuk pengolahan data.`}</Text></View>
      <ExportBar formats={["pdf", "xlsx", "csv"]} onExport={runExport} busy={busy} note={note} />
    </View> : <Text style={[kit.cardSub, { textAlign: "center", marginTop: 8 }]}>Pilih jenis data untuk mulai mengekspor.</Text>}
  </View>;
}

function DataQuality() {
  const kit = useKit(); const { colors } = useTheme(); const router = useRouter(); const { data } = useBos();
  const issues = dataQualityIssues(data);
  const problems = issues.filter((issue) => issue.severity === "Tinggi").length;
  const warns = issues.length - problems;
  const toneOf = (severity: string) => (severity === "Tinggi" ? colors.error : severity === "Sedang" ? colors.warning : colors.brand);
  return <View>
    <View style={kit.card}><Text style={kit.cardTitle}>{issues.length === 0 ? "Data bersih" : `${issues.length} temuan`}</Text><Text style={kit.cardSub}>{issues.length === 0 ? "Read-Only · deteksi otomatis masalah & warning data" : `${problems} masalah · ${warns} warning · read-only, ketuk untuk ke data sumber`}</Text></View>
    {issues.length === 0 ? <EmptyState text="Tidak ada masalah kualitas data." /> : issues.map((issue) => <Pressable key={issue.id} accessibilityRole="button" onPress={() => router.push(issue.module as never)} style={({ pressed }) => [kit.row, pressed && { opacity: 0.85 }]}>
      <View style={kit.rowBubble}><MaterialCommunityIcons name="alert-outline" size={16} color={toneOf(issue.severity)} /></View>
      <View style={kit.rowCopy}><Text numberOfLines={1} style={kit.rowTitle}>{issue.title}</Text><Text numberOfLines={1} style={kit.rowSub}>{issue.detail}</Text></View>
      <Pill label={issue.severity} color={toneOf(issue.severity)} />
    </Pressable>)}
  </View>;
}

// #19 Backup & Restore user-friendly: buat backup (file/salinan + waktu & ringkasan) dan
// pulihkan (pilih backup → pratinjau → konfirmasi → replace). JSON internal, tanpa tempel JSON.
function BackupRestore() {
  const kit = useKit(); const { colors } = useTheme(); const { data, replaceAll } = useBos();
  const [backups, setBackups] = useState<BackupEntry[]>([]);
  const [restoring, setRestoring] = useState<BackupEntry | null>(null);
  const [pendingDelete, setPendingDelete] = useState<BackupEntry | null>(null);
  const [done, setDone] = useState("");
  useEffect(() => { listBackups().then(setBackups); }, []);
  const makeBackup = async () => { const next = await createBackup(data); setBackups(next); setDone("Backup dibuat · salinan data tersimpan di perangkat"); };
  const fmt = (iso: string) => toDisplayDate(iso.slice(0, 10)) + " " + iso.slice(11, 16);
  return <View>
    <View style={kit.card}><Text style={kit.cardTitle}>Data saat ini</Text><Text style={kit.cardSub}>{backupSummary(data)}</Text></View>
    <Pressable testID="create-backup" accessibilityRole="button" onPress={makeBackup} style={({ pressed }) => [kit.primaryButton, pressed && kit.primaryButtonPressed]}><Text style={kit.primaryText}>Buat Backup Sekarang</Text></Pressable>

    <View style={[kit.card, { marginTop: 10 }]}><Text style={kit.cardTitle}>{`Daftar Backup · ${backups.length}`}</Text><Text style={kit.cardSub}>Pilih backup untuk memulihkan. Restore mengganti seluruh data saat ini.</Text></View>
    {backups.length === 0 ? <EmptyState text="Belum ada backup. Buat backup pertama Anda." /> : backups.map((entry) => <View key={entry.id} style={kit.row}>
      <View style={kit.rowBubble}><MaterialCommunityIcons name="cloud-check-outline" size={16} color={colors.brand} /></View>
      <View style={kit.rowCopy}><Text style={kit.rowTitle}>{fmt(entry.at)}</Text><Text numberOfLines={1} style={kit.rowSub}>{entry.summary}</Text></View>
      <Pressable testID={`restore-${entry.id}`} accessibilityRole="button" onPress={() => setRestoring(entry)} style={kit.rowAction}><MaterialCommunityIcons name="backup-restore" size={18} color={colors.brand} /></Pressable>
      <Pressable testID={`delete-backup-${entry.id}`} accessibilityRole="button" onPress={() => setPendingDelete(entry)} style={kit.rowAction}><MaterialCommunityIcons name="trash-can-outline" size={17} color={colors.error} /></Pressable>
    </View>)}
    {done ? <Text testID="backup-done" style={[kit.cardSub, { textAlign: "center", marginTop: 8 }]}>{done}</Text> : null}

    <ConfirmSheet visible={!!restoring} title="Pulihkan backup ini?" confirmLabel="Pulihkan"
      message={restoring ? `Pratinjau: ${restoring.summary} (${fmt(restoring.at)}). Seluruh data saat ini akan diganti dengan isi backup, lalu KPI, Analytics, Laporan, Alert, Action & Profit Engine dihitung ulang.` : ""}
      onCancel={() => setRestoring(null)} onConfirm={() => { if (restoring) { replaceAll(restoring.data); setDone("Restore selesai · seluruh perhitungan dihitung ulang dari backup"); } setRestoring(null); }} />
    <ConfirmSheet visible={!!pendingDelete} title="Hapus backup?" destructive confirmLabel="Hapus"
      message={pendingDelete ? `Backup ${fmt(pendingDelete.at)} akan dihapus.` : ""}
      onCancel={() => setPendingDelete(null)} onConfirm={async () => { if (pendingDelete) setBackups(await deleteBackup(pendingDelete.id)); setPendingDelete(null); }} />
  </View>;
}

function Pengaturan() {
  const kit = useKit(); const { data, patchSettings } = useBos();
  return <View style={kit.card}>
    <Field label="Nama Toko" value={data.settings.shopName} onChangeText={(value) => patchSettings({ shopName: value })} />
    <Field label="Nama Pemilik" value={data.settings.ownerName} onChangeText={(value) => patchSettings({ ownerName: value })} />
    <Field label="Mata Uang" value={data.settings.currency} onChangeText={(value) => patchSettings({ currency: value })} />
  </View>;
}

// Pengaturan Tema: pilihan Terang / Gelap / Sistem. Preferensi tersimpan persisten
// di perangkat (bos.theme.v1) dan berlaku global ke seluruh halaman lewat useTheme().
const THEME_OPTIONS: { value: ThemePreference; label: string; desc: string; icon: IconName }[] = [
  { value: "light", label: "Terang", desc: "Tampilan terang yang nyaman di siang hari", icon: "white-balance-sunny" },
  { value: "dark", label: "Gelap", desc: "Tampilan gelap, default BOS", icon: "moon-waning-crescent" },
  { value: "system", label: "Sistem", desc: "Mengikuti tema perangkat secara otomatis", icon: "cellphone-cog" },
];

function PengaturanTema() {
  const kit = useKit(); const { colors, scheme } = useTheme();
  const preference = useThemePreference();
  const activeLabel = scheme === "dark" ? "Gelap" : "Terang";
  return <View>
    <View style={kit.card}>
      <Text style={kit.cardTitle}>Tema Tampilan</Text>
      <Text style={kit.cardSub}>Berlaku ke seluruh halaman, kartu, grafik & navigasi · tersimpan di perangkat</Text>
      <View style={{ marginTop: 10 }}>
        {THEME_OPTIONS.map((option) => {
          const active = preference === option.value;
          return <Pressable key={option.value} testID={`theme-option-${option.value}`} accessibilityRole="button" accessibilityState={{ selected: active }} onPress={() => setThemePreference(option.value)}
            style={({ pressed }) => [kit.optionRow, { borderWidth: 1, borderColor: active ? colors.brand : "transparent", backgroundColor: active ? colors.brandTertiary : colors.surfaceTertiary }, pressed && { opacity: 0.8 }]}>
            <View style={{ flexDirection: "row", alignItems: "center", flex: 1, gap: 10 }}>
              <MaterialCommunityIcons name={option.icon} size={20} color={active ? colors.brand : colors.onSurfaceTertiary} />
              <View style={{ flex: 1 }}>
                <Text style={[kit.optionText, active && { color: colors.brand, fontWeight: "800" }]}>{option.label}</Text>
                <Text style={kit.cardSub}>{option.desc}</Text>
              </View>
            </View>
            <MaterialCommunityIcons name={active ? "radiobox-marked" : "radiobox-blank"} size={20} color={active ? colors.brand : colors.onSurfaceTertiary} />
          </Pressable>;
        })}
      </View>
    </View>
    <View style={kit.card}>
      <Text style={kit.cardTitle}>Mode Aktif</Text>
      <Text testID="theme-active-mode" style={kit.cardSub}>
        {preference === "system" ? `${activeLabel} · mengikuti tema perangkat` : `${activeLabel} · dipilih manual`}
      </Text>
    </View>
  </View>;
}

function Notifikasi() {
  const kit = useKit(); const { data, patchSettings } = useBos();
  return <View style={kit.card}>
    <ToggleField label="Pemberitahuan alert baru" value={data.settings.notifyAlert} onChange={(value) => patchSettings({ notifyAlert: value })} />
    <ToggleField label="Ringkasan harian" value={data.settings.notifyDailySummary} onChange={(value) => patchSettings({ notifyDailySummary: value })} />
    <ToggleField label="Laporan mingguan" value={data.settings.notifyWeeklyReport} onChange={(value) => patchSettings({ notifyWeeklyReport: value })} />
    <Text style={kit.cardSub}>Pilihan ini disimpan di perangkat dan dipakai saat pengiriman notifikasi diaktifkan.</Text>
  </View>;
}

function AuditLog() {
  const kit = useKit(); const { colors } = useTheme(); const { data, clearAudit } = useBos();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const doClear = () => { clearAudit(); setConfirmOpen(false); };
  return <View>
    {data.audit.length === 0 ? <EmptyState text="Belum ada perubahan data." /> : data.audit.map((entry) => <View key={entry.id} style={kit.row}>
      <View style={kit.rowCopy}><Text style={kit.rowTitle}>{`${entry.action} · ${entry.label}`}</Text><Text style={kit.rowSub}>{`${entry.entity} · ${entry.at.slice(0, 16).replace("T", " ")}`}</Text></View>
    </View>)}
    {data.audit.length > 0 ? <Pressable testID="audit-clear-button" accessibilityRole="button" onPress={() => setConfirmOpen(true)} style={({ pressed }) => [kit.ghostButton, { marginTop: 8, flexDirection: "row", gap: 6 }, pressed && { opacity: 0.85 }]}>
      <MaterialCommunityIcons name="delete-sweep-outline" size={16} color={colors.error} />
      <Text style={kit.dangerText}>Hapus Riwayat Log</Text>
    </Pressable> : null}
    <ConfirmSheet visible={confirmOpen} title="Hapus Riwayat Log?" message={`${data.audit.length} catatan riwayat akan dihapus permanen dan tidak dapat dipulihkan. Hanya riwayat log yang dihapus — data operasional & konfigurasi BOS tetap aman. Audit Log tetap aktif dan mencatat aktivitas baru setelahnya.`} confirmLabel="Hapus Riwayat" destructive onCancel={() => setConfirmOpen(false)} onConfirm={doClear} />
  </View>;
}

// Reset Data (testing): the user picks which operational modules to reset from a checklist
// (all unchecked by default). Only DATA RECORDS are cleared — the modules, business config
// and Audit Log stay intact. Confirmation is required after selecting and tapping Reset.
const RESET_MODULES: { key: CollectionKey; label: string }[] = [
  { key: "orders", label: "Order" },
  { key: "products", label: "Produk" },
  { key: "adjustments", label: "Inventori" },
  { key: "purchases", label: "Pembelian" },
  { key: "suppliers", label: "Supplier" },
  { key: "customers", label: "Pelanggan" },
  { key: "channels", label: "Channel Penjualan" },
  { key: "channelCosts", label: "Biaya Channel" },
  { key: "expenses", label: "Pengeluaran" },
  { key: "accounts", label: "Akun Kas / Rekening" },
  { key: "targets", label: "Target" },
];

function ResetData() {
  const kit = useKit(); const { colors } = useTheme(); const { data, resetData } = useBos();
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [confirming, setConfirming] = useState(false);
  const [done, setDone] = useState(false);
  const countOf = (key: CollectionKey) => ((data[key] as unknown[] | undefined) ?? []).length;
  const toggle = (key: string) => { setDone(false); setSelected((current) => ({ ...current, [key]: !current[key] })); };
  const chosen = RESET_MODULES.filter((item) => selected[item.key]);
  const allOn = chosen.length === RESET_MODULES.length;
  const toggleAll = () => { setDone(false); setSelected(allOn ? {} : Object.fromEntries(RESET_MODULES.map((item) => [item.key, true]))); };
  return <View>
    <View style={kit.card}><Text style={kit.cardTitle}>Reset Data untuk Testing</Text><Text style={kit.cardSub}>Pilih modul yang ingin direset. Hanya catatan data yang dihapus — Parameter Bisnis, Threshold, Business Rules, Laporan, Import, Data Quality, Backup, Pengaturan, Notifikasi & Audit Log tetap ada. Seluruh KPI, tren Analytics, Alert/Action, Profit Engine & Health Score dihitung ulang dari data tersisa.</Text></View>
    <View style={kit.card}>
      <Pressable testID="reset-select-all" accessibilityRole="checkbox" accessibilityState={{ checked: allOn }} onPress={toggleAll} style={({ pressed }) => [kit.row, pressed && { opacity: 0.85 }]}>
        <MaterialCommunityIcons name={allOn ? "checkbox-marked" : "checkbox-blank-outline"} size={22} color={allOn ? colors.brand : colors.onSurfaceTertiary} />
        <View style={[kit.rowCopy, { marginLeft: 10 }]}><Text style={kit.rowTitle}>Pilih semua data operasional</Text></View>
      </Pressable>
      {RESET_MODULES.map((item) => { const on = !!selected[item.key]; return <Pressable key={item.key} testID={`reset-select-${item.key}`} accessibilityRole="checkbox" accessibilityState={{ checked: on }} onPress={() => toggle(item.key)} style={({ pressed }) => [kit.row, pressed && { opacity: 0.85 }]}>
      <MaterialCommunityIcons name={on ? "checkbox-marked" : "checkbox-blank-outline"} size={22} color={on ? colors.brand : colors.onSurfaceTertiary} />
      <View style={[kit.rowCopy, { marginLeft: 10 }]}><Text style={kit.rowTitle}>{item.label}</Text></View>
      <Text style={{ color: colors.onSurfaceTertiary, fontSize: 10, fontWeight: "700" }}>{`${countOf(item.key)} data`}</Text>
    </Pressable>; })}</View>
    <Pressable testID="reset-data-button" accessibilityRole="button" disabled={chosen.length === 0} onPress={() => { setDone(false); setConfirming(true); }} style={({ pressed }) => [kit.ghostButton, { marginTop: 10 }, chosen.length === 0 && { opacity: 0.4 }, pressed && chosen.length > 0 && { opacity: 0.85 }]}><Text style={kit.dangerText}>{chosen.length === 0 ? "Pilih modul untuk direset" : `Reset ${chosen.length} Modul Terpilih`}</Text></Pressable>
    {done ? <Text testID="reset-data-done" style={[kit.cardSub, { textAlign: "center", marginTop: 8 }]}>Data berhasil direset · KPI, seluruh tren Analytics, Alert, Action, Profit Engine, Health Score & laporan kini dihitung ulang dari data tersisa</Text> : null}
    <ConfirmSheet visible={confirming} title="Reset data terpilih?" destructive confirmLabel="Reset"
      message={`Catatan data pada modul berikut akan dihapus: ${chosen.map((item) => item.label).join(", ")}. Tindakan ini tidak dapat dibatalkan.`}
      onCancel={() => setConfirming(false)} onConfirm={() => { resetData(chosen.map((item) => item.key)); setConfirming(false); setSelected({}); setDone(true); }} />
  </View>;
}
