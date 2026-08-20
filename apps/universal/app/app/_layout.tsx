import { Stack } from "expo-router";
import { RequireAuth } from "@/auth/require-auth";
import { ThemeProvider } from "@/theme/theme-provider";

export default function AthleteLayout() {
  return (
    <RequireAuth>
      <ThemeProvider>
        <Stack screenOptions={{ headerShown: false }}>
          {/* Seções irmãs do menu principal: troca lateral, não um mergulho na hierarquia. */}
          <Stack.Screen name="hoje" options={{ animation: "fade" }} />
          <Stack.Screen name="calendario" options={{ animation: "fade" }} />
          <Stack.Screen name="progresso" options={{ animation: "fade" }} />
          <Stack.Screen name="loja" options={{ animation: "fade" }} />
          <Stack.Screen name="perfil" options={{ animation: "fade" }} />
          {/* Check-in é uma tarefa autocontida e dispensável: sobe como folha, não empilha tela. */}
          <Stack.Screen name="prontidao" options={{ presentation: "modal" }} />
        </Stack>
      </ThemeProvider>
    </RequireAuth>
  );
}
