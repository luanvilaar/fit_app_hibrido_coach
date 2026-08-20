import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions
} from "react-native";
import type {
  CoachStoreProductRecord,
  CreateExerciseRequest,
  ExerciseRecord,
  SessionTemplateSummary,
  StoreProductCategory,
  StoreProductLevel,
  StoreProgramScheduleDay,
  TrainingGroupRecord
} from "@fitblock/backend";
import { createCoachFlowRepository, createStoreRepository } from "@fitblock/backend";
import { colors, fontFamilies, radius, spacing, type ThemeColors } from "@fitblock/design-tokens";
import { useUserRoles } from "@/auth/roles-provider";
import { describeBackendError } from "@/data/backend-error";
import { MoneyParseError, formatAmountInput, parseBRL } from "@/data/finance/money";
import {
  describeProductCategory,
  describeProductLevel,
  describeProductStatus,
  slugifyStoreTitle
} from "@/data/store";
import {
  createProgramSchedule,
  validateProgramSchedule
} from "@/data/program-builder";
import { getSupabaseConfigurationError, supabase } from "@/lib/supabase";
import { buildTemplatePayload } from "@/data/coach-hibrido/payload";
import { withMovement } from "@/data/coach-hibrido/movement-bank";
import { createInitialSessionForm, type SessionForm } from "@/data/coach-hibrido/session-form";
import { SessionComposer } from "@/components/coach-hibrido/session-composer";
import { ProgramWeekGrid } from "@/components/coach/program-week-grid";
import { AnimatedTabBar, TabTransitionPanel } from "@/components/ui/tab-transition";
import { useAppTheme } from "@/theme/theme-provider";

export type ProgramBuilderForm = {
  title: string;
  slug: string;
  shortDescription: string;
  description: string;
  coverImageUrl: string;
  price: string;
  category: StoreProductCategory;
  objective: string;
  level: StoreProductLevel;
  durationWeeks: string;
  schedule: StoreProgramScheduleDay[];
};

const categories: StoreProductCategory[] = [
  "strength",
  "hybrid",
  "running",
  "gymnastics",
  "weightlifting",
  "conditioning",
  "other"
];

const levels: StoreProductLevel[] = ["beginner", "intermediate", "advanced", "all"];

const initialForm: ProgramBuilderForm = {
  title: "",
  slug: "",
  shortDescription: "",
  description: "",
  coverImageUrl: "",
  price: "",
  category: "strength",
  objective: "",
  level: "all",
  durationWeeks: "4",
  schedule: []
};

type ProgramBuilderScreenProps = {
  guidedWorkspace?: boolean;
  productId?: string | null;
};

type BuilderStage = "identity" | "audience" | "plan";

const builderStages: Array<{ id: BuilderStage; label: string }> = [
  { id: "identity", label: "Base" },
  { id: "audience", label: "Público" },
  { id: "plan", label: "Plano" }
];

function createStageTabStyles(themeColors: ThemeColors) {
  return StyleSheet.create({
    active: { backgroundColor: themeColors.surface04 },
    index: { color: themeColors.textMutedAccessible, fontFamily: fontFamilies.interfaceBold, fontSize: 12 },
    navigation: {
      alignSelf: "flex-start",
      borderColor: themeColors.border,
      borderRadius: radius.lg,
      borderWidth: 1,
      flexDirection: "row",
      overflow: "hidden"
    },
    tab: {
      alignItems: "center",
      flexDirection: "row",
      gap: spacing[2],
      justifyContent: "center",
      minHeight: 48,
      minWidth: 104,
      paddingHorizontal: spacing[3]
    },
    text: { color: themeColors.textSecondary, fontFamily: fontFamilies.interfaceSemiBold, fontSize: 13 },
    textActive: { color: themeColors.textPrimary }
  });
}

export function ProgramBuilderScreen({ guidedWorkspace = false, productId }: ProgramBuilderScreenProps) {
  const router = useRouter();
  const { colors: themeColors } = useAppTheme();
  const stageTabStyles = useMemo(() => createStageTabStyles(themeColors), [themeColors]);
  const { width } = useWindowDimensions();
  const { hasRole } = useUserRoles();
  const isNarrow = width < 980;
  const isCoach = hasRole("coach");
  const isOwner = hasRole("owner");

  const [product, setProduct] = useState<CoachStoreProductRecord | null>(null);
  const [templates, setTemplates] = useState<SessionTemplateSummary[]>([]);
  const [catalog, setCatalog] = useState<ExerciseRecord[]>([]);
  const [teams, setTeams] = useState<TrainingGroupRecord[]>([]);
  const [form, setForm] = useState<ProgramBuilderForm>(() => ({
    ...initialForm,
    schedule: createProgramSchedule(4)
  }));
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [activeStage, setActiveStage] = useState<BuilderStage>("identity");

  // Modal / Composer de Dia
  const [composerDayIndex, setComposerDayIndex] = useState<number | null>(null);
  const [composerForm, setComposerForm] = useState<SessionForm>(() => createInitialSessionForm());
  const [isCreatingTemplate, setIsCreatingTemplate] = useState(false);

  const loadData = useCallback(async () => {
    if (!supabase) {
      setErrorMessage(getSupabaseConfigurationError() ?? "Supabase indisponível.");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    try {
      const storeRepo = createStoreRepository(supabase);
      const coachRepo = createCoachFlowRepository(supabase);

      const [allProducts, nextTemplates, nextTeams, nextCatalog] = await Promise.all([
        storeRepo.listCoachProducts(),
        coachRepo.listSessionTemplates(),
        coachRepo.listCoachTeams(),
        coachRepo.listExercises()
      ]);

      setTemplates(nextTemplates);
      setTeams(nextTeams);
      setCatalog(nextCatalog);

      if (productId) {
        const found = allProducts.find((p) => p.id === productId);
        if (!found) {
          setErrorMessage("Produto não encontrado.");
          setIsLoading(false);
          return;
        }

        const schedule = await storeRepo.getCoachProductSchedule(productId);
        setProduct(found);
        setForm({
          title: found.title,
          slug: found.slug,
          shortDescription: found.short_description,
          description: found.description,
          coverImageUrl: found.cover_image_url ?? "",
          price: formatAmountInput(found.price_cents),
          category: found.category,
          objective: found.objective,
          level: found.level,
          durationWeeks: String(found.duration_weeks),
          schedule: createProgramSchedule(found.duration_weeks, schedule)
        });
      } else {
        // Novo produto
        setForm((curr) => ({
          ...curr,
          schedule: createProgramSchedule(Number(curr.durationWeeks) || 4)
        }));
      }
    } catch (error: unknown) {
      setErrorMessage(describeBackendError(error));
    } finally {
      setIsLoading(false);
    }
  }, [productId]);

  useEffect(() => {
    if (isCoach || isOwner) void loadData();
    else setIsLoading(false);
  }, [isCoach, isOwner, loadData]);

  function updateForm<K extends keyof ProgramBuilderForm>(key: K, value: ProgramBuilderForm[K]) {
    setForm((current) => ({
      ...current,
      [key]: value
    }));
  }

  function handleTitleChange(value: string) {
    setForm((current) => ({
      ...current,
      title: value,
      slug: slugifyStoreTitle(value)
    }));
  }

  function handleDurationChange(value: string) {
    const cleaned = value.replace(/[^0-9]/g, "");
    const durationWeeks = Number(cleaned);
    setForm((current) => ({
      ...current,
      durationWeeks: cleaned,
      schedule:
        Number.isInteger(durationWeeks) && durationWeeks > 0
          ? createProgramSchedule(
              durationWeeks,
              current.schedule,
              templates.find((t) => t.status === "published")?.id ?? null
            )
          : []
    }));
  }

  async function handleSave(submitAfter = false) {
    if (!supabase || isSaving) return;
    setErrorMessage(null);
    setSuccessMessage(null);

    let priceCents: number;
    try {
      priceCents = parseBRL(form.price);
    } catch (error: unknown) {
      setErrorMessage(error instanceof MoneyParseError ? error.message : "Informe um preço válido.");
      return;
    }

    const durationWeeks = Number(form.durationWeeks);
    const scheduleError = validateProgramSchedule(form.schedule, durationWeeks);
    if (!form.title.trim() || form.shortDescription.trim().length < 8 || form.objective.trim().length < 2 || scheduleError) {
      setErrorMessage(scheduleError ?? "Preencha título, resumo, objetivo, preço e a estrutura de dias.");
      return;
    }
    if (!Number.isInteger(durationWeeks) || durationWeeks < 1) {
      setErrorMessage("A duração precisa ser um número inteiro de semanas.");
      return;
    }

    setIsSaving(true);
    try {
      const storeRepo = createStoreRepository(supabase);
      const payload = {
        title: form.title.trim(),
        slug: form.slug || slugifyStoreTitle(form.title),
        shortDescription: form.shortDescription.trim(),
        description: form.description.trim(),
        coverImageUrl: form.coverImageUrl.trim() || null,
        priceCents,
        category: form.category,
        objective: form.objective.trim(),
        level: form.level,
        durationWeeks,
        schedule: form.schedule
      };

      let savedId = productId;
      if (productId) {
        await storeRepo.updateTrainingProgram({ ...payload, productId });
        setSuccessMessage("Programa atualizado com sucesso!");
      } else {
        const created = await storeRepo.createTrainingProgram(payload);
        savedId = created.id;
        setSuccessMessage("Programa criado como rascunho com sucesso!");
      }

      if (submitAfter && savedId) {
        setIsSubmitting(true);
        await storeRepo.submitProductReview(savedId);
        setSuccessMessage("Programa salvo e enviado para análise!");
      }

      await loadData();
      if (!productId && savedId) {
        router.replace(`/app/coach/produtos/${savedId}`);
      }
    } catch (error: unknown) {
      setErrorMessage(describeBackendError(error));
    } finally {
      setIsSaving(false);
      setIsSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!supabase || !productId || isDeleting) return;
    setIsDeleting(true);
    setErrorMessage(null);
    try {
      await createStoreRepository(supabase).deleteProduct(productId);
      router.replace("/app/coach/produtos");
    } catch (error: unknown) {
      setErrorMessage(describeBackendError(error));
      setIsDeleting(false);
      setConfirmingDelete(false);
    }
  }

  function handleOpenDayComposer(dayIndex: number, weekNumber: number, dayNumber: number) {
    if (productId) {
      // Navega para a tela dedicada de montagem daquele dia específico
      router.push(`/app/coach/produtos/${productId}/semana/${weekNumber}/dia/${dayNumber}`);
    } else {
      // Para rascunho não persistido, abre o composer inline/modal
      const targetDay = form.schedule[dayIndex];
      setComposerForm({
        ...createInitialSessionForm(),
        title: targetDay?.session_title || `Treino · S${weekNumber} D${dayNumber}`
      });
      setComposerDayIndex(dayIndex);
    }
  }

  async function handleSaveComposerDay() {
    if (!supabase || composerDayIndex === null || isCreatingTemplate) return;
    setIsCreatingTemplate(true);
    setErrorMessage(null);
    try {
      const coachRepo = createCoachFlowRepository(supabase);
      const created = await coachRepo.createSessionTemplate(buildTemplatePayload(composerForm, catalog));
      const nextTemplates = await coachRepo.listSessionTemplates();
      setTemplates(nextTemplates);
      setForm((curr) => ({
        ...curr,
        schedule: curr.schedule.map((day, idx) =>
          idx === composerDayIndex
            ? { ...day, day_type: "training", session_template_id: created.id, session_title: created.title }
            : day
        )
      }));
      setComposerDayIndex(null);
      setSuccessMessage("Treino montado e vinculado ao dia!");
    } catch (error: unknown) {
      setErrorMessage(describeBackendError(error));
    } finally {
      setIsCreatingTemplate(false);
    }
  }

  async function handleCreateMovement(input: CreateExerciseRequest): Promise<ExerciseRecord> {
    if (!supabase) throw new Error(getSupabaseConfigurationError() ?? "Cadastro indisponível.");
    const created = await createCoachFlowRepository(supabase).createExercise(input);
    setCatalog((current) => withMovement(current, created));
    return created;
  }

  if (!isCoach && !isOwner) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>Acesso restrito para coaches.</Text>
      </View>
    );
  }

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator color={colors.purple500} size="large" />
        <Text style={styles.loadingText}>Carregando programa de treino…</Text>
      </View>
    );
  }

  const isDraft = product?.status === "draft" || !productId;
  const isPublished = product?.status === "published";
  const isGuidedWorkspace = guidedWorkspace && !productId;

  const configuredTrainingDays = form.schedule.filter((day) => day.day_type === "training").length;

  return (
    <KeyboardAvoidingView
      behavior={Platform.select({ ios: "padding", android: "height", default: undefined })}
      style={styles.page}
      testID="program-builder-screen"
    >
      <View style={styles.scrollContent}>
      <View style={isGuidedWorkspace ? styles.commandBar : styles.topBar}>
        <View style={styles.topBarLeft}>
          <Pressable
            accessibilityLabel="Voltar para Meus Produtos"
            accessibilityRole="button"
            onPress={() => router.push("/app/coach/produtos")}
            style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}
            testID="program-builder-back-btn"
          >
            <Ionicons color={colors.textPrimary} name="arrow-back" size={18} />
            <Text style={styles.backBtnText}>Meus Produtos</Text>
          </Pressable>

          {!isGuidedWorkspace && (
            <View style={styles.titleBadgeGroup}>
              <Text style={[styles.screenHeading, styles.editScreenHeading]}>
                {productId ? form.title || "Editar Programa" : "Novo Programa de Treino"}
              </Text>
              {product && (
              <View
                style={[
                  styles.statusBadge,
                  isPublished ? styles.statusBadgePublished : styles.statusBadgeDraft
                ]}
              >
                <Text
                  style={[
                    styles.statusBadgeText,
                    isPublished ? styles.statusBadgeTextPublished : styles.statusBadgeTextDraft
                  ]}
                >
                  {describeProductStatus(product.status)}
                </Text>
              </View>
              )}
            </View>
          )}
        </View>

        <View style={styles.topBarActions}>
          {productId && (
            <Pressable
              accessibilityLabel="Excluir programa"
              accessibilityRole="button"
              accessibilityState={{ disabled: isSaving || isDeleting }}
              disabled={isSaving || isDeleting}
              onPress={() => setConfirmingDelete(true)}
              style={({ pressed }) => [styles.deleteBtn, pressed && styles.pressed]}
              testID="program-builder-delete-btn"
            >
              <Ionicons color={colors.error} name="trash-outline" size={16} />
              <Text style={styles.deleteBtnText}>Excluir</Text>
            </Pressable>
          )}

          <Pressable
            accessibilityLabel={productId ? "Salvar alterações do programa" : "Salvar programa como rascunho"}
            accessibilityRole="button"
            accessibilityState={{ disabled: isSaving || isSubmitting }}
            disabled={isSaving || isSubmitting}
            onPress={() => void handleSave(false)}
            style={({ pressed }) => [styles.saveBtn, pressed && styles.pressed]}
            testID="program-builder-save-btn"
          >
            {isSaving && !isSubmitting ? (
              <ActivityIndicator color={colors.white} size="small" />
            ) : (
              <Ionicons color={colors.white} name="save-outline" size={16} />
            )}
            <Text style={styles.saveBtnText}>
              {isSaving && !isSubmitting ? "Salvando…" : productId ? "Salvar Alterações" : "Salvar Rascunho"}
            </Text>
          </Pressable>

          {!isGuidedWorkspace && isDraft && (
            <Pressable
              accessibilityLabel="Enviar programa para análise"
              accessibilityRole="button"
              accessibilityState={{ disabled: isSaving || isSubmitting }}
              disabled={isSaving || isSubmitting}
              onPress={() => void handleSave(true)}
              style={({ pressed }) => [styles.submitBtn, pressed && styles.pressed]}
              testID="program-builder-submit-btn"
            >
              {isSubmitting ? (
                <ActivityIndicator color={colors.purple400} size="small" />
              ) : (
                <Ionicons color={colors.purple400} name="paper-plane-outline" size={16} />
              )}
              <Text style={styles.submitBtnText}>{isSubmitting ? "Enviando…" : "Enviar para Análise"}</Text>
            </Pressable>
          )}

        </View>
      </View>

      {isGuidedWorkspace && <View style={[styles.intro, isNarrow && styles.introNarrow]}>
        <View style={styles.introCopy}>
          <Text style={styles.screenHeading}>
            {productId ? (form.title || "Editar programa") : "Crie um programa que dá direção."}
          </Text>
          <Text style={styles.introDescription}>
            Primeiro defina a proposta. Depois organize cada semana para que o atleta saiba exatamente o próximo passo.
          </Text>
        </View>
        <View style={styles.planSignal} accessibilityLabel={`${form.durationWeeks || 0} semanas e ${configuredTrainingDays} treinos configurados`}>
          <Text style={styles.planSignalValue}>{form.durationWeeks || "—"}</Text>
          <Text style={styles.planSignalLabel}>semanas</Text>
          <View style={styles.planSignalDivider} />
          <Text style={styles.planSignalDetail}>{configuredTrainingDays} treinos montados</Text>
        </View>
      </View>}

      {/* Confirmação de Exclusão */}
      {confirmingDelete && (
        <View accessibilityRole="alert" style={styles.confirmBanner} testID="program-builder-confirm-delete">
          <View style={styles.confirmTextGroup}>
            <Text style={styles.confirmTitle}>Excluir permanentemente este programa?</Text>
            <Text style={styles.confirmDesc}>
              O programa sairá do seu catálogo e da Loja. Esta ação não pode ser desfeita.
            </Text>
          </View>
          <View style={styles.confirmActions}>
            <Pressable
              accessibilityLabel="Confirmar exclusão do programa"
              accessibilityRole="button"
              accessibilityState={{ disabled: isDeleting }}
              disabled={isDeleting}
              onPress={() => void handleDelete()}
              style={[styles.confirmDeleteBtn, isDeleting && styles.disabled]}
            >
              <Text style={styles.confirmDeleteText}>{isDeleting ? "Excluindo…" : "Sim, Excluir"}</Text>
            </Pressable>
            <Pressable
              accessibilityLabel="Cancelar exclusão do programa"
              accessibilityRole="button"
              accessibilityState={{ disabled: isDeleting }}
              disabled={isDeleting}
              onPress={() => setConfirmingDelete(false)}
              style={styles.confirmCancelBtn}
            >
              <Text style={styles.confirmCancelText}>Cancelar</Text>
            </Pressable>
          </View>
        </View>
      )}

      {errorMessage && (
        <View accessibilityRole="alert" style={styles.alertError}>
          <Ionicons color={colors.error} name="alert-circle" size={18} />
          <Text style={styles.alertErrorText}>{errorMessage}</Text>
        </View>
      )}

      {successMessage && (
        <View accessibilityRole="alert" style={styles.alertSuccess}>
          <Ionicons color={colors.success} name="checkmark-circle" size={18} />
          <Text style={styles.alertSuccessText}>{successMessage}</Text>
        </View>
      )}

      {isGuidedWorkspace && (
        <AnimatedTabBar
          activeTabStyle={stageTabStyles.active}
          containerStyle={stageTabStyles.navigation}
          label="Etapas de criação do programa"
          onChange={setActiveStage}
          options={builderStages.map((stage, index) => ({
            ...stage,
            accessibilityLabel: `Etapa ${index + 1}: ${stage.label}`,
            value: stage.id
          }))}
          renderTabContent={(stage, active, index) => (
            <>
              <Text style={[stageTabStyles.index, active && stageTabStyles.textActive]}>{index + 1}</Text>
              <Text style={[stageTabStyles.text, active && stageTabStyles.textActive]}>{stage.label}</Text>
            </>
          )}
          tabStyle={stageTabStyles.tab}
          testID="program-builder-stages"
          value={activeStage}
        />
      )}

      {/* Modal / Composer de Montagem de Dia (caso rascunho novo) */}
      {composerDayIndex !== null && (
        <View style={styles.composerCard} testID="program-session-composer">
          <View style={styles.composerCardHeader}>
            <View>
              <Text style={styles.composerCardTitle}>
                Monte o treino do Dia {form.schedule[composerDayIndex]?.day_number} (Semana {form.schedule[composerDayIndex]?.week_number})
              </Text>
              <Text style={styles.composerCardSub}>
                Este treino será salvo na sua biblioteca de sessões e vinculado a este dia no programa.
              </Text>
            </View>
            <Pressable
              accessibilityLabel="Fechar montagem de treino"
              accessibilityRole="button"
              onPress={() => setComposerDayIndex(null)}
              style={({ pressed }) => [styles.closeBtn, pressed && styles.pressed]}
            >
              <Ionicons color={colors.textSecondary} name="close" size={20} />
            </Pressable>
          </View>
          <SessionComposer
            catalog={catalog}
            form={composerForm}
            isDeleting={false}
            isSaving={isCreatingTemplate}
            mode="create"
            onChange={setComposerForm}
            onCreateMovement={handleCreateMovement}
            onSubmit={() => void handleSaveComposerDay()}
            showSchedule={false}
            submitLabel="Salvar treino no programa"
            teams={teams}
          />
        </View>
      )}

      <View style={isGuidedWorkspace ? [styles.workspace, isNarrow && styles.workspaceNarrow] : undefined}>
      <TabTransitionPanel
        activeKey={activeStage}
        enabled={isGuidedWorkspace}
        order={builderStages.map((stage) => stage.id)}
        testID="program-builder-stage-panel"
      >
      {(!isGuidedWorkspace || activeStage !== "plan") && (
      <View style={styles.sectionCard} testID="coach-product-editor">
        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionTitle}>{!isGuidedWorkspace ? "INFORMAÇÕES DO PROGRAMA" : activeStage === "identity" ? "Dê forma ao produto" : "Defina para quem é"}</Text>
            <Text style={styles.sectionSubtitle}>
              {!isGuidedWorkspace ? "Defina os parâmetros do produto, proposta de valor e duração do ciclo." : activeStage === "identity" ? "O essencial para identificar, vender e retomar o rascunho." : "O contexto que torna cada semana coerente com o objetivo."}
            </Text>
          </View>
        </View>

        <View style={[styles.formGrid, isNarrow && styles.formGridNarrow]}>
          <View style={styles.formCol}>
            {(!isGuidedWorkspace || activeStage === "identity") && <>
            <Field label="Título do Programa">
              <TextInput
                accessibilityLabel="Título do produto"
                onChangeText={handleTitleChange}
                placeholder="Ex.: Base de Força & Hipertrofia"
                placeholderTextColor={colors.textSecondary}
                style={styles.input}
                value={form.title}
              />
            </Field>

            <Field label={`Slug · ${form.slug || "gerado automaticamente"}`}>
              <TextInput
                accessibilityLabel="Slug gerado para o produto"
                editable={false}
                style={[styles.input, styles.inputDisabled]}
                value={form.slug}
              />
            </Field>

            <View style={styles.fieldRow}>
              <View style={styles.fieldRowItem}>
                <Field label="Preço (R$)">
                  <TextInput
                    accessibilityLabel="Preço do produto"
                    keyboardType="decimal-pad"
                    onChangeText={(v) => updateForm("price", v)}
                    placeholder="299,00"
                    placeholderTextColor={colors.textSecondary}
                    style={styles.input}
                    value={form.price}
                  />
                </Field>
              </View>
              <View style={styles.fieldRowItem}>
                <Field label="Duração em Semanas">
                  <TextInput
                    accessibilityLabel="Duração em semanas"
                    keyboardType="number-pad"
                    onChangeText={handleDurationChange}
                    placeholder="4"
                    placeholderTextColor={colors.textSecondary}
                    style={styles.input}
                    value={form.durationWeeks}
                  />
                </Field>
              </View>
            </View>
            </>}

            {(!isGuidedWorkspace || activeStage === "audience") && <>
            <Field label="Objetivo Principal">
              <TextInput
                accessibilityLabel="Objetivo do programa"
                onChangeText={(v) => updateForm("objective", v)}
                placeholder="Ex.: Desenvolver força máxima e consistência motora"
                placeholderTextColor={colors.textSecondary}
                style={styles.input}
                value={form.objective}
              />
            </Field>
            <Field label="Descrição Completa & Metodologia">
              <TextInput
                accessibilityLabel="Descrição completa do produto"
                multiline
                onChangeText={(v) => updateForm("description", v)}
                placeholder="Explique como o programa progride, frequência e requisitos..."
                placeholderTextColor={colors.textSecondary}
                style={[styles.input, styles.textArea]}
                value={form.description}
              />
            </Field>
            </>}
          </View>

          <View style={styles.formCol}>
            {(!isGuidedWorkspace || activeStage === "identity") && <>
            <Field label="Resumo Curto (para a vitrine)">
              <TextInput
                accessibilityLabel="Resumo curto do produto"
                maxLength={180}
                multiline
                onChangeText={(v) => updateForm("shortDescription", v)}
                placeholder="Uma frase marcante destacando a proposta para os atletas"
                placeholderTextColor={colors.textSecondary}
                style={[styles.input, styles.textAreaSmall]}
                value={form.shortDescription}
              />
            </Field>
            <Field label="URL da Imagem de Capa (opcional)">
              <TextInput
                accessibilityLabel="URL da imagem de capa"
                autoCapitalize="none"
                autoCorrect={false}
                onChangeText={(v) => updateForm("coverImageUrl", v)}
                placeholder="https://images.unsplash.com/..."
                placeholderTextColor={colors.textSecondary}
                style={styles.input}
                value={form.coverImageUrl}
              />
            </Field>
            </>}
            {(!isGuidedWorkspace || activeStage === "audience") && <View style={styles.chipsSection}>
              <OptionSelector
                getLabel={describeProductCategory}
                label="Categoria"
                onChange={(v) => updateForm("category", v)}
                options={categories}
                selected={form.category}
              />
              <OptionSelector
                getLabel={describeProductLevel}
                label="Nível recomendado"
                onChange={(v) => updateForm("level", v)}
                options={levels}
                selected={form.level}
              />
            </View>}
          </View>
        </View>
        {isGuidedWorkspace && <Pressable
          accessibilityRole="button"
          accessibilityLabel={activeStage === "identity" ? "Avançar para o público" : "Avançar para o plano"}
          onPress={() => setActiveStage(activeStage === "identity" ? "audience" : "plan")}
          style={styles.stageAdvance}
        >
          <Text style={styles.stageAdvanceText}>{activeStage === "identity" ? "Continuar para público" : "Continuar para o plano"}</Text>
          <Ionicons color={colors.white} name="arrow-forward" size={18} />
        </Pressable>}
      </View>
      )}

      {(!isGuidedWorkspace || activeStage === "plan") && <View style={styles.calendarSection}>
        {isGuidedWorkspace && <View style={styles.calendarLead}>
          <Text style={styles.sectionTitle}>Estruture a jornada</Text>
          <Text style={styles.sectionSubtitle}>Cada célula é um dia do programa. Monte o treino ou defina a recuperação.</Text>
        </View>}
        <ProgramWeekGrid
          days={form.schedule}
          mobilePresentation={isGuidedWorkspace ? "weekly-planner" : "grid"}
          onChange={(schedule) => updateForm("schedule", schedule)}
          onOpenDayComposer={handleOpenDayComposer}
          templates={templates.filter((t) => t.status === "published")}
        />
        {isGuidedWorkspace && isDraft && <Pressable
          accessibilityRole="button"
          accessibilityLabel="Salvar e enviar programa para análise"
          disabled={isSaving || isSubmitting}
          onPress={() => void handleSave(true)}
          style={({ pressed }) => [styles.submitBtn, pressed && styles.pressed, (isSaving || isSubmitting) && styles.disabled]}
          testID="program-builder-submit-btn"
        >
          {isSubmitting ? <ActivityIndicator color={colors.purple400} size="small" /> : <Ionicons color={colors.purple400} name="paper-plane-outline" size={18} />}
          <Text style={styles.submitBtnText}>{isSubmitting ? "Enviando…" : "Salvar e enviar para análise"}</Text>
        </Pressable>}
      </View>
      }
      </TabTransitionPanel>
      </View>
      </View>
    </KeyboardAvoidingView>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.fieldWrapper}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

function OptionSelector<T extends string>({
  label,
  options,
  selected,
  getLabel,
  onChange
}: {
  label: string;
  options: T[];
  selected: T;
  getLabel: (opt: T) => string;
  onChange: (opt: T) => void;
}) {
  return (
    <View style={styles.optionBlock}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View accessibilityRole="radiogroup" style={styles.chipsRow}>
        {options.map((option) => {
          const isSelected = selected === option;
          return (
            <Pressable
              key={option}
              accessibilityLabel={`${label}: ${getLabel(option)}`}
              accessibilityRole="radio"
              accessibilityState={{ selected: isSelected }}
              onPress={() => onChange(option)}
              style={[styles.chip, isSelected && styles.chipActive]}
            >
              <Text style={[styles.chipText, isSelected && styles.chipTextActive]}>
                {getLabel(option)}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: colors.bg
  },
  scrollContent: {
    padding: spacing[7],
    gap: spacing[7],
    maxWidth: 1320,
    width: "100%",
    alignSelf: "center"
  },
  centerContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing[8],
    gap: spacing[3]
  },
  loadingText: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.interface,
    fontSize: 14
  },
  errorText: {
    color: colors.error,
    fontFamily: fontFamilies.interfaceMedium,
    fontSize: 14
  },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: spacing[4],
    backgroundColor: colors.surface01,
    borderColor: colors.borderPurple,
    borderWidth: 1,
    borderRadius: radius.xl,
    padding: spacing[4]
  },
  commandBar: {
    alignItems: "center",
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing[4],
    justifyContent: "space-between",
    paddingBottom: spacing[4]
  },
  intro: {
    alignItems: "flex-end",
    flexDirection: "row",
    gap: spacing[7],
    justifyContent: "space-between"
  },
  introNarrow: {
    alignItems: "flex-start",
    flexDirection: "column"
  },
  introCopy: { flex: 1, maxWidth: 680 },
  introDescription: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.interface,
    fontSize: 17,
    lineHeight: 26,
    marginTop: spacing[3]
  },
  planSignal: {
    alignItems: "flex-start",
    borderColor: colors.borderPurple,
    borderRadius: radius.lg,
    borderWidth: 1,
    minWidth: 190,
    padding: spacing[4]
  },
  planSignalValue: { color: colors.textPrimary, fontFamily: fontFamilies.display, fontSize: 42, lineHeight: 40 },
  planSignalLabel: { color: colors.textSecondary, fontFamily: fontFamilies.interfaceSemiBold, fontSize: 12 },
  planSignalDivider: { backgroundColor: colors.border, height: 1, marginVertical: spacing[3], width: "100%" },
  planSignalDetail: { color: colors.purple400, fontFamily: fontFamilies.interfaceBold, fontSize: 12 },
  stageNav: {
    alignSelf: "flex-start",
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    flexDirection: "row",
    overflow: "hidden"
  },
  stageTab: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[2],
    justifyContent: "center",
    minHeight: 48,
    minWidth: 104,
    paddingHorizontal: spacing[3]
  },
  stageTabActive: { backgroundColor: colors.surface04 },
  stageTabIndex: { color: colors.textMutedAccessible, fontFamily: fontFamilies.interfaceBold, fontSize: 12 },
  stageTabText: { color: colors.textSecondary, fontFamily: fontFamilies.interfaceSemiBold, fontSize: 13 },
  stageTabTextActive: { color: colors.textPrimary },
  workspace: { gap: spacing[6] },
  workspaceNarrow: { gap: spacing[5] },
  topBarLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[4],
    flexWrap: "wrap"
  },
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[1],
    minHeight: 44,
    paddingHorizontal: spacing[3],
    borderRadius: radius.md,
    backgroundColor: colors.surface02
  },
  backBtnText: {
    color: colors.textPrimary,
    fontFamily: fontFamilies.interfaceMedium,
    fontSize: 13
  },
  titleBadgeGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[2]
  },
  screenHeading: {
    color: colors.textPrimary,
    fontFamily: fontFamilies.display,
    fontSize: 44,
    lineHeight: 44,
    letterSpacing: -0.4
  },
  editScreenHeading: {
    fontFamily: fontFamilies.interfaceBold,
    fontSize: 20,
    letterSpacing: 0,
    lineHeight: 24
  },
  statusBadge: {
    paddingHorizontal: spacing[2],
    paddingVertical: 2,
    borderRadius: radius.pill
  },
  statusBadgeDraft: {
    backgroundColor: "rgba(168, 85, 247, 0.15)"
  },
  statusBadgePublished: {
    backgroundColor: "rgba(52, 211, 153, 0.15)"
  },
  statusBadgeText: {
    fontFamily: fontFamilies.interfaceSemiBold,
    fontSize: 11
  },
  statusBadgeTextDraft: {
    color: colors.purple400
  },
  statusBadgeTextPublished: {
    color: colors.success
  },
  topBarActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[3]
  },
  saveBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[2],
    backgroundColor: colors.purple600,
    minHeight: 44,
    paddingHorizontal: spacing[4],
    borderRadius: radius.md
  },
  saveBtnText: {
    color: colors.white,
    fontFamily: fontFamilies.interfaceSemiBold,
    fontSize: 13
  },
  submitBtn: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[2],
    backgroundColor: "rgba(168, 85, 247, 0.15)",
    borderColor: colors.purple600,
    borderWidth: 1,
    minHeight: 48,
    paddingHorizontal: spacing[4],
    borderRadius: radius.md
  },
  submitBtnText: {
    color: colors.purple400,
    fontFamily: fontFamilies.interfaceSemiBold,
    fontSize: 13
  },
  deleteBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[1],
    minHeight: 44,
    paddingHorizontal: spacing[3],
    borderRadius: radius.md,
    backgroundColor: "rgba(239, 68, 68, 0.1)"
  },
  deleteBtnText: {
    color: colors.error,
    fontFamily: fontFamilies.interfaceMedium,
    fontSize: 13
  },
  confirmBanner: {
    backgroundColor: "rgba(239, 68, 68, 0.08)",
    borderColor: colors.error,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing[4],
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: spacing[3]
  },
  confirmTextGroup: {
    gap: 2
  },
  confirmTitle: {
    color: colors.error,
    fontFamily: fontFamilies.interfaceBold,
    fontSize: 14
  },
  confirmDesc: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.interface,
    fontSize: 12
  },
  confirmActions: {
    flexDirection: "row",
    gap: spacing[2]
  },
  confirmDeleteBtn: {
    backgroundColor: colors.error,
    minHeight: 44,
    justifyContent: "center",
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[3],
    borderRadius: radius.md
  },
  confirmDeleteText: {
    color: colors.white,
    fontFamily: fontFamilies.interfaceSemiBold,
    fontSize: 12
  },
  confirmCancelBtn: {
    backgroundColor: colors.surface02,
    minHeight: 44,
    justifyContent: "center",
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[3],
    borderRadius: radius.md
  },
  confirmCancelText: {
    color: colors.textPrimary,
    fontFamily: fontFamilies.interfaceMedium,
    fontSize: 12
  },
  alertError: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[2],
    backgroundColor: "rgba(239, 68, 68, 0.12)",
    borderColor: colors.error,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing[3]
  },
  alertErrorText: {
    color: colors.error,
    fontFamily: fontFamilies.interfaceMedium,
    fontSize: 13
  },
  alertSuccess: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[2],
    backgroundColor: "rgba(52, 211, 153, 0.12)",
    borderColor: colors.success,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing[3]
  },
  alertSuccessText: {
    color: colors.success,
    fontFamily: fontFamilies.interfaceMedium,
    fontSize: 13
  },
  sectionCard: {
    backgroundColor: colors.surface01,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing[6],
    gap: spacing[5]
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[3]
  },
  sectionHeaderIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.lg,
    backgroundColor: "rgba(168, 85, 247, 0.15)",
    alignItems: "center",
    justifyContent: "center"
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontFamily: fontFamilies.interfaceBold,
    fontSize: 18,
    lineHeight: 23
  },
  sectionSubtitle: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.interface,
    fontSize: 12,
    marginTop: 2
  },
  formGrid: {
    flexDirection: "row",
    gap: spacing[6]
  },
  formGridNarrow: {
    flexDirection: "column"
  },
  formCol: {
    flex: 1,
    gap: spacing[4]
  },
  fieldWrapper: {
    gap: spacing[1]
  },
  fieldLabel: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.interfaceSemiBold,
    fontSize: 12
  },
  fieldRow: {
    flexDirection: "row",
    gap: spacing[3]
  },
  fieldRowItem: {
    flex: 1
  },
  input: {
    backgroundColor: colors.surface02,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing[3],
    minHeight: 48,
    paddingVertical: spacing[2],
    color: colors.textPrimary,
    fontFamily: fontFamilies.interface,
    fontSize: 13
  },
  inputDisabled: {
    opacity: 0.6
  },
  textAreaSmall: {
    minHeight: 68,
    textAlignVertical: "top"
  },
  textArea: {
    minHeight: 110,
    textAlignVertical: "top"
  },
  chipsSection: {
    gap: spacing[4],
    borderTopColor: colors.border,
    borderTopWidth: 1,
    paddingTop: spacing[4]
  },
  optionBlock: {
    gap: spacing[2]
  },
  chipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing[2]
  },
  chip: {
    backgroundColor: colors.surface02,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: spacing[3],
    minHeight: 44,
    justifyContent: "center",
    paddingVertical: spacing[1]
  },
  chipActive: {
    backgroundColor: colors.purple600,
    borderColor: colors.purple500
  },
  chipText: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.interfaceMedium,
    fontSize: 12
  },
  chipTextActive: {
    color: colors.white,
    fontFamily: fontFamilies.interfaceBold
  },
  calendarSection: {
    backgroundColor: colors.surface01,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing[6],
    gap: spacing[5]
  },
  calendarLead: { gap: spacing[1], maxWidth: 560 },
  stageAdvance: {
    alignItems: "center",
    alignSelf: "flex-end",
    backgroundColor: colors.purple600,
    borderRadius: radius.md,
    flexDirection: "row",
    gap: spacing[2],
    justifyContent: "center",
    minHeight: 48,
    paddingHorizontal: spacing[4]
  },
  stageAdvanceText: { color: colors.white, fontFamily: fontFamilies.interfaceBold, fontSize: 14 },
  composerCard: {
    backgroundColor: colors.surface01,
    borderColor: colors.purple600,
    borderWidth: 1,
    borderRadius: radius.xl,
    padding: spacing[5],
    gap: spacing[4]
  },
  composerCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start"
  },
  composerCardTitle: {
    color: colors.textPrimary,
    fontFamily: fontFamilies.interfaceBold,
    fontSize: 15
  },
  composerCardSub: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.interface,
    fontSize: 12,
    marginTop: 2
  },
  closeBtn: {
    alignItems: "center",
    height: 44,
    justifyContent: "center",
    width: 44,
    borderRadius: radius.sm,
    backgroundColor: colors.surface02
  },
  pressed: {
    opacity: 0.8
  },
  disabled: {
    opacity: 0.5
  }
});
