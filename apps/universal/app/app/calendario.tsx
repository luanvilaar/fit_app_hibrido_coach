import { AthleteShell } from "@/components/athlete-shell";
import { CalendarScreen } from "@/components/calendar-screen";
import { RequireRole } from "@/auth/require-role";

export default function CalendarRoute() {
  return (
    <RequireRole role="athlete"><AthleteShell active="calendario"><CalendarScreen /></AthleteShell></RequireRole>
  );
}
