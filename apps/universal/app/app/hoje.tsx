import { AthleteShell } from "@/components/athlete-shell";
import { TodayScreen } from "@/components/today-screen";

export default function TodayRoute() {
  return (
    <AthleteShell active="hoje">
      <TodayScreen />
    </AthleteShell>
  );
}

