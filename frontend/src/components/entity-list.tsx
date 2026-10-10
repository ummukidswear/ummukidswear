import { useMemo, useState } from "react";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Pressable, ScrollView, View } from "react-native";
import { Text, TextInput } from "@/src/components/text";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CrudDef, FieldDef } from "@/src/data/modules";
import { newId, useBos } from "@/src/data/store";
import { ConfirmSheet, DateField, EmptyState, Field, FullScreenForm, IconName, MonthField, MultiSelectField, SearchableSelectField, SelectField, Sheet, ToggleField, useKit } from "@/src/components/ui-kit";
import { CustomerFormSheet } from "@/src/components/customer-form";
import { formatRupiah } from "@/src/data/time";
import { nextCustomerCode, nextOrderCode, nextProductSku, selectableSuppliers } from "@/src/data/helpers";
import { latestMonthKey, stockOf } from "@/src/data/calc";
import { channelPriceOf, movingAvgHpp, resolveChannelCosts, resolvePackagingConfig, packagingUnitFor } from "@/src/data/profit";
import { citiesOf, cityOptions, provinceOptions } from "@/src/data/regions";
import { Product } from "@/src/data/types";
import { useTheme } from "@/src/theme";

type Draft = Record<string, any>;

// Config-driven CRUD list used by every source-data module in More, so adding a module
// means adding a definition (src/data/modules.ts) instead of another screen.
export function EntityList({ def }: { def: CrudDef }) {
  const kit = useKit(); const { colors } = useTheme(); const insets = useSafeAreaInsets();
  const { data, upsert, remove } = useBos();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Draft | null>(null);

  const items = useMemo(() => {
    const list = [...(data[def.collection] as Draft[])];
    if (def.sortDesc) list.sort((left, right) => String(right.date ?? right.monthKey ?? "").localeCompare(String(left.date ?? left.monthKey ?? "")));
    return list;
  }, [data, def]);

  const optionsFor = (field: FieldDef, current?: Draft) => {
    if (field.options) return field.options;
    const prefix = field.allowEmptyOption ? [{ value: "", label: field.allowEmptyOption.label }] : [];
    if (field.from === "suppliers") {
      const ids = field.type === "multiselect" ? ((current?.[field.key] as string[]) ?? []) : [String(current?.[field.key] ?? "")].filter(Boolean);
      return [...prefix, ...selectableSuppliers(data, ids)];
    }
    if (!field.from) return [];
    return [...prefix, ...(data[field.from] as { id: string; name?: string; label?: string }[]).map((entry) => ({ value: entry.id, label: entry.name ?? entry.label ?? entry.id }))];
  };

  const openNew = () => { setDraft({ id: newId(def.idPrefix), ...def.blank }); setIsNew(true); };
  const openEdit = (item: Draft) => { setDraft({ ...item }); setIsNew(false); };

  const save = () => {
    if (!draft) return;
    const cleaned = { ...draft };
    def.fields.forEach((field) => {
      if (field.type === "number") cleaned[field.key] = Number(cleaned[field.key]) || 0;
      if (field.type === "lines") {
        const valueKey = field.lineValueKey ?? "price";
        cleaned[field.key] = (cleaned[field.key] as Draft[]).filter((line) => line.productId && Number(line.qty) > 0).map((line) => {
          const mapped: Draft = { ...line, qty: Number(line.qty) || 0, [valueKey]: Number(line[valueKey]) || 0 };
          if (field.lineReturns) mapped.returnedQty = Math.max(0, Math.min(Number(line.qty) || 0, Number(line.returnedQty) || 0));
          if (field.lineDiscount) mapped.sellerDiscount = Math.max(0, Number(line.sellerDiscount) || 0);
          return mapped;
        });
      }
    });
    // SKU Produk dibuat otomatis oleh sistem saat produk baru disimpan: unik, permanen, read-only.
    if (def.collection === "products" && isNew && !String(cleaned.sku ?? "").trim()) cleaned.sku = nextProductSku(data);
    // ID Pelanggan dibuat otomatis (PLG-XXXX) saat pelanggan baru disimpan: unik, permanen, identifier utama.
    if (def.collection === "customers" && isNew) cleaned.id = nextCustomerCode(data);
    // Kode Order dibuat otomatis oleh sistem: unik & konsisten, tanpa input manual.
    if (def.collection === "orders" && !String(cleaned.code ?? "").trim()) cleaned.code = nextOrderCode(data, String(cleaned.date ?? ""));
    // Snapshot Profit Engine per item saat transaksi (harga aktual, diskon, HPP rata-rata
    // bergerak, biaya channel, packaging). Perubahan master nanti tidak mengubah laba historis.
    if (def.collection === "orders") {
      const channelId = String(cleaned.channelId ?? "");
      const date = String(cleaned.date ?? "");
      // Packaging PER PAKET berdasarkan Jenis Pengiriman (bukan per item). Biaya/paket dikunci
      // di order dari konfigurasi Biaya Channel; total = biaya/paket × Jumlah Paket.
      const packagingConfig = resolvePackagingConfig(data, channelId, date);
      const shippingList = packagingConfig && packagingConfig.model === "by_shipping" ? packagingConfig.shippingTypes : [];
      const chosenShippingId = packagingConfig && packagingConfig.model === "by_shipping" ? (String(cleaned.shippingTypeId ?? "") || (shippingList[0]?.id ?? "")) : "";
      const chosenShippingName = packagingConfig ? (packagingConfig.model === "flat" ? "Semua pengiriman" : (shippingList.find((type) => type.id === chosenShippingId)?.name ?? shippingList[0]?.name ?? "")) : "";
      cleaned.shippingTypeId = chosenShippingId;
      cleaned.shippingTypeName = chosenShippingName;
      cleaned.packageCount = Math.max(1, Math.floor(Number(cleaned.packageCount) || 1));
      cleaned.packagingSnapshot = { unit: packagingUnitFor(packagingConfig, chosenShippingId, chosenShippingName) };
      cleaned.items = (cleaned.items as Draft[]).map((line) => {
        const productId = String(line.productId);
        const sellerDiscountUnit = Math.max(0, Number(line.sellerDiscount) || 0);
        const channelPrice = channelPriceOf(data, productId, channelId);
        const basePrice = channelPrice ?? (Number(line.price) || 0);
        const resolved = resolveChannelCosts(data, productId, channelId, date);
        return { ...line, price: basePrice, sellerDiscount: sellerDiscountUnit, costSnapshot: { actualPriceUnit: basePrice - sellerDiscountUnit, sellerDiscountUnit, channelCosts: resolved.components, packaging: null, tax: resolved.tax, hppUnit: movingAvgHpp(data, productId, date), hasConfig: resolved.hasConfig, estimated: !resolved.hasConfig } };
      });
    }
    upsert(def.collection, cleaned as never, def.rowTitle(cleaned, data));
    setDraft(null);
  };

  const confirmDelete = (item: Draft) => setPendingDelete(item);

  const setLine = (fieldKey: string, index: number, patch: Draft) => setDraft((current) => current && ({ ...current, [fieldKey]: (current[fieldKey] as Draft[]).map((line, position) => (position === index ? { ...line, ...patch } : line)) }));
  const addLine = (field: FieldDef) => setDraft((current) => current && ({ ...current, [field.key]: [...(current[field.key] as Draft[]), { productId: "", qty: 1, [field.lineValueKey ?? "price"]: 0, returnedQty: 0, sellerDiscount: 0 }] }));
  const removeLine = (fieldKey: string, index: number) => setDraft((current) => current && ({ ...current, [fieldKey]: (current[fieldKey] as Draft[]).filter((_, position) => position !== index) }));

  return <View style={{ flex: 1 }}>
    <ScrollView contentContainerStyle={[kit.body, { paddingBottom: insets.bottom + 88 }]} showsVerticalScrollIndicator={false}>
      {items.length === 0 ? <EmptyState text="Belum ada data. Tambah data pertama Anda." /> : items.map((item) => <View key={item.id} style={kit.row}>
        <Pressable testID={`row-${item.id}`} accessibilityRole="button" onPress={() => openEdit(item)} style={({ pressed }) => [{ flex: 1, flexDirection: "row", alignItems: "center" }, pressed && { opacity: 0.85 }]}>
          <View style={kit.rowBubble}><MaterialCommunityIcons name={def.icon as IconName} size={16} color={colors.brand} /></View>
          <View style={kit.rowCopy}><Text numberOfLines={1} style={kit.rowTitle}>{def.rowTitle(item, data)}</Text><Text numberOfLines={1} style={kit.rowSub}>{def.rowSub(item, data)}</Text></View>
          {def.rowValue ? <Text style={kit.rowValue}>{def.rowValue(item, data)}</Text> : null}
        </Pressable>
        {def.canDelete === false ? <MaterialCommunityIcons name="chevron-right" size={20} color={colors.onSurfaceTertiary} /> : <Pressable testID={`delete-${item.id}`} accessibilityRole="button" accessibilityLabel="Hapus" onPress={() => confirmDelete(item)} style={kit.rowAction}><MaterialCommunityIcons name="trash-can-outline" size={17} color={colors.error} /></Pressable>}
      </View>)}
    </ScrollView>

    {def.canAdd === false ? null : <Pressable testID="add-button" accessibilityRole="button" onPress={openNew} style={({ pressed }) => [kit.fab, { bottom: insets.bottom + 16 }, pressed && kit.fabPressed]}>
      <MaterialCommunityIcons name="plus" size={20} color={colors.onBrandPrimary} /><Text style={kit.fabText}>Tambah</Text>
    </Pressable>}

    <ConfirmSheet visible={!!pendingDelete} title="Hapus data?" destructive confirmLabel="Hapus"
      message={pendingDelete ? `${def.rowTitle(pendingDelete, data)} akan dihapus dan semua perhitungan diperbarui.` : ""}
      onCancel={() => setPendingDelete(null)}
      onConfirm={() => { if (pendingDelete) remove(def.collection, pendingDelete.id, def.rowTitle(pendingDelete, data)); setPendingDelete(null); }} />

    <FullScreenForm visible={!!draft} title={isNew ? `Tambah ${def.title}` : `Ubah ${def.title}`} onClose={() => setDraft(null)} onSubmit={save}>
      {draft ? def.fields.map((field) => {
        if (field.type === "toggle") return <ToggleField key={field.key} label={field.label} value={!!draft[field.key]} onChange={(value) => setDraft({ ...draft, [field.key]: value })} />;
        if (field.system) { const val = String(draft[field.key] ?? ""); const showVal = !isNew && !!val; return <View key={field.key} style={kit.fieldWrap}><Text style={kit.fieldLabel}>{field.label}</Text><View style={[kit.input, { justifyContent: "center" }]}><Text style={{ color: colors.onSurfaceTertiary, fontSize: 13 }}>{showVal ? `${val} · terkunci` : (field.systemHint ?? "Dibuat otomatis saat disimpan")}</Text></View></View>; }
        if (field.customerPicker) return <CustomerPickerField key={field.key} value={String(draft[field.key] ?? "")} onSelect={(value) => setDraft({ ...draft, [field.key]: value })} />;
        if (field.initialOnly && !isNew) {
          const currentStock = stockOf(data, draft as unknown as Product, latestMonthKey(data));
          return <View key={field.key} style={kit.fieldWrap}>
            <Text style={kit.fieldLabel}>{field.label}</Text>
            <View style={[kit.input, { justifyContent: "center" }]}><Text style={{ color: colors.onSurfaceTertiary, fontSize: 13 }}>{`${String(draft[field.key] ?? 0)} · terkunci`}</Text></View>
            <Text style={[kit.fieldLabel, { marginTop: 4 }]}>{`Stok berjalan ${currentStock} pcs · dihitung dari pembelian, order & penyesuaian`}</Text>
          </View>;
        }
        if (field.type === "multiselect") return <MultiSelectField key={field.key} label={field.label} values={(draft[field.key] as string[]) ?? []} options={optionsFor(field, draft)} onChange={(values) => setDraft({ ...draft, [field.key]: values })} />;
        if (field.type === "province") return <SearchableSelectField key={field.key} label={field.label} placeholder="Cari provinsi..." value={String(draft[field.key] ?? "")} options={provinceOptions()} onSelect={(value) => { const cityKey = field.cityKey ?? "city"; const keepCity = citiesOf(value).includes(String(draft[cityKey] ?? "")); setDraft({ ...draft, [field.key]: value, [cityKey]: keepCity ? draft[cityKey] : "" }); }} />;
        if (field.type === "city") { const province = String(draft[field.provinceKey ?? "province"] ?? ""); return <View key={field.key}>{province ? <SearchableSelectField label={field.label} placeholder="Cari kota / kabupaten..." value={String(draft[field.key] ?? "")} options={cityOptions(province, String(draft[field.key] ?? ""))} onSelect={(value) => setDraft({ ...draft, [field.key]: value })} /> : <View style={kit.fieldWrap}><Text style={kit.fieldLabel}>{field.label}</Text><View style={[kit.selectRow, { opacity: 0.6 }]}><Text style={kit.selectText}>{String(draft[field.key] ?? "") || "Pilih provinsi terlebih dahulu"}</Text></View></View>}</View>; }
        if (field.type === "shipping") {
          const cfg = resolvePackagingConfig(data, String(draft.channelId ?? ""), String(draft.date ?? ""));
          if (!cfg) return <View key={field.key} style={kit.fieldWrap}><Text style={kit.fieldLabel}>{field.label}</Text><View style={[kit.selectRow, { opacity: 0.6 }]}><Text style={kit.selectText}>Packaging belum dikonfigurasi untuk channel ini</Text></View></View>;
          if (cfg.model === "flat") return <View key={field.key} style={kit.fieldWrap}><Text style={kit.fieldLabel}>{field.label}</Text><View style={[kit.selectRow, { opacity: 0.85 }]}><Text style={kit.selectText}>{`Semua pengiriman · ${formatRupiah(cfg.flatValue ?? 0)}/paket`}</Text></View></View>;
          const shippingOptions = cfg.shippingTypes.map((type) => ({ value: type.id, label: `${type.name} · ${formatRupiah(type.value)}/paket` }));
          return <SelectField key={field.key} label={field.label} value={String(draft[field.key] ?? "") || (shippingOptions[0]?.value ?? "")} options={shippingOptions} onSelect={(value) => setDraft({ ...draft, [field.key]: value })} />;
        }
        if (field.type === "select") { const Comp = field.searchable ? SearchableSelectField : SelectField; return <Comp key={field.key} label={field.label} value={String(draft[field.key] ?? "")} options={optionsFor(field, draft)} onSelect={(value) => setDraft({ ...draft, [field.key]: value })} />; }
        if (field.type === "date") return <DateField key={field.key} label={field.label} value={String(draft[field.key] ?? "")} onChange={(value) => setDraft({ ...draft, [field.key]: value })} />;
        if (field.type === "month") return <MonthField key={field.key} label={field.label} value={String(draft[field.key] ?? "")} onChange={(value) => setDraft({ ...draft, [field.key]: value })} />;
        if (field.type === "lines") {
          const lines = (draft[field.key] as Draft[]) ?? [];
          const valueKey = field.lineValueKey ?? "price";
          const total = lines.reduce((sum, line) => sum + (Number(line.qty) || 0) * (Number(line[valueKey]) || 0), 0);
          return <View key={field.key} style={kit.fieldWrap}>
            <Text style={kit.fieldLabel}>{`${field.label} · total ${formatRupiah(total)}`}</Text>
            {lines.map((line, index) => <View key={index} style={{ marginBottom: 10, borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 8 }}>
              <SearchableSelectField label={`Produk ${index + 1}`} value={String(line.productId ?? "")} options={data.products.map((product) => ({ value: product.id, label: product.sku ? `${product.name} · ${product.sku}` : product.name }))} onSelect={(value) => { const product = data.products.find((entry) => entry.id === value); setLine(field.key, index, { productId: value, [valueKey]: product ? (valueKey === "price" ? product.price : product.cost) : line[valueKey] }); }} />
              <View style={{ flexDirection: "row", gap: 8, alignItems: "flex-end" }}>
                <View style={{ flex: 1 }}><Field label="Qty" keyboardType="numeric" value={String(line.qty ?? "")} onChangeText={(value) => setLine(field.key, index, { qty: value })} placeholder="0" /></View>
                <View style={{ flex: 1.4 }}><Field label={valueKey === "price" ? "Harga" : "Harga Beli"} money keyboardType="numeric" value={String(line[valueKey] ?? "")} onChangeText={(value) => setLine(field.key, index, { [valueKey]: value })} placeholder="0" /></View>
                <Pressable accessibilityRole="button" accessibilityLabel="Hapus item" onPress={() => removeLine(field.key, index)} style={[kit.rowAction, { marginBottom: 10 }]}><MaterialCommunityIcons name="close-circle-outline" size={20} color={colors.error} /></Pressable>
              </View>
              {field.lineReturns ? <Field label="Qty Retur (produk ini)" keyboardType="numeric" value={String(line.returnedQty ?? "")} onChangeText={(value) => setLine(field.key, index, { returnedQty: value })} placeholder="0" /> : null}
              {field.lineDiscount ? <Field label="Diskon Seller (Rp/unit)" money keyboardType="numeric" value={String(line.sellerDiscount ?? "")} onChangeText={(value) => setLine(field.key, index, { sellerDiscount: value })} placeholder="0" /> : null}
            </View>)}
            <Pressable testID="add-line" accessibilityRole="button" onPress={() => addLine(field)} style={({ pressed }) => [kit.ghostButton, { minHeight: 40 }, pressed && { opacity: 0.8 }]}><Text style={kit.ghostText}>+ Tambah item</Text></Pressable>
          </View>;
        }
        return <Field key={field.key} label={field.label} money={!!field.money} keyboardType={field.type === "number" ? "numeric" : "default"} value={String(draft[field.key] ?? "")} onChangeText={(value) => setDraft({ ...draft, [field.key]: value })} placeholder={field.type === "number" ? "0" : undefined} />;
      }) : null}
    </FullScreenForm>
  </View>;
}


// Order → Pelanggan: autocomplete langsung pada field. Cari berdasarkan Nama ATAU Telepon dan
// tampilkan Nama + ID Pelanggan + Telepon/Kota. Jika tidak ditemukan, "+ Tambah Pelanggan Baru"
// membuka form pelanggan; setelah disimpan pelanggan otomatis masuk Master Pelanggan (SSOT) dan
// langsung terpilih pada Order. Referensi tetap memakai customer.id (identifier utama).
function CustomerPickerField({ value, onSelect }: { value: string; onSelect: (value: string) => void }) {
  const kit = useKit(); const { colors } = useTheme(); const { data } = useBos();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const selected = data.customers.find((customer) => customer.id === value);
  const trimmed = query.trim().toLowerCase();
  const digits = query.replace(/\D/g, "");
  const filtered = data.customers.filter((customer) => {
    if (!trimmed) return true;
    const byName = customer.name.toLowerCase().includes(trimmed);
    const byPhone = !!digits && (customer.phone || "").replace(/\D/g, "").includes(digits);
    const byId = customer.id.toLowerCase().includes(trimmed);
    const byCity = (customer.city || "").toLowerCase().includes(trimmed);
    return byName || byPhone || byId || byCity;
  });
  const subOf = (customer: { id: string; phone?: string; city?: string }) => [customer.id, customer.phone || customer.city].filter(Boolean).join(" · ");
  return <View style={kit.fieldWrap}>
    <Text style={kit.fieldLabel}>Pelanggan</Text>
    <Pressable testID="order-customer-picker" accessibilityRole="button" onPress={() => { setQuery(""); setOpen(true); }} style={({ pressed }) => [kit.selectRow, pressed && { opacity: 0.8 }]}>
      <View style={{ flex: 1 }}>
        {selected ? <><Text numberOfLines={1} style={kit.selectText}>{selected.name}</Text><Text numberOfLines={1} style={{ color: colors.onSurfaceTertiary, fontSize: 11, marginTop: 2 }}>{subOf(selected)}</Text></> : <Text style={kit.selectText}>Cari nama / telepon pelanggan...</Text>}
      </View>
      <MaterialCommunityIcons name="chevron-down" size={20} color={colors.brand} />
    </Pressable>
    <Sheet visible={open} title="Pilih Pelanggan" onClose={() => setOpen(false)} fill
      header={<View style={{ marginBottom: 10 }}>
        <View style={kit.selectRow}>
          <MaterialCommunityIcons name="magnify" size={18} color={colors.onSurfaceTertiary} />
          <TextInput testID="order-customer-search" style={{ flex: 1, color: colors.onSurface, fontSize: 13, marginLeft: 8, minHeight: 44 }} value={query} onChangeText={setQuery} placeholder="Cari nama atau telepon..." placeholderTextColor={colors.onSurfaceTertiary} autoFocus />
        </View>
        <Pressable testID="order-add-customer" accessibilityRole="button" onPress={() => { setOpen(false); setAddOpen(true); }} style={({ pressed }) => [kit.ghostButton, { flexDirection: "row", gap: 6, marginTop: 10 }, pressed && { opacity: 0.85 }]}>
          <MaterialCommunityIcons name="account-plus-outline" size={18} color={colors.brand} />
          <Text style={[kit.ghostText, { color: colors.brand }]}>+ Tambah Pelanggan Baru</Text>
        </Pressable>
      </View>}>
      {filtered.length === 0 ? <Text style={[kit.cardSub, { textAlign: "center", paddingVertical: 16 }]}>Pelanggan tidak ditemukan. Ketuk “+ Tambah Pelanggan Baru”.</Text> : filtered.map((customer) => <Pressable key={customer.id} testID={`order-customer-option-${customer.id}`} accessibilityRole="button" onPress={() => { onSelect(customer.id); setOpen(false); }} style={({ pressed }) => [kit.optionRow, pressed && { opacity: 0.8 }]}>
        <View style={{ flex: 1 }}><Text numberOfLines={1} style={kit.optionText}>{customer.name}</Text><Text numberOfLines={1} style={{ color: colors.onSurfaceTertiary, fontSize: 11, marginTop: 2 }}>{subOf(customer)}</Text></View>
        {customer.id === value ? <MaterialCommunityIcons name="check" size={18} color={colors.brand} /> : null}
      </Pressable>)}
    </Sheet>
    <CustomerFormSheet visible={addOpen} onClose={() => setAddOpen(false)} onSaved={(id) => { setAddOpen(false); onSelect(id); }} />
  </View>;
}
