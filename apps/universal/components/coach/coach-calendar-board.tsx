import { Ionicons } from "@expo/vector-icons";
import { useMemo, useState } from "react";
import type { ComponentProps } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, fontFamilies, radius, spacing, typeScale } from "@fitblock/design-tokens";
import type { CalendarSessionRecord } from "@fitblock/backend";
import { blockKindLabels, blockKinds, getSessionBlockKinds, type BlockKind } from "@/data/coach-calendar";
import { createWeekGrid, formatWeekLabel, getSessionTitle } from "@/data/calendar";

type IconName = ComponentProps<typeof Ionicons>["name"];

type CoachCalendarBoardProps = {
  anchor: Date;
  sessions: CalendarSessionRecord[];
  selectedSessionId: string | null;
  isLoading: boolean;
  onSelectSession: (session: CalendarSessionRecord) => void;
  onShiftPeriod: (amount: number) => void;
};

const weekdays = ["SEG", "TER", "QUA", "QUI", "SEX", "SÁB", "DOM"];

export function CoachCalendarBoard({
  anchor,
  sessions,
  selectedSessionId,
  isLoading,
  onSelectSession,
  onShiftPeriod
}: CoachCalendarBoardProps) {
  const [activeKinds, setActiveKinds] = useState<Set<BlockKind>>(() => new Set());

  function toggleKind(kind: BlockKind) {
    setActiveKinds((current) => {
      const next = new Set(current);
      if (next.has(kind)) {
        next.delete(kind);
      } else {
        next.add(kind);
      }
      return next;
    });
  }

  // Sem categoria ativa, o filtro não restringe nada — equivale a "Todas".
  const filteredSessions = useMemo(() => {
    if (activeKinds.size === 0) return sessions;
    return sessions.filter((session) => getSessionBlockKinds(session).some((kind) => activeKinds.has(kind)));
  }, [sessions, activeKinds]);
  const calendarDays = useMemo(() => createWeekGrid(anchor, filteredSessions), [anchor, filteredSessions]);
  const periodLabel = formatWeekLabel(anchor);

  return (
    <View style={styles.column}>
      <View style={styles.calendarCard}>
        <View style={styles.calendarToolbar}>
          <View>
            <Text style={styles.cardEyebrow}>VISÃO DO COACH</Text>
            <Text style={styles.monthTitle}>{periodLabel}</Text>
          </View>
          <View style={styles.monthActions}>
            <PeriodButton
              icon="chevron-back"
              label="Semana anterior"
              onPress={() => onShiftPeriod(-1)}
              testID="previous-week"
            />
            <PeriodButton
              icon="chevron-forward"
              label="Próxima semana"
              onPress={() => onShiftPeriod(1)}
              testID="next-week"
            />
          </View>
        </View>

        <View style={styles.kindFilterRow} accessibilityRole="radiogroup" accessibilityLabel="Filtrar treinos por categoria do bloco">
          <FilterChip
            label="Todas"
            isActive={activeKinds.size === 0}
            testID="calendar-filter-all"
            accessibilityLabel="Mostrar treinos de todas as categorias"
            onPress={() => setActiveKinds(new Set())}
          />
          {blockKinds.map((kind) => (
            <FilterChip
              key={kind}
              label={blockKindLabels[kind]}
              isActive={activeKinds.has(kind)}
              testID={`calendar-filter-kind-${kind}`}
              accessibilityLabel={`Filtrar treinos de ${blockKindLabels[kind]}`}
              onPress={() => toggleKind(kind)}
            />
          ))}
        </View>

        <View style={styles.weekdayRow}>
          {weekdays.map((weekday) => (
            <Text key={weekday} style={styles.weekday}>{weekday}</Text>
          ))}
        </View>

        <View style={styles.calendarGrid}>
          {calendarDays.map((day) => (
            <View key={day.date} style={[styles.calendarDay, day.isToday && styles.calendarDayToday]}>
              <Text style={[styles.dayNumber, day.isToday && styles.dayNumberToday]}>{day.day}</Text>
              {day.sessions.map((session) => (
                <Pressable
                  key={session.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Abrir ${getSessionTitle(session)} em ${session.scheduled_date}`}
                  accessibilityState={{ selected: session.id === selectedSessionId }}
                  testID={`calendar-session-${session.id}`}
                  onPress={() => onSelectSession(session)}
                  style={({ pressed }) => [
                    styles.daySessionMark,
                    session.id === selectedSessionId && styles.daySessionMarkSelected,
                    pressed && styles.pressed
                  ]}
                >
                  <View style={styles.daySessionMarkHeader}>
                    <View
                      style={[
                        styles.daySessionDot,
                        session.status === "draft" && styles.daySessionDotDraft
                      ]}
                    />
                    <Text style={styles.daySessionStatus}>
                      {session.status === "draft" ? "Rascunho" : "Publicado"}
                    </Text>
                  </View>
                  <Text numberOfLines={4} style={styles.daySessionTitle}>
                    {getSessionTitle(session)}
                  </Text>
                </Pressable>
              ))}
            </View>
          ))}
        </View>
      </View>

      <View style={styles.upcomingCard}>
        <Text style={styles.cardEyebrow}>SESSÕES DO PERÍODO</Text>
        {isLoading && <Text style={styles.emptyText}>Carregando sessões...</Text>}
        {!isLoading && filteredSessions.length === 0 && (
          <Text style={styles.emptyText}>
            {activeKinds.size > 0
              ? "Nenhuma sessão encontrada com essas categorias nesta semana."
              : "Nenhuma sessão encontrada nesta semana."}
          </Text>
        )}
        {filteredSessions.map((session) => {
          const isPublished = session.status === "published";

          return (
            <Pressable
              key={session.id}
              accessibilityRole="button"
              accessibilityLabel={`Editar ${getSessionTitle(session)}`}
              accessibilityState={{ selected: session.id === selectedSessionId }}
              testID={`session-list-${session.id}`}
              onPress={() => onSelectSession(session)}
              style={({ pressed }) => [
                styles.sessionListItem,
                session.id === selectedSessionId && styles.sessionListItemSelected,
                pressed && styles.pressed
              ]}
            >
              <View style={styles.sessionListDate}>
                <Text style={styles.sessionListDay}>{session.scheduled_date.slice(8, 10)}</Text>
                <Text style={styles.sessionListMonth}>{session.scheduled_date.slice(5, 7)}</Text>
              </View>
              <View style={styles.sessionListCopy}>
                <Text style={styles.sessionListTitle}>{getSessionTitle(session)}</Text>
                <Text style={styles.sessionListMeta}>{isPublished ? "Publicado" : "Rascunho"}</Text>
              </View>
              <Ionicons
                name={isPublished ? "checkmark-circle-outline" : "ellipse-outline"}
                size={18}
                color={isPublished ? colors.success : colors.warning}
              />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function PeriodButton({
  icon,
  label,
  testID,
  onPress
}: {
  icon: IconName;
  label: string;
  testID: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      testID={testID}
      onPress={onPress}
      style={({ pressed }) => [styles.monthButton, pressed && styles.pressed]}
    >
      <Ionicons name={icon} size={18} color={colors.ink} />
    </Pressable>
  );
}

function FilterChip({
  label,
  isActive,
  testID,
  accessibilityLabel,
  onPress
}: {
  label: string;
  isActive: boolean;
  testID: string;
  accessibilityLabel: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected: isActive }}
      testID={testID}
      onPress={onPress}
      style={({ pressed }) => [
        styles.filterChip,
        isActive && styles.filterChipActive,
        pressed && styles.pressed
      ]}
    >
      <Text style={[styles.filterChipText, isActive && styles.filterChipTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  column: { flex: 1.15, gap: spacing[5], minWidth: 0 },
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
  cardEyebrow: {
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
  monthActions: { flexDirection: "row", gap: spacing[2] },
  monthButton: {
    alignItems: "center",
    borderColor: colors.hairline,
    borderRadius: radius.sm,
    borderWidth: 1,
    height: 44,
    justifyContent: "center",
    width: 44
  },
  kindFilterRow: {
    borderBottomColor: colors.hairline,
    borderBottomWidth: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing[2],
    paddingBottom: spacing[4],
    paddingHorizontal: spacing[5]
  },
  filterChip: {
    alignItems: "center",
    borderColor: colors.hairline,
    borderRadius: radius.pill,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 32,
    paddingHorizontal: spacing[4]
  },
  filterChipActive: { backgroundColor: colors.fitblockPurple, borderColor: colors.fitblockPurple },
  filterChipText: { color: colors.textSecondary, fontFamily: fontFamilies.interface, fontSize: 12, fontWeight: "700" },
  filterChipTextActive: { color: colors.canvas },
  weekdayRow: {
    borderBottomColor: colors.hairline,
    borderBottomWidth: 1,
    flexDirection: "row",
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[3]
  },
  weekday: {
    color: colors.textMuted,
    flex: 1,
    fontFamily: fontFamilies.interface,
    fontSize: 9,
    fontWeight: "800",
    textAlign: "center"
  },
  calendarGrid: { flexDirection: "row", flexWrap: "wrap" },
  calendarDay: {
    borderBottomColor: colors.hairline,
    borderBottomWidth: 1,
    borderRightColor: colors.hairline,
    borderRightWidth: 1,
    minHeight: 224,
    padding: spacing[3],
    width: "14.2857%"
  },
  calendarDayToday: { backgroundColor: "#F3EFFF" },
  dayNumber: { color: colors.ink, fontFamily: fontFamilies.interface, fontSize: 11, fontWeight: "800" },
  dayNumberToday: { color: colors.fitblockPurple, fontWeight: "700" },
  daySessionMark: {
    backgroundColor: colors.softCloud,
    borderColor: colors.hairline,
    borderRadius: radius.xs,
    borderWidth: 1,
    marginTop: spacing[2],
    padding: spacing[2]
  },
  daySessionMarkSelected: { backgroundColor: "#EDE5FF" },
  daySessionMarkHeader: { alignItems: "center", flexDirection: "row", gap: spacing[1], marginBottom: 3 },
  daySessionDot: {
    backgroundColor: colors.success,
    borderRadius: radius.pill,
    height: 5,
    width: 5
  },
  daySessionDotDraft: { backgroundColor: colors.warning },
  daySessionStatus: {
    color: colors.textMuted,
    fontFamily: fontFamilies.interface,
    fontSize: 8,
    fontWeight: "800",
    letterSpacing: 0.4,
    textTransform: "uppercase"
  },
  daySessionTitle: { color: colors.ink, fontFamily: fontFamilies.interface, fontSize: 9, fontWeight: "700" },
  upcomingCard: { backgroundColor: colors.graphite, borderRadius: radius.lg, padding: spacing[5] },
  emptyText: { color: "#B7B8C5", fontFamily: fontFamilies.interface, fontSize: 13, marginTop: spacing[3] },
  sessionListItem: {
    alignItems: "center",
    borderTopColor: "#34353D",
    borderTopWidth: 1,
    flexDirection: "row",
    gap: spacing[3],
    marginTop: spacing[3],
    minHeight: 60,
    paddingTop: spacing[3]
  },
  sessionListItemSelected: { borderTopColor: colors.fitblockPurple },
  sessionListDate: {
    alignItems: "center",
    backgroundColor: colors.fitblockPurple,
    borderRadius: radius.sm,
    justifyContent: "center",
    minHeight: 44,
    width: 44
  },
  sessionListDay: { color: colors.canvas, fontFamily: fontFamilies.interface, fontSize: 18, fontWeight: "700" },
  sessionListMonth: { color: colors.fitblockPurpleLight, fontFamily: fontFamilies.interface, fontSize: 9, fontWeight: "800" },
  sessionListCopy: { flex: 1, minWidth: 0 },
  sessionListTitle: { color: colors.canvas, fontFamily: fontFamilies.interface, fontSize: 13, fontWeight: "800" },
  sessionListMeta: { color: "#B7B8C5", fontFamily: fontFamilies.interface, fontSize: 11, marginTop: 3 },
  pressed: { opacity: 0.72 }
});
