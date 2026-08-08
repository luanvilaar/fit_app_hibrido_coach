import { Ionicons } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, fontFamilies, radius, spacing, typeScale } from "@fitblock/design-tokens";
import type { SessionTemplateSummary, TrainingGroupRecord } from "@fitblock/backend";
import { ConfirmationModal } from "./confirmation-modal";
import { ApplyModal, type ApplyForm } from "./apply-modal";

type LibraryListProps = {
  templates: SessionTemplateSummary[];
  teams: TrainingGroupRecord[];
  isLoading: boolean;
  editingTemplateId: string | null;
  busyTemplateId: string | null;
  confirmingDeleteId: string | null;
  applyingTemplateId: string | null;
  applyForm: ApplyForm;
  isApplying: boolean;
  onEdit: (templateId: string) => void;
  onDuplicate: (templateId: string) => void;
  onRequestDelete: (templateId: string) => void;
  onConfirmDelete: (templateId: string) => void;
  onDismissDelete: () => void;
  onRequestApply: (templateId: string) => void;
  onDismissApply: () => void;
  onApplyFormChange: (form: ApplyForm) => void;
  onConfirmApply: (templateId: string) => void;
};

const statusLabels: Record<SessionTemplateSummary["status"], string> = {
  draft: "Rascunho",
  published: "Publicado"
};

export function LibraryList({
  templates,
  teams,
  isLoading,
  editingTemplateId,
  busyTemplateId,
  confirmingDeleteId,
  applyingTemplateId,
  applyForm,
  isApplying,
  onEdit,
  onDuplicate,
  onRequestDelete,
  onConfirmDelete,
  onDismissDelete,
  onRequestApply,
  onDismissApply,
  onApplyFormChange,
  onConfirmApply
}: LibraryListProps) {
  const templateBeingApplied = templates.find((t) => t.id === applyingTemplateId);

  return (
    <>
      <View style={styles.card} testID="coach-library-list">
        <Text style={styles.eyebrow}>SUA BIBLIOTECA</Text>
        <Text style={styles.title}>Treinos reutilizáveis</Text>

        {isLoading && <Text style={styles.helperText}>Carregando treinos...</Text>}
        {!isLoading && templates.length === 0 && (
          <Text style={styles.helperText}>Você ainda não salvou nenhum treino na biblioteca.</Text>
        )}

        {templates.map((template) => {
          const isBusy = busyTemplateId === template.id;
          const isEditingThis = editingTemplateId === template.id;

          return (
            <View
              key={template.id}
              style={[styles.templateCard, isEditingThis && styles.templateCardActive]}
              testID={`template-${template.id}`}
            >
              <View style={styles.templateHeader}>
                <View style={styles.templateCopy}>
                  <Text style={styles.templateTitle}>{template.title}</Text>
                  <Text style={styles.templateMeta}>
                    {statusLabels[template.status]} · atualizado em {formatDate(template.updated_at)}
                  </Text>
                </View>
              </View>

              <View style={styles.actionsRow}>
                <TextAction
                  icon="create-outline"
                  label="Editar"
                  testID={`edit-template-${template.id}`}
                  onPress={() => onEdit(template.id)}
                />
                <TextAction
                  icon="copy-outline"
                  label={isBusy ? "Duplicando..." : "Duplicar"}
                  disabled={isBusy}
                  testID={`duplicate-template-${template.id}`}
                  onPress={() => onDuplicate(template.id)}
                />
                <TextAction
                  icon="send-outline"
                  label="Aplicar"
                  testID={`request-apply-template-${template.id}`}
                  onPress={() => onRequestApply(template.id)}
                />
                <TextAction
                  icon="trash-outline"
                  label="Excluir"
                  danger
                  testID={`request-delete-template-${template.id}`}
                  onPress={() => onRequestDelete(template.id)}
                />
              </View>
            </View>
          );
        })}
      </View>

      {confirmingDeleteId && (
        <ConfirmationModal
          title="Excluir treino?"
          message={`Tem certeza que deseja excluir o treino "${templates.find((t) => t.id === confirmingDeleteId)?.title || ""}"? Esta ação não pode ser desfeita.`}
          confirmLabel={busyTemplateId === confirmingDeleteId ? "Excluindo..." : "Sim, excluir"}
          cancelLabel="Manter"
          isDangerous
          isLoading={busyTemplateId === confirmingDeleteId}
          onConfirm={() => onConfirmDelete(confirmingDeleteId)}
          onCancel={onDismissDelete}
        />
      )}

      {templateBeingApplied && (
        <ApplyModal
          templateTitle={templateBeingApplied.title}
          teams={teams}
          form={applyForm}
          isLoading={isApplying}
          onChangeForm={onApplyFormChange}
          onConfirm={() => onConfirmApply(applyingTemplateId!)}
          onDismiss={onDismissApply}
        />
      )}
    </>
  );
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("pt-BR");
}

function TextAction({
  icon,
  label,
  testID,
  onPress,
  danger = false,
  disabled = false
}: {
  icon: ComponentProps<typeof Ionicons>["name"];
  label: string;
  testID: string;
  onPress: () => void;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      testID={testID}
      onPress={onPress}
      style={({ pressed }) => [styles.textAction, disabled && styles.textActionDisabled, pressed && styles.pressed]}
    >
      <Ionicons name={icon} size={16} color={danger ? colors.danger : colors.fitblockPurple} />
      <Text style={[styles.textActionLabel, danger && styles.textActionLabelDanger]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.canvas,
    borderColor: colors.hairline,
    borderRadius: radius.lg,
    borderWidth: 1,
    flex: 1,
    minWidth: 320,
    padding: spacing[5]
  },
  eyebrow: {
    color: colors.textMuted,
    fontFamily: fontFamilies.interface,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.3
  },
  title: {
    color: colors.ink,
    fontFamily: fontFamilies.interface,
    fontSize: typeScale.headingLg,
    fontWeight: "700",
    marginBottom: spacing[3],
    marginTop: spacing[2]
  },
  helperText: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.interface,
    fontSize: 14
  },
  templateCard: {
    borderTopColor: colors.hairline,
    borderTopWidth: 1,
    paddingVertical: spacing[3]
  },
  templateCardActive: {
    backgroundColor: "#FAF8FF"
  },
  templateHeader: {
    flexDirection: "row",
    justifyContent: "space-between"
  },
  templateCopy: {
    flex: 1,
    minWidth: 0
  },
  templateTitle: {
    color: colors.ink,
    fontFamily: fontFamilies.interface,
    fontSize: 15,
    fontWeight: "800"
  },
  templateMeta: {
    color: colors.textMuted,
    fontFamily: fontFamilies.interface,
    fontSize: 12,
    marginTop: 4
  },
  actionsRow: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing[3],
    marginTop: spacing[3]
  },
  textAction: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[2],
    minHeight: 44,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2]
  },
  textActionDisabled: {
    opacity: 0.5
  },
  textActionLabel: {
    color: colors.fitblockPurple,
    fontFamily: fontFamilies.interface,
    fontSize: 13,
    fontWeight: "800"
  },
  textActionLabelDanger: {
    color: colors.danger
  },
  pressed: {
    opacity: 0.72
  }
});
