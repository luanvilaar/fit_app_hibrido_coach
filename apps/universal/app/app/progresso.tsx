import { AthleteShell } from "@/components/athlete-shell";
import { ProgressScreen } from "@/components/progress-screen";

export default function ProgressRoute() {
  return (
    <AthleteShell active="progresso">
      <ProgressScreen />
    </AthleteShell>
  );
}
