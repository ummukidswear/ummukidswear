import { useMemo, useState } from "react";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Pressable, ScrollView, View } from "react-native";
import { Text, TextInput } from "@/src/components/text";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ConfirmSheet, DateField, EmptyState, FullScreenForm, ModuleHeader, SearchableSelectField, SelectField, ThemedStatusBar, useKit } from "@/src/components/ui-kit";
import { newId, useBos } from "@/src/data/store";
import { isPackagingComponent, isTaxComponent } from "@/src/data/profit";
import { formatRupiah, formatThousands, parseThousands, toDisplayDate } from "@/src/data/time";
import { ChannelCost, CostBasis, PackagingConfig } from "@/src/data/types";
import { useTheme } from "@/src/theme";

// Biaya Channel — SINGLE SOURCE OF TRUTH seluruh biaya penjualan/channel, termasuk PPh &
// Packaging. Packaging kini dihitung PER PAKET berdasarkan Jenis Pengiriman (Rp/paket), diatur
// lewat layar "Konfigurasi Packaging". Setiap komponen tersimpan sebagai satu ChannelCost;
// Profit Engine, Laporan & Analytics membaca dari sini (tidak ada hitung ulang / sumber ganda).
type CompDraft = { id: string; name: string; type: "percent" | "rp"; value: string; packaging?: PackagingConfig };
type Draft = { channelId: string; scope: "all" | "sku"; sku: string; basis: CostBasis; effectiveDate: string; status: "Aktif" | "Tidak Aktif"; components: CompDraft[]; originalIds: string[] };

const makeDefaultPackaging = (): PackagingConfig => ({ model: "by_shipping", shippingTypes: [{ id: newId("ship"), name: "Reguler", value: 3000 }, { id: newId("ship"), name: "Instan", value: 500 }] });

const DEFAULT_COMPONENTS: { name: string; type: "percent" | "rp"; value: string }[] = [
  { name: "Administrasi", type: "percent", value: "" },
  { name: "Gratis Ongkir XTRA", type: "percent", value: "" },
  { name: "Promo XTRA", type: "percent", value: "" },
  { name: "Biaya Pesanan", type: "rp", value: "" },
  { name: "PPh", type: "percent", value: "0,5" },
  { name: "Packaging", type: "rp", value: "" },
];

const groupKey = (cost: ChannelCost) => `${cost.channelId}|${cost.sku}|${cost.effectiveDate}`;
const valueToText = (cost: ChannelCost) => cost.type === "rp" ? String(Math.round(cost.value)) : String(cost.value).replace(".", ",");
const parseValue = (text: string, type: "percent" | "rp") => type === "rp" ? (Number(parseThousands(text)) || 0) : (Number(String(text).replace(/\./g, "").replace(/,/g, ".")) || 0);
const packagingRepValue = (config: PackagingConfig) => config.model === "flat" ? (config.flatValue ?? 0) : Math.max(0, ...config.shippingTypes.map((type) => type.value));
const synthesizePackaging = (cost: ChannelCost): PackagingConfig => cost.packaging ?? { model: "by_shipping", shippingTypes: [{ id: newId("ship"), name: "Reguler", value: cost.value || 3000 }, { id: newId("ship"), name: "Instan", value: 500 }] };

export default function BiayaChannelScreen() {
  const kit = useKit(); const { colors } = useTheme(); const insets = useSafeAreaInsets(); const router = useRouter();
  const { data, upsert, remove } = useBos();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<ChannelCost[] | null>(null);
  const [error, setError] = useState("");
  const [packagingIndex, setPackagingIndex] = useState<number | null>(null);

  const channelName = (id: string) => data.channels.find((channel) => channel.id === id)?.name ?? "-";
  const productName = (id: string) => data.products.find((product) => product.id === id)?.name ?? id;

  // Kelompok = satu "aturan biaya" (channel × scope × tanggal berlaku) berisi n komponen.
  const groups = useMemo(() => {
    const map = new Map<string, ChannelCost[]>();
    (data.channelCosts ?? []).forEach((cost) => { const key = groupKey(cost); map.set(key, [...(map.get(key) ?? []), cost]); });
    return [...map.entries()].map(([key, costs]) => ({ key, costs, head: costs[0] })).sort((left, right) => channelName(left.head.channelId).localeCompare(channelName(right.head.channelId)) || left.head.sku.localeCompare(right.head.sku) || left.head.effectiveDate.localeCompare(right.head.effectiveDate));
  }, [data.channelCosts, data.channels]);

  const openNew = () => { setDraft({ channelId: "", scope: "all", sku: "", basis: "after_discount", effectiveDate: new Date().toISOString().slice(0, 10), status: "Aktif", components: DEFAULT_COMPONENTS.map((component) => ({ ...component, id: newId("cc"), packaging: isPackagingComponent(component.name) ? makeDefaultPackaging() : undefined })), originalIds: [] }); setIsNew(true); setError(""); };
  const openEdit = (costs: ChannelCost[]) => {
    const head = costs[0];
    const percent = costs.find((cost) => cost.type === "percent" && cost.basis);
    setDraft({ channelId: head.channelId, scope: head.sku ? "sku" : "all", sku: head.sku, basis: percent?.basis ?? "after_discount", effectiveDate: head.effectiveDate, status: head.status ?? "Aktif", components: costs.map((cost) => ({ id: cost.id, name: cost.component, type: cost.type, value: valueToText(cost), packaging: isPackagingComponent(cost.component) ? synthesizePackaging(cost) : undefined })), originalIds: costs.map((cost) => cost.id) });
    setIsNew(false); setError("");
  };

  const patchComponent = (index: number, patch: Partial<CompDraft>) => setDraft((current) => current && ({ ...current, components: current.components.map((component, position) => (position === index ? { ...component, ...patch } : component)) }));
  const removeComponent = (index: number) => setDraft((current) => current && ({ ...current, components: current.components.filter((_, position) => position !== index) }));
  const addComponent = () => setDraft((current) => current && ({ ...current, components: [...current.components, { id: newId("cc"), name: "", type: "percent", value: "" }] }));

  // Mutator konfigurasi Packaging (per jenis pengiriman) untuk komponen di index tertentu.
  const packagingConfigAt = (index: number): PackagingConfig => draft?.components[index]?.packaging ?? makeDefaultPackaging();
  const setPackagingConfig = (index: number, config: PackagingConfig) => patchComponent(index, { packaging: config });
  const setPackagingModel = (index: number, model: "by_shipping" | "flat") => { const cfg = packagingConfigAt(index); setPackagingConfig(index, { ...cfg, model, flatValue: cfg.flatValue ?? packagingRepValue(cfg) }); };
  const addShippingType = (index: number) => { const cfg = packagingConfigAt(index); setPackagingConfig(index, { ...cfg, shippingTypes: [...cfg.shippingTypes, { id: newId("ship"), name: "", value: 0 }] }); };
  const patchShippingType = (index: number, shippingId: string, patch: Partial<{ name: string; value: number }>) => { const cfg = packagingConfigAt(index); setPackagingConfig(index, { ...cfg, shippingTypes: cfg.shippingTypes.map((type) => (type.id === shippingId ? { ...type, ...patch } : type)) }); };
  const removeShippingType = (index: number, shippingId: string) => { const cfg = packagingConfigAt(index); setPackagingConfig(index, { ...cfg, shippingTypes: cfg.shippingTypes.filter((type) => type.id !== shippingId) }); };

  const isFilled = (component: CompDraft) => component.name.trim() && (isPackagingComponent(component.name) ? true : String(component.value).trim() !== "");

  const save = () => {
    if (!draft) return;
    if (!draft.channelId) { setError("Channel wajib dipilih."); return; }
    if (draft.scope === "sku" && !draft.sku) { setError("Pilih Produk/SKU untuk scope SKU Tertentu."); return; }
    const filled = draft.components.filter(isFilled);
    if (filled.length === 0) { setError("Isi minimal satu komponen biaya (nama & nilai)."); return; }
    const names = filled.map((component) => component.name.trim().toLowerCase());
    if (new Set(names).size !== names.length) { setError("Nama komponen tidak boleh sama dalam satu aturan."); return; }
    const sku = draft.scope === "sku" ? draft.sku : "";
    const keepIds = new Set(filled.map((component) => component.id));
    draft.originalIds.filter((id) => !keepIds.has(id)).forEach((id) => remove("channelCosts", id, "Komponen biaya"));
    filled.forEach((component) => {
      if (isPackagingComponent(component.name)) {
        const config = component.packaging ?? makeDefaultPackaging();
        const cost: ChannelCost = { id: component.id, channelId: draft.channelId, sku, component: component.name.trim(), type: "rp", value: packagingRepValue(config), basis: undefined, effectiveDate: draft.effectiveDate, status: draft.status, packaging: config };
        upsert("channelCosts", cost as never, `${cost.component} · ${channelName(cost.channelId)}`);
        return;
      }
      const cost: ChannelCost = { id: component.id, channelId: draft.channelId, sku, component: component.name.trim(), type: component.type, value: parseValue(component.value, component.type), basis: component.type === "percent" ? draft.basis : undefined, effectiveDate: draft.effectiveDate, status: draft.status };
      upsert("channelCosts", cost as never, `${cost.component} · ${channelName(cost.channelId)}`);
    });
    setDraft(null);
  };

  const componentLabel = (cost: ChannelCost) => {
    if (isPackagingComponent(cost.component)) {
      const cfg = cost.packaging;
      if (cfg && cfg.model === "by_shipping") return `${cost.component} ${cfg.shippingTypes.length} jenis pengiriman`;
      if (cfg && cfg.model === "flat") return `${cost.component} ${formatRupiah(cfg.flatValue ?? 0)}/paket`;
      return `${cost.component} ${formatRupiah(cost.value)}/paket`;
    }
    return `${cost.component} ${cost.type === "percent" ? `${String(cost.value).replace(".", ",")}%` : formatRupiah(cost.value)}`;
  };
  const unitHint = (component: CompDraft) => isPackagingComponent(component.name) ? "Rp / paket · per jenis pengiriman" : (component.type === "percent" ? "% dari nilai jual" : (component.name.trim().toLowerCase().includes("pesanan") ? "Rp / order" : "Rp / item"));
  const iconFor = (name: string) => isTaxComponent(name) ? "file-percent-outline" : isPackagingComponent(name) ? "package-variant" : "sale";

  const packagingSummary = (component: CompDraft) => {
    const cfg = component.packaging;
    if (!cfg) return "Berdasarkan jenis pengiriman";
    if (cfg.model === "flat") return `Satu biaya · ${formatRupiah(cfg.flatValue ?? 0)}/paket`;
    return cfg.shippingTypes.length ? cfg.shippingTypes.map((type) => `${type.name || "Tanpa nama"} ${formatRupiah(type.value)}`).join(" · ") : "Belum ada jenis pengiriman";
  };

  const activePackaging = packagingIndex !== null && draft ? draft.components[packagingIndex] : null;
  const activeConfig = activePackaging?.packaging ?? null;

  return <View style={kit.screen}><ThemedStatusBar />
    <View style={{ paddingTop: insets.top + 6 }}><ModuleHeader title="Biaya Channel" subtitle="Sumber tunggal biaya penjualan · termasuk PPh & Packaging" onBack={() => router.back()} /></View>

    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: insets.bottom + 88 }} showsVerticalScrollIndicator={false}>
      {groups.length === 0 ? <EmptyState text="Belum ada biaya channel. Tambah aturan pertama Anda." /> : groups.map((group) => {
        const active = (group.head.status ?? "Aktif") === "Aktif";
        return <View key={group.key} style={kit.row}>
          <Pressable testID={`cc-group-${group.key}`} accessibilityRole="button" onPress={() => openEdit(group.costs)} style={({ pressed }) => [{ flex: 1, flexDirection: "row", alignItems: "center" }, pressed && { opacity: 0.85 }]}>
            <View style={kit.rowBubble}><MaterialCommunityIcons name="sale" size={16} color={colors.brand} /></View>
            <View style={kit.rowCopy}>
              <Text numberOfLines={1} style={kit.rowTitle}>{`${channelName(group.head.channelId)} · ${group.head.sku ? `SKU: ${productName(group.head.sku)}` : "Global (semua SKU)"}`}</Text>
              <Text numberOfLines={2} style={kit.rowSub}>{group.costs.map(componentLabel).join(" · ")}</Text>
              <Text numberOfLines={1} style={kit.rowSub}>{`${group.costs.length} komponen · sejak ${toDisplayDate(group.head.effectiveDate)}${active ? "" : " · Tidak Aktif"}`}</Text>
            </View>
          </Pressable>
          <Pressable testID={`cc-delete-${group.key}`} accessibilityRole="button" accessibilityLabel="Hapus" onPress={() => setPendingDelete(group.costs)} style={kit.rowAction}><MaterialCommunityIcons name="trash-can-outline" size={17} color={colors.error} /></Pressable>
        </View>;
      })}
    </ScrollView>

    <Pressable testID="add-button" accessibilityRole="button" onPress={openNew} style={({ pressed }) => [kit.fab, { bottom: insets.bottom + 16 }, pressed && kit.fabPressed]}>
      <MaterialCommunityIcons name="plus" size={20} color={colors.onBrandPrimary} /><Text style={kit.fabText}>Tambah</Text>
    </Pressable>

    <ConfirmSheet visible={!!pendingDelete} title="Hapus aturan biaya channel?" destructive confirmLabel="Hapus"
      message={pendingDelete ? `${pendingDelete.length} komponen (${pendingDelete.map((cost) => cost.component).join(", ")}) pada ${channelName(pendingDelete[0].channelId)} akan dihapus. Laba transaksi baru dihitung ulang; transaksi historis tetap memakai snapshot.` : ""}
      onCancel={() => setPendingDelete(null)} onConfirm={() => { pendingDelete?.forEach((cost) => remove("channelCosts", cost.id, cost.component)); setPendingDelete(null); }} />

    <FullScreenForm visible={!!draft} title={isNew ? "Tambah Biaya Channel" : "Ubah Biaya Channel"} onClose={() => setDraft(null)} onSubmit={save}>
      {draft ? <View>
        <SelectField label="Channel" value={draft.channelId} options={data.channels.map((channel) => ({ value: channel.id, label: channel.name }))} onSelect={(value) => setDraft({ ...draft, channelId: value })} />

        <Text style={kit.fieldLabel}>Komponen Biaya</Text>
        <View style={{ gap: 6, marginBottom: 6 }}>
          {draft.components.map((component, index) => isPackagingComponent(component.name)
            ? <Pressable key={component.id} testID={`cc-comp-packaging-${index}`} accessibilityRole="button" onPress={() => setPackagingIndex(index)} style={({ pressed }) => [kit.selectRow, { paddingVertical: 8, gap: 8 }, pressed && { opacity: 0.85 }]}>
                <View style={kit.rowBubble}><MaterialCommunityIcons name="package-variant" size={16} color={colors.brand} /></View>
                <View style={{ flex: 1 }}>
                  <Text numberOfLines={1} style={kit.rowTitle}>Packaging</Text>
                  <Text numberOfLines={1} style={kit.rowSub}>{packagingSummary(component)}</Text>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={20} color={colors.brand} />
                <Pressable testID={`cc-comp-remove-${index}`} accessibilityRole="button" accessibilityLabel="Hapus komponen" onPress={() => removeComponent(index)} style={{ width: 30, height: 30, alignItems: "center", justifyContent: "center" }}><MaterialCommunityIcons name="close-circle-outline" size={18} color={colors.error} /></Pressable>
              </Pressable>
            : <View key={component.id} testID={`cc-comp-${index}`} style={[kit.selectRow, { paddingVertical: 6, paddingRight: 4, alignItems: "center", gap: 6 }]}>
                <TextInput testID={`cc-comp-name-${index}`} value={component.name} onChangeText={(text) => patchComponent(index, { name: text })} placeholder="Nama komponen" placeholderTextColor={colors.onSurfaceTertiary} style={{ flex: 1, color: colors.onSurface, fontSize: 12, fontWeight: "700", minHeight: 40 }} />
                <View style={{ flexDirection: "row", borderRadius: 8, borderWidth: 1, borderColor: colors.border, overflow: "hidden" }}>
                  {(["rp", "percent"] as const).map((type) => { const on = component.type === type; return <Pressable key={type} testID={`cc-comp-type-${index}-${type}`} accessibilityRole="button" accessibilityState={{ selected: on }} onPress={() => patchComponent(index, { type })} style={{ minWidth: 34, minHeight: 32, alignItems: "center", justifyContent: "center", paddingHorizontal: 6, backgroundColor: on ? colors.brandPrimary : colors.surfaceSecondary }}><Text style={{ fontSize: 11, fontWeight: "800", color: on ? colors.onBrandPrimary : colors.onSurfaceSecondary }}>{type === "rp" ? "Rp" : "%"}</Text></Pressable>; })}
                </View>
                <TextInput testID={`cc-comp-value-${index}`} keyboardType="numeric" value={component.type === "rp" ? formatThousands(component.value) : component.value} onChangeText={(text) => patchComponent(index, { value: component.type === "rp" ? parseThousands(text) : text })} placeholder="0" placeholderTextColor={colors.onSurfaceTertiary} style={{ width: 74, textAlign: "right", color: colors.brand, fontSize: 12, fontWeight: "800", minHeight: 40 }} />
                <Pressable testID={`cc-comp-remove-${index}`} accessibilityRole="button" accessibilityLabel="Hapus komponen" onPress={() => removeComponent(index)} style={{ width: 32, height: 32, alignItems: "center", justifyContent: "center" }}><MaterialCommunityIcons name="close-circle-outline" size={18} color={colors.error} /></Pressable>
              </View>)}
        </View>
        {draft.components.length > 0 ? <Text style={[kit.cardSub, { marginBottom: 6 }]}>{draft.components.filter((component) => component.name.trim()).map((component) => `${component.name.trim()}: ${unitHint(component)}`).join(" · ")}</Text> : null}
        <Pressable testID="cc-add-component" accessibilityRole="button" onPress={addComponent} style={({ pressed }) => [kit.ghostButton, { minHeight: 40, marginBottom: 10 }, pressed && { opacity: 0.8 }]}><Text style={kit.ghostText}>+ Tambah Komponen</Text></Pressable>
        <View style={[kit.card, { marginTop: -2 }]}><View style={{ flexDirection: "row", gap: 8 }}><MaterialCommunityIcons name={iconFor("PPh")} size={16} color={colors.brand} /><Text style={[kit.cardSub, { flex: 1, marginTop: 0 }]}>PPh & Packaging dikelola di sini sebagai komponen (satu sumber). Packaging dihitung per paket sesuai jenis pengiriman. Komponen tanpa nilai tidak disimpan.</Text></View></View>

        <Text style={kit.fieldLabel}>Scope</Text>
        <View style={{ gap: 8, marginBottom: 10 }}>
          {[{ v: "all", l: "Global (semua SKU)" }, { v: "sku", l: "SKU Tertentu" }].map((opt) => { const on = draft.scope === opt.v; return <Pressable key={opt.v} testID={`cc-scope-${opt.v}`} accessibilityRole="radio" accessibilityState={{ selected: on }} onPress={() => setDraft({ ...draft, scope: opt.v as "all" | "sku", sku: opt.v === "all" ? "" : draft.sku })} style={({ pressed }) => [kit.selectRow, pressed && { opacity: 0.8 }]}><Text style={kit.selectText}>{opt.l}</Text><MaterialCommunityIcons name={on ? "radiobox-marked" : "radiobox-blank"} size={20} color={on ? colors.brand : colors.onSurfaceTertiary} /></Pressable>; })}
        </View>
        {draft.scope === "sku" ? <SearchableSelectField label="Produk / SKU" placeholder="Cari produk / SKU..." value={draft.sku} options={data.products.map((product) => ({ value: product.id, label: `${product.name} · ${product.sku}` }))} onSelect={(value) => setDraft({ ...draft, sku: value })} /> : null}

        {draft.components.some((component) => component.type === "percent" && !isPackagingComponent(component.name)) ? <SelectField label="Basis Perhitungan (komponen %)" value={draft.basis} options={[{ value: "after_discount", label: "Setelah diskon" }, { value: "before_discount", label: "Sebelum diskon" }]} onSelect={(value) => setDraft({ ...draft, basis: value as CostBasis })} /> : null}
        <DateField label="Tanggal Berlaku" value={draft.effectiveDate} onChange={(value) => setDraft({ ...draft, effectiveDate: value })} />
        <SelectField label="Status" value={draft.status} options={[{ value: "Aktif", label: "Aktif" }, { value: "Tidak Aktif", label: "Tidak Aktif" }]} onSelect={(value) => setDraft({ ...draft, status: value as "Aktif" | "Tidak Aktif" })} />
        {error ? <Text testID="cc-form-error" style={{ color: colors.error, fontSize: 11, marginTop: 4 }}>{error}</Text> : null}
      </View> : null}
    </FullScreenForm>

    <FullScreenForm visible={packagingIndex !== null && !!activeConfig} title="Konfigurasi Packaging" submitLabel="Selesai" onClose={() => setPackagingIndex(null)} onSubmit={() => setPackagingIndex(null)}>
      {activeConfig && packagingIndex !== null ? <View>
        <Text style={[kit.subtitle, { marginBottom: 10 }]}>Atur biaya packaging berdasarkan jenis pengiriman</Text>

        <View style={kit.card}><View style={{ flexDirection: "row", gap: 10 }}>
          <MaterialCommunityIcons name="package-variant" size={20} color={colors.brand} />
          <View style={{ flex: 1 }}>
            <Text style={kit.cardTitle}>Biaya packaging dihitung per paket, bukan per item.</Text>
            <Text style={[kit.cardSub, { marginTop: 4 }]}>Jika satu order berisi beberapa item dalam 1 paket, biaya packaging hanya dihitung 1 kali sesuai jenis pengiriman. Jika dikirim dalam 2 paket, biaya dikalikan jumlah paket.</Text>
          </View>
        </View></View>

        <Text style={kit.fieldLabel}>Model Packaging</Text>
        <View style={{ gap: 8, marginBottom: 10 }}>
          {[{ v: "by_shipping", l: "Berdasarkan jenis pengiriman (Rp / paket)", d: "Biaya berbeda untuk setiap jenis pengiriman." }, { v: "flat", l: "Satu biaya untuk semua pengiriman (Rp / paket)", d: "Gunakan nilai yang sama untuk semua jenis pengiriman." }].map((opt) => { const on = activeConfig.model === opt.v; return <Pressable key={opt.v} testID={`pack-model-${opt.v}`} accessibilityRole="radio" accessibilityState={{ selected: on }} onPress={() => setPackagingModel(packagingIndex, opt.v as "by_shipping" | "flat")} style={({ pressed }) => [kit.selectRow, { alignItems: "flex-start", paddingVertical: 10, gap: 10 }, pressed && { opacity: 0.8 }]}>
            <MaterialCommunityIcons name={on ? "radiobox-marked" : "radiobox-blank"} size={20} color={on ? colors.brand : colors.onSurfaceTertiary} style={{ marginTop: 1 }} />
            <View style={{ flex: 1 }}><Text style={[kit.selectText, { fontWeight: "800" }]}>{opt.l}</Text><Text style={kit.cardSub}>{opt.d}</Text></View>
          </Pressable>; })}
        </View>

        {activeConfig.model === "by_shipping" ? <View>
          <Text style={kit.fieldLabel}>Detail Biaya per Jenis Pengiriman</Text>
          <View style={{ gap: 6, marginBottom: 6 }}>
            {activeConfig.shippingTypes.map((type) => <View key={type.id} testID={`ship-row-${type.id}`} style={[kit.selectRow, { paddingVertical: 6, paddingRight: 4, gap: 6 }]}>
              <View style={kit.rowBubble}><MaterialCommunityIcons name="truck-fast-outline" size={16} color={colors.brand} /></View>
              <TextInput testID={`ship-name-${type.id}`} value={type.name} onChangeText={(text) => patchShippingType(packagingIndex, type.id, { name: text })} placeholder="Nama pengiriman" placeholderTextColor={colors.onSurfaceTertiary} style={{ flex: 1, color: colors.onSurface, fontSize: 13, fontWeight: "700", minHeight: 40 }} />
              <Text style={{ color: colors.onSurfaceSecondary, fontSize: 12, fontWeight: "800" }}>Rp</Text>
              <TextInput testID={`ship-value-${type.id}`} keyboardType="numeric" value={formatThousands(String(type.value))} onChangeText={(text) => patchShippingType(packagingIndex, type.id, { value: Number(parseThousands(text)) || 0 })} placeholder="0" placeholderTextColor={colors.onSurfaceTertiary} style={{ width: 84, textAlign: "right", color: colors.brand, fontSize: 13, fontWeight: "800", minHeight: 40 }} />
              <Pressable testID={`ship-remove-${type.id}`} accessibilityRole="button" accessibilityLabel="Hapus jenis pengiriman" onPress={() => removeShippingType(packagingIndex, type.id)} style={{ width: 30, height: 30, alignItems: "center", justifyContent: "center" }}><MaterialCommunityIcons name="close-circle-outline" size={18} color={colors.error} /></Pressable>
            </View>)}
          </View>
          <Pressable testID="pack-add-shipping" accessibilityRole="button" onPress={() => addShippingType(packagingIndex)} style={({ pressed }) => [kit.ghostButton, { minHeight: 44, marginBottom: 12 }, pressed && { opacity: 0.8 }]}><Text style={[kit.ghostText, { color: colors.brand }]}>+ Tambah Jenis Pengiriman</Text></Pressable>
        </View> : <View style={kit.fieldWrap}>
          <Text style={kit.fieldLabel}>Biaya per Paket (semua pengiriman)</Text>
          <View style={[kit.selectRow, { gap: 6 }]}>
            <Text style={{ color: colors.onSurfaceSecondary, fontSize: 12, fontWeight: "800" }}>Rp</Text>
            <TextInput testID="pack-flat-value" keyboardType="numeric" value={formatThousands(String(activeConfig.flatValue ?? 0))} onChangeText={(text) => setPackagingConfig(packagingIndex, { ...activeConfig, flatValue: Number(parseThousands(text)) || 0 })} placeholder="0" placeholderTextColor={colors.onSurfaceTertiary} style={{ flex: 1, textAlign: "right", color: colors.brand, fontSize: 13, fontWeight: "800", minHeight: 44 }} />
          </View>
        </View>}

        <View style={kit.card}><View style={{ flexDirection: "row", gap: 10 }}>
          <MaterialCommunityIcons name="calculator-variant-outline" size={18} color={colors.brand} />
          <View style={{ flex: 1 }}>
            <Text style={kit.cardTitle}>Contoh perhitungan</Text>
            {activeConfig.model === "by_shipping"
              ? activeConfig.shippingTypes.map((type) => <Text key={type.id} style={[kit.cardSub, { marginTop: 4 }]}>{`• Pengiriman ${type.name || "?"} → packaging ${formatRupiah(type.value)}/paket`}</Text>)
              : <Text style={[kit.cardSub, { marginTop: 4 }]}>{`• Semua pengiriman → packaging ${formatRupiah(activeConfig.flatValue ?? 0)}/paket`}</Text>}
            <Text style={[kit.cardSub, { marginTop: 4 }]}>• 1 order berisi beberapa item tetapi 1 paket → biaya dihitung 1×.</Text>
            <Text style={[kit.cardSub, { marginTop: 4 }]}>• 1 order dikirim 2 paket → biaya packaging dikalikan jumlah paket.</Text>
          </View>
        </View></View>
      </View> : null}
    </FullScreenForm>
  </View>;
}
