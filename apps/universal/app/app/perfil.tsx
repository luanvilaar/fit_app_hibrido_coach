import { AthleteProfileScreen } from "@/components/athlete-profile-screen";
import { RequireRole } from "@/auth/require-role";

export default function ProfileRoute() { return <RequireRole role="athlete"><AthleteProfileScreen /></RequireRole>; }
