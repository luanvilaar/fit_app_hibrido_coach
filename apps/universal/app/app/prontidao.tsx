import { AthleteShell } from "@/components/athlete-shell";
import { ReadinessCheckinScreen } from "@/components/readiness-checkin-screen";

export default function ReadinessCheckinRoute() {
  return (
    <AthleteShell active="hoje">
      <ReadinessCheckinScreen />
    </AthleteShell>
  );
}
