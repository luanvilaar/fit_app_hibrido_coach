import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions
} from "react-native";
import type { ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, fontFamilies, radius, shadows, spacing, typeScale } from "@fitblock/design-tokens";
import { useAuth } from "@/auth/auth-provider";
import {
  validatePasswordStrength,
  getPasswordStrengthColor,
  getPasswordStrengthLabel
} from "@/auth/password-validation";
import { loginRateLimiter } from "@/auth/rate-limiter";

const authLayout = {
  compactBreakpoint: 860,
  compactCardMaxWidth: 430,
  compactHeroMaximum: 360,
  compactHeroMinimum: 248,
  compactHeroWidthRatio: 0.8,
  compactPanelOverlap: 152,
  desktopCardMaxWidth: 430,
  desktopCardMinHeight: 724,
  desktopCardWidth: "31.25%",
  desktopVisualWidth: "65.08%"
} as const;

const webPhotoFade = {
  desktop: {
    backgroundColor: "transparent",
    backgroundImage: "linear-gradient(90deg, rgba(5, 5, 7, 0) 58.6538%, #050507 86.0577%)",
    bottom: 0,
    left: 0,
    opacity: 1,
    right: 0,
    top: 0,
    width: "100%"
  } as unknown as ViewStyle,
  compact: {
    backgroundColor: "transparent",
    backgroundImage: "linear-gradient(167deg, rgba(5, 5, 7, 0) 58.6538%, #050507 86.0577%)",
    bottom: 0,
    left: 0,
    opacity: 1,
    right: 0,
    top: 0,
    width: "100%"
  } as unknown as ViewStyle
};

export type AuthScreenMode = "sign-in" | "sign-up" | "reset";

const copy = {
  "sign-in": {
    eyebrow: "ÁREA DO ATLETA",
    title: "Entre na Fitblock.",
    description: "Acesse seus treinos, sua evolução e o próximo passo da jornada.",
    button: "Entrar",
    alternate: "Ainda não tem uma conta?",
    alternateAction: "Criar conta"
  },
  "sign-up": {
    eyebrow: "COMECE SUA JORNADA",
    title: "Construa seu processo.",
    description: "Crie sua conta para receber programação e acompanhamento FitBlock.",
    button: "Criar conta",
    alternate: "Já tem uma conta?",
    alternateAction: "Entrar"
  },
  reset: {
    eyebrow: "RECUPERAÇÃO DE CONTA",
    title: "Volte para o processo.",
    description: "Enviaremos um link seguro para você definir uma nova senha.",
    button: "Enviar link",
    alternate: "Lembrou sua senha?",
    alternateAction: "Entrar"
  }
} as const;

function isValidEmail(email: string): boolean {
  const trimmed = email.trim().toLowerCase();

  // Basic RFC 5322 validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;
  if (!emailRegex.test(trimmed)) {
    return false;
  }

  // Block common typos
  const commonTypos = [
    "gmial.com",
    "gmai.com",
    "gmil.com",
    "yahooo.com",
    "yaho.com",
    "hotmial.com",
    "hotmail.comm",
    "aol.co",
    "outloo.com"
  ];

  const domain = trimmed.split("@")[1];
  if (commonTypos.includes(domain)) {
    return false;
  }

  // Block test/invalid domains
  const testDomains = ["test.com", "example.com", "invalid.com", "localhost"];
  if (testDomains.includes(domain)) {
    return false;
  }

  return true;
}

function getEmailErrorMessage(email: string): string | null {
  const trimmed = email.trim().toLowerCase();

  if (!trimmed.includes("@")) {
    return "E-mail deve conter @";
  }

  const [localPart, domain] = trimmed.split("@");

  if (!localPart || localPart.length < 1) {
    return "Parte anterior ao @ não pode estar vazia";
  }

  if (!domain || !domain.includes(".")) {
    return "Domínio deve incluir extensão (.com, .br, etc)";
  }

  if (domain === "gmial.com" || domain === "gmai.com") {
    return "Parece um typo. Você quis dizer gmail.com?";
  }

  if (domain === "yahooo.com") {
    return "Parece um typo. Você quis dizer yahoo.com?";
  }

  if (domain === "hotmial.com") {
    return "Parece um typo. Você quis dizer hotmail.com?";
  }

  return null;
}

export function AuthScreen({ mode }: { mode: AuthScreenMode }) {
  const router = useRouter();
  const { isConfigured, session, signIn, signUp, resetPassword, updatePassword } = useAuth();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [focusedControl, setFocusedControl] = useState<string | null>(null);
  const [hoveredControl, setHoveredControl] = useState<string | null>(null);
  const isCompact = width < authLayout.compactBreakpoint;
  const compactHeroHeight = Math.round(
    Math.min(
      authLayout.compactHeroMaximum,
      Math.max(authLayout.compactHeroMinimum, width * authLayout.compactHeroWidthRatio)
    )
  );
  const compactFormTop = Math.max(spacing[9], compactHeroHeight - authLayout.compactPanelOverlap);
  const formScrollInsets = {
    paddingBottom: Math.max(isCompact ? spacing[7] : spacing[6], insets.bottom + spacing[5]),
    paddingTop: Math.max(isCompact ? compactFormTop : spacing[6], insets.top + spacing[3])
  };
  const isRecoveryUpdate = mode === "reset" && Boolean(session);
  const needsEmail = !isRecoveryUpdate;
  const screenCopy = isRecoveryUpdate
    ? {
      ...copy.reset,
      title: "Defina uma nova senha.",
      description: "Escolha uma senha forte para voltar ao seu espaço FitBlock.",
      button: "Atualizar senha"
    }
    : copy[mode];

  useEffect(() => {
    if (session && mode !== "reset") router.replace("/app/hoje");
  }, [mode, router, session]);

  useEffect(() => {
    setShowPassword(false);
  }, [mode]);

  function navigateToAlternate() {
    router.replace(mode === "sign-in" ? "/criar-conta" : "/entrar");
  }

  async function submit() {
    setErrorMessage(null);
    setSuccessMessage(null);

    // Validate email if required
    if (needsEmail) {
      const emailNormalized = email.trim().toLowerCase();

      if (!emailNormalized) {
        setErrorMessage("Digite seu e-mail.");
        return;
      }

      if (!isValidEmail(emailNormalized)) {
        const specificError = getEmailErrorMessage(emailNormalized);
        setErrorMessage(specificError || "E-mail inválido.");
        return;
      }
    }

    // Validate password strength only when it's being created/changed (signup or recovery
    // update) — never on sign-in, where the password already exists and must go straight to
    // Supabase for the real check.
    if ((mode === "sign-up" || isRecoveryUpdate) && password) {
      const passwordValidation = validatePasswordStrength(password);

      if (!passwordValidation.isValid) {
        const errorList = passwordValidation.errors.join("\n• ");
        setErrorMessage(`Senha insuficiente:\n• ${errorList}`);
        return;
      }
    }

    // Validate password confirmation
    if ((mode === "sign-up" || isRecoveryUpdate) && password !== confirmPassword) {
      setErrorMessage("As senhas não conferem.");
      return;
    }

    setIsSubmitting(true);
    try {
      const emailNormalized = needsEmail ? email.trim().toLowerCase() : "";

      if (mode === "sign-in") {
        // Check rate limiting before attempting
        const blocked = loginRateLimiter.isBlocked(emailNormalized);
        if (blocked.blocked) {
          setErrorMessage(
            `Muitas tentativas de login. Tente novamente em ${blocked.minutesLeft} minuto(s).`
          );
          setIsSubmitting(false);
          return;
        }

        await signIn(emailNormalized, password);
        router.replace("/app/hoje");
      } else if (mode === "sign-up") {
        const result = await signUp(emailNormalized, password);
        if (result.needsEmailConfirmation) {
          setSuccessMessage("Conta criada. Confira seu e-mail para confirmar o acesso.");
        } else {
          router.replace("/app/hoje");
        }
      } else if (isRecoveryUpdate) {
        await updatePassword(password);
        setSuccessMessage("Senha atualizada. Você já pode continuar seu treino.");
        router.replace("/app/hoje");
      } else {
        await resetPassword(emailNormalized);
        setSuccessMessage("Link enviado. Confira sua caixa de entrada para continuar.");
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Não foi possível concluir a operação.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const formContent = (
    <View style={[styles.formBody, isCompact && styles.formBodyCompact]}>
      <Text style={styles.eyebrow}>{screenCopy.eyebrow}</Text>
      <Text style={styles.title}>{screenCopy.title}</Text>
      <Text style={styles.description}>{screenCopy.description}</Text>

      {!isConfigured ? (
        <View style={styles.configurationNotice}>
          <Text style={styles.configurationTitle}>Configuração pendente</Text>
          <Text style={styles.configurationText}>
            Adicione as variáveis públicas do Supabase antes de publicar este ambiente.
          </Text>
        </View>
      ) : (
        <>
          {needsEmail && (
            <>
              <FieldLabel label="E-mail" />
              <View style={[styles.inputShell, focusedControl === "email" && styles.inputShellFocused]}>
                <Ionicons name="mail-outline" size={18} color={colors.textSecondary} />
                <TextInput
                  accessibilityLabel="E-mail"
                  autoCapitalize="none"
                  autoComplete="email"
                  autoCorrect={false}
                  keyboardType="email-address"
                  onBlur={() => setFocusedControl(null)}
                  onFocus={() => setFocusedControl("email")}
                  placeholder="voce@email.com"
                  placeholderTextColor={colors.textMutedAccessible}
                  testID="auth-email"
                  value={email}
                  onChangeText={setEmail}
                  style={styles.input}
                />
              </View>
            </>
          )}

          {(mode !== "reset" || isRecoveryUpdate) && (
            <>
              <View style={styles.passwordLabelRow}>
                <FieldLabel label="Senha" />
                {mode === "sign-in" && (
                  <Pressable
                    accessibilityRole="link"
                    onBlur={() => setFocusedControl(null)}
                    onFocus={() => setFocusedControl("forgot-password")}
                    onHoverIn={() => setHoveredControl("forgot-password")}
                    onHoverOut={() => setHoveredControl(null)}
                    onPress={() => router.replace("/recuperar-senha")}
                    style={({ pressed }) => [
                      styles.inlineLinkButton,
                      hoveredControl === "forgot-password" && styles.linkHovered,
                      focusedControl === "forgot-password" && styles.linkFocused,
                      pressed && styles.pressed
                    ]}
                  >
                    <Text style={styles.inlineLink}>Esqueci minha senha</Text>
                  </Pressable>
                )}
              </View>
              {mode === "sign-up" && password && (
                <PasswordStrengthIndicator password={password} />
              )}
              <View
                style={[
                  styles.inputShell,
                  (focusedControl === "password" || focusedControl === "password-toggle") && styles.inputShellFocused
                ]}
              >
                <Ionicons name="lock-closed-outline" size={18} color={colors.textSecondary} />
                <TextInput
                  accessibilityLabel="Senha"
                  autoCapitalize="none"
                  autoComplete={mode === "sign-up" ? "new-password" : "current-password"}
                  onBlur={() => setFocusedControl(null)}
                  onFocus={() => setFocusedControl("password")}
                  placeholder="••••••••"
                  placeholderTextColor={colors.textMutedAccessible}
                  secureTextEntry={!showPassword}
                  testID="auth-password"
                  value={password}
                  onChangeText={setPassword}
                  style={styles.input}
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={showPassword ? "Ocultar senha" : "Mostrar senha"}
                  accessibilityHint="Alterna a visibilidade da senha digitada"
                  onBlur={() => setFocusedControl(null)}
                  onFocus={() => setFocusedControl("password-toggle")}
                  onHoverIn={() => setHoveredControl("password-toggle")}
                  onHoverOut={() => setHoveredControl(null)}
                  onPress={() => setShowPassword((visible) => !visible)}
                  testID="auth-password-toggle"
                  style={({ pressed }) => [
                    styles.passwordToggle,
                    hoveredControl === "password-toggle" && styles.passwordToggleHovered,
                    focusedControl === "password-toggle" && styles.passwordToggleFocused,
                    pressed && styles.pressed
                  ]}
                >
                  <Ionicons
                    name={showPassword ? "eye-off-outline" : "eye-outline"}
                    size={18}
                    color={colors.textSecondary}
                  />
                </Pressable>
              </View>
            </>
          )}

          {(mode === "sign-up" || isRecoveryUpdate) && (
            <>
              <FieldLabel label="Confirmar senha" />
              <View style={[styles.inputShell, focusedControl === "confirm-password" && styles.inputShellFocused]}>
                <Ionicons name="shield-checkmark-outline" size={18} color={colors.textSecondary} />
                <TextInput
                  accessibilityLabel="Confirmar senha"
                  autoCapitalize="none"
                  autoComplete="new-password"
                  onBlur={() => setFocusedControl(null)}
                  onFocus={() => setFocusedControl("confirm-password")}
                  placeholder="••••••••"
                  placeholderTextColor={colors.textMutedAccessible}
                  secureTextEntry={!showPassword}
                  testID="auth-confirm-password"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  style={styles.input}
                />
              </View>
            </>
          )}

          {errorMessage && (
            <Text accessibilityLiveRegion="assertive" accessibilityRole="alert" style={styles.errorMessage}>
              {errorMessage}
            </Text>
          )}
          {successMessage && (
            <Text accessibilityLiveRegion="polite" style={styles.successMessage}>
              {successMessage}
            </Text>
          )}

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={screenCopy.button}
            accessibilityState={{ disabled: isSubmitting }}
            disabled={isSubmitting}
            testID="auth-submit"
            onBlur={() => setFocusedControl(null)}
            onFocus={() => setFocusedControl("submit")}
            onHoverIn={() => setHoveredControl("submit")}
            onHoverOut={() => setHoveredControl(null)}
            onPress={() => void submit()}
            style={({ pressed }) => [
              styles.submitButton,
              hoveredControl === "submit" && styles.submitButtonHovered,
              focusedControl === "submit" && styles.submitButtonFocused,
              pressed && styles.pressed,
              isSubmitting && styles.disabled
            ]}
          >
            {isSubmitting ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <>
                <Text style={styles.submitText}>{screenCopy.button}</Text>
                <Ionicons name="arrow-forward" size={17} color={colors.white} />
              </>
            )}
          </Pressable>
        </>
      )}

      <View style={styles.alternateRow}>
        <Text style={styles.alternateText}>{screenCopy.alternate}</Text>
        <Pressable
          accessibilityRole="link"
          onBlur={() => setFocusedControl(null)}
          onFocus={() => setFocusedControl("alternate")}
          onHoverIn={() => setHoveredControl("alternate")}
          onHoverOut={() => setHoveredControl(null)}
          onPress={navigateToAlternate}
          style={({ pressed }) => [
            styles.inlineLinkButton,
            hoveredControl === "alternate" && styles.linkHovered,
            focusedControl === "alternate" && styles.linkFocused,
            pressed && styles.pressed
          ]}
        >
          <Text style={styles.inlineLink}>{screenCopy.alternateAction}</Text>
        </Pressable>
      </View>
      <Pressable
        accessibilityRole="link"
        onBlur={() => setFocusedControl(null)}
        onFocus={() => setFocusedControl("home")}
        onHoverIn={() => setHoveredControl("home")}
        onHoverOut={() => setHoveredControl(null)}
        onPress={() => router.replace("/")}
        style={({ pressed }) => [
          styles.homeLink,
          hoveredControl === "home" && styles.linkHovered,
          focusedControl === "home" && styles.linkFocused,
          pressed && styles.pressed
        ]}
      >
        <Text style={styles.homeLinkText}>Voltar para a Home</Text>
      </Pressable>
    </View>
  );

  return (
    <View style={styles.screen}>
      <AuthVisual isCompact={isCompact} compactHeroHeight={compactHeroHeight} />

      <KeyboardAvoidingView
        style={styles.formArea}
        behavior={Platform.select({ ios: "padding", android: "height", default: undefined })}
      >
        <ScrollView
          contentContainerStyle={[
            styles.formScroll,
            isCompact && styles.formScrollCompact,
            formScrollInsets
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View testID="auth-card" style={[styles.formCard, isCompact && styles.formCardCompact]}>
            {formContent}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

export function AuthLoadingScreen() {
  return (
    <View style={styles.loadingScreen}>
      <ActivityIndicator color={colors.purple400} />
      <Text style={styles.loadingText}>Abrindo seu espaço FitBlock…</Text>
    </View>
  );
}

function PasswordStrengthIndicator({ password }: { password: string }) {
  const validation = validatePasswordStrength(password);
  const strengthColor = getPasswordStrengthColor(validation.score);
  const strengthLabel = getPasswordStrengthLabel(validation.score);

  return (
    <View style={styles.passwordStrengthContainer}>
      <View style={styles.passwordStrengthBar}>
        <View
          style={[
            styles.passwordStrengthFill,
            {
              backgroundColor: strengthColor,
              width: `${(Object.keys(validation.feedback).length * 20)}%`
            }
          ]}
        />
      </View>
      <View style={styles.passwordStrengthTextRow}>
        <Text style={styles.passwordStrengthLabel}>Força: {strengthLabel}</Text>
        {!validation.isValid && validation.errors.length > 0 && (
          <Text style={styles.passwordStrengthError}>
            {validation.errors[0]}
          </Text>
        )}
      </View>
    </View>
  );
}

function FieldLabel({ label }: { label: string }) {
  return <Text style={styles.fieldLabel}>{label}</Text>;
}

function AuthVisual({ isCompact, compactHeroHeight }: { isCompact: boolean; compactHeroHeight: number }) {
  return (
    <View
      accessibilityElementsHidden
      style={[styles.authVisual, isCompact && { bottom: undefined, height: compactHeroHeight }]}
      testID="auth-visual"
    >
      <View style={[styles.visualPhotoMask, isCompact && styles.visualPhotoMaskCompact]}>
        <Image
          source={isCompact
            ? require("../assets/auth-competition-mobile.png")
            : require("../assets/auth-competition-desktop.png")}
          resizeMode="stretch"
          style={[styles.visualPhoto, isCompact && styles.visualPhotoCompact]}
          testID="auth-campaign-image"
        />
        <View
          style={[
            styles.visualPhotoFade,
            isCompact && styles.visualPhotoFadeCompact,
            Platform.OS === "web" && (isCompact ? webPhotoFade.compact : webPhotoFade.desktop)
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.bgDeep, flex: 1, minHeight: "100%" },
  authVisual: {
    backgroundColor: colors.bgDeep,
    bottom: 0,
    left: 0,
    overflow: "hidden",
    pointerEvents: "none",
    position: "absolute",
    right: 0,
    top: 0
  },
  visualPhotoMask: {
    bottom: 0,
    left: 0,
    overflow: "hidden",
    position: "absolute",
    top: 0,
    width: authLayout.desktopVisualWidth
  },
  visualPhotoMaskCompact: { width: "100%" },
  visualPhoto: {
    height: "157.7%",
    left: "-9.12%",
    position: "absolute",
    top: "-25.96%",
    width: "118.13%"
  },
  visualPhotoCompact: { height: "101.7%", left: "-7.63%", top: 0, width: "115.27%" },
  visualPhotoFade: {
    backgroundColor: colors.bgDeep,
    bottom: 0,
    opacity: 0.82,
    position: "absolute",
    right: 0,
    top: 0,
    width: "18%"
  },
  visualPhotoFadeCompact: { height: "24%", left: 0, opacity: 0.9, right: 0, top: "76%", width: "100%" },
  formArea: { backgroundColor: "transparent", flex: 1, zIndex: 1 },
  formScroll: {
    alignItems: "flex-end",
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: "3.5%",
    paddingVertical: spacing[6]
  },
  formScrollCompact: { alignItems: "center", justifyContent: "flex-start", paddingHorizontal: 0 },
  formCard: {
    backgroundColor: colors.surface02,
    borderColor: colors.border,
    borderRadius: radius.authPanelDesktop,
    borderWidth: 1,
    maxWidth: authLayout.desktopCardMaxWidth,
    minHeight: authLayout.desktopCardMinHeight,
    minWidth: 0,
    overflow: "hidden",
    width: authLayout.desktopCardWidth,
    ...shadows.card
  },
  formCardCompact: {
    borderRadius: radius.authPanelMobile,
    maxWidth: authLayout.compactCardMaxWidth,
    minHeight: 0,
    minWidth: 0,
    width: "88%"
  },
  formBody: { minHeight: authLayout.desktopCardMinHeight, padding: spacing[7] },
  formBodyCompact: { minHeight: 0, padding: spacing[5] },
  eyebrow: {
    color: colors.purple400,
    fontFamily: fontFamilies.interfaceBold,
    fontSize: typeScale.caption,
    letterSpacing: 1.4,
    marginBottom: spacing[3]
  },
  title: {
    color: colors.textPrimary,
    fontFamily: fontFamilies.displayBold,
    fontSize: 40,
    letterSpacing: -0.4,
    lineHeight: 34
  },
  description: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.interface,
    fontSize: typeScale.bodyMd,
    lineHeight: 22,
    marginBottom: spacing[5],
    marginTop: spacing[3]
  },
  fieldLabel: {
    color: colors.textPrimary,
    fontFamily: fontFamilies.interfaceBold,
    fontSize: typeScale.bodySm,
    marginBottom: spacing[2]
  },
  passwordLabelRow: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  inputShell: {
    alignItems: "center",
    backgroundColor: colors.surface04,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: "row",
    height: 48,
    marginBottom: spacing[4],
    paddingHorizontal: spacing[4]
  },
  inputShellFocused: { borderColor: colors.purple400, borderWidth: 2 },
  input: {
    color: colors.textPrimary,
    flex: 1,
    fontFamily: fontFamilies.interface,
    fontSize: typeScale.bodyMd,
    height: 46,
    minWidth: 0,
    paddingHorizontal: spacing[3]
  },
  passwordToggle: { alignItems: "center", borderRadius: radius.md, height: 44, justifyContent: "center", marginRight: -spacing[3], width: 44 },
  passwordToggleHovered: { backgroundColor: colors.surface03 },
  passwordToggleFocused: { backgroundColor: colors.surface03, borderColor: colors.purple400, borderWidth: 1 },
  passwordStrengthContainer: { marginBottom: spacing[4] },
  passwordStrengthBar: {
    backgroundColor: colors.surface03,
    borderRadius: radius.xs,
    height: 4,
    marginBottom: spacing[2],
    overflow: "hidden"
  },
  passwordStrengthFill: { height: "100%", borderRadius: radius.xs },
  passwordStrengthTextRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  passwordStrengthLabel: {
    color: colors.textPrimary,
    fontFamily: fontFamilies.interfaceSemiBold,
    fontSize: typeScale.bodySm
  },
  passwordStrengthError: {
    color: colors.danger,
    fontFamily: fontFamilies.interface,
    fontSize: typeScale.bodySm
  },
  inlineLinkButton: { alignItems: "center", borderRadius: radius.md, justifyContent: "center", minHeight: 44, paddingHorizontal: spacing[1] },
  inlineLink: { color: colors.purple400, fontFamily: fontFamilies.interfaceBold, fontSize: typeScale.bodySm },
  linkHovered: { backgroundColor: colors.surface03 },
  linkFocused: { backgroundColor: colors.surface03, borderColor: colors.purple400, borderWidth: 1 },
  submitButton: {
    alignItems: "center",
    backgroundColor: colors.purple500,
    borderRadius: radius.pill,
    flexDirection: "row",
    height: 48,
    justifyContent: "space-between",
    marginTop: spacing[2],
    paddingHorizontal: spacing[5],
    ...shadows.ctaGlow
  },
  submitButtonHovered: { backgroundColor: colors.purple400 },
  submitButtonFocused: { borderColor: colors.white, borderWidth: 2 },
  submitText: { color: colors.white, fontFamily: fontFamilies.interfaceBold, fontSize: typeScale.bodyMd },
  pressed: { opacity: 0.8 },
  disabled: { opacity: 0.55 },
  errorMessage: {
    color: colors.danger,
    fontFamily: fontFamilies.interface,
    fontSize: typeScale.bodySm,
    lineHeight: 20,
    marginBottom: spacing[3]
  },
  successMessage: {
    color: colors.success,
    fontFamily: fontFamilies.interface,
    fontSize: typeScale.bodySm,
    lineHeight: 20,
    marginBottom: spacing[3]
  },
  configurationNotice: {
    backgroundColor: colors.surface04,
    borderColor: colors.warning,
    borderRadius: radius.md,
    borderWidth: 1,
    marginBottom: spacing[5],
    padding: spacing[4]
  },
  configurationTitle: { color: colors.textPrimary, fontFamily: fontFamilies.interfaceBold, fontSize: typeScale.bodySm },
  configurationText: { color: colors.textSecondary, fontFamily: fontFamilies.interface, fontSize: typeScale.bodySm, lineHeight: 20, marginTop: spacing[2] },
  alternateRow: { alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: spacing[2], justifyContent: "center", marginTop: spacing[6] },
  alternateText: { color: colors.textSecondary, fontFamily: fontFamilies.interface, fontSize: typeScale.bodySm },
  homeLink: { alignItems: "center", alignSelf: "center", borderRadius: radius.md, justifyContent: "center", marginTop: spacing[5], minHeight: 44, paddingHorizontal: spacing[2] },
  homeLinkText: { color: colors.textSecondary, fontFamily: fontFamilies.interface, fontSize: typeScale.bodySm },
  loadingScreen: { alignItems: "center", backgroundColor: colors.bgDeep, flex: 1, justifyContent: "center", minHeight: "100%" },
  loadingText: { color: colors.textSecondary, fontFamily: fontFamilies.interface, fontSize: typeScale.bodySm, marginTop: spacing[3] }
});
