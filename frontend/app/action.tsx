import { useMemo, useState } from "react";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Pressable, ScrollView, View } from "react-native";
import { Text } from "@/src/components/text";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BottomNav } from "@/src/components/bottom-nav";
import { EmptyState, IconName, Pill, ThemedStatusBar, useKit } from "@/src/components/ui-kit";
import { latestMonthKey } from "@/src/data/calc";
import { deriveActions } from "@/src/data/rules";
import { useBos } from "@/src/data/store";
import { monthLabel } from "@/src/data/time";
import { useTheme } from "@/src/theme";

// Action list: one recommended action per active alert. Tapping the row opens the module
// in More where the owner fixes the underlying data.
export default function ActionList() {
  const kit = useKit(); const { colors } = useTheme(); const insets = useSafeAreaInsets(); const router = useRouter();
  const { data, setActionStatus } = useBos();
  const [navHeight, setNavHeight] = useState(64);
  const monthKey = latestMonthKey(data);
  const actions = useMemo(() => deriveActions(data, monthKey), [data, monthKey]);
  const open = actions.filter((action) => action.status === "open");
  const toneOf = (level: string) => (level === "Tinggi" ? colors.error : level === "Sedang" ? colors.warning : colors.brand);

  return <View style={kit.screen}><ThemedStatusBar />
    <ScrollView contentContainerStyle={[kit.body, { paddingTop: insets.top + 6, paddingBottom: navHeight + 16 }]} showsVerticalScrollIndicator={false}>
      <View style={{ marginBottom: 8 }}>
        <Text style={kit.eyebrow}>UMMU ABDULLAH SHOP</Text>
        <Text style={kit.title}>Action</Text>
        <Text style={kit.subtitle}>Tindakan yang disarankan dari setiap alert</Text>
      </View>

      <View style={kit.card}>
        <Text style={kit.cardTitle}>{actions.length === 0 ? "Tidak ada tindakan" : `${open.length} tindakan menunggu · ${monthLabel(monthKey)}`}</Text>
        <Text style={kit.cardSub}>Ditandai selesai hanya menyembunyikan tanda, bukan mengubah data</Text>
      </View>

      {actions.length === 0 ? <EmptyState text="Belum ada tindakan yang perlu dilakukan." /> : actions.map((action) => <View key={action.id} testID={`action-${action.id}`} style={kit.row}>
        <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: action.status === "done" }} accessibilityLabel={`Tandai ${action.title}`} onPress={() => setActionStatus(action.id, action.status === "done" ? "open" : "done")} style={kit.rowAction}>
          <MaterialCommunityIcons name={(action.status === "done" ? "checkbox-marked-circle" : "checkbox-blank-circle-outline") as IconName} size={21} color={action.status === "done" ? colors.success : colors.onSurfaceTertiary} />
        </Pressable>
        <Pressable accessibilityRole="button" onPress={() => router.push(action.module as never)} style={({ pressed }) => [kit.rowCopy, pressed && { opacity: 0.85 }]}>
          <Text numberOfLines={1} style={[kit.rowTitle, action.status === "done" && { color: colors.onSurfaceTertiary, textDecorationLine: "line-through" }]}>{action.title}</Text>
          <Text numberOfLines={1} style={kit.rowSub}>{`${action.ruleLabel} · ${action.detail}`}</Text>
        </Pressable>
        <Pill label={action.level} color={toneOf(action.level)} />
      </View>)}
    </ScrollView>
    <BottomNav active="Fokus" onLayoutHeight={setNavHeight} />
  </View>;
}
