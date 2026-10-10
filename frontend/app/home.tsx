import { useMemo, useState } from "react";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { ThemedStatusBar } from "@/src/components/ui-kit";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { homeSummary, Kpi } from "@/src/data/home";
import { latestMonthKey } from "@/src/data/calc";
import { evaluateAlerts } from "@/src/data/rules";
import { PeriodPicker } from "@/src/components/period-picker";
import { useAnalyticsMonth } from "@/src/hooks/useAnalyticsMonth";
import { makeStyles, ThemeColors, useTheme, fontSans, fontSansHeavy, fontSansRegular, fontSansMedium, fontSansSemibold } from "@/src/theme";
import {
  Pressable,
  ScrollView,
  View,
} from "react-native";
import Svg, { Circle } from "react-native-svg";
import { Text } from "@/src/components/text";

// Beranda: dark premium dashboard — header ringkas, satu kartu Skor Kesehatan
// Bisnis, grid KPI 2 kolom x 4 baris, dan list-card Insight Utama. Struktur visual
// mengikuti referensi; seluruh angka berasal dari calculation layer BOS.
const useStyles = makeStyles((palette) => ({
  root: { flex: 1, backgroundColor: palette.surfaceSoft },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 12, paddingBottom: 0, flexGrow: 1 },
  header: { paddingTop: 0, paddingBottom: 8, flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
  brandTitle: { color: palette.onSurface, fontSize: 24, fontFamily: fontSansHeavy, letterSpacing: -0.5 },
  brandSub: { color: palette.brand, fontSize: 11, fontFamily: fontSans, marginTop: 1 },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 },
  periodBar: { minHeight: 34, borderRadius: 11, backgroundColor: palette.surfaceSecondary, borderWidth: 1, borderColor: palette.borderSoft, paddingHorizontal: 8, flexDirection: "row", alignItems: "center", gap: 5 },
  periodValue: { color: palette.onSurface, fontSize: 11, fontWeight: "800" },
  topIcon: { width: 34, height: 34, borderRadius: 11, backgroundColor: palette.surfaceSecondary, borderWidth: 1, borderColor: palette.borderSoft, alignItems: "center", justifyContent: "center" },
  badge: { position: "absolute", top: -4, right: -4, minWidth: 15, height: 15, borderRadius: 8, backgroundColor: palette.error, alignItems: "center", justifyContent: "center", paddingHorizontal: 3 },
  badgeText: { color: palette.onError, fontSize: 8, fontWeight: "800" },
  card: { backgroundColor: palette.surfaceSecondary, borderRadius: 14, borderWidth: 1, borderColor: palette.borderSoft, paddingHorizontal: 10, paddingTop: 7, paddingBottom: 20 },
  sectionGap: { marginTop: 12 },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sectionTitle: { color: palette.onSurface, fontSize: 13, fontFamily: fontSansHeavy, letterSpacing: -0.1 },
  sectionSub: { color: palette.onSurfaceTertiary, fontSize: 10, marginTop: 0 },
  sectionMeta: { color: palette.onSurfaceTertiary, fontSize: 10, fontWeight: "700" },

  // 1. Skor Kesehatan Bisnis: circular progress ring di kiri (angka + status di
  // dalam lingkaran), 5 indikator bar di kanan. Diameter ring 80dp agar tinggi
  // kartu tetap sama seperti sebelumnya.
  scoreBody: { flexDirection: "row", alignItems: "center", marginTop: 4 },
  scoreSide: { width: 100, alignItems: "center" },
  ringWrap: { width: 87, height: 87, alignItems: "center", justifyContent: "center" },
  ringScore: { color: palette.brandPrimary, fontSize: 26, lineHeight: 28, fontFamily: fontSansHeavy, letterSpacing: -0.5 },
  ringStatus: { color: palette.onSurface, fontSize: 12, lineHeight: 15, fontFamily: fontSans, marginTop: 1, letterSpacing: -0.3 },
  factorList: { flex: 1, marginLeft: 12, gap: 4 },
  factorRow: { flexDirection: "row", alignItems: "center" },
  factorLabel: { width: 92, color: palette.onSurfaceSecondary, fontSize: 9.5 },
  factorTrack: { flex: 1, height: 6, borderRadius: 3, backgroundColor: palette.trackSoft, overflow: "hidden", marginHorizontal: 8 },
  factorFill: { height: "100%", borderRadius: 3 },
  factorScore: { width: 24, color: palette.onSurface, fontSize: 10, fontWeight: "800", textAlign: "right" },

  // 2. KPI Utama: grid 2 kolom x 4 baris, kartu 45dp — ikon di kiri atas sejajar
  // label; nilai utama + indikator perubahan pada baris kedua; chevron di kanan.
  kpiGrid: { marginTop: 10, flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 8 },
  kpiCard: { width: "48.7%", height: 45, backgroundColor: palette.surfaceSecondary, borderRadius: 12, borderWidth: 1, borderColor: palette.borderSoft, paddingHorizontal: 8, paddingVertical: 5, flexDirection: "row", alignItems: "center", gap: 5 },
  kpiIcon: { alignSelf: "center" },
  kpiBody: { flex: 1, justifyContent: "center", gap: 2 },
  kpiLabel: { color: palette.onSurfaceTertiary, fontSize: 10, lineHeight: 12, fontFamily: fontSansRegular, letterSpacing: -0.2 },
  kpiValueRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  kpiValue: { flexShrink: 0, color: palette.onSurface, fontSize: 13, lineHeight: 16, fontFamily: fontSansSemibold, letterSpacing: -0.2 },
  kpiUnit: { color: palette.onSurfaceTertiary, fontSize: 9, fontWeight: "700" },
  kpiTrendRow: { flexShrink: 0, marginLeft: "auto", flexDirection: "row", alignItems: "center", gap: 2 },
  kpiTrendText: { fontSize: 9, lineHeight: 11, fontFamily: fontSansMedium },

  // 3. Insight Utama: list-card vertikal 45dp (4 prioritas tertinggi), nomor
  // prioritas & badge status. Tombol "Lihat Semua" menuju Alert Center.
  insightList: { marginTop: 10, gap: 6 },
  insightRow: { flexDirection: "row", alignItems: "center", height: 45, backgroundColor: palette.surfaceSecondary, borderRadius: 12, borderWidth: 1, borderColor: palette.borderSoft, paddingHorizontal: 9, paddingVertical: 5 },
  insightNum: { width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  insightNumText: { fontSize: 11, fontWeight: "800" },
  insightCopy: { flex: 1, marginHorizontal: 8 },
  insightTitle: { color: palette.brand, fontSize: 11.5, lineHeight: 14, fontFamily: fontSans },
  insightDetail: { color: palette.onSurfaceTertiary, fontSize: 9, lineHeight: 12 },
  insightBadge: { flexDirection: "row", alignItems: "center", gap: 2, borderRadius: 999, paddingHorizontal: 7, paddingVertical: 3 },
  insightBadgeText: { fontSize: 9, fontWeight: "800" },
  insightSeeAll: { color: palette.brand, fontSize: 10, fontFamily: fontSans },

  nav: { position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: palette.surfaceSecondary, borderTopWidth: 1, borderTopColor: palette.borderSoft, flexDirection: "row", justifyContent: "space-around", paddingTop: 5 },
  navItem: { minWidth: 50, minHeight: 40, alignItems: "center", justifyContent: "center" },
  navLabel: { color: palette.onSurfaceTertiary, fontSize: 8, marginTop: 1, fontFamily: fontSans },
  navLabelActive: { color: palette.brand, fontFamily: fontSansHeavy },
  navIndicator: { width: 20, height: 3, borderRadius: 2, marginTop: 2, backgroundColor: "transparent" },
  navIndicatorActive: { backgroundColor: palette.brand },
}));

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;
type Styles = ReturnType<typeof useStyles>;

// Each Home card drills into the same calculation layer via the shared /detail screen.
const homeKpiDetail = (key: string): { type: string; value: string } => ((({
  omzet: { type: "sales-omzet", value: "" }, laba: { type: "finance-laba", value: "" }, order: { type: "sales-total-order", value: "" }, aov: { type: "sales-aov", value: "" },
  pelanggan: { type: "customer-active", value: "" }, qty: { type: "sales-qty", value: "" }, kas: { type: "finance-saldo-akun", value: "" }, stok: { type: "product-stock", value: "" },
}) as Record<string, { type: string; value: string }>)[key] ?? { type: "", value: "" });
const homeFactorDetail = (label: string): { type: string; value: string } => ((({
  "Margin": { type: "finance-margin", value: "" }, "Pencapaian Omzet": { type: "finance-pendapatan", value: "" }, "Kesehatan Stok": { type: "product-availability", value: "Normal" },
  "Saldo Kas": { type: "finance-saldo-akun", value: "" }, "Repeat Rate": { type: "customer-segment", value: "Pelanggan Berulang" },
}) as Record<string, { type: string; value: string }>)[label] ?? { type: "", value: "" });
const homeInsightDetail = (key: string): { type: string; value: string } => ((({
  stok: { type: "product-availability", value: "Habis" }, slow: { type: "product-turnover", value: "Slow Moving" }, omzet: { type: "sales-omzet", value: "" },
  pelanggan: { type: "customer-active", value: "" }, target: { type: "finance-pendapatan", value: "" }, margin: { type: "finance-laba", value: "" },
}) as Record<string, { type: string; value: string }>)[key] ?? { type: "", value: "" });

// Kategori badge Insight mengikuti tone business rules: Peluang (positif/brand),
// Perhatian (warning), Kritis (error). Warna & urutan selalu dari data aktual.
const insightCategory = (tone: "brand" | "success" | "warning" | "error"): { label: string; colorKey: keyof ThemeColors; softKey: keyof ThemeColors; icon: IconName; numBgKey: keyof ThemeColors; numFgKey: keyof ThemeColors } =>
  tone === "error"
    ? { label: "Kritis", colorKey: "error", softKey: "errorSoft", icon: "alert-octagon-outline", numBgKey: "error", numFgKey: "onError" }
    : tone === "warning"
      ? { label: "Perhatian", colorKey: "warning", softKey: "warningSoft", icon: "alert-outline", numBgKey: "warning", numFgKey: "onWarning" }
      : { label: "Peluang", colorKey: "success", softKey: "successSoft", icon: "trending-up", numBgKey: "brandPrimary", numFgKey: "onBrandPrimary" };

// Urutan kartu KPI 2 x 4 sesuai referensi; nilai & tren tetap dari homeSummary.
const kpiOrder = ["kas", "omzet", "laba", "order", "qty", "aov", "pelanggan", "stok"];

// Ring Skor Kesehatan: diameter 87dp + stroke 7dp — dimensi kartu tetap terjaga.
const ringSize = 87; const ringStroke = 7; const ringRadius = (ringSize - ringStroke) / 2; const ringCircumference = 2 * Math.PI * ringRadius;

function KpiTile({ styles, colors: palette, kpi, onPress }: { styles: Styles; colors: ThemeColors; kpi: Kpi; onPress: () => void }) {
  const good = kpi.trend.direction === "flat" ? null : (kpi.trend.direction === "up") === kpi.positiveWhenUp;
  const tone = good === null ? palette.onSurfaceTertiary : good ? palette.success : palette.error;
  const trendIcon = kpi.trend.direction === "down" ? "arrow-down" : kpi.trend.direction === "up" ? "arrow-up" : "minus";
  const trendSign = kpi.trend.direction === "up" ? "+" : kpi.trend.direction === "down" ? "-" : "";
  return <Pressable testID={`kpi-${kpi.key}`} accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.kpiCard, pressed && { backgroundColor: palette.brandSecondary }]}>
    <MaterialCommunityIcons name={kpi.icon as IconName} size={20} color={palette.brand} style={styles.kpiIcon} />
    <View style={styles.kpiBody}>
      <Text numberOfLines={1} style={styles.kpiLabel}>{kpi.label}</Text>
      <View style={styles.kpiValueRow}>
        <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={styles.kpiValue}>{kpi.value}{kpi.unit ? <Text style={styles.kpiUnit}> {kpi.unit}</Text> : null}</Text>
        <View style={styles.kpiTrendRow}>
          <MaterialCommunityIcons name={trendIcon} size={10} color={tone} />
          <Text style={[styles.kpiTrendText, { color: tone }]}>{trendSign}{kpi.trend.percent}%</Text>
        </View>
      </View>
    </View>
    <MaterialCommunityIcons name="chevron-right" size={14} color={palette.onSurfaceTertiary} />
  </Pressable>;
}

export default function Home() {
  const insets = useSafeAreaInsets(); const { colors: palette } = useTheme(); const styles = useStyles();
  const router = useRouter();
  const [navHeight, setNavHeight] = useState(64);
  const { data, months, selectedMonth, setSelectedMonth } = useAnalyticsMonth("home"); const [isPickerOpen, setPickerOpen] = useState(false);
  const summary = useMemo(() => homeSummary(data, selectedMonth), [data, selectedMonth]);
  const alertCount = useMemo(() => evaluateAlerts(data, latestMonthKey(data)).length, [data]);
  // Angka skor memakai aksen pink BOS; label status di bawahnya putih. Seluruh
  // bar indikator memakai Primary Pink BOS yang sama, tanpa warna semantik.
  const orderedKpis = kpiOrder.map((key) => summary.kpis.find((kpi) => kpi.key === key)).filter((kpi): kpi is Kpi => !!kpi);

  return <View style={styles.root}><ThemedStatusBar />
    <ScrollView style={styles.scroll} contentContainerStyle={[styles.content, { paddingTop: insets.top + 6, paddingBottom: navHeight + 16 }]} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <View><Text style={styles.brandTitle}>BOS</Text><Text style={styles.brandSub}>Ummu Abdullah Babyshop</Text></View>
        <View style={styles.headerRight}>
          <Pressable testID="period-selector" accessibilityRole="button" onPress={() => setPickerOpen(true)} style={({ pressed }) => [styles.periodBar, pressed && { opacity: 0.8 }]}><MaterialCommunityIcons name="calendar-month-outline" size={17} color={palette.brand} /><Text style={styles.periodValue}>{summary.monthLabel}</Text><MaterialCommunityIcons name={isPickerOpen ? "chevron-up" : "chevron-down"} size={16} color={palette.brand} /></Pressable>
          <Pressable testID="home-alert-bell" accessibilityRole="button" onPress={() => router.push("/alert")} style={({ pressed }) => [styles.topIcon, pressed && { opacity: 0.7 }]}><MaterialCommunityIcons name="bell-outline" size={19} color={palette.onSurfaceSecondary} />{alertCount > 0 ? <View style={styles.badge}><Text style={styles.badgeText}>{alertCount}</Text></View> : null}</Pressable>
        </View>
      </View>

      <View testID="health-score-card" style={styles.card}>
        <Text style={styles.sectionTitle}>Skor Kesehatan Bisnis</Text>
        <View style={styles.scoreBody}>
          <View style={styles.scoreSide}>
            <View testID="health-score-ring" style={styles.ringWrap}>
              <Svg width={ringSize} height={ringSize} style={{ position: "absolute", top: 0, left: 0 }}>
                <Circle cx={ringSize / 2} cy={ringSize / 2} r={ringRadius} stroke={palette.trackSoft} strokeWidth={ringStroke} fill="none" />
                <Circle cx={ringSize / 2} cy={ringSize / 2} r={ringRadius} stroke={palette.brandPrimary} strokeWidth={ringStroke} fill="none" strokeDasharray={`${ringCircumference} ${ringCircumference}`} strokeDashoffset={ringCircumference * (1 - Math.min(summary.score, 100) / 100)} strokeLinecap="round" transform={`rotate(-90 ${ringSize / 2} ${ringSize / 2})`} />
              </Svg>
              <Text style={styles.ringScore}>{summary.score}</Text>
              <Text numberOfLines={1} style={styles.ringStatus}>{summary.status.label}</Text>
            </View>
          </View>
          <View style={styles.factorList}>{summary.factors.map((factor) => <Pressable testID={`factor-${factor.label.toLowerCase().replaceAll(" ", "-")}`} key={factor.label} accessibilityRole="button" onPress={() => { const target = homeFactorDetail(factor.label); if (target.type) router.push({ pathname: "/detail", params: { type: target.type, value: target.value, month: selectedMonth } }); }} style={({ pressed }) => [styles.factorRow, pressed && { backgroundColor: palette.brandSecondary, borderRadius: 6 }]}>
            <Text numberOfLines={1} style={styles.factorLabel}>{factor.label}</Text>
            <View style={styles.factorTrack}><View style={[styles.factorFill, { width: `${factor.score}%`, backgroundColor: palette.brandPrimary }]} /></View>
            <Text style={styles.factorScore}>{factor.score}</Text>
          </Pressable>)}</View>
        </View>
      </View>

      <View testID="kpi-card" style={styles.sectionGap}>
        <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>KPI Utama</Text><Text style={styles.sectionMeta}>vs {summary.previousLabel}</Text></View>
        <View style={styles.kpiGrid}>{orderedKpis.map((kpi) => <KpiTile key={kpi.key} styles={styles} colors={palette} kpi={kpi} onPress={() => { const target = homeKpiDetail(kpi.key); if (target.type) router.push({ pathname: "/detail", params: { type: target.type, value: target.value, month: selectedMonth } }); }} />)}</View>
      </View>

      <View testID="insight-card" style={styles.sectionGap}>
        <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Insight Utama</Text><Pressable testID="insight-see-all" accessibilityRole="button" onPress={() => router.push("/alert")} style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}><Text style={styles.insightSeeAll}>Lihat Semua</Text></Pressable></View>
        <View style={styles.insightList}>{summary.insights.map((insight, index) => { const category = insightCategory(insight.tone); return <Pressable testID={`insight-${insight.key}`} key={insight.key} accessibilityRole="button" onPress={() => { const target = homeInsightDetail(insight.key); if (target.type) router.push({ pathname: "/detail", params: { type: target.type, value: target.value, month: selectedMonth } }); }} style={({ pressed }) => [styles.insightRow, pressed && { backgroundColor: palette.brandSecondary }]}>
          <View style={[styles.insightNum, { backgroundColor: palette[category.numBgKey] }]}><Text style={[styles.insightNumText, { color: palette[category.numFgKey] }]}>{index + 1}</Text></View>
          <View style={styles.insightCopy}><Text numberOfLines={1} style={styles.insightTitle}>{insight.title}</Text><Text numberOfLines={1} style={styles.insightDetail}>{insight.detail}</Text></View>
          <View style={[styles.insightBadge, { backgroundColor: palette[category.softKey] }]}><MaterialCommunityIcons name={category.icon} size={10} color={palette[category.colorKey]} /><Text style={[styles.insightBadgeText, { color: palette[category.colorKey] }]}>{category.label}</Text></View>
          <MaterialCommunityIcons name="chevron-right" size={14} color={palette.onSurfaceTertiary} style={{ marginLeft: 4 }} />
        </Pressable>; })}</View>
      </View>

    </ScrollView>

    <View style={[styles.nav, { paddingBottom: Math.max(insets.bottom, 12) }]} onLayout={(event) => setNavHeight(event.nativeEvent.layout.height)}>{[{ label: "Beranda", icon: "home-outline" }, { label: "Operasional", icon: "bell-outline" }, { label: "Analitik", icon: "chart-bar" }, { label: "Fokus", icon: "checkbox-marked-outline" }, { label: "Lainnya", icon: "dots-horizontal" }].map((item) => { const active = item.label === "Beranda"; return <Pressable testID={`nav-${item.label.toLowerCase()}`} key={item.label} accessibilityRole="button" onPress={() => { if (item.label === "Operasional") router.replace("/alert"); if (item.label === "Analitik") router.replace("/penjualan"); if (item.label === "Fokus") router.replace("/action"); if (item.label === "Lainnya") router.replace("/more"); }} style={({ pressed }) => [styles.navItem, pressed && { opacity: 0.72 }]}><MaterialCommunityIcons name={item.icon as IconName} size={active ? 26 : 23} color={active ? palette.brand : palette.onSurfaceTertiary} /><Text style={[styles.navLabel, active && styles.navLabelActive]}>{item.label}</Text><View style={[styles.navIndicator, active && styles.navIndicatorActive]} /></Pressable>; })}</View>
    <PeriodPicker visible={isPickerOpen} onClose={() => setPickerOpen(false)} selectedMonth={selectedMonth} onSelect={(key) => { setSelectedMonth(key); setPickerOpen(false); }} availableKeys={months} colors={palette} />
  </View>;
}
