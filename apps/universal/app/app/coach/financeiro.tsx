import { AthleteShell } from "@/components/athlete-shell";
import { FinanceScreen } from "@/components/coach/finance-screen";

export default function CoachFinanceRoute() {
  return (
    <AthleteShell active="coach-financeiro">
      <FinanceScreen />
    </AthleteShell>
  );
}
