import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, fontFamilies, radius, spacing } from "@fitblock/design-tokens";

type ConfirmationModalProps = {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isDangerous?: boolean;
  isLoading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmationModal({
  title,
  message,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  isDangerous = false,
  isLoading = false,
  onConfirm,
  onCancel
}: ConfirmationModalProps) {
  return (
    <View style={styles.backdrop}>
      <View style={styles.modal} testID="confirmation-modal">
        <View style={styles.iconContainer}>
          <Ionicons
            name={isDangerous ? "warning-outline" : "checkmark-circle-outline"}
            size={48}
            color={isDangerous ? colors.danger : colors.fitblockPurple}
          />
        </View>

        <Text style={styles.title}>{title}</Text>
        <Text style={styles.message}>{message}</Text>

        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={confirmLabel}
            accessibilityState={{ disabled: isLoading }}
            disabled={isLoading}
            testID="confirm-modal-button"
            onPress={onConfirm}
            style={({ pressed }) => [
              styles.confirmButton,
              isDangerous && styles.confirmButtonDanger,
              isLoading && styles.buttonDisabled,
              pressed && styles.pressed
            ]}
          >
            <Text style={[styles.confirmButtonText, isDangerous && styles.confirmButtonTextDanger]}>
              {isLoading ? "Processando..." : confirmLabel}
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={cancelLabel}
            testID="cancel-modal-button"
            onPress={onCancel}
            style={({ pressed }) => [styles.cancelButton, pressed && styles.pressed]}
          >
            <Text style={styles.cancelButtonText}>{cancelLabel}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
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
    alignItems: "center",
    backgroundColor: colors.canvas,
    borderRadius: radius.lg,
    maxWidth: 400,
    padding: spacing[5],
    width: "100%"
  },
  iconContainer: { marginBottom: spacing[4] },
  title: { color: colors.ink, fontFamily: fontFamilies.interface, fontSize: 18, fontWeight: "700", marginBottom: spacing[3], textAlign: "center" },
  message: { color: colors.textSecondary, fontFamily: fontFamilies.interface, fontSize: 14, lineHeight: 20, marginBottom: spacing[5], textAlign: "center" },
  actions: { flexDirection: "row", gap: spacing[3], width: "100%" },
  confirmButton: {
    alignItems: "center",
    backgroundColor: colors.fitblockPurple,
    borderRadius: radius.pill,
    flex: 1,
    justifyContent: "center",
    minHeight: 44,
    paddingVertical: spacing[3]
  },
  confirmButtonDanger: { backgroundColor: colors.danger },
  confirmButtonDisabled: { backgroundColor: "#E8E6F0", opacity: 1 },
  confirmButtonText: { color: colors.canvas, fontFamily: fontFamilies.interface, fontSize: 14, fontWeight: "700" },
  confirmButtonTextDanger: { color: colors.canvas },
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
  buttonDisabled: { opacity: 0.6 },
  pressed: { opacity: 0.72 }
});
