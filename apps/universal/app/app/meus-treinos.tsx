import { AthleteShell } from "@/components/athlete-shell";
import { MyTrainingProgramsScreen } from "@/components/my-training-programs-screen";

export default function MyTrainingProgramsRoute() {
  return (
    <AthleteShell active="meus-treinos">
      <MyTrainingProgramsScreen />
    </AthleteShell>
  );
}
