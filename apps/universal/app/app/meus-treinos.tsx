import { AthleteShell } from "@/components/athlete-shell";
import { MyTrainingProgramsScreen } from "@/components/my-training-programs-screen";
import { RequireRole } from "@/auth/require-role";

export default function MyTrainingProgramsRoute() {
  return (
    <RequireRole role="athlete"><AthleteShell active="meus-treinos"><MyTrainingProgramsScreen /></AthleteShell></RequireRole>
  );
}
