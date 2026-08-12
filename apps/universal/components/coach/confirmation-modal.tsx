import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, fontFamilies, radius, shadows, spacing } from "@fitblock/design-tokens";

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
  const [focusedControl, setFocusedControl] = useState<string | null>(null);

  return (
    <View style={styles.backdrop}>
      <View style={styles.modal} testID="confirmation-modal">
        <View style={[styles.iconContainer, isDangerous && styles.iconContainerDanger]}>
          <Ionicons
            name={isDangerous ? "warning-outline" : "checkmark-circle-outline"}
            size={32}
            color={isDangerous ? colors.danger : colors.purple500}
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
            onFocus={() => setFocusedControl("confirm")}
            onBlur={() => setFocusedControl(null)}
            style={({ pressed }) => [
              styles.confirmButton,
              isDangerous && styles.confirmButtonDanger,
              isLoading && styles.buttonDisabled,
              focusedControl === "confirm" && styles.focusedControlOnColor,
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
            onFocus={() => setFocusedControl("cancel")}
            onBlur={() => setFocusedControl(null)}
            style={({ pressed }) => [styles.cancelButton, focusedControl === "cancel" && styles.focusedControl, pressed && styles.pressed]}
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
    backgroundColor: "rgba(5,5,7,0.78)",
    flex: 1,
    justifyContent: "center",
    padding: spacing[4]
  },
  modal: {
    alignItems: "center",
    backgroundColor: colors.surface02,
    borderColor: colors.border,
    borderRadius: radius.xxl,
    borderWidth: 1,
    maxWidth: 400,
    padding: spacing[6],
    width: "100%",
    ...shadows.card
  },
  iconContainer: {
    alignItems: "center",
    backgroundColor: colors.purple500,
    borderRadius: radius.pill,
    height: 56,
    justifyContent: "center",
    marginBottom: spacing[4],
    width: 56
  },
  iconContainerDanger: {
    backgroundColor: colors.bg
  },
  title: {
    color: colors.textPrimary,
    fontFamily: fontFamilies.interfaceBold,
    fontSize: 18,
    marginBottom: spacing[2],
    textAlign: "center"
  },
  message: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.interface,
    fontSize: 14,
    lineHeight: 21,
    marginBottom: spacing[5],
    textAlign: "center"
  },
  actions: { flexDirection: "row", gap: spacing[3], width: "100%" },
  confirmButton: {
    alignItems: "center",
    backgroundColor: colors.purple500,
    borderRadius: radius.pill,
    flex: 1,
    justifyContent: "center",
    minHeight: 48,
    paddingVertical: spacing[3]
  },
  confirmButtonDanger: { backgroundColor: colors.danger },
  confirmButtonText: {
    color: colors.white,
    fontFamily: fontFamilies.interfaceBold,
    fontSize: 14
  },
  confirmButtonTextDanger: { color: colors.white },
  cancelButton: {
    alignItems: "center",
    borderColor: colors.border,
    borderRadius: radius.pill,
    borderWidth: 1,
    flex: 1,
    justifyContent: "center",
    minHeight: 48,
    paddingVertical: spacing[3]
  },
  cancelButtonText: {
    color: colors.textPrimary,
    fontFamily: fontFamilies.interfaceBold,
    fontSize: 14
  },
  focusedControl: { borderColor: colors.purple400, borderWidth: 3 },
  focusedControlOnColor: { borderColor: colors.white, borderWidth: 3 },
  buttonDisabled: { opacity: 0.6 },
  pressed: { opacity: 0.72 }
});
