import { useMemo, useState } from "react";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Pressable, ScrollView, View } from "react-native";
import { Text, TextInput } from "@/src/components/text";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { moreMenu } from "@/src/data/modules";
import { evaluateAlerts } from "@/src/data/rules";
import { latestMonthKey } from "@/src/data/calc";
import { useBos } from "@/src/data/store";
import { IconName, ThemedStatusBar, useKit } from "@/src/components/ui-kit";
import { makeStyles, useTheme, fontSans, fontSansHeavy } from "@/src/theme";

// More is the entry point to every source-data module: what is edited here flows through
// the calculation layer into Home, Analytics, Alert and Action. Layout = LIST (versi sebelum
// Grid) + search; modul, kategori, urutan, count/badge, navigasi & fungsi tidak berubah.
const useStyles = makeStyles((palette) => ({
  groupLabel: { color: palette.brand, fontSize: 9, fontWeight: "800", letterSpacing: 1.1, textTransform: "uppercase", marginTop: 12, marginBottom: 6 },
  searchBox: { flexDirection: "row", alignItems: "center", backgroundColor: palette.surfaceSecondary, borderRadius: 12, borderWidth: 1, borderColor: palette.border, paddingHorizontal: 10, minHeight: 44, marginTop: 10, gap: 8 },
  searchInput: { flex: 1, color: palette.onSurface, fontSize: 13, minHeight: 44 },
  counter: { color: palette.onSurfaceTertiary, fontSize: 10, fontWeight: "700", marginRight: 6 },
  emptyText: { color: palette.onSurfaceTertiary, fontSize: 12, textAlign: "center", marginTop: 24 },
  nav: { position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: palette.surfaceSecondary, borderTopWidth: 1, borderTopColor: palette.border, flexDirection: "row", justifyContent: "space-around", paddingTop: 5 },
  navItem: { minWidth: 50, minHeight: 40, alignItems: "center", justifyContent: "center" },
  navLabel: { color: palette.onSurfaceTertiary, fontSize: 8, marginTop: 1, fontFamily: fontSans },
  navLabelActive: { color: palette.brand, fontFamily: fontSansHeavy },
}));

const countLabel = (slug: string, data: ReturnType<typeof useBos>["data"]) => {
  const map: Record<string, number> = {
    order: data.orders.length, produk: data.products.length, inventori: data.adjustments.length,
    pembelian: data.purchases.length, supplier: data.suppliers.length, pelanggan: data.customers.length,
    channel: data.channels.length, pengeluaran: data.expenses.length, "akun-kas": data.accounts.length,
    target: data.targets.length, "business-rules": data.rules.filter((rule) => rule.enabled).length,
    "audit-log": data.audit.length,
  };
  return map[slug] === undefined ? "" : String(map[slug]);
};

export default function More() {
  const kit = useKit(); const styles = useStyles(); const { colors } = useTheme(); const insets = useSafeAreaInsets();
  const router = useRouter(); const { data } = useBos();
  const [navHeight, setNavHeight] = useState(64);
  const [query, setQuery] = useState("");
  const alerts = evaluateAlerts(data, latestMonthKey(data));

  // Filter modul berdasarkan pencarian; kategori tanpa hasil disembunyikan. Urutan tetap.
  const sections = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return moreMenu;
    return moreMenu
      .map((section) => ({ ...section, items: section.items.filter((item) => item.label.toLowerCase().includes(needle)) }))
      .filter((section) => section.items.length > 0);
  }, [query]);

  return <View style={kit.screen}><ThemedStatusBar />
    <ScrollView contentContainerStyle={[kit.body, { paddingTop: insets.top + 6, paddingBottom: navHeight + 16 }]} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      <View style={{ marginBottom: 4 }}>
        <Text style={kit.eyebrow}>UMMU ABDULLAH SHOP</Text>
        <Text style={kit.title}>More</Text>
        <Text style={kit.subtitle}>Semua data & aturan bisnis Anda</Text>
      </View>

      <View style={styles.searchBox}>
        <MaterialCommunityIcons name="magnify" size={18} color={colors.onSurfaceTertiary} />
        <TextInput testID="more-search-input" style={styles.searchInput} value={query} onChangeText={setQuery} placeholder="Cari modul…" placeholderTextColor={colors.onSurfaceTertiary} returnKeyType="search" autoCorrect={false} />
        {query ? <Pressable testID="more-search-clear" accessibilityRole="button" accessibilityLabel="Hapus pencarian" onPress={() => setQuery("")} hitSlop={8}><MaterialCommunityIcons name="close-circle" size={18} color={colors.onSurfaceTertiary} /></Pressable> : null}
      </View>

      {sections.length === 0 ? <Text style={styles.emptyText}>Tidak ada modul yang cocok dengan “{query.trim()}”.</Text> : sections.map((section) => <View key={section.group}>
        <Text style={styles.groupLabel}>{section.group}</Text>
        {section.items.map((item) => <Pressable key={item.slug} testID={`more-${item.slug}`} accessibilityRole="button" onPress={() => router.push(`/more/${item.slug}`)} style={({ pressed }) => [kit.row, pressed && { opacity: 0.85 }]}>
          <View style={kit.rowBubble}><MaterialCommunityIcons name={item.icon as IconName} size={16} color={colors.brand} /></View>
          <View style={kit.rowCopy}><Text style={kit.rowTitle}>{item.label}</Text></View>
          <Text style={styles.counter}>{countLabel(item.slug, data)}</Text>
          <MaterialCommunityIcons name="chevron-right" size={20} color={colors.onSurfaceTertiary} />
        </Pressable>)}
      </View>)}
    </ScrollView>

    <View style={[styles.nav, { paddingBottom: Math.max(insets.bottom, 12) }]} onLayout={(event) => setNavHeight(event.nativeEvent.layout.height)}>
      {[{ label: "Beranda", icon: "home-outline", route: "/home" }, { label: "Operasional", icon: "bell-outline", route: "/alert" }, { label: "Analitik", icon: "chart-bar", route: "/penjualan" }, { label: "Fokus", icon: "checkbox-marked-outline", route: "/action" }, { label: "Lainnya", icon: "dots-horizontal", route: "/more" }].map((item) => {
        const active = item.label === "Lainnya";
        return <Pressable testID={`nav-${item.label.toLowerCase()}`} key={item.label} accessibilityRole="button" onPress={() => { if (!active) router.replace(item.route as never); }} style={({ pressed }) => [styles.navItem, pressed && { opacity: 0.72 }]}>
          <MaterialCommunityIcons name={item.icon as IconName} size={active ? 26 : 23} color={active ? colors.brand : colors.onSurfaceTertiary} />
          {item.label === "Operasional" && alerts.length > 0 ? <View style={{ position: "absolute", top: 2, right: 8, minWidth: 14, height: 14, borderRadius: 7, backgroundColor: colors.error, alignItems: "center", justifyContent: "center", paddingHorizontal: 3 }}><Text style={{ color: colors.onError, fontSize: 8, fontWeight: "800" }}>{alerts.length}</Text></View> : null}
          <Text style={[styles.navLabel, active && styles.navLabelActive]}>{item.label}</Text>
        </Pressable>;
      })}
    </View>
  </View>;
}
