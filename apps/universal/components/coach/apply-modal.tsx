import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { colors, fontFamilies, radius, spacing } from "@fitblock/design-tokens";
import type { TrainingGroupRecord } from "@fitblock/backend";

export type ApplyForm = {
  teamId: string;
  scheduledDate: string;
};

type ApplyModalProps = {
  templateTitle: string;
  teams: TrainingGroupRecord[];
  form: ApplyForm;
  isLoading?: boolean;
  onChangeForm: (form: ApplyForm) => void;
  onConfirm: () => void;
  onDismiss: () => void;
};

export function ApplyModal({
  templateTitle,
  teams,
  form,
  isLoading = false,
  onChangeForm,
  onConfirm,
  onDismiss
}: ApplyModalProps) {
  const isValidDate = /^\d{4}-\d{2}-\d{2}$/.test(form.scheduledDate) && !Number.isNaN(new Date(form.scheduledDate).getTime());
  const isFormValid = form.teamId.length > 0 && isValidDate;

  return (
    <View style={styles.backdrop}>
      <View style={styles.modal} testID="apply-modal">
        <View style={styles.header}>
          <View>
            <Text style={styles.label}>Aplicar treino</Text>
            <Text style={styles.templateTitle}>{templateTitle}</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Fechar aplicador de treino"
            testID="dismiss-apply-modal"
            onPress={onDismiss}
            style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}
          >
            <Ionicons name="close" size={20} color={colors.ink} />
          </Pressable>
        </View>

        {teams.length === 0 ? (
          <Text style={styles.errorText}>Nenhuma equipe disponível. Crie uma equipe primeiro.</Text>
        ) : (
          <>
            <Text style={styles.fieldLabel}>Selecionar equipe</Text>
            <View accessibilityRole="radiogroup" accessibilityLabel="Equipe para aplicar o treino" style={styles.teamList}>
              {teams.map((team) => (
                <Pressable
                  key={team.id}
                  accessibilityRole="radio"
                  accessibilityLabel={team.name}
                  accessibilityState={{ selected: form.teamId === team.id }}
                  testID={`apply-team-${team.id}`}
                  onPress={() => onChangeForm({ ...form, teamId: team.id })}
                  style={({ pressed }) => [
                    styles.teamOption,
                    form.teamId === team.id && styles.teamOptionSelected,
                    pressed && styles.pressed
                  ]}
                >
                  <Ionicons
                    name={form.teamId === team.id ? "radio-button-on" : "radio-button-off"}
                    size={20}
                    color={form.teamId === team.id ? colors.fitblockPurple : colors.textMuted}
                  />
                  <Text style={styles.teamOptionText}>{team.name}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.fieldLabel}>Data do agendamento (AAAA-MM-DD)</Text>
            <TextInput
              accessibilityLabel="Data para aplicar o treino"
              autoCapitalize="none"
              keyboardType="numbers-and-punctuation"
              onChangeText={(text) => {
                const formatted = formatDateInput(text);
                onChangeForm({ ...form, scheduledDate: formatted });
              }}
              placeholder="2026-08-10"
              placeholderTextColor={colors.textMuted}
              style={[styles.input, !isValidDate && form.scheduledDate.length > 0 && styles.inputError]}
              testID="apply-date-input"
              value={form.scheduledDate}
            />
            {!isValidDate && form.scheduledDate.length > 0 && (
              <Text style={styles.errorTextInline}>Data inválida</Text>
            )}

            <View style={styles.actions}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Confirmar aplicação do treino"
                accessibilityState={{ disabled: isLoading || !isFormValid }}
                disabled={isLoading || !isFormValid}
                testID="confirm-apply-modal"
                onPress={onConfirm}
                style={({ pressed }) => [
                  styles.confirmButton,
                  (!isFormValid || isLoading) && styles.confirmButtonDisabled,
                  pressed && styles.pressed
                ]}
              >
                <Text style={styles.confirmButtonText}>{isLoading ? "Aplicando..." : "Aplicar treino"}</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Cancelar"
                testID="cancel-apply-modal"
                onPress={onDismiss}
                style={({ pressed }) => [styles.cancelButton, pressed && styles.pressed]}
              >
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </Pressable>
            </View>
          </>
        )}
      </View>
    </View>
  );
}

function formatDateInput(text: string): string {
  const numbers = text.replace(/\D/g, "");
  if (numbers.length <= 4) return numbers;
  if (numbers.length <= 6) return `${numbers.slice(0, 4)}-${numbers.slice(4)}`;
  return `${numbers.slice(0, 4)}-${numbers.slice(4, 6)}-${numbers.slice(6, 8)}`;
}

const styles = StyleSheet.create({
  backdrop: {
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    flex: 1,
    justifyContent: "center",
    padding: spacing[4]
  },
  modal: {
    backgroundColor: colors.canvas,
    borderRadius: radius.lg,
    maxWidth: 450,
    maxHeight: "80%",
    padding: spacing[5],
    width: "100%"
  },
  header: { alignItems: "flex-start", flexDirection: "row", justifyContent: "space-between", marginBottom: spacing[4] },
  label: { color: colors.textMuted, fontFamily: fontFamilies.interface, fontSize: 12, fontWeight: "700", letterSpacing: 1 },
  templateTitle: { color: colors.ink, fontFamily: fontFamilies.interface, fontSize: 16, fontWeight: "700", marginTop: spacing[1] },
  closeButton: { alignItems: "center", height: 40, justifyContent: "center", width: 40 },
  fieldLabel: { color: colors.ink, fontFamily: fontFamilies.interface, fontSize: 13, fontWeight: "800", marginBottom: spacing[2], marginTop: spacing[4] },
  teamList: { gap: spacing[2], marginBottom: spacing[3] },
  teamOption: {
    alignItems: "center",
    borderColor: colors.hairline,
    borderRadius: radius.sm,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing[3],
    minHeight: 44,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2]
  },
  teamOptionSelected: { backgroundColor: colors.softCloud, borderColor: colors.fitblockPurple },
  teamOptionText: { color: colors.ink, fontFamily: fontFamilies.interface, fontSize: 14, fontWeight: "700", flex: 1 },
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
  inputError: { borderColor: colors.danger, backgroundColor: "#FFF5F5" },
  errorText: { color: colors.danger, fontFamily: fontFamilies.interface, fontSize: 14, fontWeight: "600", marginBottom: spacing[4] },
  errorTextInline: { color: colors.danger, fontFamily: fontFamilies.interface, fontSize: 12, fontWeight: "600", marginTop: spacing[1], marginBottom: spacing[3] },
  actions: { flexDirection: "row", gap: spacing[3], marginTop: spacing[5] },
  confirmButton: {
    alignItems: "center",
    backgroundColor: colors.fitblockPurple,
    borderRadius: radius.pill,
    flex: 1,
    justifyContent: "center",
    minHeight: 44,
    paddingVertical: spacing[3]
  },
  confirmButtonDisabled: { backgroundColor: "#E8E6F0", opacity: 1 },
  confirmButtonText: { color: colors.canvas, fontFamily: fontFamilies.interface, fontSize: 14, fontWeight: "700" },
  cancelButton: {
    alignItems: "center",
    borderColor: colors.hairline,
    borderRadius: radius.pill,
    borderWidth: 1,
    flex: 1,
    justifyContent: "center",
    minHeight: 44,
    paddingVertical: spacing[3]
  },
  cancelButtonText: { color: colors.ink, fontFamily: fontFamilies.interface, fontSize: 14, fontWeight: "700" },
  pressed: { opacity: 0.72 }
});
