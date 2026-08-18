import { Ionicons } from "@expo/vector-icons";
import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing, Pressable, StyleSheet, Text, View } from "react-native";
import type { CalendarSessionRecord, TrainingGroupRecord } from "@fitblock/backend";
import { colors, fontFamilies, radius, shadows, spacing } from "@fitblock/design-tokens";
import { createWeekGrid, formatWeekLabel, parseCalendarDate, type CalendarDay } from "@/data/calendar";
import { describeBlock, getSessionTitle, readSessionBlocks } from "@/data/coach-hibrido/session-snapshot";

const weekdayLabels = ["SEG", "TER", "QUA", "QUI", "SEX", "SÁB", "DOM"];

/** A, B, C… — mesma leitura de ordem que o coach usa ao montar a sessão. */
function orderMark(index: number): string {
  return String.fromCharCode(65 + (index % 26));
}

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

type WeekBoardProps = {
  anchor: Date;
  sessions: CalendarSessionRecord[];
  teams: TrainingGroupRecord[];
  selectedTeamId: string;
  selectedSessionId: string | null;
  copiedSessionId: string | null;
  isLoading: boolean;
  onSelectTeam: (teamId: string) => void;
  onSelectSession: (session: CalendarSessionRecord) => void;
  onCreate: (date: string) => void;
  onCopy: (session: CalendarSessionRecord) => void;
  onPaste: (date: string) => void;
  onShift: (amount: number) => void;
};

export function WeekBoard({
  anchor,
  sessions,
  teams,
  selectedTeamId,
  selectedSessionId,
  copiedSessionId,
  isLoading,
  onSelectTeam,
  onSelectSession,
  onCreate,
  onCopy,
  onPaste,
  onShift
}: WeekBoardProps) {
  const teamSessions = sessions.filter((session) => session.team_id === selectedTeamId);
  const days = createWeekGrid(anchor, teamSessions);

  return (
    <View style={styles.board} testID="week-board">
      <View style={styles.teams}>
        {teams.length === 0 && !isLoading && (
          <Text style={styles.empty}>
            Você ainda não tem equipes. Crie uma em Equipes para começar a prescrever.
          </Text>
        )}
        {teams.map((team) => (
          <TeamChip
            key={team.id}
            label={team.name}
            onPress={() => onSelectTeam(team.id)}
            selected={team.id === selectedTeamId}
            testID={`team-${team.id}`}
          />
        ))}
      </View>

      <View style={styles.weekNav}>
        <NavButton
          accessibilityLabel="Semana anterior"
          icon="chevron-back"
          onPress={() => onShift(-1)}
          testID="week-previous"
        />
        <Text style={styles.weekLabel} testID="week-label">
          {formatWeekLabel(anchor)}
        </Text>
        <NavButton
          accessibilityLabel="Próxima semana"
          icon="chevron-forward"
          onPress={() => onShift(1)}
          testID="week-next"
        />
      </View>

      {copiedSessionId && (
        <Text accessibilityRole="alert" style={styles.clipboard} testID="week-clipboard">
          Sessão copiada. Escolha o dia onde ela deve entrar.
        </Text>
      )}

      <View style={styles.days}>
        {days.map((day, index) => (
          <DayRow
            copiedSessionId={copiedSessionId}
            day={day}
            key={day.date}
            onCopy={onCopy}
            onCreate={onCreate}
            onPaste={onPaste}
            onSelectSession={onSelectSession}
            selectedSessionId={selectedSessionId}
            weekday={weekdayLabels[index]}
          />
        ))}
      </View>

      {isLoading && (
        <Text style={styles.loading} testID="week-loading">
          Carregando a semana…
        </Text>
      )}
    </View>
  );
}

function TeamChip({
  label,
  selected,
  testID,
  onPress
}: {
  label: string;
  selected: boolean;
  testID: string;
  onPress: () => void;
}) {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <Pressable
      accessibilityLabel={`Equipe ${label}`}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onBlur={() => setIsFocused(false)}
      onFocus={() => setIsFocused(true)}
      onPress={onPress}
      style={({ pressed }) => [
        styles.team,
        selected && styles.teamSelected,
        isFocused && styles.focusRing,
        pressed && styles.pressed
      ]}
      testID={testID}
    >
      <Text style={[styles.teamName, selected && styles.teamNameSelected]}>{label}</Text>
    </Pressable>
  );
}

function DayRow({
  day,
  weekday,
  selectedSessionId,
  copiedSessionId,
  onSelectSession,
  onCreate,
  onCopy,
  onPaste
}: {
  day: CalendarDay<CalendarSessionRecord>;
  weekday: string;
  selectedSessionId: string | null;
  copiedSessionId: string | null;
  onSelectSession: (session: CalendarSessionRecord) => void;
  onCreate: (date: string) => void;
  onCopy: (session: CalendarSessionRecord) => void;
  onPaste: (date: string) => void;
}) {
  const dayNumber = String(parseCalendarDate(day.date).getDate()).padStart(2, "0");
  const [hoveredSessionId, setHoveredSessionId] = useState<string | null>(null);

  return (
    <View style={[styles.day, hoveredSessionId && styles.dayElevated]} testID={`day-${day.date}`}>
      <View style={styles.dayHeader}>
        <Text style={[styles.dayName, day.isToday && styles.dayToday]}>
          {weekday} {dayNumber}
        </Text>
        <View style={styles.dayActions}>
          {copiedSessionId && (
            <NavButton
              accessibilityLabel={`Colar a sessão copiada em ${weekday} ${dayNumber}`}
              icon="clipboard-outline"
              onPress={() => onPaste(day.date)}
              testID={`paste-${day.date}`}
            />
          )}
          <NavButton
            accessibilityLabel={`Criar sessão em ${weekday} ${dayNumber}`}
            icon="add"
            onPress={() => onCreate(day.date)}
            testID={`create-${day.date}`}
          />
        </View>
      </View>

      {day.sessions.length === 0 ? (
        <Text style={styles.dayEmpty}>Sem treino</Text>
      ) : (
        day.sessions.map((session) => (
          <SessionRow
            key={session.id}
            onCopy={() => onCopy(session)}
            onHoverChange={(hovering) => setHoveredSessionId(hovering ? session.id : null)}
            onSelect={() => onSelectSession(session)}
            selected={session.id === selectedSessionId}
            session={session}
          />
        ))
      )}
    </View>
  );
}

function SessionRow({
  session,
  selected,
  onSelect,
  onCopy,
  onHoverChange
}: {
  session: CalendarSessionRecord;
  selected: boolean;
  onSelect: () => void;
  onCopy: () => void;
  onHoverChange: (hovering: boolean) => void;
}) {
  const [isFocused, setIsFocused] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isPreviewVisible, setIsPreviewVisible] = useState(false);
  const reduceMotion = useReduceMotion();
  const reveal = useRef(new Animated.Value(0)).current;
  const blocks = readSessionBlocks(session);
  const isDraft = session.status === "draft";

  useEffect(() => {
    if (isHovered) {
      setIsPreviewVisible(true);
      Animated.timing(reveal, {
        toValue: 1,
        duration: reduceMotion ? 0 : 160,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true
      }).start();
    } else {
      Animated.timing(reveal, {
        toValue: 0,
        duration: reduceMotion ? 0 : 110,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true
      }).start(({ finished }) => {
        if (finished) setIsPreviewVisible(false);
      });
    }
  }, [isHovered, reduceMotion, reveal]);

  function setHovered(hovering: boolean) {
    setIsHovered(hovering);
    onHoverChange(hovering);
  }

  return (
    <View style={[styles.sessionRowWrapper, isHovered && styles.sessionRowWrapperElevated]}>
      <View style={styles.sessionRow}>
        <Pressable
          accessibilityLabel={`Editar ${getSessionTitle(session)}`}
          accessibilityRole="button"
          accessibilityState={{ selected }}
          onBlur={() => setIsFocused(false)}
          onFocus={() => setIsFocused(true)}
          onHoverIn={() => setHovered(true)}
          onHoverOut={() => setHovered(false)}
          onPress={onSelect}
          style={({ pressed }) => [
            styles.session,
            selected && styles.sessionSelected,
            isFocused && styles.sessionFocused,
            pressed && styles.pressed
          ]}
          testID={`session-${session.id}`}
        >
          <Text numberOfLines={1} style={styles.sessionTitle}>
            {getSessionTitle(session)}
          </Text>
          <Text style={styles.sessionMeta}>
            {isDraft ? "Rascunho · " : ""}
            {blocks.length} {blocks.length === 1 ? "bloco" : "blocos"}
          </Text>
        </Pressable>
        <NavButton
          accessibilityLabel={`Copiar ${getSessionTitle(session)}`}
          icon="copy-outline"
          onPress={onCopy}
          testID={`copy-${session.id}`}
        />
      </View>

      {isPreviewVisible && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.preview,
            {
              opacity: reveal,
              transform: [{ translateY: reveal.interpolate({ inputRange: [0, 1], outputRange: [-6, 0] }) }]
            }
          ]}
          testID={`session-preview-${session.id}`}
        >
          <View style={styles.previewHeader}>
            <Text numberOfLines={1} style={styles.previewTitle}>
              {getSessionTitle(session)}
            </Text>
            <Text style={styles.previewStatus}>{isDraft ? "Rascunho" : "Publicado"}</Text>
          </View>
          {blocks.length === 0 ? (
            <Text style={styles.previewEmpty}>Sem blocos ainda.</Text>
          ) : (
            blocks.map((block, index) => (
              <View key={block.id} style={styles.previewBlock}>
                <Text style={styles.previewBlockMark}>{orderMark(index)}</Text>
                <View style={styles.previewBlockCopy}>
                  <Text style={styles.previewBlockName}>{block.name}</Text>
                  <Text numberOfLines={2} style={styles.previewBlockBody}>
                    {describeBlock(block)}
                  </Text>
                </View>
              </View>
            ))
          )}
        </Animated.View>
      )}
    </View>
  );
}

function NavButton({
  accessibilityLabel,
  icon,
  testID,
  onPress
}: {
  accessibilityLabel: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  testID: string;
  onPress: () => void;
}) {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      onBlur={() => setIsFocused(false)}
      onFocus={() => setIsFocused(true)}
      onPress={onPress}
      style={({ pressed }) => [styles.navButton, isFocused && styles.focusRing, pressed && styles.pressed]}
      testID={testID}
    >
      <Ionicons color={colors.textPrimary} name={icon} size={17} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  board: {
    backgroundColor: colors.surface01,
    borderColor: colors.border,
    borderRadius: radius.xl,
    borderWidth: 1,
    gap: spacing[4],
    padding: spacing[5]
  },
  teams: { flexDirection: "row", flexWrap: "wrap", gap: spacing[2] },
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
    fontFamily: fontFamilies.interfaceMedium,
    fontSize: 13
  },
  teamNameSelected: { color: colors.white, fontFamily: fontFamilies.interfaceBold },
  weekNav: {
    alignItems: "center",
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: spacing[2],
    paddingBottom: spacing[3]
  },
  weekLabel: {
    color: colors.textPrimary,
    flex: 1,
    fontFamily: fontFamilies.interfaceBold,
    fontSize: 14,
    textAlign: "center"
  },
  clipboard: {
    color: colors.purple500,
    fontFamily: fontFamilies.interfaceMedium,
    fontSize: 12
  },
  days: { gap: 0 },
  day: {
    borderBottomColor: colors.surface03,
    borderBottomWidth: 1,
    gap: spacing[1],
    paddingVertical: spacing[3]
  },
  dayElevated: { zIndex: 30 },
  dayHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  dayName: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.interfaceBold,
    fontSize: 12,
    letterSpacing: 0.6
  },
  dayToday: { color: colors.purple500 },
  dayActions: { flexDirection: "row" },
  dayEmpty: {
    color: colors.textMutedAccessible,
    fontFamily: fontFamilies.interface,
    fontSize: 12,
    paddingBottom: spacing[1]
  },
  sessionRowWrapper: { position: "relative" },
  sessionRowWrapperElevated: { zIndex: 10 },
  sessionRow: { alignItems: "center", flexDirection: "row", gap: spacing[1] },
  session: {
    backgroundColor: colors.surface02,
    borderColor: colors.border,
    borderRadius: radius.sm,
    borderWidth: 1,
    flex: 1,
    gap: 2,
    justifyContent: "center",
    minHeight: 48,
    paddingHorizontal: spacing[3]
  },
  sessionSelected: { backgroundColor: colors.surface03, borderColor: colors.borderPurple },
  sessionFocused: {
    borderColor: colors.purple400,
    borderWidth: 2
  },
  sessionTitle: {
    color: colors.textPrimary,
    fontFamily: fontFamilies.interfaceBold,
    fontSize: 14
  },
  sessionMeta: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.interface,
    fontSize: 12
  },
  preview: {
    ...shadows.card,
    backgroundColor: colors.surface02,
    borderColor: colors.borderPurple,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: spacing[2],
    left: 0,
    marginTop: spacing[1],
    padding: spacing[3],
    position: "absolute",
    right: 0,
    top: "100%"
  },
  previewHeader: { gap: 2 },
  previewTitle: {
    color: colors.textPrimary,
    fontFamily: fontFamilies.interfaceBold,
    fontSize: 13
  },
  previewStatus: {
    color: colors.textMutedAccessible,
    fontFamily: fontFamilies.interfaceMedium,
    fontSize: 11,
    letterSpacing: 0.4,
    textTransform: "uppercase"
  },
  previewEmpty: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.interface,
    fontSize: 12
  },
  previewBlock: { flexDirection: "row", gap: spacing[2] },
  previewBlockMark: {
    color: colors.purple400,
    fontFamily: fontFamilies.interfaceBold,
    fontSize: 12,
    width: 14
  },
  previewBlockCopy: { flex: 1, gap: 1, minWidth: 0 },
  previewBlockName: {
    color: colors.textPrimary,
    fontFamily: fontFamilies.interfaceMedium,
    fontSize: 12
  },
  previewBlockBody: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.interface,
    fontSize: 12,
    lineHeight: 17
  },
  navButton: {
    alignItems: "center",
    borderRadius: radius.pill,
    height: 44,
    justifyContent: "center",
    width: 44
  },
  focusRing: {
    borderColor: colors.purple400,
    borderWidth: 2
  },
  empty: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.interface,
    fontSize: 13,
    lineHeight: 20
  },
  loading: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.interface,
    fontSize: 13
  },
  pressed: { opacity: 0.72 }
});
