import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import type {
  CoachStoreProductRecord,
  CreateExerciseRequest,
  ExerciseRecord,
  StoreProgramScheduleDay,
  TrainingGroupRecord
} from "@fitblock/backend";
import { createCoachFlowRepository, createStoreRepository } from "@fitblock/backend";
import { colors, fontFamilies, radius, spacing } from "@fitblock/design-tokens";
import { AthleteShell } from "@/components/athlete-shell";
import { SessionComposer } from "@/components/coach-hibrido/session-composer";
import { useUserRoles } from "@/auth/roles-provider";
import { describeBackendError } from "@/data/backend-error";
import { buildTemplatePayload } from "@/data/coach-hibrido/payload";
import { toTemplateForm } from "@/data/coach-hibrido/session-edit";
import { createInitialSessionForm, type SessionForm } from "@/data/coach-hibrido/session-form";
import { withMovement } from "@/data/coach-hibrido/movement-bank";
import {
  describeProgramDayType,
  programDayTypes,
  type ProgramDayType
} from "@/data/program-builder";
import { getSupabaseConfigurationError, supabase } from "@/lib/supabase";

export default function CoachProductDayBuilderRoute() {
  const router = useRouter();
  const params = useLocalSearchParams<{ productId: string; week: string; day: string }>();
  const productId = params.productId;
  const weekNumber = Number(params.week);
  const dayNumber = Number(params.day);

  const { hasRole } = useUserRoles();
  const isCoach = hasRole("coach");
  const isOwner = hasRole("owner");

  const [product, setProduct] = useState<CoachStoreProductRecord | null>(null);
  const [schedule, setSchedule] = useState<StoreProgramScheduleDay[]>([]);
  const [catalog, setCatalog] = useState<ExerciseRecord[]>([]);
  const [teams, setTeams] = useState<TrainingGroupRecord[]>([]);
  const [dayType, setDayType] = useState<ProgramDayType>("training");
  const [form, setForm] = useState<SessionForm>(() => createInitialSessionForm());
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!supabase || !productId) return;
    setIsLoading(true);
    try {
      const storeRepo = createStoreRepository(supabase);
      const coachRepo = createCoachFlowRepository(supabase);

      const [allProducts, productSchedule, nextCatalog, nextTeams] = await Promise.all([
        storeRepo.listCoachProducts(),
        storeRepo.getCoachProductSchedule(productId),
        coachRepo.listExercises(),
        coachRepo.listCoachTeams()
      ]);

      const foundProduct = allProducts.find((p) => p.id === productId);
      if (!foundProduct) {
        setErrorMessage("Produto não encontrado.");
        setIsLoading(false);
        return;
      }

      setProduct(foundProduct);
      setSchedule(productSchedule);
      setCatalog(nextCatalog);
      setTeams(nextTeams);

      const currentDay = productSchedule.find(
        (d) => d.week_number === weekNumber && d.day_number === dayNumber
      );

      if (currentDay) {
        setDayType(currentDay.day_type);
        if (currentDay.session_template_id) {
          setTemplateId(currentDay.session_template_id);
          const content = await coachRepo.getSessionTemplateContent(currentDay.session_template_id);
          setForm(toTemplateForm(content.title, content.status, content.blocks));
        } else {
          setForm({
            ...createInitialSessionForm(),
            title: `Treino · S${weekNumber} D${dayNumber}`
          });
        }
      } else {
        setForm({
          ...createInitialSessionForm(),
          title: `Treino · S${weekNumber} D${dayNumber}`
        });
      }
    } catch (error: unknown) {
      setErrorMessage(describeBackendError(error));
    } finally {
      setIsLoading(false);
    }
  }, [productId, weekNumber, dayNumber]);

  useEffect(() => {
    if (isCoach || isOwner) void load();
    else setIsLoading(false);
  }, [isCoach, isOwner, load]);

  async function handleCreateMovement(input: CreateExerciseRequest): Promise<ExerciseRecord> {
    if (!supabase) throw new Error(getSupabaseConfigurationError() ?? "Cadastro indisponível.");
    const created = await createCoachFlowRepository(supabase).createExercise(input);
    setCatalog((current) => withMovement(current, created));
    return created;
  }

  async function handleSaveSession() {
    if (!supabase || !product || isSaving) return;
    setIsSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const coachRepo = createCoachFlowRepository(supabase);
      const storeRepo = createStoreRepository(supabase);

      let savedTemplateId = templateId;
      let sessionTitle = form.title.trim() || `Treino · S${weekNumber} D${dayNumber}`;

      if (dayType === "training") {
        const payload = buildTemplatePayload(form, catalog);
        if (templateId) {
          await coachRepo.updateSessionTemplateContent({
            templateId,
            title: payload.title,
            status: payload.status,
            blocks: payload.blocks
          });
        } else {
          const created = await coachRepo.createSessionTemplate(payload);
          savedTemplateId = created.id;
          sessionTitle = created.title;
        }
      } else {
        savedTemplateId = null;
        sessionTitle = describeProgramDayType(dayType);
      }

      // Atualiza o dia no schedule do produto
      const updatedSchedule = schedule.map((d) => {
        if (d.week_number === weekNumber && d.day_number === dayNumber) {
          return {
            ...d,
            day_type: dayType,
            session_template_id: savedTemplateId,
            session_title: dayType === "training" ? sessionTitle : null
          };
        }
        return d;
      });

      await storeRepo.updateTrainingProgram({
        productId: product.id,
        title: product.title,
        slug: product.slug,
        shortDescription: product.short_description,
        description: product.description,
        coverImageUrl: product.cover_image_url,
        priceCents: product.price_cents,
        category: product.category,
        objective: product.objective,
        level: product.level,
        durationWeeks: product.duration_weeks,
        schedule: updatedSchedule
      });

      setSuccessMessage("Sessão salva com sucesso!");
      setTimeout(() => {
        router.back();
      }, 500);
    } catch (error: unknown) {
      setErrorMessage(describeBackendError(error));
      setIsSaving(false);
    }
  }

  if (!isCoach && !isOwner) {
    return (
      <AthleteShell active="coach-produtos">
        <View style={styles.centerContainer}>
          <Text style={styles.errorText}>Acesso restrito para coaches.</Text>
        </View>
      </AthleteShell>
    );
  }

  return (
    <AthleteShell active="coach-produtos">
      <ScrollView contentContainerStyle={styles.container} testID="coach-product-day-screen">
        {/* Header com Navegação de Volta */}
        <View style={styles.navHeader}>
          <Pressable
            accessibilityLabel="Voltar para os produtos"
            accessibilityRole="button"
            onPress={() => router.back()}
            style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
            testID="back-to-products-btn"
          >
            <Ionicons color={colors.textPrimary} name="arrow-back" size={20} />
            <Text style={styles.backButtonText}>Voltar para o Programa</Text>
          </Pressable>

          <View style={styles.headerTitleGroup}>
            <View style={styles.badgeRow}>
              <View style={styles.productBadge}>
                <Text numberOfLines={1} style={styles.productBadgeText}>
                  {product?.title || "Programa"}
                </Text>
              </View>
              <View style={styles.weekDayBadge}>
                <Text style={styles.weekDayBadgeText}>
                  SEMANA {weekNumber} · DIA {dayNumber}
                </Text>
              </View>
            </View>
            <Text style={styles.pageTitle}>Montagem da Sessão</Text>
          </View>
        </View>

        {errorMessage && (
          <View style={styles.messageError}>
            <Ionicons color={colors.error} name="alert-circle" size={18} />
            <Text style={styles.messageErrorText}>{errorMessage}</Text>
          </View>
        )}

        {successMessage && (
          <View style={styles.messageSuccess}>
            <Ionicons color={colors.success} name="checkmark-circle" size={18} />
            <Text style={styles.messageSuccessText}>{successMessage}</Text>
          </View>
        )}

        {isLoading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator color={colors.purple500} size="large" />
            <Text style={styles.loadingText}>Carregando estrutura da sessão…</Text>
          </View>
        ) : (
          <View style={styles.mainContent}>
            {/* Seletor de Tipo de Dia */}
            <View style={styles.typeSelectorCard}>
              <Text style={styles.sectionLabel}>TIPO DESTE DIA</Text>
              <View style={styles.typesRow}>
                {programDayTypes.map((type) => {
                  const isSelected = dayType === type;
                  return (
                    <Pressable
                      key={type}
                      onPress={() => setDayType(type)}
                      style={[styles.typeOption, isSelected && styles.typeOptionSelected]}
                      testID={`day-type-option-${type}`}
                    >
                      <Text style={[styles.typeOptionText, isSelected && styles.typeOptionTextSelected]}>
                        {describeProgramDayType(type)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* Conteúdo da Sessão conforme o tipo */}
            {dayType === "training" ? (
              <View style={styles.composerWrapper}>
                <SessionComposer
                  catalog={catalog}
                  form={form}
                  isDeleting={false}
                  isSaving={isSaving}
                  mode="create"
                  onChange={setForm}
                  onCreateMovement={handleCreateMovement}
                  onSubmit={() => void handleSaveSession()}
                  showSchedule={false}
                  submitLabel={isSaving ? "Salvando treino…" : "Salvar Treino no Programa"}
                  teams={teams}
                />
              </View>
            ) : (
              <View style={styles.nonTrainingCard}>
                <Ionicons
                  color={
                    dayType === "rest"
                      ? colors.info
                      : dayType === "recovery"
                      ? colors.success
                      : dayType === "assessment"
                      ? colors.warning
                      : colors.textSecondary
                  }
                  name={
                    dayType === "rest"
                      ? "bed-outline"
                      : dayType === "recovery"
                      ? "refresh-circle-outline"
                      : dayType === "assessment"
                      ? "speedometer-outline"
                      : "ellipse-outline"
                  }
                  size={42}
                />
                <Text style={styles.nonTrainingTitle}>Dia marcado como {describeProgramDayType(dayType)}</Text>
                <Text style={styles.nonTrainingSubtitle}>
                  Nenhuma prescrição de blocos de treino é necessária para este dia relativo.
                </Text>
                <Pressable
                  disabled={isSaving}
                  onPress={() => void handleSaveSession()}
                  style={({ pressed }) => [
                    styles.primaryButton,
                    isSaving && styles.disabled,
                    pressed && styles.pressed
                  ]}
                >
                  <Text style={styles.primaryButtonText}>
                    {isSaving ? "Salvando…" : "Confirmar Dia no Programa"}
                  </Text>
                </Pressable>
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </AthleteShell>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing[4],
    maxWidth: 1100,
    width: "100%",
    alignSelf: "center",
    gap: spacing[4]
  },
  navHeader: {
    gap: spacing[3],
    paddingBottom: spacing[3],
    borderBottomColor: colors.border,
    borderBottomWidth: 1
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[2],
    alignSelf: "flex-start",
    paddingVertical: spacing[1],
    paddingHorizontal: spacing[2],
    borderRadius: radius.md,
    backgroundColor: colors.surface02
  },
  backButtonText: {
    color: colors.textPrimary,
    fontFamily: fontFamilies.interfaceSemiBold,
    fontSize: 13
  },
  headerTitleGroup: {
    gap: spacing[2]
  },
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[2],
    flexWrap: "wrap"
  },
  productBadge: {
    backgroundColor: colors.surface02,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: spacing[3],
    paddingVertical: 3
  },
  productBadgeText: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.interfaceMedium,
    fontSize: 12
  },
  weekDayBadge: {
    backgroundColor: "rgba(168, 85, 247, 0.2)",
    borderColor: colors.purple500,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: spacing[3],
    paddingVertical: 3
  },
  weekDayBadgeText: {
    color: colors.purple400,
    fontFamily: fontFamilies.interfaceBold,
    fontSize: 11,
    letterSpacing: 0.6
  },
  pageTitle: {
    color: colors.textPrimary,
    fontFamily: fontFamilies.displayBold,
    fontSize: 24
  },
  sectionLabel: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.interfaceBold,
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: "uppercase"
  },
  typeSelectorCard: {
    backgroundColor: colors.surface01,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.xl,
    padding: spacing[4],
    gap: spacing[3]
  },
  typesRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing[2]
  },
  typeOption: {
    backgroundColor: colors.surface02,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[3],
    justifyContent: "center",
    alignItems: "center"
  },
  typeOptionSelected: {
    backgroundColor: colors.purple600,
    borderColor: colors.purple500
  },
  typeOptionText: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.interfaceSemiBold,
    fontSize: 13
  },
  typeOptionTextSelected: {
    color: colors.white
  },
  mainContent: {
    gap: spacing[4]
  },
  composerWrapper: {
    backgroundColor: colors.surface01,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.xl,
    padding: spacing[4]
  },
  nonTrainingCard: {
    backgroundColor: colors.surface01,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.xl,
    padding: spacing[8],
    alignItems: "center",
    justifyContent: "center",
    gap: spacing[3]
  },
  nonTrainingTitle: {
    color: colors.textPrimary,
    fontFamily: fontFamilies.displayBold,
    fontSize: 18,
    textAlign: "center"
  },
  nonTrainingSubtitle: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.interface,
    fontSize: 13,
    textAlign: "center",
    maxWidth: 420
  },
  primaryButton: {
    backgroundColor: colors.purple600,
    borderRadius: radius.md,
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[5],
    marginTop: spacing[2]
  },
  primaryButtonText: {
    color: colors.white,
    fontFamily: fontFamilies.interfaceBold,
    fontSize: 14
  },
  centerContainer: {
    padding: spacing[8],
    alignItems: "center",
    justifyContent: "center",
    gap: spacing[3]
  },
  loadingText: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.interface,
    fontSize: 13
  },
  errorText: {
    color: colors.error,
    fontFamily: fontFamilies.interfaceBold,
    fontSize: 14
  },
  messageError: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[2],
    backgroundColor: "rgba(248, 113, 113, 0.15)",
    borderColor: colors.error,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing[3]
  },
  messageErrorText: {
    color: colors.error,
    fontFamily: fontFamilies.interfaceMedium,
    fontSize: 13,
    flex: 1
  },
  messageSuccess: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[2],
    backgroundColor: "rgba(52, 211, 153, 0.15)",
    borderColor: colors.success,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing[3]
  },
  messageSuccessText: {
    color: colors.success,
    fontFamily: fontFamilies.interfaceMedium,
    fontSize: 13,
    flex: 1
  },
  pressed: {
    opacity: 0.75
  },
  disabled: {
    opacity: 0.5
  }
});
