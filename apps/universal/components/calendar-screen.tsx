import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import type { ComponentProps } from "react";
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { colors, fontFamilies, radius, spacing, typeScale } from "@fitblock/design-tokens";
import { createCalendarRepository, createTodayRepository, type CalendarSessionRecord } from "@fitblock/backend";
import { describeBackendError } from "@/data/backend-error";
import {
  createCalendarGrid,
  formatMonthLabel,
  getMonthRange,
  getSessionStateLabel,
  shiftMonth
} from "@/data/calendar";
import { blockDefinition } from "@/data/coach-hibrido/blocks";
import {
  formatBlockVolume,
  formatEnduranceVolumes,
  formatProtocol,
  getSessionTitle,
  readSessionBlocks
} from "@/data/coach-hibrido/session-snapshot";
import { BlockBodyText } from "@/components/coach-hibrido/block-body-text";
import { getSupabaseConfigurationError, supabase } from "@/lib/supabase";

type IconName = ComponentProps<typeof Ionicons>["name"];

const weekdays = ["SEG", "TER", "QUA", "QUI", "SEX", "SÁB", "DOM"];

export function CalendarScreen() {
  const { width } = useWindowDimensions();
  const isCompact = width < 900;
  const [month, setMonth] = useState(() => new Date());
  const [sessions, setSessions] = useState<CalendarSessionRecord[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [focusedDay, setFocusedDay] = useState<string | null>(null);
  const range = useMemo(() => getMonthRange(month), [month]);
  const calendarDays = useMemo(() => createCalendarGrid(month, sessions), [month, sessions]);
  const selectedSession = sessions.find((session) => session.id === selectedSessionId) ?? sessions[0];

  useEffect(() => {
    let mounted = true;
    setIsLoading(true);
    setErrorMessage(null);
    setSelectedSessionId(null);

    if (!supabase) {
      setIsLoading(false);
      setErrorMessage(getSupabaseConfigurationError() ?? "Calendário indisponível.");
      return () => {
        mounted = false;
      };
    }

    const repository = createCalendarRepository(supabase);
    void repository.listPublishedSessions(range)
      .then((nextSessions) => {
        if (!mounted) return;
        setSessions(nextSessions);
      })
      .catch((error: unknown) => {
        if (!mounted) return;
        setErrorMessage(error instanceof Error ? error.message : "Não foi possível carregar o calendário.");
        setSessions([]);
      })
      .finally(() => {
        if (mounted) setIsLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [range]);

  return (
    <View style={styles.page} testID="calendar-screen">
      <View style={[styles.pageIntro, isCompact && styles.pageIntroCompact]}>
        <View style={styles.pageIntroCopy}>
          <Text style={styles.eyebrow}>CALENDÁRIO DO ATLETA</Text>
          <Text style={styles.pageTitle}>
            Seu ritmo, em visão <Text style={styles.pageTitleChip}>clara</Text>.
          </Text>
          <Text style={styles.pageDescription}>
            Sessões publicadas, prescrições e o próximo passo da sua jornada em um só lugar.
          </Text>
        </View>
        <View style={styles.sourceBadge}>
          <View style={styles.sourceDot} />
          <Text style={styles.sourceBadgeText}>SINCRONIZADO</Text>
        </View>
      </View>

      <View style={styles.calendarCard}>
        <View style={styles.calendarToolbar}>
          <View>
            <Text style={styles.calendarEyebrow}>VISÃO MENSAL</Text>
            <Text style={styles.monthTitle}>{formatMonthLabel(month)}</Text>
          </View>
          <View style={styles.monthActions}>
            <MonthButton
              icon="chevron-back"
              label="Mês anterior"
              onPress={() => setMonth((current) => shiftMonth(current, -1))}
            />
            <MonthButton
              icon="chevron-forward"
              label="Próximo mês"
              onPress={() => setMonth((current) => shiftMonth(current, 1))}
            />
          </View>
        </View>

        <View style={styles.weekdayRow}>
          {weekdays.map((weekday) => (
            <Text key={weekday} style={styles.weekday}>
              {weekday}
            </Text>
          ))}
        </View>
        <View style={styles.calendarGrid}>
          {calendarDays.map((day) => {
            const session = day.sessions[0];
            return (
              <Pressable
                key={day.date}
                accessibilityRole={session ? "button" : undefined}
                accessibilityLabel={session ? `${day.day}, ${getSessionTitle(session)}` : `${day.day}`}
                disabled={!session}
                onPress={() => session && setSelectedSessionId(session.id)}
                onFocus={() => setFocusedDay(day.date)}
                onBlur={() => setFocusedDay(null)}
                style={({ pressed }) => [
                  styles.calendarDay,
                  !day.isCurrentMonth && styles.calendarDayOutside,
                  day.isToday && styles.calendarDayToday,
                  session && styles.calendarDayWithSession,
                  focusedDay === day.date && styles.focusedControl,
                  pressed && styles.pressed
                ]}
              >
                <Text style={[styles.dayNumber, !day.isCurrentMonth && styles.dayNumberOutside, day.isToday && styles.dayNumberToday]}>
                  {day.day}
                </Text>
                {session && (
                  <View style={styles.daySessionMark}>
                    <View style={styles.daySessionDot} />
                    <Text numberOfLines={1} style={styles.daySessionTitle}>
                      {getSessionTitle(session)}
                    </Text>
                    {day.sessions.length > 1 && (
                      <Text style={styles.daySessionMore}>+{day.sessions.length - 1}</Text>
                    )}
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>

        <View style={styles.calendarLegend}>
          <LegendItem icon="ellipse" color={colors.success} label="Disponível" />
          <LegendItem icon="play-circle-outline" color={colors.warning} label="Em andamento" />
          <LegendItem icon="checkmark-circle-outline" color={colors.success} label="Concluída" />
        </View>
      </View>

      {isLoading && <CalendarMessage icon="sync-outline" text="Buscando suas sessões publicadas..." />}
      {!isLoading && errorMessage && <CalendarMessage icon="alert-circle-outline" text={errorMessage} error />}
      {!isLoading && !errorMessage && sessions.length === 0 && (
        <CalendarMessage icon="calendar-outline" text="Nenhuma sessão publicada neste mês." empty />
      )}
      {!isLoading && !errorMessage && selectedSession && (
        <SessionPrescriptionCard session={selectedSession} />
      )}
    </View>
  );
}

function MonthButton({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
      style={({ pressed }) => [styles.monthButton, isFocused && styles.focusedControl, pressed && styles.pressed]}
    >
      <Ionicons name={icon} size={18} color={colors.textPrimary} />
    </Pressable>
  );
}

function LegendItem({ icon, color, label }: { icon: IconName; color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <Ionicons name={icon} size={13} color={color} />
      <Text style={styles.legendLabel}>{label}</Text>
    </View>
  );
}

function CalendarMessage({ icon, text, error = false, empty = false }: { icon: IconName; text: string; error?: boolean; empty?: boolean }) {
  return (
    <View style={[styles.messageCard, error && styles.messageCardError, empty && styles.messageCardEmpty]}>
      <Ionicons name={icon} size={20} color={error ? colors.danger : colors.purple500} />
      <Text style={styles.messageText}>{text}</Text>
    </View>
  );
}

function SessionPrescriptionCard({ session }: { session: CalendarSessionRecord }) {
  const router = useRouter();
  const [isStarting, setIsStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [isStartFocused, setIsStartFocused] = useState(false);
  const blocks = readSessionBlocks(session);
  const sessionDate = new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long"
  }).format(new Date(`${session.scheduled_date}T12:00:00`));

  async function handleStart() {
    if (isStarting) return;

    setStartError(null);

    if (!supabase) {
      router.push(`/app/treino?sessionId=${session.id}`);
      return;
    }

    setIsStarting(true);

    try {
      await createTodayRepository(supabase).startSession(session.id);
      router.push(`/app/treino?sessionId=${session.id}`);
    } catch (error: unknown) {
      setStartError(describeBackendError(error));
    } finally {
      setIsStarting(false);
    }
  }

  return (
    <View style={styles.sessionCard} testID="calendar-session-prescription">
      <View style={styles.sessionCardHeader}>
        <View style={styles.sessionCardCopy}>
          <Text style={styles.sessionTitle}>{getSessionTitle(session)}</Text>
          <Text style={styles.sessionDate}>{sessionDate}</Text>
        </View>
        <View style={styles.sessionState}>
          <Ionicons name={session.state === "completed" ? "checkmark-circle-outline" : "time-outline"} size={16} color={session.state === "completed" ? colors.success : colors.purple500} />
          <Text style={styles.sessionStateText}>{getSessionStateLabel(session.state)}</Text>
        </View>
      </View>
      <View style={styles.sessionBlocks}>
        {blocks.map((block, blockIndex) => {
          const meta = [
            formatProtocol(block.protocol),
            formatEnduranceVolumes(block.enduranceVolumes),
            formatBlockVolume(block.volume)
          ]
            .filter(Boolean)
            .join("  ·  ");

          return (
            <View key={block.id} style={styles.sessionBlock}>
              <View style={styles.sessionBlockIndex}>
                <Text style={styles.sessionBlockIndexText}>
                  {String.fromCharCode(65 + (blockIndex % 26))}
                </Text>
              </View>
              <View style={styles.sessionBlockCopy}>
                <Text style={styles.sessionBlockName}>{block.name}</Text>
                <Text style={styles.sessionBlockKind}>{blockDefinition(block.kind).label}</Text>
                {meta.length > 0 && (
                  <Text style={styles.sessionBlockMeta} testID={`block-meta-${blockIndex}`}>
                    {meta}
                  </Text>
                )}
                <BlockBodyText
                  body={block.body}
                  movements={block.movements}
                  testID={`block-body-${blockIndex}`}
                  tone="dark"
                />
              </View>
            </View>
          );
        })}
      </View>
      {startError && (
        <Text accessibilityRole="alert" style={styles.startErrorText} testID="calendar-start-error">
          {startError}
        </Text>
      )}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Iniciar sessão prescrita"
        accessibilityState={{ disabled: isStarting }}
        disabled={isStarting}
        testID="calendar-start-session"
        onPress={() => void handleStart()}
        onFocus={() => setIsStartFocused(true)}
        onBlur={() => setIsStartFocused(false)}
        style={({ pressed }) => [
          styles.startButton,
          isStarting && styles.startButtonDisabled,
          isStartFocused && styles.focusedControl,
          pressed && styles.pressed
        ]}
      >
        <Text style={styles.startButtonText}>{isStarting ? "Abrindo..." : "Iniciar sessão"}</Text>
        <Ionicons name="arrow-forward" size={17} color={colors.white} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    gap: spacing[6]
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
    lineHeight: 22,
    marginTop: spacing[2],
    maxWidth: 620
  },
  sourceBadge: {
    alignItems: "center",
    backgroundColor: colors.bgDeep,
    borderColor: colors.success,
    borderRadius: radius.pill,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing[2],
    minHeight: 34,
    paddingHorizontal: spacing[3]
  },
  sourceDot: {
    backgroundColor: colors.success,
    borderRadius: radius.pill,
    height: 7,
    width: 7
  },
  sourceBadgeText: {
    color: colors.success,
    fontFamily: fontFamilies.interfaceBold,
    fontSize: 10,
    letterSpacing: 1
  },
  calendarCard: {
    backgroundColor: colors.surface02,
    borderRadius: radius.xxl,
    overflow: "hidden"
  },
  calendarToolbar: {
    alignItems: "center",
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    padding: spacing[5]
  },
  calendarEyebrow: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.interfaceBold,
    fontSize: 10,
    letterSpacing: 1.3
  },
  monthTitle: {
    color: colors.textPrimary,
    fontFamily: fontFamilies.display,
    fontSize: 32,
    lineHeight: 33,
    marginTop: spacing[2],
    textTransform: "capitalize"
  },
  monthActions: {
    flexDirection: "row",
    gap: spacing[2]
  },
  monthButton: {
    alignItems: "center",
    backgroundColor: colors.surface03,
    borderRadius: radius.md,
    height: 44,
    justifyContent: "center",
    width: 44
  },
  focusedControl: {
    borderColor: colors.purple400,
    borderWidth: 2
  },
  focusedControlOnColor: {
    borderColor: colors.white,
    borderWidth: 2
  },
  weekdayRow: {
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: "row",
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[3]
  },
  weekday: {
    color: colors.textSecondary,
    flex: 1,
    fontFamily: fontFamilies.interfaceBold,
    fontSize: 10,
    textAlign: "center"
  },
  calendarGrid: {
    flexDirection: "row",
    flexWrap: "wrap"
  },
  calendarDay: {
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    borderRightColor: colors.border,
    borderRightWidth: 1,
    height: 92,
    padding: spacing[3],
    width: "14.2857%"
  },
  calendarDayOutside: {
    backgroundColor: colors.surface01,
    opacity: 0.5
  },
  calendarDayToday: {
    backgroundColor: colors.purple700
  },
  calendarDayWithSession: {
    backgroundColor: colors.surface03
  },
  dayNumber: {
    color: colors.textPrimary,
    fontFamily: fontFamilies.interfaceBold,
    fontSize: 12
  },
  dayNumberOutside: {
    color: colors.textSecondary
  },
  dayNumberToday: {
    color: colors.white
  },
  daySessionMark: {
    marginTop: spacing[2]
  },
  daySessionDot: {
    backgroundColor: colors.success,
    borderRadius: radius.pill,
    height: 6,
    marginBottom: spacing[2],
    width: 6
  },
  daySessionTitle: {
    color: colors.textPrimary,
    fontFamily: fontFamilies.interfaceBold,
    fontSize: 10
  },
  daySessionMore: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.interfaceBold,
    fontSize: 10,
    marginTop: 2
  },
  calendarLegend: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing[4],
    padding: spacing[4]
  },
  legendItem: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[2]
  },
  legendLabel: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.interface,
    fontSize: 11
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
  messageCardEmpty: {
    overflow: "hidden",
    paddingRight: spacing[8],
    position: "relative"
  },
  messageText: {
    color: colors.textSecondary,
    flex: 1,
    fontFamily: fontFamilies.interface,
    fontSize: 14
  },
  sessionCard: {
    backgroundColor: colors.surface02,
    borderColor: colors.borderPurple,
    borderWidth: 1,
    borderRadius: radius.xxl,
    overflow: "hidden",
    padding: spacing[5]
  },
  sessionCardHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  sessionCardCopy: {
    flex: 1,
    minWidth: 0
  },
  sessionTitle: {
    color: colors.textPrimary,
    fontFamily: fontFamilies.display,
    fontSize: 32,
    lineHeight: 33
  },
  sessionDate: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.interface,
    fontSize: 13,
    marginTop: spacing[2],
    textTransform: "capitalize"
  },
  sessionState: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[2],
    marginLeft: spacing[3]
  },
  sessionStateText: {
    color: colors.textPrimary,
    fontFamily: fontFamilies.interfaceBold,
    fontSize: 11
  },
  sessionBlocks: {
    gap: spacing[3],
    marginTop: spacing[5]
  },
  sessionBlock: {
    borderTopColor: colors.border,
    borderTopWidth: 1,
    flexDirection: "row",
    gap: spacing[3],
    paddingTop: spacing[4]
  },
  sessionBlockIndex: {
    alignItems: "center",
    backgroundColor: colors.surface04,
    borderRadius: radius.sm,
    height: 28,
    justifyContent: "center",
    width: 28
  },
  sessionBlockIndexText: {
    color: colors.textPrimary,
    fontFamily: fontFamilies.interfaceBold,
    fontSize: 13
  },
  sessionBlockCopy: {
    flex: 1,
    gap: spacing[1],
    minWidth: 0
  },
  sessionBlockName: {
    color: colors.textPrimary,
    fontFamily: fontFamilies.interfaceBold,
    fontSize: 15
  },
  sessionBlockKind: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.interface,
    fontSize: 12
  },
  sessionBlockMeta: {
    color: colors.purple400,
    fontFamily: fontFamilies.interfaceSemiBold,
    fontSize: 12
  },
  startButton: {
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: colors.purple500,
    borderRadius: radius.pill,
    flexDirection: "row",
    gap: spacing[4],
    justifyContent: "space-between",
    marginTop: spacing[5],
    minHeight: 48,
    paddingHorizontal: spacing[5]
  },
  startButtonDisabled: {
    opacity: 0.6
  },
  startButtonText: {
    color: colors.white,
    fontFamily: fontFamilies.interfaceBold,
    fontSize: 13
  },
  startErrorText: {
    color: colors.danger,
    fontFamily: fontFamilies.interface,
    fontSize: 12,
    marginTop: spacing[3]
  },
  pressed: {
    opacity: 0.72
  }
});
