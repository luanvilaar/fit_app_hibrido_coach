import { AthleteShell } from "@/components/athlete-shell";
import { PrescriptionScreen } from "@/components/coach-hibrido/prescription-screen";

export default function CoachCalendarRoute() {
  return (
    <AthleteShell active="coach">
      <PrescriptionScreen />
    </AthleteShell>
  );
}
