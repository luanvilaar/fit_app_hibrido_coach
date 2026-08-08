import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { colors, fontFamilies, radius, spacing, typeScale } from "@fitblock/design-tokens";
import { trainingGroupLevels, updateTeamField, type TeamForm as TeamFormValue } from "@/data/coach-teams";

const levelLabels: Record<(typeof trainingGroupLevels)[number], string> = {
  iniciante: "Iniciante",
  intermediário: "Intermediário",
  avançado: "Avançado"
};

export type TeamFormMode = "create" | "edit";

type TeamFormProps = {
  form: TeamFormValue;
  mode: TeamFormMode;
  isSaving: boolean;
  onChange: (form: TeamFormValue) => void;
  onSubmit: () => void;
  onCancel?: () => void;
};

export function TeamForm({ form, mode, isSaving, onChange, onSubmit, onCancel }: TeamFormProps) {
  const isEditing = mode === "edit";

  return (
    <View style={styles.card} testID="coach-team-form">
      <View style={styles.header}>
        <Text style={styles.eyebrow}>{isEditing ? "EDITAR EQUIPE" : "NOVA EQUIPE"}</Text>
        <Text style={styles.title}>{isEditing ? "Ajustar dados da equipe" : "Criar uma equipe"}</Text>
      </View>

      <FieldLabel label="Nome" />
      <TextInput
        accessibilityLabel="Nome da equipe"
        onChangeText={(value) => onChange(updateTeamField(form, "name", value))}
        placeholder="Ex.: Strength Base"
        placeholderTextColor={colors.textMuted}
        style={styles.input}
        testID="team-name"
        value={form.name}
      />

      <FieldLabel label="Descrição" hint="opcional" />
      <TextInput
        accessibilityLabel="Descrição da equipe"
        multiline
        numberOfLines={2}
        onChangeText={(value) => onChange(updateTeamField(form, "description", value))}
        placeholder="Ex.: Turma de força para intermediários."
        placeholderTextColor={colors.textMuted}
        style={[styles.input, styles.textArea]}
        testID="team-description"
        value={form.description}
      />

      <FieldLabel label="Nível" />
      <View accessibilityRole="radiogroup" accessibilityLabel="Nível da equipe" style={styles.chipRow}>
        {trainingGroupLevels.map((level) => (
          <Pressable
            key={level}
            accessibilityRole="radio"
            accessibilityLabel={levelLabels[level]}
            accessibilityState={{ selected: form.level === level }}
            testID={`team-level-${level}`}
            onPress={() => onChange(updateTeamField(form, "level", level))}
            style={({ pressed }) => [
              styles.chip,
              form.level === level && styles.chipActive,
              pressed && styles.pressed
            ]}
          >
            <Text style={[styles.chipText, form.level === level && styles.chipTextActive]}>
              {levelLabels[level]}
            </Text>
          </Pressable>
        ))}
      </View>

      <FieldLabel label="Objetivo" />
      <TextInput
        accessibilityLabel="Objetivo da equipe"
        onChangeText={(value) => onChange(updateTeamField(form, "objective", value))}
        placeholder="Ex.: Ganhar força nos levantamentos básicos."
        placeholderTextColor={colors.textMuted}
        style={styles.input}
        testID="team-objective"
        value={form.objective}
      />

      <View style={styles.actionsRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={isEditing ? "Salvar alterações da equipe" : "Criar equipe"}
          accessibilityState={{ disabled: isSaving }}
          disabled={isSaving}
          testID="submit-team"
          onPress={onSubmit}
          style={({ pressed }) => [styles.submitButton, isSaving && styles.submitButtonDisabled, pressed && styles.pressed]}
        >
          <Text style={styles.submitButtonText}>
            {isSaving ? "Salvando..." : isEditing ? "Salvar alterações" : "Criar equipe"}
          </Text>
          <Ionicons name="arrow-forward" size={16} color={colors.canvas} />
        </Pressable>
        {isEditing && onCancel && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Cancelar edição da equipe"
            testID="cancel-team-edit"
            onPress={onCancel}
            style={({ pressed }) => [styles.ghostButton, pressed && styles.pressed]}
          >
            <Text style={styles.ghostButtonText}>Cancelar</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

function FieldLabel({ label, hint }: { label: string; hint?: string }) {
  return (
    <View style={styles.fieldLabelRow}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {hint && <Text style={styles.fieldHint}>{hint}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.canvas,
    borderColor: colors.hairline,
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing[5]
  },
  header: { marginBottom: spacing[4] },
  eyebrow: {
    color: colors.textMuted,
    fontFamily: fontFamilies.interface,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.3
  },
  title: {
    color: colors.ink,
    fontFamily: fontFamilies.interface,
    fontSize: typeScale.headingLg,
    fontWeight: "700",
    marginTop: spacing[2]
  },
  fieldLabelRow: {
    alignItems: "baseline",
    flexDirection: "row",
    gap: spacing[2],
    marginBottom: spacing[2],
    marginTop: spacing[4]
  },
  fieldLabel: { color: colors.ink, fontFamily: fontFamilies.interface, fontSize: 12, fontWeight: "800" },
  fieldHint: { color: colors.textMuted, fontFamily: fontFamilies.interface, fontSize: 11 },
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
  textArea: { minHeight: 72, paddingTop: spacing[3], textAlignVertical: "top" },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing[2] },
  chip: {
    borderColor: colors.hairline,
    borderRadius: radius.pill,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 40,
    paddingHorizontal: spacing[4]
  },
  chipActive: { backgroundColor: colors.fitblockPurple, borderColor: colors.fitblockPurple },
  chipText: { color: colors.textSecondary, fontFamily: fontFamilies.interface, fontSize: 12, fontWeight: "700" },
  chipTextActive: { color: colors.canvas },
  actionsRow: { alignItems: "center", flexDirection: "row", gap: spacing[3], marginTop: spacing[5] },
  submitButton: {
    alignItems: "center",
    backgroundColor: colors.fitblockPurple,
    borderRadius: radius.pill,
    flexDirection: "row",
    gap: spacing[3],
    justifyContent: "center",
    minHeight: 48,
    paddingHorizontal: spacing[5]
  },
  submitButtonDisabled: { opacity: 0.45 },
  submitButtonText: { color: colors.canvas, fontFamily: fontFamilies.interface, fontSize: 13, fontWeight: "700" },
  ghostButton: {
    alignItems: "center",
    borderColor: colors.hairline,
    borderRadius: radius.pill,
    borderWidth: 1,
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: spacing[4]
  },
  ghostButtonText: { color: colors.textSecondary, fontFamily: fontFamilies.interface, fontSize: 12, fontWeight: "800" },
  pressed: { opacity: 0.72 }
});
