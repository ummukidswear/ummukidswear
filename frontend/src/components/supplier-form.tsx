import { useEffect, useState } from "react";
import { View } from "react-native";
import { Text } from "@/src/components/text";
import { ConfirmSheet, Field, FullScreenForm, SearchableSelectField, SelectField, useKit } from "@/src/components/ui-kit";
import { newId, useBos } from "@/src/data/store";
import { possibleDuplicateSupplier } from "@/src/data/helpers";
import { citiesOf, cityOptions, provinceOptions } from "@/src/data/regions";
import { Supplier } from "@/src/data/types";
import { useTheme } from "@/src/theme";

type Draft = { id: string; name: string; phone: string; province: string; city: string; address: string; notes: string; status: "Aktif" | "Tidak Aktif" };

const toDraft = (supplier?: Supplier | null): Draft => ({
  id: supplier?.id ?? newId("sup"),
  name: supplier?.name ?? "",
  phone: supplier?.phone ?? "",
  province: supplier?.province ?? "",
  city: supplier?.city ?? "",
  address: supplier?.address ?? "",
  notes: supplier?.notes ?? "",
  status: (supplier?.status ?? "Aktif") as "Aktif" | "Tidak Aktif",
});

// Shared full-screen supplier Add/Edit form used by the list and detail screens. The
// footer buttons sit below the scrollable fields so they never cover any input. Editing
// updates the same master record; changing status never deletes history.
export function SupplierFormSheet({ visible, initial, onClose, onSaved }: { visible: boolean; initial?: Supplier | null; onClose: () => void; onSaved?: (id: string) => void }) {
  const { colors } = useTheme(); const kit = useKit(); const { data, upsert } = useBos();
  const [draft, setDraft] = useState<Draft>(toDraft(initial));
  const [error, setError] = useState("");
  const [dupWarn, setDupWarn] = useState(false);

  useEffect(() => { if (visible) { setDraft(toDraft(initial)); setError(""); setDupWarn(false); } }, [visible, initial]);

  const commit = () => {
    const supplier: Supplier = { id: draft.id, name: draft.name.trim(), phone: draft.phone.trim(), province: draft.province, city: draft.city.trim(), address: draft.address.trim(), notes: draft.notes.trim(), status: draft.status };
    upsert("suppliers", supplier as never, supplier.name || "Supplier");
    setDupWarn(false);
    onSaved?.(supplier.id);
    onClose();
  };

  const save = () => {
    if (!draft.name.trim()) { setError("Nama supplier wajib diisi."); return; }
    setError("");
    const duplicate = possibleDuplicateSupplier(data, draft.name, draft.phone, draft.id);
    if (duplicate) { setDupWarn(true); return; }
    commit();
  };

  return <>
    <FullScreenForm visible={visible} title={initial ? "Ubah Supplier" : "Tambah Supplier"} onClose={onClose} onSubmit={save} submitTestID="supplier-save-button">
      <Field label="Nama Supplier" value={draft.name} onChangeText={(value) => setDraft({ ...draft, name: value })} placeholder="Nama supplier" />
      <Field label="Telepon / WhatsApp" value={draft.phone} onChangeText={(value) => setDraft({ ...draft, phone: value })} placeholder="08xxxxxxxxxx" />
      <SearchableSelectField label="Provinsi" placeholder="Cari provinsi..." value={draft.province} options={provinceOptions()} onSelect={(value) => setDraft({ ...draft, province: value, city: citiesOf(value).includes(draft.city) ? draft.city : "" })} />
      {draft.province ? <SearchableSelectField label="Kota / Kabupaten" placeholder="Cari kota / kabupaten..." value={draft.city} options={cityOptions(draft.province, draft.city)} onSelect={(value) => setDraft({ ...draft, city: value })} /> : <View style={kit.fieldWrap}><Text style={kit.fieldLabel}>Kota / Kabupaten</Text><View style={[kit.selectRow, { opacity: 0.6 }]}><Text style={kit.selectText}>{draft.city || "Pilih provinsi terlebih dahulu"}</Text></View></View>}
      <Field label="Alamat (opsional)" value={draft.address} onChangeText={(value) => setDraft({ ...draft, address: value })} placeholder="Alamat lengkap" />
      <Field label="Catatan (opsional) · MOQ, jadwal kirim, kontak sales, syarat harga" value={draft.notes} onChangeText={(value) => setDraft({ ...draft, notes: value })} placeholder="Catatan operasional" />
      <SelectField label="Status" value={draft.status} options={[{ value: "Aktif", label: "Aktif" }, { value: "Tidak Aktif", label: "Tidak Aktif" }]} onSelect={(value) => setDraft({ ...draft, status: value as "Aktif" | "Tidak Aktif" })} />
      {error ? <Text testID="supplier-form-error" style={{ color: colors.error, fontSize: 11, marginTop: 4 }}>{error}</Text> : null}
    </FullScreenForm>
    <ConfirmSheet visible={dupWarn} title="Kemungkinan duplikat" confirmLabel="Simpan tetap"
      message="Ada supplier dengan nama atau nomor yang mirip. Data tidak digabung otomatis. Simpan sebagai supplier terpisah?"
      onCancel={() => setDupWarn(false)} onConfirm={commit} />
  </>;
}
