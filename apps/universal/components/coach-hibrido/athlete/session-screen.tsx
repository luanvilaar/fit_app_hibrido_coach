import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import {
  createTodayRepository,
  createWorkoutRepository,
  type AthleteSetResultRecord,
  type CalendarSessionRecord,
  type LeaderboardEntry,
  type SubmitBlockScoreRequest
} from "@fitblock/backend";
import { colors, fontFamilies, radius, shadows, spacing, typeScale } from "@fitblock/design-tokens";
import { describeBackendError } from "@/data/backend-error";
import { parseCalendarDate } from "@/data/calendar";
import {
  getSessionTitle,
  rankedBlocks,
  readSessionBlocks,
  type HybridBlock
} from "@/data/coach-hibrido/session-snapshot";
import { BlockCard, type MovementLog } from "@/components/coach-hibrido/athlete/block-card";
import { getSupabaseConfigurationError, supabase } from "@/lib/supabase";

type SessionScreenProps = { sessionId: string | null };

function seedLogs(results: AthleteSetResultRecord[]): Record<string, MovementLog> {
  return results.reduce<Record<string, MovementLog>>((logs, result) => {
    logs[result.block_item_id] = {
      reps: result.reps === null ? "" : String(result.reps),
      loadKg: result.load_kg === null ? "" : String(result.load_kg)
    };
    return logs;
  }, {});
}

function toNumberOrNull(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

/** "TERÇA · 12 AGO" */
function formatSessionDay(date: string): string {
  const parsed = parseCalendarDate(date);
  const weekday = new Intl.DateTimeFormat("pt-BR", { weekday: "long" }).format(parsed);
  const day = String(parsed.getDate()).padStart(2, "0");
  const month = new Intl.DateTimeFormat("pt-BR", { month: "short" }).format(parsed).replace(".", "");

  return `${weekday} · ${day} ${month}`.toUpperCase();
}

export function AthleteSessionScreen({ sessionId }: SessionScreenProps) {
  const router = useRouter();
  const [session, setSession] = useState<CalendarSessionRecord | null>(null);
  const [completedBlockIds, setCompletedBlockIds] = useState<string[]>([]);
  const [expandedBlockId, setExpandedBlockId] = useState<string | null>(null);
  const [logs, setLogs] = useState<Record<string, MovementLog>>({});
  const [leaderboards, setLeaderboards] = useState<Record<string, LeaderboardEntry[]>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [togglingBlockId, setTogglingBlockId] = useState<string | null>(null);
  const [submittingBlockId, setSubmittingBlockId] = useState<string | null>(null);
  const [isFinishing, setIsFinishing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [focusedAction, setFocusedAction] = useState<"back" | "finish" | null>(null);

  const blocks: HybridBlock[] = useMemo(() => (session ? readSessionBlocks(session) : []), [session]);
  const doneCount = blocks.filter((block) => completedBlockIds.includes(block.id)).length;

  const loadLeaderboards = useCallback(async (target: CalendarSessionRecord, list: HybridBlock[]) => {
    if (!supabase) return;

    const repository = createWorkoutRepository(supabase);
    const ranked = rankedBlocks(list);
    const entries = await Promise.all(
      ranked.map(async (block) => [block.id, await repository.listBlockLeaderboard(target.id, block.id)] as const)
    );

    setLeaderboards(Object.fromEntries(entries));
  }, []);

  useEffect(() => {
    let mounted = true;
    setIsLoading(true);
    setErrorMessage(null);

    if (!supabase) {
      setIsLoading(false);
      setErrorMessage(getSupabaseConfigurationError() ?? "Treino indisponível.");
      return () => {
        mounted = false;
      };
    }

    void createWorkoutRepository(supabase)
      .getSessionWorkout(sessionId)
      .then(async (workout) => {
        if (!mounted) return;

        setSession(workout.session);
        setCompletedBlockIds(workout.progress?.completed_block_ids ?? []);
        setLogs(seedLogs(workout.results));

        if (workout.session) await loadLeaderboards(workout.session, readSessionBlocks(workout.session));
      })
      .catch((error: unknown) => {
        if (mounted) setErrorMessage(describeBackendError(error));
      })
      .finally(() => {
        if (mounted) setIsLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [sessionId, loadLeaderboards]);

  useEffect(() => {
    // Acordeão: abre o primeiro bloco por padrão, como o atleta encontra ao entrar na sessão.
    setExpandedBlockId(session ? (readSessionBlocks(session)[0]?.id ?? null) : null);
  }, [session]);

  function handleToggleExpand(blockId: string) {
    setExpandedBlockId((current) => (current === blockId ? null : blockId));
  }

  async function handleToggleBlock(blockId: string) {
    if (!supabase || !session || togglingBlockId) return;

    setTogglingBlockId(blockId);
    setActionError(null);

    try {
      const progress = await createTodayRepository(supabase).toggleBlock(session.id, blockId);
      setCompletedBlockIds(progress.completed_block_ids);
    } catch (error: unknown) {
      setActionError(describeBackendError(error));
    } finally {
      setTogglingBlockId(null);
    }
  }

  async function handleCommitLog(itemId: string) {
    if (!supabase || !session) return;

    const log = logs[itemId];
    if (!log) return;

    const reps = toNumberOrNull(log.reps);
    const loadKg = toNumberOrNull(log.loadKg);
    if (reps === null && loadKg === null) return;

    try {
      await createWorkoutRepository(supabase).saveSetResult({
        sessionId: session.id,
        blockItemId: itemId,
        setNumber: 1,
        reps,
        loadKg,
        completed: true
      });
      setActionError(null);
    } catch (error: unknown) {
      setActionError(describeBackendError(error));
    }
  }

  async function handleSubmitScore(
    blockId: string,
    score: Omit<SubmitBlockScoreRequest, "sessionId" | "blockId">
  ) {
    if (!supabase || !session || submittingBlockId) return;

    setSubmittingBlockId(blockId);
    setActionError(null);

    try {
      const repository = createWorkoutRepository(supabase);
      await repository.submitBlockScore({ sessionId: session.id, blockId, ...score });
      const entries = await repository.listBlockLeaderboard(session.id, blockId);
      setLeaderboards((current) => ({ ...current, [blockId]: entries }));
    } catch (error: unknown) {
      setActionError(describeBackendError(error));
    } finally {
      setSubmittingBlockId(null);
    }
  }

  async function handleFinish() {
    if (!supabase || !session || isFinishing) return;

    setIsFinishing(true);
    setActionError(null);

    try {
      await createTodayRepository(supabase).completeSession(
        session.id,
        doneCount === blocks.length ? "completed" : "partially_completed"
      );
      router.replace("/app/hoje");
    } catch (error: unknown) {
      setActionError(describeBackendError(error));
      setIsFinishing(false);
    }
  }

  return (
    <View style={styles.screen} testID="athlete-session-screen">
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        style={styles.scroll}
      >
        <Pressable
          accessibilityLabel="Voltar para Hoje"
          accessibilityRole="button"
          onBlur={() => setFocusedAction(null)}
          onFocus={() => setFocusedAction("back")}
          onPress={() => router.replace("/app/hoje")}
          style={({ pressed }) => [styles.back, focusedAction === "back" && styles.backFocused, pressed && styles.pressed]}
          testID="back-to-today"
        >
          <Ionicons color={colors.textPrimary} name="arrow-back" size={18} />
          <Text style={styles.backText}>Hoje</Text>
        </Pressable>

        {isLoading && (
          <Text style={styles.state} testID="session-loading">
            Carregando o treino…
          </Text>
        )}

        {!isLoading && errorMessage && (
          <Text accessibilityRole="alert" style={styles.state} testID="session-error">
            {errorMessage}
          </Text>
        )}

        {!isLoading && !errorMessage && !session && (
          <View style={styles.empty} testID="session-empty">
            <Ionicons color={colors.purple400} name="barbell-outline" size={42} style={styles.emptyIcon} />
            <Text style={styles.emptyTitle}>NENHUM TREINO PUBLICADO</Text>
            <Text style={styles.state}>
              Seu coach ainda não publicou uma sessão para hoje. Assim que publicar, ela aparece aqui.
            </Text>
          </View>
        )}

        {session && (
          <>
            <View style={styles.headline}>
              <Text style={styles.day}>{formatSessionDay(session.scheduled_date)}</Text>
              <Text style={styles.title}>{getSessionTitle(session)}</Text>
              <Text style={styles.progress} testID="session-progress">
                {doneCount} de {blocks.length} {blocks.length === 1 ? "bloco" : "blocos"}
              </Text>
            </View>

            {session.coach_note ? (
              <View style={styles.note} testID="session-coach-note">
                <Text style={styles.noteLabel}>Recado do coach</Text>
                <Text style={styles.noteText}>{session.coach_note}</Text>
              </View>
            ) : null}

            {actionError && (
              <Text accessibilityRole="alert" style={styles.actionError} testID="session-action-error">
                {actionError}
              </Text>
            )}

            {blocks.map((block, index) => (
              <BlockCard
                block={block}
                index={index}
                isDone={completedBlockIds.includes(block.id)}
                isExpanded={expandedBlockId === block.id}
                isSubmittingScore={submittingBlockId === block.id}
                isToggling={togglingBlockId === block.id}
                key={block.id}
                leaderboard={leaderboards[block.id] ?? []}
                logs={logs}
                onChangeLog={(itemId, patch) =>
                  setLogs((current) => ({
                    ...current,
                    [itemId]: { ...(current[itemId] ?? { reps: "", loadKg: "" }), ...patch }
                  }))
                }
                onCommitLog={(itemId) => void handleCommitLog(itemId)}
                onSubmitScore={(score) => void handleSubmitScore(block.id, score)}
                onToggleDone={() => void handleToggleBlock(block.id)}
                onToggleExpand={() => handleToggleExpand(block.id)}
              />
            ))}

            <Pressable
              accessibilityLabel={
                doneCount === blocks.length ? "Finalizar treino" : "Finalizar treino como parcial"
              }
              accessibilityRole="button"
              accessibilityState={{ disabled: isFinishing || doneCount === 0 }}
              disabled={isFinishing || doneCount === 0}
              onBlur={() => setFocusedAction(null)}
              onFocus={() => setFocusedAction("finish")}
              onPress={() => void handleFinish()}
              style={({ pressed }) => [
                styles.finish,
                (isFinishing || doneCount === 0) && styles.disabled,
                focusedAction === "finish" && styles.finishFocused,
                pressed && styles.pressed
              ]}
              testID="finish-session"
            >
              <Text style={styles.finishText}>
                {isFinishing
                  ? "Finalizando…"
                  : doneCount === blocks.length
                    ? "Finalizar treino"
                    : "Finalizar como parcial"}
              </Text>
              <Ionicons color={colors.white} name="arrow-forward" size={18} />
            </Pressable>

            {doneCount === 0 && (
              <Text style={styles.finishHint}>
                Conclua ao menos um bloco para finalizar a sessão.
              </Text>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.bg, flex: 1 },
  scroll: { flex: 1 },
  content: {
    alignSelf: "center",
    gap: spacing[5],
    maxWidth: 720,
    paddingBottom: spacing[10],
    paddingHorizontal: spacing[4],
    paddingTop: spacing[5],
    width: "100%"
  },
  back: {
    alignItems: "center",
    alignSelf: "flex-start",
    borderColor: "transparent",
    borderRadius: radius.pill,
    borderWidth: 2,
    flexDirection: "row",
    gap: spacing[2],
    minHeight: 44,
    paddingHorizontal: spacing[2]
  },
  backFocused: { borderColor: colors.purple400 },
  backText: {
    color: colors.textPrimary,
    fontFamily: fontFamilies.interfaceSemiBold,
    fontSize: 14
  },
  headline: { gap: spacing[2] },
  day: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.interfaceBold,
    fontSize: 12,
    letterSpacing: 1.2
  },
  title: {
    color: colors.textPrimary,
    fontFamily: fontFamilies.display,
    fontSize: typeScale.displayHero,
    lineHeight: typeScale.displayHero
  },
  progress: {
    color: colors.purple500,
    fontFamily: fontFamilies.interfaceSemiBold,
    fontSize: 14
  },
  note: {
    backgroundColor: colors.surface01,
    borderColor: colors.borderPurple,
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: spacing[1],
    padding: spacing[4]
  },
  noteLabel: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.interfaceBold,
    fontSize: 11,
    letterSpacing: 0.6,
    textTransform: "uppercase"
  },
  noteText: {
    color: colors.textPrimary,
    fontFamily: fontFamilies.interface,
    fontSize: 15,
    lineHeight: 23
  },
  state: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.interface,
    fontSize: 15,
    lineHeight: 23
  },
  actionError: {
    color: colors.danger,
    fontFamily: fontFamilies.interface,
    fontSize: 14,
    lineHeight: 21
  },
  empty: { gap: spacing[3] },
  emptyIcon: { marginBottom: spacing[2] },
  emptyTitle: {
    color: colors.textPrimary,
    fontFamily: fontFamilies.display,
    fontSize: typeScale.displaySection,
    lineHeight: typeScale.displaySection
  },
  finish: {
    alignItems: "center",
    backgroundColor: colors.purple500,
    borderColor: "transparent",
    borderRadius: radius.pill,
    borderWidth: 2,
    flexDirection: "row",
    gap: spacing[3],
    justifyContent: "center",
    minHeight: 52,
    paddingHorizontal: spacing[5],
    ...shadows.ctaGlow
  },
  finishFocused: { borderColor: colors.white },
  finishText: {
    color: colors.white,
    fontFamily: fontFamilies.interfaceBold,
    fontSize: 15
  },
  finishHint: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.interface,
    fontSize: 13,
    textAlign: "center"
  },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.72 }
});
