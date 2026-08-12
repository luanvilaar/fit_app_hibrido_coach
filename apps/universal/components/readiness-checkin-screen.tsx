import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { colors, fontFamilies, motion, radius, spacing, typeScale } from "@fitblock/design-tokens";
import { createTodayRepository, type CheckinPainRegion } from "@fitblock/backend";
import { describeBackendError } from "@/data/backend-error";
import {
  averageCheckinScore,
  checkinQuestions,
  checkinScale,
  painIntensityScale,
  painRegions,
  readCheckinAnswer,
  type CheckinQuestion,
  type CheckinQuestionKey
} from "@/data/today";
import { getSupabaseConfigurationError, supabase } from "@/lib/supabase";

/**
 * Nenhuma resposta vem pré-marcada: um valor padrão convida o atleta a só apertar
 * "Salvar" e transforma o check-in em ruído.
 */
type CheckinAnswers = Record<CheckinQuestionKey, number | null>;

const emptyAnswers: CheckinAnswers = {
  sleepScore: null,
  energyScore: null,
  muscleRecoveryScore: null,
  stressScore: null,
  moodScore: null,
  motivationScore: null,
  overallReadinessScore: null
};

/** Etapas: uma por pergunta de escala + uma etapa final (dor, observação, salvar). */
const TOTAL_STEPS = checkinQuestions.length + 1;

/** Dá tempo do atleta perceber a nota escolhida antes do card animar para a próxima pergunta. */
const ANSWER_ADVANCE_DELAY_MS = 220;

export function ReadinessCheckinScreen() {
  const router = useRouter();
  const [answers, setAnswers] = useState<CheckinAnswers>(emptyAnswers);
  const [hasPain, setHasPain] = useState(false);
  const [painRegion, setPainRegion] = useState<CheckinPainRegion | null>(null);
  const [painIntensity, setPainIntensity] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState<"forward" | "back">("forward");
  const [reduceMotion, setReduceMotion] = useState(false);
  const advanceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reaproveita a RPC agregadora da Hoje para pré-preencher o check-in já registrado.
  useEffect(() => {
    let mounted = true;

    if (!supabase) {
      setIsLoading(false);
      setErrorMessage(getSupabaseConfigurationError() ?? "Check-in indisponível.");
      return () => {
        mounted = false;
      };
    }

    void createTodayRepository(supabase)
      .getToday()
      .then((dashboard) => {
        if (!mounted || !dashboard.checkin) return;

        const checkin = dashboard.checkin;
        setAnswers(
          checkinQuestions.reduce<CheckinAnswers>(
            (draft, question) => ({ ...draft, [question.key]: readCheckinAnswer(checkin, question.key) }),
            { ...emptyAnswers }
          )
        );
        setHasPain(checkin.pain_region !== null);
        setPainRegion(checkin.pain_region);
        setPainIntensity(checkin.pain_intensity);
        setNote(checkin.note);
      })
      .catch((error: unknown) => {
        if (mounted) setErrorMessage(describeBackendError(error));
      })
      .finally(() => {
        if (mounted) setIsLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (mounted) setReduceMotion(enabled);
    });
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduceMotion);
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    return () => {
      if (advanceTimeoutRef.current) clearTimeout(advanceTimeoutRef.current);
    };
  }, []);

  const missingCount = checkinQuestions.filter((question) => answers[question.key] === null).length;
  const isPainIncomplete = hasPain && (painRegion === null || painIntensity === null);
  const canSave = missingCount === 0 && !isPainIncomplete && !isSaving;
  const preview = missingCount === 0 ? averageCheckinScore(answers as Record<CheckinQuestionKey, number>) : null;

  function goNext() {
    setDirection("forward");
    setStep((current) => Math.min(current + 1, TOTAL_STEPS - 1));
  }

  function goBack() {
    if (advanceTimeoutRef.current) {
      clearTimeout(advanceTimeoutRef.current);
      advanceTimeoutRef.current = null;
    }
    setDirection("back");
    setStep((current) => Math.max(current - 1, 0));
  }

  function handleAnswer(question: CheckinQuestion, value: number) {
    setAnswers((current) => ({ ...current, [question.key]: value }));

    if (advanceTimeoutRef.current) clearTimeout(advanceTimeoutRef.current);
    advanceTimeoutRef.current = setTimeout(() => {
      advanceTimeoutRef.current = null;
      goNext();
    }, ANSWER_ADVANCE_DELAY_MS);
  }

  function togglePain() {
    setHasPain((current) => {
      if (current) {
        setPainRegion(null);
        setPainIntensity(null);
      }
      return !current;
    });
  }

  async function handleSave() {
    if (!supabase || !canSave) return;

    setIsSaving(true);
    setErrorMessage(null);

    try {
      await createTodayRepository(supabase).saveCheckin({
        sleepScore: answers.sleepScore as number,
        energyScore: answers.energyScore as number,
        muscleRecoveryScore: answers.muscleRecoveryScore as number,
        stressScore: answers.stressScore as number,
        moodScore: answers.moodScore as number,
        motivationScore: answers.motivationScore as number,
        overallReadinessScore: answers.overallReadinessScore as number,
        painRegion: hasPain ? painRegion : null,
        painIntensity: hasPain ? painIntensity : null,
        note
      });
      router.replace("/app/hoje");
    } catch (error: unknown) {
      setErrorMessage(describeBackendError(error));
    } finally {
      setIsSaving(false);
    }
  }

  const currentQuestion = step < checkinQuestions.length ? checkinQuestions[step] : null;

  return (
    <View style={styles.page} testID="readiness-checkin-screen">
      <View style={styles.pageIntro}>
        <Text style={styles.eyebrow}>CHECK-IN DIÁRIO</Text>
        <Text style={styles.pageTitle}>
          Como você chega <Text style={styles.pageTitleChip}>hoje</Text>?
        </Text>
        <Text style={styles.pageDescription}>
          Sete respostas de 1 a 5, sempre na mesma direção: 5 é o melhor cenário. Leva menos de um minuto e
          ajuda seu coach a ajustar o treino.
        </Text>
      </View>

      {errorMessage && (
        <View accessibilityRole="alert" style={styles.messageCard} testID="checkin-error">
          <Ionicons name="alert-circle-outline" size={20} color={colors.danger} />
          <Text style={styles.messageText}>{errorMessage}</Text>
        </View>
      )}

      {isLoading ? (
        <View style={styles.messageCard}>
          <Ionicons name="sync-outline" size={20} color={colors.textSecondary} />
          <Text style={styles.messageText}>Carregando o check-in de hoje...</Text>
        </View>
      ) : (
        <View style={styles.formCard}>
          <StepHeader step={step} totalSteps={TOTAL_STEPS} onBack={goBack} />

          <StepTransition step={step} direction={direction} reduceMotion={reduceMotion}>
            {currentQuestion ? (
              <CheckinQuestionRow
                key={currentQuestion.key}
                question={currentQuestion}
                value={answers[currentQuestion.key]}
                onChange={(value) => handleAnswer(currentQuestion, value)}
              />
            ) : (
              <FinalStep
                hasPain={hasPain}
                painRegion={painRegion}
                painIntensity={painIntensity}
                onTogglePain={togglePain}
                onSelectRegion={setPainRegion}
                onSelectIntensity={setPainIntensity}
                note={note}
                onChangeNote={setNote}
                canSave={canSave}
                isSaving={isSaving}
                onSave={() => {
                  void handleSave();
                }}
                hint={describeSubmitHint(missingCount, isPainIncomplete, preview)}
              />
            )}
          </StepTransition>
        </View>
      )}
    </View>
  );
}

function describeSubmitHint(missingCount: number, isPainIncomplete: boolean, preview: number | null): string {
  if (missingCount > 0) {
    return missingCount === 1 ? "Falta 1 resposta" : `Faltam ${missingCount} respostas`;
  }

  if (isPainIncomplete) return "Informe a região e a intensidade da dor";

  const score = preview === null ? "" : (Math.round(preview * 10) / 10).toFixed(1).replace(".", ",");

  return `Sua prontidão hoje: ${score} / 5`;
}

function StepHeader({
  step,
  totalSteps,
  onBack
}: {
  step: number;
  totalSteps: number;
  onBack: () => void;
}) {
  const [isBackFocused, setIsBackFocused] = useState(false);
  const isFinalStep = step === totalSteps - 1;
  const stepLabel = isFinalStep ? "Só falta confirmar" : `Pergunta ${step + 1} de ${totalSteps - 1}`;

  return (
    <View style={styles.stepHeader}>
      <View style={styles.stepHeaderTopRow}>
        {step > 0 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Voltar para a pergunta anterior"
            testID="checkin-step-back"
            onPress={onBack}
            onFocus={() => setIsBackFocused(true)}
            onBlur={() => setIsBackFocused(false)}
            style={({ pressed }) => [styles.stepBackButton, isBackFocused && styles.focusedControl, pressed && styles.pressed]}
          >
            <Ionicons name="chevron-back" size={18} color={colors.textSecondary} />
          </Pressable>
        ) : (
          <View style={styles.stepBackPlaceholder} />
        )}
        <View style={styles.stepProgressTrack}>
          {Array.from({ length: totalSteps }, (_, index) => (
            <View
              key={index}
              style={[styles.stepProgressSegment, index <= step && styles.stepProgressSegmentActive]}
            />
          ))}
        </View>
      </View>
      <Text style={styles.stepLabel} testID="checkin-step-label">
        {stepLabel}
      </Text>
    </View>
  );
}

function StepTransition({
  step,
  direction,
  reduceMotion,
  children
}: {
  step: number;
  direction: "forward" | "back";
  reduceMotion: boolean;
  children: React.ReactNode;
}) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateX = useRef(new Animated.Value(0)).current;

  // useLayoutEffect evita o flash de um frame com o conteúdo novo em opacidade final
  // antes da animação de entrada começar.
  useLayoutEffect(() => {
    if (reduceMotion) {
      opacity.setValue(1);
      translateX.setValue(0);
      return;
    }
    opacity.setValue(0);
    translateX.setValue(direction === "forward" ? 16 : -16);
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: motion.standard,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true
      }),
      Animated.timing(translateX, {
        toValue: 0,
        duration: motion.standard,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true
      })
    ]).start();
  }, [step, direction, reduceMotion, opacity, translateX]);

  return <Animated.View style={{ opacity, transform: [{ translateX }] }}>{children}</Animated.View>;
}

function CheckinQuestionRow({
  question,
  value,
  onChange
}: {
  question: CheckinQuestion;
  value: number | null;
  onChange: (value: number) => void;
}) {
  const [focusedScore, setFocusedScore] = useState<number | null>(null);

  return (
    <View style={styles.questionRow}>
      <Text style={styles.questionLabel}>{question.label}</Text>
      <View accessibilityRole="radiogroup" accessibilityLabel={question.label} style={styles.scaleRow}>
        {checkinScale.map((score) => (
          <Pressable
            key={score}
            accessibilityRole="radio"
            accessibilityLabel={`${question.label}: ${score}`}
            accessibilityState={{ selected: value === score }}
            testID={`checkin-${question.slug}-${score}`}
            onPress={() => onChange(score)}
            onFocus={() => setFocusedScore(score)}
            onBlur={() => setFocusedScore(null)}
            style={({ pressed }) => [
              styles.scaleOption,
              value === score && styles.scaleOptionActive,
              focusedScore === score && styles.focusedControl,
              pressed && styles.pressed
            ]}
          >
            <Text style={[styles.scaleOptionText, value === score && styles.scaleOptionTextActive]}>
              {score}
            </Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.anchorRow}>
        <Text style={styles.anchorText}>1 · {question.low}</Text>
        <Text style={styles.anchorText}>5 · {question.high}</Text>
      </View>
    </View>
  );
}

function FinalStep({
  hasPain,
  painRegion,
  painIntensity,
  onTogglePain,
  onSelectRegion,
  onSelectIntensity,
  note,
  onChangeNote,
  canSave,
  isSaving,
  onSave,
  hint
}: {
  hasPain: boolean;
  painRegion: CheckinPainRegion | null;
  painIntensity: number | null;
  onTogglePain: () => void;
  onSelectRegion: (region: CheckinPainRegion) => void;
  onSelectIntensity: (intensity: number) => void;
  note: string;
  onChangeNote: (note: string) => void;
  canSave: boolean;
  isSaving: boolean;
  onSave: () => void;
  hint: string;
}) {
  const [isSubmitFocused, setIsSubmitFocused] = useState(false);
  const [isNoteFocused, setIsNoteFocused] = useState(false);

  return (
    <View style={styles.finalStep}>
      <PainPicker
        hasPain={hasPain}
        region={painRegion}
        intensity={painIntensity}
        onToggle={onTogglePain}
        onSelectRegion={onSelectRegion}
        onSelectIntensity={onSelectIntensity}
      />

      <View style={styles.divider} />

      <View style={styles.noteRow}>
        <Text style={styles.questionLabel}>Quer contar mais alguma coisa?</Text>
        <TextInput
          accessibilityLabel="Observação do check-in"
          autoCapitalize="sentences"
          multiline
          numberOfLines={3}
          onChangeText={onChangeNote}
          onFocus={() => setIsNoteFocused(true)}
          onBlur={() => setIsNoteFocused(false)}
          placeholder="Opcional. Ex.: dormi mal por causa do trabalho."
          placeholderTextColor={colors.textMutedAccessible}
          style={[styles.noteInput, isNoteFocused && styles.focusedControl]}
          testID="checkin-note"
          value={note}
        />
      </View>

      <View style={styles.submitRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Salvar prontidão"
          accessibilityState={{ disabled: !canSave }}
          disabled={!canSave}
          testID="save-checkin"
          onPress={onSave}
          onFocus={() => setIsSubmitFocused(true)}
          onBlur={() => setIsSubmitFocused(false)}
          style={({ pressed }) => [
            styles.submitButton,
            !canSave && styles.submitButtonDisabled,
            isSubmitFocused && styles.focusedControlOnColor,
            pressed && styles.pressed
          ]}
        >
          <Text style={[styles.submitButtonText, !canSave && styles.submitButtonTextDisabled]}>
            {isSaving ? "Salvando..." : "Salvar prontidão"}
          </Text>
        </Pressable>
        <Text style={styles.submitHint} testID="checkin-progress">
          {hint}
        </Text>
      </View>
    </View>
  );
}

function PainPicker({
  hasPain,
  region,
  intensity,
  onToggle,
  onSelectRegion,
  onSelectIntensity
}: {
  hasPain: boolean;
  region: CheckinPainRegion | null;
  intensity: number | null;
  onToggle: () => void;
  onSelectRegion: (region: CheckinPainRegion) => void;
  onSelectIntensity: (intensity: number) => void;
}) {
  const [focusedControl, setFocusedControl] = useState<string | null>(null);

  return (
    <View style={styles.questionRow}>
      <Pressable
        accessibilityRole="switch"
        accessibilityLabel="Sente dor em algum lugar específico?"
        accessibilityState={{ checked: hasPain }}
        testID="pain-toggle"
        onPress={onToggle}
        onFocus={() => setFocusedControl("toggle")}
        onBlur={() => setFocusedControl(null)}
        style={({ pressed }) => [
          styles.painToggle,
          hasPain && styles.painToggleActive,
          focusedControl === "toggle" && styles.focusedControl,
          pressed && styles.pressed
        ]}
      >
        <Ionicons
          name={hasPain ? "checkbox-outline" : "square-outline"}
          size={20}
          color={hasPain ? colors.purple400 : colors.textSecondary}
        />
        <Text style={styles.painToggleText}>Sente dor em algum lugar específico?</Text>
      </Pressable>

      {hasPain && (
        <>
          <Text style={styles.painHint}>
            Uma dor forte num ponto só importa mesmo que a média esteja boa — seu coach precisa saber.
          </Text>
          <View accessibilityRole="radiogroup" accessibilityLabel="Região da dor" style={styles.chipRow}>
            {painRegions.map((option) => (
              <Pressable
                key={option.value}
                accessibilityRole="radio"
                accessibilityLabel={`Região: ${option.label}`}
                accessibilityState={{ selected: region === option.value }}
                testID={`pain-region-${option.value}`}
                onPress={() => onSelectRegion(option.value)}
                onFocus={() => setFocusedControl(`region-${option.value}`)}
                onBlur={() => setFocusedControl(null)}
                style={({ pressed }) => [
                  styles.chip,
                  region === option.value && styles.chipActive,
                  focusedControl === `region-${option.value}` && styles.focusedControl,
                  pressed && styles.pressed
                ]}
              >
                <Text style={[styles.chipText, region === option.value && styles.chipTextActive]}>
                  {option.label}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.questionLabel}>Intensidade da dor</Text>
          <View accessibilityRole="radiogroup" accessibilityLabel="Intensidade da dor" style={styles.scaleRow}>
            {painIntensityScale.map((score) => (
              <Pressable
                key={score}
                accessibilityRole="radio"
                accessibilityLabel={`Intensidade da dor: ${score}`}
                accessibilityState={{ selected: intensity === score }}
                testID={`pain-intensity-${score}`}
                onPress={() => onSelectIntensity(score)}
                onFocus={() => setFocusedControl(`intensity-${score}`)}
                onBlur={() => setFocusedControl(null)}
                style={({ pressed }) => [
                  styles.scaleOption,
                  intensity === score && styles.scaleOptionActive,
                  focusedControl === `intensity-${score}` && styles.focusedControl,
                  pressed && styles.pressed
                ]}
              >
                <Text style={[styles.scaleOptionText, intensity === score && styles.scaleOptionTextActive]}>
                  {score}
                </Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.anchorRow}>
            <Text style={styles.anchorText}>0 · Sem dor</Text>
            <Text style={styles.anchorText}>10 · Insuportável</Text>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { gap: spacing[5] },
  pageIntro: { maxWidth: 620 },
  eyebrow: {
    color: colors.purple400,
    fontFamily: fontFamilies.interfaceBold,
    fontSize: 11,
    letterSpacing: 1.6,
    marginBottom: spacing[2]
  },
  pageTitle: {
    color: colors.textPrimary,
    fontFamily: fontFamilies.display,
    fontSize: typeScale.displayHero,
    letterSpacing: -0.8,
    lineHeight: typeScale.displayHero * 0.92
  },
  pageTitleChip: {
    backgroundColor: colors.purple500,
    color: colors.white,
    overflow: "hidden",
    paddingHorizontal: spacing[1]
  },
  pageDescription: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.interface,
    fontSize: 15,
    lineHeight: 22,
    marginTop: spacing[2]
  },
  messageCard: {
    alignItems: "center",
    backgroundColor: colors.surface02,
    borderRadius: radius.lg,
    flexDirection: "row",
    gap: spacing[3],
    padding: spacing[4]
  },
  messageText: { color: colors.textSecondary, flex: 1, fontFamily: fontFamilies.interface, fontSize: 14 },
  formCard: {
    backgroundColor: colors.surface02,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.xxl,
    gap: spacing[4],
    maxWidth: 640,
    padding: spacing[5]
  },
  stepHeader: { gap: spacing[2] },
  stepHeaderTopRow: { alignItems: "center", flexDirection: "row", gap: spacing[2] },
  stepBackButton: {
    alignItems: "center",
    backgroundColor: colors.surface03,
    borderRadius: radius.pill,
    justifyContent: "center",
    minHeight: 44,
    minWidth: 44
  },
  stepBackPlaceholder: { minHeight: 44, minWidth: 44 },
  stepProgressTrack: { flex: 1, flexDirection: "row", gap: spacing[1] },
  stepProgressSegment: { backgroundColor: colors.surface04, borderRadius: radius.pill, flex: 1, height: 4 },
  stepProgressSegmentActive: { backgroundColor: colors.purple500 },
  stepLabel: { color: colors.textSecondary, fontFamily: fontFamilies.interfaceBold, fontSize: 12 },
  finalStep: { gap: spacing[4] },
  questionRow: { gap: spacing[2] },
  questionLabel: {
    color: colors.textPrimary,
    fontFamily: fontFamilies.interfaceBold,
    fontSize: 13
  },
  scaleRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing[2] },
  scaleOption: {
    alignItems: "center",
    backgroundColor: colors.bg,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    flexGrow: 1,
    justifyContent: "center",
    minHeight: 44,
    minWidth: 44
  },
  scaleOptionActive: { backgroundColor: colors.purple700, borderColor: colors.purple400 },
  focusedControl: { borderColor: colors.purple400, borderWidth: 2 },
  focusedControlOnColor: { borderColor: colors.white, borderWidth: 2 },
  scaleOptionText: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.interfaceBold,
    fontSize: 13
  },
  scaleOptionTextActive: { color: colors.white },
  anchorRow: { flexDirection: "row", justifyContent: "space-between" },
  anchorText: { color: colors.textSecondary, fontFamily: fontFamilies.interface, fontSize: 11 },
  divider: { backgroundColor: colors.border, height: 1 },
  painToggle: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[2],
    minHeight: 44
  },
  painToggleActive: {},
  painToggleText: {
    color: colors.textPrimary,
    flex: 1,
    fontFamily: fontFamilies.interfaceBold,
    fontSize: 13
  },
  painHint: { color: colors.textSecondary, fontFamily: fontFamilies.interface, fontSize: 12 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing[2] },
  chip: {
    alignItems: "center",
    backgroundColor: colors.bg,
    borderColor: colors.border,
    borderRadius: radius.pill,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: spacing[3]
  },
  chipActive: { backgroundColor: colors.purple700, borderColor: colors.purple400 },
  chipText: { color: colors.textSecondary, fontFamily: fontFamilies.interfaceSemiBold, fontSize: 12 },
  chipTextActive: { color: colors.white },
  noteRow: { gap: spacing[2] },
  noteInput: {
    backgroundColor: colors.bg,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    color: colors.textPrimary,
    fontFamily: fontFamilies.interface,
    fontSize: 14,
    minHeight: 80,
    padding: spacing[3],
    textAlignVertical: "top"
  },
  submitRow: { alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: spacing[3] },
  submitButton: {
    alignItems: "center",
    backgroundColor: colors.purple500,
    borderRadius: radius.pill,
    justifyContent: "center",
    minHeight: 46,
    paddingHorizontal: spacing[5]
  },
  submitButtonDisabled: { backgroundColor: colors.surface04 },
  submitButtonText: {
    color: colors.white,
    fontFamily: fontFamilies.interfaceBold,
    fontSize: 13
  },
  submitButtonTextDisabled: { color: colors.textSecondary },
  submitHint: { color: colors.textSecondary, fontFamily: fontFamilies.interface, fontSize: 13 },
  pressed: { opacity: 0.72 }
});
