import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import type { ComponentProps } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, fontFamilies, radius, spacing, typeScale } from "@fitblock/design-tokens";
import {
  createCoachFlowRepository,
  createTeamDiscoveryRepository,
  type TeamJoinRequestWithAthleteRecord,
  type TeamMemberRecord,
  type TrainingGroupRecord
} from "@fitblock/backend";
import {
  buildAddMemberPayload,
  buildUpdateTeamPayload,
  createInitialTeamForm,
  describeTeamBackendError,
  toTeamForm,
  type MemberInviteForm,
  type TeamForm as TeamFormValue
} from "@/data/coach-teams";
import { describeTeamDiscoveryBackendError } from "@/data/team-discovery";
import { TeamForm } from "@/components/coach/team-form";
import { TeamMembersPanel } from "@/components/coach/team-members-panel";
import { TeamJoinRequestsPanel } from "@/components/coach/team-join-requests-panel";
import { getSupabaseConfigurationError, supabase } from "@/lib/supabase";

type IconName = ComponentProps<typeof Ionicons>["name"];

type CoachTeamDetailScreenProps = {
  teamId: string;
};

export function CoachTeamDetailScreen({ teamId }: CoachTeamDetailScreenProps) {
  const router = useRouter();
  const [team, setTeam] = useState<TrainingGroupRecord | null>(null);
  const [form, setForm] = useState<TeamFormValue>(() => createInitialTeamForm());
  const [members, setMembers] = useState<TeamMemberRecord[]>([]);
  const [joinRequests, setJoinRequests] = useState<TeamJoinRequestWithAthleteRecord[]>([]);
  const [isLoadingTeam, setIsLoadingTeam] = useState(true);
  const [isLoadingMembers, setIsLoadingMembers] = useState(true);
  const [isLoadingJoinRequests, setIsLoadingJoinRequests] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isInviting, setIsInviting] = useState(false);
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null);
  const [respondingRequestId, setRespondingRequestId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const loadMembers = useCallback(async () => {
    if (!supabase) return;
    setIsLoadingMembers(true);
    try {
      const repository = createCoachFlowRepository(supabase);
      setMembers(await repository.listTeamMembers(teamId));
    } catch (error: unknown) {
      setErrorMessage(describeTeamBackendError(error));
    } finally {
      setIsLoadingMembers(false);
    }
  }, [teamId]);

  const loadJoinRequests = useCallback(async () => {
    if (!supabase) return;
    setIsLoadingJoinRequests(true);
    try {
      const repository = createTeamDiscoveryRepository(supabase);
      setJoinRequests(await repository.listTeamJoinRequests(teamId));
    } catch (error: unknown) {
      setErrorMessage(describeTeamDiscoveryBackendError(error));
    } finally {
      setIsLoadingJoinRequests(false);
    }
  }, [teamId]);

  useEffect(() => {
    let mounted = true;

    if (!supabase) {
      setIsLoadingTeam(false);
      setIsLoadingMembers(false);
      setIsLoadingJoinRequests(false);
      setErrorMessage(getSupabaseConfigurationError() ?? "Gestão de equipes indisponível.");
      return () => {
        mounted = false;
      };
    }

    setIsLoadingTeam(true);
    setErrorMessage(null);

    const repository = createCoachFlowRepository(supabase);
    void repository
      .getTrainingGroup(teamId)
      .then((loadedTeam) => {
        if (!mounted) return;
        setTeam(loadedTeam);
        setForm(toTeamForm(loadedTeam));
      })
      .catch((error: unknown) => {
        if (mounted) setErrorMessage(describeTeamBackendError(error));
      })
      .finally(() => {
        if (mounted) setIsLoadingTeam(false);
      });

    void loadMembers();
    void loadJoinRequests();

    return () => {
      mounted = false;
    };
  }, [teamId, loadMembers, loadJoinRequests]);

  async function handleAcceptRequest(requestId: string) {
    if (!supabase || respondingRequestId) return;

    setRespondingRequestId(requestId);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const repository = createTeamDiscoveryRepository(supabase);
      await repository.respondTeamJoinRequest(requestId, true);
      await Promise.all([loadJoinRequests(), loadMembers()]);
      setSuccessMessage("Solicitação aceita. O atleta já faz parte da equipe.");
    } catch (error: unknown) {
      setErrorMessage(describeTeamDiscoveryBackendError(error));
    } finally {
      setRespondingRequestId(null);
    }
  }

  async function handleDeclineRequest(requestId: string) {
    if (!supabase || respondingRequestId) return;

    setRespondingRequestId(requestId);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const repository = createTeamDiscoveryRepository(supabase);
      await repository.respondTeamJoinRequest(requestId, false);
      await loadJoinRequests();
      setSuccessMessage("Solicitação recusada.");
    } catch (error: unknown) {
      setErrorMessage(describeTeamDiscoveryBackendError(error));
    } finally {
      setRespondingRequestId(null);
    }
  }

  async function handleSave() {
    if (!supabase || isSaving) return;

    setIsSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const repository = createCoachFlowRepository(supabase);
      const updated = await repository.updateTrainingGroup(buildUpdateTeamPayload(teamId, form));
      setTeam(updated);
      setForm(toTeamForm(updated));
      setSuccessMessage("Equipe atualizada.");
    } catch (error: unknown) {
      setErrorMessage(describeTeamBackendError(error));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleInvite(inviteForm: MemberInviteForm) {
    if (!supabase || isInviting) return;

    setIsInviting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const repository = createCoachFlowRepository(supabase);
      const payload = buildAddMemberPayload(teamId, inviteForm);
      await repository.addTeamMemberByEmail(payload);
      await loadMembers();
      setSuccessMessage("Membro adicionado à equipe.");
    } catch (error: unknown) {
      setErrorMessage(describeTeamBackendError(error));
    } finally {
      setIsInviting(false);
    }
  }

  async function handleRemoveMember(memberId: string) {
    if (!supabase || removingMemberId) return;

    setRemovingMemberId(memberId);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const repository = createCoachFlowRepository(supabase);
      await repository.removeTeamMember(memberId);
      await loadMembers();
      setSuccessMessage("Membro removido da equipe.");
    } catch (error: unknown) {
      setErrorMessage(describeTeamBackendError(error));
    } finally {
      setRemovingMemberId(null);
    }
  }

  async function handleDeleteTeam() {
    if (!supabase || isDeleting) return;

    setIsDeleting(true);
    setErrorMessage(null);

    try {
      const repository = createCoachFlowRepository(supabase);
      await repository.deleteTrainingGroup(teamId);
      router.replace("/app/coach/equipes");
    } catch (error: unknown) {
      setErrorMessage(describeTeamBackendError(error));
      setIsConfirmingDelete(false);
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <View style={styles.page} testID="coach-team-detail-screen">
      <Pressable
        accessibilityRole="link"
        accessibilityLabel="Voltar para a lista de equipes"
        testID="back-to-teams"
        onPress={() => router.push("/app/coach/equipes")}
        style={({ pressed }) => [styles.backLink, pressed && styles.pressed]}
      >
        <Ionicons name="chevron-back" size={16} color={colors.textSecondary} />
        <Text style={styles.backLinkText}>Equipes</Text>
      </Pressable>

      <Text style={styles.pageTitle}>{team?.name ?? "Equipe"}</Text>

      {errorMessage && <CoachMessage icon="alert-circle-outline" text={errorMessage} error />}
      {successMessage && <CoachMessage icon="checkmark-circle-outline" text={successMessage} success />}

      {isLoadingTeam ? (
        <Text style={styles.helperText}>Carregando equipe...</Text>
      ) : (
        team && (
          <>
            <TeamForm form={form} mode="edit" isSaving={isSaving} onChange={setForm} onSubmit={() => void handleSave()} />

            <TeamMembersPanel
              members={members}
              isLoading={isLoadingMembers}
              isInviting={isInviting}
              removingMemberId={removingMemberId}
              onInvite={(inviteForm) => void handleInvite(inviteForm)}
              onRemove={(memberId) => void handleRemoveMember(memberId)}
            />

            <TeamJoinRequestsPanel
              requests={joinRequests}
              isLoading={isLoadingJoinRequests}
              respondingRequestId={respondingRequestId}
              onAccept={(requestId) => void handleAcceptRequest(requestId)}
              onDecline={(requestId) => void handleDeclineRequest(requestId)}
            />

            <View style={styles.dangerCard} testID="coach-team-danger-zone">
              <Text style={styles.dangerTitle}>Excluir equipe</Text>
              <Text style={styles.dangerText}>
                Remove a equipe, seus membros e todo o calendário de sessões associado. Esta ação não pode ser
                desfeita.
              </Text>

              {isConfirmingDelete ? (
                <View style={styles.confirmActions}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Confirmar exclusão da equipe"
                    accessibilityState={{ disabled: isDeleting }}
                    disabled={isDeleting}
                    testID="confirm-delete-team"
                    onPress={() => void handleDeleteTeam()}
                    style={({ pressed }) => [styles.confirmDangerButton, pressed && styles.pressed]}
                  >
                    <Text style={styles.confirmDangerText}>{isDeleting ? "Excluindo..." : "Sim, excluir"}</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Manter a equipe"
                    testID="dismiss-delete-team"
                    onPress={() => setIsConfirmingDelete(false)}
                    style={({ pressed }) => [styles.ghostButton, pressed && styles.pressed]}
                  >
                    <Text style={styles.ghostButtonText}>Manter</Text>
                  </Pressable>
                </View>
              ) : (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Excluir equipe"
                  testID="request-delete-team"
                  onPress={() => setIsConfirmingDelete(true)}
                  style={({ pressed }) => [styles.dangerButton, pressed && styles.pressed]}
                >
                  <Ionicons name="trash-outline" size={16} color={colors.danger} />
                  <Text style={styles.dangerButtonText}>Excluir equipe</Text>
                </Pressable>
              )}
            </View>
          </>
        )
      )}
    </View>
  );
}

function CoachMessage({
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
      testID={error ? "coach-team-error-message" : "coach-team-success-message"}
    >
      <Ionicons name={icon} size={20} color={error ? colors.danger : colors.success} />
      <Text style={styles.messageText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { gap: spacing[4] },
  backLink: { alignItems: "center", alignSelf: "flex-start", flexDirection: "row", gap: spacing[1] },
  backLinkText: { color: colors.textSecondary, fontFamily: fontFamilies.interface, fontSize: 13, fontWeight: "700" },
  pageTitle: { color: colors.ink, fontFamily: fontFamilies.interface, fontSize: typeScale.headingXl, fontWeight: "700" },
  helperText: { color: colors.textSecondary, fontFamily: fontFamilies.interface, fontSize: 14 },
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
  dangerCard: {
    backgroundColor: "#FDF2F3",
    borderColor: "#F3C3C8",
    borderRadius: radius.lg,
    borderWidth: 1,
    marginTop: spacing[5],
    padding: spacing[5]
  },
  dangerTitle: { color: colors.ink, fontFamily: fontFamilies.interface, fontSize: 14, fontWeight: "700" },
  dangerText: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.interface,
    fontSize: 13,
    lineHeight: 20,
    marginTop: spacing[2]
  },
  dangerButton: {
    alignItems: "center",
    alignSelf: "flex-start",
    borderColor: "#F3C3C8",
    borderRadius: radius.pill,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing[2],
    marginTop: spacing[4],
    minHeight: 44,
    paddingHorizontal: spacing[4]
  },
  dangerButtonText: { color: colors.danger, fontFamily: fontFamilies.interface, fontSize: 13, fontWeight: "800" },
  confirmActions: { flexDirection: "row", gap: spacing[3], marginTop: spacing[4] },
  confirmDangerButton: {
    alignItems: "center",
    backgroundColor: colors.danger,
    borderRadius: radius.pill,
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: spacing[5]
  },
  confirmDangerText: { color: colors.canvas, fontFamily: fontFamilies.interface, fontSize: 13, fontWeight: "800" },
  ghostButton: {
    alignItems: "center",
    borderColor: colors.hairline,
    borderRadius: radius.pill,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: spacing[4]
  },
  ghostButtonText: { color: colors.textSecondary, fontFamily: fontFamilies.interface, fontSize: 12, fontWeight: "800" },
  pressed: { opacity: 0.72 }
});
