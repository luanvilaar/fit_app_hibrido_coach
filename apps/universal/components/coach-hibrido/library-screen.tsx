import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View, useWindowDimensions } from "react-native";
import {
  createCoachFlowRepository,
  type CreateExerciseRequest,
  type ExerciseRecord,
  type SessionTemplateSummary,
  type TrainingGroupRecord
} from "@fitblock/backend";
import { colors, fontFamilies, radius, spacing, typeScale } from "@fitblock/design-tokens";
import { toCalendarDate } from "@/data/calendar";
import {
  buildTemplatePayload,
  buildUpdateTemplatePayload,
  describePrescriptionError
} from "@/data/coach-hibrido/payload";
import { withMovement } from "@/data/coach-hibrido/movement-bank";
import { toTemplateForm } from "@/data/coach-hibrido/session-edit";
import { createInitialSessionForm, type SessionForm } from "@/data/coach-hibrido/session-form";
import { SessionComposer } from "@/components/coach-hibrido/session-composer";
import { getSupabaseConfigurationError, supabase } from "@/lib/supabase";

function tomorrow(): string {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return toCalendarDate(date);
}

export function LibraryScreen() {
  const { width } = useWindowDimensions();
  const isStacked = width < 1180;
  const [templates, setTemplates] = useState<SessionTemplateSummary[]>([]);
  const [teams, setTeams] = useState<TrainingGroupRecord[]>([]);
  const [catalog, setCatalog] = useState<ExerciseRecord[]>([]);
  const [form, setForm] = useState<SessionForm>(() => createInitialSessionForm());
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [applyTeamId, setApplyTeamId] = useState("");
  const [applyDate, setApplyDate] = useState(tomorrow);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    setIsLoading(true);

    if (!supabase) {
      setIsLoading(false);
      setErrorMessage(getSupabaseConfigurationError() ?? "Biblioteca indisponível.");
      return () => {
        mounted = false;
      };
    }

    const repository = createCoachFlowRepository(supabase);

    void Promise.all([
      repository.listSessionTemplates(),
      repository.listCoachTeams(),
      repository.listExercises()
    ])
      .then(([nextTemplates, nextTeams, nextCatalog]) => {
        if (!mounted) return;
        setTemplates(nextTemplates);
        setTeams(nextTeams);
        setCatalog(nextCatalog);
        setApplyTeamId((current) => current || nextTeams[0]?.id || "");
      })
      .catch((error: unknown) => {
        if (!mounted) return;
        setErrorMessage(describePrescriptionError(error));
      })
      .finally(() => {
        if (mounted) setIsLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  async function refreshTemplates() {
    if (!supabase) return;
    setTemplates(await createCoachFlowRepository(supabase).listSessionTemplates());
  }

  function resetToCreate() {
    setEditingTemplateId(null);
    setForm(createInitialSessionForm());
    setErrorMessage(null);
    setSuccessMessage(null);
  }

  async function handleOpen(template: SessionTemplateSummary) {
    if (!supabase) return;

    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const content = await createCoachFlowRepository(supabase).getSessionTemplateContent(template.id);
      setEditingTemplateId(template.id);
      setForm(toTemplateForm(content.title, content.status, content.blocks));
    } catch (error: unknown) {
      setErrorMessage(describePrescriptionError(error));
    }
  }

  /**
   * Cadastro de movimento feito de dentro do editor: o catálogo em memória recebe o que voltou
   * do banco, então a menção já acende sem esperar um novo carregamento da tela.
   */
  async function handleCreateMovement(input: CreateExerciseRequest): Promise<ExerciseRecord> {
    if (!supabase) {
      throw new Error(getSupabaseConfigurationError() ?? "Cadastro de movimento indisponível.");
    }

    const created = await createCoachFlowRepository(supabase).createExercise(input);
    setCatalog((current) => withMovement(current, created));

    return created;
  }

  async function handleSubmit() {
    if (!supabase || isSaving) return;

    setIsSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const repository = createCoachFlowRepository(supabase);

      if (editingTemplateId) {
        await repository.updateSessionTemplateContent(
          buildUpdateTemplatePayload(editingTemplateId, form, catalog)
        );
        setSuccessMessage("Treino atualizado na biblioteca.");
      } else {
        await repository.createSessionTemplate(buildTemplatePayload(form, catalog));
        setSuccessMessage("Treino salvo na biblioteca.");
        resetToCreate();
      }

      await refreshTemplates();
    } catch (error: unknown) {
      setErrorMessage(describePrescriptionError(error));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete() {
    if (!supabase || !editingTemplateId || isDeleting) return;

    setIsDeleting(true);
    setErrorMessage(null);

    try {
      await createCoachFlowRepository(supabase).deleteSessionTemplate(editingTemplateId);
      await refreshTemplates();
      resetToCreate();
      setSuccessMessage("Treino removido da biblioteca.");
    } catch (error: unknown) {
      setErrorMessage(
        /foreign key|violates/i.test(error instanceof Error ? error.message : "")
          ? "Este treino já foi aplicado a uma sessão e não pode ser removido."
          : describePrescriptionError(error)
      );
    } finally {
      setIsDeleting(false);
    }
  }

  async function handleApply(templateId: string) {
    if (!supabase || !applyTeamId || isApplying) return;

    setIsApplying(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      await createCoachFlowRepository(supabase).applySessionToTeam({
        templateId,
        teamId: applyTeamId,
        scheduledDate: applyDate,
        status: "draft"
      });
      setSuccessMessage("Treino aplicado como rascunho no calendário da equipe.");
    } catch (error: unknown) {
      setErrorMessage(describePrescriptionError(error));
    } finally {
      setIsApplying(false);
    }
  }

  return (
    <View style={styles.page} testID="library-screen">
      <View style={styles.intro}>
        <Text style={styles.heading}>BIBLIOTECA DE TREINOS</Text>
        <Text style={styles.lede}>
          Treinos que você reaproveita. Monte uma vez, aplique em qualquer equipe e em qualquer dia.
        </Text>
      </View>

      {errorMessage && <Banner text={errorMessage} tone="error" />}
      {successMessage && <Banner text={successMessage} tone="success" />}

      <View style={[styles.grid, isStacked && styles.gridStacked]}>
        <View style={[styles.listColumn, isStacked && styles.fullWidth]}>
          <View style={styles.list}>
            <View style={styles.listHeader}>
              <Text style={styles.listTitle}>Seus treinos</Text>
              <Pressable
                accessibilityLabel="Criar um treino novo"
                accessibilityRole="button"
                onPress={resetToCreate}
                style={({ pressed }) => [styles.newButton, pressed && styles.pressed]}
                testID="library-new"
              >
                <Ionicons color={colors.textPrimary} name="add" size={17} />
                <Text style={styles.newButtonText}>Novo</Text>
              </Pressable>
            </View>

            {isLoading && <Text style={styles.muted}>Carregando…</Text>}
            {!isLoading && templates.length === 0 && (
              <Text style={styles.muted}>
                Nenhum treino salvo ainda. Monte um ao lado e ele aparece aqui.
              </Text>
            )}

            {templates.map((template) => {
              const selected = template.id === editingTemplateId;

              return (
                <View key={template.id} style={styles.templateRow}>
                  <Pressable
                    accessibilityLabel={`Abrir ${template.title}`}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    onPress={() => void handleOpen(template)}
                    style={({ pressed }) => [
                      styles.template,
                      selected && styles.templateSelected,
                      pressed && styles.pressed
                    ]}
                    testID={`template-${template.id}`}
                  >
                    <Text numberOfLines={1} style={styles.templateTitle}>
                      {template.title}
                    </Text>
                    <Text style={styles.templateMeta}>
                      {template.status === "draft" ? "Rascunho" : "Publicado"}
                    </Text>
                  </Pressable>
                  <Pressable
                    accessibilityLabel={`Aplicar ${template.title} no calendário`}
                    accessibilityRole="button"
                    accessibilityState={{ disabled: !applyTeamId || isApplying }}
                    disabled={!applyTeamId || isApplying}
                    onPress={() => void handleApply(template.id)}
                    style={({ pressed }) => [
                      styles.applyButton,
                      (!applyTeamId || isApplying) && styles.disabled,
                      pressed && styles.pressed
                    ]}
                    testID={`apply-${template.id}`}
                  >
                    <Ionicons color={colors.textPrimary} name="calendar-outline" size={17} />
                  </Pressable>
                </View>
              );
            })}
          </View>

          <View style={styles.applyPanel} testID="library-apply">
            <Text style={styles.listTitle}>Aplicar em</Text>
            <View style={styles.teamRow}>
              {teams.map((team) => {
                const selected = team.id === applyTeamId;

                return (
                  <Pressable
                    accessibilityLabel={`Equipe ${team.name}`}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    key={team.id}
                    onPress={() => setApplyTeamId(team.id)}
                    style={({ pressed }) => [
                      styles.team,
                      selected && styles.teamSelected,
                      pressed && styles.pressed
                    ]}
                    testID={`apply-team-${team.id}`}
                  >
                    <Text style={[styles.teamName, selected && styles.teamNameSelected]}>
                      {team.name}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={styles.fieldLabel}>Data</Text>
            <TextInput
              accessibilityLabel="Data para aplicar o treino, no formato ano-mês-dia"
              onChangeText={setApplyDate}
              placeholder="2026-08-12"
              placeholderTextColor={colors.textSecondary}
              style={styles.dateInput}
              testID="apply-date"
              value={applyDate}
            />
            <Text style={styles.muted}>O treino entra como rascunho; publique pelo calendário.</Text>
          </View>
        </View>

        <View style={[styles.composerColumn, isStacked && styles.fullWidth]}>
          <SessionComposer
            catalog={catalog}
            form={form}
            isDeleting={isDeleting}
            isSaving={isSaving}
            mode={editingTemplateId ? "edit" : "create"}
            onCancel={resetToCreate}
            onCreateMovement={supabase ? handleCreateMovement : undefined}
            onChange={(next) => {
              setForm(next);
              setErrorMessage(null);
              setSuccessMessage(null);
            }}
            onDelete={() => void handleDelete()}
            onSubmit={() => void handleSubmit()}
            showSchedule={false}
            submitLabel={editingTemplateId ? "Salvar treino" : "Salvar na biblioteca"}
            teams={teams}
          />
        </View>
      </View>
    </View>
  );
}

function Banner({ text, tone }: { text: string; tone: "error" | "success" }) {
  const isError = tone === "error";

  return (
    <View
      accessibilityRole="alert"
      style={[styles.banner, isError ? styles.bannerError : styles.bannerSuccess]}
      testID={isError ? "library-error" : "library-success"}
    >
      <Ionicons
        color={isError ? colors.danger : colors.success}
        name={isError ? "alert-circle-outline" : "checkmark-circle-outline"}
        size={19}
      />
      <Text style={styles.bannerText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { gap: spacing[5] },
  intro: { gap: spacing[2] },
  heading: {
    color: colors.textPrimary,
    fontFamily: fontFamilies.display,
    fontSize: typeScale.displaySection,
    lineHeight: typeScale.displaySection
  },
  lede: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.interface,
    fontSize: 15,
    lineHeight: 23,
    maxWidth: 640
  },
  banner: {
    alignItems: "center",
    borderRadius: radius.lg,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing[3],
    padding: spacing[4]
  },
  bannerError: { backgroundColor: colors.surface01, borderColor: colors.danger },
  bannerSuccess: { backgroundColor: colors.surface01, borderColor: colors.success },
  bannerText: {
    color: colors.textPrimary,
    flex: 1,
    fontFamily: fontFamilies.interface,
    fontSize: 14,
    lineHeight: 21
  },
  grid: { alignItems: "flex-start", flexDirection: "row", gap: spacing[5] },
  gridStacked: { alignItems: "stretch", flexDirection: "column" },
  listColumn: { gap: spacing[4], width: 360 },
  composerColumn: { flex: 1, minWidth: 0 },
  fullWidth: { width: "100%" },
  list: {
    backgroundColor: colors.surface02,
    borderColor: colors.border,
    borderRadius: radius.xl,
    borderWidth: 1,
    gap: spacing[2],
    padding: spacing[4]
  },
  listHeader: {
    alignItems: "center",
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingBottom: spacing[2]
  },
  listTitle: {
    color: colors.textPrimary,
    fontFamily: fontFamilies.interfaceBold,
    fontSize: 14
  },
  newButton: {
    alignItems: "center",
    borderColor: colors.border,
    borderRadius: radius.pill,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing[1],
    minHeight: 44,
    paddingHorizontal: spacing[3]
  },
  newButtonText: {
    color: colors.textPrimary,
    fontFamily: fontFamilies.interfaceSemiBold,
    fontSize: 13
  },
  templateRow: {
    alignItems: "center",
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: spacing[1]
  },
  template: {
    borderColor: "transparent",
    borderRadius: radius.md,
    borderWidth: 1,
    flex: 1,
    gap: 2,
    justifyContent: "center",
    minHeight: 52,
    paddingHorizontal: spacing[3]
  },
  templateSelected: { backgroundColor: colors.surface03, borderColor: colors.borderPurple },
  templateTitle: {
    color: colors.textPrimary,
    fontFamily: fontFamilies.interfaceBold,
    fontSize: 14
  },
  templateMeta: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.interface,
    fontSize: 12
  },
  applyButton: {
    alignItems: "center",
    height: 44,
    justifyContent: "center",
    width: 44
  },
  applyPanel: {
    backgroundColor: colors.surface01,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.xl,
    gap: spacing[2],
    padding: spacing[4]
  },
  teamRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing[2] },
  team: {
    backgroundColor: colors.surface02,
    borderColor: colors.border,
    borderRadius: radius.pill,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: spacing[4]
  },
  teamSelected: { backgroundColor: colors.purple500, borderColor: colors.purple500 },
  teamName: {
    color: colors.textPrimary,
    fontFamily: fontFamilies.interfaceSemiBold,
    fontSize: 13
  },
  teamNameSelected: { color: colors.white },
  fieldLabel: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.interfaceBold,
    fontSize: 11,
    letterSpacing: 0.6,
    textTransform: "uppercase"
  },
  dateInput: {
    backgroundColor: colors.surface02,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    color: colors.textPrimary,
    fontFamily: fontFamilies.mono,
    fontSize: 15,
    minHeight: 48,
    paddingHorizontal: spacing[3]
  },
  muted: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.interface,
    fontSize: 12,
    lineHeight: 18
  },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.72 }
});
