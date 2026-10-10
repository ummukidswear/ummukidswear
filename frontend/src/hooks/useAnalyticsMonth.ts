import { useState } from "react";
import { useBos } from "@/src/data/store";
import { availableMonthKeys } from "@/src/data/calc";

// Per-tab memory of an EXPLICIT user selection so each dashboard keeps the period the owner
// chose while browsing across navigation. When a tab has NO explicit pick — or the picked
// month no longer exists in the data — the dashboard follows the LATEST month that actually
// has source data. This keeps Home/Analytics in sync with newly recorded transactions and
// consistent with Alert/Action (which always read the latest month), so source data added in
// a new period is reflected everywhere instead of leaving these tabs pinned to a stale month.
const explicitPick: Record<string, string> = {};

// Dipanggil saat Reset Data: buang pilihan bulan eksplisit agar tab kembali mengikuti bulan
// terbaru dari data tersisa (tidak ada state/cache bulan lama yang tertinggal).
export const clearMonthSelections = () => { Object.keys(explicitPick).forEach((key) => { delete explicitPick[key]; }); };

export function useAnalyticsMonth(tabKey: string) {
  const { data } = useBos();
  const months = availableMonthKeys(data);
  const latest = months[months.length - 1];
  const [, bump] = useState(0);
  const picked = explicitPick[tabKey];
  const selectedMonth = picked && months.includes(picked) ? picked : latest;
  const setSelectedMonth = (value: string) => { explicitPick[tabKey] = value; bump((count) => count + 1); };
  return { data, months, selectedMonth, setSelectedMonth };
}
