import { useMemo, useState } from "react";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { ThemedStatusBar } from "@/src/components/ui-kit";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { financeAnalytics } from "@/src/data/calc";
import { MultiTrend, SectionIcon } from "@/src/components/analytics-charts";
import { PeriodPicker } from "@/src/components/period-picker";
import { useAnalyticsMonth } from "@/src/hooks/useAnalyticsMonth";
import { makeStyles, ThemeColors, useTheme, fontSans, fontSansHeavy } from "@/src/theme";
import {
  Pressable,
  ScrollView,
  useWindowDimensions,
  View,
} from "react-native";
import { Text } from "@/src/components/text";

type FinanceKpi = ReturnType<typeof financeAnalytics>["kpis"][number];

// Shell styles mirror the other Analytics tabs exactly (header, tabs, period bar, card,
// section header, bottom nav); only the Keuangan sections add their own compact styles.
const useStyles = makeStyles((palette) => ({
  root: { flex: 1, backgroundColor: palette.surface },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 12, paddingBottom: 0, flexGrow: 1 },
  header: { paddingTop: 0, paddingBottom: 4 },
  brandRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  eyebrow: { color: palette.brand, fontSize: 9, fontWeight: "800", letterSpacing: 1.2, textTransform: "uppercase", marginTop: 0 },
  title: { color: palette.onSurface, fontSize: 22, fontWeight: "800", letterSpacing: -0.6, marginTop: 2 },
  subtitle: { color: palette.onSurfaceSecondary, fontSize: 10, marginTop: 1 },
  topIcon: { width: 34, height: 34, borderRadius: 11, backgroundColor: palette.surfaceSecondary, borderWidth: 1, borderColor: palette.border, alignItems: "center", justifyContent: "center" },
  tabs: { flexDirection: "row", gap: 5, marginTop: 6 },
  tab: { flex: 1, minHeight: 31, borderRadius: 10, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.surfaceSecondary, alignItems: "center", justifyContent: "center" },
  tabActive: { backgroundColor: palette.brandPrimary, borderColor: palette.brandPrimary },
  tabText: { color: palette.onSurfaceSecondary, fontSize: 9, fontWeight: "700" },
  tabTextActive: { color: palette.onBrandPrimary },
  periodWrap: { position: "relative" },
  periodBar: { minHeight: 39, borderRadius: 12, backgroundColor: palette.surfaceSecondary, borderWidth: 1, borderColor: palette.border, paddingHorizontal: 10, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  periodCopy: { flex: 1, marginLeft: 8 },
  periodValue: { color: palette.onSurface, fontSize: 13, fontWeight: "800", marginTop: 1 },
  sectionGap: { marginTop: 10 },
  sectionGapTight: { marginTop: 3 },
  sectionsWrap: {},
  card: { position: "relative", backgroundColor: palette.surfaceSecondary, borderRadius: 14, borderWidth: 1, borderColor: palette.border, padding: 11 },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sectionTitleWrap: { flex: 1, marginLeft: 7 },
  sectionTitle: { color: palette.onSurface, fontSize: 14, fontWeight: "800", letterSpacing: -0.1 },
  sectionSub: { color: palette.onSurfaceTertiary, fontSize: 10, marginTop: 2 },
  // Tinggi card Tren Arus Kas dikunci (dikurangi 20px) agar tidak mengikuti isi grafik.
  cashCard: { height: 212, overflow: "hidden" },
  nav: { position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: palette.surfaceSecondary, borderTopWidth: 1, borderTopColor: palette.border, flexDirection: "row", justifyContent: "space-around", paddingTop: 5 },
  navItem: { minWidth: 50, minHeight: 40, alignItems: "center", justifyContent: "center" },
  navLabel: { color: palette.onSurfaceTertiary, fontSize: 8, marginTop: 1, fontFamily: fontSans },
  navLabelActive: { color: palette.brand, fontFamily: fontSansHeavy },

  // KPI Keuangan: one compact row of four tiles with month-over-month change.
  kpiGrid: { marginTop: 8, flexDirection: "row", justifyContent: "space-between" },
  kpiTile: { width: "24.3%", backgroundColor: palette.surfaceTertiary, borderRadius: 9, paddingHorizontal: 6, paddingVertical: 6 },
  kpiLabelRow: { flexDirection: "row", alignItems: "center" },
  kpiLabel: { color: palette.onSurfaceTertiary, fontSize: 8, marginLeft: 3, flex: 1 },
  kpiValue: { color: palette.onSurface, fontSize: 13, fontWeight: "800", marginTop: 2, letterSpacing: -0.3 },
  kpiUnit: { color: palette.onSurfaceTertiary, fontSize: 8, fontWeight: "700" },
  kpiTrendRow: { flexDirection: "row", alignItems: "center", marginTop: 2 },
  kpiTrendText: { fontSize: 9, fontWeight: "800", marginLeft: 2 },

  // Chart legends.
  chartLegend: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", columnGap: 12, rowGap: 4, marginTop: 6 },
  legendItem: { flexDirection: "row", alignItems: "center" },
  legendDot: { width: 6, height: 6, borderRadius: 3, marginRight: 5 },
  legendText: { color: palette.onSurfaceSecondary, fontSize: 9 },
}));

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;
type Styles = ReturnType<typeof useStyles>;

function KpiTile({ styles, colors: palette, kpi, onPress }: { styles: Styles; colors: ThemeColors; kpi: FinanceKpi; onPress: () => void }) {
  const good = kpi.direction === "flat" ? null : (kpi.direction === "up") === kpi.positiveWhenUp;
  const tone = good === null ? palette.onSurfaceTertiary : good ? palette.success : palette.error;
  return <Pressable testID={`kpi-${kpi.key}`} accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.kpiTile, pressed && { opacity: 0.7 }]}>
    <View style={styles.kpiLabelRow}><MaterialCommunityIcons name={kpi.icon as IconName} size={10} color={palette.brand} /><Text numberOfLines={1} style={styles.kpiLabel}>{kpi.label}</Text></View>
    <Text numberOfLines={1} style={styles.kpiValue}>{kpi.value}<Text style={styles.kpiUnit}> {kpi.unit}</Text></Text>
    <View style={styles.kpiTrendRow}><MaterialCommunityIcons name={kpi.direction === "down" ? "triangle-down" : kpi.direction === "up" ? "triangle" : "minus"} size={8} color={tone} /><Text style={[styles.kpiTrendText, { color: tone }]}>{kpi.percent}%</Text></View>
  </Pressable>;
}

function Legend({ styles, items }: { styles: Styles; items: { label: string; color: string }[] }) {
  return <View style={styles.chartLegend}>{items.map((item) => <View key={item.label} style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: item.color }]} /><Text style={styles.legendText}>{item.label}</Text></View>)}</View>;
}

function Header({ styles, colors: palette, onTabPress }: { styles: Styles; colors: ThemeColors; onTabPress: (label: string) => void }) {
  return <View style={styles.header}>
    <View style={styles.brandRow}><View><Text style={styles.eyebrow}>UMMU ABDULLAH SHOP</Text><Text style={styles.title}>Analytics</Text><Text style={styles.subtitle}>Pantau performa bisnis Anda</Text></View></View>
    <View style={styles.tabs}>{["Penjualan", "Produk", "Pelanggan", "Keuangan"].map((label) => <Pressable key={label} testID={`tab-${label.toLowerCase()}`} accessibilityRole="button" onPress={() => onTabPress(label)} style={[styles.tab, label === "Keuangan" && styles.tabActive]}><Text style={[styles.tabText, label === "Keuangan" && styles.tabTextActive]}>{label}</Text></Pressable>)}</View>
  </View>;
}

export default function Keuangan() {
  const insets = useSafeAreaInsets(); const { width } = useWindowDimensions(); const { colors: palette } = useTheme(); const styles = useStyles(); const compact = width <= 430;
  const router = useRouter();
  const handleTabPress = (label: string) => { if (label === "Penjualan") router.replace("/penjualan"); if (label === "Produk") router.replace("/produk"); if (label === "Pelanggan") router.replace("/pelanggan"); };
  const [navHeight, setNavHeight] = useState(64);
  const [viewportHeight, setViewportHeight] = useState(0); const [contentHeight, setContentHeight] = useState(0);
  const canScroll = contentHeight > viewportHeight + 1;
  const { data, months, selectedMonth, setSelectedMonth } = useAnalyticsMonth("keuangan"); const [isPickerOpen, setPickerOpen] = useState(false);
  const finance = useMemo(() => financeAnalytics(data, selectedMonth), [data, selectedMonth]);
  const asJt = (value: number) => `${value}Jt`;

  return <View style={styles.root}><ThemedStatusBar />
    <ScrollView style={styles.scroll} contentContainerStyle={[styles.content, { paddingTop: insets.top + 6, paddingBottom: navHeight + 16 }]} showsVerticalScrollIndicator={false} onLayout={(event) => setViewportHeight(event.nativeEvent.layout.height)} onContentSizeChange={(_, height) => setContentHeight(height)} scrollEnabled={canScroll} bounces={canScroll} alwaysBounceVertical={false} overScrollMode={canScroll ? "auto" : "never"}>
      <Header styles={styles} colors={palette} onTabPress={handleTabPress} />
      <View style={styles.periodWrap}><Pressable testID="period-selector" accessibilityRole="button" onPress={() => setPickerOpen(true)} style={({ pressed }) => [styles.periodBar, pressed && { opacity: 0.8 }]}><MaterialCommunityIcons name="calendar-month-outline" size={27} color={palette.brand} /><View style={styles.periodCopy}><Text style={styles.periodValue}>{finance.monthLabel}</Text></View><MaterialCommunityIcons name={isPickerOpen ? "chevron-up" : "chevron-down"} size={22} color={palette.brand} /></Pressable></View>

      <View style={styles.sectionsWrap}>
      <View testID="kpi-keuangan-card" style={[styles.card, styles.sectionGap]}>
        <View style={styles.sectionHeader}><SectionIcon name="wallet-outline" colors={palette} /><View style={styles.sectionTitleWrap}><Text style={styles.sectionTitle}>KPI Keuangan</Text><Text style={styles.sectionSub}>Ringkasan keuangan · vs {finance.previousLabel} (bulan lalu)</Text></View></View>
        <View style={styles.kpiGrid}>{finance.kpis.map((kpi) => <KpiTile key={kpi.key} styles={styles} colors={palette} kpi={kpi} onPress={() => router.push({ pathname: "/detail", params: { type: `finance-${kpi.key}`, month: selectedMonth } })} />)}</View>
      </View>

      <View testID="arus-kas-card" style={[styles.card, styles.sectionGapTight, styles.cashCard]}>
        <View style={styles.sectionHeader}><SectionIcon name="swap-vertical" colors={palette} /><View style={styles.sectionTitleWrap}><Text style={styles.sectionTitle}>Arus Kas</Text><Text style={styles.sectionSub}>Kas masuk & kas keluar (Rp Juta) · 6 bulan</Text></View></View>
        <MultiTrend colors={palette} compact={compact} height={135} series={[
          { key: "masuk", points: finance.cashInTrend, color: palette.brand, format: asJt, labelMode: "all", labelPlacement: "above" },
          { key: "keluar", points: finance.cashOutTrend, color: palette.error, format: asJt, labelMode: "all", labelPlacement: "below" },
        ]} />
        <Legend styles={styles} items={[{ label: "Kas Masuk", color: palette.brand }, { label: "Kas Keluar", color: palette.error }]} />
      </View>

      <View testID="kinerja-keuangan-card" style={[styles.card, styles.sectionGapTight]}>
        <View style={styles.sectionHeader}><SectionIcon name="finance" colors={palette} /><View style={styles.sectionTitleWrap}><Text style={styles.sectionTitle}>Kinerja Keuangan</Text><Text style={styles.sectionSub}>Pendapatan, biaya & laba (Rp Juta) · 6 bulan</Text></View></View>
        <MultiTrend colors={palette} compact={compact} series={[
          { key: "pendapatan", points: finance.revenueTrend, color: palette.brand, format: asJt, labelMode: "last" },
          { key: "biaya", points: finance.expenseTrend, color: palette.warning, dash: "5 4", format: asJt, labelMode: "last" },
          { key: "laba", points: finance.profitTrend, color: palette.success, dash: "2 3", format: asJt, labelMode: "last" },
        ]} />
        <Legend styles={styles} items={[{ label: "Pendapatan", color: palette.brand }, { label: "Biaya", color: palette.warning }, { label: "Laba", color: palette.success }]} />
      </View>
      </View>
    </ScrollView>

    <View style={[styles.nav, { paddingBottom: Math.max(insets.bottom, 12) }]} onLayout={(event) => setNavHeight(event.nativeEvent.layout.height)}>{[{ label: "Beranda", icon: "home-outline" }, { label: "Operasional", icon: "bell-outline" }, { label: "Analitik", icon: "chart-bar" }, { label: "Fokus", icon: "checkbox-marked-outline" }, { label: "Lainnya", icon: "dots-horizontal" }].map((item) => { const active = item.label === "Analitik"; return <Pressable testID={`nav-${item.label.toLowerCase()}`} key={item.label} accessibilityRole="button" onPress={() => { if (item.label === "Beranda") router.replace("/home"); if (item.label === "Operasional") router.replace("/alert"); if (item.label === "Fokus") router.replace("/action"); if (item.label === "Lainnya") router.replace("/more"); }} style={({ pressed }) => [styles.navItem, pressed && { opacity: 0.72 }]}><MaterialCommunityIcons name={item.icon as IconName} size={active ? 26 : 23} color={active ? palette.brand : palette.onSurfaceTertiary} /><Text style={[styles.navLabel, active && styles.navLabelActive]}>{item.label}</Text></Pressable>; })}</View>
    <PeriodPicker visible={isPickerOpen} onClose={() => setPickerOpen(false)} selectedMonth={selectedMonth} onSelect={(key) => { setSelectedMonth(key); setPickerOpen(false); }} availableKeys={months} colors={palette} />
  </View>;
}
