import { AthleteShell } from "@/components/athlete-shell";
import { CoachTeamsScreen } from "@/components/coach-teams-screen";

export default function CoachTeamsRoute() {
  return (
    <AthleteShell active="coach-equipes">
      <CoachTeamsScreen />
    </AthleteShell>
  );
}
