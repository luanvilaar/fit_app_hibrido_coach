import { Ionicons } from "@expo/vector-icons";
import { useEffect, useMemo, useState, type PropsWithChildren, type ReactNode } from "react";
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { fontFamilies, radius, spacing, type ThemeColors } from "@fitblock/design-tokens";
import { GlassSurface } from "@/components/ui/glass-surface";
import { useAppTheme } from "@/theme/theme-provider";

type DialogProps = PropsWithChildren<{
  visible: boolean;
  title: string;
  description?: string;
  testID: string;
  onDismiss: () => void;
}>;

type FocusableElement = { focus: () => void };

/** Mantém Tab e Shift+Tab dentro do diálogo na implementação web do Modal. */
export function cycleDialogFocus(
  focusableElements: FocusableElement[],
  activeElement: unknown,
  shiftKey: boolean,
  preventDefault: () => void
) {
  if (focusableElements.length === 0) return;

  const first = focusableElements[0];
  const last = focusableElements[focusableElements.length - 1];
  const hasActiveElement = focusableElements.includes(activeElement as FocusableElement);

  if ((shiftKey && (!hasActiveElement || activeElement === first)) || (!shiftKey && activeElement === last)) {
    preventDefault();
    (shiftKey ? last : first).focus();
  }
}

export function useDialogFocusTrap(visible: boolean, testID: string) {
  useEffect(() => {
    if (!visible || Platform.OS !== "web" || typeof document === "undefined") return;

    const opener = document.activeElement as HTMLElement | null;

    const getFocusable = () => {
      const dialog = document.getElementById(`${testID}-dialog`);
      if (!dialog) return [];
      return Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [role="button"][tabindex]:not([tabindex="-1"]), [role="radio"][tabindex]:not([tabindex="-1"])'
        )
      );
    };

    const focusFirst = () => getFocusable()[0]?.focus();
    const frame = requestAnimationFrame(focusFirst);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      cycleDialogFocus(getFocusable(), document.activeElement, event.shiftKey, () => event.preventDefault());
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("keydown", onKeyDown);
      opener?.focus?.();
    };
  }, [testID, visible]);
}

/** Modal de confirmação: vidro no controle, conteúdo operacional ainda legível e sólido. */
export function Dialog({ visible, title, description, testID, onDismiss, children }: DialogProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  useDialogFocusTrap(visible, testID);

  return (
    <Modal animationType="fade" transparent visible={visible} onRequestClose={onDismiss}>
      <Pressable
        accessibilityLabel="Fechar"
        accessibilityRole="button"
        onPress={onDismiss}
        style={styles.backdrop}
        testID={`${testID}-backdrop`}
      >
        {/* Impede que toques no conteúdo fechem o diálogo. */}
        <Pressable accessibilityViewIsModal onPress={() => {}}>
          <GlassSurface
            accessibilityViewIsModal
            nativeID={`${testID}-dialog`}
            strong
            style={styles.card}
            testID={testID}
          >
            <View style={styles.header}>
              <View style={styles.headerCopy}>
                <Text accessibilityRole="header" style={styles.title}>
                  {title}
                </Text>
                {description && <Text style={styles.description}>{description}</Text>}
              </View>
              <DialogCloseButton onPress={onDismiss} testID={`${testID}-close`} />
            </View>

            <ScrollView contentContainerStyle={styles.bodyContent} keyboardShouldPersistTaps="handled" style={styles.body}>
              {children}
            </ScrollView>
          </GlassSurface>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function DialogCloseButton({ onPress, testID }: { onPress: () => void; testID: string }) {
  const { colors, styles } = useDialogStyles();
  const [isFocused, setIsFocused] = useState(false);

  return (
    <Pressable
      accessibilityLabel="Fechar"
      accessibilityRole="button"
      onBlur={() => setIsFocused(false)}
      onFocus={() => setIsFocused(true)}
      onPress={onPress}
      style={({ pressed }) => [styles.close, isFocused && styles.focusRing, pressed && styles.pressed]}
      testID={testID}
    >
      <Ionicons color={colors.textSecondary} name="close" size={19} />
    </Pressable>
  );
}

export function DialogActions({ children }: { children: ReactNode }) {
  const { styles } = useDialogStyles();
  return <View style={styles.actions}>{children}</View>;
}

export function DialogButton({
  label,
  tone = "ghost",
  disabled = false,
  testID,
  accessibilityLabel,
  onPress
}: {
  label: string;
  tone?: "ghost" | "primary" | "danger";
  disabled?: boolean;
  testID: string;
  accessibilityLabel?: string;
  onPress: () => void;
}) {
  const { styles } = useDialogStyles();
  const [isFocused, setIsFocused] = useState(false);

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onBlur={() => setIsFocused(false)}
      onFocus={() => setIsFocused(true)}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        tone === "primary" && styles.buttonPrimary,
        tone === "danger" && styles.buttonDanger,
        disabled && styles.buttonDisabled,
        isFocused && styles.focusRing,
        pressed && styles.pressed
      ]}
      testID={testID}
    >
      <Text
        style={[
          styles.buttonText,
          tone === "primary" && styles.buttonTextOnFill,
          tone === "danger" && styles.buttonTextDanger
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function useDialogStyles() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return { colors, styles };
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    backdrop: {
      alignItems: "center",
      backgroundColor: colors.authPhotoOverlay,
      flex: 1,
      justifyContent: "center",
      padding: spacing[4]
    },
    card: { borderRadius: radius.xl, maxHeight: "88%", maxWidth: 460, width: "100%" },
    header: {
      alignItems: "flex-start",
      borderBottomColor: colors.border,
      borderBottomWidth: 1,
      flexDirection: "row",
      gap: spacing[3],
      paddingBottom: spacing[4],
      paddingHorizontal: spacing[5],
      paddingTop: spacing[5]
    },
    headerCopy: { flex: 1, gap: spacing[1], minWidth: 0 },
    title: { color: colors.textPrimary, fontFamily: fontFamilies.interfaceBold, fontSize: 17 },
    description: { color: colors.textSecondary, fontFamily: fontFamilies.interface, fontSize: 13, lineHeight: 19 },
    close: { alignItems: "center", borderRadius: radius.pill, height: 44, justifyContent: "center", width: 44 },
    body: { flexGrow: 0 },
    bodyContent: { gap: spacing[3], padding: spacing[5] },
    actions: { flexDirection: "row", gap: spacing[2], justifyContent: "flex-end", paddingTop: spacing[2] },
    button: {
      alignItems: "center",
      borderColor: colors.border,
      borderRadius: radius.pill,
      borderWidth: 1,
      justifyContent: "center",
      minHeight: 44,
      paddingHorizontal: spacing[4]
    },
    buttonPrimary: { backgroundColor: colors.purple500, borderColor: colors.purple500 },
    buttonDanger: { borderColor: colors.danger },
    buttonDisabled: { opacity: 0.45 },
    buttonText: { color: colors.textPrimary, fontFamily: fontFamilies.interfaceBold, fontSize: 13 },
    buttonTextOnFill: { color: colors.white },
    buttonTextDanger: { color: colors.danger },
    focusRing: { borderColor: colors.purple400, borderWidth: 2 },
    pressed: { opacity: 0.72 }
  });
}
