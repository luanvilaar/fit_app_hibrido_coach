import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import {
  createCoachFlowRepository,
  type CalendarSessionRecord,
  type ExerciseRecord,
  type TrainingGroupRecord
} from "@fitblock/backend";
import { colors, fontFamilies, radius, spacing, typeScale } from "@fitblock/design-tokens";
import { getWeekRange, parseCalendarDate, shiftWeek } from "@/data/calendar";
import {
  buildSessionPayload,
  buildUpdateSessionPayload,
  describePrescriptionError
} from "@/data/coach-hibrido/payload";
import { toSessionForm } from "@/data/coach-hibrido/session-edit";
import {
  cloneSessionForm,
  createInitialSessionForm,
  updateSessionField,
  type SessionForm
} from "@/data/coach-hibrido/session-form";
import { getSessionTitle } from "@/data/coach-hibrido/session-snapshot";
import { SessionComposer } from "@/components/coach-hibrido/session-composer";
import { WeekBoard } from "@/components/coach-hibrido/week-board";
import { getSupabaseConfigurationError, supabase } from "@/lib/supabase";

export function PrescriptionScreen() {
  const { width } = useWindowDimensions();
  const isStacked = width < 1180;
  const [anchor, setAnchor] = useState(() => new Date());
  const [teams, setTeams] = useState<TrainingGroupRecord[]>([]);
  const [sessions, setSessions] = useState<CalendarSessionRecord[]>([]);
  const [catalog, setCatalog] = useState<ExerciseRecord[]>([]);
  const [form, setForm] = useState<SessionForm>(() => createInitialSessionForm());
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [copiedSessionId, setCopiedSessionId] = useState<string | null>(null);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const range = useMemo(() => getWeekRange(anchor), [anchor]);

  useEffect(() => {
    let mounted = true;
    setIsLoading(true);
    setErrorMessage(null);

    if (!supabase) {
      setIsLoading(false);
      setErrorMessage(getSupabaseConfigurationError() ?? "Prescrição indisponível.");
      return () => {
        mounted = false;
      };
    }

    const repository = createCoachFlowRepository(supabase);

    void Promise.all([
      repository.listCoachTeams(),
      repository.listCoachCalendar(range),
      repository.listExercises()
    ])
      .then(([nextTeams, nextSessions, nextCatalog]) => {
        if (!mounted) return;
        setTeams(nextTeams);
        setSessions(nextSessions);
        setCatalog(nextCatalog);
        setForm((current) => ({ ...current, teamId: current.teamId || nextTeams[0]?.id || "" }));
      })
      .catch((error: unknown) => {
        if (!mounted) return;
        setErrorMessage(describePrescriptionError(error));
        setTeams([]);
        setSessions([]);
        setCatalog([]);
      })
      .finally(() => {
        if (mounted) setIsLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [range]);

  const resetToCreate = useCallback((teamId: string) => {
    setEditingSessionId(null);
    setIsConfirmingDelete(false);
    setForm(createInitialSessionForm(teamId));
  }, []);

  function handleChange(next: SessionForm) {
    setForm(next);
    setErrorMessage(null);
    setSuccessMessage(null);
  }

  function handleSelectSession(session: CalendarSessionRecord) {
    setEditingSessionId(session.id);
    setForm(toSessionForm(session));
    setIsConfirmingDelete(false);
    setErrorMessage(null);
    setSuccessMessage(null);
  }

  function handleCreate(date: string) {
    const teamId = form.teamId || teams[0]?.id || "";
    setEditingSessionId(null);
    setIsConfirmingDelete(false);
    setForm(updateSessionField(createInitialSessionForm(teamId), "scheduledDate", date));
    setErrorMessage(null);
    setSuccessMessage(null);
  }

  function handlePaste(date: string) {
    const source = sessions.find((session) => session.id === copiedSessionId);
    if (!source) return;

    setEditingSessionId(null);
    setIsConfirmingDelete(false);
    setForm(
      cloneSessionForm(toSessionForm(source), {
        title: `${getSessionTitle(source)} (cópia)`,
        scheduledDate: date,
        status: "draft"
      })
    );
    setCopiedSessionId(null);
    setSuccessMessage("Cópia pronta como rascunho. Revise e salve.");
  }

  async function handleSubmit() {
    if (!supabase || isSaving || isDeleting) return;

    setIsSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const repository = createCoachFlowRepository(supabase);
      const payload = buildSessionPayload(form, catalog);

      if (editingSessionId) {
        await repository.updateSession(buildUpdateSessionPayload(editingSessionId, form, catalog));
      } else {
        await repository.prescribeSession(payload);
      }

      // A âncora acompanha a data salva, senão a sessão sai da semana visível.
      const savedAnchor = parseCalendarDate(payload.scheduledDate);
      setAnchor(savedAnchor);
      setSessions(await repository.listCoachCalendar(getWeekRange(savedAnchor)));
      setSuccessMessage(
        editingSessionId
          ? "Sessão atualizada."
          : payload.status === "draft"
            ? "Rascunho salvo. O atleta ainda não enxerga."
            : "Treino publicado no calendário da equipe."
      );
      resetToCreate(form.teamId);
    } catch (error: unknown) {
      setErrorMessage(describePrescriptionError(error));
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
      resetToCreate(form.teamId);
    } catch (error: unknown) {
      setErrorMessage(describePrescriptionError(error));
      setIsConfirmingDelete(false);
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <View style={styles.page} testID="prescription-screen">
      <View style={styles.intro}>
        <Text style={styles.heading}>PRESCREVER A SEMANA</Text>
        <Text style={styles.lede}>
          Escreva o treino como você já escreve. Cada bloco é uma folha de texto; a categoria pede o
          que falta — volume, dinâmica de tempo ou ranking.
        </Text>
      </View>

      {errorMessage && <Banner text={errorMessage} tone="error" />}
      {successMessage && <Banner text={successMessage} tone="success" />}

      <View style={[styles.grid, isStacked && styles.gridStacked]}>
        <View style={[styles.boardColumn, isStacked && styles.fullWidth]}>
          <WeekBoard
            anchor={anchor}
            copiedSessionId={copiedSessionId}
            isLoading={isLoading}
            onCopy={(session) => {
              setCopiedSessionId(session.id);
              setSuccessMessage(null);
            }}
            onCreate={handleCreate}
            onPaste={handlePaste}
            onSelectSession={handleSelectSession}
            onSelectTeam={(teamId) => {
              if (editingSessionId) resetToCreate(teamId);
              else setForm((current) => updateSessionField(current, "teamId", teamId));
            }}
            onShift={(amount) => setAnchor((current) => shiftWeek(current, amount))}
            selectedSessionId={editingSessionId}
            selectedTeamId={form.teamId}
            sessions={sessions}
            teams={teams}
          />
        </View>

        <View style={[styles.composerColumn, isStacked && styles.fullWidth]}>
          {isConfirmingDelete && (
            <View accessibilityRole="alert" style={styles.confirm} testID="delete-confirm">
              <Text style={styles.confirmTitle}>Excluir esta sessão do calendário?</Text>
              <Text style={styles.confirmText}>
                Ela sai do calendário do coach e do atleta. Não dá para desfazer.
              </Text>
              <View style={styles.confirmActions}>
                <Pressable
                  accessibilityLabel="Confirmar exclusão da sessão"
                  accessibilityRole="button"
                  onPress={() => void handleDelete()}
                  style={({ pressed }) => [styles.confirmDelete, pressed && styles.pressed]}
                  testID="confirm-delete"
                >
                  <Text style={styles.confirmDeleteText}>
                    {isDeleting ? "Excluindo…" : "Sim, excluir"}
                  </Text>
                </Pressable>
                <Pressable
                  accessibilityLabel="Manter a sessão"
                  accessibilityRole="button"
                  onPress={() => setIsConfirmingDelete(false)}
                  style={({ pressed }) => [styles.confirmKeep, pressed && styles.pressed]}
                  testID="dismiss-delete"
                >
                  <Text style={styles.confirmKeepText}>Manter</Text>
                </Pressable>
              </View>
            </View>
          )}

          <SessionComposer
            catalog={catalog}
            form={form}
            isDeleting={isDeleting}
            isSaving={isSaving}
            mode={editingSessionId ? "edit" : "create"}
            onCancel={() => resetToCreate(form.teamId)}
            onChange={handleChange}
            onDelete={() => setIsConfirmingDelete(true)}
            onSubmit={() => void handleSubmit()}
            submitLabel={editingSessionId ? "Salvar alterações" : "Publicar no calendário"}
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
      testID={isError ? "prescription-error" : "prescription-success"}
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
  boardColumn: { width: 360 },
  composerColumn: { flex: 1, gap: spacing[4], minWidth: 0 },
  fullWidth: { width: "100%" },
  confirm: {
    backgroundColor: colors.surface02,
    borderColor: colors.danger,
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: spacing[2],
    padding: spacing[4]
  },
  confirmTitle: {
    color: colors.textPrimary,
    fontFamily: fontFamilies.interfaceBold,
    fontSize: 15
  },
  confirmText: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.interface,
    fontSize: 13,
    lineHeight: 20
  },
  confirmActions: { flexDirection: "row", gap: spacing[3], marginTop: spacing[2] },
  confirmDelete: {
    alignItems: "center",
    backgroundColor: colors.danger,
    borderRadius: radius.pill,
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: spacing[5]
  },
  confirmDeleteText: {
    color: colors.white,
    fontFamily: fontFamilies.interfaceBold,
    fontSize: 13
  },
  confirmKeep: {
    alignItems: "center",
    borderColor: colors.border,
    borderRadius: radius.pill,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: spacing[5]
  },
  confirmKeepText: {
    color: colors.textPrimary,
    fontFamily: fontFamilies.interfaceSemiBold,
    fontSize: 13
  },
  pressed: { opacity: 0.72 }
});
