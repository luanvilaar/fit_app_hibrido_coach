import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import type { ComponentProps } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, fontFamilies, radius, spacing } from "@fitblock/design-tokens";
import { createCoachFlowRepository, type TrainingGroupSummary } from "@fitblock/backend";
import {
  buildCreateTeamPayload,
  createInitialTeamForm,
  describeTeamBackendError,
  type TeamForm as TeamFormValue
} from "@/data/coach-teams";
import { TeamForm } from "@/components/coach/team-form";
import { getSupabaseConfigurationError, supabase } from "@/lib/supabase";

type IconName = ComponentProps<typeof Ionicons>["name"];

const levelLabels: Record<TrainingGroupSummary["level"], string> = {
  iniciante: "Iniciante",
  intermediário: "Intermediário",
  avançado: "Avançado"
};

export function CoachTeamsScreen() {
  const router = useRouter();
  const [teams, setTeams] = useState<TrainingGroupSummary[]>([]);
  const [form, setForm] = useState<TeamFormValue>(() => createInitialTeamForm());
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [focusedTeamId, setFocusedTeamId] = useState<string | null>(null);

  async function refresh() {
    if (!supabase) {
      setIsLoading(false);
      setErrorMessage(getSupabaseConfigurationError() ?? "Gestão de equipes indisponível.");
      return;
    }

    const repository = createCoachFlowRepository(supabase);
    try {
      setTeams(await repository.listCoachTeamsWithMemberCounts());
    } catch (error: unknown) {
      setErrorMessage(describeTeamBackendError(error));
      setTeams([]);
    }
  }

  useEffect(() => {
    let mounted = true;
    setIsLoading(true);
    setErrorMessage(null);

    void refresh().finally(() => {
      if (mounted) setIsLoading(false);
    });

    return () => {
      mounted = false;
    };
  }, []);

  async function handleCreate() {
    if (!supabase || isSaving) return;

    setIsSaving(true);
    setErrorMessage(null);

    try {
      const repository = createCoachFlowRepository(supabase);
      const payload = buildCreateTeamPayload(form);
      await repository.createTrainingGroup(payload);
      setForm(createInitialTeamForm());
      await refresh();
    } catch (error: unknown) {
      setErrorMessage(describeTeamBackendError(error));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <View style={styles.page} testID="coach-teams-screen">
      <View style={styles.pageIntro}>
        <Text style={styles.eyebrow}>ÁREA DO COACH</Text>
        <Text style={styles.pageTitle}>
          Suas <Text style={styles.pageTitleChip}>equipes</Text>.
        </Text>
        <Text style={styles.pageDescription}>
          Crie grupos, defina nível e objetivo, e gerencie quem faz parte de cada equipe.
        </Text>
      </View>

      {errorMessage && <CoachMessage icon="alert-circle-outline" text={errorMessage} />}

      <View style={styles.contentGrid}>
        <TeamForm form={form} mode="create" isSaving={isSaving} onChange={setForm} onSubmit={() => void handleCreate()} />

        <View style={styles.listCard} testID="coach-teams-list">
          <Text style={styles.eyebrowMuted}>SUAS EQUIPES</Text>
          {isLoading && <Text style={styles.helperText}>Carregando equipes...</Text>}

          {!isLoading && teams.length === 0 && (
            <View style={styles.emptyState} testID="coach-teams-empty">
              <View style={styles.emptyStateCopy}>
                <Text style={styles.helperText}>Você ainda não criou nenhuma equipe.</Text>
                <Text style={styles.emptyStateHint}>Preencha o formulário ao lado para montar a primeira.</Text>
              </View>
              <Ionicons color={colors.purple400} name="people-outline" size={40} style={styles.emptyIcon} />
            </View>
          )}

          {teams.map((team) => (
            <Pressable
              key={team.id}
              accessibilityRole="button"
              accessibilityLabel={`Abrir equipe ${team.name}`}
              testID={`team-card-${team.id}`}
              onPress={() => router.push(`/app/coach/equipes/${team.id}`)}
              onFocus={() => setFocusedTeamId(team.id)}
              onBlur={() => setFocusedTeamId(null)}
              style={({ pressed }) => [
                styles.teamCard,
                focusedTeamId === team.id && styles.focusedControl,
                pressed && styles.pressed
              ]}
            >
              <View style={styles.teamCardCopy}>
                <Text style={styles.teamCardName}>{team.name}</Text>
                <Text style={styles.teamCardMeta}>
                  {levelLabels[team.level]} · {team.objective}
                </Text>
                <Text style={styles.teamCardCounts}>
                  {team.coach_count} {team.coach_count === 1 ? "coach" : "coaches"} · {team.athlete_count}{" "}
                  {team.athlete_count === 1 ? "atleta" : "atletas"}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
            </Pressable>
          ))}
        </View>
      </View>
    </View>
  );
}

function CoachMessage({ icon, text }: { icon: IconName; text: string }) {
  return (
    <View accessibilityRole="alert" style={styles.messageCard} testID="coach-teams-error">
      <Ionicons name={icon} size={20} color={colors.danger} />
      <Text style={styles.messageText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { gap: spacing[5] },
  pageIntro: { maxWidth: 620 },
  eyebrow: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.interfaceBold,
    fontSize: 11,
    letterSpacing: 1.6,
    marginBottom: spacing[2]
  },
  pageTitle: {
    color: colors.textPrimary,
    fontFamily: fontFamilies.display,
    fontSize: 40,
    letterSpacing: -0.4,
    lineHeight: 42
  },
  pageTitleChip: {
    backgroundColor: colors.purple500,
    color: colors.white,
    fontFamily: fontFamilies.display,
    fontSize: 40,
    letterSpacing: -0.4,
    overflow: "hidden",
    paddingHorizontal: spacing[2]
  },
  pageDescription: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.interface,
    fontSize: 15,
    lineHeight: 22,
    marginTop: spacing[3]
  },
  messageCard: {
    alignItems: "center",
    backgroundColor: colors.surface01,
    borderColor: colors.danger,
    borderRadius: radius.lg,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing[3],
    padding: spacing[4]
  },
  messageText: { color: colors.textSecondary, flex: 1, fontFamily: fontFamilies.interface, fontSize: 14 },
  contentGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing[5] },
  listCard: {
    backgroundColor: colors.surface02,
    borderColor: colors.border,
    borderRadius: radius.xl,
    borderWidth: 1,
    flex: 1,
    minWidth: 0,
    padding: spacing[5]
  },
  eyebrowMuted: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.interfaceBold,
    fontSize: 10,
    letterSpacing: 1.3,
    marginBottom: spacing[3]
  },
  helperText: { color: colors.textSecondary, fontFamily: fontFamilies.interface, fontSize: 13 },
  emptyState: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[3],
    justifyContent: "space-between",
    paddingVertical: spacing[2]
  },
  emptyStateCopy: { flex: 1, minWidth: 0 },
  emptyStateHint: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.interface,
    fontSize: 12,
    marginTop: spacing[1]
  },
  emptyIcon: { flexShrink: 0 },
  teamCard: {
    alignItems: "center",
    borderRadius: radius.md,
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 72,
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[3]
  },
  teamCardCopy: { flex: 1, minWidth: 0 },
  teamCardName: { color: colors.textPrimary, fontFamily: fontFamilies.interfaceBold, fontSize: 14 },
  teamCardMeta: { color: colors.textSecondary, fontFamily: fontFamilies.interface, fontSize: 12, marginTop: 3 },
  teamCardCounts: { color: colors.textSecondary, fontFamily: fontFamilies.interface, fontSize: 11, marginTop: 3 },
  focusedControl: { backgroundColor: colors.surface03, borderColor: colors.purple400, borderWidth: 1 },
  pressed: { backgroundColor: colors.surface03, opacity: 0.85 }
});
