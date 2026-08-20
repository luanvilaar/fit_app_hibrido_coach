import { AthleteShell } from "@/components/athlete-shell";
import { ReadinessCheckinScreen } from "@/components/readiness-checkin-screen";
import { RequireRole } from "@/auth/require-role";

export default function ReadinessCheckinRoute() {
  return (
    <RequireRole role="athlete"><AthleteShell active="hoje"><ReadinessCheckinScreen /></AthleteShell></RequireRole>
  );
}
