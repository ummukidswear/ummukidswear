import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Pressable, View } from "react-native";
import { Text } from "@/src/components/text";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { latestMonthKey } from "@/src/data/calc";
import { deriveActions, evaluateAlerts } from "@/src/data/rules";
import { useBos } from "@/src/data/store";
import { IconName } from "@/src/components/ui-kit";
import { makeStyles, useTheme, fontSans, fontSansHeavy } from "@/src/theme";

const useStyles = makeStyles((palette) => ({
  nav: { position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: palette.surfaceSecondary, borderTopWidth: 1, borderTopColor: palette.border, flexDirection: "row", justifyContent: "space-around", paddingTop: 5 },
  item: { minWidth: 50, minHeight: 40, alignItems: "center", justifyContent: "center" },
  label: { color: palette.onSurfaceTertiary, fontSize: 8, marginTop: 1, fontFamily: fontSans },
  labelActive: { color: palette.brand, fontFamily: fontSansHeavy },
  badge: { position: "absolute", top: 2, right: 8, minWidth: 14, height: 14, borderRadius: 7, backgroundColor: palette.error, alignItems: "center", justifyContent: "center", paddingHorizontal: 3 },
  badgeText: { color: palette.onError, fontSize: 8, fontWeight: "800" },
  badgeAmber: { position: "absolute", top: 2, right: 8, minWidth: 14, height: 14, borderRadius: 7, backgroundColor: "#FF9800", alignItems: "center", justifyContent: "center", paddingHorizontal: 3 },
  badgeAmberText: { color: "#0E1217", fontSize: 8, fontWeight: "800" },
}));

// Urutan & label nav: Beranda, Operasional (Alert), Analitik, Fokus (Action), Lainnya.
const items = [
  { label: "Beranda", icon: "home-outline", route: "/home" },
  { label: "Operasional", icon: "bell-outline", route: "/alert" },
  { label: "Analitik", icon: "chart-bar", route: "/penjualan" },
  { label: "Fokus", icon: "checkbox-marked-outline", route: "/action" },
  { label: "Lainnya", icon: "dots-horizontal", route: "/more" },
];

// Same bottom navigation as the dashboards, with a live alert count driven by the rules.
export function BottomNav({ active, onLayoutHeight }: { active: string; onLayoutHeight?: (height: number) => void }) {
  const styles = useStyles(); const { colors } = useTheme(); const insets = useSafeAreaInsets();
  const router = useRouter(); const { data } = useBos();
  const monthKey = latestMonthKey(data);
  const alertCount = evaluateAlerts(data, monthKey).length;
  const openActionCount = deriveActions(data, monthKey).filter((action) => action.status === "open").length;
  return <View style={[styles.nav, { paddingBottom: Math.max(insets.bottom, 12) }]} onLayout={(event) => onLayoutHeight?.(event.nativeEvent.layout.height)}>
    {items.map((item) => { const isActive = item.label === active; return <Pressable testID={`nav-${item.label.toLowerCase()}`} key={item.label} accessibilityRole="button" onPress={() => { if (!isActive) router.replace(item.route as never); }} style={({ pressed }) => [styles.item, pressed && { opacity: 0.72 }]}>
      <MaterialCommunityIcons name={item.icon as IconName} size={isActive ? 26 : 23} color={isActive ? colors.brand : colors.onSurfaceTertiary} />
      {item.label === "Operasional" && alertCount > 0 ? <View style={styles.badge}><Text style={styles.badgeText}>{alertCount}</Text></View> : null}
      {item.label === "Fokus" && openActionCount > 0 ? <View style={styles.badgeAmber}><Text style={styles.badgeAmberText}>{openActionCount}</Text></View> : null}
      <Text style={[styles.label, isActive && styles.labelActive]}>{item.label}</Text>
    </Pressable>; })}
  </View>;
}
