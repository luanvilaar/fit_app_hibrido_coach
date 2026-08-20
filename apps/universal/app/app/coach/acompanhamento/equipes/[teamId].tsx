import { AthleteShell } from "@/components/athlete-shell";
import { CoachSupervisionTeamScreen } from "@/components/coach/coach-supervision-screen";

export default function CoachSupervisionTeamRoute() {
  return <AthleteShell active="coach-acompanhamento"><CoachSupervisionTeamScreen /></AthleteShell>;
}
