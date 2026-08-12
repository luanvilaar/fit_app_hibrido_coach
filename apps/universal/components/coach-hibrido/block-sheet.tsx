import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import type { ExerciseRecord } from "@fitblock/backend";
import { colors, fontFamilies, radius, spacing } from "@fitblock/design-tokens";
import { blockDefinition, blockDefinitions, type BlockKind } from "@/data/coach-hibrido/blocks";
import { collectMentions } from "@/data/coach-hibrido/mentions";
import type {
  BlockForm,
  BlockProtocolForm,
  BlockRankingForm,
  EnduranceVolumeForm,
  StrengthVolumeForm
} from "@/data/coach-hibrido/session-form";
import { MovementList } from "@/components/coach-hibrido/block-body-text";
import {
  Chip,
  EnduranceField,
  ProtocolField,
  RankingField,
  VolumeField
} from "@/components/coach-hibrido/block-fields";
import { MovementMentionInput } from "@/components/coach-hibrido/movement-mention-input";

type BlockSheetProps = {
  block: BlockForm;
  index: number;
  total: number;
  catalog: ExerciseRecord[];
  onUpdate: (patch: Partial<Pick<BlockForm, "name" | "body">>) => void;
  onChangeKind: (kind: BlockKind) => void;
  onMove: (direction: -1 | 1) => void;
  onRemove: () => void;
  onProtocol: (patch: Partial<BlockProtocolForm>) => void;
  onRanking: (patch: Partial<BlockRankingForm>) => void;
  onVolume: (patch: Partial<StrengthVolumeForm>) => void;
  onResetVolume: () => void;
  onEndurance: (
    modality: EnduranceVolumeForm["modality"],
    patch: Partial<EnduranceVolumeForm>
  ) => void;
};

/** A, B, C… — a ordem do bloco é a ordem em que o atleta treina, como na folha do coach. */
function orderMark(index: number): string {
  return String.fromCharCode(65 + (index % 26));
}

export function BlockSheet({
  block,
  index,
  total,
  catalog,
  onUpdate,
  onChangeKind,
  onMove,
  onRemove,
  onProtocol,
  onRanking,
  onVolume,
  onResetVolume,
  onEndurance
}: BlockSheetProps) {
  const [isSwitchingKind, setIsSwitchingKind] = useState(false);
  const [isKindFocused, setIsKindFocused] = useState(false);
  const [isNameFocused, setIsNameFocused] = useState(false);
  const definition = blockDefinition(block.kind);
  const movements = collectMentions(block.body, catalog);
  const testID = `block-${index}`;

  return (
    <View style={styles.sheet} testID={testID}>
      <View style={styles.header}>
        <View accessibilityLabel={`Bloco ${orderMark(index)}`} style={styles.order}>
          <Text style={styles.orderText}>{orderMark(index)}</Text>
        </View>

        <View style={styles.headerCopy}>
          <TextInput
            accessibilityLabel={`Nome do bloco ${orderMark(index)}`}
            onBlur={() => setIsNameFocused(false)}
            onChangeText={(name) => onUpdate({ name })}
            onFocus={() => setIsNameFocused(true)}
            placeholder={definition.label}
            placeholderTextColor={colors.textSecondary}
            style={[styles.name, isNameFocused && styles.nameFocused]}
            testID={`${testID}-name`}
            value={block.name}
          />
          <Text style={styles.purpose}>{definition.purpose}</Text>
        </View>

        <View style={styles.headerActions}>
          <IconAction
            accessibilityLabel={`Mover bloco ${orderMark(index)} para cima`}
            disabled={index === 0}
            icon="arrow-up"
            onPress={() => onMove(-1)}
            testID={`${testID}-move-up`}
          />
          <IconAction
            accessibilityLabel={`Mover bloco ${orderMark(index)} para baixo`}
            disabled={index === total - 1}
            icon="arrow-down"
            onPress={() => onMove(1)}
            testID={`${testID}-move-down`}
          />
          <IconAction
            accessibilityLabel={`Remover bloco ${orderMark(index)}`}
            danger
            icon="trash-outline"
            onPress={onRemove}
            testID={`${testID}-remove`}
          />
        </View>
      </View>

      <Pressable
        accessibilityLabel={`Categoria do bloco: ${definition.label}. Tocar para trocar.`}
        accessibilityRole="button"
        accessibilityState={{ expanded: isSwitchingKind }}
        onBlur={() => setIsKindFocused(false)}
        onFocus={() => setIsKindFocused(true)}
        onPress={() => setIsSwitchingKind((open) => !open)}
        style={({ pressed }) => [
          styles.kindButton,
          isKindFocused && styles.focusRing,
          pressed && styles.pressed
        ]}
        testID={`${testID}-kind`}
      >
        <Text style={styles.kindButtonText}>{definition.label}</Text>
        <Ionicons
          color={colors.textSecondary}
          name={isSwitchingKind ? "chevron-up" : "chevron-down"}
          size={15}
        />
      </Pressable>

      {isSwitchingKind && (
        <View style={styles.kindSwitcher} testID={`${testID}-kind-options`}>
          {blockDefinitions.map((candidate) => (
            <Chip
              key={candidate.kind}
              label={candidate.label}
              onPress={() => {
                onChangeKind(candidate.kind);
                setIsSwitchingKind(false);
              }}
              selected={candidate.kind === block.kind}
              testID={`${testID}-kind-${candidate.kind}`}
            />
          ))}
        </View>
      )}

      <MovementMentionInput
        accessibilityLabel={`Treino do bloco ${orderMark(index)}`}
        catalog={catalog}
        onChangeText={(body) => onUpdate({ body })}
        placeholder={definition.placeholder}
        testID={`${testID}-body`}
        value={block.body}
      />

      <Text style={styles.mentionHint}>
        Digite <Text style={styles.mentionHintMark}>@</Text> para vincular um movimento do catálogo —
        o atleta abre o vídeo pelo nome.
      </Text>

      {movements.length > 0 && (
        <MovementList movements={movements} testID={`${testID}-movements`} />
      )}

      {definition.strengthVolume && (
        <VolumeField block={block} onChange={onVolume} onReset={onResetVolume} testIDPrefix={testID} />
      )}
      {definition.protocol && block.protocol && (
        <ProtocolField onChange={onProtocol} protocol={block.protocol} testIDPrefix={testID} />
      )}
      {definition.enduranceVolume && (
        <EnduranceField onChange={onEndurance} testIDPrefix={testID} volumes={block.enduranceVolumes} />
      )}
      {definition.ranking !== "none" && (
        <RankingField block={block} onChange={onRanking} testIDPrefix={testID} />
      )}
    </View>
  );
}

function IconAction({
  accessibilityLabel,
  icon,
  disabled = false,
  danger = false,
  testID,
  onPress
}: {
  accessibilityLabel: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  disabled?: boolean;
  danger?: boolean;
  testID: string;
  onPress: () => void;
}) {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onBlur={() => setIsFocused(false)}
      onFocus={() => setIsFocused(true)}
      onPress={onPress}
      style={({ pressed }) => [
        styles.iconAction,
        disabled && styles.iconDisabled,
        isFocused && styles.focusRing,
        pressed && styles.pressed
      ]}
      testID={testID}
    >
      <Ionicons
        color={disabled ? colors.textSecondary : danger ? colors.danger : colors.textPrimary}
        name={icon}
        size={17}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  sheet: {
    backgroundColor: colors.surface02,
    borderColor: colors.border,
    borderRadius: radius.xl,
    borderWidth: 1,
    gap: spacing[4],
    padding: spacing[5]
  },
  header: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: spacing[3]
  },
  order: {
    alignItems: "center",
    backgroundColor: colors.purple500,
    borderRadius: radius.pill,
    height: 32,
    justifyContent: "center",
    width: 32
  },
  orderText: {
    color: colors.textPrimary,
    fontFamily: fontFamilies.interfaceBold,
    fontSize: 14
  },
  headerCopy: { flex: 1, gap: 2, minWidth: 0 },
  name: {
    borderRadius: radius.sm,
    color: colors.textPrimary,
    fontFamily: fontFamilies.interfaceBold,
    fontSize: 19,
    minHeight: 32,
    padding: 0
  },
  nameFocused: {
    borderBottomColor: colors.purple400,
    borderBottomWidth: 2
  },
  purpose: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.interface,
    fontSize: 12,
    lineHeight: 18
  },
  headerActions: { flexDirection: "row", gap: spacing[1] },
  iconAction: {
    alignItems: "center",
    borderRadius: radius.pill,
    height: 44,
    justifyContent: "center",
    width: 44
  },
  iconDisabled: { opacity: 0.4 },
  kindButton: {
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: colors.surface01,
    borderColor: colors.border,
    borderRadius: radius.pill,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing[2],
    minHeight: 44,
    paddingHorizontal: spacing[4]
  },
  kindButtonText: {
    color: colors.textPrimary,
    fontFamily: fontFamilies.interfaceBold,
    fontSize: 13
  },
  kindSwitcher: {
    backgroundColor: colors.surface01,
    borderRadius: radius.lg,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing[2],
    padding: spacing[3]
  },
  mentionHint: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.interface,
    fontSize: 12,
    lineHeight: 18
  },
  mentionHintMark: {
    color: colors.purple500,
    fontFamily: fontFamilies.mono,
    fontWeight: "700"
  },
  focusRing: {
    borderColor: colors.purple400,
    borderWidth: 2
  },
  pressed: { opacity: 0.72 }
});
