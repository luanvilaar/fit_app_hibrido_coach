import { AthleteShell } from "@/components/athlete-shell";
import { ProgressScreen } from "@/components/progress-screen";
import { RequireRole } from "@/auth/require-role";

export default function ProgressRoute() {
  return (
    <RequireRole role="athlete"><AthleteShell active="progresso"><ProgressScreen /></AthleteShell></RequireRole>
  );
}
