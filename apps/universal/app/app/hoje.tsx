import { AthleteShell } from "@/components/athlete-shell";
import { TodayScreen } from "@/components/today-screen";
import { RequireRole } from "@/auth/require-role";

export default function TodayRoute() {
  return (
    <RequireRole role="athlete"><AthleteShell active="hoje" editorial><TodayScreen /></AthleteShell></RequireRole>
  );
}
