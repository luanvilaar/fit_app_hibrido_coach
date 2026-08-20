import { AthleteShell } from "@/components/athlete-shell";
import { ProgramBuilderScreen } from "@/components/coach/program-builder-screen";

export default function CoachProductNewRoute() {
  return (
    <AthleteShell active="coach-produtos">
      <ProgramBuilderScreen guidedWorkspace />
    </AthleteShell>
  );
}
