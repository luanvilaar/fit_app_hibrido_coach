import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import {
  BarlowCondensed_700Bold,
  BarlowCondensed_800ExtraBold,
  BarlowCondensed_900Black
} from "@expo-google-fonts/barlow-condensed";
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold
} from "@expo-google-fonts/inter";
import { AuthProvider } from "@/auth/auth-provider";
import { RolesProvider } from "@/auth/roles-provider";

export default function RootLayout() {
  // Dark Performance: Barlow Condensed gives display moments their athletic editorial
  // voice while Inter stays legible for every operational control and data surface.
  // Font loading is intentionally non-blocking: the system fallback keeps the route
  // usable while native/web font registration completes.
  useFonts({
    "BarlowCondensed-700": BarlowCondensed_700Bold,
    "BarlowCondensed-800": BarlowCondensed_800ExtraBold,
    "BarlowCondensed-900": BarlowCondensed_900Black,
    "Inter-400": Inter_400Regular,
    "Inter-500": Inter_500Medium,
    "Inter-600": Inter_600SemiBold,
    "Inter-700": Inter_700Bold
  });

  return (
    <AuthProvider>
      <RolesProvider>
        <Stack screenOptions={{ headerShown: false }} />
      </RolesProvider>
    </AuthProvider>
  );
}
