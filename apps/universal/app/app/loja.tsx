import { AthleteShell } from "@/components/athlete-shell";
import { StoreScreen } from "@/components/store-screen";

export default function StoreRoute() {
  return (
    <AthleteShell active="loja">
      <StoreScreen />
    </AthleteShell>
  );
}
