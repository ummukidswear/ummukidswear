import { Platform } from "react-native";
import * as XLSX from "xlsx";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import * as Print from "expo-print";

// Semua ekspor membaca payload tabular yang sudah dihitung dari SSOT/engine BOS.
// Modul ini hanya bertugas mengubah data yang sudah ada menjadi file (PDF / Excel / CSV);
// tidak pernah membuat, menyalin, atau menyimpan data baru ke store.
export type ExportFormat = "pdf" | "xlsx" | "csv";

export type ExportTable = {
  fileBase: string; // nama file tanpa ekstensi
  title: string; // judul untuk PDF siap cetak
  meta: string[]; // baris info (nama toko, periode, dibuat pada, dsb.)
  headers: string[];
  rows: (string | number)[][];
};

export function nowStamp(): string {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${pad(now.getDate())}-${pad(now.getMonth() + 1)}-${now.getFullYear()} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

function escapeHtml(value: string | number): string {
  return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function buildHtml(table: ExportTable): string {
  const head = `<tr>${table.headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr>`;
  const body = table.rows
    .map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`)
    .join("");
  return `<!doctype html><html><head><meta charset="utf-8" />
  <style>
    * { font-family: -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; -webkit-print-color-adjust: exact; }
    body { padding: 28px; color: #111827; }
    h1 { font-size: 18px; margin: 0 0 6px; }
    .meta { font-size: 11px; color: #6b7280; margin: 2px 0; }
    table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 11px; }
    th, td { border: 1px solid #d1d5db; padding: 6px 9px; text-align: left; vertical-align: top; }
    th { background: #eef2f5; font-weight: 700; }
    tbody tr:nth-child(even) td { background: #f8fafc; }
  </style></head><body>
    <h1>${escapeHtml(table.title)}</h1>
    ${table.meta.map((line) => `<div class="meta">${escapeHtml(line)}</div>`).join("")}
    <table><thead>${head}</thead><tbody>${body}</tbody></table>
  </body></html>`;
}

function buildSheet(table: ExportTable, includeMeta: boolean) {
  const aoa: (string | number)[][] = [];
  if (includeMeta) {
    aoa.push([table.title]);
    table.meta.forEach((line) => aoa.push([line]));
    aoa.push([]);
  }
  aoa.push(table.headers);
  table.rows.forEach((row) => aoa.push(row));
  return XLSX.utils.aoa_to_sheet(aoa);
}

async function exportSheet(table: ExportTable, format: "xlsx" | "csv"): Promise<void> {
  const worksheet = buildSheet(table, format === "xlsx");
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Data");
  const fileName = `${table.fileBase}.${format}`;

  if (Platform.OS === "web") {
    XLSX.writeFile(workbook, fileName, { bookType: format });
    return;
  }

  const base64 = XLSX.write(workbook, { type: "base64", bookType: format });
  const uri = `${FileSystem.cacheDirectory}${fileName}`;
  await FileSystem.writeAsStringAsync(uri, base64, { encoding: FileSystem.EncodingType.Base64 });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      mimeType: format === "xlsx" ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" : "text/csv",
      dialogTitle: table.title,
      UTI: format === "xlsx" ? "org.openxmlformats.spreadsheetml.sheet" : "public.comma-separated-values-text",
    });
  }
}

async function exportPdf(table: ExportTable): Promise<void> {
  const html = buildHtml(table);

  if (Platform.OS === "web") {
    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    document.body.appendChild(iframe);
    const frameDoc = iframe.contentWindow?.document;
    if (frameDoc) {
      frameDoc.open();
      frameDoc.write(html);
      frameDoc.close();
      setTimeout(() => {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
        setTimeout(() => document.body.removeChild(iframe), 1500);
      }, 350);
    }
    return;
  }

  const { uri } = await Print.printToFileAsync({ html });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, { mimeType: "application/pdf", dialogTitle: table.title, UTI: "com.adobe.pdf" });
  }
}

export async function exportTable(table: ExportTable, format: ExportFormat): Promise<void> {
  if (format === "pdf") return exportPdf(table);
  return exportSheet(table, format);
}
