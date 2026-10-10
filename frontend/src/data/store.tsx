import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ActivityIndicator, Platform, View } from "react-native";
import { BosData, BusinessParams, ChannelCost, CollectionKey, Settings, Thresholds } from "@/src/data/types";
import { createSeedData, SCHEMA_VERSION } from "@/src/data/seed";
import { isPackagingComponent, isTaxComponent } from "@/src/data/profit";
import { clearMonthSelections } from "@/src/hooks/useAnalyticsMonth";
import { useTheme } from "@/src/theme";

// AsyncStorage 2.2.0 can hang on web (react-native-web + Expo Router 57) because
// its promise never resolves. Use localStorage directly on web; keep AsyncStorage
// for native platforms.
const storage = {
  getItem: async (key: string): Promise<string | null> => {
    if (Platform.OS === "web") {
      try { return typeof localStorage !== "undefined" ? localStorage.getItem(key) : null; } catch { return null; }
    }
    return AsyncStorage.getItem(key);
  },
  setItem: async (key: string, value: string): Promise<void> => {
    if (Platform.OS === "web") {
      try { if (typeof localStorage !== "undefined") localStorage.setItem(key, value); } catch { /* ignore */ }
      return;
    }
    return AsyncStorage.setItem(key, value);
  },
};

const STORAGE_KEY = "bos.data.v2";

// Migrasi schema v3: PPh 0,5% yang sebelumnya hardcoded di Profit Engine dipindah menjadi
// komponen master Biaya Channel (single source). Data lama mendapat komponen PPh global per
// channel dengan effectiveDate paling awal agar laba historis tidak berubah. Sekali jalan.
function migrate(parsed: Partial<BosData>): Partial<BosData> {
  const version = parsed.schemaVersion ?? 2;
  if (version >= SCHEMA_VERSION) return parsed;
  let costs: ChannelCost[] = [...(parsed.channelCosts ?? [])];
  (parsed.channels ?? []).forEach((channel) => {
    if (costs.some((cost) => cost.channelId === channel.id && isTaxComponent(cost.component))) return;
    costs.push({ id: `cc-pph-${channel.id}`, channelId: channel.id, sku: "", component: "PPh", type: "percent", value: 0.5, basis: "after_discount", effectiveDate: "2000-01-01", status: "Aktif" });
  });
  // Migrasi schema v4: Packaging berubah menjadi PER PAKET berdasarkan Jenis Pengiriman.
  // Row Packaging lama tanpa konfigurasi mendapat default: Reguler = biaya lama, Instan = 500.
  // Transaksi historis tidak diubah (tetap memakai snapshot lama) → laba historis utuh.
  costs = costs.map((cost) => (isPackagingComponent(cost.component) && !cost.packaging)
    ? { ...cost, packaging: { model: "by_shipping", shippingTypes: [{ id: `ship-reg-${cost.id}`, name: "Reguler", value: cost.value || 3000 }, { id: `ship-ins-${cost.id}`, name: "Instan", value: 500 }] } }
    : cost);
  return { ...parsed, channelCosts: costs, schemaVersion: SCHEMA_VERSION };
}

type Entity = { id: string };

type BosContextValue = {
  data: BosData;
  upsert: <K extends CollectionKey>(collection: K, item: BosData[K][number], label: string) => void;
  remove: (collection: CollectionKey, id: string, label: string) => void;
  patchParams: (patch: Partial<BusinessParams>) => void;
  patchThresholds: (patch: Partial<Thresholds>) => void;
  patchSettings: (patch: Partial<Settings>) => void;
  setActionStatus: (id: string, status: "open" | "done") => void;
  replaceAll: (next: BosData) => void;
  resetSeed: () => void;
  resetData: (collections: CollectionKey[]) => void;
  clearAudit: () => void;
};

const BosContext = createContext<BosContextValue | null>(null);

export const newId = (prefix: string) => `${prefix}-${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`;

export function BosProvider({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();
  const [data, setData] = useState<BosData | null>(null);
  const hydrated = useRef(false);

  useEffect(() => {
    // Safety net: never leave the user stuck on the spinner if storage hangs.
    const timeoutId = setTimeout(() => { if (!hydrated.current) { hydrated.current = true; setData(createSeedData()); } }, 3000);
    storage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (!raw) { setData(createSeedData()); return; }
        const seed = createSeedData();
        const parsed = migrate(JSON.parse(raw) as Partial<BosData>);
        // Deep-merge config blocks so newly-added keys (rules, thresholds.lowCashBalance, ...)
        // always exist without discarding the user's operational data.
        setData({
          ...seed,
          ...parsed,
          params: { ...seed.params, ...(parsed.params ?? {}) },
          thresholds: { ...seed.thresholds, ...(parsed.thresholds ?? {}) },
          settings: { ...seed.settings, ...(parsed.settings ?? {}) },
          rules: parsed.rules && parsed.rules.length >= seed.rules.length ? parsed.rules : seed.rules,
        } as BosData);
      })
      .catch(() => setData(createSeedData()))
      .finally(() => { hydrated.current = true; clearTimeout(timeoutId); });
    return () => clearTimeout(timeoutId);
  }, []);

  useEffect(() => { if (data && hydrated.current) storage.setItem(STORAGE_KEY, JSON.stringify(data)).catch(() => undefined); }, [data]);

  const audit = (current: BosData, action: "Tambah" | "Ubah" | "Hapus" | "Import" | "Reset", entity: string, label: string) =>
    [{ id: newId("aud"), at: new Date().toISOString(), action, entity, label }, ...current.audit].slice(0, 200);

  const upsert = useCallback<BosContextValue["upsert"]>((collection, item, label) => setData((current) => {
    if (!current) return current;
    const list = current[collection] as Entity[];
    const exists = list.some((entry) => entry.id === (item as Entity).id);
    const next = exists ? list.map((entry) => (entry.id === (item as Entity).id ? item : entry)) : [...list, item];
    return { ...current, [collection]: next, audit: audit(current, exists ? "Ubah" : "Tambah", collection, label) } as BosData;
  }), []);

  const remove = useCallback<BosContextValue["remove"]>((collection, id, label) => setData((current) => {
    if (!current) return current;
    const list = current[collection] as Entity[];
    return { ...current, [collection]: list.filter((entry) => entry.id !== id), audit: audit(current, "Hapus", collection, label) } as BosData;
  }), []);

  const patchParams = useCallback((patch: Partial<BusinessParams>) => setData((current) => current && ({ ...current, params: { ...current.params, ...patch }, audit: audit(current, "Ubah", "params", "Parameter Bisnis") })), []);
  const patchThresholds = useCallback((patch: Partial<Thresholds>) => setData((current) => current && ({ ...current, thresholds: { ...current.thresholds, ...patch }, audit: audit(current, "Ubah", "thresholds", "Threshold") })), []);
  const patchSettings = useCallback((patch: Partial<Settings>) => setData((current) => current && ({ ...current, settings: { ...current.settings, ...patch }, audit: audit(current, "Ubah", "settings", "Pengaturan") })), []);
  const setActionStatus = useCallback((id: string, status: "open" | "done") => setData((current) => current && ({ ...current, actionStatus: { ...current.actionStatus, [id]: status } })), []);
  const replaceAll = useCallback((next: BosData) => setData((current) => ({ ...next, audit: current ? audit(current, "Import", "semua data", "Import data") : next.audit })), []);
  const resetSeed = useCallback(() => setData((current) => { const seeded = createSeedData(); return { ...seeded, audit: current ? audit(current, "Reset", "semua data", "Reset ke data contoh") : seeded.audit }; }), []);
  // Reset Data: empty only the operational collections the user selected in the checklist.
  // Records are deleted but the modules/config stay: Parameter Bisnis, Threshold, Business
  // Rules, Pengaturan, Notifikasi and Audit Log are never touched. Stale derived state
  // (status Action, pilihan bulan Analytics) ikut dibersihkan sehingga seluruh KPI, tren,
  // Alert/Action, Profit Engine & Health Score dihitung ulang murni dari data tersisa.
  const resetData = useCallback((collections: CollectionKey[]) => setData((current) => {
    if (!current) return current;
    if (collections.length === 0) return current;
    const patch: Partial<Record<CollectionKey, never[]>> = {};
    collections.forEach((key) => { patch[key] = []; });
    clearMonthSelections();
    return { ...current, ...patch, actionStatus: {}, audit: audit(current, "Reset", "data operasional", `Reset data (${collections.length} modul)`) };
  }), []);

  // Hapus Riwayat Log: kosongkan HANYA catatan Audit Log. Data operasional & konfigurasi BOS
  // tidak tersentuh; struktur log & pencatatan aktivitas tetap sama sehingga aktivitas baru
  // langsung tercatat lagi setelah dihapus. Tidak dapat dipulihkan.
  const clearAudit = useCallback(() => setData((current) => current && ({ ...current, audit: [] })), []);

  const value = useMemo(() => data && ({ data, upsert, remove, patchParams, patchThresholds, patchSettings, setActionStatus, replaceAll, resetSeed, resetData, clearAudit }), [data, upsert, remove, patchParams, patchThresholds, patchSettings, setActionStatus, replaceAll, resetSeed, resetData, clearAudit]);

  if (!value) return <View style={{ flex: 1, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" }}><ActivityIndicator color={colors.brand} /></View>;
  return <BosContext.Provider value={value}>{children}</BosContext.Provider>;
}

export function useBos() {
  const value = useContext(BosContext);
  if (!value) throw new Error("useBos must be used inside BosProvider");
  return value;
}
