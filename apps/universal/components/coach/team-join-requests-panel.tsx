import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, fontFamilies, radius, shadows, spacing, typeScale } from "@fitblock/design-tokens";
import type { TeamJoinRequestWithAthleteRecord } from "@fitblock/backend";

type TeamJoinRequestsPanelProps = {
  requests: TeamJoinRequestWithAthleteRecord[];
  isLoading: boolean;
  respondingRequestId: string | null;
  onAccept: (requestId: string) => void;
  onDecline: (requestId: string) => void;
};

export function TeamJoinRequestsPanel({
  requests,
  isLoading,
  respondingRequestId,
  onAccept,
  onDecline
}: TeamJoinRequestsPanelProps) {
  const [focusedControl, setFocusedControl] = useState<string | null>(null);

  if (!isLoading && requests.length === 0) return null;

  return (
    <View style={styles.card} testID="coach-team-join-requests-panel">
      <Text style={styles.eyebrow}>SOLICITAÇÕES</Text>
      <Text style={styles.title}>Pedidos de vínculo pendentes</Text>

      {isLoading && <Text style={styles.helperText}>Carregando solicitações...</Text>}

      {!isLoading &&
        requests.map((request) => {
          const isResponding = respondingRequestId === request.id;

          return (
            <View key={request.id} style={styles.requestRow} testID={`join-request-${request.id}`}>
              <Text style={styles.requestName}>{request.athlete_display_name}</Text>
              <View style={styles.actions}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Aceitar ${request.athlete_display_name}`}
                  accessibilityState={{ disabled: isResponding }}
                  disabled={isResponding}
                  testID={`accept-join-request-${request.id}`}
                  onPress={() => onAccept(request.id)}
                  onFocus={() => setFocusedControl(`accept-${request.id}`)}
                  onBlur={() => setFocusedControl(null)}
                  style={({ pressed }) => [
                    styles.acceptButton,
                    focusedControl === `accept-${request.id}` && styles.focusedControlOnColor,
                    pressed && styles.pressed
                  ]}
                >
                  <Text style={styles.acceptButtonText}>{isResponding ? "..." : "Aceitar"}</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Recusar ${request.athlete_display_name}`}
                  accessibilityState={{ disabled: isResponding }}
                  disabled={isResponding}
                  testID={`decline-join-request-${request.id}`}
                  onPress={() => onDecline(request.id)}
                  onFocus={() => setFocusedControl(`decline-${request.id}`)}
                  onBlur={() => setFocusedControl(null)}
                  style={({ pressed }) => [
                    styles.declineButton,
                    focusedControl === `decline-${request.id}` && styles.focusedControl,
                    pressed && styles.pressed
                  ]}
                >
                  <Text style={styles.declineButtonText}>Recusar</Text>
                </Pressable>
              </View>
            </View>
          );
        })}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface02,
    borderColor: colors.border,
    borderRadius: radius.xl,
    borderWidth: 1,
    marginTop: spacing[5],
    padding: spacing[5],
    ...shadows.card
  },
  eyebrow: { color: colors.purple500, fontFamily: fontFamilies.interfaceBold, fontSize: 10, letterSpacing: 1.3 },
  title: {
    color: colors.textPrimary,
    fontFamily: fontFamilies.interfaceBold,
    fontSize: typeScale.headingMd,
    marginBottom: spacing[4],
    marginTop: spacing[2]
  },
  helperText: { color: colors.textSecondary, fontFamily: fontFamilies.interface, fontSize: 13 },
  requestRow: {
    alignItems: "center",
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 56,
    paddingVertical: spacing[2]
  },
  requestName: { color: colors.textPrimary, flex: 1, fontFamily: fontFamilies.interfaceBold, fontSize: 13 },
  actions: { flexDirection: "row", gap: spacing[2] },
  acceptButton: {
    alignItems: "center",
    backgroundColor: colors.success,
    borderRadius: radius.pill,
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: spacing[3]
  },
  acceptButtonText: { color: colors.white, fontFamily: fontFamilies.interfaceBold, fontSize: 11 },
  declineButton: {
    alignItems: "center",
    borderColor: colors.border,
    borderRadius: radius.pill,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: spacing[3]
  },
  declineButtonText: { color: colors.textSecondary, fontFamily: fontFamilies.interfaceBold, fontSize: 11 },
  focusedControl: { borderColor: colors.purple400, borderWidth: 3 },
  focusedControlOnColor: { borderColor: colors.white, borderWidth: 3 },
  pressed: { opacity: 0.72 }
});
