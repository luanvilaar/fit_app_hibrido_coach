import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { colors, fontFamilies, radius, shadows, spacing, typeScale } from "@fitblock/design-tokens";
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
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [focusedControl, setFocusedControl] = useState<string | null>(null);

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
        onFocus={() => setFocusedField("name")}
        onBlur={() => setFocusedField(null)}
        placeholder="Ex.: Strength Base"
        placeholderTextColor={colors.textSecondary}
        style={[styles.input, focusedField === "name" && styles.inputFocused]}
        testID="team-name"
        value={form.name}
      />

      <FieldLabel label="Descrição" hint="opcional" />
      <TextInput
        accessibilityLabel="Descrição da equipe"
        multiline
        numberOfLines={2}
        onChangeText={(value) => onChange(updateTeamField(form, "description", value))}
        onFocus={() => setFocusedField("description")}
        onBlur={() => setFocusedField(null)}
        placeholder="Ex.: Turma de força para intermediários."
        placeholderTextColor={colors.textSecondary}
        style={[styles.input, styles.textArea, focusedField === "description" && styles.inputFocused]}
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
            onFocus={() => setFocusedControl(`level-${level}`)}
            onBlur={() => setFocusedControl(null)}
            style={({ pressed }) => [
              styles.chip,
              form.level === level && styles.chipActive,
              focusedControl === `level-${level}` && styles.focusedControl,
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
        onFocus={() => setFocusedField("objective")}
        onBlur={() => setFocusedField(null)}
        placeholder="Ex.: Ganhar força nos levantamentos básicos."
        placeholderTextColor={colors.textSecondary}
        style={[styles.input, focusedField === "objective" && styles.inputFocused]}
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
          onFocus={() => setFocusedControl("submit")}
          onBlur={() => setFocusedControl(null)}
          style={({ pressed }) => [
            styles.submitButton,
            isSaving && styles.submitButtonDisabled,
            focusedControl === "submit" && styles.focusedControl,
            pressed && styles.pressed
          ]}
        >
          <Text style={styles.submitButtonText}>
            {isSaving ? "Salvando..." : isEditing ? "Salvar alterações" : "Criar equipe"}
          </Text>
          <Ionicons name="arrow-forward" size={16} color={colors.white} />
        </Pressable>
        {isEditing && onCancel && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Cancelar edição da equipe"
            testID="cancel-team-edit"
            onPress={onCancel}
            onFocus={() => setFocusedControl("cancel")}
            onBlur={() => setFocusedControl(null)}
            style={({ pressed }) => [
              styles.ghostButton,
              focusedControl === "cancel" && styles.focusedControl,
              pressed && styles.pressed
            ]}
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
    backgroundColor: colors.surface02,
    borderColor: colors.border,
    borderRadius: radius.xl,
    borderWidth: 1,
    padding: spacing[5],
    ...shadows.card
  },
  header: { marginBottom: spacing[4] },
  eyebrow: {
    color: colors.purple500,
    fontFamily: fontFamilies.interfaceBold,
    fontSize: 10,
    letterSpacing: 1.3
  },
  title: {
    color: colors.textPrimary,
    fontFamily: fontFamilies.interfaceBold,
    fontSize: typeScale.headingMd,
    marginTop: spacing[2]
  },
  fieldLabelRow: {
    alignItems: "baseline",
    flexDirection: "row",
    gap: spacing[2],
    marginBottom: spacing[2],
    marginTop: spacing[4]
  },
  fieldLabel: { color: colors.textPrimary, fontFamily: fontFamilies.interfaceBold, fontSize: 12 },
  fieldHint: { color: colors.textSecondary, fontFamily: fontFamilies.interface, fontSize: 11 },
  input: {
    backgroundColor: colors.surface01,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    color: colors.textPrimary,
    fontFamily: fontFamilies.interface,
    fontSize: 14,
    minHeight: 48,
    paddingHorizontal: spacing[3]
  },
  inputFocused: { borderColor: colors.purple500, borderWidth: 2 },
  textArea: { minHeight: 72, paddingTop: spacing[3], textAlignVertical: "top" },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing[2] },
  chip: {
    borderColor: colors.border,
    borderRadius: radius.pill,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: spacing[4]
  },
  chipActive: { backgroundColor: colors.purple500, borderColor: colors.purple500 },
  focusedControl: { borderColor: colors.purple400, borderWidth: 3 },
  chipText: { color: colors.textSecondary, fontFamily: fontFamilies.interfaceSemiBold, fontSize: 12 },
  chipTextActive: { color: colors.textPrimary },
  actionsRow: { alignItems: "center", flexDirection: "row", gap: spacing[3], marginTop: spacing[5] },
  submitButton: {
    alignItems: "center",
    backgroundColor: colors.purple500,
    borderRadius: radius.pill,
    flexDirection: "row",
    gap: spacing[3],
    justifyContent: "center",
    minHeight: 52,
    paddingHorizontal: spacing[5]
  },
  submitButtonDisabled: { opacity: 0.45 },
  submitButtonText: { color: colors.white, fontFamily: fontFamilies.interfaceBold, fontSize: 13 },
  ghostButton: {
    alignItems: "center",
    borderColor: colors.border,
    borderRadius: radius.pill,
    borderWidth: 1,
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: spacing[4]
  },
  ghostButtonText: { color: colors.textSecondary, fontFamily: fontFamilies.interfaceBold, fontSize: 12 },
  pressed: { opacity: 0.72 }
});
