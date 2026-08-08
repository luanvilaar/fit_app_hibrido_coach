import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { colors, fontFamilies, radius, spacing } from "@fitblock/design-tokens";

type DatePickerModalProps = {
  value: string;
  onChangeDate: (date: string) => void;
  onConfirm: () => void;
  onDismiss: () => void;
  isLoading?: boolean;
};

export function DatePickerModal({ value, onChangeDate, onConfirm, onDismiss, isLoading = false }: DatePickerModalProps) {
  const isValidDate = /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(value).getTime());

  return (
    <View style={styles.backdrop}>
      <View style={styles.modal} testID="date-picker-modal">
        <View style={styles.header}>
          <Text style={styles.title}>Selecionar data</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Fechar seletor de data"
            testID="dismiss-date-picker"
            onPress={onDismiss}
            style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}
          >
            <Ionicons name="close" size={20} color={colors.ink} />
          </Pressable>
        </View>

        <Text style={styles.fieldLabel}>Data (AAAA-MM-DD)</Text>
        <TextInput
          accessibilityLabel="Data de agendamento"
          autoCapitalize="none"
          keyboardType="numbers-and-punctuation"
          onChangeText={(text) => {
            const formatted = formatDateInput(text);
            onChangeDate(formatted);
          }}
          placeholder="2026-08-10"
          placeholderTextColor={colors.textMuted}
          style={[styles.input, !isValidDate && value.length > 0 && styles.inputError]}
          testID="date-picker-input"
          value={value}
        />
        {!isValidDate && value.length > 0 && (
          <Text style={styles.errorText}>Data inválida. Use formato AAAA-MM-DD</Text>
        )}

        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Confirmar data"
            accessibilityState={{ disabled: isLoading || !isValidDate }}
            disabled={isLoading || !isValidDate}
            testID="confirm-date-picker"
            onPress={onConfirm}
            style={({ pressed }) => [
              styles.confirmButton,
              (isLoading || !isValidDate) && styles.confirmButtonDisabled,
              pressed && styles.pressed
            ]}
          >
            <Text style={styles.confirmButtonText}>{isLoading ? "Confirmando..." : "Confirmar"}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Cancelar"
            testID="cancel-date-picker"
            onPress={onDismiss}
            style={({ pressed }) => [styles.cancelButton, pressed && styles.pressed]}
          >
            <Text style={styles.cancelButtonText}>Cancelar</Text>
          </Pressable>
        </View>
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
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    flex: 1,
    justifyContent: "center",
    padding: spacing[4]
  },
  modal: {
    backgroundColor: colors.canvas,
    borderRadius: radius.lg,
    maxWidth: 400,
    padding: spacing[5],
    width: "100%"
  },
  header: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginBottom: spacing[4] },
  title: { color: colors.ink, fontFamily: fontFamilies.interface, fontSize: 16, fontWeight: "700" },
  closeButton: { alignItems: "center", height: 40, justifyContent: "center", width: 40 },
  fieldLabel: { color: colors.ink, fontFamily: fontFamilies.interface, fontSize: 13, fontWeight: "800", marginBottom: spacing[2] },
  input: {
    backgroundColor: colors.softCloud,
    borderColor: colors.hairline,
    borderRadius: radius.sm,
    borderWidth: 1,
    color: colors.ink,
    fontFamily: fontFamilies.interface,
    fontSize: 14,
    marginBottom: spacing[3],
    minHeight: 44,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3]
  },
  inputError: { borderColor: colors.danger, backgroundColor: "#FFF5F5" },
  errorText: { color: colors.danger, fontFamily: fontFamilies.interface, fontSize: 12, fontWeight: "600", marginBottom: spacing[3], marginTop: -spacing[2] },
  actions: { flexDirection: "row", gap: spacing[3], marginTop: spacing[4] },
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
