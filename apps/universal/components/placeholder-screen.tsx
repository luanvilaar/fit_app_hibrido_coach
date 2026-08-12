import { Ionicons } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, fontFamilies, radius, spacing } from "@fitblock/design-tokens";

type IconName = ComponentProps<typeof Ionicons>["name"];

type PlaceholderScreenProps = {
  eyebrow: string;
  title: string;
  description: string;
  icon: IconName;
};

export function PlaceholderScreen({ eyebrow, title, description, icon }: PlaceholderScreenProps) {
  return (
    <View style={styles.page}>
      <View style={styles.iconWrap}>
        <Ionicons name={icon} size={28} color={colors.purple400} />
      </View>
      <Text style={styles.eyebrow}>{eyebrow}</Text>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>
      <View style={styles.statusPill}>
        <View style={styles.statusDot} />
        <Text style={styles.statusText}>CONSTRUÇÃO EM ANDAMENTO</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    alignItems: "flex-start",
    backgroundColor: colors.surface02,
    borderColor: colors.border,
    borderRadius: radius.card,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 560,
    padding: spacing[9]
  },
  iconWrap: {
    alignItems: "center",
    backgroundColor: colors.surface04,
    borderColor: colors.borderPurple,
    borderRadius: radius.pill,
    borderWidth: 1,
    height: 64,
    justifyContent: "center",
    marginBottom: spacing[6],
    width: 64
  },
  eyebrow: {
    color: colors.purple400,
    fontFamily: fontFamilies.interfaceBold,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.3
  },
  title: {
    color: colors.textPrimary,
    fontFamily: fontFamilies.display,
    fontSize: 54,
    lineHeight: 47,
    marginTop: spacing[2],
    maxWidth: 620
  },
  description: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.interface,
    fontSize: 17,
    lineHeight: 26,
    marginTop: spacing[4],
    maxWidth: 560
  },
  statusPill: {
    alignItems: "center",
    backgroundColor: colors.surface03,
    borderRadius: radius.pill,
    flexDirection: "row",
    gap: spacing[2],
    marginTop: spacing[7],
    minHeight: 38,
    paddingHorizontal: spacing[4]
  },
  statusDot: {
    backgroundColor: colors.purple500,
    borderRadius: radius.pill,
    height: 7,
    width: 7
  },
  statusText: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.interface,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1
  }
});
