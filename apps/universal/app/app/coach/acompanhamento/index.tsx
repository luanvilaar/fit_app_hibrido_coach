import { AthleteShell } from "@/components/athlete-shell";
import { CoachSupervisionScreen } from "@/components/coach/coach-supervision-screen";

export default function CoachSupervisionRoute() {
  return <AthleteShell active="coach-acompanhamento"><CoachSupervisionScreen /></AthleteShell>;
}
