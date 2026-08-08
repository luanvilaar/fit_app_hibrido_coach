import { AthleteShell } from "@/components/athlete-shell";
import { CalendarScreen } from "@/components/calendar-screen";

export default function CalendarRoute() {
  return (
    <AthleteShell active="calendario">
      <CalendarScreen />
    </AthleteShell>
  );
}
