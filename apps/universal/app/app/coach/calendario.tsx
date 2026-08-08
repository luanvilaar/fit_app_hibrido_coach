import { AthleteShell } from "@/components/athlete-shell";
import { CoachCalendarScreen } from "@/components/coach-calendar-screen";

export default function CoachCalendarRoute() {
  return (
    <AthleteShell active="coach">
      <CoachCalendarScreen />
    </AthleteShell>
  );
}

