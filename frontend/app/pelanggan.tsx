import { useMemo, useState } from "react";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { ThemedStatusBar } from "@/src/components/ui-kit";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { customerAnalytics } from "@/src/data/calc";
import { MultiTrend, SectionIcon, SegmentDonut } from "@/src/components/analytics-charts";
import { PeriodPicker } from "@/src/components/period-picker";
import { useAnalyticsMonth } from "@/src/hooks/useAnalyticsMonth";
import { makeStyles, useTheme, fontSans, fontSansHeavy } from "@/src/theme";
import {
  Pressable,
  ScrollView,
  useWindowDimensions,
  View,
} from "react-native";
import { Text } from "@/src/components/text";

const useStyles = makeStyles((palette) => ({
  root: { flex: 1, backgroundColor: palette.surface },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 12, paddingBottom: 0, flexGrow: 1 },
  header: { paddingTop: 0, paddingBottom: 4 },
  brandRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  eyebrow: { color: palette.brand, fontSize: 9, fontWeight: "800", letterSpacing: 1.2, textTransform: "uppercase", marginTop: 0 },
  title: { color: palette.onSurface, fontSize: 22, fontWeight: "800", letterSpacing: -0.6, marginTop: 2 },
  subtitle: { color: palette.onSurfaceSecondary, fontSize: 10, marginTop: 1 },
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
  // Tinggi card grafik dikunci (fixed) agar tidak berubah mengikuti isi grafik.
  trendCard: { height: 164, overflow: "hidden" },
  segmentBody: { flexDirection: "row", alignItems: "center", marginTop: 9 },
  legend: { flex: 1, marginLeft: 8, gap: 5 },
  legendRow: { minHeight: 24, flexDirection: "row", alignItems: "center", backgroundColor: palette.surfaceTertiary, borderRadius: 6, paddingHorizontal: 5 },
  legendDot: { width: 6, height: 6, borderRadius: 3, marginRight: 5 },
  legendLabel: { color: palette.onSurfaceSecondary, flex: 1, fontSize: 9 },
  legendCount: { color: palette.onSurface, fontWeight: "800", fontSize: 10, marginLeft: 3, width: 18, textAlign: "right" },
  legendPercent: { color: palette.onSurfaceTertiary, fontWeight: "800", fontSize: 9, marginLeft: 10, width: 40, textAlign: "right" },
  note: { flexDirection: "row", alignItems: "center", backgroundColor: palette.surfaceTertiary, borderRadius: 8, padding: 5, marginTop: 5 },
  noteText: { color: palette.onSurfaceTertiary, fontSize: 9, lineHeight: 11, flex: 1, marginLeft: 5 },
  regionColumns: { flexDirection: "row", justifyContent: "space-between", marginTop: 8 },
  regionCol: { width: "49%", gap: 6 },
  regionList: { marginTop: 8, flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 6 },
  regionRow: { width: "49%", flexDirection: "row", alignItems: "center", minHeight: 23 },
  regionName: { width: 48, color: palette.onSurfaceSecondary, fontSize: 9 },
  track: { flex: 1, height: 7, borderRadius: 4, backgroundColor: palette.surfaceTertiary, overflow: "hidden" },
  fill: { height: "100%", borderRadius: 6, backgroundColor: palette.brand },
  regionValue: { width: 28, color: palette.onSurface, fontSize: 9, fontWeight: "800", textAlign: "right" },
  regionPercent: { width: 28, color: palette.onSurfaceTertiary, fontSize: 8, textAlign: "right" },
  nav: { position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: palette.surfaceSecondary, borderTopWidth: 1, borderTopColor: palette.border, flexDirection: "row", justifyContent: "space-around", paddingTop: 5 },
  navItem: { minWidth: 50, minHeight: 40, alignItems: "center", justifyContent: "center" },
  navLabel: { color: palette.onSurfaceTertiary, fontSize: 8, marginTop: 1, fontFamily: fontSans },
  navLabelActive: { color: palette.brand, fontFamily: fontSansHeavy },
}));

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;

// Warna bar Sebaran Pelanggan berdasarkan ranking dinamis (peringkat 1..10 dari data aktual).
// Tetap konsisten di light/dark, jadi ditulis sebagai literal.
const REGION_RANK_COLORS = [
  "#00E5FF", // 1 Cyan
  "#00BFA5", // 2 Teal
  "#00E676", // 3 Hijau
  "#C6FF00", // 4 Lime
  "#FFEA00", // 5 Kuning
  "#FF9100", // 6 Oranye
  "#FF4081", // 7 Merah muda
  "#7C4DFF", // 8 Ungu
  "#2979FF", // 9 Biru
  "#00B8D4", // 10 Biru-teal
];


function Header({ styles, onTabPress }: { styles: ReturnType<typeof useStyles>; onTabPress: (label: string) => void }) {
  return <View style={styles.header}>
    <View style={styles.brandRow}><View><Text style={styles.eyebrow}>UMMU ABDULLAH SHOP</Text><Text style={styles.title}>Analytics</Text><Text style={styles.subtitle}>Pantau performa bisnis Anda</Text></View></View>
    <View style={styles.tabs}>{["Penjualan", "Produk", "Pelanggan", "Keuangan"].map((label) => <Pressable key={label} testID={`tab-${label.toLowerCase()}`} accessibilityRole="button" onPress={() => onTabPress(label)} style={[styles.tab, label === "Pelanggan" && styles.tabActive]}><Text style={[styles.tabText, label === "Pelanggan" && styles.tabTextActive]}>{label}</Text></Pressable>)}</View>
  </View>;
}

export default function Pelanggan() {
  const insets = useSafeAreaInsets(); const { width } = useWindowDimensions(); const { colors: palette } = useTheme(); const styles = useStyles(); const compact = width <= 430;
  const router = useRouter();
  const handleTabPress = (label: string) => { if (label === "Produk") router.replace("/produk"); if (label === "Penjualan") router.replace("/penjualan"); if (label === "Keuangan") router.replace("/keuangan"); };
  const [navHeight, setNavHeight] = useState(64);
  const { data, months, selectedMonth, setSelectedMonth } = useAnalyticsMonth("pelanggan"); const [isPickerOpen, setPickerOpen] = useState(false);
  const analytics = useMemo(() => customerAnalytics(data, selectedMonth), [data, selectedMonth]);
  const rankedRegions = analytics.regions; // dynamic, already sorted by count desc
  const topRegions = rankedRegions.slice(0, 9);
  const restRegions = rankedRegions.slice(9);
  const othersCount = restRegions.reduce((sum, region) => sum + region.count, 0);
  const displayRegions: { name: string; count: number; others?: boolean }[] = restRegions.length > 0
    ? [...topRegions, { name: "Daerah Lainnya", count: othersCount, others: true }]
    : topRegions;
  const regionLeft = displayRegions.slice(0, 5);
  const regionRight = displayRegions.slice(5, 10);
  const maxRegion = Math.max(1, ...displayRegions.map((region) => region.count));
  const segmentPercent = (count: number) => (analytics.segmentsTotal > 0 ? (count / analytics.segmentsTotal) * 100 : 0).toFixed(1).replace(".", ",");
  const openDetail = (type: string, value: string) => router.push({ pathname: "/detail", params: { type, value, month: selectedMonth } });
  const renderRegion = (region: { name: string; count: number; others?: boolean }, rank: number) => <Pressable testID={`region-${region.others ? "daerah-lainnya" : region.name.toLowerCase()}`} key={region.name} accessibilityRole="button" onPress={() => region.others ? router.push({ pathname: "/detail", params: { type: "customer-region-others", value: "", month: selectedMonth } }) : openDetail("customer-region", region.name)} style={({ pressed }) => [styles.regionRow, { width: "100%" }, pressed && { opacity: 0.7 }]}><Text numberOfLines={1} style={styles.regionName}>{region.name}</Text><View style={styles.track}><View style={[styles.fill, { width: `${(region.count / maxRegion) * 100}%`, backgroundColor: REGION_RANK_COLORS[rank % REGION_RANK_COLORS.length] }]} /></View><Text style={styles.regionValue}>{region.count}</Text><Text style={styles.regionPercent}>{analytics.segmentsTotal > 0 ? Math.round((region.count / analytics.segmentsTotal) * 100) : 0}%</Text></Pressable>;

  return <View style={styles.root}><ThemedStatusBar />
    <ScrollView style={styles.scroll} contentContainerStyle={[styles.content, { paddingTop: insets.top + 6, paddingBottom: navHeight + 16 }]} showsVerticalScrollIndicator={false}>
      <Header styles={styles} onTabPress={handleTabPress} />
      <View style={styles.periodWrap}><Pressable testID="period-selector" accessibilityRole="button" onPress={() => setPickerOpen(true)} style={({ pressed }) => [styles.periodBar, pressed && { opacity: 0.8 }]}><MaterialCommunityIcons name="calendar-month-outline" size={27} color={palette.brand} /><View style={styles.periodCopy}><Text style={styles.periodValue}>{analytics.monthLabel}</Text></View><MaterialCommunityIcons name={isPickerOpen ? "chevron-up" : "chevron-down"} size={22} color={palette.brand} /></Pressable></View>

      <View style={styles.sectionsWrap}>
      <View testID="tren-pelanggan-card" style={[styles.card, styles.sectionGap, styles.trendCard]}><View style={styles.sectionHeader}><SectionIcon name="chart-line" colors={palette} /><View style={styles.sectionTitleWrap}><Text style={styles.sectionTitle}>Tren Pelanggan Baru</Text><Text style={styles.sectionSub}>Pelanggan baru per bulan · 6 bulan</Text></View></View><MultiTrend colors={palette} compact={compact} height={104} series={[{ key: "baru", points: analytics.newTrend, color: palette.warning, format: (value) => String(value), labelMode: "all", labelPlacement: "above" }]} /></View>

      <View style={[styles.card, styles.sectionGapTight]}><View style={styles.sectionHeader}><SectionIcon name="chart-donut" colors={palette} /><View style={styles.sectionTitleWrap}><Text style={styles.sectionTitle}>Segmentasi Pelanggan</Text><Text style={styles.sectionSub}>Profil pelanggan · per {analytics.referenceDate}</Text></View></View><View style={styles.segmentBody}><SegmentDonut segments={analytics.segments} colors={palette} onSelect={(segment) => openDetail("customer-segment", segment.label)} compact={compact} /><View style={styles.legend}>{analytics.segments.map((segment) => <Pressable testID={`segment-${segment.label.toLowerCase().replaceAll(" ", "-")}`} key={segment.label} accessibilityRole="button" onPress={() => openDetail("customer-segment", segment.label)} style={({ pressed }) => [styles.legendRow, pressed && { opacity: 0.7 }]}><View style={[styles.legendDot, { backgroundColor: palette[segment.colorKey] }]} /><Text numberOfLines={1} style={styles.legendLabel}>{segment.label.replace("Pelanggan ", "")}</Text><Text style={styles.legendCount}>{segment.count}</Text><Text style={styles.legendPercent}>{segmentPercent(segment.count)}%</Text></Pressable>)}</View></View>{!compact && <View style={styles.note}><MaterialCommunityIcons name="information-outline" size={14} color={palette.brand} /><Text style={styles.noteText}>Prioritas profil dihitung dari aktivitas transaksi dalam jendela 30 dan 90 hari.</Text></View>}</View>

      <View style={[styles.card, styles.sectionGapTight]}><View style={styles.sectionHeader}><SectionIcon name="map-marker-radius-outline" colors={palette} /><View style={styles.sectionTitleWrap}><Text style={styles.sectionTitle}>Sebaran Pelanggan</Text><Text style={styles.sectionSub}>Pelanggan berdasarkan wilayah · {analytics.monthLabel}</Text></View></View><View style={styles.regionColumns}><View style={styles.regionCol}>{regionLeft.map((region, index) => renderRegion(region, index))}</View><View style={styles.regionCol}>{regionRight.map((region, index) => renderRegion(region, index + 5))}</View></View>{!compact && <View style={styles.note}><MaterialCommunityIcons name="chart-bar" size={20} color={palette.brand} /><Text style={styles.noteText}>Total {analytics.segmentsTotal} pelanggan pada periode analisis.</Text></View>}</View>
      </View>

    </ScrollView>
    <View style={[styles.nav, { paddingBottom: Math.max(insets.bottom, 12) }]} onLayout={(event) => setNavHeight(event.nativeEvent.layout.height)}>{[{ label: "Beranda", icon: "home-outline" }, { label: "Operasional", icon: "bell-outline" }, { label: "Analitik", icon: "chart-bar" }, { label: "Fokus", icon: "checkbox-marked-outline" }, { label: "Lainnya", icon: "dots-horizontal" }].map((item) => { const active = item.label === "Analitik"; return <Pressable testID={`nav-${item.label.toLowerCase()}`} key={item.label} accessibilityRole="button" onPress={() => { if (item.label === "Beranda") router.replace("/home"); if (item.label === "Operasional") router.replace("/alert"); if (item.label === "Fokus") router.replace("/action"); if (item.label === "Lainnya") router.replace("/more"); }} style={({ pressed }) => [styles.navItem, pressed && { opacity: 0.72 }]}><MaterialCommunityIcons name={item.icon as IconName} size={active ? 26 : 23} color={active ? palette.brand : palette.onSurfaceTertiary} /><Text style={[styles.navLabel, active && styles.navLabelActive]}>{item.label}</Text></Pressable>; })}</View>
    <PeriodPicker visible={isPickerOpen} onClose={() => setPickerOpen(false)} selectedMonth={selectedMonth} onSelect={(key) => { setSelectedMonth(key); setPickerOpen(false); }} availableKeys={months} colors={palette} />
  </View>;
}
