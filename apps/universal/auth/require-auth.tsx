import { useRouter } from "expo-router";
import { useEffect, type PropsWithChildren } from "react";
import { AuthLoadingScreen } from "@/components/auth-screen";
import { useAuth } from "@/auth/auth-provider";

export function RequireAuth({ children }: PropsWithChildren) {
  const router = useRouter();
  const { isLoading, session } = useAuth();

  useEffect(() => {
    if (!isLoading && !session) router.replace("/entrar");
  }, [isLoading, router, session]);

  if (isLoading || !session) return <AuthLoadingScreen />;

  return children;
}
