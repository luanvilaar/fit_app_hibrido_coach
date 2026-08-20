import { useLocalSearchParams } from "expo-router";
import { AthleteSessionScreen } from "@/components/coach-hibrido/athlete/session-screen";
import { RequireRole } from "@/auth/require-role";

export default function WorkoutSessionRoute() {
  const { sessionId } = useLocalSearchParams<{ sessionId?: string }>();

  // Sem sessionId na rota, o backend resolve a sessão publicada de hoje.
  return <RequireRole role="athlete"><AthleteSessionScreen sessionId={typeof sessionId === "string" ? sessionId : null} /></RequireRole>;
}
