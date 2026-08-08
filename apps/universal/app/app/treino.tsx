import { useLocalSearchParams } from "expo-router";
import { WorkoutSessionScreen } from "@/components/workout-session-screen";

export default function WorkoutSessionRoute() {
  const { sessionId } = useLocalSearchParams<{ sessionId?: string }>();

  // Sem sessionId na rota, o backend resolve a sessão publicada de hoje.
  return <WorkoutSessionScreen sessionId={typeof sessionId === "string" ? sessionId : null} />;
}
