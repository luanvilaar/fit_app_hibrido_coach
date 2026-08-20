import { AthleteShell } from "@/components/athlete-shell";
import { CoachSupervisionAthleteScreen } from "@/components/coach/coach-supervision-screen";

export default function CoachSupervisionAthleteRoute() {
  return <AthleteShell active="coach-acompanhamento"><CoachSupervisionAthleteScreen /></AthleteShell>;
}
