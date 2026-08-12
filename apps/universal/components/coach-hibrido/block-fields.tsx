import { Ionicons } from "@expo/vector-icons";
import { useState, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { colors, fontFamilies, radius, spacing } from "@fitblock/design-tokens";
import {
  enduranceModalityLabels,
  protocolLabels,
  protocolTypes,
  rankingRequired,
  scoreTypeHints,
  scoreTypeLabels,
  scoreTypes,
  volumeUnits,
  type ProtocolType,
  type ScoreType
} from "@/data/coach-hibrido/blocks";
import { formatVolume } from "@/data/coach-hibrido/volume";
import {
  resolveBlockVolume,
  type BlockForm,
  type BlockProtocolForm,
  type EnduranceVolumeForm,
  type StrengthVolumeForm
} from "@/data/coach-hibrido/session-form";

/* --------------------------------------------------------------- primitivas */

export function FieldRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={styles.rowContent}>{children}</View>
    </View>
  );
}

export function Chip({
  label,
  selected,
  accessibilityLabel,
  testID,
  onPress
}: {
  label: string;
  selected: boolean;
  accessibilityLabel?: string;
  testID: string;
  onPress: () => void;
}) {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onBlur={() => setIsFocused(false)}
      onFocus={() => setIsFocused(true)}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        selected && styles.chipSelected,
        isFocused && styles.focusRing,
        pressed && styles.pressed
      ]}
      testID={testID}
    >
      {selected && <Ionicons color={colors.white} name="checkmark" size={13} />}
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </Pressable>
  );
}

export function NumberField({
  label,
  value,
  placeholder,
  testID,
  onChangeText
}: {
  label: string;
  value: string;
  placeholder: string;
  testID: string;
  onChangeText: (value: string) => void;
}) {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <View style={styles.numberField}>
      <Text style={styles.numberLabel}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        inputMode="numeric"
        onBlur={() => setIsFocused(false)}
        onChangeText={onChangeText}
        onFocus={() => setIsFocused(true)}
        placeholder={placeholder}
        placeholderTextColor={colors.textSecondary}
        style={[styles.numberInput, isFocused && styles.numberInputFocused]}
        testID={testID}
        value={value}
      />
    </View>
  );
}

function TextAction({
  label,
  icon,
  testID,
  onPress
}: {
  label: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  testID: string;
  onPress: () => void;
}) {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      onBlur={() => setIsFocused(false)}
      onFocus={() => setIsFocused(true)}
      onPress={onPress}
      style={({ pressed }) => [styles.textAction, isFocused && styles.focusRing, pressed && styles.pressed]}
      testID={testID}
    >
      <Ionicons color={colors.purple500} name={icon} size={15} />
      <Text style={styles.textActionLabel}>{label}</Text>
    </Pressable>
  );
}

/* ------------------------------------------------------------------- volume */

export function VolumeField({
  block,
  testIDPrefix,
  onChange,
  onReset
}: {
  block: BlockForm;
  testIDPrefix: string;
  onChange: (patch: Partial<StrengthVolumeForm>) => void;
  onReset: () => void;
}) {
  const volume = resolveBlockVolume(block);

  if (block.volume.mode === "manual") {
    return (
      <FieldRow label="Volume total">
        <View style={styles.inline}>
          <NumberField
            label="Séries"
            onChangeText={(sets) => onChange({ sets })}
            placeholder="14"
            testID={`${testIDPrefix}-volume-sets`}
            value={block.volume.sets}
          />
          <NumberField
            label="Repetições"
            onChangeText={(reps) => onChange({ reps })}
            placeholder="102"
            testID={`${testIDPrefix}-volume-reps`}
            value={block.volume.reps}
          />
        </View>
        <TextAction
          icon="refresh-outline"
          label="Voltar ao cálculo automático"
          onPress={onReset}
          testID={`${testIDPrefix}-volume-auto`}
        />
      </FieldRow>
    );
  }

  return (
    <FieldRow label="Volume total">
      <View style={styles.volumeReading}>
        <Text style={styles.volumeValue} testID={`${testIDPrefix}-volume-value`}>
          {volume.source === "auto" ? formatVolume(volume.sets, volume.reps) : "Ainda sem contagem"}
        </Text>
        <Text style={styles.volumeSource}>
          {volume.source === "auto"
            ? "Somado do texto acima. Fica visível no histórico do atleta."
            : "Escreva no formato 4 x 3-5 para somar automaticamente, ou informe o total."}
        </Text>
      </View>
      <TextAction
        icon="create-outline"
        label="Informar o total na mão"
        onPress={() => onChange({ mode: "manual", sets: String(volume.sets || ""), reps: String(volume.reps || "") })}
        testID={`${testIDPrefix}-volume-manual`}
      />
    </FieldRow>
  );
}

/* ---------------------------------------------------------------- protocolo */

export function ProtocolField({
  protocol,
  testIDPrefix,
  onChange
}: {
  protocol: BlockProtocolForm;
  testIDPrefix: string;
  onChange: (patch: Partial<BlockProtocolForm>) => void;
}) {
  return (
    <FieldRow label="Dinâmica de tempo">
      <View style={styles.chipRow}>
        {protocolTypes.map((type) => (
          <Chip
            key={type}
            label={protocolLabels[type]}
            onPress={() => onChange({ type })}
            selected={protocol.type === type}
            testID={`${testIDPrefix}-protocol-${type}`}
          />
        ))}
      </View>
      <View style={styles.inline}>{renderProtocolInputs(protocol, testIDPrefix, onChange)}</View>
    </FieldRow>
  );
}

function renderProtocolInputs(
  protocol: BlockProtocolForm,
  testIDPrefix: string,
  onChange: (patch: Partial<BlockProtocolForm>) => void
): ReactNode {
  if (protocol.type === "for-time") {
    return (
      <NumberField
        label="Limite de tempo (min)"
        onChangeText={(timeCapMinutes) => onChange({ timeCapMinutes })}
        placeholder="opcional"
        testID={`${testIDPrefix}-protocol-cap`}
        value={protocol.timeCapMinutes}
      />
    );
  }

  if (protocol.type === "amrap") {
    return (
      <NumberField
        label="Duração (min)"
        onChangeText={(durationMinutes) => onChange({ durationMinutes })}
        placeholder="12"
        testID={`${testIDPrefix}-protocol-duration`}
        value={protocol.durationMinutes}
      />
    );
  }

  if (protocol.type === "emom") {
    return (
      <>
        <NumberField
          label="Duração (min)"
          onChangeText={(durationMinutes) => onChange({ durationMinutes })}
          placeholder="10"
          testID={`${testIDPrefix}-protocol-duration`}
          value={protocol.durationMinutes}
        />
        <NumberField
          label="Rounds"
          onChangeText={(rounds) => onChange({ rounds })}
          placeholder="10"
          testID={`${testIDPrefix}-protocol-rounds`}
          value={protocol.rounds}
        />
      </>
    );
  }

  return (
    <>
      <NumberField
        label="Rounds"
        onChangeText={(rounds) => onChange({ rounds })}
        placeholder="8"
        testID={`${testIDPrefix}-protocol-rounds`}
        value={protocol.rounds}
      />
      <NumberField
        label="Trabalho (s)"
        onChangeText={(workSeconds) => onChange({ workSeconds })}
        placeholder="40"
        testID={`${testIDPrefix}-protocol-work`}
        value={protocol.workSeconds}
      />
      <NumberField
        label="Descanso (s)"
        onChangeText={(restSeconds) => onChange({ restSeconds })}
        placeholder="20"
        testID={`${testIDPrefix}-protocol-rest`}
        value={protocol.restSeconds}
      />
    </>
  );
}

/* ------------------------------------------------------------------ ranking */

export function RankingField({
  block,
  testIDPrefix,
  onChange
}: {
  block: BlockForm;
  testIDPrefix: string;
  onChange: (patch: { enabled?: boolean; scoreType?: ScoreType }) => void;
}) {
  const required = rankingRequired(block.kind);
  const active = required || block.ranking.enabled;
  const [isToggleFocused, setIsToggleFocused] = useState(false);

  return (
    <FieldRow label={required ? "Ranking da equipe" : "Ranking da equipe (opcional)"}>
      {!required && (
        <Pressable
          accessibilityLabel="Classificar este bloco entre os atletas da equipe"
          accessibilityRole="checkbox"
          accessibilityState={{ checked: block.ranking.enabled }}
          onBlur={() => setIsToggleFocused(false)}
          onFocus={() => setIsToggleFocused(true)}
          onPress={() => onChange({ enabled: !block.ranking.enabled })}
          style={({ pressed }) => [styles.toggle, isToggleFocused && styles.focusRing, pressed && styles.pressed]}
          testID={`${testIDPrefix}-ranking-toggle`}
        >
          <Ionicons
            color={block.ranking.enabled ? colors.purple500 : colors.textSecondary}
            name={block.ranking.enabled ? "checkbox" : "square-outline"}
            size={19}
          />
          <Text style={styles.toggleLabel}>Classificar os atletas neste bloco</Text>
        </Pressable>
      )}

      {active && (
        <>
          <View style={styles.chipRow}>
            {scoreTypes.map((scoreType) => (
              <Chip
                key={scoreType}
                label={scoreTypeLabels[scoreType]}
                onPress={() => onChange({ scoreType })}
                selected={block.ranking.scoreType === scoreType}
                testID={`${testIDPrefix}-score-${scoreType}`}
              />
            ))}
          </View>
          <Text style={styles.hint}>{scoreTypeHints[block.ranking.scoreType as ScoreType]}</Text>
        </>
      )}
    </FieldRow>
  );
}

/* ---------------------------------------------------------------- endurance */

function ModalityToggle({
  label,
  enabled,
  testID,
  onPress
}: {
  label: string;
  enabled: boolean;
  testID: string;
  onPress: () => void;
}) {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: enabled }}
      onBlur={() => setIsFocused(false)}
      onFocus={() => setIsFocused(true)}
      onPress={onPress}
      style={({ pressed }) => [styles.toggle, isFocused && styles.focusRing, pressed && styles.pressed]}
      testID={testID}
    >
      <Ionicons
        color={enabled ? colors.purple500 : colors.textSecondary}
        name={enabled ? "checkbox" : "square-outline"}
        size={19}
      />
      <Text style={styles.toggleLabel}>{label}</Text>
    </Pressable>
  );
}

export function EnduranceField({
  volumes,
  testIDPrefix,
  onChange
}: {
  volumes: EnduranceVolumeForm[];
  testIDPrefix: string;
  onChange: (modality: EnduranceVolumeForm["modality"], patch: Partial<EnduranceVolumeForm>) => void;
}) {
  return (
    <FieldRow label="Volume por modalidade">
      {volumes.map((volume) => (
        <View key={volume.modality} style={styles.modality}>
          <ModalityToggle
            enabled={volume.enabled}
            label={enduranceModalityLabels[volume.modality]}
            onPress={() => onChange(volume.modality, { enabled: !volume.enabled })}
            testID={`${testIDPrefix}-modality-${volume.modality}`}
          />

          {volume.enabled && (
            <View style={styles.inline}>
              <NumberField
                label="Volume"
                onChangeText={(value) => onChange(volume.modality, { value })}
                placeholder="5"
                testID={`${testIDPrefix}-volume-${volume.modality}`}
                value={volume.value}
              />
              <View style={styles.chipRow}>
                {volumeUnits.map((unit) => (
                  <Chip
                    accessibilityLabel={`Unidade ${unit} para ${enduranceModalityLabels[volume.modality]}`}
                    key={unit}
                    label={unit}
                    onPress={() => onChange(volume.modality, { unit })}
                    selected={volume.unit === unit}
                    testID={`${testIDPrefix}-unit-${volume.modality}-${unit}`}
                  />
                ))}
              </View>
            </View>
          )}
        </View>
      ))}
    </FieldRow>
  );
}

export type { ProtocolType };

const styles = StyleSheet.create({
  row: {
    borderTopColor: colors.border,
    borderTopWidth: 1,
    gap: spacing[2],
    paddingTop: spacing[4]
  },
  rowLabel: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.interfaceBold,
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: "uppercase"
  },
  rowContent: { gap: spacing[3] },
  inline: {
    alignItems: "flex-end",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing[3]
  },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing[2] },
  chip: {
    alignItems: "center",
    backgroundColor: colors.surface01,
    borderColor: colors.border,
    borderRadius: radius.pill,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing[1],
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: spacing[4]
  },
  chipSelected: { backgroundColor: colors.purple500, borderColor: colors.purple500 },
  chipText: {
    color: colors.textPrimary,
    fontFamily: fontFamilies.interfaceMedium,
    fontSize: 13
  },
  chipTextSelected: { color: colors.white, fontFamily: fontFamilies.interfaceBold },
  numberField: { gap: spacing[1], minWidth: 108 },
  numberLabel: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.interfaceMedium,
    fontSize: 11
  },
  numberInput: {
    backgroundColor: colors.surface01,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    color: colors.textPrimary,
    fontFamily: fontFamilies.mono,
    fontSize: 15,
    minHeight: 48,
    paddingHorizontal: spacing[3]
  },
  numberInputFocused: {
    borderColor: colors.purple400,
    borderWidth: 2
  },
  volumeReading: { gap: 2 },
  volumeValue: {
    color: colors.textPrimary,
    fontFamily: fontFamilies.mono,
    fontSize: 16,
    fontWeight: "700"
  },
  volumeSource: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.interface,
    fontSize: 12,
    lineHeight: 18
  },
  toggle: {
    alignItems: "center",
    borderRadius: radius.sm,
    flexDirection: "row",
    gap: spacing[2],
    minHeight: 44
  },
  toggleLabel: {
    color: colors.textPrimary,
    fontFamily: fontFamilies.interface,
    fontSize: 14
  },
  modality: { gap: spacing[2] },
  hint: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.interface,
    fontSize: 12
  },
  textAction: {
    alignItems: "center",
    alignSelf: "flex-start",
    borderRadius: radius.sm,
    flexDirection: "row",
    gap: spacing[1],
    minHeight: 44,
    paddingHorizontal: spacing[1]
  },
  textActionLabel: {
    color: colors.purple500,
    fontFamily: fontFamilies.interfaceBold,
    fontSize: 13
  },
  focusRing: {
    borderColor: colors.purple400,
    borderWidth: 2
  },
  pressed: { opacity: 0.72 }
});
