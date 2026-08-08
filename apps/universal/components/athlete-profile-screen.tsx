import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useState } from "react";
import type { ComponentProps } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { colors, fontFamilies, radius, spacing, typeScale } from "@fitblock/design-tokens";
import { createTeamDiscoveryRepository, type DiscoverableTeamRecord } from "@fitblock/backend";
import { describeTeamDiscoveryBackendError, validateDisplayName } from "@/data/team-discovery";
import { AthleteShell } from "@/components/athlete-shell";
import { GroupSelectModal } from "@/components/group-select-modal";
import { useAuth } from "@/auth/auth-provider";
import { getSupabaseConfigurationError, supabase } from "@/lib/supabase";

type IconName = ComponentProps<typeof Ionicons>["name"];

export function AthleteProfileScreen() {
  const { user } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [isSavingName, setIsSavingName] = useState(false);
  const [teams, setTeams] = useState<DiscoverableTeamRecord[]>([]);
  const [isLoadingTeams, setIsLoadingTeams] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isRequestingJoin, setIsRequestingJoin] = useState(false);
  const [cancelingRequestId, setCancelingRequestId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const loadTeams = useCallback(async () => {
    if (!supabase) return;
    setIsLoadingTeams(true);
    try {
      const repository = createTeamDiscoveryRepository(supabase);
      setTeams(await repository.listDiscoverableTeams());
    } catch (error: unknown) {
      setErrorMessage(describeTeamDiscoveryBackendError(error));
    } finally {
      setIsLoadingTeams(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    if (!supabase || !user) {
      setIsLoadingProfile(false);
      setIsLoadingTeams(false);
      if (!supabase) setErrorMessage(getSupabaseConfigurationError() ?? "Perfil indisponível.");
      return () => {
        mounted = false;
      };
    }

    setIsLoadingProfile(true);
    const repository = createTeamDiscoveryRepository(supabase);
    void repository
      .getMyProfile(user.id)
      .then((profile) => {
        if (mounted) setDisplayName(profile?.display_name ?? "");
      })
      .catch((error: unknown) => {
        if (mounted) setErrorMessage(describeTeamDiscoveryBackendError(error));
      })
      .finally(() => {
        if (mounted) setIsLoadingProfile(false);
      });

    void loadTeams();

    return () => {
      mounted = false;
    };
  }, [user, loadTeams]);

  async function handleSaveName() {
    if (!supabase || isSavingName) return;

    setErrorMessage(null);
    setSuccessMessage(null);

    let normalizedName: string;
    try {
      normalizedName = validateDisplayName(displayName);
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message : "Nome inválido.");
      return;
    }

    setIsSavingName(true);
    try {
      const repository = createTeamDiscoveryRepository(supabase);
      const profile = await repository.updateMyDisplayName(normalizedName);
      setDisplayName(profile.display_name ?? normalizedName);
      setSuccessMessage("Nome atualizado.");
    } catch (error: unknown) {
      setErrorMessage(describeTeamDiscoveryBackendError(error));
    } finally {
      setIsSavingName(false);
    }
  }

  async function handleRequestJoin(teamId: string) {
    if (!supabase || isRequestingJoin) return;

    setIsRequestingJoin(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const repository = createTeamDiscoveryRepository(supabase);
      await repository.requestTeamJoin(teamId);
      await loadTeams();
      setSuccessMessage("Solicitação enviada. Aguarde a aprovação do treinador.");
      setIsModalOpen(false);
    } catch (error: unknown) {
      setErrorMessage(describeTeamDiscoveryBackendError(error));
    } finally {
      setIsRequestingJoin(false);
    }
  }

  async function handleCancelRequest(requestId: string) {
    if (!supabase || cancelingRequestId) return;

    setCancelingRequestId(requestId);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const repository = createTeamDiscoveryRepository(supabase);
      await repository.cancelTeamJoinRequest(requestId);
      await loadTeams();
      setSuccessMessage("Solicitação cancelada.");
    } catch (error: unknown) {
      setErrorMessage(describeTeamDiscoveryBackendError(error));
    } finally {
      setCancelingRequestId(null);
    }
  }

  const linkedTeams = teams.filter((team) => team.membership_status === "member");
  const pendingTeams = teams.filter((team) => team.membership_status === "pending");

  return (
    <AthleteShell active="perfil">
      <View style={styles.page} testID="athlete-profile-screen">
        <Text style={styles.pageTitle}>Perfil</Text>

        {errorMessage && <ProfileMessage icon="alert-circle-outline" text={errorMessage} error />}
        {successMessage && <ProfileMessage icon="checkmark-circle-outline" text={successMessage} success />}

        <View style={styles.card} testID="athlete-name-card">
          <Text style={styles.eyebrow}>SEU NOME</Text>
          <Text style={styles.title}>Como o treinador vai te ver</Text>

          {isLoadingProfile ? (
            <Text style={styles.helperText}>Carregando...</Text>
          ) : (
            <>
              <TextInput
                accessibilityLabel="Seu nome de exibição"
                onChangeText={setDisplayName}
                placeholder="Seu nome completo"
                placeholderTextColor={colors.textMuted}
                style={styles.input}
                testID="display-name-input"
                value={displayName}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Salvar nome"
                accessibilityState={{ disabled: isSavingName }}
                disabled={isSavingName}
                testID="save-display-name"
                onPress={() => void handleSaveName()}
                style={({ pressed }) => [
                  styles.submitButton,
                  isSavingName && styles.submitButtonDisabled,
                  pressed && styles.pressed
                ]}
              >
                <Text style={styles.submitButtonText}>{isSavingName ? "Salvando..." : "Salvar"}</Text>
              </Pressable>
            </>
          )}
        </View>

        <View style={styles.card} testID="athlete-link-card">
          <Text style={styles.eyebrow}>VÍNCULO</Text>
          <Text style={styles.title}>Grupo ou treinador</Text>

          {isLoadingTeams ? (
            <Text style={styles.helperText}>Carregando vínculos...</Text>
          ) : (
            <>
              {linkedTeams.map((team) => (
                <View key={team.id} style={styles.linkedRow} testID={`linked-team-${team.id}`}>
                  <Ionicons name="checkmark-circle" size={20} color={colors.success} />
                  <View style={styles.linkedCopy}>
                    <Text style={styles.linkedName}>{team.name}</Text>
                    <Text style={styles.linkedCoach}>treinador: {team.coach_display_name}</Text>
                  </View>
                </View>
              ))}

              {pendingTeams.map((team) => (
                <View key={team.id} style={styles.pendingRow} testID={`pending-team-${team.id}`}>
                  <View style={styles.linkedCopy}>
                    <Text style={styles.linkedName}>{team.name}</Text>
                    <Text style={styles.pendingText}>
                      Solicitação enviada, aguardando aprovação de {team.coach_display_name}.
                    </Text>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Cancelar solicitação para ${team.name}`}
                    accessibilityState={{ disabled: cancelingRequestId === team.join_request_id }}
                    disabled={cancelingRequestId === team.join_request_id}
                    testID={`cancel-request-${team.id}`}
                    onPress={() => team.join_request_id && void handleCancelRequest(team.join_request_id)}
                    style={({ pressed }) => [styles.cancelLink, pressed && styles.pressed]}
                  >
                    <Text style={styles.cancelLinkText}>
                      {cancelingRequestId === team.join_request_id ? "Cancelando..." : "Cancelar"}
                    </Text>
                  </Pressable>
                </View>
              ))}

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Selecionar grupo ou treinador"
                testID="open-group-select"
                onPress={() => setIsModalOpen(true)}
                style={({ pressed }) => [styles.selectBox, pressed && styles.pressed]}
              >
                <Text style={styles.selectBoxText}>
                  {linkedTeams.length > 0 || pendingTeams.length > 0
                    ? "Vincular a outro grupo"
                    : "Selecionar grupo ou treinador"}
                </Text>
                <Ionicons name="chevron-down" size={18} color={colors.textSecondary} />
              </Pressable>
            </>
          )}
        </View>
      </View>

      {isModalOpen && (
        <GroupSelectModal
          teams={teams}
          isLoading={isLoadingTeams}
          isSubmitting={isRequestingJoin}
          onRequestJoin={(teamId) => void handleRequestJoin(teamId)}
          onDismiss={() => setIsModalOpen(false)}
        />
      )}
    </AthleteShell>
  );
}

function ProfileMessage({
  icon,
  text,
  error = false,
  success = false
}: {
  icon: IconName;
  text: string;
  error?: boolean;
  success?: boolean;
}) {
  return (
    <View
      accessibilityRole="alert"
      style={[styles.messageCard, error && styles.messageCardError, success && styles.messageCardSuccess]}
      testID={error ? "athlete-profile-error-message" : "athlete-profile-success-message"}
    >
      <Ionicons name={icon} size={20} color={error ? colors.danger : colors.success} />
      <Text style={styles.messageText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { gap: spacing[4] },
  pageTitle: { color: colors.ink, fontFamily: fontFamilies.interface, fontSize: typeScale.headingXl, fontWeight: "700" },
  messageCard: {
    alignItems: "center",
    backgroundColor: colors.canvas,
    borderColor: colors.hairline,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing[3],
    padding: spacing[4]
  },
  messageCardError: { borderColor: "#F3C3C8" },
  messageCardSuccess: { borderColor: "#B6E1CC" },
  messageText: { color: colors.textSecondary, flex: 1, fontFamily: fontFamilies.interface, fontSize: 14 },
  card: {
    backgroundColor: colors.canvas,
    borderColor: colors.hairline,
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing[5]
  },
  eyebrow: { color: colors.textMuted, fontFamily: fontFamilies.interface, fontSize: 10, fontWeight: "800", letterSpacing: 1.3 },
  title: {
    color: colors.ink,
    fontFamily: fontFamilies.interface,
    fontSize: typeScale.headingLg,
    fontWeight: "700",
    marginBottom: spacing[4],
    marginTop: spacing[2]
  },
  helperText: { color: colors.textSecondary, fontFamily: fontFamilies.interface, fontSize: 13 },
  input: {
    backgroundColor: colors.softCloud,
    borderColor: colors.hairline,
    borderRadius: radius.sm,
    borderWidth: 1,
    color: colors.ink,
    fontFamily: fontFamilies.interface,
    fontSize: 14,
    minHeight: 44,
    paddingHorizontal: spacing[4],
    marginBottom: spacing[3]
  },
  submitButton: {
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: colors.fitblockPurple,
    borderRadius: radius.pill,
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: spacing[5]
  },
  submitButtonDisabled: { opacity: 0.45 },
  submitButtonText: { color: colors.canvas, fontFamily: fontFamilies.interface, fontSize: 13, fontWeight: "700" },
  linkedRow: {
    alignItems: "center",
    borderTopColor: colors.hairline,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: spacing[3],
    paddingVertical: spacing[3]
  },
  pendingRow: {
    alignItems: "center",
    borderTopColor: colors.hairline,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: spacing[3],
    justifyContent: "space-between",
    paddingVertical: spacing[3]
  },
  linkedCopy: { flex: 1, minWidth: 0 },
  linkedName: { color: colors.ink, fontFamily: fontFamilies.interface, fontSize: 14, fontWeight: "700" },
  linkedCoach: { color: colors.textMuted, fontFamily: fontFamilies.interface, fontSize: 12, marginTop: 2 },
  pendingText: { color: colors.textSecondary, fontFamily: fontFamilies.interface, fontSize: 12, marginTop: 2 },
  cancelLink: { minHeight: 32, justifyContent: "center", paddingHorizontal: spacing[2] },
  cancelLinkText: { color: colors.danger, fontFamily: fontFamilies.interface, fontSize: 12, fontWeight: "700" },
  selectBox: {
    alignItems: "center",
    backgroundColor: colors.softCloud,
    borderColor: colors.hairline,
    borderRadius: radius.sm,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: spacing[3],
    minHeight: 52,
    paddingHorizontal: spacing[4]
  },
  selectBoxText: { color: colors.ink, fontFamily: fontFamilies.interface, fontSize: 14, fontWeight: "700" },
  pressed: { opacity: 0.72 }
});
