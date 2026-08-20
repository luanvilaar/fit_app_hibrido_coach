import { Ionicons } from "@expo/vector-icons";
import { useEffect, useMemo, useState } from "react";
import type { ComponentProps } from "react";
import { StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { fontFamilies, radius, spacing, typeScale, type ThemeColors } from "@fitblock/design-tokens";
import {
  createProgressRepository,
  type AthleteProgressRecord,
  type PersonalRecordEntry,
  type SessionHistoryEntry,
  type WeeklyHistoryEntry
} from "@fitblock/backend";
import { describeBackendError } from "@/data/backend-error";
import {
  describeSessionHistoryMeta,
  describeSessionHistoryStatus,
  describeStreak,
  formatPersonalRecordDate,
  formatPersonalRecordLoad,
  formatWeekAxisLabel,
  getSessionHistoryTitle,
  getWeeklyRate,
  sortPersonalRecords
} from "@/data/progress";
import { getSizeClass, isCompactSizeClass } from "@/lib/layout";
import { getSupabaseConfigurationError, supabase } from "@/lib/supabase";
import { useAppTheme } from "@/theme/theme-provider";

type IconName = ComponentProps<typeof Ionicons>["name"];

const WEEK_CHART_HEIGHT = 96;

export function ProgressScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { width } = useWindowDimensions();
  const sizeClass = getSizeClass(width);
  const isCompact = isCompactSizeClass(sizeClass);
  const [progress, setProgress] = useState<AthleteProgressRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    setIsLoading(true);
    setErrorMessage(null);

    if (!supabase) {
      setIsLoading(false);
      setErrorMessage(getSupabaseConfigurationError() ?? "Progresso indisponível.");
      return () => {
        mounted = false;
      };
    }

    void createProgressRepository(supabase)
      .getProgress()
      .then((next) => {
        if (!mounted) return;
        setProgress(next);
      })
      .catch((error: unknown) => {
        if (!mounted) return;
        setErrorMessage(describeBackendError(error));
        setProgress(null);
      })
      .finally(() => {
        if (mounted) setIsLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const hasRecords = Boolean(progress?.personal_records.length);
  const hasHistory = Boolean(progress?.session_history.length);

  return (
    <View style={styles.page} testID="progress-screen">
      <View style={styles.pageIntro}>
        <Text style={styles.eyebrow}>SEU PROGRESSO</Text>
        <Text style={styles.pageTitle}>
          Evolução que você consegue <Text style={styles.pageTitleChip}>enxergar</Text>.
        </Text>
        <Text style={styles.pageDescription}>
          Sessões concluídas, consistência e recordes pessoais no seu histórico.
        </Text>
      </View>

      {isLoading && <StateMessage icon="sync-outline" text="Carregando seu progresso..." />}
      {!isLoading && errorMessage && <StateMessage icon="alert-circle-outline" text={errorMessage} error />}

      {!isLoading && !errorMessage && progress && (
        <>
          <SectionHeader eyebrow="Consistência" title="Sua regularidade" />
          <ConsistencyCard
            streakDays={progress.streak_days}
            weeklyHistory={isCompact ? progress.weekly_history.slice(-4) : progress.weekly_history}
          />

          <SectionHeader eyebrow="Recordes" title="Suas melhores marcas" />
          {hasRecords ? (
            <View style={styles.recordsGrid} testID="progress-records">
              {sortPersonalRecords(progress.personal_records).map((record) => (
                <PersonalRecordCard key={record.exercise_name} record={record} />
              ))}
            </View>
          ) : (
            <EmptyState icon="trophy-outline" text="Registre cargas nos seus treinos para ver recordes aqui." />
          )}

          <SectionHeader eyebrow="Histórico" title="Sessões concluídas" />
          {hasHistory ? (
            <View style={styles.historyCard} testID="progress-history">
              {progress.session_history.map((entry, index) => (
                <SessionHistoryRow key={entry.session.id} entry={entry} isFirst={index === 0} />
              ))}
            </View>
          ) : (
            <EmptyState icon="calendar-outline" text="Conclua um treino para começar seu histórico." />
          )}
        </>
      )}
    </View>
  );
}

function SectionHeader({ eyebrow, title }: { eyebrow: string; title: string }) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionEyebrow}>{eyebrow}</Text>
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );
}

function StateMessage({ icon, text, error = false }: { icon: IconName; text: string; error?: boolean }) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View
      accessibilityRole={error ? "alert" : undefined}
      style={[styles.messageCard, error && styles.messageCardError]}
      testID={error ? "progress-error" : "progress-message"}
    >
      <Ionicons name={icon} size={20} color={error ? colors.danger : colors.purple500} />
      <Text style={styles.messageText}>{text}</Text>
    </View>
  );
}

function EmptyState({ icon, text }: { icon: IconName; text: string }) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.emptyStateCard}>
      <Ionicons name={icon} size={22} color={colors.textSecondary} />
      <Text style={styles.emptyStateText}>{text}</Text>
    </View>
  );
}

function ConsistencyCard({
  streakDays,
  weeklyHistory
}: {
  streakDays: number;
  weeklyHistory: WeeklyHistoryEntry[];
}) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.consistencyCard} testID="progress-consistency">
      <View style={styles.consistencyTopline}>
        <View>
          <Text style={styles.streakValue}>{streakDays}</Text>
          <Text style={styles.streakLabel}>{describeStreak(streakDays)}</Text>
        </View>
        <Ionicons name="flame-outline" size={28} color={colors.purple400} />
      </View>
      <View style={styles.weeklyChart}>
        {weeklyHistory.map((entry) => {
          const rate = getWeeklyRate(entry);
          const fillHeight = rate > 0 ? Math.max(rate * WEEK_CHART_HEIGHT, 6) : 0;

          return (
            <View key={entry.week_start} style={styles.weeklyChartColumn}>
              <View style={styles.weeklyChartTrack}>
                <View style={[styles.weeklyChartFill, { height: fillHeight }]} />
              </View>
              <Text style={styles.weeklyChartLabel}>{formatWeekAxisLabel(entry.week_start)}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function PersonalRecordCard({ record }: { record: PersonalRecordEntry }) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.recordCard} testID="progress-record-card">
      <Text style={styles.recordExercise} numberOfLines={2}>
        {record.exercise_name}
      </Text>
      <Text style={styles.recordLoad}>{formatPersonalRecordLoad(record.load_kg)}</Text>
      <Text style={styles.recordMeta}>
        {record.reps ? `${record.reps} reps · ` : ""}
        {formatPersonalRecordDate(record.achieved_on)}
      </Text>
    </View>
  );
}

function SessionHistoryRow({ entry, isFirst }: { entry: SessionHistoryEntry; isFirst: boolean }) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const isCompleted = entry.progress.state === "completed";

  return (
    <View style={[styles.historyRow, isFirst && styles.historyRowFirst]} testID="progress-history-row">
      <View style={[styles.historyBadge, isCompleted && styles.historyBadgeDone]}>
        <Ionicons
          name={isCompleted ? "checkmark" : "remove"}
          size={16}
          color={isCompleted ? colors.white : colors.textSecondary}
        />
      </View>
      <View style={styles.historyContent}>
        <Text style={styles.historyTitle}>{getSessionHistoryTitle(entry)}</Text>
        <Text style={styles.historyMeta}>{describeSessionHistoryMeta(entry)}</Text>
      </View>
      <Text style={styles.historyStatus}>{describeSessionHistoryStatus(entry.progress)}</Text>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  page: {
    gap: spacing[8]
  },
  pageIntro: {
    minWidth: 0
  },
  eyebrow: {
    color: colors.purple400,
    fontFamily: fontFamilies.interfaceBold,
    fontSize: 11,
    letterSpacing: 1.6,
    marginBottom: spacing[2]
  },
  pageTitle: {
    color: colors.textPrimary,
    fontFamily: fontFamilies.display,
    fontSize: typeScale.displayHero,
    letterSpacing: -0.8,
    lineHeight: typeScale.displayHero * 0.92
  },
  pageTitleChip: {
    backgroundColor: colors.purple500,
    color: colors.white,
    overflow: "hidden",
    paddingHorizontal: spacing[1]
  },
  pageDescription: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.interface,
    fontSize: 15,
    marginTop: spacing[2]
  },
  messageCard: {
    alignItems: "center",
    backgroundColor: colors.surface02,
    borderRadius: radius.lg,
    flexDirection: "row",
    gap: spacing[3],
    padding: spacing[5]
  },
  messageCardError: {
    borderColor: colors.danger,
    borderWidth: 1
  },
  messageText: {
    color: colors.textSecondary,
    flex: 1,
    fontFamily: fontFamilies.interface,
    fontSize: 14
  },
  sectionHeader: {
    borderTopColor: colors.border,
    borderTopWidth: 1,
    marginBottom: spacing[4],
    paddingTop: spacing[3]
  },
  sectionEyebrow: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.interfaceBold,
    fontSize: 10,
    letterSpacing: 1.4,
    marginBottom: 5,
    textTransform: "uppercase"
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontFamily: fontFamilies.display,
    fontSize: 30,
    lineHeight: 32
  },
  emptyStateCard: {
    alignItems: "center",
    backgroundColor: colors.surface02,
    borderRadius: radius.lg,
    flexDirection: "row",
    gap: spacing[3],
    overflow: "hidden",
    padding: spacing[5],
    paddingRight: spacing[8],
    position: "relative"
  },
  emptyStateText: {
    color: colors.textSecondary,
    flex: 1,
    fontFamily: fontFamilies.interface,
    fontSize: 14
  },
  consistencyCard: {
    backgroundColor: colors.surface02,
    borderRadius: radius.xl,
    padding: spacing[6]
  },
  consistencyTopline: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  streakValue: {
    color: colors.textPrimary,
    fontFamily: fontFamilies.display,
    fontSize: 36
  },
  streakLabel: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.interfaceBold,
    fontSize: 13,
    marginTop: 2
  },
  weeklyChart: {
    flexDirection: "row",
    gap: spacing[2],
    marginTop: spacing[6]
  },
  weeklyChartColumn: {
    alignItems: "center",
    flex: 1,
    gap: spacing[2]
  },
  weeklyChartTrack: {
    backgroundColor: colors.surface04,
    borderRadius: radius.sm,
    height: WEEK_CHART_HEIGHT,
    justifyContent: "flex-end",
    overflow: "hidden",
    width: "100%"
  },
  weeklyChartFill: {
    backgroundColor: colors.purple500,
    borderRadius: radius.sm,
    width: "100%"
  },
  weeklyChartLabel: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.interfaceBold,
    fontSize: 10
  },
  recordsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing[4]
  },
  recordCard: {
    backgroundColor: colors.surface02,
    borderRadius: radius.lg,
    flexBasis: "31%",
    flexGrow: 1,
    minWidth: 160,
    padding: spacing[5]
  },
  recordExercise: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.interfaceBold,
    fontSize: 12,
    letterSpacing: 0.4,
    textTransform: "uppercase"
  },
  recordLoad: {
    color: colors.textPrimary,
    fontFamily: fontFamilies.display,
    fontSize: 26,
    marginTop: spacing[2]
  },
  recordMeta: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.interface,
    fontSize: 12,
    marginTop: spacing[2]
  },
  historyCard: {
    backgroundColor: colors.surface02,
    borderRadius: radius.xl,
    overflow: "hidden"
  },
  historyRow: {
    alignItems: "center",
    borderTopColor: colors.border,
    borderTopWidth: 1,
    flexDirection: "row",
    gap: spacing[3],
    minHeight: 64,
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[2]
  },
  historyRowFirst: {
    borderTopWidth: 0
  },
  historyBadge: {
    alignItems: "center",
    backgroundColor: colors.surface04,
    borderRadius: radius.pill,
    height: 30,
    justifyContent: "center",
    width: 30
  },
  historyBadgeDone: {
    backgroundColor: colors.success
  },
  historyContent: {
    flex: 1,
    minWidth: 0
  },
  historyTitle: {
    color: colors.textPrimary,
    fontFamily: fontFamilies.interfaceBold,
    fontSize: 15
  },
  historyMeta: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.interface,
    fontSize: 13,
    marginTop: 4
  },
  historyStatus: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.interfaceBold,
    fontSize: 12
  }
  });
}
