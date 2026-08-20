import { Ionicons } from "@expo/vector-icons";
import { useMemo, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { fontFamilies, radius, spacing, type ThemeColors, type ThemePreference } from "@fitblock/design-tokens";
import { GlassSurface } from "@/components/ui/glass-surface";
import { useDialogFocusTrap } from "@/components/ui/dialog";
import { useAppTheme } from "@/theme/theme-provider";

type ThemeOption = {
  description: string;
  icon: "phone-portrait-outline" | "sunny-outline" | "moon-outline";
  label: string;
  value: ThemePreference;
};

const options: ThemeOption[] = [
  { value: "system", label: "Usar configuração do dispositivo", description: "Acompanha o tema do seu aparelho.", icon: "phone-portrait-outline" },
  { value: "light", label: "Claro", description: "Canvas claro para leitura e operação prolongada.", icon: "sunny-outline" },
  { value: "dark", label: "Escuro", description: "A aparência Dark Performance do FitBlock.", icon: "moon-outline" }
];

export function ThemeSettingsSheet({ visible, onDismiss }: { visible: boolean; onDismiss: () => void }) {
  const { colors, mode, preference, setPreference } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [isSaving, setIsSaving] = useState<ThemePreference | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  useDialogFocusTrap(visible, "theme-settings-sheet");

  async function choose(nextPreference: ThemePreference) {
    if (isSaving || nextPreference === preference) return;
    setIsSaving(nextPreference);
    setErrorMessage(null);
    try {
      await setPreference(nextPreference);
    } catch {
      setErrorMessage("Não foi possível salvar sua preferência agora.");
    } finally {
      setIsSaving(null);
    }
  }

  return (
    <Modal animationType="slide" transparent visible={visible} onRequestClose={onDismiss}>
      <View style={styles.backdrop}>
        <Pressable accessibilityRole="button" accessibilityLabel="Fechar aparência" style={StyleSheet.absoluteFill} onPress={onDismiss} />
        <GlassSurface accessibilityViewIsModal nativeID="theme-settings-sheet-dialog" strong style={styles.sheet} testID="theme-settings-sheet">
          <View style={styles.handle} />
          <View style={styles.heading}>
            <View>
              <Text style={styles.eyebrow}>PREFERÊNCIAS</Text>
              <Text style={styles.title}>Aparência</Text>
              <Text style={styles.description}>Escolha como o FitBlock deve aparecer para você.</Text>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="Fechar aparência" style={styles.closeButton} onPress={onDismiss}>
              <Ionicons name="close" size={22} color={colors.textPrimary} />
            </Pressable>
          </View>

          <View accessibilityRole="radiogroup" accessibilityLabel="Tema do aplicativo" style={styles.optionList}>
            {options.map((option) => {
              const selected = option.value === preference;
              const disabled = isSaving !== null;
              return (
                <Pressable
                  key={option.value}
                  accessibilityRole="radio"
                  accessibilityLabel={option.label}
                  accessibilityHint={option.description}
                  accessibilityState={{ selected, disabled }}
                  disabled={disabled}
                  onPress={() => void choose(option.value)}
                  style={({ pressed }) => [styles.option, selected && styles.optionSelected, pressed && !disabled && styles.pressed]}
                  testID={`theme-option-${option.value}`}
                >
                  <View style={[styles.optionIcon, selected && styles.optionIconSelected]}>
                    <Ionicons name={option.icon} size={20} color={selected ? colors.inkOnLight : colors.textSecondary} />
                  </View>
                  <View style={styles.optionCopy}>
                    <Text style={styles.optionLabel}>{option.label}</Text>
                    <Text style={styles.optionDescription}>{option.description}</Text>
                  </View>
                  <View style={[styles.radio, selected && styles.radioSelected]}>{selected && <View style={styles.radioDot} />}</View>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.status} accessibilityLiveRegion="polite">
            Tema em uso: {mode === "light" ? "Claro" : "Escuro"}.
          </Text>
          {errorMessage ? (
            <Text accessibilityRole="alert" style={styles.errorText} testID="theme-settings-error">
              {errorMessage}
            </Text>
          ) : null}
        </GlassSurface>
      </View>
    </Modal>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    backdrop: { backgroundColor: "rgba(0,0,0,0.48)", flex: 1, justifyContent: "flex-end" },
    sheet: {
      borderTopLeftRadius: radius.xxl,
      borderTopRightRadius: radius.xxl,
      gap: spacing[4],
      padding: spacing[5],
      paddingBottom: spacing[7]
    },
    handle: { alignSelf: "center", backgroundColor: colors.borderHover, borderRadius: radius.pill, height: 4, width: 40 },
    heading: { alignItems: "flex-start", flexDirection: "row", gap: spacing[3], justifyContent: "space-between" },
    eyebrow: { color: colors.purple500, fontFamily: fontFamilies.interfaceBold, fontSize: 11, letterSpacing: 1.2 },
    title: { color: colors.textPrimary, fontFamily: fontFamilies.displayBold, fontSize: 36, lineHeight: 36, marginTop: spacing[1] },
    description: { color: colors.textSecondary, fontFamily: fontFamilies.interface, fontSize: 14, lineHeight: 20, marginTop: spacing[2] },
    closeButton: { alignItems: "center", borderColor: colors.border, borderRadius: radius.pill, borderWidth: 1, height: 44, justifyContent: "center", width: 44 },
    optionList: { gap: spacing[2] },
    option: { alignItems: "center", borderColor: colors.border, borderRadius: radius.lg, borderWidth: 1, flexDirection: "row", gap: spacing[3], minHeight: 72, padding: spacing[3] },
    optionSelected: { backgroundColor: colors.surface03, borderColor: colors.purple500, borderWidth: 2 },
    optionIcon: { alignItems: "center", backgroundColor: colors.surface03, borderRadius: radius.pill, height: 40, justifyContent: "center", width: 40 },
    optionIconSelected: { backgroundColor: colors.purple500 },
    optionCopy: { flex: 1, gap: 2 },
    optionLabel: { color: colors.textPrimary, fontFamily: fontFamilies.interfaceBold, fontSize: 14 },
    optionDescription: { color: colors.textSecondary, fontFamily: fontFamilies.interface, fontSize: 12, lineHeight: 17 },
    radio: { alignItems: "center", borderColor: colors.borderHover, borderRadius: radius.pill, borderWidth: 2, height: 22, justifyContent: "center", width: 22 },
    radioSelected: { borderColor: colors.purple500 },
    radioDot: { backgroundColor: colors.purple500, borderRadius: radius.pill, height: 10, width: 10 },
    status: { color: colors.textSecondary, fontFamily: fontFamilies.interfaceMedium, fontSize: 12, textAlign: "center" },
    errorText: { color: colors.danger, fontFamily: fontFamilies.interfaceMedium, fontSize: 12, lineHeight: 17, textAlign: "center" },
    pressed: { opacity: 0.74 }
  });
}
