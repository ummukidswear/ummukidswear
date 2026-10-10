import { useEffect, useState } from "react";
import { View } from "react-native";
import { Text } from "@/src/components/text";
import { ConfirmSheet, DateField, Field, FullScreenForm, SearchableSelectField, useKit } from "@/src/components/ui-kit";
import { useBos } from "@/src/data/store";
import { nextCustomerCode, possibleDuplicateCustomer } from "@/src/data/helpers";
import { citiesOf, cityOptions, provinceOptions } from "@/src/data/regions";
import { Customer } from "@/src/data/types";
import { useTheme } from "@/src/theme";

type Draft = { id: string; name: string; phone: string; province: string; city: string; joinedAt: string; notes: string };

const toDraft = (customer?: Customer | null): Draft => ({
  id: customer?.id ?? "",
  name: customer?.name ?? "",
  phone: customer?.phone ?? "",
  province: customer?.province ?? "",
  city: customer?.city ?? "",
  joinedAt: customer?.joinedAt ?? new Date().toISOString().slice(0, 10),
  notes: customer?.notes ?? "",
});

// Full-screen Pelanggan Add/Edit form. ID Pelanggan (PLG-XXXX) dibuat otomatis saat disimpan,
// unik & permanen, dan tampil read-only. Provinsi & Kota memakai reference data lokal yang
// sama dengan Supplier (searchable, tanpa GPS/free-text). Alamat lengkap TIDAK disimpan di
// master pelanggan (mengikuti data transaksi Order). Dipakai oleh flow "+ Tambah Pelanggan
// Baru" pada Order sehingga pelanggan baru otomatis masuk Master Pelanggan.
export function CustomerFormSheet({ visible, initial, onClose, onSaved }: { visible: boolean; initial?: Customer | null; onClose: () => void; onSaved?: (id: string) => void }) {
  const { colors } = useTheme(); const kit = useKit(); const { data, upsert } = useBos();
  const [draft, setDraft] = useState<Draft>(toDraft(initial));
  const [error, setError] = useState("");
  const [dupWarn, setDupWarn] = useState(false);

  useEffect(() => { if (visible) { setDraft(toDraft(initial)); setError(""); setDupWarn(false); } }, [visible, initial]);

  const commit = () => {
    const id = draft.id || nextCustomerCode(data);
    const customer: Customer = { id, name: draft.name.trim(), phone: draft.phone.trim(), province: draft.province, city: draft.city.trim(), joinedAt: draft.joinedAt, notes: draft.notes.trim() };
    upsert("customers", customer as never, customer.name || "Pelanggan");
    setDupWarn(false);
    onSaved?.(id);
    onClose();
  };

  const save = () => {
    if (!draft.name.trim()) { setError("Nama pelanggan wajib diisi."); return; }
    setError("");
    const duplicate = possibleDuplicateCustomer(data, draft.phone, draft.id);
    if (duplicate) { setDupWarn(true); return; }
    commit();
  };

  return <>
    <FullScreenForm visible={visible} title={initial ? "Ubah Pelanggan" : "Tambah Pelanggan"} onClose={onClose} onSubmit={save} submitTestID="customer-save-button">
      <View style={kit.fieldWrap}>
        <Text style={kit.fieldLabel}>ID Pelanggan</Text>
        <View style={[kit.input, { justifyContent: "center" }]}><Text style={{ color: colors.onSurfaceTertiary, fontSize: 13 }}>{draft.id ? `${draft.id} · terkunci` : "Dibuat otomatis saat disimpan (PLG-0001)"}</Text></View>
      </View>
      <Field label="Nama" value={draft.name} onChangeText={(value) => setDraft({ ...draft, name: value })} placeholder="Nama pelanggan" />
      <Field label="Telepon" value={draft.phone} onChangeText={(value) => setDraft({ ...draft, phone: value })} placeholder="08xxxxxxxxxx" />
      <SearchableSelectField label="Provinsi" placeholder="Cari provinsi..." value={draft.province} options={provinceOptions()} onSelect={(value) => setDraft({ ...draft, province: value, city: citiesOf(value).includes(draft.city) ? draft.city : "" })} />
      {draft.province ? <SearchableSelectField label="Kota / Kabupaten" placeholder="Cari kota / kabupaten..." value={draft.city} options={cityOptions(draft.province, draft.city)} onSelect={(value) => setDraft({ ...draft, city: value })} /> : <View style={kit.fieldWrap}><Text style={kit.fieldLabel}>Kota / Kabupaten</Text><View style={[kit.selectRow, { opacity: 0.6 }]}><Text style={kit.selectText}>{draft.city || "Pilih provinsi terlebih dahulu"}</Text></View></View>}
      <DateField label="Tanggal Gabung" value={draft.joinedAt} onChange={(value) => setDraft({ ...draft, joinedAt: value })} />
      <Field label="Catatan (opsional)" value={draft.notes} onChangeText={(value) => setDraft({ ...draft, notes: value })} placeholder="Catatan" />
      {error ? <Text testID="customer-form-error" style={{ color: colors.error, fontSize: 11, marginTop: 4 }}>{error}</Text> : null}
    </FullScreenForm>
    <ConfirmSheet visible={dupWarn} title="Kemungkinan duplikat" confirmLabel="Simpan tetap"
      message="Ada pelanggan dengan nomor telepon yang sama. Data tidak digabung otomatis. Simpan sebagai pelanggan terpisah?"
      onCancel={() => setDupWarn(false)} onConfirm={commit} />
  </>;
}
