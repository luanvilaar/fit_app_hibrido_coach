import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, fontFamilies, radius, spacing, typeScale } from "@fitblock/design-tokens";
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
                  style={({ pressed }) => [styles.acceptButton, pressed && styles.pressed]}
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
                  style={({ pressed }) => [styles.declineButton, pressed && styles.pressed]}
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
    backgroundColor: colors.canvas,
    borderColor: colors.hairline,
    borderRadius: radius.lg,
    borderWidth: 1,
    marginTop: spacing[5],
    padding: spacing[5]
  },
  eyebrow: { color: colors.textMuted, fontFamily: fontFamilies.interface, fontSize: 10, fontWeight: "800", letterSpacing: 1.3 },
  title: {
    color: colors.ink,
    fontFamily: fontFamilies.interface,
    fontSize: typeScale.headingLg,
    fontWeight: "700",
    marginBottom: spacing[4],
    marginTop: spacing[2]
  },
  helperText: { color: colors.textSecondary, fontFamily: fontFamilies.interface, fontSize: 13 },
  requestRow: {
    alignItems: "center",
    borderTopColor: colors.hairline,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 56,
    paddingVertical: spacing[2]
  },
  requestName: { color: colors.ink, flex: 1, fontFamily: fontFamilies.interface, fontSize: 13, fontWeight: "700" },
  actions: { flexDirection: "row", gap: spacing[2] },
  acceptButton: {
    alignItems: "center",
    backgroundColor: colors.fitblockPurple,
    borderRadius: radius.pill,
    justifyContent: "center",
    minHeight: 36,
    paddingHorizontal: spacing[3]
  },
  acceptButtonText: { color: colors.canvas, fontFamily: fontFamilies.interface, fontSize: 11, fontWeight: "800" },
  declineButton: {
    alignItems: "center",
    borderColor: colors.hairline,
    borderRadius: radius.pill,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 36,
    paddingHorizontal: spacing[3]
  },
  declineButtonText: { color: colors.textSecondary, fontFamily: fontFamilies.interface, fontSize: 11, fontWeight: "800" },
  pressed: { opacity: 0.72 }
});
