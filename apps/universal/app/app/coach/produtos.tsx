import { AthleteShell } from "@/components/athlete-shell";
import { CoachProductsScreen } from "@/components/coach/coach-products-screen";

export default function CoachProductsRoute() {
  return (
    <AthleteShell active="coach-produtos">
      <CoachProductsScreen />
    </AthleteShell>
  );
}
