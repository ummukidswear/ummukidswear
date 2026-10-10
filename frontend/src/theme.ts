// Design tokens for BOS Analytics Pelanggan. Values mirror design_guidelines.json.
//
// The keys match the "color" block of /app/design_guidelines.json. Fill the
// values from that file (or from the user's brand colors). Keep every key; do
// not add a second theme or colors file; do not write color literals in
// components.
//
// How the names work: a plain key is a background, and its `on` partner is the
// text or icon color that sits on top of it. Always use them as a pair.
//   <View style={{ backgroundColor: colors.brandPrimary }}>
//     <Text style={{ color: colors.onBrandPrimary }}>Continue</Text>
//   </View>
//
// Styling a screen or component: build the sheet with makeStyles so colors
// and layout live together and follow the active scheme:
//   const useStyles = makeStyles((colors) => ({
//     card: { backgroundColor: colors.surfaceSecondary, padding: 16 },
//     title: { color: colors.onSurfaceSecondary, fontSize: 16 },
//   }));
//   function Screen() {
//     const styles = useStyles();
//     return <View style={styles.card}><Text style={styles.title}>Hi</Text></View>;
//   }
// For color props that are not styles (icon color, placeholderTextColor,
// ActivityIndicator) read useTheme().colors inside the component.
// Never call StyleSheet.create with color values at module level; it cannot
// follow the scheme.
//
// To support dark mode later: add `dark` to `themes` with every key filled.
// Nothing else changes; the device setting takes over automatically.
// Feel free to add as many new colors as you need to support the design guidelines.

import { useMemo, useSyncExternalStore } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Appearance, Platform, StyleSheet } from "react-native";

export type ColorScheme = "light" | "dark";

// Typography tokens. "Google Sans" tidak didistribusikan untuk umum, jadi dipakai
// Plus Jakarta Sans — padanan open-source terdekat (geometric sans, Google Fonts).
// Dipakai untuk label Bottom Navigation; font dimuat di app/_layout.tsx.
export const fontSans = "PlusJakartaSans_700Bold";
export const fontSansHeavy = "PlusJakartaSans_800ExtraBold";
export const fontSansRegular = "PlusJakartaSans_400Regular";
export const fontSansMedium = "PlusJakartaSans_500Medium";
export const fontSansSemibold = "PlusJakartaSans_600SemiBold";

// Preferensi tema yang dipilih user di More > Sistem > Tema. "system" mengikuti
// tema perangkat. Default "dark" = tampilan BOS saat ini.
export type ThemePreference = "light" | "dark" | "system";

const dark = {
  // ---------------------------------------------------------------------------
  // Surfaces: backgrounds, from the screen down to small fills.
  // Each `on` key is the text and icon color for that background.
  // ---------------------------------------------------------------------------
  surface: "#0E1217",
  onSurface: "#F0F4F8",
  surfaceSecondary: "#171D26",
  onSurfaceSecondary: "#C5D0DE",
  surfaceTertiary: "#212A38",
  onSurfaceTertiary: "#8C9BB0",
  surfaceInverse: "#FFFFFF",
  onSurfaceInverse: "#0E1217",
  muted: "#8C9BB0",

  // ---------------------------------------------------------------------------
  // Brand: palet resmi BOS Pink. Primary Pink untuk aksen/ikon aktif/indikator,
  // Pressed Pink untuk kondisi ditekan; tint gelap untuk latar aksen lembut.
  // ---------------------------------------------------------------------------
  brand: "#FF5C93",
  onBrand: "#0E1217",
  brandPrimary: "#FF5C93",
  onBrandPrimary: "#0E1217",
  brandSecondary: "#E9477D",
  onBrandSecondary: "#FFFFFF",
  brandTertiary: "#3B1A28",
  onBrandTertiary: "#FF5C93",

  // ---------------------------------------------------------------------------
  // Status: semantic only, never decorative. Fill for badges, banners and
  // toasts; the `on` key is text on that fill. The plain key is also safe as
  // text on `surface`.
  // ---------------------------------------------------------------------------
  success: "#00E676",
  onSuccess: "#0E1217",
  warning: "#FFEA00",
  onWarning: "#0E1217",
  error: "#FF3D00",
  onError: "#FFFFFF",
  info: "#FF5C93",
  onInfo: "#0E1217",

  // ---------------------------------------------------------------------------
  // Lines
  // ---------------------------------------------------------------------------
  border: "#212A38",
  borderStrong: "#FF5C93",
  divider: "#1C2532",

  // ---------------------------------------------------------------------------
  // Refinement Beranda (light mode): nilai dark SAMA dengan token yang sudah
  // dipakai Beranda saat ini, sehingga tema Dark tidak berubah sama sekali.
  // Di tema Light, token ini mengurangi dominasi pink sesuai referensi resmi.
  // ---------------------------------------------------------------------------
  surfaceSoft: "#0E1217",
  fillSoft: "#212A38",
  trackSoft: "#212A38",
  gaugeTrack: "#212A38",
  borderSoft: "#212A38",
  successSoft: "#0C2E1D",
  warningSoft: "#342A0B",
  errorSoft: "#371308",
  brandSoft: "#3B1A28",
};

export type ThemeColors = typeof dark;

// Light palette: same keys, same pairing rules. Palet resmi BOS Pink:
// Pink Surface untuk latar layar, Soft Pink untuk latar aksen lembut, Pink
// Border untuk garis, Pink Text (#D63378) sebagai aksen agar tetap terbaca di
// latar terang, Primary Pink untuk isian utama, Pressed Pink saat ditekan.
const light: ThemeColors = {
  surface: "#FFF0F5",
  onSurface: "#0E1217",
  surfaceSecondary: "#FFFFFF",
  onSurfaceSecondary: "#4A3540",
  surfaceTertiary: "#FFD6E3",
  onSurfaceTertiary: "#8E5A70",
  surfaceInverse: "#0E1217",
  onSurfaceInverse: "#FFFFFF",
  muted: "#8E5A70",

  brand: "#D63378",
  onBrand: "#FFFFFF",
  brandPrimary: "#FF5C93",
  onBrandPrimary: "#0E1217",
  brandSecondary: "#E9477D",
  onBrandSecondary: "#FFFFFF",
  brandTertiary: "#FFD6E3",
  onBrandTertiary: "#D63378",

  success: "#00A862",
  onSuccess: "#FFFFFF",
  warning: "#E3B008",
  onWarning: "#2A2200",
  error: "#D92D20",
  onError: "#FFFFFF",
  info: "#D63378",
  onInfo: "#FFFFFF",

  border: "#F3B4CB",
  borderStrong: "#FF5C93",
  divider: "#FFD6E3",

  // Refinement Beranda light: latar pink sangat muda, kartu/fill netral sangat
  // muda, border pink pucat tipis, dan tint status lembut untuk baris Insight.
  surfaceSoft: "#FDF6FA",
  fillSoft: "#FAF4F8",
  trackSoft: "#F3E6ED",
  gaugeTrack: "#F3E6ED",
  borderSoft: "#F8D7E4",
  successSoft: "#E4F5EB",
  warningSoft: "#FBEFD8",
  errorSoft: "#FAE5E2",
  brandSoft: "#FCE2EC",
};

export const defaultScheme = "dark" satisfies ColorScheme;

export const themes: Record<ColorScheme, ThemeColors> = { light, dark };

// ---------------------------------------------------------------------------
// Theme preference store (Light / Dark / System). Module-level so every
// useTheme() consumer re-renders on change; persisted on the device so the
// choice survives app restarts. Web uses localStorage synchronously (no flash
// on first paint); native hydrates from AsyncStorage then notifies.
// ---------------------------------------------------------------------------
const THEME_STORAGE_KEY = "bos.theme.v1";
const isPreference = (value: string | null): value is ThemePreference => value === "light" || value === "dark" || value === "system";

const themeListeners = new Set<() => void>();
const emitThemeChange = () => { themeListeners.forEach((listener) => listener()); };
const subscribeTheme = (listener: () => void) => { themeListeners.add(listener); return () => { themeListeners.delete(listener); }; };

// System scheme tracking. On web, RNW Appearance change events are unreliable,
// so prefers-color-scheme is observed directly; native uses Appearance.
const getSystemScheme = (): ColorScheme => {
  if (Platform.OS === "web") {
    try {
      if (typeof window !== "undefined" && typeof window.matchMedia === "function") {
        return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
      }
    } catch { /* ignore */ }
    return defaultScheme;
  }
  return Appearance.getColorScheme() === "light" ? "light" : "dark";
};

let systemScheme: ColorScheme = getSystemScheme();

if (Platform.OS === "web") {
  try {
    if (typeof window !== "undefined" && typeof window.matchMedia === "function") {
      const media = window.matchMedia("(prefers-color-scheme: dark)");
      const onMediaChange = () => { const next = getSystemScheme(); if (next !== systemScheme) { systemScheme = next; emitThemeChange(); } };
      if (typeof media.addEventListener === "function") media.addEventListener("change", onMediaChange);
      else if (typeof media.addListener === "function") media.addListener(onMediaChange);
    }
  } catch { /* ignore */ }
} else {
  Appearance.addChangeListener?.(({ colorScheme }) => {
    const next: ColorScheme = colorScheme === "light" ? "light" : "dark";
    if (next !== systemScheme) { systemScheme = next; emitThemeChange(); }
  });
}

let preference: ThemePreference = (() => {
  if (Platform.OS === "web") {
    try { const saved = typeof localStorage !== "undefined" ? localStorage.getItem(THEME_STORAGE_KEY) : null; if (isPreference(saved)) return saved; } catch { /* ignore */ }
  }
  return defaultScheme;
})();

if (Platform.OS !== "web") {
  AsyncStorage.getItem(THEME_STORAGE_KEY)
    .then((saved) => { if (isPreference(saved) && saved !== preference) { preference = saved; emitThemeChange(); } })
    .catch(() => undefined);
}

export function getThemePreference(): ThemePreference {
  return preference;
}

export function setThemePreference(next: ThemePreference) {
  preference = next;
  if (Platform.OS === "web") {
    try { if (typeof localStorage !== "undefined") localStorage.setItem(THEME_STORAGE_KEY, next); } catch { /* ignore */ }
  } else {
    AsyncStorage.setItem(THEME_STORAGE_KEY, next).catch(() => undefined);
  }
  emitThemeChange();
}

export function useThemePreference(): ThemePreference {
  return useSyncExternalStore<ThemePreference>(subscribeTheme, getThemePreference, () => defaultScheme);
}

// In-app theme toggle, only after `dark` exists in `themes`. Call
// setColorScheme("dark"), setColorScheme("light"), or setColorScheme(null) to
// follow the device. Every useTheme() consumer re-renders. Persisting the
// choice and re-applying it on launch is the toggle's job.
export function setColorScheme(scheme: ColorScheme | null) {
  Appearance.setColorScheme?.(scheme ?? "unspecified");
}

// Native chrome (alerts, pickers) follows the DEVICE scheme so System mode can
// react to device changes; Light/Dark come from the in-app preference above.
// Optional call because react-native-web does not implement it.
setColorScheme?.(null);

export function useTheme(): { scheme: ColorScheme; colors: ThemeColors; preference: ThemePreference } {
  const pref = useSyncExternalStore<ThemePreference>(subscribeTheme, getThemePreference, () => defaultScheme);
  const system = useSyncExternalStore<ColorScheme>(subscribeTheme, () => systemScheme, () => defaultScheme);
  const scheme: ColorScheme = pref === "system" ? system : pref;
  return { scheme, colors: themes[scheme], preference: pref };
}

// Themed StyleSheet: returns a hook that builds the sheet from the active
// scheme's colors and memoizes it until the scheme changes.
export function makeStyles<T extends StyleSheet.NamedStyles<T> | StyleSheet.NamedStyles<any>>(
  factory: (colors: ThemeColors) => T & StyleSheet.NamedStyles<any>,
): () => T {
  return function useStyles(): T {
    const { colors } = useTheme();
    return useMemo(() => StyleSheet.create(factory(colors)), [colors]);
  };
}


