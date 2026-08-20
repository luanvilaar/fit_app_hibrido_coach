import { Ionicons } from "@expo/vector-icons";
import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { fontFamilies, radius, spacing, type ThemeColors } from "@fitblock/design-tokens";
import type { CalendarDay } from "@/data/calendar";
import { useAppTheme } from "@/theme/theme-provider";

const weekdayLetters = ["S", "T", "Q", "Q", "S", "S", "D"];

type WeekStripProps = {
  label: string;
  days: CalendarDay[];
  selectedDate: string;
  onSelectDate: (date: string) => void;
  onShiftWeek: (amount: number) => void;
};

/** Faixa semanal compacta: navegação por semana e atalho para qualquer dia com sessão. */
export function WeekStrip({ label, days, selectedDate, onSelectDate, onShiftWeek }: WeekStripProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.card} testID="week-strip">
      <View style={styles.toolbar}>
        <WeekNavButton icon="chevron-back" label="Semana anterior" onPress={() => onShiftWeek(-1)} />
        <Text style={styles.label}>{label}</Text>
        <WeekNavButton icon="chevron-forward" label="Próxima semana" onPress={() => onShiftWeek(1)} />
      </View>
      <View style={styles.row}>
        {days.map((day, index) => {
          const isSelected = day.date === selectedDate;

          return (
            <Pressable
              key={day.date}
              accessibilityLabel={`${weekdayLetters[index]}, dia ${day.day}${day.sessions.length > 0 ? ", com sessão" : ""}`}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              onPress={() => onSelectDate(day.date)}
              style={({ pressed }) => [styles.dayColumn, pressed && styles.pressed]}
              testID={`week-strip-day-${day.date}`}
            >
              <Text style={styles.weekdayLetter}>{weekdayLetters[index]}</Text>
              <View style={[styles.dayCircle, isSelected && styles.dayCircleSelected, !isSelected && day.isToday && styles.dayCircleToday]}>
                <Text style={[styles.dayNumber, isSelected && styles.dayNumberSelected]}>{day.day}</Text>
              </View>
              <View style={[styles.sessionDot, day.sessions.length === 0 && styles.sessionDotHidden]} />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function WeekNavButton({
  icon,
  label,
  onPress
}: {
  icon: "chevron-back" | "chevron-forward";
  label: string;
  onPress: () => void;
}) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.navButton, pressed && styles.pressed]}
    >
      <Ionicons color={colors.textSecondary} name={icon} size={16} />
    </Pressable>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  card: {
    backgroundColor: colors.surface02,
    borderRadius: radius.xl,
    paddingBottom: spacing[3],
    paddingHorizontal: spacing[3],
    paddingTop: spacing[3]
  },
  toolbar: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: spacing[1]
  },
  label: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.interfaceBold,
    fontSize: 11,
    letterSpacing: 1,
    textTransform: "uppercase"
  },
  navButton: {
    alignItems: "center",
    borderRadius: radius.pill,
    height: 44,
    justifyContent: "center",
    width: 44
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: spacing[3]
  },
  dayColumn: {
    alignItems: "center",
    flex: 1,
    gap: spacing[2],
    minHeight: 44,
    minWidth: 44
  },
  weekdayLetter: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.interfaceBold,
    fontSize: 10
  },
  dayCircle: {
    alignItems: "center",
    borderRadius: radius.pill,
    height: 34,
    justifyContent: "center",
    width: 34
  },
  dayCircleToday: {
    borderColor: colors.purple400,
    borderWidth: 1.5
  },
  dayCircleSelected: {
    backgroundColor: colors.purple500
  },
  dayNumber: {
    color: colors.textPrimary,
    fontFamily: fontFamilies.interfaceBold,
    fontSize: 13
  },
  dayNumberSelected: {
    color: colors.white
  },
  sessionDot: {
    backgroundColor: colors.purple400,
    borderRadius: radius.pill,
    height: 4,
    width: 4
  },
  sessionDotHidden: {
    opacity: 0
  },
  pressed: {
    opacity: 0.72
  }
  });
}
