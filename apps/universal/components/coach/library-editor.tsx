import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { colors, fontFamilies, radius, spacing, typeScale } from "@fitblock/design-tokens";
import type { ExerciseRecord } from "@fitblock/backend";
import { BlockEditor, TextButton } from "@/components/coach/block-editor";
import {
  addLibraryBlock,
  addLibraryBlockSet,
  addLibraryItem,
  addLibrarySet,
  removeLibraryBlock,
  removeLibraryBlockSet,
  removeLibraryItem,
  removeLibrarySet,
  summarizeLibraryForm,
  updateLibraryBlock,
  updateLibraryBlockRanking,
  updateLibraryBlockSet,
  updateLibraryBlockVolume,
  updateLibraryField,
  updateLibraryItem,
  updateLibrarySet,
  type LibraryTemplateForm
} from "@/data/coach-library";

export type LibraryEditorMode = "create" | "edit";

type LibraryEditorProps = {
  form: LibraryTemplateForm;
  exercises: ExerciseRecord[];
  mode: LibraryEditorMode;
  isSaving: boolean;
  onChange: (form: LibraryTemplateForm) => void;
  onSubmit: () => void;
  onCancelEdit: () => void;
};

const statusOptions: Array<{ value: LibraryTemplateForm["status"]; label: string; hint: string }> = [
  { value: "draft", label: "Rascunho", hint: "Não pode ser aplicado ainda" },
  { value: "published", label: "Publicado", hint: "Pronto para aplicar" }
];

export function LibraryEditor({ form, exercises, mode, isSaving, onChange, onSubmit, onCancelEdit }: LibraryEditorProps) {
  const isEditing = mode === "edit";
  const summary = summarizeLibraryForm(form);
  const isTitleEmpty = form.title.trim().length === 0;
  const isFormValid = !isTitleEmpty && form.blocks.length > 0;

  return (
    <View style={styles.card} testID="coach-library-editor">
      <View style={styles.cardHeader}>
        <View style={styles.cardHeaderCopy}>
          <Text style={styles.cardEyebrow}>{isEditing ? "EDITAR TREINO" : "NOVO TREINO"}</Text>
          <Text style={styles.cardTitle}>{isEditing ? "Ajustar treino da biblioteca" : "Montar treino reutilizável"}</Text>
        </View>
        {isEditing && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Cancelar edição do treino"
            testID="cancel-library-edit"
            onPress={onCancelEdit}
            style={({ pressed }) => [styles.ghostButton, pressed && styles.pressed]}
          >
            <Ionicons name="close" size={16} color={colors.textSecondary} />
            <Text style={styles.ghostButtonText}>Cancelar</Text>
          </Pressable>
        )}
      </View>

      <View style={styles.fieldLabelRow}>
        <Text style={styles.fieldLabel}>Título do treino</Text>
        <Text style={styles.fieldRequired}>*</Text>
      </View>
      <TextInput
        accessibilityLabel="Título do treino (obrigatório)"
        autoCapitalize="sentences"
        onChangeText={(value) => onChange(updateLibraryField(form, "title", value))}
        placeholder="Ex.: Lower Strength ou Upper Power"
        placeholderTextColor={colors.textMuted}
        style={[styles.input, isTitleEmpty && styles.inputError]}
        testID="library-title"
        value={form.title}
      />
      {isTitleEmpty && (
        <Text style={styles.errorText}>Título é obrigatório para salvar</Text>
      )}

      <View style={styles.statusRow}>
        <Text style={styles.fieldLabel}>Visibilidade</Text>
        <View accessibilityRole="radiogroup" accessibilityLabel="Visibilidade do treino" style={styles.chipRow}>
          {statusOptions.map((option) => (
            <Pressable
              key={option.value}
              accessibilityRole="radio"
              accessibilityLabel={option.label}
              accessibilityState={{ selected: form.status === option.value }}
              testID={`library-status-${option.value}`}
              onPress={() => onChange(updateLibraryField(form, "status", option.value))}
              style={({ pressed }) => [
                styles.statusChip,
                form.status === option.value && styles.statusChipActive,
                pressed && styles.pressed
              ]}
            >
              <Text style={[styles.statusChipText, form.status === option.value && styles.statusChipTextActive]}>
                {option.label}
              </Text>
              <Text style={[styles.statusChipHint, form.status === option.value && styles.statusChipHintActive]}>
                {option.hint}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.divider} />

      {form.blocks.map((block, blockIndex) => (
        <BlockEditor
          key={block.id}
          block={block}
          blockIndex={blockIndex}
          exercises={exercises}
          canRemove={form.blocks.length > 1}
          testIDPrefix="library-"
          onRemoveBlock={() => onChange(removeLibraryBlock(form, block.id))}
          onChangeBlock={(patch) => onChange(updateLibraryBlock(form, block.id, patch))}
          onChangeRanking={(patch) => onChange(updateLibraryBlockRanking(form, block.id, patch))}
          onChangeVolume={(modality, patch) => onChange(updateLibraryBlockVolume(form, block.id, modality, patch))}
          onAddBlockSet={() => onChange(addLibraryBlockSet(form, block.id))}
          onRemoveBlockSet={(setId) => onChange(removeLibraryBlockSet(form, block.id, setId))}
          onChangeBlockSet={(setId, patch) => onChange(updateLibraryBlockSet(form, block.id, setId, patch))}
          onAddItem={() => onChange(addLibraryItem(form, block.id))}
          onRemoveItem={(itemId) => onChange(removeLibraryItem(form, block.id, itemId))}
          onChangeItem={(itemId, patch) => onChange(updateLibraryItem(form, block.id, itemId, patch))}
          onAddSet={(itemId) => onChange(addLibrarySet(form, block.id, itemId))}
          onRemoveSet={(itemId, setId) => onChange(removeLibrarySet(form, block.id, itemId, setId))}
          onChangeSet={(itemId, setId, patch) => onChange(updateLibrarySet(form, block.id, itemId, setId, patch))}
        />
      ))}

      <TextButton
        icon="layers-outline"
        label="Adicionar bloco"
        testID="library-add-block"
        onPress={() => onChange(addLibraryBlock(form))}
      />

      <View style={styles.summaryCard}>
        <Text style={styles.summaryLabel}>RESUMO</Text>
        <Text style={styles.summaryValue}>
          {summary.blocks} {summary.blocks === 1 ? "bloco" : "blocos"} · {summary.exercises}{" "}
          {summary.exercises === 1 ? "exercício" : "exercícios"} · {summary.sets}{" "}
          {summary.sets === 1 ? "série" : "séries"}
        </Text>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={isEditing ? "Salvar alterações do treino" : "Salvar treino na biblioteca"}
        accessibilityState={{ disabled: isSaving || !isFormValid }}
        disabled={isSaving || !isFormValid}
        testID="submit-library-template"
        onPress={onSubmit}
        style={({ pressed }) => [styles.submitButton, (isSaving || !isFormValid) && styles.submitButtonDisabled, pressed && !isFormValid && styles.pressed]}
      >
        <Text style={styles.submitButtonText}>
          {isSaving ? "Salvando..." : isEditing ? "Salvar alterações" : "Salvar na biblioteca"}
        </Text>
        <Ionicons name="arrow-forward" size={17} color={colors.canvas} />
      </Pressable>
    </View>
  );
}


const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.canvas,
    borderColor: colors.hairline,
    borderRadius: radius.lg,
    borderWidth: 1,
    flex: 1,
    minWidth: 0,
    padding: spacing[5]
  },
  cardHeader: { alignItems: "flex-start", flexDirection: "row", justifyContent: "space-between", marginBottom: spacing[5] },
  cardHeaderCopy: { flex: 1, minWidth: 0 },
  cardEyebrow: { color: colors.textMuted, fontFamily: fontFamilies.interface, fontSize: 12, fontWeight: "800", letterSpacing: 1.3 },
  cardTitle: { color: colors.ink, fontFamily: fontFamilies.interface, fontSize: typeScale.headingLg, fontWeight: "700", marginTop: spacing[2] },
  fieldLabelRow: { alignItems: "center", flexDirection: "row", gap: spacing[1], marginBottom: spacing[2] },
  fieldLabel: { color: colors.ink, fontFamily: fontFamilies.interface, fontSize: 13, fontWeight: "800" },
  fieldRequired: { color: colors.danger, fontFamily: fontFamilies.interface, fontSize: 13, fontWeight: "800" },
  input: {
    backgroundColor: colors.softCloud,
    borderColor: colors.hairline,
    borderRadius: radius.sm,
    borderWidth: 1,
    color: colors.ink,
    fontFamily: fontFamilies.interface,
    fontSize: 14,
    minHeight: 44,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3]
  },
  inputError: {
    borderColor: colors.danger,
    backgroundColor: "#FFF5F5"
  },
  errorText: { color: colors.danger, fontFamily: fontFamilies.interface, fontSize: 12, fontWeight: "600", marginTop: spacing[1] },
  statusRow: { marginTop: spacing[4] },
  chipRow: { flexDirection: "row", gap: spacing[2] },
  statusChip: { borderColor: colors.hairline, borderRadius: radius.sm, borderWidth: 1, flex: 1, justifyContent: "center", minHeight: 48, paddingHorizontal: spacing[3], paddingVertical: spacing[2] },
  statusChipActive: { backgroundColor: "#F8F6FF", borderColor: colors.fitblockPurple },
  statusChipText: { color: colors.ink, fontFamily: fontFamilies.interface, fontSize: 13, fontWeight: "800" },
  statusChipTextActive: { color: colors.fitblockPurple },
  statusChipHint: { color: colors.textMuted, fontFamily: fontFamilies.interface, fontSize: 11, marginTop: 2 },
  statusChipHintActive: { color: colors.fitblockPurpleDark },
  divider: { backgroundColor: colors.hairline, height: 1, marginTop: spacing[5] },
  blockCard: { borderColor: colors.hairline, borderRadius: radius.md, borderWidth: 1, marginTop: spacing[5], padding: spacing[4] },
  blockHeader: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginBottom: spacing[3] },
  blockBadge: { color: colors.fitblockPurple, fontFamily: fontFamilies.interface, fontSize: 10, fontWeight: "700", letterSpacing: 1.2 },
  kindRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing[2], marginTop: spacing[3] },
  kindChip: { borderColor: colors.hairline, borderRadius: radius.pill, borderWidth: 1, justifyContent: "center", minHeight: 44, paddingHorizontal: spacing[3], paddingVertical: spacing[2] },
  kindChipActive: { backgroundColor: colors.fitblockPurple, borderColor: colors.fitblockPurple },
  kindChipText: { color: colors.textSecondary, fontFamily: fontFamilies.interface, fontSize: 12, fontWeight: "700" },
  kindChipTextActive: { color: colors.canvas },
  itemCard: { backgroundColor: colors.softCloud, borderRadius: radius.sm, marginTop: spacing[4], padding: spacing[3] },
  fieldRowTight: { alignItems: "flex-end", flexDirection: "row", gap: spacing[2], zIndex: 20 },
  fieldGrow: { flex: 2, minWidth: 0 },
  fieldRest: { flex: 1, minWidth: 0 },
  itemRemove: { paddingBottom: 4 },
  exerciseFieldWrap: { position: "relative", zIndex: 20 },
  suggestionList: {
    backgroundColor: colors.canvas,
    borderColor: colors.hairline,
    borderRadius: radius.sm,
    borderWidth: 1,
    elevation: 4,
    left: 0,
    marginTop: spacing[1],
    position: "absolute",
    right: 0,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    top: "100%",
    zIndex: 20
  },
  suggestionItem: {
    alignItems: "center",
    borderBottomColor: colors.hairline,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: spacing[2],
    justifyContent: "space-between",
    minHeight: 40,
    paddingHorizontal: spacing[3]
  },
  suggestionText: { color: colors.ink, flex: 1, fontFamily: fontFamilies.interface, fontSize: 13, fontWeight: "700" },
  setRow: { alignItems: "center", flexDirection: "row", gap: spacing[2], marginTop: spacing[3] },
  setIndex: { color: colors.textSecondary, fontFamily: fontFamilies.interface, fontSize: 12, fontWeight: "800", width: 16 },
  setInput: { backgroundColor: colors.canvas, flex: 1 },
  iconAction: { alignItems: "center", borderRadius: radius.pill, height: 40, justifyContent: "center", width: 40 },
  textButton: { alignItems: "center", alignSelf: "flex-start", flexDirection: "row", gap: spacing[2], marginTop: spacing[3], minHeight: 44, paddingHorizontal: spacing[3], paddingVertical: spacing[2] },
  textButtonLabel: { color: colors.fitblockPurple, fontFamily: fontFamilies.interface, fontSize: 12, fontWeight: "800" },
  summaryCard: { backgroundColor: "#F8F6FF", borderRadius: radius.sm, justifyContent: "center", marginTop: spacing[5], minHeight: 62, paddingHorizontal: spacing[4], paddingVertical: spacing[3] },
  summaryLabel: { color: colors.fitblockPurple, fontFamily: fontFamilies.interface, fontSize: 11, fontWeight: "700", letterSpacing: 1 },
  summaryValue: { color: colors.ink, fontFamily: fontFamilies.interface, fontSize: 14, fontWeight: "800", marginTop: spacing[1] },
  submitButton: {
    alignItems: "center",
    backgroundColor: colors.fitblockPurple,
    borderRadius: radius.pill,
    flexDirection: "row",
    gap: spacing[5],
    justifyContent: "space-between",
    marginTop: spacing[5],
    minHeight: 48,
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[3]
  },
  submitButtonDisabled: { backgroundColor: "#E8E6F0", opacity: 1 },
  submitButtonText: { color: colors.canvas, fontFamily: fontFamilies.interface, fontSize: 14, fontWeight: "700" },
  ghostButton: { alignItems: "center", borderColor: colors.hairline, borderRadius: radius.pill, borderWidth: 1, flexDirection: "row", gap: spacing[2], minHeight: 44, paddingHorizontal: spacing[4], paddingVertical: spacing[2] },
  ghostButtonText: { color: colors.textSecondary, fontFamily: fontFamilies.interface, fontSize: 12, fontWeight: "800" },
  pressed: { opacity: 0.72 }
});
