import { AthleteShell } from "@/components/athlete-shell";
import { StoreScreen } from "@/components/store-screen";
import { RequireRole } from "@/auth/require-role";

export default function StoreRoute() {
  return (
    <RequireRole role="athlete"><AthleteShell active="loja"><StoreScreen /></AthleteShell></RequireRole>
  );
}
