import { Ionicons } from "@expo/vector-icons";
import { useRouter, type Href } from "expo-router";
import { useEffect, type PropsWithChildren } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, fontFamilies, radius, spacing } from "@fitblock/design-tokens";
import { AuthLoadingScreen } from "@/components/auth-screen";
import { useUserRoles } from "@/auth/roles-provider";
import { hasRole, roleFallbackRoute, type AppRole } from "@/auth/roles";

type RequireRoleProps = PropsWithChildren<{
  role: AppRole;
  fallbackHref?: Href;
}>;

/**
 * Libera a área somente para quem possui o papel exigido.
 * Sem o papel, redireciona para `fallbackHref`; com falha de leitura, mantém bloqueado e oferece nova tentativa.
 */
export function RequireRole({ children, role, fallbackHref = roleFallbackRoute }: RequireRoleProps) {
  const router = useRouter();
  const { userRoles, isLoading, error, refresh } = useUserRoles();
  const isAllowed = hasRole(userRoles, role);
  const shouldRedirect = !isLoading && !error && !isAllowed;

  useEffect(() => {
    if (shouldRedirect) router.replace(fallbackHref);
  }, [fallbackHref, router, shouldRedirect]);

  if (isLoading) return <AuthLoadingScreen />;

  if (error) {
    return <RoleGateError message={error} onRetry={refresh} onLeave={() => router.replace(fallbackHref)} />;
  }

  if (!isAllowed) return <AuthLoadingScreen />;

  return children;
}

function RoleGateError({
  message,
  onRetry,
  onLeave
}: {
  message: string;
  onRetry: () => void;
  onLeave: () => void;
}) {
  return (
    <View style={styles.page} testID="role-gate-error">
      <View style={styles.iconWrap}>
        <Ionicons name="lock-closed-outline" size={26} color={colors.purple400} />
      </View>
      <Text style={styles.eyebrow}>ACESSO RESTRITO</Text>
      <Text style={styles.title}>Não conseguimos confirmar suas permissões.</Text>
      <Text style={styles.description}>{message}</Text>
      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Tentar novamente"
          testID="role-gate-retry"
          onPress={onRetry}
          style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
        >
          <Text style={styles.primaryButtonLabel}>Tentar novamente</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Voltar para Hoje"
          testID="role-gate-leave"
          onPress={onLeave}
          style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
        >
          <Text style={styles.secondaryButtonLabel}>Voltar para Hoje</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    alignItems: "flex-start",
    backgroundColor: colors.bg,
    flex: 1,
    justifyContent: "center",
    padding: spacing[8]
  },
  iconWrap: {
    alignItems: "center",
    backgroundColor: colors.surface04,
    borderColor: colors.borderPurple,
    borderRadius: radius.pill,
    borderWidth: 1,
    height: 56,
    justifyContent: "center",
    marginBottom: spacing[5],
    width: 56
  },
  eyebrow: {
    color: colors.purple400,
    fontFamily: fontFamilies.interface,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.3
  },
  title: {
    color: colors.textPrimary,
    fontFamily: fontFamilies.display,
    fontSize: 40,
    lineHeight: 40,
    marginTop: spacing[2],
    maxWidth: 560
  },
  description: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.interface,
    fontSize: 16,
    lineHeight: 24,
    marginTop: spacing[3],
    maxWidth: 520
  },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing[3],
    marginTop: spacing[6]
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: colors.purple500,
    borderRadius: radius.pill,
    justifyContent: "center",
    minHeight: 48,
    paddingHorizontal: spacing[6]
  },
  primaryButtonLabel: {
    color: colors.white,
    fontFamily: fontFamilies.interfaceBold,
    fontSize: 14
  },
  secondaryButton: {
    alignItems: "center",
    backgroundColor: colors.surface03,
    borderColor: colors.border,
    borderRadius: radius.pill,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 48,
    paddingHorizontal: spacing[6]
  },
  secondaryButtonLabel: {
    color: colors.textPrimary,
    fontFamily: fontFamilies.interfaceBold,
    fontSize: 14
  },
  pressed: {
    opacity: 0.72
  }
});
