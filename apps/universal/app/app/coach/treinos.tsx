import { AthleteShell } from "@/components/athlete-shell";
import { CoachLibraryScreen } from "@/components/coach-library-screen";

export default function CoachLibraryRoute() {
  return (
    <AthleteShell active="coach-treinos">
      <CoachLibraryScreen />
    </AthleteShell>
  );
}
