import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ComponentProps } from "react";
import { StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { colors, fontFamilies, radius, spacing, typeScale } from "@fitblock/design-tokens";
import {
  createCoachFlowRepository,
  type CalendarSessionRecord,
  type ExerciseRecord,
  type TrainingGroupRecord
} from "@fitblock/backend";
import { getWeekRange, parseCalendarDate, shiftWeek } from "@/data/calendar";
import {
  buildCoachSessionPayload,
  createInitialCoachSessionForm,
  describeCoachBackendError,
  toCoachSessionForm,
  type CoachSessionForm
} from "@/data/coach-calendar";
import { CoachCalendarBoard } from "@/components/coach/coach-calendar-board";
import { SessionEditor, type SessionEditorMode } from "@/components/coach/session-editor";
import { getSupabaseConfigurationError, supabase } from "@/lib/supabase";

type IconName = ComponentProps<typeof Ionicons>["name"];

export function CoachCalendarScreen() {
  const { width } = useWindowDimensions();
  const isCompact = width < 900;
  const [anchor, setAnchor] = useState(() => new Date());
  const [teams, setTeams] = useState<TrainingGroupRecord[]>([]);
  const [sessions, setSessions] = useState<CalendarSessionRecord[]>([]);
  const [exercises, setExercises] = useState<ExerciseRecord[]>([]);
  const [form, setForm] = useState<CoachSessionForm>(() => createInitialCoachSessionForm());
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const range = useMemo(() => getWeekRange(anchor), [anchor]);
  const mode: SessionEditorMode = editingSessionId ? "edit" : "create";

  useEffect(() => {
    let mounted = true;
    setIsLoading(true);
    setErrorMessage(null);

    if (!supabase) {
      setIsLoading(false);
      setErrorMessage(getSupabaseConfigurationError() ?? "Calendário do coach indisponível.");
      return () => {
        mounted = false;
      };
    }

    const repository = createCoachFlowRepository(supabase);
    void Promise.all([repository.listCoachTeams(), repository.listCoachCalendar(range), repository.listExercises()])
      .then(([nextTeams, nextSessions, nextExercises]) => {
        if (!mounted) return;
        setTeams(nextTeams);
        setSessions(nextSessions);
        setExercises(nextExercises);
        setForm((current) => ({ ...current, teamId: current.teamId || nextTeams[0]?.id || "" }));
      })
      .catch((error: unknown) => {
        if (!mounted) return;
        setErrorMessage(describeCoachBackendError(error));
        setTeams([]);
        setSessions([]);
        setExercises([]);
      })
      .finally(() => {
        if (mounted) setIsLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [range]);

  const resetToCreateMode = useCallback(() => {
    setEditingSessionId(null);
    setIsConfirmingDelete(false);
    setForm((current) => createInitialCoachSessionForm(current.teamId));
  }, []);

  function handleFormChange(next: CoachSessionForm) {
    setForm(next);
    setErrorMessage(null);
    setSuccessMessage(null);
  }

  function handleSelectSession(session: CalendarSessionRecord) {
    setEditingSessionId(session.id);
    setForm(toCoachSessionForm(session));
    setIsConfirmingDelete(false);
    setErrorMessage(null);
    setSuccessMessage(null);
  }

  async function handleSubmit() {
    if (!supabase || isSaving || isDeleting) return;

    setIsSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const repository = createCoachFlowRepository(supabase);
      const payload = buildCoachSessionPayload(form);

      if (editingSessionId) {
        await repository.updateSession({ sessionId: editingSessionId, ...payload });
      } else {
        await repository.prescribeSession(payload);
      }

      // A âncora precisa acompanhar a data salva, senão a sessão some da visão semanal —
      // a semana da data salva pode não ser a mesma que estava sendo exibida.
      const savedAnchor = parseCalendarDate(payload.scheduledDate);
      const nextRange = getWeekRange(savedAnchor);
      setAnchor(savedAnchor);
      setSessions(await repository.listCoachCalendar(nextRange));
      setSuccessMessage(
        editingSessionId
          ? "Sessão atualizada no calendário da equipe."
          : payload.status === "draft"
            ? "Rascunho salvo. O atleta ainda não enxerga esta sessão."
            : "Treino prescrito e publicado no calendário da equipe."
      );
      resetToCreateMode();
    } catch (error: unknown) {
      setErrorMessage(describeCoachBackendError(error));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete() {
    if (!supabase || !editingSessionId || isDeleting) return;

    setIsDeleting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const repository = createCoachFlowRepository(supabase);
      await repository.deleteSession(editingSessionId);
      setSessions(await repository.listCoachCalendar(range));
      setSuccessMessage("Sessão removida do calendário.");
      resetToCreateMode();
    } catch (error: unknown) {
      setErrorMessage(describeCoachBackendError(error));
      setIsConfirmingDelete(false);
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <View style={styles.page} testID="coach-calendar-screen">
      <View style={[styles.pageIntro, isCompact && styles.pageIntroCompact]}>
        <View style={styles.pageIntroCopy}>
          <Text style={styles.eyebrow}>ÁREA DO COACH</Text>
          <Text style={styles.pageTitle}>Prescreva com clareza.</Text>
          <Text style={styles.pageDescription}>
            Monte o treino com quantos blocos precisar, escolha a data e publique — ou salve como rascunho e ajuste depois.
          </Text>
        </View>
        <View style={styles.sourceBadge}>
          <View style={styles.sourceDot} />
          <Text style={styles.sourceBadgeText}>OPERAÇÃO ATIVA</Text>
        </View>
      </View>

      {errorMessage && <CoachMessage icon="alert-circle-outline" text={errorMessage} error />}
      {successMessage && <CoachMessage icon="checkmark-circle-outline" text={successMessage} success />}

      <View style={[styles.contentGrid, isCompact && styles.contentGridCompact]}>
        <SessionEditor
          form={form}
          teams={teams}
          exercises={exercises}
          mode={mode}
          isLoadingTeams={isLoading}
          isSaving={isSaving}
          isDeleting={isDeleting}
          isConfirmingDelete={isConfirmingDelete}
          onChange={handleFormChange}
          onSubmit={() => void handleSubmit()}
          onCancelEdit={resetToCreateMode}
          onRequestDelete={() => setIsConfirmingDelete(true)}
          onConfirmDelete={() => void handleDelete()}
          onDismissDelete={() => setIsConfirmingDelete(false)}
        />

        <CoachCalendarBoard
          anchor={anchor}
          sessions={sessions}
          selectedSessionId={editingSessionId}
          isLoading={isLoading}
          onSelectSession={handleSelectSession}
          onShiftPeriod={(amount) => setAnchor((current) => shiftWeek(current, amount))}
        />
      </View>
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
      testID={error ? "coach-error-message" : "coach-success-message"}
    >
      <Ionicons name={icon} size={20} color={error ? colors.danger : colors.success} />
      <Text style={styles.messageText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { gap: spacing[5] },
  pageIntro: { alignItems: "flex-end", flexDirection: "row", justifyContent: "space-between" },
  pageIntroCompact: { alignItems: "flex-start", flexDirection: "column", gap: spacing[4] },
  pageIntroCopy: { flex: 1, minWidth: 0 },
  eyebrow: {
    color: colors.fitblockPurple,
    fontFamily: fontFamilies.interface,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.6,
    marginBottom: spacing[2]
  },
  pageTitle: {
    color: colors.ink,
    fontFamily: fontFamilies.interface,
    fontSize: typeScale.headingXl,
    fontWeight: "700"
  },
  pageDescription: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.interface,
    fontSize: 15,
    lineHeight: 22,
    marginTop: spacing[2],
    maxWidth: 620
  },
  sourceBadge: {
    alignItems: "center",
    backgroundColor: "#E7F5EE",
    borderRadius: radius.pill,
    flexDirection: "row",
    gap: spacing[2],
    minHeight: 34,
    paddingHorizontal: spacing[3]
  },
  sourceDot: { backgroundColor: colors.success, borderRadius: radius.pill, height: 7, width: 7 },
  sourceBadgeText: {
    color: colors.success,
    fontFamily: fontFamilies.interface,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1
  },
  contentGrid: { alignItems: "flex-start", flexDirection: "row", gap: spacing[5] },
  contentGridCompact: { flexDirection: "column" },
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
  messageText: { color: colors.textSecondary, flex: 1, fontFamily: fontFamilies.interface, fontSize: 14 }
});
