import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import type { LeaderboardEntry, SubmitBlockScoreRequest } from "@fitblock/backend";
import { colors, fontFamilies, radius, shadows, spacing } from "@fitblock/design-tokens";
import { scoreTypeLabels, type ScoreType } from "@/data/coach-hibrido/blocks";

type ScoreDraft = { minutes: string; seconds: string; rounds: string; reps: string; load: string };

const emptyDraft: ScoreDraft = { minutes: "", seconds: "", rounds: "", reps: "", load: "" };

type ScorePanelProps = {
  blockId: string;
  scoreType: ScoreType;
  leaderboard: LeaderboardEntry[];
  isSubmitting: boolean;
  onSubmit: (score: Omit<SubmitBlockScoreRequest, "sessionId" | "blockId">) => void;
};

/** "12:40" · "8 rounds + 12" · "97 reps" · "82,5 kg" */
export function formatScore(entry: LeaderboardEntry): string {
  if (entry.score_type === "time" && entry.time_seconds !== null) {
    const minutes = Math.floor(entry.time_seconds / 60);
    const seconds = entry.time_seconds % 60;
    return `${minutes}:${String(seconds).padStart(2, "0")}`;
  }

  if (entry.score_type === "rounds-reps") {
    const rounds = entry.rounds ?? 0;
    return entry.reps ? `${rounds} rounds + ${entry.reps}` : `${rounds} rounds`;
  }

  if (entry.score_type === "reps" && entry.reps !== null) return `${entry.reps} reps`;

  if (entry.score_type === "load" && entry.load_kg !== null) {
    const value = Number.isInteger(entry.load_kg)
      ? String(entry.load_kg)
      : entry.load_kg.toFixed(1).replace(".", ",");
    return `${value} kg`;
  }

  return "—";
}

function toNumber(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

export function ScorePanel({
  blockId,
  scoreType,
  leaderboard,
  isSubmitting,
  onSubmit
}: ScorePanelProps) {
  const [draft, setDraft] = useState<ScoreDraft>(emptyDraft);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isSubmitFocused, setIsSubmitFocused] = useState(false);

  function submit() {
    if (scoreType === "time") {
      const minutes = toNumber(draft.minutes) ?? 0;
      const seconds = toNumber(draft.seconds) ?? 0;

      if (minutes === 0 && seconds === 0) {
        setValidationError("Informe o tempo que você levou.");
        return;
      }
      if (seconds > 59) {
        setValidationError("Os segundos vão de 0 a 59.");
        return;
      }

      setValidationError(null);
      onSubmit({ scoreType, timeSeconds: minutes * 60 + seconds });
      return;
    }

    if (scoreType === "rounds-reps") {
      const rounds = toNumber(draft.rounds);

      if (rounds === null) {
        setValidationError("Informe quantos rounds você completou.");
        return;
      }

      setValidationError(null);
      onSubmit({ scoreType, rounds, reps: toNumber(draft.reps) });
      return;
    }

    if (scoreType === "reps") {
      const reps = toNumber(draft.reps);

      if (reps === null) {
        setValidationError("Informe o total de repetições.");
        return;
      }

      setValidationError(null);
      onSubmit({ scoreType, reps });
      return;
    }

    const load = toNumber(draft.load);

    if (load === null) {
      setValidationError("Informe a carga em quilos.");
      return;
    }

    setValidationError(null);
    onSubmit({ scoreType, loadKg: load });
  }

  return (
    <View style={styles.panel} testID={`score-panel-${blockId}`}>
      <Text style={styles.title}>Registrar resultado · {scoreTypeLabels[scoreType]}</Text>

      <View style={styles.inputs}>
        {scoreType === "time" && (
          <>
            <ScoreField
              label="Minutos"
              onChangeText={(minutes) => setDraft({ ...draft, minutes })}
              testID={`score-${blockId}-minutes`}
              value={draft.minutes}
            />
            <ScoreField
              label="Segundos"
              onChangeText={(seconds) => setDraft({ ...draft, seconds })}
              testID={`score-${blockId}-seconds`}
              value={draft.seconds}
            />
          </>
        )}
        {scoreType === "rounds-reps" && (
          <>
            <ScoreField
              label="Rounds"
              onChangeText={(rounds) => setDraft({ ...draft, rounds })}
              testID={`score-${blockId}-rounds`}
              value={draft.rounds}
            />
            <ScoreField
              label="Reps extras"
              onChangeText={(reps) => setDraft({ ...draft, reps })}
              testID={`score-${blockId}-reps`}
              value={draft.reps}
            />
          </>
        )}
        {scoreType === "reps" && (
          <ScoreField
            label="Repetições"
            onChangeText={(reps) => setDraft({ ...draft, reps })}
            testID={`score-${blockId}-reps`}
            value={draft.reps}
          />
        )}
        {scoreType === "load" && (
          <ScoreField
            label="Carga (kg)"
            onChangeText={(load) => setDraft({ ...draft, load })}
            testID={`score-${blockId}-load`}
            value={draft.load}
          />
        )}

        <Pressable
          accessibilityLabel="Enviar meu resultado para o ranking"
          accessibilityRole="button"
          accessibilityState={{ disabled: isSubmitting }}
          disabled={isSubmitting}
          onBlur={() => setIsSubmitFocused(false)}
          onFocus={() => setIsSubmitFocused(true)}
          onPress={submit}
          style={({ pressed }) => [
            styles.submit,
            isSubmitting && styles.disabled,
            isSubmitFocused && styles.submitFocused,
            pressed && styles.pressed
          ]}
          testID={`score-${blockId}-submit`}
        >
          <Text style={styles.submitText}>{isSubmitting ? "Enviando…" : "Enviar"}</Text>
        </Pressable>
      </View>

      {validationError && (
        <Text accessibilityRole="alert" style={styles.error} testID={`score-${blockId}-error`}>
          {validationError}
        </Text>
      )}

      <View style={styles.ranking}>
        <Text style={styles.rankingTitle}>Ranking da equipe</Text>
        {leaderboard.length === 0 ? (
          <Text style={styles.empty}>Ninguém da equipe registrou este bloco ainda.</Text>
        ) : (
          <View style={styles.leaderboard} testID={`leaderboard-${blockId}`}>
            {leaderboard.map((entry) => (
              <View key={entry.id} style={styles.entry}>
                <Text style={styles.rank}>{entry.rank}º</Text>
                <Text numberOfLines={1} style={styles.athlete}>
                  {entry.display_name}
                </Text>
                <Text style={styles.value}>{formatScore(entry)}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

function ScoreField({
  label,
  value,
  testID,
  onChangeText
}: {
  label: string;
  value: string;
  testID: string;
  onChangeText: (value: string) => void;
}) {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        inputMode="numeric"
        onBlur={() => setIsFocused(false)}
        onChangeText={onChangeText}
        onFocus={() => setIsFocused(true)}
        placeholder="0"
        placeholderTextColor={colors.textSecondary}
        style={[styles.input, isFocused && styles.inputFocused]}
        testID={testID}
        value={value}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    borderTopColor: colors.border,
    borderTopWidth: 1,
    gap: spacing[3],
    paddingTop: spacing[3]
  },
  title: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.interfaceBold,
    fontSize: 11,
    letterSpacing: 0.6,
    textTransform: "uppercase"
  },
  inputs: { alignItems: "flex-end", flexDirection: "row", flexWrap: "wrap", gap: spacing[3] },
  field: { gap: spacing[1], minWidth: 96 },
  fieldLabel: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.interface,
    fontSize: 11
  },
  input: {
    backgroundColor: colors.bg,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    color: colors.textPrimary,
    fontFamily: fontFamilies.mono,
    fontSize: 17,
    minHeight: 48,
    paddingHorizontal: spacing[3]
  },
  inputFocused: { borderColor: colors.purple400, borderWidth: 2 },
  submit: {
    alignItems: "center",
    backgroundColor: colors.purple500,
    borderColor: "transparent",
    borderRadius: radius.pill,
    borderWidth: 2,
    justifyContent: "center",
    minHeight: 52,
    paddingHorizontal: spacing[5],
    ...shadows.ctaGlow
  },
  submitFocused: { borderColor: colors.white },
  submitText: {
    color: colors.white,
    fontFamily: fontFamilies.interfaceBold,
    fontSize: 14
  },
  error: {
    color: colors.danger,
    fontFamily: fontFamilies.interface,
    fontSize: 13
  },
  empty: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.interface,
    fontSize: 13
  },
  ranking: { borderTopColor: colors.border, borderTopWidth: 1, gap: spacing[2], paddingTop: spacing[3] },
  rankingTitle: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.interfaceBold,
    fontSize: 11,
    letterSpacing: 0.6,
    textTransform: "uppercase"
  },
  leaderboard: { gap: 0 },
  entry: {
    alignItems: "center",
    borderTopColor: colors.border,
    borderTopWidth: 1,
    flexDirection: "row",
    gap: spacing[3],
    minHeight: 44
  },
  rank: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.mono,
    fontSize: 13,
    width: 32
  },
  athlete: {
    color: colors.textPrimary,
    flex: 1,
    fontFamily: fontFamilies.interface,
    fontSize: 14
  },
  value: {
    color: colors.purple500,
    fontFamily: fontFamilies.mono,
    fontSize: 14,
    fontWeight: "700"
  },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.72 }
});
