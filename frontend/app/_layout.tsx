import { QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { LogBox } from "react-native";
import { useFonts, PlusJakartaSans_400Regular, PlusJakartaSans_500Medium, PlusJakartaSans_600SemiBold, PlusJakartaSans_700Bold, PlusJakartaSans_800ExtraBold } from "@expo-google-fonts/plus-jakarta-sans";

import { ErrorBoundary } from "@/src/components/error-boundary";
import { BosProvider } from "@/src/data/store";
import { queryClient } from "@/src/query-client";
import { useTheme } from "@/src/theme";

// Disable logbox errors etc so that users can see the app
// and agent works as expected.
LogBox.ignoreAllLogs(true)

export default function RootLayout() {
  const { colors } = useTheme();
  const [fontsLoaded, fontError] = useFonts({ PlusJakartaSans_400Regular, PlusJakartaSans_500Medium, PlusJakartaSans_600SemiBold, PlusJakartaSans_700Bold, PlusJakartaSans_800ExtraBold });
  if (!fontsLoaded && !fontError) return null;
  // One app level ErrorBoundary; a render crash shows a reload screen
  // instead of a blank app. animation "none" + a constant screen background
  // removes the white flash/blank when switching tabs and menus (#20).
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BosProvider>
          <Stack screenOptions={{ headerShown: false, animation: "none", contentStyle: { backgroundColor: colors.surface } }} />
        </BosProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
