import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import { BosData } from "@/src/data/types";

// Backup & Restore storage (#19). Backups are internal JSON snapshots kept on-device; the
// user never needs to paste JSON. Each entry keeps a timestamp + a human data summary.
const storage = {
  getItem: async (key: string): Promise<string | null> => {
    if (Platform.OS === "web") { try { return typeof localStorage !== "undefined" ? localStorage.getItem(key) : null; } catch { return null; } }
    return AsyncStorage.getItem(key);
  },
  setItem: async (key: string, value: string): Promise<void> => {
    if (Platform.OS === "web") { try { if (typeof localStorage !== "undefined") localStorage.setItem(key, value); } catch { /* ignore */ } return; }
    return AsyncStorage.setItem(key, value);
  },
};

const BACKUP_KEY = "bos.backups.v1";
const MAX_BACKUPS = 10;

export type BackupEntry = { id: string; at: string; summary: string; data: BosData };

export const backupSummary = (data: BosData) =>
  `${data.orders.length} order · ${data.products.length} produk · ${data.customers.length} pelanggan · ${data.expenses.length} pengeluaran`;

export async function listBackups(): Promise<BackupEntry[]> {
  try { const raw = await storage.getItem(BACKUP_KEY); return raw ? (JSON.parse(raw) as BackupEntry[]) : []; } catch { return []; }
}

export async function createBackup(data: BosData): Promise<BackupEntry[]> {
  const entry: BackupEntry = { id: `bkp-${Date.now().toString(36)}`, at: new Date().toISOString(), summary: backupSummary(data), data };
  const next = [entry, ...(await listBackups())].slice(0, MAX_BACKUPS);
  await storage.setItem(BACKUP_KEY, JSON.stringify(next));
  return next;
}

export async function deleteBackup(id: string): Promise<BackupEntry[]> {
  const next = (await listBackups()).filter((entry) => entry.id !== id);
  await storage.setItem(BACKUP_KEY, JSON.stringify(next));
  return next;
}
