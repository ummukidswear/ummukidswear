import { useMemo, useState } from "react";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Linking, Pressable, ScrollView, View } from "react-native";
import { Text, TextInput } from "@/src/components/text";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { EmptyState, ModuleHeader, Pill, ThemedStatusBar, useKit } from "@/src/components/ui-kit";
import { SupplierFormSheet } from "@/src/components/supplier-form";
import { useBos } from "@/src/data/store";
import { supplierProductCount, waLink } from "@/src/data/helpers";
import { Supplier } from "@/src/data/types";
import { makeStyles, useTheme } from "@/src/theme";

// Dedicated full-screen Supplier module: fixed header + one search box, a scrollable list
// area, and a fixed bottom action. Only the list scrolls; it stops above the safe area.
const useStyles = makeStyles((palette) => ({
  searchWrap: { flexDirection: "row", alignItems: "center", backgroundColor: palette.surfaceTertiary, borderRadius: 12, borderWidth: 1, borderColor: palette.border, paddingHorizontal: 10, minHeight: 44, marginHorizontal: 12, marginBottom: 8 },
  searchInput: { flex: 1, color: palette.onSurface, fontSize: 13, marginLeft: 8, minHeight: 44 },
  filterBar: { flexDirection: "row", alignItems: "center", marginHorizontal: 12, marginBottom: 8, gap: 8 },
  chip: { flexShrink: 0, height: 34, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.surfaceTertiary, alignItems: "center", justifyContent: "center" },
  chipActive: { backgroundColor: palette.brandPrimary, borderColor: palette.brandPrimary },
  chipText: { color: palette.onSurfaceSecondary, fontSize: 12, fontWeight: "700" },
  chipTextActive: { color: palette.onBrandPrimary },
  sortBtn: { flexShrink: 0, height: 34, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.surfaceTertiary, flexDirection: "row", alignItems: "center", gap: 4 },
  sortBtnActive: { backgroundColor: palette.brandTertiary, borderColor: palette.brand },
  sortText: { fontSize: 12, fontWeight: "700" },
  listRow: { flexDirection: "row", alignItems: "center", backgroundColor: palette.surfaceSecondary, borderRadius: 12, borderWidth: 1, borderColor: palette.border, paddingHorizontal: 10, minHeight: 54, marginBottom: 6 },
  avatar: { width: 34, height: 34, borderRadius: 10, backgroundColor: palette.brandTertiary, alignItems: "center", justifyContent: "center", marginRight: 10 },
  rowName: { color: palette.onSurface, fontSize: 13, fontWeight: "800" },
  rowMeta: { color: palette.onSurfaceTertiary, fontSize: 11, marginTop: 2 },
  waBtn: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: palette.surfaceTertiary, marginLeft: 8 },
  footer: { paddingHorizontal: 12, paddingTop: 8, borderTopWidth: 1, borderTopColor: palette.border, backgroundColor: palette.surface },
  addBtn: { minHeight: 48, borderRadius: 14, backgroundColor: palette.brandPrimary, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  addText: { color: palette.onBrandPrimary, fontSize: 13, fontWeight: "800" },
}));

const STATUS_FILTERS: { key: "all" | "Aktif" | "Tidak Aktif"; label: string }[] = [
  { key: "all", label: "Semua" },
  { key: "Aktif", label: "Aktif" },
  { key: "Tidak Aktif", label: "Nonaktif" },
];

export default function SupplierScreen() {
  const kit = useKit(); const styles = useStyles(); const { colors } = useTheme(); const insets = useSafeAreaInsets(); const router = useRouter();
  const { data } = useBos();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "Aktif" | "Tidak Aktif">("all");
  const [sortNewest, setSortNewest] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);

  const list = useMemo(() => {
    const term = query.trim().toLowerCase();
    let base = data.suppliers.filter((supplier) => statusFilter === "all" ? true : (supplier.status ?? "Aktif") === statusFilter);
    if (term) base = base.filter((supplier) => {
      if (supplier.name.toLowerCase().includes(term)) return true;
      if ((supplier.city || "").toLowerCase().includes(term)) return true;
      return data.products.some((product) => (product.supplierId === supplier.id || (product.altSupplierIds ?? []).includes(supplier.id)) && (product.name.toLowerCase().includes(term) || product.sku.toLowerCase().includes(term)));
    });
    if (sortNewest) {
      const order = new Map(data.suppliers.map((supplier, index) => [supplier.id, index]));
      base = [...base].sort((left, right) => (order.get(right.id) ?? 0) - (order.get(left.id) ?? 0));
    } else {
      base = [...base].sort((left, right) => left.name.localeCompare(right.name));
    }
    return base;
  }, [data, query, statusFilter, sortNewest]);

  const openNew = () => { setEditing(null); setFormOpen(true); };
  const goDetail = (supplier: Supplier) => router.push({ pathname: "/more/supplier-detail", params: { id: supplier.id } });
  const openWa = (supplier: Supplier) => { const link = waLink(supplier.phone); if (link.endsWith("/")) return; Linking.openURL(link).catch(() => undefined); };

  return <View style={kit.screen}><ThemedStatusBar />
    <View style={{ paddingTop: insets.top + 6 }}><ModuleHeader title="Supplier" subtitle={`${data.suppliers.length} supplier · pemasok produk`} onBack={() => router.back()} /></View>
    <View style={styles.searchWrap}>
      <MaterialCommunityIcons name="magnify" size={18} color={colors.onSurfaceTertiary} />
      <TextInput testID="supplier-search" style={styles.searchInput} value={query} onChangeText={setQuery} placeholder="Cari nama, kota, atau produk" placeholderTextColor={colors.onSurfaceTertiary} />
      {query ? <Pressable accessibilityRole="button" accessibilityLabel="Bersihkan" onPress={() => setQuery("")}><MaterialCommunityIcons name="close-circle" size={18} color={colors.onSurfaceTertiary} /></Pressable> : null}
    </View>

    <View style={styles.filterBar}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }} style={{ flex: 1 }} keyboardShouldPersistTaps="handled">
        {STATUS_FILTERS.map((filter) => { const on = statusFilter === filter.key; return <Pressable key={filter.key} testID={`supplier-filter-${filter.key}`} accessibilityRole="button" onPress={() => setStatusFilter(filter.key)} style={[styles.chip, on && styles.chipActive]}><Text style={[styles.chipText, on && styles.chipTextActive]}>{filter.label}</Text></Pressable>; })}
      </ScrollView>
      <Pressable testID="supplier-sort-newest" accessibilityRole="button" onPress={() => setSortNewest((prev) => !prev)} style={[styles.sortBtn, sortNewest && styles.sortBtnActive]}>
        <MaterialCommunityIcons name="sort-clock-descending-outline" size={15} color={sortNewest ? colors.brand : colors.onSurfaceSecondary} />
        <Text style={[styles.sortText, { color: sortNewest ? colors.brand : colors.onSurfaceSecondary }]}>Terbaru</Text>
      </Pressable>
    </View>

    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 12 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      {list.length === 0 ? <EmptyState text={query || statusFilter !== "all" ? "Tidak ada supplier cocok." : "Belum ada supplier. Tambah supplier pertama Anda."} /> : list.map((supplier) => {
        const count = supplierProductCount(data, supplier.id);
        const active = (supplier.status ?? "Aktif") === "Aktif";
        return <View key={supplier.id} style={styles.listRow}>
          <Pressable testID={`supplier-row-${supplier.id}`} accessibilityRole="button" onPress={() => goDetail(supplier)} style={({ pressed }) => [{ flex: 1, flexDirection: "row", alignItems: "center" }, pressed && { opacity: 0.7 }]}>
            <View style={styles.avatar}><MaterialCommunityIcons name="handshake-outline" size={17} color={colors.brand} /></View>
            <View style={{ flex: 1 }}>
              <Text numberOfLines={1} style={styles.rowName}>{supplier.name}</Text>
              <Text numberOfLines={1} style={styles.rowMeta}>{(supplier.city || "-")}  ·  <Text testID={`supplier-products-${supplier.id}`} style={{ color: colors.brand, fontWeight: "800" }}>{count} produk</Text></Text>
            </View>
            <Pill label={active ? "Aktif" : "Nonaktif"} color={active ? colors.success : colors.onSurfaceTertiary} />
          </Pressable>
          <Pressable testID={`supplier-wa-${supplier.id}`} accessibilityRole="button" accessibilityLabel="WhatsApp" hitSlop={6} onPress={() => openWa(supplier)} style={styles.waBtn}><MaterialCommunityIcons name="whatsapp" size={18} color={colors.success} /></Pressable>
          <Pressable testID={`supplier-chevron-${supplier.id}`} accessibilityRole="button" accessibilityLabel="Detail" hitSlop={6} onPress={() => goDetail(supplier)} style={{ paddingLeft: 4 }}><MaterialCommunityIcons name="chevron-right" size={20} color={colors.onSurfaceTertiary} /></Pressable>
        </View>;
      })}
    </ScrollView>

    <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
      <Pressable testID="supplier-add-button" accessibilityRole="button" onPress={openNew} style={({ pressed }) => [styles.addBtn, pressed && { opacity: 0.85 }]}><MaterialCommunityIcons name="plus" size={20} color={colors.onBrandPrimary} /><Text style={styles.addText}>Tambah Supplier</Text></Pressable>
    </View>

    <SupplierFormSheet visible={formOpen} initial={editing} onClose={() => setFormOpen(false)} />
  </View>;
}
