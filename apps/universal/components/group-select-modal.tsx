import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, fontFamilies, radius, spacing } from "@fitblock/design-tokens";
import type { DiscoverableTeamRecord } from "@fitblock/backend";
import { describeMembershipStatus } from "@/data/team-discovery";

type GroupSelectModalProps = {
  teams: DiscoverableTeamRecord[];
  isLoading: boolean;
  isSubmitting: boolean;
  onRequestJoin: (teamId: string) => void;
  onDismiss: () => void;
};

export function GroupSelectModal({ teams, isLoading, isSubmitting, onRequestJoin, onDismiss }: GroupSelectModalProps) {
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const canConfirm = selectedTeamId !== null && !isSubmitting;

  return (
    <View style={styles.backdrop}>
      <View style={styles.modal} testID="group-select-modal">
        <View style={styles.header}>
          <View>
            <Text style={styles.label}>Vínculo</Text>
            <Text style={styles.title}>Selecionar grupo</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Fechar seleção de grupo"
            testID="dismiss-group-select-modal"
            onPress={onDismiss}
            style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}
          >
            <Ionicons name="close" size={20} color={colors.ink} />
          </Pressable>
        </View>

        {isLoading ? (
          <Text style={styles.helperText}>Carregando grupos...</Text>
        ) : teams.length === 0 ? (
          <Text style={styles.helperText}>Nenhum grupo disponível no momento.</Text>
        ) : (
          <View accessibilityRole="radiogroup" accessibilityLabel="Grupos disponíveis" style={styles.teamList}>
            {teams.map((team) => {
              const statusLabel = describeMembershipStatus(team.membership_status);
              const isDisabled = team.membership_status !== "none";
              const isSelected = selectedTeamId === team.id;

              return (
                <Pressable
                  key={team.id}
                  accessibilityRole="radio"
                  accessibilityLabel={team.name}
                  accessibilityState={{ selected: isSelected, disabled: isDisabled }}
                  disabled={isDisabled}
                  testID={`group-option-${team.id}`}
                  onPress={() => setSelectedTeamId(team.id)}
                  style={({ pressed }) => [
                    styles.teamOption,
                    isSelected && styles.teamOptionSelected,
                    isDisabled && styles.teamOptionDisabled,
                    pressed && !isDisabled && styles.pressed
                  ]}
                >
                  {isDisabled ? (
                    <Ionicons
                      name={team.membership_status === "member" ? "checkmark-circle" : "time-outline"}
                      size={20}
                      color={colors.textMuted}
                    />
                  ) : (
                    <Ionicons
                      name={isSelected ? "radio-button-on" : "radio-button-off"}
                      size={20}
                      color={isSelected ? colors.fitblockPurple : colors.textMuted}
                    />
                  )}
                  <View style={styles.teamOptionCopy}>
                    <Text style={styles.teamOptionText}>{team.name}</Text>
                    <Text style={styles.teamOptionCoach}>treinador: {team.coach_display_name}</Text>
                  </View>
                  {statusLabel && <Text style={styles.statusBadge}>{statusLabel}</Text>}
                </Pressable>
              );
            })}
          </View>
        )}

        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Solicitar vínculo com o grupo selecionado"
            accessibilityState={{ disabled: !canConfirm }}
            disabled={!canConfirm}
            testID="confirm-group-select"
            onPress={() => selectedTeamId && onRequestJoin(selectedTeamId)}
            style={({ pressed }) => [
              styles.confirmButton,
              !canConfirm && styles.confirmButtonDisabled,
              pressed && styles.pressed
            ]}
          >
            <Text style={styles.confirmButtonText}>{isSubmitting ? "Enviando..." : "Solicitar vínculo"}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Cancelar"
            testID="cancel-group-select"
            onPress={onDismiss}
            style={({ pressed }) => [styles.cancelButton, pressed && styles.pressed]}
          >
            <Text style={styles.cancelButtonText}>Cancelar</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    flex: 1,
    justifyContent: "center",
    padding: spacing[4]
  },
  modal: {
    backgroundColor: colors.canvas,
    borderRadius: radius.lg,
    maxWidth: 450,
    maxHeight: "80%",
    padding: spacing[5],
    width: "100%"
  },
  header: { alignItems: "flex-start", flexDirection: "row", justifyContent: "space-between", marginBottom: spacing[4] },
  label: { color: colors.textMuted, fontFamily: fontFamilies.interface, fontSize: 12, fontWeight: "700", letterSpacing: 1 },
  title: { color: colors.ink, fontFamily: fontFamilies.interface, fontSize: 16, fontWeight: "700", marginTop: spacing[1] },
  closeButton: { alignItems: "center", height: 40, justifyContent: "center", width: 40 },
  helperText: { color: colors.textSecondary, fontFamily: fontFamilies.interface, fontSize: 14, marginBottom: spacing[3] },
  teamList: { gap: spacing[2], marginBottom: spacing[3] },
  teamOption: {
    alignItems: "center",
    borderColor: colors.hairline,
    borderRadius: radius.sm,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing[3],
    minHeight: 56,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2]
  },
  teamOptionSelected: { backgroundColor: colors.softCloud, borderColor: colors.fitblockPurple },
  teamOptionDisabled: { opacity: 0.6 },
  teamOptionCopy: { flex: 1, minWidth: 0 },
  teamOptionText: { color: colors.ink, fontFamily: fontFamilies.interface, fontSize: 14, fontWeight: "700" },
  teamOptionCoach: { color: colors.textMuted, fontFamily: fontFamilies.interface, fontSize: 12, marginTop: 2 },
  statusBadge: { color: colors.textMuted, fontFamily: fontFamilies.interface, fontSize: 11, fontWeight: "700" },
  actions: { flexDirection: "row", gap: spacing[3], marginTop: spacing[2] },
  confirmButton: {
    alignItems: "center",
    backgroundColor: colors.fitblockPurple,
    borderRadius: radius.pill,
    flex: 1,
    justifyContent: "center",
    minHeight: 44,
    paddingVertical: spacing[3]
  },
  confirmButtonDisabled: { backgroundColor: "#E8E6F0", opacity: 1 },
  confirmButtonText: { color: colors.canvas, fontFamily: fontFamilies.interface, fontSize: 14, fontWeight: "700" },
  cancelButton: {
    alignItems: "center",
    borderColor: colors.hairline,
    borderRadius: radius.pill,
    borderWidth: 1,
    flex: 1,
    justifyContent: "center",
    minHeight: 44,
    paddingVertical: spacing[3]
  },
  cancelButtonText: { color: colors.ink, fontFamily: fontFamilies.interface, fontSize: 14, fontWeight: "700" },
  pressed: { opacity: 0.72 }
});
