import { Ionicons } from "@expo/vector-icons";
import { useMemo } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions
} from "react-native";
import type { SessionTemplateSummary, StoreProgramScheduleDay } from "@fitblock/backend";
import { colors, fontFamilies, radius, spacing } from "@fitblock/design-tokens";
import {
  describeProgramDayType,
  programDayTypes,
  type ProgramDayType
} from "@/data/program-builder";

type ProgramWeekGridProps = {
  days: StoreProgramScheduleDay[];
  templates: SessionTemplateSummary[];
  onChange: (days: StoreProgramScheduleDay[]) => void;
  onOpenDayComposer: (dayIndex: number, weekNumber: number, dayNumber: number) => void;
  readOnly?: boolean;
};

const DAY_LABELS = ["DIA 1", "DIA 2", "DIA 3", "DIA 4", "DIA 5", "DIA 6", "DIA 7"];

export function ProgramWeekGrid({
  days,
  templates,
  onChange,
  onOpenDayComposer,
  readOnly = false
}: ProgramWeekGridProps) {
  const { width } = useWindowDimensions();
  const isNarrow = width < 860;

  function updateDay(index: number, patch: Partial<StoreProgramScheduleDay>) {
    onChange(days.map((day, dayIndex) => (dayIndex === index ? { ...day, ...patch } : day)));
  }

  function setDayType(index: number, dayType: ProgramDayType) {
    const day = days[index];
    if (!day) return;
    const selectedTemplate = templates.find((t) => t.id === day.session_template_id) ?? templates[0];
    updateDay(index, {
      day_type: dayType,
      session_template_id: dayType === "training" ? selectedTemplate?.id ?? null : null,
      session_title: dayType === "training" ? day.session_title ?? selectedTemplate?.title ?? null : null
    });
  }

  const weeks = useMemo(() => {
    return days.reduce<Array<{ weekNumber: number; days: Array<{ day: StoreProgramScheduleDay; index: number }> }>>(
      (result, day, index) => {
        const current = result[result.length - 1];
        if (!current || current.weekNumber !== day.week_number) {
          result.push({ weekNumber: day.week_number, days: [{ day, index }] });
        } else {
          current.days.push({ day, index });
        }
        return result;
      },
      []
    );
  }, [days]);

  if (days.length === 0) {
    return (
      <View style={styles.emptyContainer} testID="program-week-grid-empty">
        <Ionicons color={colors.textSecondary} name="calendar-outline" size={28} />
        <Text style={styles.emptyTitle}>GRADE DE TREINOS</Text>
        <Text style={styles.emptySubtitle}>
          Defina a duração em semanas acima para visualizar e montar o calendário de treino.
        </Text>
      </View>
    );
  }

  const content = (
    <View style={[styles.gridContainer, isNarrow && styles.gridContainerScrollable]} testID="program-week-grid">
      {/* Header das 7 Colunas: Dia 1 ao Dia 7 */}
      <View style={styles.headerRow}>
        <View style={styles.weekLabelColumnHeader}>
          <Text style={styles.headerWeekLabel}>SEMANA</Text>
        </View>
        <View style={styles.daysHeaderRow}>
          {DAY_LABELS.map((label, i) => (
            <View key={label} style={styles.dayHeaderCell} testID={`grid-header-day-${i + 1}`}>
              <Text style={styles.dayHeaderText}>{label}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Linhas das Semanas */}
      {weeks.map((week) => (
        <View key={`week-${week.weekNumber}`} style={styles.weekRow} testID={`grid-week-${week.weekNumber}`}>
          <View style={styles.weekLabelCell}>
            <Text style={styles.weekBadgeText}>S{week.weekNumber}</Text>
          </View>
          <View style={styles.weekCellsRow}>
            {week.days.map(({ day, index }) => (
              <GridDayCell
                key={`${day.week_number}-${day.day_number}`}
                day={day}
                readOnly={readOnly}
                onChangeDayType={(type) => setDayType(index, type)}
                onOpenComposer={() => onOpenDayComposer(index, day.week_number, day.day_number)}
              />
            ))}
          </View>
        </View>
      ))}
    </View>
  );

  return (
    <View style={styles.wrapper}>
      <View style={styles.headingRow}>
        <View>
          <Text style={styles.sectionTitle}>CALENDÁRIO DO PROGRAMA</Text>
          <Text style={styles.sectionSubtitle}>
            Toque em um dia para montar o treino · use os seletores de tipo abaixo de cada célula
          </Text>
        </View>
      </View>

      {isNarrow ? (
        <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={styles.scrollContent}>
          {content}
        </ScrollView>
      ) : (
        content
      )}
    </View>
  );
}

function GridDayCell({
  day,
  readOnly,
  onOpenComposer,
  onChangeDayType
}: {
  day: StoreProgramScheduleDay;
  readOnly: boolean;
  onOpenComposer: () => void;
  onChangeDayType: (type: ProgramDayType) => void;
}) {
  const isTraining = day.day_type === "training";
  const isRest = day.day_type === "rest";
  const isRecovery = day.day_type === "recovery";
  const isAssessment = day.day_type === "assessment";
  const isUnprogrammed = day.day_type === "unprogrammed";

  return (
    <View
      style={[
        styles.dayCell,
        isTraining && styles.dayCellTraining,
        isRest && styles.dayCellRest,
        isRecovery && styles.dayCellRecovery,
        isAssessment && styles.dayCellAssessment,
        isUnprogrammed && styles.dayCellUnprogrammed
      ]}
      testID={`grid-cell-${day.week_number}-${day.day_number}`}
    >
      <Pressable
        accessibilityLabel={`Semana ${day.week_number} Dia ${day.day_number}: ${describeProgramDayType(day.day_type)}`}
        accessibilityRole="button"
        disabled={readOnly}
        onPress={onOpenComposer}
        style={({ pressed }) => [styles.cellCard, pressed && styles.cellCardPressed]}
      >
        <View style={styles.cellTop}>
          <View
            style={[
              styles.typeBadge,
              isTraining && styles.typeBadgeTraining,
              isRest && styles.typeBadgeRest,
              isRecovery && styles.typeBadgeRecovery,
              isAssessment && styles.typeBadgeAssessment,
              isUnprogrammed && styles.typeBadgeUnprogrammed
            ]}
          >
            <Text
              numberOfLines={1}
              style={[
                styles.typeBadgeText,
                isTraining && styles.typeBadgeTextTraining,
                isRest && styles.typeBadgeTextRest,
                isRecovery && styles.typeBadgeTextRecovery,
                isAssessment && styles.typeBadgeTextAssessment,
                isUnprogrammed && styles.typeBadgeTextUnprogrammed
              ]}
            >
              {describeProgramDayType(day.day_type)}
            </Text>
          </View>
        </View>

        <View style={styles.cellBody}>
          {isTraining ? (
            <View style={styles.trainingInfo}>
              <Text numberOfLines={2} style={styles.sessionTitle}>
                {day.session_title || "Treino configurado"}
              </Text>
              <View style={styles.editActionRow}>
                <Ionicons color={colors.purple400} name="construct-outline" size={13} />
                <Text style={styles.editActionText}>Editar treino</Text>
              </View>
            </View>
          ) : isUnprogrammed ? (
            <View style={styles.unprogrammedPlaceholder}>
              <Ionicons color={colors.purple400} name="add-circle-outline" size={20} />
              <Text style={styles.addText}>Montar treino</Text>
            </View>
          ) : (
            <View style={styles.otherDayContent}>
              <Ionicons
                color={isRest ? colors.info : isRecovery ? colors.success : colors.warning}
                name={isRest ? "bed-outline" : isRecovery ? "refresh-circle-outline" : "speedometer-outline"}
                size={16}
              />
              <Text style={styles.otherDayLabel}>{describeProgramDayType(day.day_type)}</Text>
            </View>
          )}
        </View>
      </Pressable>

      {/* Seletor Rápido de Tipo de Dia */}
      {!readOnly && (
        <View style={styles.quickTypeRow}>
          {programDayTypes.map((type) => {
            const isSelected = day.day_type === type;
            return (
              <Pressable
                key={type}
                accessibilityLabel={`Mudar Dia ${day.day_number} para ${describeProgramDayType(type)}`}
                onPress={() => onChangeDayType(type)}
                style={[styles.quickTypeBtn, isSelected && styles.quickTypeBtnActive]}
                testID={`cell-type-btn-${day.week_number}-${day.day_number}-${type}`}
              >
                <Text
                  numberOfLines={1}
                  style={[styles.quickTypeBtnText, isSelected && styles.quickTypeBtnTextActive]}
                >
                  {type === "training"
                    ? "Treino"
                    : type === "rest"
                    ? "Folga"
                    : type === "recovery"
                    ? "Recovery"
                    : type === "assessment"
                    ? "Avaliação"
                    : "—"}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: spacing[3],
    marginVertical: spacing[3]
  },
  headingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start"
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontFamily: fontFamilies.interfaceBold,
    fontSize: 13,
    letterSpacing: 0.8,
    textTransform: "uppercase"
  },
  sectionSubtitle: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.interface,
    fontSize: 12,
    marginTop: 2
  },
  emptyContainer: {
    backgroundColor: colors.surface01,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing[6],
    alignItems: "center",
    justifyContent: "center",
    gap: spacing[2]
  },
  emptyTitle: {
    color: colors.textPrimary,
    fontFamily: fontFamilies.interfaceBold,
    fontSize: 13,
    letterSpacing: 0.6
  },
  emptySubtitle: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.interface,
    fontSize: 13,
    textAlign: "center",
    maxWidth: 420
  },
  scrollContent: {
    paddingBottom: spacing[2]
  },
  gridContainer: {
    backgroundColor: colors.surface01,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.xl,
    overflow: "hidden"
  },
  gridContainerScrollable: {
    minWidth: 840
  },
  headerRow: {
    flexDirection: "row",
    backgroundColor: colors.surface02,
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    alignItems: "center"
  },
  weekLabelColumnHeader: {
    width: 64,
    paddingVertical: spacing[3],
    alignItems: "center",
    justifyContent: "center",
    borderRightColor: colors.border,
    borderRightWidth: 1
  },
  headerWeekLabel: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.interfaceBold,
    fontSize: 10,
    letterSpacing: 0.8
  },
  daysHeaderRow: {
    flex: 1,
    flexDirection: "row"
  },
  dayHeaderCell: {
    flex: 1,
    paddingVertical: spacing[3],
    alignItems: "center",
    justifyContent: "center",
    borderRightColor: colors.border,
    borderRightWidth: 1
  },
  dayHeaderText: {
    color: colors.textPrimary,
    fontFamily: fontFamilies.interfaceBold,
    fontSize: 11,
    letterSpacing: 0.8
  },
  weekRow: {
    flexDirection: "row",
    borderBottomColor: colors.border,
    borderBottomWidth: 1
  },
  weekLabelCell: {
    width: 64,
    backgroundColor: colors.surface02,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing[2],
    borderRightColor: colors.border,
    borderRightWidth: 1
  },
  weekBadgeText: {
    color: colors.purple400,
    fontFamily: fontFamilies.interfaceBold,
    fontSize: 13,
    letterSpacing: 0.5
  },
  weekCellsRow: {
    flex: 1,
    flexDirection: "row"
  },
  dayCell: {
    flex: 1,
    minHeight: 132,
    borderRightColor: colors.border,
    borderRightWidth: 1,
    backgroundColor: colors.surface01,
    padding: spacing[2],
    paddingBottom: spacing[1],
    justifyContent: "space-between"
  },
  dayCellTraining: {
    backgroundColor: "rgba(168, 85, 247, 0.05)"
  },
  dayCellRest: {
    backgroundColor: "rgba(96, 165, 250, 0.04)"
  },
  dayCellRecovery: {
    backgroundColor: "rgba(52, 211, 153, 0.04)"
  },
  dayCellAssessment: {
    backgroundColor: "rgba(251, 191, 36, 0.04)"
  },
  dayCellUnprogrammed: {
    backgroundColor: "transparent"
  },
  cellCard: {
    flex: 1,
    borderRadius: radius.md,
    gap: spacing[1]
  },
  cellCardPressed: {
    opacity: 0.8
  },
  cellTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  typeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.pill,
    backgroundColor: colors.surface03
  },
  typeBadgeTraining: {
    backgroundColor: "rgba(168, 85, 247, 0.25)"
  },
  typeBadgeRest: {
    backgroundColor: "rgba(96, 165, 250, 0.2)"
  },
  typeBadgeRecovery: {
    backgroundColor: "rgba(52, 211, 153, 0.2)"
  },
  typeBadgeAssessment: {
    backgroundColor: "rgba(251, 191, 36, 0.2)"
  },
  typeBadgeUnprogrammed: {
    backgroundColor: colors.surface02
  },
  typeBadgeText: {
    fontSize: 10,
    fontFamily: fontFamilies.interfaceSemiBold,
    color: colors.textSecondary
  },
  typeBadgeTextTraining: {
    color: colors.purple400
  },
  typeBadgeTextRest: {
    color: colors.info
  },
  typeBadgeTextRecovery: {
    color: colors.success
  },
  typeBadgeTextAssessment: {
    color: colors.warning
  },
  typeBadgeTextUnprogrammed: {
    color: colors.textSecondary
  },
  cellBody: {
    flex: 1,
    justifyContent: "center",
    paddingVertical: spacing[1]
  },
  trainingInfo: {
    gap: 3
  },
  sessionTitle: {
    color: colors.textPrimary,
    fontFamily: fontFamilies.interfaceSemiBold,
    fontSize: 11,
    lineHeight: 14
  },
  editActionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3
  },
  editActionText: {
    color: colors.purple400,
    fontFamily: fontFamilies.interfaceMedium,
    fontSize: 10
  },
  unprogrammedPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: spacing[2]
  },
  addText: {
    color: colors.purple400,
    fontFamily: fontFamilies.interfaceSemiBold,
    fontSize: 10
  },
  otherDayContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4
  },
  otherDayLabel: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.interface,
    fontSize: 11
  },
  quickTypeRow: {
    flexDirection: "row",
    gap: 2,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    paddingTop: spacing[1],
    marginTop: spacing[1]
  },
  quickTypeBtn: {
    flex: 1,
    paddingHorizontal: 3,
    paddingVertical: 3,
    borderRadius: radius.xs,
    backgroundColor: colors.surface02,
    alignItems: "center"
  },
  quickTypeBtnActive: {
    backgroundColor: colors.purple600
  },
  quickTypeBtnText: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.interfaceSemiBold,
    fontSize: 8,
    textAlign: "center"
  },
  quickTypeBtnTextActive: {
    color: colors.white
  }
});
