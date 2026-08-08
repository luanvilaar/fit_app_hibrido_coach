import { Stack } from "expo-router";
import { RequireAuth } from "@/auth/require-auth";

export default function AthleteLayout() {
  return (
    <RequireAuth>
      <Stack screenOptions={{ headerShown: false }} />
    </RequireAuth>
  );
}
