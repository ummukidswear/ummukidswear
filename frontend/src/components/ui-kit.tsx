import React, { useState } from "react";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { StatusBar as ExpoStatusBar } from "expo-status-bar";
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StatusBar, StyleSheet, Switch, useWindowDimensions, View } from "react-native";
import { Text, TextInput } from "@/src/components/text";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { toDisplayDate, formatThousands, parseThousands, monthLabel } from "@/src/data/time";
import { makeStyles, useTheme } from "@/src/theme";

// Status bar yang mengikuti tema aktif: ikon terang di tema gelap, ikon gelap
// di tema terang. Dipakai semua halaman menggantikan <StatusBar style="light" />.
export function ThemedStatusBar() {
  const { scheme } = useTheme();
  return <ExpoStatusBar style={scheme === "dark" ? "light" : "dark"} />;
}

// Shared building blocks for the More modules. Same dark premium language as the
// dashboards: surfaceSecondary cards, cyan brand accents, 8pt rhythm.
export const useKit = makeStyles((palette) => ({
  screen: { flex: 1, backgroundColor: palette.surface },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingBottom: 8, gap: 10 },
  backButton: { width: 36, height: 36, borderRadius: 11, backgroundColor: palette.surfaceSecondary, borderWidth: 1, borderColor: palette.border, alignItems: "center", justifyContent: "center" },
  headerCopy: { flex: 1 },
  eyebrow: { color: palette.brand, fontSize: 9, fontWeight: "800", letterSpacing: 1.2, textTransform: "uppercase" },
  title: { color: palette.onSurface, fontSize: 20, fontWeight: "800", letterSpacing: -0.5, marginTop: 1 },
  subtitle: { color: palette.onSurfaceTertiary, fontSize: 10, marginTop: 1 },
  body: { paddingHorizontal: 12, paddingBottom: 24 },
  card: { backgroundColor: palette.surfaceSecondary, borderRadius: 14, borderWidth: 1, borderColor: palette.border, padding: 11, marginBottom: 8 },
  cardTitle: { color: palette.onSurface, fontSize: 13, fontWeight: "800" },
  cardSub: { color: palette.onSurfaceTertiary, fontSize: 10, marginTop: 2 },
  row: { flexDirection: "row", alignItems: "center", backgroundColor: palette.surfaceSecondary, borderRadius: 12, borderWidth: 1, borderColor: palette.border, paddingHorizontal: 10, paddingVertical: 9, marginBottom: 6, minHeight: 48 },
  rowBubble: { width: 30, height: 30, borderRadius: 10, backgroundColor: palette.brandTertiary, alignItems: "center", justifyContent: "center" },
  rowCopy: { flex: 1, marginHorizontal: 9 },
  rowTitle: { color: palette.onSurface, fontSize: 12, fontWeight: "800" },
  rowSub: { color: palette.onSurfaceTertiary, fontSize: 10, marginTop: 2 },
  rowValue: { color: palette.brand, fontSize: 11, fontWeight: "800" },
  rowAction: { width: 34, height: 34, alignItems: "center", justifyContent: "center" },
  fab: { position: "absolute", right: 14, borderRadius: 16, backgroundColor: palette.brandPrimary, flexDirection: "row", alignItems: "center", paddingHorizontal: 14, minHeight: 48, gap: 6 },
  fabPressed: { backgroundColor: palette.brandSecondary },
  fabText: { color: palette.onBrandPrimary, fontSize: 13, fontWeight: "800" },
  empty: { alignItems: "center", paddingVertical: 28, gap: 8 },
  emptyText: { color: palette.onSurfaceTertiary, fontSize: 11 },
  fieldWrap: { marginBottom: 10 },
  fieldLabel: { color: palette.onSurfaceTertiary, fontSize: 10, fontWeight: "700", marginBottom: 4 },
  input: { backgroundColor: palette.surfaceTertiary, borderRadius: 10, borderWidth: 1, borderColor: palette.border, color: palette.onSurface, fontSize: 13, paddingHorizontal: 10, minHeight: 44 },
  selectRow: { backgroundColor: palette.surfaceTertiary, borderRadius: 10, borderWidth: 1, borderColor: palette.border, paddingHorizontal: 10, minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  selectText: { color: palette.onSurface, fontSize: 13, flex: 1 },
  toggleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 44 },
  sheetBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" },
  sheet: { backgroundColor: palette.surfaceSecondary, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 14, paddingTop: 10, maxHeight: "88%" },
  grabber: { width: 36, height: 4, borderRadius: 2, backgroundColor: palette.surfaceTertiary, alignSelf: "center", marginBottom: 10 },
  sheetTitle: { color: palette.onSurface, fontSize: 15, fontWeight: "800", marginBottom: 12 },
  buttonRow: { flexDirection: "row", gap: 8, marginTop: 4 },
  primaryButton: { flex: 1, minHeight: 46, borderRadius: 12, backgroundColor: palette.brandPrimary, alignItems: "center", justifyContent: "center" },
  primaryButtonPressed: { backgroundColor: palette.brandSecondary },
  primaryText: { color: palette.onBrandPrimary, fontSize: 13, fontWeight: "800" },
  ghostButton: { flex: 1, minHeight: 46, borderRadius: 12, borderWidth: 1, borderColor: palette.border, alignItems: "center", justifyContent: "center" },
  ghostText: { color: palette.onSurfaceSecondary, fontSize: 13, fontWeight: "800" },
  dangerText: { color: palette.error, fontSize: 13, fontWeight: "800" },
  pill: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3, borderWidth: 1 },
  pillText: { fontSize: 9, fontWeight: "800" },
  optionRow: { minHeight: 46, borderRadius: 10, paddingHorizontal: 10, flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6, backgroundColor: palette.surfaceTertiary },
  optionText: { color: palette.onSurface, fontSize: 13 },
  fsRoot: { flex: 1, backgroundColor: palette.surface },
  fsHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: palette.border, backgroundColor: palette.surfaceSecondary },
  fsHeaderBtn: { minWidth: 56, minHeight: 40, justifyContent: "center" },
  fsTitle: { flex: 1, textAlign: "center", color: palette.onSurface, fontSize: 15, fontWeight: "800" },
}));

export type IconName = keyof typeof MaterialCommunityIcons.glyphMap;

export function ModuleHeader({ title, subtitle, onBack }: { title: string; subtitle: string; onBack: () => void }) {
  const kit = useKit(); const { colors } = useTheme();
  return <View style={kit.header}>
    <Pressable testID="back-button" accessibilityRole="button" onPress={onBack} style={({ pressed }) => [kit.backButton, pressed && { opacity: 0.7 }]}><MaterialCommunityIcons name="chevron-left" size={24} color={colors.brand} /></Pressable>
    <View style={kit.headerCopy}><Text style={kit.eyebrow}>UMMU ABDULLAH SHOP</Text><Text numberOfLines={1} style={kit.title}>{title}</Text><Text numberOfLines={1} style={kit.subtitle}>{subtitle}</Text></View>
  </View>;
}

export function Field({ label, value, onChangeText, keyboardType = "default", placeholder, money = false }: { label: string; value: string; onChangeText: (value: string) => void; keyboardType?: "default" | "numeric"; placeholder?: string; money?: boolean }) {
  const kit = useKit(); const { colors } = useTheme();
  const display = money ? formatThousands(value) : value;
  const handle = (text: string) => onChangeText(money ? parseThousands(text) : text);
  return <View style={kit.fieldWrap}><Text style={kit.fieldLabel}>{label}</Text>
    <TextInput style={kit.input} value={display} onChangeText={handle} keyboardType={money ? "numeric" : keyboardType} placeholder={placeholder} placeholderTextColor={colors.onSurfaceTertiary} />
  </View>;
}

// #3–#10 Full-screen Add/Edit form: fixed header with Batal/Simpan, scrollable content.
// Used for every module form that is not comfortable inside a bottom sheet.
export function FullScreenForm({ visible, title, onClose, onSubmit, submitLabel = "Simpan", submitTestID = "save-button", children }: { visible: boolean; title: string; onClose: () => void; onSubmit: () => void; submitLabel?: string; submitTestID?: string; children: React.ReactNode }) {
  const kit = useKit(); const { colors } = useTheme(); const insets = useSafeAreaInsets();
  // Runtime insets only (no fixed pixels). On Android the safe-area context can report 0
  // inside a Modal, so fall back to the live StatusBar height for the top.
  const topInset = Math.max(insets.top, Platform.OS === "android" ? (StatusBar.currentHeight ?? 0) : 0);
  const bottomInset = Math.max(insets.bottom, 12);
  return <Modal visible={visible} animationType="slide" onRequestClose={onClose} statusBarTranslucent presentationStyle="overFullScreen" transparent>
    <View style={[kit.fsRoot, { paddingTop: topInset }]}>
      <View style={kit.fsHeader}>
        <Pressable testID="form-cancel-button" accessibilityRole="button" onPress={onClose} style={({ pressed }) => [kit.fsHeaderBtn, pressed && { opacity: 0.7 }]}><Text style={kit.ghostText}>Batal</Text></Pressable>
        <Text numberOfLines={1} style={kit.fsTitle}>{title}</Text>
        <Pressable testID={submitTestID} accessibilityRole="button" onPress={onSubmit} style={({ pressed }) => [kit.fsHeaderBtn, { alignItems: "flex-end" }, pressed && { opacity: 0.7 }]}><Text style={[kit.ghostText, { color: colors.brand }]}>{submitLabel}</Text></Pressable>
      </View>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 14, paddingBottom: bottomInset + 24 }}>{children}</ScrollView>
      </KeyboardAvoidingView>
    </View>
  </Modal>;
}

export function SelectField({ label, value, options, onSelect }: { label: string; value: string; options: { value: string; label: string }[]; onSelect: (value: string) => void }) {
  const kit = useKit(); const { colors } = useTheme(); const [open, setOpen] = useState(false);
  const current = options.find((option) => option.value === value);
  return <View style={kit.fieldWrap}><Text style={kit.fieldLabel}>{label}</Text>
    <Pressable accessibilityRole="button" onPress={() => setOpen(true)} style={({ pressed }) => [kit.selectRow, pressed && { opacity: 0.8 }]}>
      <Text numberOfLines={1} style={kit.selectText}>{current?.label ?? "Pilih..."}</Text>
      <MaterialCommunityIcons name="chevron-down" size={20} color={colors.brand} />
    </Pressable>
    <Sheet visible={open} title={label} onClose={() => setOpen(false)}>
      {options.map((option) => <Pressable key={option.value} accessibilityRole="button" onPress={() => { onSelect(option.value); setOpen(false); }} style={({ pressed }) => [kit.optionRow, pressed && { opacity: 0.8 }]}>
        <Text style={kit.optionText}>{option.label}</Text>
        {option.value === value ? <MaterialCommunityIcons name="check" size={18} color={colors.brand} /> : null}
      </Pressable>)}
    </Sheet>
  </View>;
}

export function DateField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const kit = useKit(); const { colors } = useTheme(); const [open, setOpen] = useState(false);
  const valid = /^\d{4}-\d{2}-\d{2}$/.test(value);
  const base = valid ? value : new Date().toISOString().slice(0, 10);
  const [year, setYear] = useState(Number(base.slice(0, 4)));
  const [month, setMonth] = useState(Number(base.slice(5, 7)) - 1);
  const monthNames = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
  const weekdays = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstWeekday = new Date(year, month, 1).getDay();
  const cells: number[] = [...Array(firstWeekday).fill(0), ...Array.from({ length: daysInMonth }, (_, index) => index + 1)];
  const stepMonth = (delta: number) => { const next = new Date(year, month + delta, 1); setYear(next.getFullYear()); setMonth(next.getMonth()); };
  const openSheet = () => { const seed = valid ? value : new Date().toISOString().slice(0, 10); setYear(Number(seed.slice(0, 4))); setMonth(Number(seed.slice(5, 7)) - 1); setOpen(true); };
  const pick = (day: number) => { onChange(`${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`); setOpen(false); };
  return <View style={kit.fieldWrap}><Text style={kit.fieldLabel}>{label}</Text>
    <Pressable testID={`date-field-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`} accessibilityRole="button" onPress={openSheet} style={({ pressed }) => [kit.selectRow, pressed && { opacity: 0.8 }]}>
      <Text numberOfLines={1} style={kit.selectText}>{valid ? toDisplayDate(value) : "Pilih tanggal"}</Text>
      <MaterialCommunityIcons name="calendar-month-outline" size={20} color={colors.brand} />
    </Pressable>
    <Sheet visible={open} title={label} onClose={() => setOpen(false)}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <Pressable testID="date-prev-month" accessibilityRole="button" onPress={() => stepMonth(-1)} style={({ pressed }) => [{ width: 40, height: 40, borderRadius: 10, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" }, pressed && { opacity: 0.7 }]}><MaterialCommunityIcons name="chevron-left" size={22} color={colors.brand} /></Pressable>
        <Text style={{ color: colors.onSurface, fontSize: 15, fontWeight: "800" }}>{`${monthNames[month]} ${year}`}</Text>
        <Pressable testID="date-next-month" accessibilityRole="button" onPress={() => stepMonth(1)} style={({ pressed }) => [{ width: 40, height: 40, borderRadius: 10, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" }, pressed && { opacity: 0.7 }]}><MaterialCommunityIcons name="chevron-right" size={22} color={colors.brand} /></Pressable>
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
        {weekdays.map((weekday) => <View key={weekday} style={{ width: "14.28%", alignItems: "center", paddingVertical: 4 }}><Text style={{ color: colors.onSurfaceTertiary, fontSize: 10, fontWeight: "700" }}>{weekday}</Text></View>)}
        {cells.map((day, index) => { if (!day) return <View key={`blank-${index}`} style={{ width: "14.28%", aspectRatio: 1 }} />; const iso = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`; const selected = valid && iso === value; return <View key={iso} style={{ width: "14.28%", aspectRatio: 1, padding: 3 }}><Pressable testID={`date-day-${day}`} accessibilityRole="button" onPress={() => pick(day)} style={({ pressed }) => [{ flex: 1, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: selected ? colors.brandTertiary : colors.surfaceTertiary, borderWidth: 1, borderColor: selected ? colors.brand : colors.border }, pressed && { opacity: 0.75 }]}><Text style={{ color: selected ? colors.brand : colors.onSurface, fontSize: 13, fontWeight: selected ? "800" : "600" }}>{day}</Text></Pressable></View>; })}
      </View>
    </Sheet>
  </View>;
}

// #2 BOS month picker: tampil natural ("Sep 2026"), simpan internal "YYYY-MM".
export function MonthField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const kit = useKit(); const { colors } = useTheme(); const [open, setOpen] = useState(false);
  const monthAbbr = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
  const valid = /^\d{4}-\d{2}$/.test(value);
  const seed = valid ? value : new Date().toISOString().slice(0, 7);
  const [year, setYear] = useState(Number(seed.slice(0, 4)));
  const openSheet = () => { setYear(Number((valid ? value : new Date().toISOString().slice(0, 7)).slice(0, 4))); setOpen(true); };
  const pick = (monthIndex: number) => { onChange(`${year}-${String(monthIndex + 1).padStart(2, "0")}`); setOpen(false); };
  return <View style={kit.fieldWrap}><Text style={kit.fieldLabel}>{label}</Text>
    <Pressable testID={`month-field-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`} accessibilityRole="button" onPress={openSheet} style={({ pressed }) => [kit.selectRow, pressed && { opacity: 0.8 }]}>
      <Text numberOfLines={1} style={kit.selectText}>{valid ? monthLabel(value) : "Pilih bulan"}</Text>
      <MaterialCommunityIcons name="calendar-month-outline" size={20} color={colors.brand} />
    </Pressable>
    <Sheet visible={open} title={label} onClose={() => setOpen(false)}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <Pressable testID="month-prev-year" accessibilityRole="button" onPress={() => setYear((current) => current - 1)} style={({ pressed }) => [{ width: 40, height: 40, borderRadius: 10, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" }, pressed && { opacity: 0.7 }]}><MaterialCommunityIcons name="chevron-left" size={22} color={colors.brand} /></Pressable>
        <Text style={{ color: colors.onSurface, fontSize: 15, fontWeight: "800" }}>{year}</Text>
        <Pressable testID="month-next-year" accessibilityRole="button" onPress={() => setYear((current) => current + 1)} style={({ pressed }) => [{ width: 40, height: 40, borderRadius: 10, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" }, pressed && { opacity: 0.7 }]}><MaterialCommunityIcons name="chevron-right" size={22} color={colors.brand} /></Pressable>
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 10 }}>
        {monthAbbr.map((abbr, index) => { const key = `${year}-${String(index + 1).padStart(2, "0")}`; const selected = valid && key === value; return <Pressable key={key} testID={`month-cell-${key}`} accessibilityRole="button" onPress={() => pick(index)} style={({ pressed }) => [{ width: "23%", minHeight: 44, borderRadius: 10, borderWidth: 1, alignItems: "center", justifyContent: "center", backgroundColor: selected ? colors.brandTertiary : colors.surfaceTertiary, borderColor: selected ? colors.brand : colors.border }, pressed && { opacity: 0.75 }]}><Text style={{ color: selected ? colors.brand : colors.onSurface, fontSize: 13, fontWeight: selected ? "800" : "600" }}>{abbr}</Text></Pressable>; })}
      </View>
    </Sheet>
  </View>;
}

export function ToggleField({ label, value, onChange }: { label: string; value: boolean; onChange: (value: boolean) => void }) {
  const kit = useKit(); const { colors } = useTheme();
  return <View style={[kit.fieldWrap, kit.toggleRow]}>
    <Text style={kit.fieldLabel}>{label}</Text>
    <Switch value={value} onValueChange={onChange} trackColor={{ true: colors.brandSecondary, false: colors.surfaceTertiary }} thumbColor={value ? colors.brand : colors.onSurfaceTertiary} />
  </View>;
}

export function Sheet({ visible, title, onClose, children, footer, header, fill = false }: { visible: boolean; title: string; onClose: () => void; children: React.ReactNode; footer?: React.ReactNode; header?: React.ReactNode; fill?: boolean }) {
  const kit = useKit(); const insets = useSafeAreaInsets(); const { height: winHeight } = useWindowDimensions();
  // Saat `fill`, bottom sheet dibuka setinggi mungkin hingga tepat di bawah Safe Area atas
  // (tidak menutupi status bar). Search/header tetap terkunci di atas; hanya daftar yang scroll.
  const fillHeight = winHeight - insets.top - 8;
  return <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
    <View style={kit.sheetBackdrop}>
      <Pressable style={StyleSheet.absoluteFill} accessibilityRole="button" accessibilityLabel="Tutup" onPress={onClose} />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={[kit.sheet, fill && { height: fillHeight, maxHeight: fillHeight }, { paddingBottom: insets.bottom + 14 }]}>
          <View style={kit.grabber} />
          <Text style={kit.sheetTitle}>{title}</Text>
          {header}
          <ScrollView style={fill ? { flex: 1 } : undefined} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>{children}</ScrollView>
          {footer}
        </View>
      </KeyboardAvoidingView>
    </View>
  </Modal>;
}

export function ConfirmSheet({ visible, title, message, confirmLabel, destructive = false, onCancel, onConfirm }: { visible: boolean; title: string; message: string; confirmLabel: string; destructive?: boolean; onCancel: () => void; onConfirm: () => void }) {
  const kit = useKit();
  return <Sheet visible={visible} title={title} onClose={onCancel}
    footer={<View style={kit.buttonRow}>
      <Pressable accessibilityRole="button" onPress={onCancel} style={({ pressed }) => [kit.ghostButton, pressed && { opacity: 0.8 }]}><Text style={kit.ghostText}>Batal</Text></Pressable>
      <Pressable testID="confirm-button" accessibilityRole="button" onPress={onConfirm} style={({ pressed }) => [destructive ? kit.ghostButton : kit.primaryButton, pressed && (destructive ? { opacity: 0.85 } : kit.primaryButtonPressed)]}><Text style={destructive ? kit.dangerText : kit.primaryText}>{confirmLabel}</Text></Pressable>
    </View>}>
    <Text style={kit.cardSub}>{message}</Text>
  </Sheet>;
}

export function Pill({ label, color }: { label: string; color: string }) {
  const kit = useKit();
  return <View style={[kit.pill, { borderColor: color }]}><Text style={[kit.pillText, { color }]}>{label}</Text></View>;
}

export function EmptyState({ text }: { text: string }) {
  const kit = useKit(); const { colors } = useTheme();
  return <View style={kit.empty}><MaterialCommunityIcons name="inbox-outline" size={26} color={colors.onSurfaceTertiary} /><Text style={kit.emptyText}>{text}</Text></View>;
}

// Searchable picker for large / growing master data (Produk/SKU, Pelanggan, Supplier,
// Akun Kas). Same look as SelectField but with a search box inside the sheet.
export function SearchableSelectField({ label, value, options, onSelect, placeholder }: { label: string; value: string; options: { value: string; label: string }[]; onSelect: (value: string) => void; placeholder?: string }) {
  const kit = useKit(); const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const current = options.find((option) => option.value === value);
  const filtered = options.filter((option) => option.label.toLowerCase().includes(query.trim().toLowerCase()));
  return <View style={kit.fieldWrap}><Text style={kit.fieldLabel}>{label}</Text>
    <Pressable testID={`searchable-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`} accessibilityRole="button" onPress={() => { setQuery(""); setOpen(true); }} style={({ pressed }) => [kit.selectRow, pressed && { opacity: 0.8 }]}>
      <Text numberOfLines={1} style={kit.selectText}>{current?.label ?? (placeholder ?? "Pilih...")}</Text>
      <MaterialCommunityIcons name="chevron-down" size={20} color={colors.brand} />
    </Pressable>
    <Sheet visible={open} title={label} onClose={() => setOpen(false)} fill
      header={<View style={[kit.selectRow, { marginBottom: 10 }]}>
        <MaterialCommunityIcons name="magnify" size={18} color={colors.onSurfaceTertiary} />
        <TextInput testID="search-option-input" style={{ flex: 1, color: colors.onSurface, fontSize: 13, marginLeft: 8, minHeight: 44 }} value={query} onChangeText={setQuery} placeholder="Cari..." placeholderTextColor={colors.onSurfaceTertiary} autoFocus />
      </View>}>
      {filtered.length === 0 ? <Text style={[kit.cardSub, { textAlign: "center", paddingVertical: 16 }]}>Tidak ada hasil</Text> : filtered.map((option) => <Pressable key={option.value} accessibilityRole="button" onPress={() => { onSelect(option.value); setOpen(false); }} style={({ pressed }) => [kit.optionRow, pressed && { opacity: 0.8 }]}>
        <Text numberOfLines={1} style={kit.optionText}>{option.label}</Text>
        {option.value === value ? <MaterialCommunityIcons name="check" size={18} color={colors.brand} /> : null}
      </Pressable>)}
    </Sheet>
  </View>;
}

// Multi-select picker (Supplier Alternatif). Zero or more values; searchable.
export function MultiSelectField({ label, values, options, onChange }: { label: string; values: string[]; options: { value: string; label: string }[]; onChange: (values: string[]) => void }) {
  const kit = useKit(); const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selected = options.filter((option) => values.includes(option.value));
  const filtered = options.filter((option) => option.label.toLowerCase().includes(query.trim().toLowerCase()));
  const toggle = (target: string) => onChange(values.includes(target) ? values.filter((entry) => entry !== target) : [...values, target]);
  return <View style={kit.fieldWrap}><Text style={kit.fieldLabel}>{label}</Text>
    <Pressable testID={`multiselect-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`} accessibilityRole="button" onPress={() => { setQuery(""); setOpen(true); }} style={({ pressed }) => [kit.selectRow, pressed && { opacity: 0.8 }]}>
      <Text numberOfLines={1} style={kit.selectText}>{selected.length ? selected.map((option) => option.label).join(", ") : "Pilih (opsional)..."}</Text>
      <MaterialCommunityIcons name="chevron-down" size={20} color={colors.brand} />
    </Pressable>
    <Sheet visible={open} title={label} onClose={() => setOpen(false)}
      footer={<View style={kit.buttonRow}><Pressable accessibilityRole="button" onPress={() => setOpen(false)} style={({ pressed }) => [kit.primaryButton, pressed && kit.primaryButtonPressed]}><Text style={kit.primaryText}>Selesai</Text></Pressable></View>}>
      <View style={[kit.selectRow, { marginBottom: 10 }]}>
        <MaterialCommunityIcons name="magnify" size={18} color={colors.onSurfaceTertiary} />
        <TextInput style={{ flex: 1, color: colors.onSurface, fontSize: 13, marginLeft: 8, minHeight: 44 }} value={query} onChangeText={setQuery} placeholder="Cari..." placeholderTextColor={colors.onSurfaceTertiary} />
      </View>
      {filtered.length === 0 ? <Text style={[kit.cardSub, { textAlign: "center", paddingVertical: 16 }]}>Tidak ada hasil</Text> : filtered.map((option) => { const on = values.includes(option.value); return <Pressable key={option.value} accessibilityRole="button" onPress={() => toggle(option.value)} style={({ pressed }) => [kit.optionRow, pressed && { opacity: 0.8 }]}>
        <Text numberOfLines={1} style={kit.optionText}>{option.label}</Text>
        <MaterialCommunityIcons name={on ? "checkbox-marked" : "checkbox-blank-outline"} size={20} color={on ? colors.brand : colors.onSurfaceTertiary} />
      </Pressable>; })}
    </Sheet>
  </View>;
}

