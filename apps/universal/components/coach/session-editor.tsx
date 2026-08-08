import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { colors, fontFamilies, radius, spacing, typeScale } from "@fitblock/design-tokens";
import type { ExerciseRecord, TrainingGroupRecord } from "@fitblock/backend";
import { BlockEditor, FieldLabel, TextButton } from "@/components/coach/block-editor";
import {
  addBlock,
  addBlockSet,
  addItem,
  addSet,
  removeBlock,
  removeBlockSet,
  removeItem,
  removeSet,
  summarizeCoachSessionForm,
  updateBlock,
  updateBlockRanking,
  updateBlockSet,
  updateBlockVolume,
  updateItem,
  updateSessionField,
  updateSet,
  type CoachSessionForm,
  type SessionStatus
} from "@/data/coach-calendar";

export type SessionEditorMode = "create" | "edit";

type SessionEditorProps = {
  form: CoachSessionForm;
  teams: TrainingGroupRecord[];
  exercises: ExerciseRecord[];
  mode: SessionEditorMode;
  isLoadingTeams: boolean;
  isSaving: boolean;
  isDeleting: boolean;
  isConfirmingDelete: boolean;
  onChange: (form: CoachSessionForm) => void;
  onSubmit: () => void;
  onCancelEdit: () => void;
  onRequestDelete: () => void;
  onConfirmDelete: () => void;
  onDismissDelete: () => void;
};

const statusOptions: Array<{ value: SessionStatus; label: string; hint: string }> = [
  { value: "draft", label: "Rascunho", hint: "Só você enxerga" },
  { value: "published", label: "Publicado", hint: "Visível ao atleta" }
];

export function SessionEditor({
  form,
  teams,
  exercises,
  mode,
  isLoadingTeams,
  isSaving,
  isDeleting,
  isConfirmingDelete,
  onChange,
  onSubmit,
  onCancelEdit,
  onRequestDelete,
  onConfirmDelete,
  onDismissDelete
}: SessionEditorProps) {
  const isEditing = mode === "edit";
  const summary = summarizeCoachSessionForm(form);
  const isBusy = isSaving || isDeleting;
  const isSubmitDisabled = isBusy || isLoadingTeams || teams.length === 0;

  return (
    <View style={styles.card} testID="coach-session-editor">
      <View style={styles.cardHeader}>
        <View style={styles.cardHeaderCopy}>
          <Text style={styles.cardEyebrow}>{isEditing ? "EDITAR SESSÃO" : "NOVA PRESCRIÇÃO"}</Text>
          <Text style={styles.cardTitle}>{isEditing ? "Ajustar treino" : "Publicar no calendário"}</Text>
        </View>
        {isEditing ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Cancelar edição"
            testID="cancel-edit"
            onPress={onCancelEdit}
            style={({ pressed }) => [styles.ghostButton, pressed && styles.pressed]}
          >
            <Ionicons name="close" size={16} color={colors.textSecondary} />
            <Text style={styles.ghostButtonText}>Cancelar</Text>
          </Pressable>
        ) : (
          <View style={styles.stepBadge}>
            <Text style={styles.stepBadgeText}>01</Text>
          </View>
        )}
      </View>

      <Text style={styles.fieldLabel}>Equipe</Text>
      {isLoadingTeams && <Text style={styles.helperText}>Buscando suas equipes...</Text>}
      {!isLoadingTeams && teams.length === 0 && (
        <Text style={styles.helperText}>Nenhuma equipe de coach encontrada para esta conta.</Text>
      )}
      <View accessibilityRole="radiogroup" accessibilityLabel="Equipe da sessão" style={styles.teamList}>
        {teams.map((team) => (
          <Pressable
            key={team.id}
            accessibilityRole="radio"
            accessibilityLabel={team.name}
            accessibilityState={{ selected: form.teamId === team.id, disabled: isEditing }}
            disabled={isEditing}
            testID={`team-option-${team.id}`}
            onPress={() => onChange(updateSessionField(form, "teamId", team.id))}
            style={({ pressed }) => [
              styles.teamOption,
              form.teamId === team.id && styles.teamOptionSelected,
              isEditing && form.teamId !== team.id && styles.teamOptionMuted,
              pressed && styles.pressed
            ]}
          >
            <View style={[styles.teamRadio, form.teamId === team.id && styles.teamRadioSelected]}>
              {form.teamId === team.id && <View style={styles.teamRadioDot} />}
            </View>
            <View style={styles.teamOptionCopy}>
              <Text style={styles.teamOptionName}>{team.name}</Text>
              <Text style={styles.teamOptionMeta}>{team.level} · {team.objective}</Text>
            </View>
          </Pressable>
        ))}
      </View>
      {isEditing && <Text style={styles.helperText}>A equipe de uma sessão publicada não pode mudar.</Text>}

      <View style={styles.fieldRow}>
        <View style={styles.fieldHalf}>
          <FieldLabel label="Título da sessão" />
          <TextInput
            accessibilityLabel="Título da sessão"
            autoCapitalize="sentences"
            onChangeText={(value) => onChange(updateSessionField(form, "title", value))}
            placeholder="Ex.: Lower Strength"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
            testID="session-title"
            value={form.title}
          />
        </View>
        <View style={styles.fieldHalf}>
          <FieldLabel label="Data" hint="AAAA-MM-DD" />
          <TextInput
            accessibilityLabel="Data da sessão"
            autoCapitalize="none"
            keyboardType="numbers-and-punctuation"
            onChangeText={(value) => onChange(updateSessionField(form, "scheduledDate", value))}
            placeholder="2026-08-10"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
            testID="session-date"
            value={form.scheduledDate}
          />
        </View>
      </View>

      <View style={styles.statusRow}>
        <FieldLabel label="Visibilidade" />
        <View accessibilityRole="radiogroup" accessibilityLabel="Visibilidade da sessão" style={styles.chipRow}>
          {statusOptions.map((option) => (
            <Pressable
              key={option.value}
              accessibilityRole="radio"
              accessibilityLabel={option.label}
              accessibilityState={{ selected: form.status === option.value }}
              testID={`status-${option.value}`}
              onPress={() => onChange(updateSessionField(form, "status", option.value))}
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

      <View style={styles.noteRow}>
        <FieldLabel label="Recado para o atleta" hint="opcional" />
        <TextInput
          accessibilityLabel="Recado para o atleta"
          autoCapitalize="sentences"
          multiline
          numberOfLines={3}
          onChangeText={(value) => onChange(updateSessionField(form, "coachNote", value))}
          placeholder="Ex.: Controle o ritmo nas primeiras séries."
          placeholderTextColor={colors.textMuted}
          style={[styles.input, styles.noteInput]}
          testID="session-coach-note"
          value={form.coachNote}
        />
        <Text style={styles.helperText}>Aparece na aba Hoje do atleta junto com a sessão.</Text>
      </View>

      <View style={styles.divider} />

      {form.blocks.map((block, blockIndex) => (
        <BlockEditor
          key={block.id}
          block={block}
          blockIndex={blockIndex}
          exercises={exercises}
          canRemove={form.blocks.length > 1}
          onRemoveBlock={() => onChange(removeBlock(form, block.id))}
          onChangeBlock={(patch) => onChange(updateBlock(form, block.id, patch))}
          onChangeRanking={(patch) => onChange(updateBlockRanking(form, block.id, patch))}
          onChangeVolume={(modality, patch) => onChange(updateBlockVolume(form, block.id, modality, patch))}
          onAddBlockSet={() => onChange(addBlockSet(form, block.id))}
          onRemoveBlockSet={(setId) => onChange(removeBlockSet(form, block.id, setId))}
          onChangeBlockSet={(setId, patch) => onChange(updateBlockSet(form, block.id, setId, patch))}
          onAddItem={() => onChange(addItem(form, block.id))}
          onRemoveItem={(itemId) => onChange(removeItem(form, block.id, itemId))}
          onChangeItem={(itemId, patch) => onChange(updateItem(form, block.id, itemId, patch))}
          onAddSet={(itemId) => onChange(addSet(form, block.id, itemId))}
          onRemoveSet={(itemId, setId) => onChange(removeSet(form, block.id, itemId, setId))}
          onChangeSet={(itemId, setId, patch) => onChange(updateSet(form, block.id, itemId, setId, patch))}
        />
      ))}

      <TextButton icon="layers-outline" label="Adicionar bloco" testID="add-block" onPress={() => onChange(addBlock(form))} />

      <View style={styles.summaryCard}>
        <Text style={styles.summaryLabel}>RESUMO</Text>
        <Text style={styles.summaryValue}>
          {summary.blocks} {summary.blocks === 1 ? "bloco" : "blocos"} · {summary.exercises}{" "}
          {summary.exercises === 1 ? "exercício" : "exercícios"} · {summary.sets}{" "}
          {summary.sets === 1 ? "série" : "séries"}
        </Text>
      </View>

      <View style={styles.actionsRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={isEditing ? "Salvar alterações da sessão" : "Publicar treino no calendário"}
          accessibilityState={{ disabled: isSubmitDisabled }}
          disabled={isSubmitDisabled}
          testID="submit-session"
          onPress={onSubmit}
          style={({ pressed }) => [
            styles.submitButton,
            isSubmitDisabled && styles.submitButtonDisabled,
            pressed && styles.pressed
          ]}
        >
          <Text style={styles.submitButtonText}>
            {isSaving ? "Salvando..." : isEditing ? "Salvar alterações" : "Publicar treino"}
          </Text>
          <Ionicons name="arrow-forward" size={17} color={colors.canvas} />
        </Pressable>

        {isEditing && !isConfirmingDelete && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Excluir sessão"
            accessibilityState={{ disabled: isBusy }}
            disabled={isBusy}
            testID="request-delete"
            onPress={onRequestDelete}
            style={({ pressed }) => [styles.dangerButton, isBusy && styles.submitButtonDisabled, pressed && styles.pressed]}
          >
            <Ionicons name="trash-outline" size={16} color={colors.danger} />
            <Text style={styles.dangerButtonText}>Excluir</Text>
          </Pressable>
        )}
      </View>

      {isEditing && isConfirmingDelete && (
        <View style={styles.confirmCard} testID="delete-confirmation">
          <Text style={styles.confirmTitle}>Excluir esta sessão do calendário?</Text>
          <Text style={styles.confirmText}>
            O treino sai do calendário do coach e do atleta. Esta ação não pode ser desfeita.
          </Text>
          <View style={styles.confirmActions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Confirmar exclusão da sessão"
              accessibilityState={{ disabled: isDeleting }}
              disabled={isDeleting}
              testID="confirm-delete"
              onPress={onConfirmDelete}
              style={({ pressed }) => [styles.confirmDangerButton, pressed && styles.pressed]}
            >
              <Text style={styles.confirmDangerText}>{isDeleting ? "Excluindo..." : "Sim, excluir"}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Manter a sessão"
              testID="dismiss-delete"
              onPress={onDismissDelete}
              style={({ pressed }) => [styles.ghostButton, pressed && styles.pressed]}
            >
              <Text style={styles.ghostButtonText}>Manter</Text>
            </Pressable>
          </View>
        </View>
      )}
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
  cardHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: spacing[5]
  },
  cardHeaderCopy: { flex: 1, minWidth: 0 },
  cardEyebrow: {
    color: colors.textMuted,
    fontFamily: fontFamilies.interface,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.3
  },
  cardTitle: {
    color: colors.ink,
    fontFamily: fontFamilies.interface,
    fontSize: typeScale.headingLg,
    fontWeight: "700",
    marginTop: spacing[2]
  },
  stepBadge: {
    alignItems: "center",
    backgroundColor: "#F3EFFF",
    borderRadius: radius.pill,
    height: 34,
    justifyContent: "center",
    width: 34
  },
  stepBadgeText: { color: colors.fitblockPurple, fontFamily: fontFamilies.interface, fontSize: 11, fontWeight: "700" },
  fieldLabelRow: { alignItems: "baseline", flexDirection: "row", gap: spacing[2], marginBottom: spacing[2] },
  fieldLabel: { color: colors.ink, fontFamily: fontFamilies.interface, fontSize: 12, fontWeight: "800" },
  fieldHint: { color: colors.textMuted, fontFamily: fontFamilies.interface, fontSize: 11 },
  helperText: { color: colors.textSecondary, fontFamily: fontFamilies.interface, fontSize: 13, lineHeight: 20 },
  teamList: { gap: spacing[2], marginBottom: spacing[2], marginTop: spacing[2] },
  teamOption: {
    alignItems: "center",
    borderColor: colors.hairline,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing[3],
    minHeight: 56,
    padding: spacing[3]
  },
  teamOptionSelected: { backgroundColor: "#F8F6FF", borderColor: colors.fitblockPurple },
  teamOptionMuted: { opacity: 0.45 },
  teamRadio: {
    alignItems: "center",
    borderColor: colors.textMuted,
    borderRadius: radius.pill,
    borderWidth: 1,
    height: 18,
    justifyContent: "center",
    width: 18
  },
  teamRadioSelected: { borderColor: colors.fitblockPurple },
  teamRadioDot: { backgroundColor: colors.fitblockPurple, borderRadius: radius.pill, height: 8, width: 8 },
  teamOptionCopy: { flex: 1, minWidth: 0 },
  teamOptionName: { color: colors.ink, fontFamily: fontFamilies.interface, fontSize: 13, fontWeight: "800" },
  teamOptionMeta: { color: colors.textSecondary, fontFamily: fontFamilies.interface, fontSize: 11, marginTop: 3 },
  fieldRow: { flexDirection: "row", gap: spacing[3], marginTop: spacing[4] },
  fieldRowTight: { alignItems: "flex-end", flexDirection: "row", gap: spacing[2], zIndex: 20 },
  fieldHalf: { flex: 1, minWidth: 0 },
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
  input: {
    backgroundColor: colors.softCloud,
    borderColor: colors.hairline,
    borderRadius: radius.sm,
    borderWidth: 1,
    color: colors.ink,
    fontFamily: fontFamilies.interface,
    fontSize: 14,
    minHeight: 44,
    paddingHorizontal: spacing[3]
  },
  statusRow: { marginTop: spacing[4] },
  noteRow: { gap: spacing[2], marginTop: spacing[4] },
  noteInput: { minHeight: 80, paddingTop: spacing[3], textAlignVertical: "top" },
  chipRow: { flexDirection: "row", gap: spacing[2] },
  statusChip: {
    borderColor: colors.hairline,
    borderRadius: radius.sm,
    borderWidth: 1,
    flex: 1,
    justifyContent: "center",
    minHeight: 48,
    paddingHorizontal: spacing[3]
  },
  statusChipActive: { backgroundColor: "#F8F6FF", borderColor: colors.fitblockPurple },
  statusChipText: { color: colors.ink, fontFamily: fontFamilies.interface, fontSize: 13, fontWeight: "800" },
  statusChipTextActive: { color: colors.fitblockPurple },
  statusChipHint: { color: colors.textMuted, fontFamily: fontFamilies.interface, fontSize: 10, marginTop: 2 },
  statusChipHintActive: { color: colors.fitblockPurpleDark },
  divider: { backgroundColor: colors.hairline, height: 1, marginTop: spacing[5] },
  blockCard: {
    borderColor: colors.hairline,
    borderRadius: radius.md,
    borderWidth: 1,
    marginTop: spacing[5],
    padding: spacing[4]
  },
  blockHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: spacing[3]
  },
  blockBadge: {
    color: colors.fitblockPurple,
    fontFamily: fontFamilies.interface,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.2
  },
  kindRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing[2], marginTop: spacing[3] },
  kindChip: {
    borderColor: colors.hairline,
    borderRadius: radius.pill,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 34,
    paddingHorizontal: spacing[3]
  },
  kindChipActive: { backgroundColor: colors.fitblockPurple, borderColor: colors.fitblockPurple },
  kindChipText: { color: colors.textSecondary, fontFamily: fontFamilies.interface, fontSize: 11, fontWeight: "700" },
  kindChipTextActive: { color: colors.canvas },
  itemCard: {
    backgroundColor: colors.softCloud,
    borderRadius: radius.sm,
    marginTop: spacing[4],
    padding: spacing[3]
  },
  setHeader: { flexDirection: "row", gap: spacing[2], marginTop: spacing[4] },
  setHeaderIndex: {
    color: colors.textMuted,
    fontFamily: fontFamilies.interface,
    fontSize: 10,
    fontWeight: "800",
    width: 20
  },
  setHeaderLabel: {
    color: colors.textMuted,
    flex: 1,
    fontFamily: fontFamilies.interface,
    fontSize: 10,
    fontWeight: "800"
  },
  setHeaderSpacer: { width: 32 },
  setRow: { alignItems: "center", flexDirection: "row", gap: spacing[2], marginTop: spacing[2] },
  setIndex: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.interface,
    fontSize: 12,
    fontWeight: "800",
    width: 20
  },
  setInput: { backgroundColor: colors.canvas, flex: 1 },
  setRemove: { alignItems: "center", width: 32 },
  iconAction: { alignItems: "center", borderRadius: radius.pill, height: 44, justifyContent: "center", width: 44 },
  textButton: {
    alignItems: "center",
    alignSelf: "flex-start",
    flexDirection: "row",
    gap: spacing[2],
    marginTop: spacing[3],
    minHeight: 44,
    paddingHorizontal: spacing[2]
  },
  textButtonLabel: {
    color: colors.fitblockPurple,
    fontFamily: fontFamilies.interface,
    fontSize: 12,
    fontWeight: "800"
  },
  summaryCard: {
    backgroundColor: "#F8F6FF",
    borderRadius: radius.sm,
    justifyContent: "center",
    marginTop: spacing[5],
    minHeight: 62,
    paddingHorizontal: spacing[4]
  },
  summaryLabel: {
    color: colors.fitblockPurple,
    fontFamily: fontFamilies.interface,
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 1
  },
  summaryValue: { color: colors.ink, fontFamily: fontFamilies.interface, fontSize: 13, fontWeight: "800", marginTop: spacing[1] },
  actionsRow: { alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: spacing[3], marginTop: spacing[5] },
  submitButton: {
    alignItems: "center",
    backgroundColor: colors.fitblockPurple,
    borderRadius: radius.pill,
    flexDirection: "row",
    gap: spacing[5],
    justifyContent: "space-between",
    minHeight: 50,
    paddingHorizontal: spacing[5]
  },
  submitButtonDisabled: { opacity: 0.45 },
  submitButtonText: { color: colors.canvas, fontFamily: fontFamilies.interface, fontSize: 13, fontWeight: "700" },
  dangerButton: {
    alignItems: "center",
    borderColor: "#F3C3C8",
    borderRadius: radius.pill,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing[2],
    minHeight: 50,
    paddingHorizontal: spacing[4]
  },
  dangerButtonText: { color: colors.danger, fontFamily: fontFamilies.interface, fontSize: 13, fontWeight: "800" },
  ghostButton: {
    alignItems: "center",
    borderColor: colors.hairline,
    borderRadius: radius.pill,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing[2],
    minHeight: 44,
    paddingHorizontal: spacing[4]
  },
  ghostButtonText: { color: colors.textSecondary, fontFamily: fontFamilies.interface, fontSize: 12, fontWeight: "800" },
  confirmCard: {
    backgroundColor: "#FDF2F3",
    borderColor: "#F3C3C8",
    borderRadius: radius.md,
    borderWidth: 1,
    marginTop: spacing[4],
    padding: spacing[4]
  },
  confirmTitle: { color: colors.ink, fontFamily: fontFamilies.interface, fontSize: 14, fontWeight: "700" },
  confirmText: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.interface,
    fontSize: 13,
    lineHeight: 20,
    marginTop: spacing[2]
  },
  confirmActions: { flexDirection: "row", gap: spacing[3], marginTop: spacing[4] },
  confirmDangerButton: {
    alignItems: "center",
    backgroundColor: colors.danger,
    borderRadius: radius.pill,
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: spacing[5]
  },
  confirmDangerText: { color: colors.canvas, fontFamily: fontFamilies.interface, fontSize: 13, fontWeight: "800" },
  pressed: { opacity: 0.72 }
});
