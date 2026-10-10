import { useMemo, useState } from "react";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { ThemedStatusBar } from "@/src/components/ui-kit";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { productAnalytics } from "@/src/data/calc";
import { MultiTrend, SectionIcon, SegmentDonut } from "@/src/components/analytics-charts";
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

// Shell styles below mirror app/index.tsx (Analytics > Pelanggan) values exactly, so the
// Produk tab inherits the same premium dark visual system (header, tabs, period bar,
// card, section header, note and bottom nav). Pelanggan's own file is left untouched.
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
  sectionGapTight: { marginTop: 6 },
  sectionsWrap: {},
  card: { position: "relative", backgroundColor: palette.surfaceSecondary, borderRadius: 14, borderWidth: 1, borderColor: palette.border, padding: 11 },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sectionTitleWrap: { flex: 1, marginLeft: 7 },
  sectionTitle: { color: palette.onSurface, fontSize: 14, fontWeight: "800", letterSpacing: -0.1 },
  sectionSub: { color: palette.onSurfaceTertiary, fontSize: 10, marginTop: 2 },
  // Tinggi card Tren Nilai Produk dikunci, konsisten dengan card grafik Analytics lain.
  trendCard: { height: 180, overflow: "hidden" },
  trendLegend: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 6, paddingLeft: 4 },
  trendLegendItem: { flexDirection: "row", alignItems: "center" },
  trendLegendDot: { width: 6, height: 6, borderRadius: 3, marginRight: 5 },
  trendLegendText: { color: palette.onSurfaceSecondary, fontSize: 9 },
  note: { flexDirection: "row", alignItems: "center", backgroundColor: palette.surfaceTertiary, borderRadius: 8, padding: 5, marginTop: 5 },
  noteText: { color: palette.onSurfaceTertiary, fontSize: 9, lineHeight: 11, flex: 1, marginLeft: 5 },
  nav: { position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: palette.surfaceSecondary, borderTopWidth: 1, borderTopColor: palette.border, flexDirection: "row", justifyContent: "space-around", paddingTop: 5 },
  navItem: { minWidth: 50, minHeight: 40, alignItems: "center", justifyContent: "center" },
  navLabel: { color: palette.onSurfaceTertiary, fontSize: 8, marginTop: 1, fontFamily: fontSans },
  navLabelActive: { color: palette.brand, fontFamily: fontSansHeavy },

  // Ketersediaan & Perputaran Produk: donut + legend beside it, stacked full-width cards,
  // mirroring the Segmentasi Pelanggan treatment (donut on the left, legend on the right).
  segmentBody: { flexDirection: "row", alignItems: "center", marginTop: 9 },
  legend: { flex: 1, marginLeft: 8, gap: 5 },
  legendRow: { minHeight: 24, flexDirection: "row", alignItems: "center", backgroundColor: palette.surfaceTertiary, borderRadius: 6, paddingHorizontal: 5 },
  legendDot: { width: 6, height: 6, borderRadius: 3, marginRight: 5 },
  legendLabel: { color: palette.onSurfaceSecondary, flex: 1, fontSize: 9 },
  legendCount: { color: palette.onSurface, fontWeight: "800", fontSize: 10, marginLeft: 3, width: 24, textAlign: "right" },
  legendPercent: { color: palette.onSurfaceTertiary, fontWeight: "800", fontSize: 9, marginLeft: 10, width: 40, textAlign: "right" },
}));

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;

function Header({ styles, colors: palette, onTabPress }: { styles: ReturnType<typeof useStyles>; colors: ThemeColors; onTabPress: (label: string) => void }) {
  return <View style={styles.header}>
    <View style={styles.brandRow}><View><Text style={styles.eyebrow}>UMMU ABDULLAH SHOP</Text><Text style={styles.title}>Analytics</Text><Text style={styles.subtitle}>Pantau performa bisnis Anda</Text></View></View>
    <View style={styles.tabs}>{["Penjualan", "Produk", "Pelanggan", "Keuangan"].map((label) => <Pressable key={label} testID={`tab-${label.toLowerCase()}`} accessibilityRole="button" onPress={() => onTabPress(label)} style={[styles.tab, label === "Produk" && styles.tabActive]}><Text style={[styles.tabText, label === "Produk" && styles.tabTextActive]}>{label}</Text></Pressable>)}</View>
  </View>;
}

export default function Produk() {
  const insets = useSafeAreaInsets(); const { width } = useWindowDimensions(); const { colors: palette } = useTheme(); const styles = useStyles(); const compact = width <= 430;
  const router = useRouter();
  const handleTabPress = (label: string) => { if (label === "Pelanggan") router.replace("/pelanggan"); if (label === "Penjualan") router.replace("/penjualan"); if (label === "Keuangan") router.replace("/keuangan"); };
  const [navHeight, setNavHeight] = useState(64);
  const { data, months, selectedMonth, setSelectedMonth } = useAnalyticsMonth("produk"); const [isPickerOpen, setPickerOpen] = useState(false);
  const product = useMemo(() => productAnalytics(data, selectedMonth), [data, selectedMonth]);
  const availabilityPercent = (count: number) => (product.availabilityTotal > 0 ? (count / product.availabilityTotal) * 100 : 0).toFixed(1).replace(".", ",");
  const turnoverPercent = (count: number) => (product.turnoverTotal > 0 ? (count / product.turnoverTotal) * 100 : 0).toFixed(1).replace(".", ",");

  return <View style={styles.root}><ThemedStatusBar />
    <ScrollView style={styles.scroll} contentContainerStyle={[styles.content, { paddingTop: insets.top + 6, paddingBottom: navHeight + 16 }]} showsVerticalScrollIndicator={false}>
      <Header styles={styles} colors={palette} onTabPress={handleTabPress} />
      <View style={styles.periodWrap}><Pressable testID="period-selector" accessibilityRole="button" onPress={() => setPickerOpen(true)} style={({ pressed }) => [styles.periodBar, pressed && { opacity: 0.8 }]}><MaterialCommunityIcons name="calendar-month-outline" size={27} color={palette.brand} /><View style={styles.periodCopy}><Text style={styles.periodValue}>{product.monthLabel}</Text></View><MaterialCommunityIcons name={isPickerOpen ? "chevron-up" : "chevron-down"} size={22} color={palette.brand} /></Pressable></View>

      <View style={styles.sectionsWrap}>
      <View testID="tren-nilai-produk-card" style={[styles.card, styles.sectionGap, styles.trendCard]}><View style={styles.sectionHeader}><SectionIcon name="chart-line" colors={palette} /><View style={styles.sectionTitleWrap}><Text style={styles.sectionTitle}>Tren Nilai Produk</Text><Text style={styles.sectionSub}>Total nilai produk dalam stok (Rp Juta) · 6 bulan</Text></View></View><MultiTrend colors={palette} compact={compact} height={121} series={[{ key: "nilai", points: product.trend, color: palette.brand, format: (value) => `${String(value).replace(".", ",")}Jt`, labelMode: "all", labelPlacement: "above" }]} /></View>

      <View style={[styles.card, styles.sectionGapTight]}><View style={styles.sectionHeader}><SectionIcon name="archive-check-outline" colors={palette} /><View style={styles.sectionTitleWrap}><Text style={styles.sectionTitle}>Ketersediaan Produk</Text><Text style={styles.sectionSub}>Status stok · per {product.referenceDate}</Text></View></View><View style={styles.segmentBody}><SegmentDonut segments={product.availability} colors={palette} onSelect={() => {}} compact={compact} unitLabel="produk" /><View style={styles.legend}>{product.availability.map((item) => <Pressable testID={`availability-${item.label.toLowerCase().replaceAll(" ", "-")}`} key={item.label} accessibilityRole="button" onPress={() => router.push({ pathname: "/detail", params: { type: "product-availability", value: item.label, month: selectedMonth } })} style={({ pressed }) => [styles.legendRow, pressed && { opacity: 0.7 }]}><View style={[styles.legendDot, { backgroundColor: palette[item.colorKey] }]} /><Text numberOfLines={1} style={styles.legendLabel}>{item.label}</Text><Text style={styles.legendCount}>{item.count}</Text><Text style={styles.legendPercent}>{availabilityPercent(item.count)}%</Text></Pressable>)}</View></View></View>

      <View style={[styles.card, styles.sectionGapTight]}><View style={styles.sectionHeader}><SectionIcon name="autorenew" colors={palette} /><View style={styles.sectionTitleWrap}><Text style={styles.sectionTitle}>Perputaran Produk</Text><Text style={styles.sectionSub}>Kecepatan stok · {product.monthLabel}</Text></View></View><View style={styles.segmentBody}><SegmentDonut segments={product.turnover} colors={palette} onSelect={() => {}} compact={compact} unitLabel="produk" /><View style={styles.legend}>{product.turnover.map((item) => <Pressable testID={`turnover-${item.label.toLowerCase().replaceAll(" ", "-")}`} key={item.label} accessibilityRole="button" onPress={() => router.push({ pathname: "/detail", params: { type: "product-turnover", value: item.label, month: selectedMonth } })} style={({ pressed }) => [styles.legendRow, pressed && { opacity: 0.7 }]}><View style={[styles.legendDot, { backgroundColor: palette[item.colorKey] }]} /><Text numberOfLines={1} style={styles.legendLabel}>{item.label}</Text><Text style={styles.legendCount}>{item.count}</Text><Text style={styles.legendPercent}>{turnoverPercent(item.count)}%</Text></Pressable>)}</View></View></View>
      </View>

    </ScrollView>
    <View style={[styles.nav, { paddingBottom: Math.max(insets.bottom, 12) }]} onLayout={(event) => setNavHeight(event.nativeEvent.layout.height)}>{[{ label: "Beranda", icon: "home-outline" }, { label: "Operasional", icon: "bell-outline" }, { label: "Analitik", icon: "chart-bar" }, { label: "Fokus", icon: "checkbox-marked-outline" }, { label: "Lainnya", icon: "dots-horizontal" }].map((item) => { const active = item.label === "Analitik"; return <Pressable testID={`nav-${item.label.toLowerCase()}`} key={item.label} accessibilityRole="button" onPress={() => { if (item.label === "Beranda") router.replace("/home"); if (item.label === "Operasional") router.replace("/alert"); if (item.label === "Fokus") router.replace("/action"); if (item.label === "Lainnya") router.replace("/more"); }} style={({ pressed }) => [styles.navItem, pressed && { opacity: 0.72 }]}><MaterialCommunityIcons name={item.icon as IconName} size={active ? 26 : 23} color={active ? palette.brand : palette.onSurfaceTertiary} /><Text style={[styles.navLabel, active && styles.navLabelActive]}>{item.label}</Text></Pressable>; })}</View>
    <PeriodPicker visible={isPickerOpen} onClose={() => setPickerOpen(false)} selectedMonth={selectedMonth} onSelect={(key) => { setSelectedMonth(key); setPickerOpen(false); }} availableKeys={months} colors={palette} />
  </View>;
}
