import { Ionicons } from "@expo/vector-icons";
import { useMemo } from "react";
import { Linking, Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { fontFamilies, spacing, type ThemeColors } from "@fitblock/design-tokens";
import { splitBody, type BlockMovement } from "@/data/coach-hibrido/mentions";
import { useAppTheme } from "@/theme/theme-provider";

const MOBILE_WIDTH_BREAKPOINT = 768;

/**
 * No mobile web, o link do YouTube costuma ser interceptado pelo SO (Universal/App Links),
 * que abre o app nativo antes da aba nova carregar qualquer coisa — ela fica travada em
 * branco quando o atleta volta ao navegador. Navegar na aba atual evita essa aba fantasma;
 * no desktop não há esse handoff de app, então mantemos a nova aba.
 */
function openMovementVideo(url: string, isMobileWeb: boolean) {
  if (Platform.OS === "web" && typeof window !== "undefined") {
    if (isMobileWeb) {
      window.open(url, "_self");
    } else {
      window.open(url, "_blank", "noopener,noreferrer");
    }
    return;
  }

  void Linking.openURL(url);
}

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
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const lines = splitBody(body, movements);
  const palette = paletteFor(styles, tone);

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
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const palette = paletteFor(styles, tone);
  const { width } = useWindowDimensions();
  const isMobileWeb = width < MOBILE_WIDTH_BREAKPOINT;

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
      onPress={() => openMovementVideo(movement.videoUrl as string, isMobileWeb)}
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
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const palette = paletteFor(styles, tone);
  const { width } = useWindowDimensions();
  const isMobileWeb = width < MOBILE_WIDTH_BREAKPOINT;

  if (movements.length === 0) return null;

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
            onPress={() => movement.videoUrl && openMovementVideo(movement.videoUrl, isMobileWeb)}
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

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    body: { gap: 2 },
    line: { fontFamily: fontFamilies.mono, fontSize: 14, lineHeight: 22 },
    mention: { fontWeight: "700" },
    movementList: { flexDirection: "row", flexWrap: "wrap", gap: spacing[2] },
    movementChip: { alignItems: "center", borderWidth: 1, flexDirection: "row", gap: spacing[1], minHeight: 34, paddingHorizontal: spacing[2] },
    movementChipText: { fontFamily: fontFamilies.interface, fontSize: 12, fontWeight: "700" },
    pressed: { opacity: 0.72 },
    lineLight: { color: colors.textPrimary },
    mentionLight: { color: colors.mentionLink, textDecorationLine: "underline" },
    mentionMutedLight: { color: colors.textMutedAccessible, textDecorationLine: "underline", textDecorationStyle: "dotted" },
    chipLight: { backgroundColor: colors.bgDeep, borderColor: colors.border },
    chipTextLight: { color: colors.textPrimary },
    chipIconLight: { color: colors.mentionLink },
    chipMutedIconLight: { color: colors.textMutedAccessible },
    lineDark: { color: colors.textPrimary },
    mentionDark: { color: colors.mentionLink, textDecorationLine: "underline" },
    mentionMutedDark: { color: colors.textMutedAccessible, textDecorationLine: "underline", textDecorationStyle: "dotted" },
    chipDark: { backgroundColor: colors.bg, borderColor: colors.border },
    chipTextDark: { color: colors.textPrimary },
    chipIconDark: { color: colors.mentionLink },
    chipMutedIconDark: { color: colors.textMutedAccessible }
  });
}

function paletteFor(styles: ReturnType<typeof createStyles>, tone: BodyTone) {
  const suffix = tone === "dark" ? "Dark" : "Light";
  return {
    line: styles[`line${suffix}`],
    mention: styles[`mention${suffix}`],
    mentionMuted: styles[`mentionMuted${suffix}`],
    chip: styles[`chip${suffix}`],
    chipText: styles[`chipText${suffix}`],
    chipIcon: styles[`chipIcon${suffix}`],
    chipMutedIcon: styles[`chipMutedIcon${suffix}`]
  };
}
