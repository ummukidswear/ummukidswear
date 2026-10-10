import { useEffect, useState } from "react";
import { Modal, Pressable, StyleSheet, View } from "react-native";
import { Text } from "@/src/components/text";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ThemeColors } from "@/src/theme";

const monthAbbr = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

export function PeriodPicker({
  visible,
  onClose,
  selectedMonth,
  onSelect,
  availableKeys,
  colors: palette,
}: {
  visible: boolean;
  onClose: () => void;
  selectedMonth: string;
  onSelect: (key: string) => void;
  availableKeys: string[];
  colors: ThemeColors;
}) {
  const insets = useSafeAreaInsets();
  const [year, setYear] = useState(Number(selectedMonth.slice(0, 4)));

  useEffect(() => { if (visible) setYear(Number(selectedMonth.slice(0, 4))); }, [visible, selectedMonth]);

  const isAvailable = (key: string) => availableKeys.includes(key);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityRole="button" accessibilityLabel="Tutup pemilih periode" />
        <View style={[styles.sheet, { backgroundColor: palette.surfaceTertiary, paddingBottom: insets.bottom + 16 }]}>
          <View style={[styles.grabber, { backgroundColor: palette.surfaceTertiary }]} />
          <Text style={[styles.title, { color: palette.onSurface }]}>Pilih Periode</Text>

          <View style={styles.yearRow}>
            <Pressable testID="period-year-prev" accessibilityRole="button" accessibilityLabel="Tahun sebelumnya" onPress={() => setYear((y) => y - 1)} style={({ pressed }) => [styles.yearArrow, { borderColor: palette.border }, pressed && { opacity: 0.7 }]}>
              <MaterialCommunityIcons name="chevron-left" size={22} color={palette.brand} />
            </Pressable>
            <Text style={[styles.yearText, { color: palette.onSurface }]}>{year}</Text>
            <Pressable testID="period-year-next" accessibilityRole="button" accessibilityLabel="Tahun berikutnya" onPress={() => setYear((y) => y + 1)} style={({ pressed }) => [styles.yearArrow, { borderColor: palette.border }, pressed && { opacity: 0.7 }]}>
              <MaterialCommunityIcons name="chevron-right" size={22} color={palette.brand} />
            </Pressable>
          </View>

          <View style={styles.grid}>
            {monthAbbr.map((label, monthIndex) => {
              const key = `${year}-${String(monthIndex + 1).padStart(2, "0")}`;
              const available = isAvailable(key);
              const selected = key === selectedMonth;
              return (
                <Pressable
                  key={key}
                  testID={`period-month-${key}`}
                  disabled={!available}
                  accessibilityRole="button"
                  accessibilityState={{ selected, disabled: !available }}
                  accessibilityLabel={`${label} ${year}`}
                  onPress={() => onSelect(key)}
                  style={({ pressed }) => [
                    styles.cell,
                    { backgroundColor: palette.surfaceSecondary, borderColor: palette.border },
                    selected && { backgroundColor: palette.brandTertiary, borderColor: palette.brand },
                    !available && styles.cellDisabled,
                    pressed && available && { opacity: 0.75 },
                  ]}
                >
                  <Text style={[styles.cellText, { color: palette.onSurfaceSecondary }, selected && { color: palette.brand, fontWeight: "800" }]}>{label}</Text>
                </Pressable>
              );
            })}
          </View>

          <View style={[styles.helper, { backgroundColor: palette.surfaceSecondary }]}>
            <MaterialCommunityIcons name="information-outline" size={14} color={palette.brand} />
            <Text style={[styles.helperText, { color: palette.onSurfaceTertiary }]}>Trend menampilkan maksimal 6 bulan terakhir dari periode yang dipilih.</Text>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 16, paddingTop: 10 },
  grabber: { width: 36, height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.2)", alignSelf: "center", marginBottom: 12 },
  title: { fontSize: 15, fontWeight: "800", marginBottom: 12 },
  yearRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 24, marginBottom: 14 },
  yearArrow: { width: 36, height: 36, borderRadius: 10, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  yearText: { fontSize: 16, fontWeight: "800", minWidth: 64, textAlign: "center" },
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 10 },
  cell: { width: "23%", minHeight: 44, borderRadius: 10, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  cellDisabled: { opacity: 0.32 },
  cellText: { fontSize: 12, fontWeight: "700" },
  helper: { flexDirection: "row", alignItems: "center", borderRadius: 8, padding: 8, marginTop: 14, gap: 6 },
  helperText: { flex: 1, fontSize: 9, lineHeight: 11 },
});
