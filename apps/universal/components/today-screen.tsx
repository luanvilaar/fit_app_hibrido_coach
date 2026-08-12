import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ComponentProps } from "react";
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions
} from "react-native";
import type { StyleProp, ViewStyle } from "react-native";
import { colors, fontFamilies, radius, shadows, spacing } from "@fitblock/design-tokens";
import {
  createCalendarRepository,
  createTodayRepository,
  type AthleteSessionProgressRecord,
  type CalendarSessionRecord,
  type TodayDashboardRecord
} from "@fitblock/backend";
import { describeBackendError } from "@/data/backend-error";
import { createWeekGrid, formatWeekLabel, getWeekRange, shiftWeek, toCalendarDate } from "@/data/calendar";
import { getSessionTitle, readSessionBlocks } from "@/data/coach-hibrido/session-snapshot";
import {
  buildTodayBlocks,
  describeNextSession,
  describeReadiness,
  describeSessionStatus,
  deriveSessionFocus,
  estimateSessionMinutes,
  formatCoachNoteTime,
  formatSessionDuration,
  formatWeekEyebrow,
  getWeeklyProgress,
  parseCalendarDate,
  type ReadinessTone,
  type ReadinessView,
  type SessionStatusView,
  type TodayBlock
} from "@/data/today";
import { getSupabaseConfigurationError, supabase } from "@/lib/supabase";
import { WeekStrip } from "@/components/coach-hibrido/athlete/week-strip";

const coverImage = require("@/assets/today-cover.png");

const webCoverGradient = {
  backgroundColor: "transparent",
  backgroundImage:
    "linear-gradient(180deg, rgba(8, 6, 16, 0) 0%, rgba(8, 6, 16, 0) 40%, rgba(8, 6, 16, 0.55) 70%, rgba(8, 6, 16, 0.92) 100%)",
  bottom: 0,
  left: 0,
  right: 0,
  top: 0
} as unknown as ViewStyle;

/** Honra a preferência de "reduzir movimento" do sistema: animações viram cortes instantâneos. */
function useReduceMotion(): boolean {
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (mounted) setReduceMotion(value);
    });
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduceMotion);
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  return reduceMotion;
}

function AnimatedProgressFill({ progress, style }: { progress: number; style?: StyleProp<ViewStyle> }) {
  const reduceMotion = useReduceMotion();
  const animatedProgress = useRef(new Animated.Value(progress)).current;

  useEffect(() => {
    Animated.timing(animatedProgress, {
      toValue: progress,
      duration: reduceMotion ? 0 : 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false
    }).start();
  }, [progress, reduceMotion, animatedProgress]);

  const width = animatedProgress.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", "100%"],
    extrapolate: "clamp"
  });

  return <Animated.View style={[style, { width }]} />;
}

type IconName = ComponentProps<typeof Ionicons>["name"];

export function TodayScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isCompact = width < 420;
  const [dashboard, setDashboard] = useState<TodayDashboardRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [focusedBlockId, setFocusedBlockId] = useState<string | null>(null);
  const [weekAnchor, setWeekAnchor] = useState(() => new Date());
  const [weekSessions, setWeekSessions] = useState<CalendarSessionRecord[]>([]);

  useEffect(() => {
    let mounted = true;
    setIsLoading(true);
    setErrorMessage(null);

    if (!supabase) {
      setIsLoading(false);
      setErrorMessage(getSupabaseConfigurationError() ?? "Treino de hoje indisponível.");
      return () => {
        mounted = false;
      };
    }

    const repository = createTodayRepository(supabase);
    void repository
      .getToday()
      .then((next) => {
        if (!mounted) return;
        setDashboard(next);
      })
      .catch((error: unknown) => {
        if (!mounted) return;
        setErrorMessage(describeBackendError(error));
        setDashboard(null);
      })
      .finally(() => {
        if (mounted) setIsLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  // Decoração da faixa semanal: falha silenciosa não impede o atleta de ver o treino de hoje.
  useEffect(() => {
    let mounted = true;

    if (!supabase) return () => {
      mounted = false;
    };

    void createCalendarRepository(supabase)
      .listPublishedSessions(getWeekRange(weekAnchor))
      .then((sessions) => {
        if (mounted) setWeekSessions(sessions);
      })
      .catch(() => {
        if (mounted) setWeekSessions([]);
      });

    return () => {
      mounted = false;
    };
  }, [weekAnchor]);

  const session = dashboard?.session ?? null;
  const progress = dashboard?.progress ?? null;
  const referenceDate = useMemo(
    () => (dashboard ? parseCalendarDate(dashboard.reference_date) : new Date()),
    [dashboard]
  );
  const todayString = useMemo(() => toCalendarDate(new Date()), []);
  const selectedDate = dashboard?.reference_date ?? todayString;
  const weekDays = useMemo(() => createWeekGrid(weekAnchor, weekSessions), [weekAnchor, weekSessions]);
  const snapshotBlocks = useMemo(() => (session ? readSessionBlocks(session) : []), [session]);
  const todayBlocks = useMemo(() => (session ? buildTodayBlocks(session, progress) : []), [session, progress]);
  const sessionDuration = useMemo(() => estimateSessionMinutes(snapshotBlocks), [snapshotBlocks]);
  // Movimentos únicos vinculados ao catálogo na sessão inteira — o que o atleta pode abrir em vídeo.
  const exerciseCount = useMemo(
    () =>
      new Set(
        snapshotBlocks.flatMap((block) => block.movements.map((movement) => movement.slug))
      ).size,
    [snapshotBlocks]
  );
  const status = describeSessionStatus(session, progress);
  const readiness = describeReadiness(dashboard?.checkin ?? null);

  const applyProgress = useCallback((next: AthleteSessionProgressRecord) => {
    setDashboard((current) => (current ? { ...current, progress: next } : current));
  }, []);

  async function handleStartWorkout() {
    if (!session || isStarting) return;

    setActionError(null);

    if (!supabase) {
      router.push(`/app/treino?sessionId=${session.id}`);
      return;
    }

    setIsStarting(true);

    try {
      applyProgress(await createTodayRepository(supabase).startSession(session.id));
      router.push(`/app/treino?sessionId=${session.id}`);
    } catch (error: unknown) {
      setActionError(describeBackendError(error));
    } finally {
      setIsStarting(false);
    }
  }

  async function handleToggleBlock(blockId: string) {
    if (!session || !supabase) return;

    setActionError(null);

    try {
      applyProgress(await createTodayRepository(supabase).toggleBlock(session.id, blockId));
    } catch (error: unknown) {
      setActionError(describeBackendError(error));
    }
  }

  function handleSelectDate(date: string) {
    if (date === selectedDate) return;
    router.push("/app/calendario");
  }

  return (
    <View style={styles.page} testID="today-screen">
      <WeekStrip
        days={weekDays}
        label={formatWeekLabel(weekAnchor)}
        onSelectDate={handleSelectDate}
        onShiftWeek={(amount) => setWeekAnchor((current) => shiftWeek(current, amount))}
        selectedDate={selectedDate}
      />

      {isLoading && <StateMessage icon="sync-outline" text="Buscando o treino de hoje..." />}
      {!isLoading && errorMessage && <StateMessage icon="alert-circle-outline" text={errorMessage} error />}
      {actionError && <StateMessage icon="alert-circle-outline" text={actionError} error />}

      {!isLoading && !errorMessage && !session && (
        <EmptySessionCard
          hasNext={Boolean(dashboard?.next_session)}
          onOpenCalendar={() => router.push("/app/calendario")}
        />
      )}

      {!isLoading && !errorMessage && session && dashboard && (
        <>
          <CoverCard eyebrow={formatWeekEyebrow(dashboard.week)} title={getSessionTitle(session)} />

          <SessionActionCard
            duration={formatSessionDuration(sessionDuration)}
            focus={deriveSessionFocus(snapshotBlocks)}
            hasProgress={Boolean(progress)}
            isStarting={isStarting}
            onOpenCalendar={() => router.push("/app/calendario")}
            onStart={() => void handleStartWorkout()}
            status={status}
          />

          {session.coach_note.trim().length > 0 ? (
            <CoachNoteCard note={session.coach_note} time={formatCoachNoteTime(session, referenceDate)} />
          ) : dashboard.next_session ? (
            <NextSessionCard session={dashboard.next_session} />
          ) : (
            <View style={styles.nextCard}>
              <Text style={styles.nextCardEyebrow}>PRÓXIMA SESSÃO</Text>
              <Text style={styles.nextCardTitle}>Nada agendado</Text>
              <Text style={styles.nextCardMeta}>Seu coach ainda não publicou a próxima sessão.</Text>
            </View>
          )}

          <BlockChecklistCard
            blocks={todayBlocks}
            focusedBlockId={focusedBlockId}
            onBlurBlock={() => setFocusedBlockId(null)}
            onFocusBlock={setFocusedBlockId}
            onToggleBlock={(id) => void handleToggleBlock(id)}
          />

          <View style={styles.metricsStrip}>
            <StripMetric accent label="SESSÃO ATIVA" value={deriveSessionFocus(snapshotBlocks)} />
            <StripMetric label="EXERCÍCIOS" value={String(exerciseCount)} />
            <StripMetric label="BLOCOS" value={String(todayBlocks.length)} />
            <StripMetric label="TEMPO ESTIMADO" value={formatSessionDuration(sessionDuration)} />
          </View>

          <View style={[styles.lowerGrid, isCompact && styles.lowerGridCompact]}>
            <ReadinessCard readiness={readiness} onOpen={() => router.push("/app/prontidao")} />
            <WeekCard streakDays={dashboard.streak_days} week={dashboard.week} />
          </View>
        </>
      )}
    </View>
  );
}

function CoverCard({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <View style={styles.cover} testID="today-cover">
      <Image source={coverImage} resizeMode="contain" accessible={false} style={styles.coverImage} />
      <View style={[styles.coverOverlay, Platform.OS === "web" && webCoverGradient]} />
      <View style={styles.coverContent}>
        <Text style={styles.coverEyebrow}>{eyebrow}</Text>
        <Text numberOfLines={3} style={styles.coverTitle}>
          {title}
        </Text>
      </View>
    </View>
  );
}

function SessionActionCard({
  status,
  focus,
  duration,
  isStarting,
  hasProgress,
  onStart,
  onOpenCalendar
}: {
  status: SessionStatusView;
  focus: string;
  duration: string;
  isStarting: boolean;
  hasProgress: boolean;
  onStart: () => void;
  onOpenCalendar: () => void;
}) {
  const [isStartFocused, setIsStartFocused] = useState(false);
  const [isCalendarFocused, setIsCalendarFocused] = useState(false);

  return (
    <View style={styles.actionCard}>
      <View style={styles.actionCardHeader}>
        <Text style={styles.actionStatus}>{status.label}</Text>
        <Pressable
          accessibilityLabel="Ver calendário completo"
          accessibilityRole="button"
          onBlur={() => setIsCalendarFocused(false)}
          onFocus={() => setIsCalendarFocused(true)}
          onPress={onOpenCalendar}
          style={({ pressed }) => [
            styles.actionCalendarLink,
            isCalendarFocused && styles.focusedControl,
            pressed && styles.buttonPressed
          ]}
          testID="today-open-calendar"
        >
          <Text style={styles.actionCalendarLinkText}>Calendário</Text>
          <Ionicons color={colors.purple400} name="chevron-forward" size={14} />
        </Pressable>
      </View>

      <View style={styles.actionMetrics}>
        <View style={styles.actionMetric}>
          <Text style={styles.actionMetricLabel}>FOCO</Text>
          <Text style={styles.actionMetricValue}>{focus}</Text>
        </View>
        <View style={styles.actionMetricDivider} />
        <View style={styles.actionMetric}>
          <Text style={styles.actionMetricLabel}>DURAÇÃO ESTIMADA</Text>
          <Text style={styles.actionMetricValue}>{duration}</Text>
        </View>
      </View>

      <Pressable
        accessibilityLabel={hasProgress ? "Continuar treino" : "Iniciar treino"}
        accessibilityRole="button"
        accessibilityState={{ disabled: isStarting }}
        disabled={isStarting}
        onBlur={() => setIsStartFocused(false)}
        onFocus={() => setIsStartFocused(true)}
        onPress={onStart}
        style={({ pressed }) => [
          styles.primaryButton,
          isStartFocused && styles.focusedControl,
          pressed && styles.buttonPressed
        ]}
        testID="start-workout"
      >
        <Text style={styles.primaryButtonText}>
          {isStarting ? "Abrindo..." : hasProgress ? "Continuar treino" : "Iniciar treino"}
        </Text>
        <Ionicons color={colors.white} name="arrow-forward" size={18} />
      </Pressable>
    </View>
  );
}

function CoachNoteCard({ note, time }: { note: string; time: string }) {
  return (
    <View style={styles.coachCard} testID="coach-note">
      <View style={styles.coachCardHeader}>
        <View>
          <Text style={styles.coachName}>Uma mensagem para você</Text>
          <Text style={styles.coachDate}>{time}</Text>
        </View>
        <Ionicons color={colors.purple400} name="chatbubble-ellipses-outline" size={20} />
      </View>
      <Text style={styles.coachNote}>{note}</Text>
    </View>
  );
}

function BlockChecklistCard({
  blocks,
  focusedBlockId,
  onToggleBlock,
  onFocusBlock,
  onBlurBlock
}: {
  blocks: TodayBlock[];
  focusedBlockId: string | null;
  onToggleBlock: (blockId: string) => void;
  onFocusBlock: (blockId: string) => void;
  onBlurBlock: () => void;
}) {
  return (
    <View style={styles.checklistCard} testID="today-block-list">
      <Text style={styles.checklistTitle}>O QUE VEM HOJE</Text>
      {blocks.map((block, index) => (
        <ChecklistRow
          block={block}
          index={index}
          isFocused={focusedBlockId === block.id}
          isLast={index === blocks.length - 1}
          key={block.id}
          onBlurBlock={onBlurBlock}
          onFocusBlock={onFocusBlock}
          onToggleBlock={onToggleBlock}
        />
      ))}
    </View>
  );
}

function ChecklistRow({
  block,
  index,
  isLast,
  isFocused,
  onToggleBlock,
  onFocusBlock,
  onBlurBlock
}: {
  block: TodayBlock;
  index: number;
  isLast: boolean;
  isFocused: boolean;
  onToggleBlock: (blockId: string) => void;
  onFocusBlock: (blockId: string) => void;
  onBlurBlock: () => void;
}) {
  const reduceMotion = useReduceMotion();
  const iconScale = useRef(new Animated.Value(1)).current;
  const hasMounted = useRef(false);

  useEffect(() => {
    if (!hasMounted.current) {
      hasMounted.current = true;
      return;
    }
    if (reduceMotion) return;
    iconScale.setValue(0.6);
    Animated.spring(iconScale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 20,
      bounciness: 6
    }).start();
  }, [block.status, reduceMotion, iconScale]);

  return (
    <Pressable
      accessibilityLabel={block.status === "done" ? `Reabrir bloco ${block.name}` : `Concluir bloco ${block.name}`}
      accessibilityRole="button"
      accessibilityState={{ selected: block.status === "done" }}
      onBlur={onBlurBlock}
      onFocus={() => onFocusBlock(block.id)}
      onPress={() => onToggleBlock(block.id)}
      style={({ pressed }) => [
        styles.checklistRow,
        isLast && styles.checklistRowLast,
        block.status === "done" && styles.checklistRowDone,
        isFocused && styles.focusedRow,
        pressed && styles.rowPressed
      ]}
      testID={`today-block-${index}`}
    >
      <View style={[styles.checklistIndex, block.status === "done" && styles.checklistIndexDone]}>
        <Text style={styles.checklistIndexText}>{String(index + 1).padStart(2, "0")}</Text>
      </View>
      <View style={styles.checklistCopy}>
        <Text style={styles.checklistName}>{block.name}</Text>
        <Text numberOfLines={2} style={styles.checklistDetail}>
          {block.detail}
        </Text>
      </View>
      <Animated.View style={{ transform: [{ scale: iconScale }] }}>
        <Ionicons
          color={block.status === "done" ? colors.purple500 : colors.textSecondary}
          name={block.status === "done" ? "checkmark-circle" : "chevron-forward"}
          size={22}
        />
      </Animated.View>
    </Pressable>
  );
}

function StripMetric({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <View style={styles.stripMetric}>
      <Text style={[styles.stripMetricLabel, accent && styles.stripMetricLabelAccent]}>{label}</Text>
      <Text numberOfLines={1} style={styles.stripMetricValue}>{value}</Text>
    </View>
  );
}

function StateMessage({ icon, text, error = false }: { icon: IconName; text: string; error?: boolean }) {
  return (
    <View
      accessibilityRole={error ? "alert" : undefined}
      style={[styles.messageCard, error && styles.messageCardError]}
      testID={error ? "today-error" : "today-message"}
    >
      <Ionicons name={icon} size={20} color={error ? colors.danger : colors.purple500} />
      <Text style={styles.messageText}>{text}</Text>
    </View>
  );
}

function EmptySessionCard({ hasNext, onOpenCalendar }: { hasNext: boolean; onOpenCalendar: () => void }) {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <View style={styles.emptyCard} testID="today-empty">
      <Text style={styles.emptyEyebrow}>SEM SESSÃO HOJE</Text>
      <Text style={styles.emptyTitle}>Dia sem sessão publicada.</Text>
      <Text style={styles.emptyDescription}>
        {hasNext
          ? "Aproveite para recuperar. A próxima sessão já está no seu calendário."
          : "Assim que seu coach publicar uma sessão, ela aparece aqui."}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Abrir calendário"
        onPress={onOpenCalendar}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        style={({ pressed }) => [styles.secondaryButton, isFocused && styles.focusedControlOnColor, pressed && styles.buttonPressed]}
      >
        <Text style={styles.secondaryButtonText}>Ver calendário</Text>
        <Ionicons name="arrow-forward" size={16} color={colors.white} />
      </Pressable>
    </View>
  );
}

/**
 * Resumo da prontidão do dia. O questionário completo vive em `/app/prontidao`:
 * sete perguntas e o seletor de dor não cabem neste card.
 */
function ReadinessCard({ readiness, onOpen }: { readiness: ReadinessView | null; onOpen: () => void }) {
  const tone = readiness ? readinessToneColors[readiness.tone] : colors.textSecondary;
  const [isFocused, setIsFocused] = useState(false);

  return (
    <View style={styles.infoCard}>
      <View style={styles.infoCardTopline}>
        <Text style={styles.infoCardEyebrow}>PRONTIDÃO</Text>
        <Ionicons name="pulse-outline" size={20} color={tone} />
      </View>
      <View style={styles.readinessScoreRow}>
        <Text style={styles.readinessScore}>{readiness ? readiness.score : "—"}</Text>
        <Text style={styles.readinessOutOf}>/ 5</Text>
      </View>
      <Text style={styles.infoCardTitle}>{readiness ? readiness.label : "Check-in do dia pendente"}</Text>
      <Text style={styles.infoCardDetail}>
        {readiness ? readiness.detail : "Leva menos de um minuto e orienta o treino de hoje."}
      </Text>
      {readiness?.pain && (
        <Text style={styles.readinessPain} testID="readiness-pain">
          {readiness.pain}
        </Text>
      )}
      <View style={styles.progressTrack}>
        <AnimatedProgressFill
          progress={readiness?.progress ?? 0}
          style={[styles.progressFill, { backgroundColor: tone }]}
        />
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={readiness ? "Editar check-in" : "Fazer check-in"}
        testID={readiness ? "edit-checkin" : "open-checkin"}
        onPress={onOpen}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        style={({ pressed }) => [
          readiness ? styles.readinessLink : styles.readinessCta,
          isFocused && (readiness ? styles.focusedControl : styles.focusedControlOnColor),
          pressed && styles.buttonPressed
        ]}
      >
        <Text style={readiness ? styles.readinessLinkText : styles.readinessCtaText}>
          {readiness ? "Editar check-in" : "Fazer check-in"}
        </Text>
      </Pressable>
    </View>
  );
}

function WeekCard({ week, streakDays }: { week: TodayDashboardRecord["week"]; streakDays: number }) {
  const progress = getWeeklyProgress(week.completed, week.planned);

  return (
    <View style={styles.infoCard}>
      <View style={styles.infoCardTopline}>
        <Text style={styles.infoCardEyebrow}>ESTA SEMANA</Text>
        <Ionicons name="flame-outline" size={20} color={colors.purple400} />
      </View>
      <View style={styles.readinessScoreRow}>
        <Text style={styles.readinessScore}>{week.completed}</Text>
        <Text style={styles.readinessOutOf}>/ {week.planned}</Text>
      </View>
      <Text style={styles.infoCardTitle}>
        {week.planned === 0
          ? "Nenhuma sessão prescrita"
          : `${week.completed} de ${week.planned} ${week.planned === 1 ? "sessão concluída" : "sessões concluídas"}`}
      </Text>
      <Text style={styles.infoCardDetail}>
        {streakDays > 0
          ? `${streakDays} ${streakDays === 1 ? "treino" : "treinos"} de consistência`
          : "Conclua um treino para iniciar sua sequência"}
      </Text>
      <View style={styles.progressTrack}>
        <AnimatedProgressFill progress={progress} style={styles.progressFillLime} />
      </View>
    </View>
  );
}

function NextSessionCard({ session }: { session: CalendarSessionRecord }) {
  return (
    <View style={styles.nextCard} testID="next-session">
      <View style={styles.nextCardTopline}>
        <Text style={styles.nextCardEyebrow}>PRÓXIMA SESSÃO</Text>
        <Ionicons name="calendar-clear-outline" size={19} color={colors.textSecondary} />
      </View>
      <Text style={styles.nextCardTitle}>{getSessionTitle(session)}</Text>
      <Text style={styles.nextCardMeta}>{describeNextSession(session)}</Text>
      <View style={styles.nextCardRule} />
      <Text style={styles.nextCardHint}>Prepare-se: ela já está publicada no seu calendário.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    gap: spacing[4]
  },
  cover: {
    aspectRatio: 2.35,
    backgroundColor: colors.surface02,
    borderRadius: radius.xxl,
    justifyContent: "flex-end",
    maxHeight: 320,
    minHeight: 176,
    overflow: "hidden",
    padding: spacing[5]
  },
  coverImage: {
    bottom: 0,
    height: "100%",
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
    transform: [{ scale: 1.1 }],
    width: "100%"
  },
  coverOverlay: {
    backgroundColor: "rgba(8, 6, 16, 0.55)",
    bottom: 0,
    left: 0,
    position: "absolute",
    right: 0,
    top: 0
  },
  coverContent: {
    gap: spacing[1]
  },
  coverEyebrow: {
    color: colors.purple400,
    fontFamily: fontFamilies.interfaceBold,
    fontSize: 11,
    letterSpacing: 1.1,
    textTransform: "uppercase"
  },
  coverTitle: {
    color: colors.textPrimary,
    fontFamily: fontFamilies.display,
    fontSize: 34,
    lineHeight: 35
  },
  actionCard: {
    backgroundColor: colors.surface02,
    borderRadius: radius.xl,
    gap: spacing[4],
    padding: spacing[5]
  },
  actionCardHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  actionStatus: {
    color: colors.purple400,
    fontFamily: fontFamilies.interfaceBold,
    fontSize: 11,
    letterSpacing: 0.9,
    textTransform: "uppercase"
  },
  actionCalendarLink: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[1],
    minHeight: 44,
    paddingHorizontal: spacing[1]
  },
  actionCalendarLinkText: {
    color: colors.purple400,
    fontFamily: fontFamilies.interfaceBold,
    fontSize: 12
  },
  actionMetrics: {
    alignItems: "center",
    flexDirection: "row"
  },
  actionMetric: {
    flex: 1,
    gap: spacing[1]
  },
  actionMetricDivider: {
    backgroundColor: colors.border,
    height: 32,
    marginHorizontal: spacing[4],
    width: 1
  },
  actionMetricLabel: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.interfaceBold,
    fontSize: 10,
    letterSpacing: 1,
    textTransform: "uppercase"
  },
  actionMetricValue: {
    color: colors.textPrimary,
    fontFamily: fontFamilies.display,
    fontSize: 22,
    lineHeight: 24,
    marginTop: 2
  },
  checklistCard: {
    backgroundColor: colors.surface02,
    borderRadius: radius.xl,
    overflow: "hidden",
    paddingTop: spacing[4]
  },
  checklistTitle: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.interfaceBold,
    fontSize: 11,
    letterSpacing: 1.1,
    paddingHorizontal: spacing[5],
    paddingBottom: spacing[3]
  },
  checklistRow: {
    alignItems: "center",
    borderTopColor: colors.border,
    borderTopWidth: 1,
    flexDirection: "row",
    gap: spacing[3],
    minHeight: 72,
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[3]
  },
  checklistRowLast: {
    paddingBottom: spacing[4]
  },
  checklistRowDone: {
    backgroundColor: colors.surface04
  },
  checklistIndex: {
    alignItems: "center",
    backgroundColor: colors.surface04,
    borderRadius: radius.sm,
    height: 28,
    justifyContent: "center",
    width: 28
  },
  checklistIndexDone: {
    backgroundColor: colors.purple500
  },
  checklistIndexText: {
    color: colors.textPrimary,
    fontFamily: fontFamilies.interfaceBold,
    fontSize: 11
  },
  checklistCopy: {
    flex: 1,
    minWidth: 0
  },
  checklistName: {
    color: colors.textPrimary,
    fontFamily: fontFamilies.interfaceBold,
    fontSize: 15
  },
  checklistDetail: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.interface,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 3
  },
  metricsStrip: {
    backgroundColor: colors.surface02,
    borderRadius: radius.xl,
    flexDirection: "row",
    flexWrap: "wrap"
  },
  lowerGrid: {
    alignItems: "stretch",
    flexDirection: "row",
    gap: spacing[3]
  },
  lowerGridCompact: {
    flexDirection: "column"
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: colors.purple500,
    borderRadius: radius.pill,
    flexDirection: "row",
    gap: spacing[3],
    justifyContent: "space-between",
    minHeight: 52,
    paddingHorizontal: spacing[5],
    width: "100%",
    ...shadows.ctaGlow
  },
  primaryButtonText: {
    color: colors.white,
    fontFamily: fontFamilies.interfaceBold,
    fontSize: 14
  },
  secondaryButton: {
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: colors.purple500,
    borderRadius: radius.pill,
    flexDirection: "row",
    gap: spacing[3],
    marginTop: spacing[5],
    minHeight: 48,
    paddingHorizontal: spacing[5]
  },
  secondaryButtonText: {
    color: colors.white,
    fontFamily: fontFamilies.interfaceBold,
    fontSize: 13
  },
  buttonPressed: {
    opacity: 0.75
  },
  rowPressed: {
    backgroundColor: colors.surface03
  },
  focusedRow: {
    backgroundColor: colors.surface03,
    borderTopColor: colors.purple400,
    borderTopWidth: 2
  },
  emptyCard: {
    backgroundColor: colors.surface02,
    borderRadius: radius.xxl,
    overflow: "hidden",
    padding: spacing[8],
    position: "relative"
  },
  emptyEyebrow: {
    color: colors.purple400,
    fontFamily: fontFamilies.interfaceBold,
    fontSize: 11,
    letterSpacing: 1.4
  },
  emptyTitle: {
    color: colors.textPrimary,
    fontFamily: fontFamilies.display,
    fontSize: 38,
    lineHeight: 40,
    marginTop: spacing[3]
  },
  emptyDescription: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.interface,
    fontSize: 15,
    lineHeight: 23,
    marginTop: spacing[2],
    maxWidth: 480
  },
  messageCard: {
    alignItems: "center",
    backgroundColor: colors.surface02,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing[3],
    padding: spacing[5]
  },
  messageCardError: {
    borderColor: colors.danger
  },
  messageText: {
    color: colors.textSecondary,
    flex: 1,
    fontFamily: fontFamilies.interface,
    fontSize: 14
  },
  infoCard: {
    backgroundColor: colors.surface02,
    borderRadius: radius.xl,
    flex: 1,
    minHeight: 220,
    padding: spacing[5]
  },
  infoCardTopline: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  infoCardEyebrow: {
    color: colors.purple400,
    fontFamily: fontFamilies.interfaceBold,
    fontSize: 10,
    letterSpacing: 1.2
  },
  readinessScoreRow: {
    alignItems: "baseline",
    flexDirection: "row",
    marginTop: spacing[4]
  },
  readinessScore: {
    color: colors.textPrimary,
    fontFamily: fontFamilies.display,
    fontSize: 34
  },
  readinessOutOf: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.interface,
    fontSize: 14,
    marginLeft: 4
  },
  infoCardTitle: {
    color: colors.textPrimary,
    fontFamily: fontFamilies.interfaceBold,
    fontSize: 14,
    marginTop: spacing[1]
  },
  infoCardDetail: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.interface,
    fontSize: 12,
    marginTop: 4
  },
  progressTrack: {
    backgroundColor: colors.surface04,
    borderRadius: radius.pill,
    height: 7,
    marginTop: spacing[4],
    overflow: "hidden"
  },
  progressFill: {
    backgroundColor: colors.success,
    borderRadius: radius.pill,
    height: "100%"
  },
  progressFillLime: {
    backgroundColor: colors.purple500,
    borderRadius: radius.pill,
    height: "100%"
  },
  readinessPain: {
    color: colors.danger,
    fontFamily: fontFamilies.interfaceBold,
    fontSize: 12,
    marginTop: 4
  },
  readinessCta: {
    alignItems: "center",
    backgroundColor: colors.purple500,
    borderRadius: radius.pill,
    justifyContent: "center",
    marginTop: spacing[4],
    minHeight: 46
  },
  readinessCtaText: {
    color: colors.white,
    fontFamily: fontFamilies.interfaceBold,
    fontSize: 13
  },
  readinessLink: {
    alignSelf: "flex-start",
    justifyContent: "center",
    marginTop: spacing[3],
    minHeight: 44
  },
  readinessLinkText: {
    color: colors.purple400,
    fontFamily: fontFamilies.interfaceBold,
    fontSize: 12
  },
  focusedControl: {
    borderColor: colors.purple400,
    borderWidth: 3
  },
  focusedControlOnColor: {
    borderColor: colors.white,
    borderWidth: 3
  },
  coachCard: {
    backgroundColor: colors.surface03,
    borderColor: colors.borderPurple,
    borderWidth: 1,
    borderRadius: radius.xl,
    gap: spacing[4],
    overflow: "hidden",
    padding: spacing[5]
  },
  coachCardHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  coachName: {
    color: colors.textPrimary,
    fontFamily: fontFamilies.interfaceBold,
    fontSize: 14
  },
  coachDate: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.interface,
    fontSize: 11,
    marginTop: 3
  },
  coachNote: {
    color: colors.textPrimary,
    fontFamily: fontFamilies.interface,
    fontSize: 15,
    lineHeight: 23
  },
  nextCard: {
    backgroundColor: colors.surface02,
    borderRadius: radius.xl,
    padding: spacing[5]
  },
  nextCardTopline: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  nextCardEyebrow: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.interfaceBold,
    fontSize: 10,
    letterSpacing: 1.2
  },
  nextCardTitle: {
    color: colors.textPrimary,
    fontFamily: fontFamilies.interfaceBold,
    fontSize: 22,
    marginTop: spacing[3]
  },
  nextCardMeta: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.interface,
    fontSize: 13,
    marginTop: 4
  },
  nextCardRule: {
    backgroundColor: colors.border,
    height: 1,
    marginVertical: spacing[4]
  },
  nextCardHint: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.interface,
    fontSize: 12,
    lineHeight: 18
  },
  stripMetric: {
    alignItems: "flex-start",
    minWidth: "45%",
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[4]
  },
  stripMetricLabel: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.interfaceBold,
    fontSize: 9,
    letterSpacing: 0.9,
    textTransform: "uppercase"
  },
  stripMetricLabelAccent: {
    color: colors.purple400
  },
  stripMetricValue: {
    color: colors.textPrimary,
    fontFamily: fontFamilies.display,
    fontSize: 22,
    lineHeight: 24,
    marginTop: spacing[2]
  }
});

/** Semáforo da prontidão: verde >= 4,0 · amarelo 3,0-3,9 · vermelho < 3,0. */
const readinessToneColors: Record<ReadinessTone, string> = {
  ready: colors.success,
  caution: colors.warning,
  risk: colors.danger
};
