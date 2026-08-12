import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import type { ComponentProps } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import type { LeaderboardEntry, SubmitBlockScoreRequest } from "@fitblock/backend";
import { colors, fontFamilies, radius, spacing } from "@fitblock/design-tokens";
import { blockDefinition, type BlockKind } from "@/data/coach-hibrido/blocks";
import {
  formatBlockVolume,
  formatEnduranceVolumes,
  formatProtocol,
  type HybridBlock
} from "@/data/coach-hibrido/session-snapshot";
import { BlockBodyText, MovementList } from "@/components/coach-hibrido/block-body-text";
import { ScorePanel } from "@/components/coach-hibrido/athlete/score-panel";

export type MovementLog = { reps: string; loadKg: string };
type ActionPanel = "prepare" | "results" | null;
type IconName = ComponentProps<typeof Ionicons>["name"];

type BlockCardProps = {
  block: HybridBlock;
  index: number;
  isDone: boolean;
  isExpanded: boolean;
  isToggling: boolean;
  /** Carga registrada por movimento, indexada pelo id do item no snapshot. */
  logs: Record<string, MovementLog>;
  leaderboard: LeaderboardEntry[];
  isSubmittingScore: boolean;
  onToggleExpand: () => void;
  onToggleDone: () => void;
  onChangeLog: (itemId: string, patch: Partial<MovementLog>) => void;
  onCommitLog: (itemId: string) => void;
  onSubmitScore: (score: Omit<SubmitBlockScoreRequest, "sessionId" | "blockId">) => void;
};

function orderMark(index: number): string {
  return String.fromCharCode(65 + (index % 26));
}

const kindIcons: Record<BlockKind, IconName> = {
  "warm-up": "flame-outline",
  strength: "barbell-outline",
  lpo: "barbell-outline",
  conditioning: "stopwatch-outline",
  metcon: "stopwatch-outline",
  endurance: "stopwatch-outline",
  "gymnastics-skill": "body-outline",
  "gymnastics-conditioning": "body-outline",
  cooldown: "leaf-outline"
};

export function BlockCard({
  block,
  index,
  isDone,
  isExpanded,
  isToggling,
  logs,
  leaderboard,
  isSubmittingScore,
  onToggleExpand,
  onToggleDone,
  onChangeLog,
  onCommitLog,
  onSubmitScore
}: BlockCardProps) {
  const [activePanel, setActivePanel] = useState<ActionPanel>(null);
  const [isHeaderFocused, setIsHeaderFocused] = useState(false);
  const definition = blockDefinition(block.kind);
  const meta = [
    formatProtocol(block.protocol),
    formatEnduranceVolumes(block.enduranceVolumes),
    formatBlockVolume(block.volume)
  ]
    .filter(Boolean)
    .join("  ·  ");
  const canPrepare = block.movements.length > 0;
  const canSeeResults = Boolean(block.ranking);

  function togglePanel(panel: ActionPanel) {
    setActivePanel((current) => (current === panel ? null : panel));
  }

  return (
    <View style={styles.card} testID={`athlete-block-${block.id}`}>
      <Pressable
        accessibilityLabel={`${isExpanded ? "Recolher" : "Expandir"} bloco ${block.name}`}
        accessibilityRole="button"
        accessibilityState={{ expanded: isExpanded }}
        onBlur={() => setIsHeaderFocused(false)}
        onFocus={() => setIsHeaderFocused(true)}
        onPress={onToggleExpand}
        style={({ pressed }) => [styles.header, isHeaderFocused && styles.headerFocused, pressed && styles.pressed]}
        testID={`athlete-block-header-${block.id}`}
      >
        <View style={[styles.order, isDone && styles.orderDone]}>
          {isDone ? (
            <Ionicons color={colors.white} name="checkmark" size={16} />
          ) : (
            <Text style={styles.orderText}>{orderMark(index)}</Text>
          )}
        </View>
        <View style={styles.headerCopy}>
          <View style={styles.headerNameRow}>
            <Ionicons color={colors.textSecondary} name={kindIcons[block.kind] ?? "reader-outline"} size={14} />
            <Text style={styles.name}>{block.name}</Text>
          </View>
          <Text style={styles.kind}>{definition.label}</Text>
          {meta.length > 0 && (
            <Text style={styles.meta} testID={`athlete-block-meta-${block.id}`}>
              {meta}
            </Text>
          )}
        </View>
        <Ionicons
          color={colors.textSecondary}
          name={isExpanded ? "chevron-up" : "chevron-down"}
          size={20}
        />
      </Pressable>

      {isExpanded && (
        <View style={styles.body}>
          <BlockBodyText
            body={block.body}
            movements={block.movements}
            testID={`athlete-block-body-${block.id}`}
            tone="dark"
          />

          {(canPrepare || canSeeResults) && (
            <View style={styles.actionRow}>
              {canPrepare && (
                <ActionButton
                  active={activePanel === "prepare"}
                  icon="play-circle-outline"
                  label="Preparar"
                  onPress={() => togglePanel("prepare")}
                  testID={`athlete-block-action-prepare-${block.id}`}
                />
              )}
              {canSeeResults && (
                <ActionButton
                  active={activePanel === "results"}
                  badge={leaderboard.length > 0 ? leaderboard.length : undefined}
                  icon="podium-outline"
                  label="Resultados"
                  onPress={() => togglePanel("results")}
                  testID={`athlete-block-action-results-${block.id}`}
                />
              )}
            </View>
          )}

          {activePanel === "prepare" && canPrepare && (
            <View style={styles.panel} testID={`athlete-block-prepare-${block.id}`}>
              <Text style={styles.panelTitle}>Movimentos</Text>
              <MovementList movements={block.movements} tone="dark" testID={`athlete-block-movements-${block.id}`} />
            </View>
          )}

          {activePanel === "results" && canSeeResults && block.ranking && (
            <View style={styles.panel}>
              <ScorePanel
                blockId={block.id}
                isSubmitting={isSubmittingScore}
                leaderboard={leaderboard}
                onSubmit={onSubmitScore}
                scoreType={block.ranking.scoreType}
              />
            </View>
          )}

          {definition.strengthVolume && block.movements.length > 0 && (
            <View style={styles.logs} testID={`athlete-log-${block.id}`}>
              <Text style={styles.logsTitle}>Carga usada</Text>
              {block.movements.map((movement) => {
                const itemId = movement.itemId ?? movement.slug;
                const log = logs[itemId] ?? { reps: "", loadKg: "" };

                return (
                  <View key={itemId} style={styles.logRow}>
                    <Text numberOfLines={1} style={styles.logName}>
                      {movement.name}
                    </Text>
                    <TextInput
                      accessibilityLabel={`Repetições de ${movement.name}`}
                      inputMode="numeric"
                      onBlur={() => onCommitLog(itemId)}
                      onChangeText={(reps) => onChangeLog(itemId, { reps })}
                      placeholder="reps"
                      placeholderTextColor={colors.textSecondary}
                      style={styles.logInput}
                      testID={`log-reps-${itemId}`}
                      value={log.reps}
                    />
                    <TextInput
                      accessibilityLabel={`Carga em quilos de ${movement.name}`}
                      inputMode="numeric"
                      onBlur={() => onCommitLog(itemId)}
                      onChangeText={(loadKg) => onChangeLog(itemId, { loadKg })}
                      placeholder="kg"
                      placeholderTextColor={colors.textSecondary}
                      style={styles.logInput}
                      testID={`log-load-${itemId}`}
                      value={log.loadKg}
                    />
                  </View>
                );
              })}
              <Text style={styles.logsHint}>Opcional. Alimenta seu histórico de carga.</Text>
            </View>
          )}

          <Pressable
            accessibilityLabel={
              isDone ? `Desmarcar ${block.name} como concluído` : `Marcar ${block.name} como concluído`
            }
            accessibilityRole="checkbox"
            accessibilityState={{ checked: isDone, disabled: isToggling }}
            disabled={isToggling}
            onPress={onToggleDone}
            style={({ pressed }) => [
              styles.doneButton,
              isDone && styles.doneButtonChecked,
              pressed && styles.pressed
            ]}
            testID={`athlete-block-done-${block.id}`}
          >
            <Ionicons
              color={isDone ? colors.white : colors.textPrimary}
              name={isDone ? "checkmark-circle" : "ellipse-outline"}
              size={20}
            />
            <Text style={[styles.doneText, isDone && styles.doneTextChecked]}>
              {isDone ? "Bloco concluído" : "Concluir bloco"}
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

function ActionButton({
  icon,
  label,
  active,
  badge,
  onPress,
  testID
}: {
  icon: IconName;
  label: string;
  active: boolean;
  badge?: number;
  onPress: () => void;
  testID: string;
}) {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onBlur={() => setIsFocused(false)}
      onFocus={() => setIsFocused(true)}
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionButton,
        active && styles.actionButtonActive,
        isFocused && styles.actionButtonFocused,
        pressed && styles.pressed
      ]}
      testID={testID}
    >
      {badge !== undefined && (
        <View style={styles.actionBadge}>
          <Text style={styles.actionBadgeText}>{badge}</Text>
        </View>
      )}
      <Ionicons color={active ? colors.purple400 : colors.textSecondary} name={icon} size={20} />
      <Text style={[styles.actionButtonLabel, active && styles.actionButtonLabelActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderTopColor: colors.border,
    borderTopWidth: 1
  },
  header: {
    alignItems: "center",
    borderRadius: radius.md,
    flexDirection: "row",
    gap: spacing[3],
    minHeight: 64,
    paddingVertical: spacing[3]
  },
  headerFocused: {
    borderColor: colors.purple400,
    borderWidth: 2
  },
  order: {
    alignItems: "center",
    backgroundColor: colors.purple500,
    borderRadius: radius.md,
    height: 32,
    justifyContent: "center",
    width: 32
  },
  orderDone: {
    backgroundColor: colors.success
  },
  orderText: {
    color: colors.white,
    fontFamily: fontFamilies.interfaceBold,
    fontSize: 14
  },
  headerCopy: { flex: 1, gap: 2, minWidth: 0 },
  headerNameRow: { alignItems: "center", flexDirection: "row", gap: spacing[2] },
  name: {
    color: colors.textPrimary,
    flexShrink: 1,
    fontFamily: fontFamilies.interfaceBold,
    fontSize: 17
  },
  kind: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.interface,
    fontSize: 12
  },
  meta: {
    color: colors.purple400,
    fontFamily: fontFamilies.interfaceSemiBold,
    fontSize: 12,
    marginTop: 2
  },
  body: {
    gap: spacing[4],
    paddingBottom: spacing[4]
  },
  actionRow: {
    flexDirection: "row",
    gap: spacing[3]
  },
  actionButton: {
    alignItems: "center",
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    flex: 1,
    gap: spacing[1],
    justifyContent: "center",
    minHeight: 64,
    paddingVertical: spacing[2],
    position: "relative"
  },
  actionButtonActive: {
    backgroundColor: colors.surface03,
    borderColor: colors.borderPurple
  },
  actionButtonFocused: {
    borderColor: colors.purple400,
    borderWidth: 2
  },
  actionButtonLabel: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.interfaceBold,
    fontSize: 11,
    letterSpacing: 0.4,
    textTransform: "uppercase"
  },
  actionButtonLabelActive: {
    color: colors.textPrimary
  },
  actionBadge: {
    alignItems: "center",
    backgroundColor: colors.purple500,
    borderRadius: radius.pill,
    height: 18,
    justifyContent: "center",
    minWidth: 18,
    paddingHorizontal: 4,
    position: "absolute",
    right: 6,
    top: 6
  },
  actionBadgeText: {
    color: colors.white,
    fontFamily: fontFamilies.interfaceBold,
    fontSize: 10
  },
  panel: {
    backgroundColor: colors.bg,
    borderRadius: radius.lg,
    padding: spacing[4]
  },
  panelTitle: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.interfaceBold,
    fontSize: 11,
    letterSpacing: 0.6,
    marginBottom: spacing[3],
    textTransform: "uppercase"
  },
  logs: {
    borderTopColor: colors.border,
    borderTopWidth: 1,
    gap: spacing[2],
    paddingTop: spacing[3]
  },
  logsTitle: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.interfaceBold,
    fontSize: 11,
    letterSpacing: 0.6,
    textTransform: "uppercase"
  },
  logRow: { alignItems: "center", flexDirection: "row", gap: spacing[2] },
  logName: {
    color: colors.textPrimary,
    flex: 1,
    fontFamily: fontFamilies.interface,
    fontSize: 14,
    minWidth: 0
  },
  logInput: {
    backgroundColor: colors.bg,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    color: colors.textPrimary,
    fontFamily: fontFamilies.mono,
    fontSize: 15,
    minHeight: 48,
    paddingHorizontal: spacing[2],
    textAlign: "center",
    width: 76
  },
  logsHint: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.interface,
    fontSize: 12
  },
  doneButton: {
    alignItems: "center",
    borderColor: colors.border,
    borderRadius: radius.pill,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing[2],
    justifyContent: "center",
    minHeight: 52,
    paddingHorizontal: spacing[5]
  },
  doneButtonChecked: { backgroundColor: colors.purple500, borderColor: colors.purple500 },
  doneText: {
    color: colors.textPrimary,
    fontFamily: fontFamilies.interfaceBold,
    fontSize: 14
  },
  doneTextChecked: { color: colors.white },
  pressed: { opacity: 0.72 }
});
