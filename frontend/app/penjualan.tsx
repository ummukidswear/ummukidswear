import { useMemo, useState } from "react";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { ThemedStatusBar } from "@/src/components/ui-kit";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { salesAnalytics } from "@/src/data/calc";
import { compactRupiah } from "@/src/data/time";
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

// Shell styles mirror app/index.tsx (Analytics > Pelanggan) exactly so the Penjualan tab
// inherits the same premium dark system (header, tabs, period bar, card, section header,
// bottom nav). Only the three Penjualan sections add their own compact styles.
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
  // Tinggi card Tren Penjualan dikunci; grafik menyesuaikan ke dalam card.
  trendCard: { height: 212, overflow: "hidden" },
  nav: { position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: palette.surfaceSecondary, borderTopWidth: 1, borderTopColor: palette.border, flexDirection: "row", justifyContent: "space-around", paddingTop: 5 },
  navItem: { minWidth: 50, minHeight: 40, alignItems: "center", justifyContent: "center" },
  navLabel: { color: palette.onSurfaceTertiary, fontSize: 8, marginTop: 1, fontFamily: fontSans },
  navLabelActive: { color: palette.brand, fontFamily: fontSansHeavy },

  // KPI Penjualan: 2 x 2 compact tiles.
  kpiGrid: { marginTop: 9, flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 6 },
  kpiTile: { width: "49%", backgroundColor: palette.surfaceTertiary, borderRadius: 9, paddingHorizontal: 8, paddingVertical: 7 },
  kpiLabelRow: { flexDirection: "row", alignItems: "center" },
  kpiLabel: { color: palette.onSurfaceTertiary, fontSize: 9, marginLeft: 4 },
  kpiValue: { color: palette.onSurface, fontSize: 16, fontWeight: "800", marginTop: 2, letterSpacing: -0.3 },
  kpiUnit: { color: palette.onSurfaceTertiary, fontSize: 9, fontWeight: "700" },

  // Tren Penjualan: inline legend for the two series.
  trendLegend: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 6 },
  trendLegendItem: { flexDirection: "row", alignItems: "center" },
  trendLegendDot: { width: 6, height: 6, borderRadius: 3, marginRight: 5 },
  trendLegendText: { color: palette.onSurfaceSecondary, fontSize: 9 },

  // Omzet per Channel: compact horizontal bars.
  channelList: { marginTop: 8, gap: 7 },
  channelRow: { flexDirection: "row", alignItems: "center", minHeight: 22 },
  channelName: { width: 58, color: palette.onSurfaceSecondary, fontSize: 9 },
  track: { flex: 1, height: 7, borderRadius: 4, backgroundColor: palette.surfaceTertiary, overflow: "hidden" },
  fill: { height: "100%", borderRadius: 6, backgroundColor: palette.brand },
  channelValue: { width: 56, color: palette.onSurface, fontSize: 9, fontWeight: "800", textAlign: "right" },
  channelPercent: { width: 34, color: palette.onSurfaceTertiary, fontSize: 8, textAlign: "right" },
}));

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;

// Warna bar Omzet per Channel berdasarkan nama channel (eye-catching), konsisten di light/dark.
const CHANNEL_COLORS: Record<string, string> = {
  "Shopee": "#00E5FF",     // Cyan
  "WhatsApp": "#00BFA5",   // Teal
  "Facebook": "#2979FF",   // Biru
  "Toko Fisik": "#FF9100", // Orange
};

function Header({ styles, colors: palette, onTabPress }: { styles: ReturnType<typeof useStyles>; colors: ThemeColors; onTabPress: (label: string) => void }) {
  return <View style={styles.header}>
    <View style={styles.brandRow}><View><Text style={styles.eyebrow}>UMMU ABDULLAH SHOP</Text><Text style={styles.title}>Analytics</Text><Text style={styles.subtitle}>Pantau performa bisnis Anda</Text></View></View>
    <View style={styles.tabs}>{["Penjualan", "Produk", "Pelanggan", "Keuangan"].map((label) => <Pressable key={label} testID={`tab-${label.toLowerCase()}`} accessibilityRole="button" onPress={() => onTabPress(label)} style={[styles.tab, label === "Penjualan" && styles.tabActive]}><Text style={[styles.tabText, label === "Penjualan" && styles.tabTextActive]}>{label}</Text></Pressable>)}</View>
  </View>;
}

function KpiTile({ styles, colors: palette, icon, label, value, unit, testID, onPress }: { styles: ReturnType<typeof useStyles>; colors: ThemeColors; icon: IconName; label: string; value: string; unit?: string; testID: string; onPress: () => void }) {
  return <Pressable testID={testID} accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.kpiTile, pressed && { opacity: 0.7 }]}>
    <View style={styles.kpiLabelRow}><MaterialCommunityIcons name={icon} size={12} color={palette.brand} /><Text numberOfLines={1} style={styles.kpiLabel}>{label}</Text></View>
    <Text numberOfLines={1} style={styles.kpiValue}>{value}{unit ? <Text style={styles.kpiUnit}> {unit}</Text> : null}</Text>
  </Pressable>;
}

export default function Penjualan() {
  const insets = useSafeAreaInsets(); const { width } = useWindowDimensions(); const { colors: palette } = useTheme(); const styles = useStyles(); const compact = width <= 430;
  const router = useRouter();
  const handleTabPress = (label: string) => { if (label === "Produk") router.replace("/produk"); if (label === "Pelanggan") router.replace("/pelanggan"); if (label === "Keuangan") router.replace("/keuangan"); };
  const [navHeight, setNavHeight] = useState(64);
  const { data, months, selectedMonth, setSelectedMonth } = useAnalyticsMonth("penjualan"); const [isPickerOpen, setPickerOpen] = useState(false);
  const sales = useMemo(() => salesAnalytics(data, selectedMonth), [data, selectedMonth]);
  const channels = sales.channels.filter((channel) => channel.omzet > 0);
  const maxChannel = Math.max(1, ...channels.map((channel) => channel.omzet));

  return <View style={styles.root}><ThemedStatusBar />
    <ScrollView style={styles.scroll} contentContainerStyle={[styles.content, { paddingTop: insets.top + 6, paddingBottom: navHeight + 16 }]} showsVerticalScrollIndicator={false}>
      <Header styles={styles} colors={palette} onTabPress={handleTabPress} />
      <View style={styles.periodWrap}><Pressable testID="period-selector" accessibilityRole="button" onPress={() => setPickerOpen(true)} style={({ pressed }) => [styles.periodBar, pressed && { opacity: 0.8 }]}><MaterialCommunityIcons name="calendar-month-outline" size={27} color={palette.brand} /><View style={styles.periodCopy}><Text style={styles.periodValue}>{sales.monthLabel}</Text></View><MaterialCommunityIcons name={isPickerOpen ? "chevron-up" : "chevron-down"} size={22} color={palette.brand} /></Pressable></View>

      <View style={styles.sectionsWrap}>
      <View style={[styles.card, styles.sectionGap]}><View style={styles.sectionHeader}><SectionIcon name="cart-outline" colors={palette} /><View style={styles.sectionTitleWrap}><Text style={styles.sectionTitle}>KPI Penjualan</Text><Text style={styles.sectionSub}>Ringkasan performa · {sales.monthLabel}</Text></View></View>
        <View style={styles.kpiGrid}>
          <KpiTile testID="kpi-total-order" styles={styles} colors={palette} icon="receipt" label="Total Order" value={String(sales.orders)} unit="order" onPress={() => router.push({ pathname: "/detail", params: { type: "sales-total-order", month: selectedMonth } })} />
          <KpiTile testID="kpi-aov" styles={styles} colors={palette} icon="tag-outline" label="AOV" value={`Rp${sales.aovRibu}`} unit="rb" onPress={() => router.push({ pathname: "/detail", params: { type: "sales-aov", month: selectedMonth } })} />
          <KpiTile testID="kpi-qty" styles={styles} colors={palette} icon="package-variant-closed" label="Qty Terjual" value={String(sales.qty)} unit="pcs" onPress={() => router.push({ pathname: "/detail", params: { type: "sales-qty", month: selectedMonth } })} />
          <KpiTile testID="kpi-omzet" styles={styles} colors={palette} icon="cash-multiple" label="Omzet" value={`Rp${sales.omzetJt}`} unit="Jt" onPress={() => router.push({ pathname: "/detail", params: { type: "sales-omzet", month: selectedMonth } })} />
        </View>
      </View>

      <View testID="tren-penjualan-card" style={[styles.card, styles.sectionGapTight, styles.trendCard]}><View style={styles.sectionHeader}><SectionIcon name="chart-line" colors={palette} /><View style={styles.sectionTitleWrap}><Text style={styles.sectionTitle}>Tren Penjualan</Text><Text style={styles.sectionSub}>Omzet (Rp Juta) & jumlah order · 6 bulan</Text></View></View>
        <MultiTrend colors={palette} compact={compact} height={134} series={[
          { key: "omzet", points: sales.omzetTrend, color: palette.brand, format: (value) => `${value}Jt`, labelMode: "all", labelPlacement: "above" },
          { key: "order", points: sales.orderTrend, color: palette.warning, format: (value) => String(value), labelMode: "all", labelPlacement: "below" },
        ]} />
        <View style={styles.trendLegend}>
          <View style={styles.trendLegendItem}><View style={[styles.trendLegendDot, { backgroundColor: palette.brand }]} /><Text style={styles.trendLegendText}>Omzet (Rp Jt)</Text></View>
          <View style={styles.trendLegendItem}><View style={[styles.trendLegendDot, { backgroundColor: palette.warning }]} /><Text style={styles.trendLegendText}>Order</Text></View>
        </View>
      </View>

      <View style={[styles.card, styles.sectionGapTight]}><View style={styles.sectionHeader}><SectionIcon name="storefront-outline" colors={palette} /><View style={styles.sectionTitleWrap}><Text style={styles.sectionTitle}>Omzet per Channel</Text><Text style={styles.sectionSub}>Kontribusi kanal penjualan · {sales.monthLabel}</Text></View></View>
        <View style={styles.channelList}>{channels.map((channel) => <Pressable testID={`channel-${channel.name.toLowerCase().replaceAll(" ", "-")}`} key={channel.name} accessibilityRole="button" onPress={() => router.push({ pathname: "/detail", params: { type: "sales-channel", value: channel.name, month: selectedMonth } })} style={({ pressed }) => [styles.channelRow, pressed && { opacity: 0.7 }]}><Text numberOfLines={1} style={styles.channelName}>{channel.name}</Text><View style={styles.track}><View style={[styles.fill, { width: `${(channel.omzet / maxChannel) * 100}%`, backgroundColor: CHANNEL_COLORS[channel.name] ?? palette.brand }]} /></View><Text numberOfLines={1} style={styles.channelValue}>{compactRupiah(channel.omzet)}</Text><Text style={styles.channelPercent}>{Math.round((channel.omzet / sales.channelTotal) * 100)}%</Text></Pressable>)}</View>
      </View>
      </View>

    </ScrollView>
    <View style={[styles.nav, { paddingBottom: Math.max(insets.bottom, 12) }]} onLayout={(event) => setNavHeight(event.nativeEvent.layout.height)}>{[{ label: "Beranda", icon: "home-outline" }, { label: "Operasional", icon: "bell-outline" }, { label: "Analitik", icon: "chart-bar" }, { label: "Fokus", icon: "checkbox-marked-outline" }, { label: "Lainnya", icon: "dots-horizontal" }].map((item) => { const active = item.label === "Analitik"; return <Pressable testID={`nav-${item.label.toLowerCase()}`} key={item.label} accessibilityRole="button" onPress={() => { if (item.label === "Beranda") router.replace("/home"); if (item.label === "Operasional") router.replace("/alert"); if (item.label === "Fokus") router.replace("/action"); if (item.label === "Lainnya") router.replace("/more"); }} style={({ pressed }) => [styles.navItem, pressed && { opacity: 0.72 }]}><MaterialCommunityIcons name={item.icon as IconName} size={active ? 26 : 23} color={active ? palette.brand : palette.onSurfaceTertiary} /><Text style={[styles.navLabel, active && styles.navLabelActive]}>{item.label}</Text></Pressable>; })}</View>
    <PeriodPicker visible={isPickerOpen} onClose={() => setPickerOpen(false)} selectedMonth={selectedMonth} onSelect={(key) => { setSelectedMonth(key); setPickerOpen(false); }} availableKeys={months} colors={palette} />
  </View>;
}
