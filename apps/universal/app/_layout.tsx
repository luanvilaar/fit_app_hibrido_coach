import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import { AuthProvider } from "@/auth/auth-provider";
import { RolesProvider } from "@/auth/roles-provider";

export default function RootLayout() {
  // Tier de display do sistema: 96px uppercase com line-height 0.9.
  // Enquanto não carrega, o fallback de sistema segura o layout — não bloqueia a render.
  useFonts({ BebasNeue: require("../assets/BebasNeue-Regular.ttf") });

  return (
    <AuthProvider>
      <RolesProvider>
        <Stack screenOptions={{ headerShown: false }} />
      </RolesProvider>
    </AuthProvider>
  );
}
