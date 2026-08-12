import { Ionicons } from "@expo/vector-icons";
import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import type { ExerciseRecord } from "@fitblock/backend";
import { colors, fontFamilies, radius, spacing } from "@fitblock/design-tokens";
import { applyMention, findMentionQuery, suggestMovements } from "@/data/coach-hibrido/mentions";

type MovementMentionInputProps = {
  value: string;
  catalog: ExerciseRecord[];
  placeholder: string;
  accessibilityLabel: string;
  testID: string;
  onChangeText: (value: string) => void;
};

/**
 * A caixa onde o coach escreve o treino.
 *
 * Digitar `@` abre a lista do catálogo abaixo do campo — e não flutuando sobre ele, porque
 * o sistema é plano e uma lista ancorada continua acessível por teclado e por leitor de tela.
 */
export function MovementMentionInput({
  value,
  catalog,
  placeholder,
  accessibilityLabel,
  testID,
  onChangeText
}: MovementMentionInputProps) {
  const [cursor, setCursor] = useState(0);
  const [isFocused, setIsFocused] = useState(false);
  // Só governa a seleção no render seguinte a uma inserção; fora disso o cursor é do usuário.
  const [pendingSelection, setPendingSelection] = useState<{ start: number; end: number } | null>(null);

  const query = useMemo(
    () => (isFocused ? findMentionQuery(value, cursor) : null),
    [isFocused, value, cursor]
  );
  const suggestions = useMemo(
    () => (query ? suggestMovements(catalog, query.term) : []),
    [catalog, query]
  );

  function insert(name: string) {
    if (!query) return;

    const applied = applyMention(value, query, name);
    onChangeText(applied.text);
    setCursor(applied.cursor);
    setPendingSelection({ start: applied.cursor, end: applied.cursor });
  }

  return (
    <View style={styles.field}>
      <TextInput
        accessibilityLabel={accessibilityLabel}
        multiline
        onBlur={() => setIsFocused(false)}
        onChangeText={(next) => {
          setPendingSelection(null);
          onChangeText(next);
        }}
        onFocus={() => setIsFocused(true)}
        onSelectionChange={(event) => {
          setCursor(event.nativeEvent.selection.start);
          setPendingSelection(null);
        }}
        placeholder={placeholder}
        placeholderTextColor={colors.textSecondary}
        selection={pendingSelection ?? undefined}
        style={[styles.input, isFocused && styles.inputFocused]}
        testID={testID}
        value={value}
      />

      {query && suggestions.length > 0 && (
        <View accessibilityRole="menu" style={styles.suggestions} testID={`${testID}-suggestions`}>
          <Text style={styles.suggestionsTitle}>
            Movimentos do catálogo {query.term ? `com “${query.term}”` : ""}
          </Text>
          {suggestions.map((exercise) => (
            <MovementSuggestion
              exercise={exercise}
              key={exercise.id}
              onPress={() => insert(exercise.name)}
              testID={`${testID}-suggestion-${exercise.slug}`}
            />
          ))}
        </View>
      )}

      {query && suggestions.length === 0 && query.term.trim().length > 1 && (
        <Text style={styles.emptyHint} testID={`${testID}-no-suggestions`}>
          Nenhum movimento do catálogo com “{query.term.trim()}”. O texto continua valendo — só não
          terá vídeo.
        </Text>
      )}
    </View>
  );
}

function MovementSuggestion({
  exercise,
  testID,
  onPress
}: {
  exercise: ExerciseRecord;
  testID: string;
  onPress: () => void;
}) {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <Pressable
      accessibilityRole="menuitem"
      accessibilityLabel={`Inserir ${exercise.name}${exercise.video_url ? " com vídeo" : ", sem vídeo cadastrado"}`}
      onBlur={() => setIsFocused(false)}
      onFocus={() => setIsFocused(true)}
      onPress={onPress}
      style={({ pressed }) => [
        styles.suggestion,
        isFocused && styles.suggestionFocused,
        pressed && styles.suggestionPressed
      ]}
      testID={testID}
    >
      <Ionicons
        color={exercise.video_url ? colors.purple500 : colors.textSecondary}
        name={exercise.video_url ? "play-circle-outline" : "videocam-off-outline"}
        size={17}
      />
      <Text style={styles.suggestionName}>{exercise.name}</Text>
      {!exercise.video_url && <Text style={styles.suggestionMeta}>sem vídeo</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  field: { gap: spacing[2] },
  input: {
    backgroundColor: colors.surface01,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    color: colors.textPrimary,
    fontFamily: fontFamilies.mono,
    fontSize: 14,
    lineHeight: 22,
    minHeight: 168,
    padding: spacing[3],
    textAlignVertical: "top"
  },
  inputFocused: {
    borderColor: colors.purple400,
    borderWidth: 2,
    padding: spacing[3] - 1
  },
  suggestions: {
    backgroundColor: colors.surface02,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    overflow: "hidden"
  },
  suggestionsTitle: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.interfaceBold,
    fontSize: 11,
    letterSpacing: 0.4,
    paddingHorizontal: spacing[3],
    paddingTop: spacing[3]
  },
  suggestion: {
    alignItems: "center",
    borderTopColor: colors.border,
    borderTopWidth: 1,
    flexDirection: "row",
    gap: spacing[2],
    minHeight: 46,
    paddingHorizontal: spacing[3]
  },
  suggestionFocused: {
    backgroundColor: colors.purple700
  },
  suggestionPressed: {
    backgroundColor: colors.purple700,
    opacity: 0.85
  },
  suggestionName: {
    color: colors.textPrimary,
    flex: 1,
    fontFamily: fontFamilies.interfaceMedium,
    fontSize: 14
  },
  suggestionMeta: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.interface,
    fontSize: 11
  },
  emptyHint: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.interface,
    fontSize: 12,
    lineHeight: 18
  }
});
