import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { colors, fontFamilies, radius, spacing, typeScale } from "@fitblock/design-tokens";
import {
  createTodayRepository,
  createWorkoutRepository,
  type CalendarSessionRecord
} from "@fitblock/backend";
import { describeBackendError } from "@/data/backend-error";
import { formatBlockSets, formatVolumes, getSessionTitle, isFreeTextBlock, readSessionBlocks } from "@/data/calendar";
import {
  buildWorkoutExercises,
  countSessionSets,
  getCompletedSetCount,
  resolveSessionOutcome,
  sanitizeNumericInput,
  toNumberOrNull,
  type WorkoutExercise
} from "@/data/workout-session";
import { getSupabaseConfigurationError, supabase } from "@/lib/supabase";

type WorkoutValue = "reps" | "kilograms";

type WorkoutSessionScreenProps = {
  sessionId?: string | null;
};

/**
 * Tela de execução usa o fundo escuro dedicado (uso em academia, brilho reduzido) com os
 * tokens reais de @fitblock/design-tokens (colors.ink/graphite/charcoal, acento
 * fitblockPurple). Única exceção: colors.danger (#D92D3A) cai abaixo de 4,5:1 de contraste
 * sobre colors.ink — mantido um vermelho claro literal só para o texto de erro, para não
 * regredir a exigência de WCAG AA do PRODUCT.md.
 */
const dangerOnDark = "#FF8189";

export function WorkoutSessionScreen({ sessionId = null }: WorkoutSessionScreenProps) {
  const router = useRouter();
  const [session, setSession] = useState<CalendarSessionRecord | null>(null);
  const [exercises, setExercises] = useState<WorkoutExercise[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isFinishing, setIsFinishing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isFinished, setIsFinished] = useState(false);

  useEffect(() => {
    let mounted = true;
    setIsLoading(true);
    setErrorMessage(null);

    if (!supabase) {
      setIsLoading(false);
      setErrorMessage(getSupabaseConfigurationError() ?? "Sessão de treino indisponível.");
      return () => {
        mounted = false;
      };
    }

    void createWorkoutRepository(supabase)
      .getSessionWorkout(sessionId)
      .then((workout) => {
        if (!mounted) return;
        setSession(workout.session);
        setExercises(workout.session ? buildWorkoutExercises(workout.session, workout.results) : []);
        setIsFinished(
          workout.progress?.state === "completed" || workout.progress?.state === "partially_completed"
        );
      })
      .catch((error: unknown) => {
        if (!mounted) return;
        setErrorMessage(describeBackendError(error));
        setSession(null);
        setExercises([]);
      })
      .finally(() => {
        if (mounted) setIsLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [sessionId]);

  const activeExercise = exercises[activeIndex];
  const sessionTotals = countSessionSets(exercises);
  // Condicionamento, LPO e Endurance são texto livre: aparecem aqui só para leitura — registrar
  // conclusão desses blocos é uma etapa futura, junto com o envio de score do ranking interno.
  const freeTextBlocks = useMemo(
    () => (session ? readSessionBlocks(session).filter(isFreeTextBlock) : []),
    [session]
  );

  const persistSet = useCallback(
    async (exercise: WorkoutExercise, setNumber: number, next: WorkoutExercise["sets"][number]) => {
      if (!supabase || !session) return;

      try {
        await createWorkoutRepository(supabase).saveSetResult({
          sessionId: session.id,
          blockItemId: exercise.itemId,
          setNumber,
          reps: toNumberOrNull(next.reps),
          loadKg: toNumberOrNull(next.kilograms),
          completed: next.completed
        });
        setSaveError(null);
      } catch (error: unknown) {
        setSaveError(describeBackendError(error));
      }
    },
    [session]
  );

  function updateSet(itemId: string, setNumber: number, field: WorkoutValue, value: string) {
    const sanitizedValue = sanitizeNumericInput(value);

    setExercises((current) =>
      current.map((exercise) =>
        exercise.itemId === itemId
          ? {
              ...exercise,
              sets: exercise.sets.map((set) =>
                set.setNumber === setNumber ? { ...set, [field]: sanitizedValue } : set
              )
            }
          : exercise
      )
    );
  }

  function commitSet(itemId: string, setNumber: number) {
    const exercise = exercises.find((item) => item.itemId === itemId);
    const set = exercise?.sets.find((item) => item.setNumber === setNumber);

    if (!exercise || !set) return;
    void persistSet(exercise, setNumber, set);
  }

  function toggleSetCompletion(itemId: string, setNumber: number) {
    const exercise = exercises.find((item) => item.itemId === itemId);
    const set = exercise?.sets.find((item) => item.setNumber === setNumber);

    if (!exercise || !set) return;

    const next = { ...set, completed: !set.completed };

    setExercises((current) =>
      current.map((item) =>
        item.itemId === itemId
          ? { ...item, sets: item.sets.map((each) => (each.setNumber === setNumber ? next : each)) }
          : item
      )
    );

    void persistSet(exercise, setNumber, next);
  }

  async function handleFinishSession() {
    if (!supabase || !session || isFinishing) return;

    const outcome = resolveSessionOutcome(exercises);
    if (!outcome) return;

    setIsFinishing(true);
    setSaveError(null);

    try {
      await createTodayRepository(supabase).completeSession(session.id, outcome);
      setIsFinished(true);
      router.replace("/app/hoje");
    } catch (error: unknown) {
      setSaveError(describeBackendError(error));
    } finally {
      setIsFinishing(false);
    }
  }

  return (
    <View style={styles.screen} testID="workout-session-screen">
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.topBar}>
          <Pressable
            accessibilityLabel="Voltar para Hoje"
            accessibilityRole="button"
            onPress={() => router.replace("/app/hoje")}
            style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
          >
            <Ionicons name="arrow-back" size={21} color={colors.canvas} />
          </Pressable>
          <View style={styles.progressLabel} accessibilityLiveRegion="polite">
            <Text style={styles.progressText}>
              {sessionTotals.completed} de {sessionTotals.total} séries concluídas
            </Text>
            {session && <Text style={styles.sessionTitle}>{getSessionTitle(session)}</Text>}
          </View>
        </View>

        {isLoading && <Text style={styles.stateText}>Carregando sua sessão...</Text>}
        {!isLoading && errorMessage && (
          <Text accessibilityRole="alert" style={[styles.stateText, styles.stateTextError]}>
            {errorMessage}
          </Text>
        )}
        {!isLoading && !errorMessage && !activeExercise && freeTextBlocks.length === 0 && (
          <Text style={styles.stateText}>Nenhuma sessão publicada para executar agora.</Text>
        )}

        {freeTextBlocks.length > 0 && (
          <View style={styles.freeTextSection} testID="workout-free-text-blocks">
            {freeTextBlocks.map((block) => (
              <View key={block.id} style={styles.freeTextCard}>
                <Text style={styles.freeTextEyebrow}>{block.name.toUpperCase()}</Text>
                {block.description !== "" && <Text style={styles.freeTextDescription}>{block.description}</Text>}
                {block.sets.length > 0 && <Text style={styles.freeTextMeta}>{formatBlockSets(block.sets)}</Text>}
                {block.volumes.length > 0 && <Text style={styles.freeTextMeta}>{formatVolumes(block.volumes)}</Text>}
              </View>
            ))}
          </View>
        )}

        {activeExercise && (
          <>
            <View style={styles.exerciseNav}>
              <Pressable
                accessibilityLabel="Exercício anterior"
                accessibilityRole="button"
                accessibilityState={{ disabled: activeIndex === 0 }}
                disabled={activeIndex === 0}
                onPress={() => setActiveIndex((current) => Math.max(current - 1, 0))}
                style={({ pressed }) => [
                  styles.navButton,
                  activeIndex === 0 && styles.navButtonDisabled,
                  pressed && styles.pressed
                ]}
              >
                <Ionicons name="chevron-back" size={18} color={colors.canvas} />
              </Pressable>
              <Text style={styles.navLabel}>
                Exercício {activeIndex + 1} de {exercises.length}
              </Text>
              <Pressable
                accessibilityLabel="Próximo exercício"
                accessibilityRole="button"
                accessibilityState={{ disabled: activeIndex >= exercises.length - 1 }}
                disabled={activeIndex >= exercises.length - 1}
                onPress={() => setActiveIndex((current) => Math.min(current + 1, exercises.length - 1))}
                style={({ pressed }) => [
                  styles.navButton,
                  activeIndex >= exercises.length - 1 && styles.navButtonDisabled,
                  pressed && styles.pressed
                ]}
              >
                <Ionicons name="chevron-forward" size={18} color={colors.canvas} />
              </Pressable>
            </View>

            <View style={styles.exerciseHeading}>
              <Text style={styles.eyebrow}>{activeExercise.blockName.toUpperCase()}</Text>
              <Text style={styles.exerciseName}>{activeExercise.name}</Text>
            </View>

            <View style={styles.exerciseMeta}>
              {activeExercise.videoUrl ? (
                <Pressable
                  accessibilityLabel={`Abrir vídeo de ${activeExercise.name}`}
                  accessibilityRole="button"
                  onPress={() => {
                    void Linking.openURL(activeExercise.videoUrl as string);
                  }}
                  style={({ pressed }) => [styles.videoPreview, pressed && styles.pressed]}
                >
                  <Ionicons name="play" size={22} color={colors.ink} />
                  <Text style={styles.videoLabel}>VER VÍDEO</Text>
                </Pressable>
              ) : (
                <View style={styles.videoEmpty} accessible accessibilityLabel="Sem vídeo cadastrado">
                  <Ionicons name="videocam-off-outline" size={20} color={colors.textMuted} />
                  <Text style={styles.videoEmptyLabel}>SEM VÍDEO</Text>
                </View>
              )}
              {!activeExercise.isQualitative && (
                <View style={styles.maxCard}>
                  <Text style={styles.maxLabel}>ALVO</Text>
                  <View style={styles.maxRule} />
                  <Text style={styles.maxValue}>{activeExercise.targetSummary}</Text>
                  {activeExercise.restLabel.length > 0 && (
                    <Text style={styles.maxUnit}>{activeExercise.restLabel}</Text>
                  )}
                </View>
              )}
            </View>

            {activeExercise.notes.length > 0 && (
              <Text style={styles.exerciseNotes}>{activeExercise.notes}</Text>
            )}

            {activeExercise.isQualitative ? (
              <View style={styles.setsSection}>
                {activeExercise.sets.map((set) => {
                  const isDone = set.completed;
                  const label = isDone ? "Movimento concluído" : "Marcar movimento como concluído";

                  return (
                    <Pressable
                      key={set.setNumber}
                      accessibilityLabel={label}
                      accessibilityRole="button"
                      accessibilityState={{ selected: isDone }}
                      onPress={() => toggleSetCompletion(activeExercise.itemId, set.setNumber)}
                      style={({ pressed }) => [styles.qualitativeButton, pressed && styles.pressed]}
                      testID="qualitative-complete"
                    >
                      <View style={[styles.completionIndicator, isDone && styles.completionIndicatorActive]}>
                        {isDone && <Ionicons name="checkmark" size={19} color={colors.canvas} />}
                      </View>
                      <Text style={styles.qualitativeButtonText}>{label}</Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : (
            <View style={styles.setsSection}>
              <View style={styles.columnLabels}>
                <Text style={[styles.columnLabel, styles.repsColumnLabel]}>REPS</Text>
                <Text style={[styles.columnLabel, styles.kilogramsColumnLabel]}>KGS</Text>
                <Text style={styles.completionColumnLabel}>OK</Text>
              </View>

              <View style={styles.setRows}>
                {activeExercise.sets.map((set) => {
                  const completionLabel = set.completed
                    ? `Desfazer conclusão da série ${set.setNumber}`
                    : `Concluir série ${set.setNumber}`;

                  return (
                    <View key={set.setNumber} style={styles.setRowGroup}>
                      <View style={styles.setRow}>
                        <Text style={styles.setNumber}>{String(set.setNumber).padStart(2, "0")}</Text>
                        <TextInput
                          accessibilityLabel={`Repetições da série ${set.setNumber}`}
                          keyboardType="decimal-pad"
                          onBlur={() => commitSet(activeExercise.itemId, set.setNumber)}
                          onChangeText={(value) =>
                            updateSet(activeExercise.itemId, set.setNumber, "reps", value)
                          }
                          placeholder="—"
                          placeholderTextColor={colors.textSecondary}
                          selectTextOnFocus
                          style={styles.resultInput}
                          value={set.reps}
                        />
                        <TextInput
                          accessibilityLabel={`Carga em quilogramas da série ${set.setNumber}`}
                          keyboardType="decimal-pad"
                          onBlur={() => commitSet(activeExercise.itemId, set.setNumber)}
                          onChangeText={(value) =>
                            updateSet(activeExercise.itemId, set.setNumber, "kilograms", value)
                          }
                          placeholder="—"
                          placeholderTextColor={colors.textSecondary}
                          selectTextOnFocus
                          style={styles.resultInput}
                          value={set.kilograms}
                        />
                        <Pressable
                          accessibilityLabel={completionLabel}
                          accessibilityRole="button"
                          accessibilityState={{ selected: set.completed }}
                          onPress={() => toggleSetCompletion(activeExercise.itemId, set.setNumber)}
                          style={({ pressed }) => [styles.completionButton, pressed && styles.pressed]}
                        >
                          <View
                            style={[
                              styles.completionIndicator,
                              set.completed && styles.completionIndicatorActive
                            ]}
                          >
                            {set.completed && (
                              <Ionicons name="checkmark" size={19} color={colors.canvas} />
                            )}
                          </View>
                        </Pressable>
                      </View>
                      {set.target.length > 0 && <Text style={styles.setTarget}>{set.target}</Text>}
                    </View>
                  );
                })}
              </View>
              <Text style={styles.exerciseProgress}>
                {getCompletedSetCount(activeExercise.sets)} de {activeExercise.sets.length} neste exercício
              </Text>
            </View>
            )}

            {saveError && (
              <Text accessibilityRole="alert" style={[styles.stateText, styles.stateTextError]}>
                {saveError}
              </Text>
            )}

            <Pressable
              accessibilityLabel="Concluir treino"
              accessibilityRole="button"
              accessibilityState={{ disabled: isFinishing || sessionTotals.completed === 0 }}
              disabled={isFinishing || sessionTotals.completed === 0}
              onPress={() => {
                void handleFinishSession();
              }}
              style={({ pressed }) => [
                styles.finishButton,
                sessionTotals.completed === 0 && styles.finishButtonDisabled,
                pressed && styles.pressed
              ]}
              testID="finish-workout"
            >
              <Text style={styles.finishButtonText}>
                {isFinishing ? "Registrando..." : isFinished ? "Atualizar conclusão" : "Concluir treino"}
              </Text>
            </Pressable>

            <Text style={styles.localStateNote}>Cada série é salva no seu histórico ao ser registrada.</Text>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: colors.ink,
    flex: 1,
    minHeight: "100%"
  },
  content: {
    gap: spacing[6],
    marginHorizontal: "auto",
    maxWidth: 560,
    paddingBottom: spacing[10],
    paddingHorizontal: spacing[4],
    paddingTop: spacing[5],
    width: "100%"
  },
  topBar: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  backButton: {
    alignItems: "center",
    borderColor: colors.charcoal,
    borderRadius: radius.pill,
    borderWidth: 1,
    height: 48,
    justifyContent: "center",
    width: 48
  },
  progressLabel: {
    alignItems: "flex-end",
    flex: 1,
    marginLeft: spacing[3]
  },
  progressText: {
    color: colors.textMuted,
    fontFamily: fontFamilies.interface,
    fontSize: typeScale.caption,
    fontWeight: "700",
    letterSpacing: 0.2
  },
  sessionTitle: {
    color: colors.canvas,
    fontFamily: fontFamilies.interface,
    fontSize: typeScale.caption,
    fontWeight: "800",
    marginTop: 3
  },
  stateText: {
    color: colors.textMuted,
    fontFamily: fontFamilies.interface,
    fontSize: 13,
    textAlign: "center"
  },
  stateTextError: {
    color: dangerOnDark
  },
  freeTextSection: { gap: spacing[3] },
  freeTextCard: {
    backgroundColor: colors.graphite,
    borderColor: colors.charcoal,
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing[4]
  },
  freeTextEyebrow: {
    color: colors.textMuted,
    fontFamily: fontFamilies.interface,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.6
  },
  freeTextDescription: {
    color: colors.canvas,
    fontFamily: fontFamilies.interface,
    fontSize: typeScale.bodySm,
    lineHeight: 21,
    marginTop: spacing[2]
  },
  freeTextMeta: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.interface,
    fontSize: typeScale.caption,
    marginTop: spacing[2]
  },
  exerciseNav: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  navButton: {
    alignItems: "center",
    borderColor: colors.charcoal,
    borderRadius: radius.pill,
    borderWidth: 1,
    height: 44,
    justifyContent: "center",
    width: 44
  },
  navButtonDisabled: {
    opacity: 0.35
  },
  navLabel: {
    color: colors.textMuted,
    fontFamily: fontFamilies.interface,
    fontSize: typeScale.caption,
    fontWeight: "700"
  },
  exerciseHeading: {
    gap: spacing[1]
  },
  eyebrow: {
    color: colors.fitblockPurpleLight,
    fontFamily: fontFamilies.interface,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.7
  },
  exerciseName: {
    color: colors.canvas,
    fontFamily: fontFamilies.interface,
    fontSize: typeScale.displaySection,
    fontWeight: "700",
    letterSpacing: 0.4,
    lineHeight: 42,
    textTransform: "uppercase"
  },
  exerciseMeta: {
    flexDirection: "row",
    gap: spacing[3]
  },
  videoPreview: {
    alignItems: "center",
    backgroundColor: colors.hairlineSoft,
    borderRadius: radius.sm,
    gap: 5,
    height: 103,
    justifyContent: "center",
    width: 106
  },
  videoLabel: {
    color: colors.ink,
    fontFamily: fontFamilies.interface,
    fontSize: 8,
    fontWeight: "800",
    letterSpacing: 0.4
  },
  videoEmpty: {
    alignItems: "center",
    borderColor: colors.charcoal,
    borderRadius: radius.sm,
    borderWidth: 1,
    gap: 5,
    height: 103,
    justifyContent: "center",
    width: 106
  },
  videoEmptyLabel: {
    color: colors.textMuted,
    fontFamily: fontFamilies.interface,
    fontSize: 8,
    fontWeight: "800",
    letterSpacing: 0.4
  },
  maxCard: {
    backgroundColor: colors.graphite,
    borderRadius: radius.xs,
    flex: 1,
    height: 103,
    justifyContent: "center",
    paddingHorizontal: spacing[3]
  },
  maxLabel: {
    color: colors.canvas,
    fontFamily: fontFamilies.interface,
    fontSize: typeScale.bodyMd,
    fontWeight: "400",
    letterSpacing: 1.5
  },
  maxRule: {
    backgroundColor: colors.canvas,
    height: StyleSheet.hairlineWidth,
    marginTop: spacing[2],
    opacity: 0.9,
    width: "100%"
  },
  maxValue: {
    color: colors.fitblockPurpleLight,
    fontFamily: fontFamilies.interface,
    fontSize: 20,
    fontWeight: "700",
    marginTop: spacing[2],
    textAlign: "right"
  },
  maxUnit: {
    color: colors.textMuted,
    fontFamily: fontFamilies.interface,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1,
    marginTop: 2,
    textAlign: "right"
  },
  exerciseNotes: {
    color: colors.textMuted,
    fontFamily: fontFamilies.interface,
    fontSize: 13,
    lineHeight: 20
  },
  setsSection: {
    gap: spacing[2]
  },
  columnLabels: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[2],
    paddingLeft: 30
  },
  columnLabel: {
    color: colors.canvas,
    fontFamily: fontFamilies.interface,
    fontSize: typeScale.bodyMd,
    fontWeight: "400",
    letterSpacing: 1.6
  },
  repsColumnLabel: {
    flex: 1,
    textAlign: "center"
  },
  kilogramsColumnLabel: {
    flex: 1,
    textAlign: "center"
  },
  completionColumnLabel: {
    color: colors.textMuted,
    fontFamily: fontFamilies.interface,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1,
    textAlign: "center",
    width: 48
  },
  setRows: {
    gap: spacing[3]
  },
  setRowGroup: {
    gap: 4
  },
  setRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[2]
  },
  setNumber: {
    color: colors.textMuted,
    fontFamily: fontFamilies.interface,
    fontSize: 17,
    letterSpacing: 1,
    width: 22
  },
  setTarget: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.interface,
    fontSize: 11,
    paddingLeft: 30
  },
  resultInput: {
    borderColor: colors.charcoal,
    borderRadius: radius.xs,
    borderWidth: 1,
    color: colors.canvas,
    flex: 1,
    fontFamily: fontFamilies.interface,
    fontSize: 20,
    height: 46,
    paddingHorizontal: spacing[3],
    textAlign: "center"
  },
  completionButton: {
    alignItems: "center",
    height: 48,
    justifyContent: "center",
    width: 48
  },
  completionIndicator: {
    backgroundColor: colors.success,
    borderRadius: radius.pill,
    height: 33,
    opacity: 0.48,
    width: 33
  },
  completionIndicatorActive: {
    alignItems: "center",
    justifyContent: "center",
    opacity: 1
  },
  qualitativeButton: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[3],
    minHeight: 52
  },
  qualitativeButtonText: {
    color: colors.canvas,
    fontFamily: fontFamilies.interface,
    fontSize: 15,
    fontWeight: "700"
  },
  exerciseProgress: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.interface,
    fontSize: 11,
    marginTop: spacing[2],
    textAlign: "right"
  },
  finishButton: {
    alignItems: "center",
    backgroundColor: colors.fitblockPurple,
    borderRadius: radius.pill,
    justifyContent: "center",
    minHeight: 52
  },
  finishButtonDisabled: {
    opacity: 0.4
  },
  finishButtonText: {
    color: colors.canvas,
    fontFamily: fontFamilies.interface,
    fontSize: typeScale.bodySm,
    fontWeight: "700"
  },
  localStateNote: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.interface,
    fontSize: typeScale.caption,
    textAlign: "center"
  },
  pressed: {
    opacity: 0.72
  }
});
