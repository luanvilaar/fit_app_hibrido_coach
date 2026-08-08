import { Stack } from "expo-router";
import { RequireRole } from "@/auth/require-role";

export default function CoachLayout() {
  return (
    <RequireRole role="coach">
      <Stack screenOptions={{ headerShown: false }} />
    </RequireRole>
  );
}
