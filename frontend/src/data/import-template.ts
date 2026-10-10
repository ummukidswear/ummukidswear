import { Platform } from "react-native";
import * as XLSX from "xlsx";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { BosData } from "@/src/data/types";
import { CrudDef, FieldDef } from "@/src/data/modules";

// Template Impor Data (.xlsx) — panduan format file impor per jenis data. Template mengikuti
// struktur field BOS: nama kolom = label field, sheet "Petunjuk" berisi penanda Wajib/Optional,
// format angka/tanggal & aturan khusus, dan sheet "Data" berisi 1 baris contoh. Template hanya
// panduan; tidak menulis apa pun ke store — impor tetap lewat Pemetaan Kolom & Validasi.

const collName: Record<string, string> = { suppliers: "Supplier", channels: "Channel Penjualan", accounts: "Akun Kas", customers: "Pelanggan", products: "Produk" };

// Field yang bisa dituangkan sebagai kolom datar (kecuali item baris & multiselect).
export const templatableFields = (def: CrudDef): FieldDef[] => def.fields.filter((field) => field.type !== "lines" && field.type !== "multiselect" && field.type !== "toggle" && field.type !== "shipping");

const sampleName = (collection: CrudDef["collection"]): string => {
  switch (collection) {
    case "products": return "Kopi Arabika 250g";
    case "customers": return "Budi Santoso";
    case "suppliers": return "CV Sumber Baru";
    case "channels": return "Marketplace X";
    case "accounts": return "Kas Utama";
    default: return "Contoh";
  }
};

function exampleValue(field: FieldDef, def: CrudDef, data: BosData): string | number {
  const key = field.key.toLowerCase();
  if (field.type === "date") return new Date().toISOString().slice(0, 10);
  if (field.type === "month") return new Date().toISOString().slice(0, 7);
  if (field.options && field.options.length) return field.options[0].label;
  if (field.from) { const list = (data[field.from] as { name?: string }[]) ?? []; return list[0]?.name ?? ""; }
  if (field.type === "province") return "Sulawesi Selatan";
  if (field.type === "city") return "Makassar";
  if (field.type === "number") {
    if (field.money) {
      if (key.includes("price") || key.includes("harga")) return 85000;
      if (key.includes("cost") || key.includes("hpp")) return 53000;
      if (key.includes("opening") || key.includes("saldo")) return 1000000;
      if (key.includes("amount") || key.includes("target")) return 150000;
      return 10000;
    }
    if (key.includes("margin") || key.includes("pct")) return 20;
    if (key.includes("rop")) return 10;
    if (key.includes("stock") || key.includes("stok")) return 50;
    if (key.includes("package") || key.includes("paket")) return 1;
    return 10;
  }
  if (key === "sku") return "SKU-001";
  if (key === "code") return "";
  if (key.includes("phone") || key.includes("telepon")) return "081200000000";
  if (key.includes("name") || key === "nama") return sampleName(def.collection);
  if (key.includes("note") || key.includes("catatan")) return "";
  return "Contoh";
}

function formatHint(field: FieldDef): string {
  const key = field.key.toLowerCase();
  if (field.type === "date") return "Tanggal format YYYY-MM-DD (mis. 2026-09-15)";
  if (field.type === "month") return "Bulan format YYYY-MM (mis. 2026-09)";
  if (field.options && field.options.length) return `Pilih salah satu: ${field.options.map((option) => option.label).join(" / ")}`;
  if (field.from) return `Isi NAMA sesuai master ${collName[field.from] ?? field.from} yang sudah terdaftar. Jika tidak ditemukan, baris ditandai Warning.`;
  if (field.type === "province") return "Nama provinsi (mis. Sulawesi Selatan)";
  if (field.type === "city") return "Nama kota/kabupaten (mis. Makassar)";
  if (field.type === "number") {
    if (field.money) return "Angka Rupiah tanpa titik/koma (mis. 85000)";
    if (key.includes("margin") || key.includes("pct")) return "Persen, angka saja (mis. 20)";
    return "Angka bulat (mis. 10)";
  }
  if (field.key === "sku") return "Kode unik produk, tidak boleh sama dengan SKU lain";
  if (field.key === "code") return "Kosongkan — dibuat otomatis oleh sistem";
  return "Teks bebas";
}

async function saveWorkbook(workbook: XLSX.WorkBook, fileName: string): Promise<void> {
  if (Platform.OS === "web") { XLSX.writeFile(workbook, fileName, { bookType: "xlsx" }); return; }
  const base64 = XLSX.write(workbook, { type: "base64", bookType: "xlsx" });
  const uri = `${FileSystem.cacheDirectory}${fileName}`;
  await FileSystem.writeAsStringAsync(uri, base64, { encoding: FileSystem.EncodingType.Base64 });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, { mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", dialogTitle: `Template ${fileName}`, UTI: "org.openxmlformats.spreadsheetml.sheet" });
  }
}

export async function downloadImportTemplate(def: CrudDef, data: BosData): Promise<void> {
  const fields = templatableFields(def);
  const headers = fields.map((field) => field.label);
  const example = fields.map((field) => exampleValue(field, def, data));

  const dataSheet = XLSX.utils.aoa_to_sheet([headers, example]);
  dataSheet["!cols"] = headers.map((header) => ({ wch: Math.max(14, header.length + 2) }));

  const guideRows: (string)[][] = [["Kolom", "Wajib / Optional", "Format & Aturan"]];
  fields.forEach((field) => guideRows.push([field.label, field.optional ? "Optional" : "Wajib", formatHint(field)]));
  if (def.fields.some((field) => field.type === "lines")) guideRows.push(["Item Produk", "-", "Tambahkan item produk di dalam aplikasi setelah impor (tidak didukung via template datar)."]);
  guideRows.push([]);
  guideRows.push(["Catatan", "", "Baris contoh pada sheet Data hanya panduan — hapus/ganti dengan data Anda. Template tidak memasukkan data contoh ke BOS secara otomatis."]);
  const guideSheet = XLSX.utils.aoa_to_sheet(guideRows);
  guideSheet["!cols"] = [{ wch: 24 }, { wch: 16 }, { wch: 70 }];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, dataSheet, "Data");
  XLSX.utils.book_append_sheet(workbook, guideSheet, "Petunjuk");
  await saveWorkbook(workbook, `Template-Impor-${def.slug}.xlsx`);
}
