import { useState } from "react";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Linking, Pressable, ScrollView, View } from "react-native";
import { Text } from "@/src/components/text";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ConfirmSheet, EmptyState, ModuleHeader, Pill, ThemedStatusBar, useKit } from "@/src/components/ui-kit";
import { SupplierFormSheet } from "@/src/components/supplier-form";
import { useBos } from "@/src/data/store";
import { isSupplierReferenced, supplierProducts, supplierPurchases, waLink } from "@/src/data/helpers";
import { formatRupiah, toDisplayDate } from "@/src/data/time";
import { useTheme } from "@/src/theme";

// Detail Supplier: identitas, produk yang dipasok, ringkasan pembelian, catatan & aksi.
// Semua nilai diambil dari data Produk & Pembelian yang sudah ada (tidak menduplikasi data).
export default function SupplierDetailScreen() {
  const kit = useKit(); const { colors } = useTheme(); const insets = useSafeAreaInsets(); const router = useRouter();
  const { data, remove } = useBos();
  const { id } = useLocalSearchParams<{ id: string }>();
  const supplier = data.suppliers.find((entry) => entry.id === String(id));
  const [formOpen, setFormOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(false);
  const [blocked, setBlocked] = useState(false);

  if (!supplier) return <View style={kit.screen}><ThemedStatusBar />
    <View style={{ paddingTop: insets.top + 6 }}><ModuleHeader title="Supplier" subtitle="Detail" onBack={() => router.back()} /></View>
    <EmptyState text="Supplier tidak ditemukan." />
  </View>;

  const products = supplierProducts(data, supplier.id);
  const purchases = supplierPurchases(data, supplier.id);
  const totalPurchase = purchases.reduce((sum, purchase) => sum + purchase.items.reduce((total, item) => total + item.qty * item.cost, 0), 0);
  const lastPurchase = purchases.map((purchase) => purchase.date).sort().slice(-1)[0];
  const active = (supplier.status ?? "Aktif") === "Aktif";

  const openWa = () => { const link = waLink(supplier.phone); if (link.endsWith("/")) return; Linking.openURL(link).catch(() => undefined); };
  const askDelete = () => { if (isSupplierReferenced(data, supplier.id)) setBlocked(true); else setPendingDelete(true); };

  return <View style={kit.screen}><ThemedStatusBar />
    <View style={{ paddingTop: insets.top + 6 }}><ModuleHeader title={supplier.name} subtitle="Detail Supplier" onBack={() => router.back()} /></View>
    <ScrollView contentContainerStyle={[kit.body, { paddingBottom: insets.bottom + 24 }]} showsVerticalScrollIndicator={false}>
      <View style={kit.card}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Text style={kit.cardTitle}>Identitas</Text>
          <Pill label={active ? "Aktif" : "Tidak Aktif"} color={active ? colors.success : colors.onSurfaceTertiary} />
        </View>
        <Text style={[kit.cardSub, { marginTop: 6 }]}>{`Kota / Kabupaten: ${supplier.city || "-"}`}</Text>
        <Pressable testID="supplier-detail-wa" accessibilityRole="button" onPress={openWa} style={({ pressed }) => [{ marginTop: 6, flexDirection: "row", alignItems: "center", gap: 6 }, pressed && { opacity: 0.7 }]}>
          <MaterialCommunityIcons name="whatsapp" size={16} color={colors.success} />
          <Text style={[kit.cardSub, { color: colors.brand, fontWeight: "800" }]}>{supplier.phone || "-"}</Text>
        </Pressable>
        {supplier.address ? <Text style={[kit.cardSub, { marginTop: 6 }]}>{`Alamat: ${supplier.address}`}</Text> : null}
      </View>

      <View style={kit.card}><Text style={kit.cardTitle}>{`Produk dipasok · ${products.length}`}</Text></View>
      {products.length === 0 ? <Text style={[kit.cardSub, { marginBottom: 8 }]}>Belum ada produk terhubung.</Text> : products.map((product) => <View key={product.id} style={kit.row}>
        <View style={kit.rowBubble}><MaterialCommunityIcons name="package-variant-closed" size={16} color={colors.brand} /></View>
        <View style={kit.rowCopy}><Text numberOfLines={1} style={kit.rowTitle}>{product.name}</Text><Text style={kit.rowSub}>{`${product.sku} · ${product.supplierId === supplier.id ? "Supplier Utama" : "Supplier Alternatif"}`}</Text></View>
        <Text style={kit.rowValue}>{formatRupiah(product.cost)}</Text>
      </View>)}

      <View style={[kit.card, { marginTop: 8 }]}><Text style={kit.cardTitle}>Ringkasan Pembelian</Text>
        {purchases.length === 0 ? <Text testID="supplier-no-purchase" style={[kit.cardSub, { marginTop: 4 }]}>Belum ada transaksi pembelian</Text> : <Text style={[kit.cardSub, { marginTop: 4 }]}>{`Total ${formatRupiah(totalPurchase)} · ${purchases.length} transaksi · terakhir ${lastPurchase ? toDisplayDate(lastPurchase) : "-"}`}</Text>}
      </View>

      {supplier.notes ? <View style={kit.card}><Text style={kit.cardTitle}>Catatan</Text><Text style={[kit.cardSub, { marginTop: 4 }]}>{supplier.notes}</Text></View> : null}

      <View style={{ flexDirection: "row", gap: 8, marginTop: 4 }}>
        <Pressable testID="supplier-detail-edit" accessibilityRole="button" onPress={() => setFormOpen(true)} style={({ pressed }) => [kit.primaryButton, pressed && kit.primaryButtonPressed]}><Text style={kit.primaryText}>Edit Supplier</Text></Pressable>
        <Pressable testID="supplier-detail-delete" accessibilityRole="button" onPress={askDelete} style={({ pressed }) => [kit.ghostButton, pressed && { opacity: 0.85 }]}><Text style={kit.dangerText}>Hapus</Text></Pressable>
      </View>
    </ScrollView>

    <SupplierFormSheet visible={formOpen} initial={supplier} onClose={() => setFormOpen(false)} />
    <ConfirmSheet visible={pendingDelete} title="Hapus supplier?" destructive confirmLabel="Hapus"
      message={`${supplier.name} akan dihapus.`}
      onCancel={() => setPendingDelete(false)} onConfirm={() => { remove("suppliers", supplier.id, supplier.name); setPendingDelete(false); router.back(); }} />
    <ConfirmSheet visible={blocked} title="Tidak dapat dihapus" confirmLabel="Mengerti"
      message={`${supplier.name} masih dipakai oleh ${products.length} produk dan ${purchases.length} pembelian. Ubah relasi produk atau nonaktifkan supplier terlebih dahulu.`}
      onCancel={() => setBlocked(false)} onConfirm={() => setBlocked(false)} />
  </View>;
}
