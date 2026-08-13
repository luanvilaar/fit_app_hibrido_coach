import { Ionicons } from "@expo/vector-icons";
import * as Linking from "expo-linking";
import { useEffect, useState } from "react";
import {
  Image,
  Platform,
  Pressable,
  type StyleProp,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
  useWindowDimensions
} from "react-native";
import { colors, fontFamilies, radius, spacing } from "@fitblock/design-tokens";
import {
  experienceStatusLabels,
  type ExperienceStatus,
  type FitBlockExperience
} from "@/data/home";
import { track } from "@/lib/analytics";

type ExperienceCardProps = {
  experience: FitBlockExperience;
  style?: StyleProp<ViewStyle>;
};

const statusColors: Record<ExperienceStatus, string> = {
  open: colors.success,
  last_spots: colors.warning,
  closed: colors.textMutedAccessible,
  interest: colors.purple400,
  completed: colors.textMutedAccessible
};

function getAnalyticsPayload(experience: FitBlockExperience) {
  return {
    event_id: experience.id,
    event_name: experience.title,
    event_status: experience.status,
    event_location: experience.location,
    destination: experience.href,
    section: "experiencias_fitblock"
  };
}

export function ExperienceCard({ experience, style }: ExperienceCardProps) {
  const { width } = useWindowDimensions();
  const isMobile = width < 768;
  const [isFocused, setIsFocused] = useState(false);
  const statusLabel = experienceStatusLabels[experience.status];

  useEffect(() => {
    track("experience_card_view", getAnalyticsPayload(experience));
  }, [experience]);

  function openDestination() {
    const payload = getAnalyticsPayload(experience);
    track("experience_card_click", payload);

    if (experience.id === "fitblock-training-camp-2026") {
      track("training_camp_card_click", payload);
    }

    if (experience.external) {
      track("wodarena_redirect", payload);
    }

    if (experience.external && Platform.OS === "web" && typeof window !== "undefined") {
      const externalWindow = window.open(experience.href, "_blank", "noopener,noreferrer");
      if (externalWindow) {
        externalWindow.opener = null;
        return;
      }
    }

    void Linking.openURL(experience.href);
  }

  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`Abrir ${experience.title}, ${experience.date}, ${experience.location}. ${statusLabel}`}
      testID={`experience-card-${experience.id}`}
      onBlur={() => setIsFocused(false)}
      onFocus={() => setIsFocused(true)}
      onPress={openDestination}
      style={({ pressed }) => [
        styles.card,
        style,
        isFocused && styles.cardFocused,
        pressed && styles.cardPressed
      ]}
    >
      <View style={[styles.visual, isMobile && styles.visualMobile]}>
        {experience.coverImage && (
          <Image
            accessible={false}
            resizeMode="cover"
            source={experience.coverImage}
            style={styles.coverImage}
            testID={`experience-cover-${experience.id}`}
          />
        )}
        {experience.coverImage && <View pointerEvents="none" style={styles.coverScrim} />}
        <View style={styles.visualSignal} />
        <Text style={[styles.typeLabel, isMobile && styles.typeLabelMobile]}>{experience.typeLabel}</Text>
        <View style={styles.arrowFrame}>
          <Ionicons name="arrow-forward" size={20} color={colors.white} />
        </View>
      </View>
      <View style={[styles.content, isMobile && styles.contentMobile]}>
        <View style={[styles.metaRow, isMobile && styles.metaRowMobile]}>
          <Text style={styles.date} accessibilityLabel={`Data: ${experience.date}`}>
            {experience.date}
          </Text>
          <View style={styles.statusRow}>
            <View style={[styles.statusDot, { backgroundColor: statusColors[experience.status] }]} />
            <Text style={[styles.status, { color: statusColors[experience.status] }]}>{statusLabel}</Text>
          </View>
        </View>
        <Text accessibilityRole="header" style={[styles.title, isMobile && styles.titleMobile]}>
          {experience.title}
        </Text>
        <Text style={styles.location}>{experience.location}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface02,
    borderColor: colors.border,
    borderRadius: radius.card,
    borderWidth: 1,
    flex: 1,
    minWidth: 0,
    overflow: "hidden"
  },
  cardFocused: {
    borderColor: colors.purple400,
    borderWidth: 2
  },
  cardPressed: {
    opacity: 0.82
  },
  visual: {
    backgroundColor: colors.surface03,
    height: 210,
    justifyContent: "center",
    overflow: "hidden",
    padding: spacing[5],
    position: "relative"
  },
  visualMobile: {
    height: 190,
    padding: spacing[4]
  },
  coverImage: {
    height: "100%",
    left: 0,
    position: "absolute",
    top: 0,
    width: "100%"
  },
  coverScrim: {
    backgroundColor: "rgba(5, 5, 7, 0.38)",
    bottom: 0,
    left: 0,
    position: "absolute",
    right: 0,
    top: 0
  },
  visualSignal: {
    backgroundColor: colors.purple500,
    height: 5,
    left: 0,
    position: "absolute",
    top: 0,
    width: "100%"
  },
  typeLabel: {
    color: colors.textPrimary,
    fontFamily: fontFamilies.displayBold,
    fontSize: 88,
    letterSpacing: -1.8,
    lineHeight: 78,
    textShadowColor: "rgba(5, 5, 7, 0.78)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
    textTransform: "uppercase"
  },
  typeLabelMobile: {
    fontSize: 72,
    lineHeight: 65
  },
  arrowFrame: {
    alignItems: "center",
    backgroundColor: colors.purple500,
    borderRadius: radius.pill,
    height: 42,
    justifyContent: "center",
    position: "absolute",
    right: spacing[5],
    top: spacing[5],
    width: 42
  },
  content: {
    flex: 1,
    minHeight: 180,
    padding: spacing[5]
  },
  contentMobile: {
    minHeight: 170,
    padding: spacing[4]
  },
  metaRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[2],
    justifyContent: "space-between"
  },
  metaRowMobile: {
    alignItems: "flex-start",
    flexDirection: "column"
  },
  date: {
    color: colors.purple400,
    fontFamily: fontFamilies.interfaceBold,
    fontSize: 11,
    letterSpacing: 0.9
  },
  statusRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[2]
  },
  statusDot: {
    borderRadius: radius.pill,
    height: 7,
    width: 7
  },
  status: {
    fontFamily: fontFamilies.interfaceSemiBold,
    fontSize: 11,
    textAlign: "right"
  },
  title: {
    color: colors.textPrimary,
    fontFamily: fontFamilies.displayBold,
    fontSize: 34,
    letterSpacing: -0.35,
    lineHeight: 33,
    marginTop: spacing[5],
    textTransform: "uppercase"
  },
  titleMobile: {
    fontSize: 30,
    lineHeight: 29,
    marginTop: spacing[4]
  },
  location: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.interface,
    fontSize: 13,
    lineHeight: 20,
    marginTop: spacing[2]
  }
});
