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
  formatBlockSets,
  formatMonthLabel,
  formatVolumes,
  getMonthRange,
  getSessionBlocks,
  getSessionStateLabel,
  getSessionTitle,
  shiftMonth
} from "@/data/calendar";
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
          <Text style={styles.pageTitle}>Seu ritmo, em visão clara.</Text>
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
                style={({ pressed }) => [
                  styles.calendarDay,
                  !day.isCurrentMonth && styles.calendarDayOutside,
                  day.isToday && styles.calendarDayToday,
                  session && styles.calendarDayWithSession,
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
          <LegendItem icon="checkmark-circle-outline" color={colors.fitblockPurple} label="Concluída" />
        </View>
      </View>

      {isLoading && <CalendarMessage icon="sync-outline" text="Buscando suas sessões publicadas..." />}
      {!isLoading && errorMessage && <CalendarMessage icon="alert-circle-outline" text={errorMessage} error />}
      {!isLoading && !errorMessage && sessions.length === 0 && (
        <CalendarMessage icon="calendar-outline" text="Nenhuma sessão publicada neste mês." />
      )}
      {!isLoading && !errorMessage && selectedSession && (
        <SessionPrescriptionCard session={selectedSession} />
      )}
    </View>
  );
}

function MonthButton({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.monthButton, pressed && styles.pressed]}
    >
      <Ionicons name={icon} size={18} color={colors.ink} />
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

function CalendarMessage({ icon, text, error = false }: { icon: IconName; text: string; error?: boolean }) {
  return (
    <View style={[styles.messageCard, error && styles.messageCardError]}>
      <Ionicons name={icon} size={20} color={error ? colors.danger : colors.fitblockPurple} />
      <Text style={styles.messageText}>{text}</Text>
    </View>
  );
}

function SessionPrescriptionCard({ session }: { session: CalendarSessionRecord }) {
  const router = useRouter();
  const [isStarting, setIsStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const blocks = getSessionBlocks(session);
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
          <Text style={styles.sessionEyebrow}>SESSÃO PRESCRITA</Text>
          <Text style={styles.sessionTitle}>{getSessionTitle(session)}</Text>
          <Text style={styles.sessionDate}>{sessionDate}</Text>
        </View>
        <View style={styles.sessionState}>
          <Ionicons name={session.state === "completed" ? "checkmark-circle-outline" : "time-outline"} size={16} color={session.state === "completed" ? colors.success : colors.fitblockPurple} />
          <Text style={styles.sessionStateText}>{getSessionStateLabel(session.state)}</Text>
        </View>
      </View>
      <View style={styles.sessionBlocks}>
        {blocks.map((block, blockIndex) => (
          <View key={block.id} style={styles.sessionBlock}>
            <View style={styles.sessionBlockIndex}>
              <Text style={styles.sessionBlockIndexText}>{String(blockIndex + 1).padStart(2, "0")}</Text>
            </View>
            <View style={styles.sessionBlockCopy}>
              <Text style={styles.sessionBlockName}>{block.name}</Text>
              {/* Modalidades de texto livre não têm exercícios: o conteúdo é a descrição do coach. */}
              {block.description !== "" && (
                <Text style={styles.blockDescription} testID={`block-description-${blockIndex}`}>
                  {block.description}
                </Text>
              )}
              {block.sets.length > 0 && (
                <View style={styles.prescriptionRow}>
                  <Text style={styles.prescriptionExercise}>Séries</Text>
                  <Text style={styles.prescriptionValue}>{formatBlockSets(block.sets)}</Text>
                </View>
              )}
              {block.volumes.length > 0 && (
                <View style={styles.prescriptionRow}>
                  <Text style={styles.prescriptionExercise}>Volume</Text>
                  <Text style={styles.prescriptionValue}>{formatVolumes(block.volumes)}</Text>
                </View>
              )}
              {block.items.map((item) => (
                <View key={item.id} style={styles.prescriptionRow}>
                  <Text style={styles.prescriptionExercise}>{item.name}</Text>
                  <Text style={styles.prescriptionValue}>{item.prescription}</Text>
                </View>
              ))}
            </View>
          </View>
        ))}
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
        style={({ pressed }) => [styles.startButton, isStarting && styles.startButtonDisabled, pressed && styles.pressed]}
      >
        <Text style={styles.startButtonText}>{isStarting ? "Abrindo..." : "Iniciar sessão"}</Text>
        <Ionicons name="arrow-forward" size={17} color={colors.canvas} />
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
  sourceDot: {
    backgroundColor: colors.success,
    borderRadius: radius.pill,
    height: 7,
    width: 7
  },
  sourceBadgeText: {
    color: colors.success,
    fontFamily: fontFamilies.interface,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1
  },
  calendarCard: {
    backgroundColor: colors.canvas,
    borderColor: colors.hairline,
    borderRadius: radius.lg,
    borderWidth: 1,
    overflow: "hidden"
  },
  calendarToolbar: {
    alignItems: "center",
    borderBottomColor: colors.hairline,
    borderBottomWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    padding: spacing[5]
  },
  calendarEyebrow: {
    color: colors.textMuted,
    fontFamily: fontFamilies.interface,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.3
  },
  monthTitle: {
    color: colors.ink,
    fontFamily: fontFamilies.interface,
    fontSize: typeScale.headingLg,
    fontWeight: "700",
    marginTop: spacing[2],
    textTransform: "capitalize"
  },
  monthActions: {
    flexDirection: "row",
    gap: spacing[2]
  },
  monthButton: {
    alignItems: "center",
    borderColor: colors.hairline,
    borderRadius: radius.sm,
    borderWidth: 1,
    height: 38,
    justifyContent: "center",
    width: 38
  },
  weekdayRow: {
    borderBottomColor: colors.hairline,
    borderBottomWidth: 1,
    flexDirection: "row",
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[3]
  },
  weekday: {
    color: colors.textMuted,
    flex: 1,
    fontFamily: fontFamilies.interface,
    fontSize: 10,
    fontWeight: "800",
    textAlign: "center"
  },
  calendarGrid: {
    flexDirection: "row",
    flexWrap: "wrap"
  },
  calendarDay: {
    borderBottomColor: colors.hairline,
    borderBottomWidth: 1,
    borderRightColor: colors.hairline,
    borderRightWidth: 1,
    height: 92,
    padding: spacing[3],
    width: "14.2857%"
  },
  calendarDayOutside: {
    backgroundColor: colors.softCloud,
    opacity: 0.6
  },
  calendarDayToday: {
    backgroundColor: "#F3EFFF"
  },
  calendarDayWithSession: {
    backgroundColor: "#F8F6FF"
  },
  dayNumber: {
    color: colors.ink,
    fontFamily: fontFamilies.interface,
    fontSize: 12,
    fontWeight: "700"
  },
  dayNumberOutside: {
    color: colors.textMuted
  },
  dayNumberToday: {
    color: colors.fitblockPurple,
    fontWeight: "700"
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
    color: colors.ink,
    fontFamily: fontFamilies.interface,
    fontSize: 10,
    fontWeight: "700"
  },
  daySessionMore: {
    color: colors.fitblockPurple,
    fontFamily: fontFamilies.interface,
    fontSize: 10,
    fontWeight: "800",
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
  sessionCard: {
    backgroundColor: colors.graphite,
    borderRadius: radius.lg,
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
  sessionEyebrow: {
    color: colors.fitblockPurpleLight,
    fontFamily: fontFamilies.interface,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.3
  },
  sessionTitle: {
    color: colors.canvas,
    fontFamily: fontFamilies.interface,
    fontSize: typeScale.headingLg,
    fontWeight: "700",
    marginTop: spacing[2]
  },
  sessionDate: {
    color: "#B7B8C5",
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
    color: colors.canvas,
    fontFamily: fontFamilies.interface,
    fontSize: 11,
    fontWeight: "700"
  },
  sessionBlocks: {
    gap: spacing[3],
    marginTop: spacing[5]
  },
  sessionBlock: {
    borderTopColor: "#34353D",
    borderTopWidth: 1,
    flexDirection: "row",
    gap: spacing[3],
    paddingTop: spacing[4]
  },
  sessionBlockIndex: {
    alignItems: "center",
    backgroundColor: colors.fitblockPurple,
    borderRadius: radius.pill,
    height: 28,
    justifyContent: "center",
    width: 28
  },
  sessionBlockIndexText: {
    color: colors.canvas,
    fontFamily: fontFamilies.interface,
    fontSize: 10,
    fontWeight: "800"
  },
  sessionBlockCopy: {
    flex: 1,
    minWidth: 0
  },
  sessionBlockName: {
    color: colors.canvas,
    fontFamily: fontFamilies.interface,
    fontSize: 13,
    fontWeight: "800"
  },
  blockDescription: {
    color: "#D9DAE2",
    fontFamily: fontFamilies.interface,
    fontSize: 13,
    lineHeight: 20,
    marginTop: spacing[2]
  },
  prescriptionRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: spacing[2]
  },
  prescriptionExercise: {
    color: "#D9DAE2",
    flex: 1,
    fontFamily: fontFamilies.interface,
    fontSize: 13
  },
  prescriptionValue: {
    color: colors.fitblockPurpleLight,
    fontFamily: fontFamilies.interface,
    fontSize: 12,
    fontWeight: "800",
    marginLeft: spacing[3],
    textAlign: "right"
  },
  startButton: {
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: colors.fitblockPurple,
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
    color: colors.canvas,
    fontFamily: fontFamilies.interface,
    fontSize: 13,
    fontWeight: "800"
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
