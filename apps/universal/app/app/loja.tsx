import { AthleteShell } from "@/components/athlete-shell";
import { PlaceholderScreen } from "@/components/placeholder-screen";

export default function StoreRoute() {
  return (
    <AthleteShell active="loja">
      <PlaceholderScreen
        eyebrow="Próximo módulo"
        title="Tudo que faz parte da experiência FitBlock."
        description="Programas, camps e produtos entram aqui em uma experiência de catálogo editorial e checkout web."
        icon="bag-handle-outline"
      />
    </AthleteShell>
  );
}
