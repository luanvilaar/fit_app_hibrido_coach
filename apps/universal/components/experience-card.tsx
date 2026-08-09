import { Ionicons } from "@expo/vector-icons";
import * as Linking from "expo-linking";
import { useEffect, useState } from "react";
import {
  Platform,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
  useWindowDimensions
} from "react-native";
import { colors, fontFamilies, radius, spacing } from "@fitblock/design-tokens";
import {
  experienceStatusLabels,
  type FitBlockExperience,
  type ExperienceStatus
} from "@/data/home";
import { track } from "@/lib/analytics";

type ExperienceCardProps = {
  experience: FitBlockExperience;
  style?: StyleProp<ViewStyle>;
};

const statusColors: Record<ExperienceStatus, string> = {
  open: colors.success,
  last_spots: colors.warning,
  closed: colors.textMuted,
  interest: colors.fitblockPurpleLight,
  completed: colors.textMuted
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
      <View style={[styles.hero, isMobile && styles.heroMobile]}>
        <Text style={[styles.order, isMobile && styles.orderMobile]}>{String(experience.order).padStart(2, "0")}</Text>
        <Ionicons name="arrow-up" size={22} color={colors.canvas} style={[styles.arrow, isMobile && styles.arrowMobile]} />
        <Text style={[styles.typeLabel, isMobile && styles.typeLabelMobile]}>{experience.typeLabel}</Text>
        <View style={[styles.heroCross, isMobile && styles.heroCrossMobile]} />
      </View>
      <View style={[styles.footer, isMobile && styles.footerMobile]}>
        <View style={[styles.metaRow, isMobile && styles.metaRowMobile]}>
          <Text style={styles.date} accessibilityLabel={`Data: ${experience.date}`}>
            {experience.date}
          </Text>
          <View style={[styles.statusRow, isMobile && styles.statusRowMobile]}>
            <View style={[styles.statusDot, { backgroundColor: statusColors[experience.status] }]} />
            <Text style={[styles.status, isMobile && styles.statusMobile, { color: statusColors[experience.status] }]}>
              {statusLabel}
            </Text>
          </View>
        </View>
        <Text style={[styles.title, isMobile && styles.titleMobile]}>{experience.title}</Text>
        <Text style={[styles.location, isMobile && styles.locationMobile]}>{experience.location}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.graphite,
    borderColor: "transparent",
    borderRadius: radius.lg,
    borderWidth: 2,
    flex: 1,
    minWidth: 0,
    overflow: "hidden"
  },
  cardFocused: {
    borderColor: colors.fitblockPurpleLight
  },
  cardPressed: {
    opacity: 0.78
  },
  hero: {
    backgroundColor: colors.fitblockPurpleDeep,
    height: 240,
    justifyContent: "space-between",
    overflow: "hidden",
    padding: spacing[5]
  },
  heroMobile: {
    height: 200,
    padding: spacing[4]
  },
  order: {
    color: colors.fitblockPurpleLight,
    fontFamily: fontFamilies.interface,
    fontSize: 20,
    fontWeight: "700"
  },
  orderMobile: {
    fontSize: 18
  },
  arrow: {
    position: "absolute",
    right: spacing[5],
    top: spacing[5],
    transform: [{ rotate: "45deg" }]
  },
  arrowMobile: {
    right: spacing[4],
    top: spacing[4]
  },
  typeLabel: {
    alignSelf: "center",
    color: colors.canvas,
    fontFamily: fontFamilies.interface,
    fontSize: 92,
    fontWeight: "700",
    letterSpacing: -3,
    lineHeight: 88,
    opacity: 0.92
  },
  typeLabelMobile: {
    fontSize: 72,
    lineHeight: 68
  },
  heroCross: {
    borderColor: colors.fitblockPurpleLight,
    borderRightWidth: 2,
    borderTopWidth: 2,
    height: 80,
    position: "absolute",
    pointerEvents: "none",
    right: spacing[5],
    top: spacing[5] + 22,
    transform: [{ rotate: "45deg" }],
    width: 80
  },
  heroCrossMobile: {
    height: 64,
    right: spacing[4],
    top: spacing[4] + 22,
    width: 64
  },
  footer: {
    minHeight: 168,
    padding: spacing[5]
  },
  footerMobile: {
    minHeight: 156,
    padding: spacing[4]
  },
  metaRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  metaRowMobile: {
    gap: spacing[2]
  },
  date: {
    color: colors.fitblockPurpleLight,
    fontFamily: fontFamilies.interface,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1
  },
  statusRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[2],
    maxWidth: "50%"
  },
  statusRowMobile: {
    maxWidth: "100%"
  },
  statusDot: {
    borderRadius: radius.pill,
    height: 6,
    width: 6
  },
  status: {
    fontFamily: fontFamilies.interface,
    fontSize: 10,
    fontWeight: "800",
    textAlign: "right"
  },
  statusMobile: {
    textAlign: "left"
  },
  title: {
    color: colors.canvas,
    fontFamily: fontFamilies.interface,
    fontSize: 27,
    fontWeight: "700",
    marginTop: spacing[4]
  },
  titleMobile: {
    fontSize: 23,
    lineHeight: 26,
    marginTop: spacing[3]
  },
  location: {
    color: "#B5B6C2",
    fontFamily: fontFamilies.interface,
    fontSize: 13,
    marginTop: spacing[2]
  },
  locationMobile: {
    fontSize: 12
  }
});
