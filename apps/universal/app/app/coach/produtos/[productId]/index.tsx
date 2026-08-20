import { useLocalSearchParams } from "expo-router";
import { AthleteShell } from "@/components/athlete-shell";
import { ProgramBuilderScreen } from "@/components/coach/program-builder-screen";

export default function CoachProductEditRoute() {
  const { productId } = useLocalSearchParams<{ productId: string }>();

  return (
    <AthleteShell active="coach-produtos">
      <ProgramBuilderScreen productId={productId} />
    </AthleteShell>
  );
}
