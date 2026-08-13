import { Ionicons } from "@expo/vector-icons";
import { useState, type PropsWithChildren, type ReactNode } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { colors, fontFamilies, radius, spacing } from "@fitblock/design-tokens";

/**
 * O primeiro overlay real do app.
 *
 * Até aqui todo elemento flutuante era `position: absolute` com `zIndex` local — e `zIndex` só
 * ordena irmãos dentro do mesmo pai, então qualquer painel mais alto que seu contêiner era
 * pintado por cima pelo conteúdo seguinte da tela. O `Modal` do react-native renderiza fora da
 * árvore de layout nas três plataformas (no web o `react-native-web` monta um portal), o que
 * torna a sobreposição impossível por construção em vez de por ajuste de camada.
 *
 * Confirmações financeiras são exatamente o lugar onde essa garantia importa: um formulário de
 * "perdoar dívida" meio encoberto é um valor confirmado sem ser lido.
 */

type DialogProps = PropsWithChildren<{
  visible: boolean;
  title: string;
  /** Aparece sob o título, para a frase que dá contexto ao que vai ser confirmado. */
  description?: string;
  testID: string;
  onDismiss: () => void;
}>;

export function Dialog({
  visible,
  title,
  description,
  testID,
  onDismiss,
  children
}: DialogProps) {
  return (
    <Modal
      animationType="fade"
      // O fundo do diálogo é desenhado aqui, não pelo Modal: transparente é o que permite o véu.
      transparent
      visible={visible}
      // Android: botão voltar. Web: tecla Esc, tratada pelo react-native-web.
      onRequestClose={onDismiss}
    >
      <Pressable
        accessibilityLabel="Fechar"
        accessibilityRole="button"
        onPress={onDismiss}
        style={styles.backdrop}
        testID={`${testID}-backdrop`}
      >
        {/* Engole o toque para que clicar dentro do cartão não conte como clicar fora dele. */}
        <Pressable
          accessibilityViewIsModal
          onPress={() => {}}
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

          <ScrollView
            contentContainerStyle={styles.bodyContent}
            keyboardShouldPersistTaps="handled"
            style={styles.body}
          >
            {children}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function DialogCloseButton({ onPress, testID }: { onPress: () => void; testID: string }) {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <Pressable
      accessibilityLabel="Fechar"
      accessibilityRole="button"
      onBlur={() => setIsFocused(false)}
      onFocus={() => setIsFocused(true)}
      onPress={onPress}
      style={({ pressed }) => [
        styles.close,
        isFocused && styles.focusRing,
        pressed && styles.pressed
      ]}
      testID={testID}
    >
      <Ionicons color={colors.textSecondary} name="close" size={19} />
    </Pressable>
  );
}

/** Rodapé de ações, alinhado à direita como no resto do sistema. */
export function DialogActions({ children }: { children: ReactNode }) {
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
  /** `danger` é para a ação que tira dinheiro do faturamento (perdoar, cancelar). */
  tone?: "ghost" | "primary" | "danger";
  disabled?: boolean;
  testID: string;
  accessibilityLabel?: string;
  onPress: () => void;
}) {
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

const styles = StyleSheet.create({
  backdrop: {
    alignItems: "center",
    backgroundColor: "rgba(5, 5, 7, 0.72)",
    flex: 1,
    justifyContent: "center",
    padding: spacing[4]
  },
  card: {
    backgroundColor: colors.surface02,
    borderColor: colors.borderHover,
    borderRadius: radius.xl,
    borderWidth: 1,
    // Teclado aberto em tela pequena: o cartão para de crescer e o corpo rola por dentro.
    maxHeight: "88%",
    maxWidth: 460,
    width: "100%"
  },
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
  title: {
    color: colors.textPrimary,
    fontFamily: fontFamilies.interfaceBold,
    fontSize: 17
  },
  description: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.interface,
    fontSize: 13,
    lineHeight: 19
  },
  close: {
    alignItems: "center",
    borderRadius: radius.pill,
    height: 44,
    justifyContent: "center",
    width: 44
  },
  body: { flexGrow: 0 },
  bodyContent: {
    gap: spacing[3],
    padding: spacing[5]
  },
  actions: {
    flexDirection: "row",
    gap: spacing[2],
    justifyContent: "flex-end",
    paddingTop: spacing[2]
  },
  button: {
    alignItems: "center",
    borderColor: colors.border,
    borderRadius: radius.pill,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: spacing[4]
  },
  buttonPrimary: {
    backgroundColor: colors.purple500,
    borderColor: colors.purple500
  },
  buttonDanger: {
    borderColor: colors.danger
  },
  buttonDisabled: { opacity: 0.45 },
  buttonText: {
    color: colors.textPrimary,
    fontFamily: fontFamilies.interfaceBold,
    fontSize: 13
  },
  buttonTextOnFill: { color: colors.white },
  buttonTextDanger: { color: colors.danger },
  focusRing: {
    borderColor: colors.purple400,
    borderWidth: 2
  },
  pressed: { opacity: 0.72 }
});
