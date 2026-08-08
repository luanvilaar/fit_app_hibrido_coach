import { useLocalSearchParams } from "expo-router";
import { AthleteShell } from "@/components/athlete-shell";
import { CoachTeamDetailScreen } from "@/components/coach-team-detail-screen";

export default function CoachTeamDetailRoute() {
  const { teamId } = useLocalSearchParams<{ teamId: string }>();

  if (!teamId) return null;

  return (
    <AthleteShell active="coach-equipes">
      <CoachTeamDetailScreen teamId={teamId} />
    </AthleteShell>
  );
}
