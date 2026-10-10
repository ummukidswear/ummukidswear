export const monthNames = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

export const fullMonthNames = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

export const monthKeyOf = (isoDate: string) => isoDate.slice(0, 7);

export const monthLabel = (monthKey: string) => `${monthNames[Number(monthKey.slice(5)) - 1]} ${monthKey.slice(0, 4)}`;

export const fullMonthLabel = (monthKey: string) => `${fullMonthNames[Number(monthKey.slice(5)) - 1]} ${monthKey.slice(0, 4)}`;

export const shortMonthLabel = (monthKey: string) => `${monthNames[Number(monthKey.slice(5)) - 1]} '${monthKey.slice(2, 4)}`;

// Last calendar day of the month, used as the reference date for every
// "days since" calculation (inactive customers, dead stock, ...).
export const monthEndDate = (monthKey: string) => new Date(Number(monthKey.slice(0, 4)), Number(monthKey.slice(5)), 0);

export const daysBetween = (from: string, to: Date) => Math.max(0, Math.round((to.getTime() - new Date(`${from}T00:00:00`).getTime()) / 86400000));

export const previousMonthKey = (monthKey: string) => {
  const year = Number(monthKey.slice(0, 4)); const month = Number(monthKey.slice(5));
  const date = new Date(year, month - 2, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
};

// Six-month window ending at monthKey (inclusive), oldest first.
export const trailingMonths = (monthKey: string, count = 6) => {
  const keys: string[] = [];
  let cursor = monthKey;
  for (let index = 0; index < count; index += 1) { keys.unshift(cursor); cursor = previousMonthKey(cursor); }
  return keys;
};

export const formatRupiah = (value: number) => `Rp${Math.round(value).toLocaleString("id-ID")}`;

// Display a stored YYYY-MM-DD date as DD-MM-YYYY (e.g. 11-09-2026). Non-ISO input is
// returned unchanged so partial/legacy values never break the UI.
export const toDisplayDate = (iso: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  const [year, month, day] = iso.split("-");
  return `${day}-${month}-${year}`;
};

// Format ribuan Indonesia untuk input nominal (10.000). Menyimpan angka mentah (digit saja).
export const parseThousands = (text: string) => String(text ?? "").replace(/\D/g, "");
export const formatThousands = (raw: string | number) => {
  const digits = String(raw ?? "").replace(/\D/g, "");
  if (!digits) return "";
  return Number(digits).toLocaleString("id-ID");
};

export const toJt = (value: number) => Math.round(value / 1_000_000);

export const toRibu = (value: number) => Math.round(value / 1_000);

// Compact, precise money label for tight UI (e.g. per-channel omzet). Keeps sub-million
// values visible instead of rounding them away: >= 1 Jt -> "1,1 Jt", else "920 rb".
export const compactRupiah = (value: number) => {
  const amount = Math.max(0, Math.round(value));
  if (amount >= 1_000_000) return `Rp${(amount / 1_000_000).toFixed(1).replace(".", ",")} Jt`;
  if (amount >= 1_000) return `Rp${Math.round(amount / 1_000)} rb`;
  return `Rp${amount}`;
};
