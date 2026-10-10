import { useMemo, useState } from "react";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Pressable, ScrollView, View } from "react-native";
import { Text } from "@/src/components/text";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BottomNav } from "@/src/components/bottom-nav";
import { EmptyState, IconName, Pill, ThemedStatusBar, useKit } from "@/src/components/ui-kit";
import { latestMonthKey } from "@/src/data/calc";
import { evaluateAlerts, severityRank } from "@/src/data/rules";
import { useBos } from "@/src/data/store";
import { monthLabel } from "@/src/data/time";
import { useTheme } from "@/src/theme";

// Alert Center: purely the output of the Business Rules + Threshold values set in More.
export default function AlertCenter() {
  const kit = useKit(); const { colors } = useTheme(); const insets = useSafeAreaInsets(); const router = useRouter();
  const { data } = useBos();
  const [navHeight, setNavHeight] = useState(64);
  const monthKey = latestMonthKey(data);
  const alerts = useMemo(() => evaluateAlerts(data, monthKey).sort((left, right) => severityRank[left.severity] - severityRank[right.severity]), [data, monthKey]);
  const toneOf = (severity: string) => (severity === "Tinggi" ? colors.error : severity === "Sedang" ? colors.warning : colors.brand);
  const activeRules = data.rules.filter((rule) => rule.enabled).length;

  return <View style={kit.screen}><ThemedStatusBar />
    <ScrollView contentContainerStyle={[kit.body, { paddingTop: insets.top + 6, paddingBottom: navHeight + 16 }]} showsVerticalScrollIndicator={false}>
      <View style={{ marginBottom: 8 }}>
        <Text style={kit.eyebrow}>UMMU ABDULLAH SHOP</Text>
        <Text style={kit.title}>Alert</Text>
        <Text style={kit.subtitle}>Masalah yang terdeteksi dari business rules</Text>
      </View>

      <View style={kit.card}>
        <Text style={kit.cardTitle}>{alerts.length === 0 ? "Tidak ada alert" : `${alerts.length} alert aktif · ${monthLabel(monthKey)}`}</Text>
        <Text style={kit.cardSub}>{`${activeRules} dari ${data.rules.length} rule aktif · ambang batas diatur di More → Threshold`}</Text>
      </View>

      {alerts.length === 0 ? <EmptyState text="Semua indikator berada dalam batas aman." /> : alerts.map((alert) => <Pressable key={alert.id} testID={`alert-${alert.ruleKey}`} accessibilityRole="button" onPress={() => router.push(alert.module as never)} style={({ pressed }) => [kit.row, pressed && { opacity: 0.85 }]}>
        <View style={[kit.rowBubble, { backgroundColor: colors.surfaceTertiary }]}><MaterialCommunityIcons name={(alert.severity === "Tinggi" ? "alert-circle" : alert.severity === "Sedang" ? "alert-outline" : "information-outline") as IconName} size={17} color={toneOf(alert.severity)} /></View>
        <View style={kit.rowCopy}><Text numberOfLines={1} style={kit.rowTitle}>{alert.title}</Text><Text numberOfLines={1} style={kit.rowSub}>{`${alert.label} · ${alert.detail}`}</Text></View>
        <Pill label={alert.severity} color={toneOf(alert.severity)} />
      </Pressable>)}
    </ScrollView>
    <BottomNav active="Operasional" onLayoutHeight={setNavHeight} />
  </View>;
}
