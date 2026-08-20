import { Redirect } from "expo-router";
import { AuthLoadingScreen } from "@/components/auth-screen";
import { useUserRoles } from "@/auth/roles-provider";
import { canAccessCoachArea, hasRole } from "@/auth/roles";

export default function AthleteIndex() {
  const { userRoles, isLoading } = useUserRoles();

  if (isLoading) return <AuthLoadingScreen />;
  if (canAccessCoachArea(userRoles)) return <Redirect href="/app/coach/acompanhamento" />;
  if (hasRole(userRoles, "athlete")) return <Redirect href="/app/hoje" />;

  return <Redirect href="/" />;
}
