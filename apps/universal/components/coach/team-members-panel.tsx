import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { colors, fontFamilies, radius, spacing, typeScale } from "@fitblock/design-tokens";
import type { TeamMemberRecord } from "@fitblock/backend";
import {
  createInitialMemberInviteForm,
  updateMemberInviteField,
  type MemberInviteForm
} from "@/data/coach-teams";

const roleLabels = { coach: "Coach", athlete: "Atleta" } as const;

type TeamMembersPanelProps = {
  members: TeamMemberRecord[];
  isLoading: boolean;
  isInviting: boolean;
  removingMemberId: string | null;
  onInvite: (form: MemberInviteForm) => void;
  onRemove: (memberId: string) => void;
};

export function TeamMembersPanel({
  members,
  isLoading,
  isInviting,
  removingMemberId,
  onInvite,
  onRemove
}: TeamMembersPanelProps) {
  const [form, setForm] = useState<MemberInviteForm>(() => createInitialMemberInviteForm());
  const [confirmingMemberId, setConfirmingMemberId] = useState<string | null>(null);

  function handleInvite() {
    onInvite(form);
    setForm(createInitialMemberInviteForm());
  }

  return (
    <View style={styles.card} testID="coach-team-members-panel">
      <Text style={styles.eyebrow}>MEMBROS</Text>
      <Text style={styles.title}>Coaches e atletas da equipe</Text>

      {isLoading && <Text style={styles.helperText}>Carregando membros...</Text>}
      {!isLoading && members.length === 0 && (
        <Text style={styles.helperText}>Nenhum membro nesta equipe ainda.</Text>
      )}

      {!isLoading &&
        members.map((member) => (
          <View key={member.id} style={styles.memberRow} testID={`member-${member.id}`}>
            <View style={styles.memberCopy}>
              <Text style={styles.memberEmail}>{member.email}</Text>
              <Text style={styles.memberRole}>{roleLabels[member.role]}</Text>
            </View>

            {confirmingMemberId === member.id ? (
              <View style={styles.confirmInline}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Confirmar remoção de ${member.email}`}
                  accessibilityState={{ disabled: removingMemberId === member.id }}
                  disabled={removingMemberId === member.id}
                  testID={`confirm-remove-member-${member.id}`}
                  onPress={() => onRemove(member.id)}
                  style={({ pressed }) => [styles.confirmDangerButton, pressed && styles.pressed]}
                >
                  <Text style={styles.confirmDangerText}>
                    {removingMemberId === member.id ? "Removendo..." : "Remover"}
                  </Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Manter membro na equipe"
                  testID={`dismiss-remove-member-${member.id}`}
                  onPress={() => setConfirmingMemberId(null)}
                  style={({ pressed }) => [styles.ghostButton, pressed && styles.pressed]}
                >
                  <Text style={styles.ghostButtonText}>Manter</Text>
                </Pressable>
              </View>
            ) : (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Remover ${member.email} da equipe`}
                testID={`request-remove-member-${member.id}`}
                onPress={() => setConfirmingMemberId(member.id)}
                style={({ pressed }) => [styles.iconAction, pressed && styles.pressed]}
              >
                <Ionicons name="trash-outline" size={16} color={colors.textSecondary} />
              </Pressable>
            )}
          </View>
        ))}

      <View style={styles.divider} />

      <Text style={styles.inviteLabel}>Adicionar membro por e-mail</Text>
      <View style={styles.inviteRow}>
        <TextInput
          accessibilityLabel="E-mail do novo membro"
          autoCapitalize="none"
          keyboardType="email-address"
          onChangeText={(value) => setForm(updateMemberInviteField(form, "email", value))}
          placeholder="atleta@exemplo.com"
          placeholderTextColor={colors.textMuted}
          style={[styles.input, styles.inviteInput]}
          testID="member-invite-email"
          value={form.email}
        />
        <View accessibilityRole="radiogroup" accessibilityLabel="Papel do novo membro" style={styles.roleChipRow}>
          {(Object.keys(roleLabels) as Array<keyof typeof roleLabels>).map((role) => (
            <Pressable
              key={role}
              accessibilityRole="radio"
              accessibilityLabel={roleLabels[role]}
              accessibilityState={{ selected: form.role === role }}
              testID={`member-invite-role-${role}`}
              onPress={() => setForm(updateMemberInviteField(form, "role", role))}
              style={({ pressed }) => [
                styles.roleChip,
                form.role === role && styles.roleChipActive,
                pressed && styles.pressed
              ]}
            >
              <Text style={[styles.roleChipText, form.role === role && styles.roleChipTextActive]}>
                {roleLabels[role]}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Adicionar membro à equipe"
        accessibilityState={{ disabled: isInviting }}
        disabled={isInviting}
        testID="submit-member-invite"
        onPress={handleInvite}
        style={({ pressed }) => [styles.submitButton, isInviting && styles.submitButtonDisabled, pressed && styles.pressed]}
      >
        <Ionicons name="person-add-outline" size={15} color={colors.canvas} />
        <Text style={styles.submitButtonText}>{isInviting ? "Adicionando..." : "Adicionar"}</Text>
      </Pressable>
      <Text style={styles.helperText}>
        A pessoa precisa já ter uma conta FitBlock com este e-mail.
      </Text>
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
  eyebrow: {
    color: colors.textMuted,
    fontFamily: fontFamilies.interface,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.3
  },
  title: {
    color: colors.ink,
    fontFamily: fontFamilies.interface,
    fontSize: typeScale.headingLg,
    fontWeight: "700",
    marginBottom: spacing[4],
    marginTop: spacing[2]
  },
  helperText: { color: colors.textSecondary, fontFamily: fontFamilies.interface, fontSize: 13, marginTop: spacing[2] },
  memberRow: {
    alignItems: "center",
    borderTopColor: colors.hairline,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 56,
    paddingVertical: spacing[2]
  },
  memberCopy: { flex: 1, minWidth: 0 },
  memberEmail: { color: colors.ink, fontFamily: fontFamilies.interface, fontSize: 13, fontWeight: "700" },
  memberRole: { color: colors.textMuted, fontFamily: fontFamilies.interface, fontSize: 11, marginTop: 2 },
  iconAction: { alignItems: "center", borderRadius: radius.pill, height: 40, justifyContent: "center", width: 40 },
  confirmInline: { alignItems: "center", flexDirection: "row", gap: spacing[2] },
  confirmDangerButton: {
    alignItems: "center",
    backgroundColor: colors.danger,
    borderRadius: radius.pill,
    justifyContent: "center",
    minHeight: 36,
    paddingHorizontal: spacing[3]
  },
  confirmDangerText: { color: colors.canvas, fontFamily: fontFamilies.interface, fontSize: 11, fontWeight: "800" },
  ghostButton: {
    alignItems: "center",
    borderColor: colors.hairline,
    borderRadius: radius.pill,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 36,
    paddingHorizontal: spacing[3]
  },
  ghostButtonText: { color: colors.textSecondary, fontFamily: fontFamilies.interface, fontSize: 11, fontWeight: "800" },
  divider: { backgroundColor: colors.hairline, height: 1, marginVertical: spacing[5] },
  inviteLabel: { color: colors.ink, fontFamily: fontFamilies.interface, fontSize: 12, fontWeight: "800" },
  inviteRow: { flexDirection: "row", gap: spacing[3], marginTop: spacing[3] },
  input: {
    backgroundColor: colors.softCloud,
    borderColor: colors.hairline,
    borderRadius: radius.sm,
    borderWidth: 1,
    color: colors.ink,
    fontFamily: fontFamilies.interface,
    fontSize: 14,
    minHeight: 44,
    paddingHorizontal: spacing[3]
  },
  inviteInput: { flex: 2, minWidth: 0 },
  roleChipRow: { flex: 1, flexDirection: "row", gap: spacing[2] },
  roleChip: {
    alignItems: "center",
    borderColor: colors.hairline,
    borderRadius: radius.sm,
    borderWidth: 1,
    flex: 1,
    justifyContent: "center",
    minHeight: 44
  },
  roleChipActive: { backgroundColor: "#F8F6FF", borderColor: colors.fitblockPurple },
  roleChipText: { color: colors.textSecondary, fontFamily: fontFamilies.interface, fontSize: 12, fontWeight: "700" },
  roleChipTextActive: { color: colors.fitblockPurple },
  submitButton: {
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: colors.fitblockPurple,
    borderRadius: radius.pill,
    flexDirection: "row",
    gap: spacing[2],
    justifyContent: "center",
    marginTop: spacing[3],
    minHeight: 44,
    paddingHorizontal: spacing[4]
  },
  submitButtonDisabled: { opacity: 0.45 },
  submitButtonText: { color: colors.canvas, fontFamily: fontFamilies.interface, fontSize: 12, fontWeight: "700" },
  pressed: { opacity: 0.72 }
});
