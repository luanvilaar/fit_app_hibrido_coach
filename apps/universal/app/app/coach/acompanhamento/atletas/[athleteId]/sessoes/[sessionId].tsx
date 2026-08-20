import { AthleteShell } from "@/components/athlete-shell";
import { CoachSupervisionSessionScreen } from "@/components/coach/coach-supervision-screen";

export default function CoachSupervisionSessionRoute() {
  return <AthleteShell active="coach-acompanhamento"><CoachSupervisionSessionScreen /></AthleteShell>;
}
