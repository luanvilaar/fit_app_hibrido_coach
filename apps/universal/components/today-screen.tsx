import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ComponentProps } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions
} from "react-native";
import { colors, fontFamilies, radius, spacing, typeScale } from "@fitblock/design-tokens";
import {
  createTodayRepository,
  type AthleteSessionProgressRecord,
  type CalendarSessionRecord,
  type TodayDashboardRecord
} from "@fitblock/backend";
import { describeBackendError } from "@/data/backend-error";
import { getSessionTitle, readSessionBlocks } from "@/data/calendar";
import {
  buildTodayBlocks,
  describeNextSession,
  describeReadiness,
  describeSessionStatus,
  deriveSessionFocus,
  estimateSessionMinutes,
  formatCoachNoteTime,
  formatSessionDuration,
  formatTodayEyebrow,
  formatWeekEyebrow,
  getWeeklyProgress,
  parseCalendarDate,
  type ReadinessTone,
  type ReadinessView
} from "@/data/today";
import { getSupabaseConfigurationError, supabase } from "@/lib/supabase";
import { getSizeClass, isCompactSizeClass } from "@/lib/layout";

type IconName = ComponentProps<typeof Ionicons>["name"];

export function TodayScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const sizeClass = getSizeClass(width);
  const isCompact = isCompactSizeClass(sizeClass);
  const [dashboard, setDashboard] = useState<TodayDashboardRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);

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

  const session = dashboard?.session ?? null;
  const progress = dashboard?.progress ?? null;
  const referenceDate = useMemo(
    () => (dashboard ? parseCalendarDate(dashboard.reference_date) : new Date()),
    [dashboard]
  );
  const snapshotBlocks = useMemo(() => (session ? readSessionBlocks(session) : []), [session]);
  const todayBlocks = useMemo(() => (session ? buildTodayBlocks(session, progress) : []), [session, progress]);
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

  return (
    <View style={styles.page} testID="today-screen">
      <View style={[styles.pageIntro, isCompact && styles.pageIntroCompact]}>
        <View style={styles.pageIntroCopy}>
          <Text style={styles.eyebrow}>{formatTodayEyebrow(referenceDate)}</Text>
          <Text style={styles.pageTitle}>Hoje, o trabalho é seu.</Text>
          <Text style={styles.pageDescription}>
            Um treino bem executado começa com uma intenção clara.
          </Text>
        </View>
        <View style={[styles.statusPill, statusPillStyles[status.tone]]}>
          <View style={[styles.statusDot, statusDotStyles[status.tone]]} />
          <Text style={[styles.statusText, statusTextStyles[status.tone]]}>{status.label}</Text>
        </View>
      </View>

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
        <View style={[
          styles.hero,
          isCompact && styles.heroCompact,
          sizeClass === "tablet-landscape" && styles.heroTablet
        ]}>
          <View style={styles.heroCopy}>
            <View style={styles.heroTopline}>
              <Text style={styles.heroEyebrow}>{formatWeekEyebrow(dashboard.week)}</Text>
              <View style={styles.focusPill}>
                <Text style={styles.focusPillText}>
                  {deriveSessionFocus(snapshotBlocks).toUpperCase()}
                </Text>
              </View>
            </View>
            <Text style={styles.heroTitle}>{getSessionTitle(session)}</Text>
            <Text style={styles.heroDescription}>
              {snapshotBlocks.map((block) => block.name).join(" · ") || "Sessão sem blocos prescritos."}
            </Text>
            <View style={styles.heroMetaRow}>
              <Meta icon="time-outline" label={formatSessionDuration(estimateSessionMinutes(snapshotBlocks))} />
              <Meta
                icon="layers-outline"
                label={`${snapshotBlocks.length} ${snapshotBlocks.length === 1 ? "bloco" : "blocos"}`}
              />
              <Meta icon="barbell-outline" label={deriveSessionFocus(snapshotBlocks)} />
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={progress ? "Continuar treino" : "Iniciar treino"}
              accessibilityState={{ disabled: isStarting }}
              disabled={isStarting}
              testID="start-workout"
              onPress={() => {
                void handleStartWorkout();
              }}
              style={({ pressed }) => [styles.primaryButton, pressed && styles.buttonPressed]}
            >
              <Text style={styles.primaryButtonText}>
                {isStarting ? "Abrindo..." : progress ? "Continuar treino" : "Iniciar treino"}
              </Text>
              <View style={styles.primaryButtonIcon}>
                <Ionicons name="arrow-forward" size={18} color={colors.ink} />
              </View>
            </Pressable>
          </View>
          <View style={styles.heroVisual}>
            <Text style={styles.heroVisualIndex}>
              {String(Math.max(dashboard.week.position, 1)).padStart(2, "0")}
            </Text>
            <Text style={styles.heroVisualWord}>FIT{`\n`}BLOCK</Text>
            <View style={styles.visualRule} />
            <Text style={styles.heroVisualCaption}>TREINO COM INTENÇÃO</Text>
          </View>
        </View>
      )}

      {!isLoading && !errorMessage && dashboard && (
        <View style={[
          styles.contentGrid,
          isCompact && styles.contentGridCompact,
          sizeClass === "tablet-portrait" && styles.contentGridTabletPortrait
        ]}>
          <View style={[
            styles.primaryColumn,
            sizeClass === "tablet-landscape" && styles.primaryColumnTablet
          ]}>
            {session && (
              <>
                <SectionHeader eyebrow="A sessão" title="O que vem hoje" />
                <View style={styles.blocksCard}>
                  {todayBlocks.map((block, index) => (
                    <Pressable
                      key={block.id}
                      accessibilityRole="button"
                      accessibilityLabel={
                        block.status === "done"
                          ? `Reabrir bloco ${block.name}`
                          : `Concluir bloco ${block.name}`
                      }
                      accessibilityState={{ selected: block.status === "done" }}
                      testID={`today-block-${index}`}
                      onPress={() => {
                        void handleToggleBlock(block.id);
                      }}
                      style={({ pressed }) => [
                        styles.blockRow,
                        index === 0 && styles.blockRowFirst,
                        block.status === "done" && styles.blockRowDone,
                        pressed && styles.rowPressed
                      ]}
                    >
                      <View style={[styles.blockIndex, block.status === "done" && styles.blockIndexReady]}>
                        {block.status === "done" ? (
                          <Ionicons name="checkmark" size={18} color={colors.canvas} />
                        ) : (
                          <Text style={styles.blockIndexText}>{String(index + 1).padStart(2, "0")}</Text>
                        )}
                      </View>
                      <View style={styles.blockContent}>
                        <Text style={styles.blockName}>{block.name}</Text>
                        <Text style={styles.blockDetail}>{block.detail}</Text>
                      </View>
                      <Ionicons name="chevron-forward" size={17} color={colors.textMuted} />
                    </Pressable>
                  ))}
                </View>
              </>
            )}

            <SectionHeader eyebrow="Seu contexto" title="Como você chega" />
            <View style={[
              styles.contextGrid,
              isCompact && styles.contextGridCompact,
              sizeClass === "tablet-portrait" && styles.contextGridTabletPortrait
            ]}>
              <ReadinessCard readiness={readiness} onOpen={() => router.push("/app/prontidao")} />
              <WeekCard week={dashboard.week} streakDays={dashboard.streak_days} />
            </View>
          </View>

          <View style={[
            styles.secondaryColumn,
            sizeClass === "tablet-landscape" && styles.secondaryColumnTablet
          ]}>
            {session && session.coach_note.trim().length > 0 && (
              <>
                <SectionHeader eyebrow="Do coach" title="Uma mensagem para você" />
                <View style={styles.coachCard} testID="coach-note">
                  <View style={styles.coachAvatar}>
                    <Text style={styles.coachAvatarText}>FB</Text>
                  </View>
                  <View style={styles.coachCardCopy}>
                    <View style={styles.coachCardHeader}>
                      <View>
                        <Text style={styles.coachName}>Seu coach</Text>
                        <Text style={styles.coachDate}>{formatCoachNoteTime(session, referenceDate)}</Text>
                      </View>
                      <Ionicons name="chatbubble-ellipses-outline" size={20} color={colors.fitblockPurple} />
                    </View>
                    <Text style={styles.coachNote}>{session.coach_note}</Text>
                  </View>
                </View>
              </>
            )}

            {dashboard.next_session ? (
              <NextSessionCard session={dashboard.next_session} hasSpacing={Boolean(session?.coach_note.trim())} />
            ) : (
              <View style={styles.nextCard}>
                <View style={styles.nextCardTopline}>
                  <Text style={styles.nextCardEyebrow}>PRÓXIMA SESSÃO</Text>
                  <Ionicons name="calendar-clear-outline" size={19} color={colors.textSecondary} />
                </View>
                <Text style={styles.nextCardTitle}>Nada agendado</Text>
                <Text style={styles.nextCardMeta}>Seu coach ainda não publicou a próxima sessão.</Text>
              </View>
            )}
          </View>
        </View>
      )}
    </View>
  );
}

function Meta({ icon, label }: { icon: IconName; label: string }) {
  return (
    <View style={styles.metaItem}>
      <Ionicons name={icon} size={17} color="rgba(255, 255, 255, 0.85)" />
      <Text style={styles.metaLabel}>{label}</Text>
    </View>
  );
}

function SectionHeader({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionEyebrow}>{eyebrow}</Text>
      <Text style={styles.sectionTitle}>{title}</Text>
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
      <Ionicons name={icon} size={20} color={error ? colors.danger : colors.fitblockPurple} />
      <Text style={styles.messageText}>{text}</Text>
    </View>
  );
}

function EmptySessionCard({ hasNext, onOpenCalendar }: { hasNext: boolean; onOpenCalendar: () => void }) {
  return (
    <View style={styles.emptyCard} testID="today-empty">
      <Text style={styles.emptyEyebrow}>SEM TREINO PARA HOJE</Text>
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
        style={({ pressed }) => [styles.secondaryButton, pressed && styles.buttonPressed]}
      >
        <Text style={styles.secondaryButtonText}>Ver calendário</Text>
        <Ionicons name="arrow-forward" size={16} color={colors.canvas} />
      </Pressable>
    </View>
  );
}

/**
 * Resumo da prontidão do dia. O questionário completo vive em `/app/prontidao`:
 * sete perguntas e o seletor de dor não cabem neste card.
 */
function ReadinessCard({ readiness, onOpen }: { readiness: ReadinessView | null; onOpen: () => void }) {
  const tone = readiness ? readinessToneColors[readiness.tone] : colors.textMuted;

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
        <View
          style={[styles.progressFill, { backgroundColor: tone, width: `${(readiness?.progress ?? 0) * 100}%` }]}
        />
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={readiness ? "Editar check-in" : "Fazer check-in"}
        testID={readiness ? "edit-checkin" : "open-checkin"}
        onPress={onOpen}
        style={({ pressed }) => [
          readiness ? styles.readinessLink : styles.readinessCta,
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
        <Ionicons name="flame-outline" size={20} color={colors.fitblockPurple} />
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
        <View style={[styles.progressFillPurple, { width: `${progress * 100}%` }]} />
      </View>
    </View>
  );
}

function NextSessionCard({ session, hasSpacing }: { session: CalendarSessionRecord; hasSpacing: boolean }) {
  return (
    <View style={[styles.nextCard, hasSpacing && styles.nextCardSpaced]} testID="next-session">
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
    gap: spacing[8]
  },
  pageIntro: {
    alignItems: "flex-end",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  pageIntroCompact: {
    alignItems: "flex-start",
    flexDirection: "column",
    gap: spacing[4]
  },
  pageIntroCopy: {
    flex: 1,
    minWidth: 0
  },
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
    fontWeight: "700",
    letterSpacing: 0.2
  },
  pageDescription: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.interface,
    fontSize: 15,
    marginTop: spacing[2]
  },
  statusPill: {
    alignItems: "center",
    backgroundColor: "#E7F5EE",
    borderRadius: radius.pill,
    flexDirection: "row",
    gap: 7,
    minHeight: 34,
    paddingHorizontal: spacing[3]
  },
  statusPillRunning: {
    backgroundColor: "#F3EFFF"
  },
  statusPillEmpty: {
    backgroundColor: colors.softCloud
  },
  statusDot: {
    backgroundColor: colors.success,
    borderRadius: radius.pill,
    height: 7,
    width: 7
  },
  statusDotRunning: {
    backgroundColor: colors.fitblockPurple
  },
  statusDotEmpty: {
    backgroundColor: colors.textMuted
  },
  statusText: {
    color: colors.success,
    fontFamily: fontFamilies.interface,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1
  },
  statusTextRunning: {
    color: colors.fitblockPurple
  },
  statusTextEmpty: {
    color: colors.textSecondary
  },
  hero: {
    backgroundColor: colors.graphite,
    borderRadius: radius.xl,
    flexDirection: "row",
    minHeight: 330,
    overflow: "hidden"
  },
  heroCompact: {
    flexDirection: "column"
  },
  heroTablet: {
    minHeight: 280
  },
  heroCopy: {
    flex: 1,
    padding: spacing[8],
    paddingRight: spacing[6]
  },
  heroTopline: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing[3]
  },
  heroEyebrow: {
    color: "#C7B8FF",
    fontFamily: fontFamilies.interface,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1
  },
  focusPill: {
    backgroundColor: colors.fitblockPurple,
    borderRadius: radius.pill,
    paddingHorizontal: spacing[3],
    paddingVertical: 6
  },
  focusPillText: {
    color: colors.canvas,
    fontFamily: fontFamilies.interface,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1
  },
  heroTitle: {
    color: colors.canvas,
    fontFamily: fontFamilies.interface,
    fontSize: typeScale.headingXl,
    fontWeight: "700",
    letterSpacing: 0.5,
    marginTop: spacing[4]
  },
  heroDescription: {
    color: "#D0D1DB",
    fontFamily: fontFamilies.interface,
    fontSize: 16,
    lineHeight: 24,
    maxWidth: 520,
    marginTop: spacing[2]
  },
  heroMetaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing[5],
    marginTop: spacing[6]
  },
  metaItem: {
    alignItems: "center",
    flexDirection: "row",
    gap: 7
  },
  metaLabel: {
    color: "rgba(255, 255, 255, 0.85)",
    fontFamily: fontFamilies.interface,
    fontSize: 13,
    fontWeight: "700"
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: colors.canvas,
    borderRadius: radius.pill,
    flexDirection: "row",
    gap: spacing[3],
    justifyContent: "space-between",
    marginTop: spacing[6],
    minHeight: 52,
    paddingLeft: spacing[5],
    paddingRight: 6,
    width: 214
  },
  primaryButtonText: {
    color: colors.ink,
    fontFamily: fontFamilies.interface,
    fontSize: 14,
    fontWeight: "800"
  },
  primaryButtonIcon: {
    alignItems: "center",
    backgroundColor: colors.fitblockPurple,
    borderRadius: radius.pill,
    height: 40,
    justifyContent: "center",
    width: 40
  },
  secondaryButton: {
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: colors.fitblockPurple,
    borderRadius: radius.pill,
    flexDirection: "row",
    gap: spacing[3],
    marginTop: spacing[5],
    minHeight: 48,
    paddingHorizontal: spacing[5]
  },
  secondaryButtonText: {
    color: colors.canvas,
    fontFamily: fontFamilies.interface,
    fontSize: 13,
    fontWeight: "800"
  },
  buttonPressed: {
    opacity: 0.75
  },
  rowPressed: {
    backgroundColor: colors.softCloud
  },
  heroVisual: {
    alignItems: "flex-end",
    backgroundColor: colors.fitblockPurpleDeep,
    justifyContent: "space-between",
    minHeight: 330,
    padding: spacing[8],
    width: "32%"
  },
  heroVisualIndex: {
    color: "#C7B8FF",
    fontFamily: fontFamilies.interface,
    fontSize: 22,
    fontWeight: "700"
  },
  heroVisualWord: {
    color: colors.canvas,
    fontFamily: fontFamilies.interface,
    fontSize: 56,
    fontWeight: "700",
    letterSpacing: -2,
    lineHeight: 50,
    textAlign: "right"
  },
  visualRule: {
    backgroundColor: "#BDAEFF",
    height: 2,
    marginBottom: spacing[2],
    width: "100%"
  },
  heroVisualCaption: {
    color: colors.canvas,
    fontFamily: fontFamilies.interface,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1,
    textAlign: "right"
  },
  emptyCard: {
    backgroundColor: colors.graphite,
    borderRadius: radius.xl,
    padding: spacing[8]
  },
  emptyEyebrow: {
    color: "#C7B8FF",
    fontFamily: fontFamilies.interface,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.4
  },
  emptyTitle: {
    color: colors.canvas,
    fontFamily: fontFamilies.interface,
    fontSize: typeScale.headingXl,
    fontWeight: "700",
    marginTop: spacing[3]
  },
  emptyDescription: {
    color: "#D0D1DB",
    fontFamily: fontFamilies.interface,
    fontSize: 15,
    lineHeight: 23,
    marginTop: spacing[2],
    maxWidth: 520
  },
  messageCard: {
    alignItems: "center",
    backgroundColor: colors.canvas,
    borderColor: colors.hairline,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing[3],
    padding: spacing[5]
  },
  messageCardError: {
    borderColor: "#F3C3C8"
  },
  messageText: {
    color: colors.textSecondary,
    flex: 1,
    fontFamily: fontFamilies.interface,
    fontSize: 14
  },
  contentGrid: {
    flexDirection: "row",
    gap: spacing[8]
  },
  contentGridCompact: {
    flexDirection: "column"
  },
  contentGridTabletPortrait: {
    flexDirection: "column",
    gap: spacing[8]
  },
  primaryColumn: {
    flex: 1.25,
    minWidth: 0
  },
  primaryColumnTablet: {
    flex: 1.1,
    minWidth: 0
  },
  secondaryColumn: {
    flex: 0.75,
    minWidth: 0
  },
  secondaryColumnTablet: {
    flex: 0.9,
    minWidth: 0
  },
  sectionHeader: {
    marginBottom: spacing[4]
  },
  sectionEyebrow: {
    color: colors.textMuted,
    fontFamily: fontFamilies.interface,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.4,
    marginBottom: 5,
    textTransform: "uppercase"
  },
  sectionTitle: {
    color: colors.ink,
    fontFamily: fontFamilies.interface,
    fontSize: 28,
    fontWeight: "700"
  },
  blocksCard: {
    backgroundColor: colors.canvas,
    borderColor: colors.hairline,
    borderRadius: radius.lg,
    borderWidth: 1,
    marginBottom: spacing[8],
    overflow: "hidden"
  },
  blockRow: {
    alignItems: "center",
    borderTopColor: colors.hairline,
    borderTopWidth: 1,
    flexDirection: "row",
    gap: spacing[3],
    minHeight: 68,
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[2]
  },
  blockRowFirst: {
    borderTopWidth: 0
  },
  blockRowDone: {
    backgroundColor: "#f0fdf4"
  },
  blockIndex: {
    alignItems: "center",
    borderColor: colors.hairline,
    borderRadius: radius.pill,
    borderWidth: 1,
    height: 30,
    justifyContent: "center",
    width: 30
  },
  blockIndexReady: {
    backgroundColor: colors.success,
    borderColor: colors.success
  },
  blockIndexText: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.interface,
    fontSize: 11,
    fontWeight: "800"
  },
  blockContent: {
    flex: 1,
    minWidth: 0
  },
  blockName: {
    color: colors.ink,
    fontFamily: fontFamilies.interface,
    fontSize: 15,
    fontWeight: "800"
  },
  blockDetail: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.interface,
    fontSize: 13,
    marginTop: 4
  },
  contextGrid: {
    flexDirection: "row",
    gap: spacing[5]
  },
  contextGridCompact: {
    flexDirection: "column"
  },
  contextGridTabletPortrait: {
    flexDirection: "row",
    gap: spacing[5]
  },
  infoCard: {
    backgroundColor: colors.canvas,
    borderColor: colors.hairline,
    borderRadius: radius.lg,
    borderWidth: 1,
    flex: 1,
    minHeight: 220,
    padding: spacing[6]
  },
  infoCardTopline: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  infoCardEyebrow: {
    color: colors.fitblockPurple,
    fontFamily: fontFamilies.interface,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.2
  },
  readinessScoreRow: {
    alignItems: "baseline",
    flexDirection: "row",
    marginTop: spacing[4]
  },
  readinessScore: {
    color: colors.ink,
    fontFamily: fontFamilies.interface,
    fontSize: 36,
    fontWeight: "700"
  },
  readinessOutOf: {
    color: colors.textMuted,
    fontFamily: fontFamilies.interface,
    fontSize: 14,
    marginLeft: 4
  },
  infoCardTitle: {
    color: colors.ink,
    fontFamily: fontFamilies.interface,
    fontSize: 14,
    fontWeight: "800",
    marginTop: -2
  },
  infoCardDetail: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.interface,
    fontSize: 12,
    marginTop: 4
  },
  progressTrack: {
    backgroundColor: colors.surfaceMuted,
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
  progressFillPurple: {
    backgroundColor: colors.fitblockPurple,
    borderRadius: radius.pill,
    height: "100%"
  },
  readinessPain: {
    color: colors.danger,
    fontFamily: fontFamilies.interface,
    fontSize: 12,
    fontWeight: "700",
    marginTop: 4
  },
  readinessCta: {
    alignItems: "center",
    backgroundColor: colors.fitblockPurple,
    borderRadius: radius.pill,
    justifyContent: "center",
    marginTop: spacing[4],
    minHeight: 46
  },
  readinessCtaText: {
    color: colors.canvas,
    fontFamily: fontFamilies.interface,
    fontSize: 13,
    fontWeight: "800"
  },
  readinessLink: {
    alignSelf: "flex-start",
    justifyContent: "center",
    marginTop: spacing[3],
    minHeight: 32
  },
  readinessLinkText: {
    color: colors.fitblockPurple,
    fontFamily: fontFamilies.interface,
    fontSize: 12,
    fontWeight: "800"
  },
  coachCard: {
    backgroundColor: colors.ink,
    borderRadius: radius.lg,
    flexDirection: "row",
    gap: spacing[3],
    minHeight: 200,
    padding: spacing[5]
  },
  coachAvatar: {
    alignItems: "center",
    backgroundColor: colors.fitblockPurple,
    borderRadius: radius.pill,
    height: 38,
    justifyContent: "center",
    width: 38
  },
  coachAvatarText: {
    color: colors.canvas,
    fontFamily: fontFamilies.interface,
    fontSize: 11,
    fontWeight: "700"
  },
  coachCardCopy: {
    flex: 1,
    minWidth: 0
  },
  coachCardHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  coachName: {
    color: colors.canvas,
    fontFamily: fontFamilies.interface,
    fontSize: 14,
    fontWeight: "800"
  },
  coachDate: {
    color: colors.textMuted,
    fontFamily: fontFamilies.interface,
    fontSize: 11,
    marginTop: 3
  },
  coachNote: {
    color: "#E2E2E8",
    fontFamily: fontFamilies.interface,
    fontSize: 15,
    lineHeight: 23,
    marginTop: spacing[5]
  },
  nextCard: {
    backgroundColor: colors.canvas,
    borderColor: colors.hairline,
    borderRadius: radius.lg,
    borderWidth: 1,
    flex: 1,
    minHeight: 220,
    padding: spacing[6]
  },
  nextCardSpaced: {
    marginTop: spacing[5]
  },
  nextCardTopline: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  nextCardEyebrow: {
    color: colors.textMuted,
    fontFamily: fontFamilies.interface,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.2
  },
  nextCardTitle: {
    color: colors.ink,
    fontFamily: fontFamilies.interface,
    fontSize: 25,
    fontWeight: "700",
    marginTop: spacing[5]
  },
  nextCardMeta: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.interface,
    fontSize: 13,
    marginTop: 4
  },
  nextCardRule: {
    backgroundColor: colors.hairline,
    height: 1,
    marginVertical: spacing[4]
  },
  nextCardHint: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.interface,
    fontSize: 12,
    lineHeight: 18
  }
});

const statusPillStyles = {
  available: styles.statusPill,
  running: styles.statusPillRunning,
  done: styles.statusPill,
  empty: styles.statusPillEmpty
} as const;

const statusDotStyles = {
  available: styles.statusDot,
  running: styles.statusDotRunning,
  done: styles.statusDot,
  empty: styles.statusDotEmpty
} as const;

const statusTextStyles = {
  available: styles.statusText,
  running: styles.statusTextRunning,
  done: styles.statusText,
  empty: styles.statusTextEmpty
} as const;

/** Semáforo da prontidão: verde >= 4,0 · amarelo 3,0-3,9 · vermelho < 3,0. */
const readinessToneColors: Record<ReadinessTone, string> = {
  ready: colors.success,
  caution: colors.warning,
  risk: colors.danger
};
