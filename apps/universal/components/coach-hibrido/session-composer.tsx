import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View, useWindowDimensions } from "react-native";
import type { ExerciseRecord, TrainingGroupRecord } from "@fitblock/backend";
import { colors, fontFamilies, radius, shadows, spacing, typeScale } from "@fitblock/design-tokens";
import { blockDefinitions, type BlockKind } from "@/data/coach-hibrido/blocks";
import {
  addBlock,
  changeBlockKind,
  moveBlock,
  removeBlock,
  resetBlockVolume,
  summarizeSession,
  updateBlock,
  updateBlockProtocol,
  updateBlockRanking,
  updateBlockVolume,
  updateEnduranceVolume,
  updateSessionField,
  type SessionForm,
  type SessionStatus
} from "@/data/coach-hibrido/session-form";
import { BlockSheet } from "@/components/coach-hibrido/block-sheet";

export type ComposerMode = "create" | "edit";

type SessionComposerProps = {
  form: SessionForm;
  catalog: ExerciseRecord[];
  teams: TrainingGroupRecord[];
  mode: ComposerMode;
  isSaving: boolean;
  isDeleting: boolean;
  /** Rótulo da ação principal; a biblioteca salva um treino, o calendário publica uma sessão. */
  submitLabel: string;
  showSchedule?: boolean;
  onChange: (form: SessionForm) => void;
  onSubmit: () => void;
  onCancel?: () => void;
  onDelete?: () => void;
};

const statusOptions: Array<{ value: SessionStatus; label: string; hint: string }> = [
  { value: "published", label: "Publicado", hint: "O atleta já enxerga" },
  { value: "draft", label: "Rascunho", hint: "Só você enxerga" }
];

export function SessionComposer({
  form,
  catalog,
  teams,
  mode,
  isSaving,
  isDeleting,
  submitLabel,
  showSchedule = true,
  onChange,
  onSubmit,
  onCancel,
  onDelete
}: SessionComposerProps) {
  const { width } = useWindowDimensions();
  const isNarrow = width < 720;
  const summary = summarizeSession(form, catalog);
  const team = teams.find((candidate) => candidate.id === form.teamId);
  const busy = isSaving || isDeleting;
  const [isTitleFocused, setIsTitleFocused] = useState(false);
  const [isDateFocused, setIsDateFocused] = useState(false);
  const [isNoteFocused, setIsNoteFocused] = useState(false);
  const [isSubmitFocused, setIsSubmitFocused] = useState(false);
  const [isCancelFocused, setIsCancelFocused] = useState(false);
  const [isDeleteFocused, setIsDeleteFocused] = useState(false);

  return (
    <View style={styles.composer} testID="session-composer">
      <TextInput
        accessibilityLabel="Nome da sessão"
        onBlur={() => setIsTitleFocused(false)}
        onChangeText={(title) => onChange(updateSessionField(form, "title", title))}
        onFocus={() => setIsTitleFocused(true)}
        placeholder="NOME DA SESSÃO"
        placeholderTextColor={colors.textSecondary}
        style={[styles.title, isTitleFocused && styles.titleFocused]}
        testID="session-title"
        value={form.title}
      />

      <View style={[styles.metaRow, isNarrow && styles.metaColumn]}>
        {showSchedule && (
          <View style={styles.metaField}>
            <Text style={styles.metaLabel}>Data</Text>
            <TextInput
              accessibilityLabel="Data da sessão, no formato ano-mês-dia"
              onBlur={() => setIsDateFocused(false)}
              onChangeText={(date) => onChange(updateSessionField(form, "scheduledDate", date))}
              onFocus={() => setIsDateFocused(true)}
              placeholder="2026-08-12"
              placeholderTextColor={colors.textSecondary}
              style={[styles.metaInput, isDateFocused && styles.focusRing]}
              testID="session-date"
              value={form.scheduledDate}
            />
          </View>
        )}

        <View style={styles.metaField}>
          <Text style={styles.metaLabel}>Visibilidade</Text>
          <View style={styles.statusRow}>
            {statusOptions.map((option) => (
              <StatusOption
                key={option.value}
                label={option.label}
                hint={option.hint}
                onPress={() => onChange(updateSessionField(form, "status", option.value))}
                selected={form.status === option.value}
                testID={`session-status-${option.value}`}
              />
            ))}
          </View>
        </View>

        {showSchedule && (
          <View style={styles.metaField}>
            <Text style={styles.metaLabel}>Equipe</Text>
            <Text style={styles.metaValue} testID="session-team">
              {team?.name ?? "Escolha uma equipe no quadro da semana"}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.noteField}>
        <Text style={styles.metaLabel}>Recado para o atleta</Text>
        <TextInput
          accessibilityLabel="Recado para o atleta"
          multiline
          onBlur={() => setIsNoteFocused(false)}
          onChangeText={(coachNote) => onChange(updateSessionField(form, "coachNote", coachNote))}
          onFocus={() => setIsNoteFocused(true)}
          placeholder="Opcional. Aparece no topo do treino."
          placeholderTextColor={colors.textSecondary}
          style={[styles.noteInput, isNoteFocused && styles.focusRing]}
          testID="session-coach-note"
          value={form.coachNote}
        />
      </View>

      {form.blocks.map((block, index) => (
        <BlockSheet
          block={block}
          catalog={catalog}
          index={index}
          key={block.id}
          onChangeKind={(kind) => onChange(changeBlockKind(form, block.id, kind))}
          onEndurance={(modality, patch) =>
            onChange(updateEnduranceVolume(form, block.id, modality, patch))
          }
          onMove={(direction) => onChange(moveBlock(form, block.id, direction))}
          onProtocol={(patch) => onChange(updateBlockProtocol(form, block.id, patch))}
          onRanking={(patch) => onChange(updateBlockRanking(form, block.id, patch))}
          onRemove={() => onChange(removeBlock(form, block.id))}
          onResetVolume={() => onChange(resetBlockVolume(form, block.id))}
          onUpdate={(patch) => onChange(updateBlock(form, block.id, patch))}
          onVolume={(patch) => onChange(updateBlockVolume(form, block.id, patch))}
          total={form.blocks.length}
        />
      ))}

      <BlockPicker
        isEmpty={form.blocks.length === 0}
        onSelect={(kind) => onChange(addBlock(form, kind))}
      />

      <View style={styles.footer}>
        <Text style={styles.summary} testID="session-summary">
          {summary.blocks} {summary.blocks === 1 ? "bloco" : "blocos"} · {summary.movements}{" "}
          {summary.movements === 1 ? "movimento vinculado" : "movimentos vinculados"} · {summary.ranked}{" "}
          {summary.ranked === 1 ? "bloco pontuado" : "blocos pontuados"}
        </Text>

        <View style={[styles.actions, isNarrow && styles.actionsColumn]}>
          <Pressable
            accessibilityLabel={submitLabel}
            accessibilityRole="button"
            accessibilityState={{ disabled: busy }}
            disabled={busy}
            onBlur={() => setIsSubmitFocused(false)}
            onFocus={() => setIsSubmitFocused(true)}
            onPress={onSubmit}
            style={({ pressed }) => [
              styles.submit,
              busy && styles.disabled,
              isSubmitFocused && styles.focusRing,
              pressed && styles.pressed
            ]}
            testID="session-submit"
          >
            <Text style={styles.submitText}>{isSaving ? "Salvando…" : submitLabel}</Text>
            <Ionicons color={colors.white} name="arrow-forward" size={17} />
          </Pressable>

          {mode === "edit" && onCancel && (
            <Pressable
              accessibilityLabel="Cancelar edição"
              accessibilityRole="button"
              onBlur={() => setIsCancelFocused(false)}
              onFocus={() => setIsCancelFocused(true)}
              onPress={onCancel}
              style={({ pressed }) => [
                styles.ghost,
                isCancelFocused && styles.focusRing,
                pressed && styles.pressed
              ]}
              testID="session-cancel"
            >
              <Text style={styles.ghostText}>Cancelar</Text>
            </Pressable>
          )}

          {mode === "edit" && onDelete && (
            <Pressable
              accessibilityLabel="Excluir esta sessão"
              accessibilityRole="button"
              accessibilityState={{ disabled: busy }}
              disabled={busy}
              onBlur={() => setIsDeleteFocused(false)}
              onFocus={() => setIsDeleteFocused(true)}
              onPress={onDelete}
              style={({ pressed }) => [
                styles.danger,
                busy && styles.disabled,
                isDeleteFocused && styles.focusRing,
                pressed && styles.pressed
              ]}
              testID="session-delete"
            >
              <Text style={styles.dangerText}>{isDeleting ? "Excluindo…" : "Excluir"}</Text>
            </Pressable>
          )}
        </View>
      </View>
    </View>
  );
}

function StatusOption({
  label,
  hint,
  selected,
  testID,
  onPress
}: {
  label: string;
  hint: string;
  selected: boolean;
  testID: string;
  onPress: () => void;
}) {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <Pressable
      accessibilityLabel={`${label}. ${hint}.`}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onBlur={() => setIsFocused(false)}
      onFocus={() => setIsFocused(true)}
      onPress={onPress}
      style={({ pressed }) => [
        styles.status,
        selected && styles.statusSelected,
        isFocused && styles.focusRing,
        pressed && styles.pressed
      ]}
      testID={testID}
    >
      {selected && <Ionicons color={colors.white} name="checkmark" size={13} />}
      <Text style={[styles.statusLabel, selected && styles.statusLabelSelected]}>{label}</Text>
    </Pressable>
  );
}

function BlockPicker({ isEmpty, onSelect }: { isEmpty: boolean; onSelect: (kind: BlockKind) => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isToggleFocused, setIsToggleFocused] = useState(false);
  const expanded = isEmpty || isOpen;

  function handleSelect(kind: BlockKind) {
    onSelect(kind);
    setIsOpen(false);
  }

  return (
    <View style={[styles.picker, isEmpty && styles.pickerEmpty]} testID="block-picker">
      {isEmpty ? (
        <Text style={styles.pickerTitle}>Comece pelo primeiro bloco</Text>
      ) : (
        <Pressable
          accessibilityLabel="Adicionar bloco. Toca para ver as categorias disponíveis."
          accessibilityRole="button"
          accessibilityState={{ expanded }}
          onBlur={() => setIsToggleFocused(false)}
          onFocus={() => setIsToggleFocused(true)}
          onPress={() => setIsOpen((open) => !open)}
          style={({ pressed }) => [
            styles.pickerToggle,
            isToggleFocused && styles.focusRing,
            pressed && styles.pressed
          ]}
          testID="block-picker-toggle"
        >
          <Text style={styles.pickerToggleText}>Adicionar bloco</Text>
          <Ionicons color={colors.textSecondary} name={expanded ? "chevron-up" : "chevron-down"} size={15} />
        </Pressable>
      )}
      {isEmpty && (
        <Text style={styles.pickerHint}>
          Cada bloco é uma folha de texto livre. A categoria decide o que ele pede além do texto:
          volume, dinâmica de tempo ou ranking.
        </Text>
      )}
      {expanded && (
        <View style={styles.pickerGrid}>
          {blockDefinitions.map((definition) => (
            <PickerOption
              key={definition.kind}
              label={definition.label}
              onPress={() => handleSelect(definition.kind)}
              purpose={definition.purpose}
              testID={`add-block-${definition.kind}`}
            />
          ))}
        </View>
      )}
      {isEmpty && <Ionicons color={colors.purple400} name="layers-outline" size={42} style={styles.pickerIcon} />}
    </View>
  );
}

function PickerOption({
  label,
  purpose,
  testID,
  onPress
}: {
  label: string;
  purpose: string;
  testID: string;
  onPress: () => void;
}) {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <Pressable
      accessibilityLabel={`Adicionar bloco de ${label}. ${purpose}.`}
      accessibilityRole="button"
      onBlur={() => setIsFocused(false)}
      onFocus={() => setIsFocused(true)}
      onPress={onPress}
      style={({ pressed }) => [styles.pickerOption, isFocused && styles.focusRing, pressed && styles.pressed]}
      testID={testID}
    >
      <Ionicons color={colors.purple500} name="add" size={15} />
      <Text style={styles.pickerOptionText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  composer: {
    backgroundColor: colors.surface02,
    borderColor: colors.border,
    borderRadius: radius.xl,
    borderWidth: 1,
    gap: spacing[5],
    padding: spacing[5]
  },
  title: {
    color: colors.textPrimary,
    fontFamily: fontFamilies.display,
    fontSize: typeScale.displaySection,
    lineHeight: typeScale.displaySection,
    padding: 0,
    textTransform: "uppercase"
  },
  titleFocused: {
    borderBottomColor: colors.purple400,
    borderBottomWidth: 2
  },
  metaRow: { flexDirection: "row", gap: spacing[5] },
  metaColumn: { flexDirection: "column", gap: spacing[4] },
  metaField: { flex: 1, gap: spacing[2], minWidth: 0 },
  metaLabel: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.interfaceBold,
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: "uppercase"
  },
  metaInput: {
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
  metaValue: {
    color: colors.textPrimary,
    fontFamily: fontFamilies.interfaceSemiBold,
    fontSize: 15,
    minHeight: 44,
    paddingTop: spacing[3]
  },
  statusRow: { flexDirection: "row", gap: spacing[2] },
  status: {
    alignItems: "center",
    backgroundColor: colors.bg,
    borderColor: colors.border,
    borderRadius: radius.pill,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing[1],
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: spacing[4]
  },
  statusSelected: { backgroundColor: colors.purple500, borderColor: colors.purple500 },
  statusLabel: {
    color: colors.textPrimary,
    fontFamily: fontFamilies.interfaceMedium,
    fontSize: 13
  },
  statusLabelSelected: { color: colors.white, fontFamily: fontFamilies.interfaceBold },
  noteField: { gap: spacing[2] },
  noteInput: {
    backgroundColor: colors.surface01,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    color: colors.textPrimary,
    fontFamily: fontFamilies.interface,
    fontSize: 14,
    lineHeight: 21,
    minHeight: 72,
    padding: spacing[3],
    textAlignVertical: "top"
  },
  picker: { gap: spacing[3] },
  pickerEmpty: {
    backgroundColor: colors.surface01,
    borderColor: colors.border,
    borderRadius: radius.xl,
    borderWidth: 1,
    overflow: "hidden",
    padding: spacing[5],
    position: "relative"
  },
  pickerIcon: {
    position: "absolute",
    right: spacing[4],
    top: spacing[4]
  },
  pickerTitle: {
    color: colors.textPrimary,
    fontFamily: fontFamilies.interfaceBold,
    fontSize: 16
  },
  pickerToggle: {
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
  pickerToggleText: {
    color: colors.textPrimary,
    fontFamily: fontFamilies.interfaceBold,
    fontSize: 13
  },
  pickerHint: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.interface,
    fontSize: 13,
    lineHeight: 20,
    maxWidth: 420
  },
  pickerGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing[2] },
  pickerOption: {
    alignItems: "center",
    backgroundColor: colors.surface02,
    borderColor: colors.border,
    borderRadius: radius.pill,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing[1],
    minHeight: 44,
    paddingHorizontal: spacing[3]
  },
  pickerOptionText: {
    color: colors.textPrimary,
    fontFamily: fontFamilies.interfaceMedium,
    fontSize: 13
  },
  footer: {
    borderTopColor: colors.border,
    borderTopWidth: 1,
    gap: spacing[4],
    paddingTop: spacing[4]
  },
  summary: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.interface,
    fontSize: 13
  },
  actions: { flexDirection: "row", gap: spacing[3] },
  actionsColumn: { flexDirection: "column" },
  submit: {
    alignItems: "center",
    backgroundColor: colors.purple500,
    borderRadius: radius.pill,
    flexDirection: "row",
    gap: spacing[3],
    justifyContent: "center",
    minHeight: 52,
    paddingHorizontal: spacing[5],
    ...shadows.ctaGlow
  },
  submitText: {
    color: colors.white,
    fontFamily: fontFamilies.interfaceBold,
    fontSize: 14
  },
  ghost: {
    alignItems: "center",
    borderColor: colors.border,
    borderRadius: radius.pill,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 52,
    paddingHorizontal: spacing[5]
  },
  ghostText: {
    color: colors.textPrimary,
    fontFamily: fontFamilies.interfaceSemiBold,
    fontSize: 14
  },
  danger: {
    alignItems: "center",
    borderColor: colors.danger,
    borderRadius: radius.pill,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 52,
    paddingHorizontal: spacing[5]
  },
  dangerText: {
    color: colors.danger,
    fontFamily: fontFamilies.interfaceBold,
    fontSize: 14
  },
  focusRing: {
    borderColor: colors.purple400,
    borderWidth: 2
  },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.72 }
});
