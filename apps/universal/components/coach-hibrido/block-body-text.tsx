import { Ionicons } from "@expo/vector-icons";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { colors, fontFamilies, spacing } from "@fitblock/design-tokens";
import { splitBody, type BlockMovement } from "@/data/coach-hibrido/mentions";

export type BodyTone = "light" | "dark";

type BlockBodyTextProps = {
  body: string;
  movements: BlockMovement[];
  tone?: BodyTone;
  testID?: string;
};

/**
 * O treino como o coach escreveu. Cada `@Movimento` vira um link para o vídeo — e,
 * quando o movimento não tem vídeo cadastrado, continua marcado no texto, só sem ação,
 * para o atleta não tocar num alvo que não responde.
 */
export function BlockBodyText({ body, movements, tone = "light", testID }: BlockBodyTextProps) {
  const lines = splitBody(body, movements);
  const palette = tone === "dark" ? dark : light;

  return (
    <View style={styles.body} testID={testID}>
      {lines.map((segments, index) => (
        <Text key={index} style={[styles.line, palette.line]} selectable>
          {segments.length === 0 ? " " : null}
          {segments.map((segment, segmentIndex) =>
            segment.type === "text" ? (
              <Text key={segmentIndex} style={[styles.line, palette.line]}>
                {segment.value}
              </Text>
            ) : (
              <MovementMention
                key={segmentIndex}
                movement={segment.movement}
                label={segment.value}
                tone={tone}
              />
            )
          )}
        </Text>
      ))}
    </View>
  );
}

function MovementMention({
  movement,
  label,
  tone
}: {
  movement: BlockMovement;
  label: string;
  tone: BodyTone;
}) {
  const palette = tone === "dark" ? dark : light;

  if (!movement.videoUrl) {
    return (
      <Text
        accessibilityLabel={`${label}. Vídeo não cadastrado.`}
        style={[styles.line, styles.mention, palette.mentionMuted]}
      >
        {label}
      </Text>
    );
  }

  return (
    <Text
      accessibilityRole="link"
      accessibilityLabel={`Ver vídeo de ${label}`}
      onPress={() => void Linking.openURL(movement.videoUrl as string)}
      style={[styles.line, styles.mention, palette.mention]}
      testID={`movement-${movement.slug}`}
    >
      {label}
    </Text>
  );
}

type MovementListProps = {
  movements: BlockMovement[];
  tone?: BodyTone;
  testID?: string;
};

/** Tira de movimentos vinculados, para o coach conferir o que o atleta vai conseguir abrir. */
export function MovementList({ movements, tone = "light", testID }: MovementListProps) {
  if (movements.length === 0) return null;

  const palette = tone === "dark" ? dark : light;

  return (
    <View style={styles.movementList} testID={testID}>
      {movements.map((movement) => {
        const hasVideo = Boolean(movement.videoUrl);

        return (
          <Pressable
            key={movement.slug}
            accessibilityRole={hasVideo ? "link" : "text"}
            accessibilityLabel={
              hasVideo ? `Ver vídeo de ${movement.name}` : `${movement.name}. Vídeo não cadastrado.`
            }
            disabled={!hasVideo}
            onPress={() => movement.videoUrl && void Linking.openURL(movement.videoUrl)}
            style={({ pressed }) => [
              styles.movementChip,
              palette.chip,
              pressed && styles.pressed
            ]}
            testID={`${testID}-${movement.slug}`}
          >
            <Ionicons
              name={hasVideo ? "play-circle-outline" : "videocam-off-outline"}
              size={15}
              color={hasVideo ? palette.chipIcon.color : palette.chipMutedIcon.color}
            />
            <Text style={[styles.movementChipText, palette.chipText]}>{movement.name}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  body: { gap: 2 },
  line: {
    fontFamily: fontFamilies.mono,
    fontSize: 14,
    lineHeight: 22
  },
  mention: { fontWeight: "700" },
  movementList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing[2]
  },
  movementChip: {
    alignItems: "center",
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing[1],
    minHeight: 34,
    paddingHorizontal: spacing[2]
  },
  movementChipText: {
    fontFamily: fontFamilies.interface,
    fontSize: 12,
    fontWeight: "700"
  },
  pressed: { opacity: 0.72 }
});

/**
 * O link usa `mentionLink` e não o roxo de ação: sobre graphite o #7132F5 rende 3.0:1, e o
 * nome do movimento é corpo de 14px, que a AA cobra em 4.5:1. Sublinhado e ícone continuam
 * marcando o link para quem não distingue a cor.
 */
const light = StyleSheet.create({
  line: { color: colors.textPrimary },
  mention: { color: colors.mentionLink, textDecorationLine: "underline" },
  mentionMuted: { color: colors.textMutedAccessible, textDecorationLine: "underline", textDecorationStyle: "dotted" },
  chip: { backgroundColor: colors.bgDeep, borderColor: colors.border },
  chipText: { color: colors.textPrimary },
  chipIcon: { color: colors.mentionLink },
  chipMutedIcon: { color: colors.textMutedAccessible }
});

/** Sobre `colors.bgDeep` (ex: painel de execução do atleta). */
const dark = StyleSheet.create({
  line: { color: colors.textPrimary },
  mention: { color: colors.mentionLink, textDecorationLine: "underline" },
  mentionMuted: { color: colors.textMutedAccessible, textDecorationLine: "underline", textDecorationStyle: "dotted" },
  chip: { backgroundColor: colors.bg, borderColor: colors.border },
  chipText: { color: colors.textPrimary },
  chipIcon: { color: colors.mentionLink },
  chipMutedIcon: { color: colors.textMutedAccessible }
});
