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
        <Ionicons name={icon} size={28} color={colors.fitblockPurple} />
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
    backgroundColor: colors.canvas,
    borderColor: colors.hairline,
    borderRadius: radius.xl,
    justifyContent: "center",
    minHeight: 560,
    padding: spacing[9]
  },
  iconWrap: {
    alignItems: "center",
    backgroundColor: "#F0EBFF",
    borderRadius: radius.md,
    height: 64,
    justifyContent: "center",
    marginBottom: spacing[6],
    width: 64
  },
  eyebrow: {
    color: colors.fitblockPurple,
    fontFamily: fontFamilies.interface,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.3
  },
  title: {
    color: colors.ink,
    fontFamily: fontFamilies.interface,
    fontSize: 42,
    fontWeight: "700",
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
    backgroundColor: colors.softCloud,
    borderRadius: radius.pill,
    flexDirection: "row",
    gap: spacing[2],
    marginTop: spacing[7],
    minHeight: 38,
    paddingHorizontal: spacing[4]
  },
  statusDot: {
    backgroundColor: colors.fitblockPurple,
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
