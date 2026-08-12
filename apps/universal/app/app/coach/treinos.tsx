import { AthleteShell } from "@/components/athlete-shell";
import { LibraryScreen } from "@/components/coach-hibrido/library-screen";

export default function CoachLibraryRoute() {
  return (
    <AthleteShell active="coach-treinos">
      <LibraryScreen />
    </AthleteShell>
  );
}
