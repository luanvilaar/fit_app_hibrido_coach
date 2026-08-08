import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useState } from "react";
import type { ComponentProps } from "react";
import { StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { colors, fontFamilies, radius, spacing, typeScale } from "@fitblock/design-tokens";
import {
  createCoachFlowRepository,
  type ExerciseRecord,
  type SessionTemplateSummary,
  type TrainingGroupRecord
} from "@fitblock/backend";
import { toCalendarDate } from "@/data/calendar";
import {
  buildCreateTemplatePayload,
  buildDuplicateTitle,
  buildUpdateTemplatePayload,
  createInitialLibraryForm,
  describeLibraryBackendError,
  toLibraryForm,
  type LibraryTemplateForm
} from "@/data/coach-library";
import { LibraryEditor } from "@/components/coach/library-editor";
import { LibraryList } from "@/components/coach/library-list";
import { type ApplyForm } from "@/components/coach/apply-modal";
import { getSupabaseConfigurationError, supabase } from "@/lib/supabase";

type IconName = ComponentProps<typeof Ionicons>["name"];

function tomorrow(): string {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return toCalendarDate(date);
}

export function CoachLibraryScreen() {
  const { width } = useWindowDimensions();
  const isCompact = width < 900;

  const [templates, setTemplates] = useState<SessionTemplateSummary[]>([]);
  const [exercises, setExercises] = useState<ExerciseRecord[]>([]);
  const [teams, setTeams] = useState<TrainingGroupRecord[]>([]);
  const [form, setForm] = useState<LibraryTemplateForm>(() => createInitialLibraryForm());
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [busyTemplateId, setBusyTemplateId] = useState<string | null>(null);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const [applyingTemplateId, setApplyingTemplateId] = useState<string | null>(null);
  const [applyForm, setApplyForm] = useState<ApplyForm>({ teamId: "", scheduledDate: tomorrow() });
  const [isApplying, setIsApplying] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!successMessage && !errorMessage) return;
    const timer = setTimeout(() => {
      setSuccessMessage(null);
      setErrorMessage(null);
    }, 4000);
    return () => clearTimeout(timer);
  }, [successMessage, errorMessage]);

  const refresh = useCallback(async () => {
    if (!supabase) return;
    const repository = createCoachFlowRepository(supabase);
    const [nextTemplates, nextExercises, nextTeams] = await Promise.all([
      repository.listSessionTemplates(),
      repository.listExercises(),
      repository.listCoachTeams()
    ]);
    setTemplates(nextTemplates);
    setExercises(nextExercises);
    setTeams(nextTeams);
    setApplyForm((current: ApplyForm) => ({ ...current, teamId: current.teamId || nextTeams[0]?.id || "" }));
  }, []);

  useEffect(() => {
    let mounted = true;
    setIsLoading(true);
    setErrorMessage(null);

    if (!supabase) {
      setIsLoading(false);
      setErrorMessage(getSupabaseConfigurationError() ?? "Biblioteca de treinos indisponível.");
      return () => {
        mounted = false;
      };
    }

    void refresh()
      .catch((error: unknown) => {
        if (mounted) setErrorMessage(describeLibraryBackendError(error));
      })
      .finally(() => {
        if (mounted) setIsLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [refresh]);

  const resetToCreateMode = useCallback(() => {
    setEditingTemplateId(null);
    setForm(createInitialLibraryForm());
  }, []);

  async function handleSubmit() {
    if (!supabase || isSaving) return;

    setIsSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const repository = createCoachFlowRepository(supabase);

      if (editingTemplateId) {
        await repository.updateSessionTemplateContent(buildUpdateTemplatePayload(editingTemplateId, form));
        setSuccessMessage("Treino atualizado na biblioteca.");
      } else {
        await repository.createSessionTemplate(buildCreateTemplatePayload(form));
        setSuccessMessage("Treino salvo na biblioteca.");
      }

      await refresh();
      resetToCreateMode();
    } catch (error: unknown) {
      setErrorMessage(describeLibraryBackendError(error));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleEdit(templateId: string) {
    if (!supabase) return;

    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const repository = createCoachFlowRepository(supabase);
      const content = await repository.getSessionTemplateContent(templateId);
      setForm(toLibraryForm(content));
      setEditingTemplateId(templateId);
    } catch (error: unknown) {
      setErrorMessage(describeLibraryBackendError(error));
    }
  }

  async function handleDuplicate(templateId: string) {
    if (!supabase || busyTemplateId) return;

    setBusyTemplateId(templateId);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const repository = createCoachFlowRepository(supabase);
      const content = await repository.getSessionTemplateContent(templateId);
      const duplicated = toLibraryForm(content);
      await repository.createSessionTemplate(
        buildCreateTemplatePayload({ ...duplicated, title: buildDuplicateTitle(duplicated.title) })
      );
      await refresh();
      setSuccessMessage("Treino duplicado na biblioteca.");
    } catch (error: unknown) {
      setErrorMessage(describeLibraryBackendError(error));
    } finally {
      setBusyTemplateId(null);
    }
  }

  async function handleConfirmDelete(templateId: string) {
    if (!supabase || busyTemplateId) return;

    setBusyTemplateId(templateId);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const repository = createCoachFlowRepository(supabase);
      await repository.deleteSessionTemplate(templateId);
      if (editingTemplateId === templateId) resetToCreateMode();
      await refresh();
      setSuccessMessage("Treino removido da biblioteca.");
    } catch (error: unknown) {
      setErrorMessage(describeLibraryBackendError(error));
    } finally {
      setBusyTemplateId(null);
      setConfirmingDeleteId(null);
    }
  }

  async function handleConfirmApply(templateId: string) {
    if (!supabase || isApplying) return;

    setIsApplying(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const repository = createCoachFlowRepository(supabase);
      await repository.applySessionToTeam({
        templateId,
        teamId: applyForm.teamId,
        scheduledDate: applyForm.scheduledDate
      });
      setApplyingTemplateId(null);
      setSuccessMessage("Treino aplicado ao calendário da equipe.");
    } catch (error: unknown) {
      setErrorMessage(describeLibraryBackendError(error));
    } finally {
      setIsApplying(false);
    }
  }

  return (
    <View style={styles.page} testID="coach-library-screen">
      <View style={[styles.pageIntro, isCompact && styles.pageIntroCompact]}>
        <View style={styles.pageIntroCopy}>
          <Text style={styles.eyebrow}>ÁREA DO COACH</Text>
          <Text style={styles.pageTitle}>Sua biblioteca de treinos.</Text>
          <Text style={styles.pageDescription}>
            Monte um treino uma vez e aplique a quantas equipes e datas precisar, sem recriar do zero.
          </Text>
        </View>
      </View>

      {errorMessage && <CoachMessage icon="alert-circle-outline" text={errorMessage} error />}
      {successMessage && <CoachMessage icon="checkmark-circle-outline" text={successMessage} success />}

      <View style={[styles.contentGrid, isCompact && styles.contentGridCompact]}>
        <LibraryEditor
          form={form}
          exercises={exercises}
          mode={editingTemplateId ? "edit" : "create"}
          isSaving={isSaving}
          onChange={setForm}
          onSubmit={() => void handleSubmit()}
          onCancelEdit={resetToCreateMode}
        />

        <LibraryList
          templates={templates}
          teams={teams}
          isLoading={isLoading}
          editingTemplateId={editingTemplateId}
          busyTemplateId={busyTemplateId}
          confirmingDeleteId={confirmingDeleteId}
          applyingTemplateId={applyingTemplateId}
          applyForm={applyForm}
          isApplying={isApplying}
          onEdit={(templateId) => void handleEdit(templateId)}
          onDuplicate={(templateId) => void handleDuplicate(templateId)}
          onRequestDelete={setConfirmingDeleteId}
          onConfirmDelete={(templateId) => void handleConfirmDelete(templateId)}
          onDismissDelete={() => setConfirmingDeleteId(null)}
          onRequestApply={(templateId) => {
            setApplyingTemplateId(templateId);
            setApplyForm((current: ApplyForm) => ({ ...current, teamId: current.teamId || teams[0]?.id || "" }));
          }}
          onDismissApply={() => setApplyingTemplateId(null)}
          onApplyFormChange={setApplyForm}
          onConfirmApply={(templateId) => void handleConfirmApply(templateId)}
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
      accessibilityLiveRegion="polite"
      style={[styles.messageCard, error && styles.messageCardError, success && styles.messageCardSuccess]}
      testID={error ? "coach-library-error-message" : "coach-library-success-message"}
    >
      <Ionicons name={icon} size={22} color={error ? colors.danger : colors.success} />
      <Text style={[styles.messageText, error && styles.messageTextError, success && styles.messageTextSuccess]}>
        {text}
      </Text>
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
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.6,
    marginBottom: spacing[2]
  },
  pageTitle: { color: colors.ink, fontFamily: fontFamilies.interface, fontSize: typeScale.headingXl, fontWeight: "700" },
  pageDescription: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.interface,
    fontSize: 15,
    lineHeight: 22,
    marginTop: spacing[2],
    maxWidth: 620
  },
  messageCard: {
    alignItems: "center",
    backgroundColor: colors.canvas,
    borderColor: colors.hairline,
    borderRadius: radius.md,
    borderWidth: 2,
    flexDirection: "row",
    gap: spacing[3],
    padding: spacing[4]
  },
  messageCardError: { borderColor: "#F87171", backgroundColor: "#FEF2F2" },
  messageCardSuccess: { borderColor: "#34D399", backgroundColor: "#F0FDF4" },
  messageText: { color: colors.textSecondary, flex: 1, fontFamily: fontFamilies.interface, fontSize: 14, fontWeight: "500" },
  messageTextError: { color: colors.danger },
  messageTextSuccess: { color: "#059669" },
  contentGrid: { alignItems: "flex-start", flexDirection: "row", gap: spacing[5] },
  contentGridCompact: { flexDirection: "column" }
});
