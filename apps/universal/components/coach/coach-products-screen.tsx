import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View, useWindowDimensions } from "react-native";
import type {
  CoachStoreProductRecord,
  CreateExerciseRequest,
  ExerciseRecord,
  SessionTemplateSummary,
  StoreProductCategory,
  StoreProductLevel,
  StoreProgramScheduleDay,
  StoreReviewProductRecord,
  StoreSaleRecord,
  TeamMemberRecord,
  TrainingGroupRecord
} from "@fitblock/backend";
import { createCoachFlowRepository, createStoreRepository } from "@fitblock/backend";
import { colors, fontFamilies, radius, spacing, typeScale } from "@fitblock/design-tokens";
import { useUserRoles } from "@/auth/roles-provider";
import { describeBackendError } from "@/data/backend-error";
import { MoneyParseError, formatAmountInput, formatBRL, parseBRL } from "@/data/finance/money";
import {
  describeProductCategory,
  describeProductLevel,
  describeProductStatus,
  slugifyStoreTitle
} from "@/data/store";
import {
  createProgramSchedule,
  describeProgramDayType,
  programDayTypes,
  validateProgramSchedule,
  type ProgramDayType
} from "@/data/program-builder";
import { getSupabaseConfigurationError, supabase } from "@/lib/supabase";
import { buildTemplatePayload } from "@/data/coach-hibrido/payload";
import { withMovement } from "@/data/coach-hibrido/movement-bank";
import { createInitialSessionForm, type SessionForm } from "@/data/coach-hibrido/session-form";
import { SessionComposer } from "@/components/coach-hibrido/session-composer";

type ProductForm = {
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

const initialForm: ProductForm = {
  title: "",
  slug: "",
  shortDescription: "",
  description: "",
  coverImageUrl: "",
  price: "",
  category: "strength",
  objective: "",
  level: "all",
  durationWeeks: "",
  schedule: []
};

export function CoachProductsScreen() {
  const { width } = useWindowDimensions();
  const { hasRole } = useUserRoles();
  const isNarrow = width < 980;
  const isCoach = hasRole("coach");
  const isOwner = hasRole("owner");
  const [products, setProducts] = useState<CoachStoreProductRecord[]>([]);
  const [reviewProducts, setReviewProducts] = useState<StoreReviewProductRecord[]>([]);
  const [sales, setSales] = useState<StoreSaleRecord[]>([]);
  const [templates, setTemplates] = useState<SessionTemplateSummary[]>([]);
  const [teams, setTeams] = useState<TrainingGroupRecord[]>([]);
  const [catalog, setCatalog] = useState<ExerciseRecord[]>([]);
  const [composerForm, setComposerForm] = useState<SessionForm>(() => createInitialSessionForm());
  const [composerDayIndex, setComposerDayIndex] = useState<number | null>(null);
  const [isCreatingTemplate, setIsCreatingTemplate] = useState(false);
  const [deliveryMembers, setDeliveryMembers] = useState<TeamMemberRecord[]>([]);
  const [deliveryTarget, setDeliveryTarget] = useState<"team" | "athlete">("team");
  const [deliveryAthleteId, setDeliveryAthleteId] = useState<string>("");
  const [form, setForm] = useState<ProductForm>(initialForm);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [rejectionReasons, setRejectionReasons] = useState<Record<string, string>>({});
  const [reviewSchedules, setReviewSchedules] = useState<Record<string, StoreProgramScheduleDay[]>>({});
  const [scheduleLoadingProductId, setScheduleLoadingProductId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [busyProductId, setBusyProductId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [deliveryProductId, setDeliveryProductId] = useState<string>("");
  const [deliveryTeamId, setDeliveryTeamId] = useState<string>("");
  const [deliveryDate, setDeliveryDate] = useState(() => new Date().toISOString().slice(0, 10));

  const load = useCallback(async () => {
    const client = supabase;
    if (!client) {
      setErrorMessage(getSupabaseConfigurationError() ?? "Gestão de produtos indisponível.");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const storeRepository = createStoreRepository(client);
      const [nextProducts, nextSales, nextTemplates, nextTeams, nextReviewProducts, nextCatalog] = await Promise.all([
        storeRepository.listCoachProducts(),
        storeRepository.listCoachSales(),
        createCoachFlowRepository(client).listSessionTemplates(),
        createCoachFlowRepository(client).listCoachTeams(),
        isOwner ? storeRepository.listProductsForReview() : Promise.resolve([]),
        createCoachFlowRepository(client).listExercises()
      ]);
      setProducts(nextProducts);
      setSales(nextSales);
      setTemplates(nextTemplates);
      setTeams(nextTeams);
      setCatalog(nextCatalog);
      setDeliveryTeamId((current) => current || nextTeams[0]?.id || "");
      setDeliveryProductId((current) => current || nextProducts.find((product) => product.status === "published")?.id || "");
      setReviewProducts(nextReviewProducts);
      setErrorMessage(null);
    } catch (error: unknown) {
      setErrorMessage(describeBackendError(error));
    } finally {
      setIsLoading(false);
    }
  }, [isOwner]);

  useEffect(() => {
    if (isCoach || isOwner) void load();
    else setIsLoading(false);
  }, [isCoach, isOwner, load]);

  useEffect(() => {
    if (!supabase || !deliveryTeamId || !isCoach) {
      setDeliveryMembers([]);
      setDeliveryAthleteId("");
      return;
    }

    let mounted = true;
    void createCoachFlowRepository(supabase).listTeamMembers(deliveryTeamId)
      .then((members) => {
        if (!mounted) return;
        const athletes = members.filter((member) => member.role === "athlete");
        setDeliveryMembers(athletes);
        setDeliveryAthleteId((current) => athletes.some((member) => member.user_id === current) ? current : (athletes[0]?.user_id || ""));
      })
      .catch(() => {
        if (mounted) setDeliveryMembers([]);
      });
    return () => {
      mounted = false;
    };
  }, [deliveryTeamId, isCoach]);

  if (!isCoach && !isOwner) {
    return (
      <View style={styles.page} testID="coach-products-screen">
        <Message text="Esta área está disponível apenas para coaches." tone="error" />
      </View>
    );
  }

  function updateForm<K extends keyof ProductForm>(key: K, value: ProductForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function updateTitle(value: string) {
    setForm((current) => ({ ...current, title: value, slug: slugifyStoreTitle(value) }));
  }

  async function editProduct(product: CoachStoreProductRecord) {
    if (!supabase) return;
    setEditingProductId(product.id);
    try {
      const schedule = await createStoreRepository(supabase).getCoachProductSchedule(product.id);
      setForm({
        title: product.title,
        slug: product.slug,
        shortDescription: product.short_description,
        description: product.description,
        coverImageUrl: product.cover_image_url ?? "",
        price: formatAmountInput(product.price_cents),
        category: product.category,
        objective: product.objective,
        level: product.level,
        durationWeeks: String(product.duration_weeks),
        schedule: createProgramSchedule(product.duration_weeks, schedule)
      });
      setErrorMessage(null);
      setSuccessMessage(null);
    } catch (error: unknown) {
      setEditingProductId(null);
      setErrorMessage(describeBackendError(error));
    }
  }

  function resetForm() {
    setEditingProductId(null);
    setForm({
      ...initialForm
    });
    setErrorMessage(null);
    setSuccessMessage(null);
  }

  async function saveProduct() {
    const client = supabase;
    if (!client || isSaving) return;

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
      setErrorMessage(scheduleError ?? "Preencha título, resumo, objetivo, preço e o programa.");
      return;
    }
    if (!Number.isInteger(durationWeeks) || durationWeeks < 1) {
      setErrorMessage("A duração precisa ser um número inteiro de semanas.");
      return;
    }

    setIsSaving(true);
    try {
      const repository = createStoreRepository(client);
      const input = {
        title: form.title,
        slug: form.slug || slugifyStoreTitle(form.title),
        shortDescription: form.shortDescription,
        description: form.description,
        coverImageUrl: form.coverImageUrl || null,
        priceCents,
        category: form.category,
        objective: form.objective,
        level: form.level,
        durationWeeks,
        schedule: form.schedule
      };

      if (editingProductId) {
        await repository.updateTrainingProgram({ ...input, productId: editingProductId });
        setSuccessMessage("Programa atualizado. Ele voltou para rascunho e precisa de nova análise.");
      } else {
        await repository.createTrainingProgram(input);
        setSuccessMessage("Produto criado como rascunho.");
      }
      resetForm();
      await load();
    } catch (error: unknown) {
      setErrorMessage(describeBackendError(error));
    } finally {
      setIsSaving(false);
    }
  }

  async function runProductAction(productId: string, action: "submit" | "archive") {
    const client = supabase;
    if (!client || busyProductId) return;
    setBusyProductId(productId);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const repository = createStoreRepository(client);
      if (action === "submit") {
        await repository.submitProductReview(productId);
        setSuccessMessage("Produto enviado para análise.");
      } else {
        await repository.archiveProduct(productId);
        setSuccessMessage("Produto arquivado.");
      }
      await load();
    } catch (error: unknown) {
      setErrorMessage(describeBackendError(error));
    } finally {
      setBusyProductId(null);
    }
  }

  async function reviewProduct(productId: string, action: "approve" | "reject") {
    const client = supabase;
    if (!client || busyProductId) return;
    const reason = rejectionReasons[productId]?.trim() ?? "";
    if (action === "reject" && reason.length < 3) {
      setErrorMessage("Informe o motivo da rejeição para devolver o produto ao coach.");
      return;
    }

    setBusyProductId(productId);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const repository = createStoreRepository(client);
      if (action === "approve") {
        await repository.approveProduct(productId);
        setSuccessMessage("Produto aprovado e publicado na Loja.");
      } else {
        await repository.rejectProduct(productId, reason);
        setSuccessMessage("Produto devolvido para ajustes.");
      }
      await load();
    } catch (error: unknown) {
      setErrorMessage(describeBackendError(error));
    } finally {
      setBusyProductId(null);
    }
  }

  async function loadReviewSchedule(productId: string) {
    if (!supabase || scheduleLoadingProductId) return;
    setScheduleLoadingProductId(productId);
    try {
      const schedule = await createStoreRepository(supabase).getCoachProductSchedule(productId);
      setReviewSchedules((current) => ({ ...current, [productId]: schedule }));
      setErrorMessage(null);
    } catch (error: unknown) {
      setErrorMessage(describeBackendError(error));
    } finally {
      setScheduleLoadingProductId(null);
    }
  }

  async function createDelivery() {
    if (!supabase || !deliveryProductId || !deliveryTeamId || busyProductId) return;
    setBusyProductId(deliveryProductId);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      await createStoreRepository(supabase).createProgramDelivery({
        productId: deliveryProductId,
        teamId: deliveryTarget === "team" ? deliveryTeamId : null,
        athleteId: deliveryTarget === "athlete" ? deliveryAthleteId : null,
        startDate: deliveryDate
      });
      setSuccessMessage("Programa entregue à equipe. As sessões foram adicionadas ao calendário.");
    } catch (error: unknown) {
      setErrorMessage(describeBackendError(error));
    } finally {
      setBusyProductId(null);
    }
  }

  async function createProgramTemplate() {
    const client = supabase;
    if (!client || composerDayIndex === null || isCreatingTemplate) return;

    setIsCreatingTemplate(true);
    setErrorMessage(null);
    try {
      const repository = createCoachFlowRepository(client);
      const created = await repository.createSessionTemplate(buildTemplatePayload(composerForm, catalog));
      const nextTemplates = await repository.listSessionTemplates();
      setTemplates(nextTemplates);
      setForm((current) => ({
        ...current,
        schedule: current.schedule.map((day, index) => index === composerDayIndex
          ? { ...day, day_type: "training", session_template_id: created.id, session_title: created.title }
          : day)
      }));
      setComposerForm(createInitialSessionForm());
      setComposerDayIndex(null);
      setSuccessMessage("Treino criado com o mesmo construtor da Agenda e vinculado ao dia do programa.");
    } catch (error: unknown) {
      setErrorMessage(describeBackendError(error));
    } finally {
      setIsCreatingTemplate(false);
    }
  }

  async function createMovementFromComposer(input: CreateExerciseRequest): Promise<ExerciseRecord> {
    if (!supabase) throw new Error(getSupabaseConfigurationError() ?? "Cadastro de movimento indisponível.");
    const created = await createCoachFlowRepository(supabase).createExercise(input);
    setCatalog((current) => withMovement(current, created));
    return created;
  }

  const grossSales = sales.reduce((total, sale) => total + sale.gross_amount_cents, 0);

  return (
    <View style={styles.page} testID="coach-products-screen">
      <View style={[styles.intro, isNarrow && styles.introNarrow]}>
        <View style={styles.introCopy}>
          <Text style={styles.eyebrow}>ÁREA DO COACH</Text>
          <Text style={styles.heading}>Meus produtos.</Text>
          <Text style={styles.lede}>Empacote treinos da sua biblioteca, envie para análise e acompanhe as vendas na Loja FitBlock.</Text>
        </View>
        <View style={styles.introMark}>
          <Ionicons color={colors.purple400} name="storefront-outline" size={27} />
          <Text style={styles.introMarkText}>IDEIA{`\n`}EM PRODUTO</Text>
        </View>
      </View>

      {errorMessage && <Message text={errorMessage} tone="error" />}
      {successMessage && <Message text={successMessage} tone="success" />}

      <View style={[styles.contentGrid, isNarrow && styles.contentGridNarrow]}>
        <ProductEditor
          editingProductId={editingProductId}
          form={form}
          isSaving={isSaving}
          templates={templates}
          onCancel={resetForm}
          onChange={updateForm}
          onDurationChange={(value) => {
            const durationWeeks = Number(value);
            setForm((current) => ({
              ...current,
              durationWeeks: value,
              schedule: Number.isInteger(durationWeeks) && durationWeeks > 0
                ? createProgramSchedule(durationWeeks, current.schedule, templates.find((template) => template.status === "published")?.id ?? null)
                : []
            }));
          }}
          onCreateTemplateForDay={(index) => {
            setComposerForm(createInitialSessionForm());
            setComposerDayIndex(index);
          }}
          onTitleChange={updateTitle}
          onSubmit={() => void saveProduct()}
        />

        {composerDayIndex !== null && (
          <View style={styles.composerPanel} testID="program-session-composer">
            <View style={styles.composerHeader}>
              <View style={styles.editorHeaderCopy}>
                <Text style={styles.panelTitle}>Monte o treino do Dia {form.schedule[composerDayIndex]?.day_number}.</Text>
                <Text style={styles.helperText}>Este é o mesmo construtor usado na Agenda. Ao salvar, o treino entra na sua biblioteca e fica ligado a este dia relativo.</Text>
              </View>
              <SmallButton label="Fechar" onPress={() => setComposerDayIndex(null)} />
            </View>
            <SessionComposer
              catalog={catalog}
              form={composerForm}
              isDeleting={false}
              isSaving={isCreatingTemplate}
              mode="create"
              onChange={setComposerForm}
              onCreateMovement={createMovementFromComposer}
              onSubmit={() => void createProgramTemplate()}
              showSchedule={false}
              submitLabel="Salvar treino no programa"
              teams={teams}
            />
          </View>
        )}

        <View style={styles.sideColumn}>
          <View style={styles.panel} testID="coach-products-list">
            <PanelHeading eyebrow="SEUS PRODUTOS" title={`${products.length} ${products.length === 1 ? "produto" : "produtos"}`} />
            {isLoading ? <Text style={styles.helperText}>Carregando produtos…</Text> : products.length === 0 ? (
              <Text style={styles.helperText}>Crie o primeiro produto usando um treino da biblioteca.</Text>
            ) : products.map((product) => (
              <ProductRow
                key={product.id}
                busy={busyProductId === product.id}
                onArchive={() => void runProductAction(product.id, "archive")}
                onEdit={() => void editProduct(product)}
                onSubmit={() => void runProductAction(product.id, "submit")}
                product={product}
              />
            ))}
          </View>

          <SalesPanel grossSales={grossSales} isLoading={isLoading} sales={sales} />
          {isCoach && <DeliveryPanel
            busy={busyProductId !== null}
            date={deliveryDate}
            productId={deliveryProductId}
            products={products.filter((product) => product.status === "published")}
            target={deliveryTarget}
            teamId={deliveryTeamId}
            teams={teams}
            athleteId={deliveryAthleteId}
            members={deliveryMembers}
            onCreate={() => void createDelivery()}
            onDateChange={setDeliveryDate}
            onProductChange={setDeliveryProductId}
            onTargetChange={(target) => setDeliveryTarget(target)}
            onTeamChange={setDeliveryTeamId}
            onAthleteChange={setDeliveryAthleteId}
          />}
        </View>
      </View>

      {isOwner && (
        <ReviewQueue
          busyProductId={busyProductId}
          products={reviewProducts}
          rejectionReasons={rejectionReasons}
          schedules={reviewSchedules}
          scheduleLoadingProductId={scheduleLoadingProductId}
          onReasonChange={(productId, value) => setRejectionReasons((current) => ({ ...current, [productId]: value }))}
          onReview={(productId, action) => void reviewProduct(productId, action)}
          onLoadSchedule={(productId) => void loadReviewSchedule(productId)}
        />
      )}
    </View>
  );
}

function ProductEditor({
  editingProductId,
  form,
  isSaving,
  templates,
  onCancel,
  onChange,
  onCreateTemplateForDay,
  onDurationChange,
  onTitleChange,
  onSubmit
}: {
  editingProductId: string | null;
  form: ProductForm;
  isSaving: boolean;
  templates: SessionTemplateSummary[];
  onCancel: () => void;
  onChange: <K extends keyof ProductForm>(key: K, value: ProductForm[K]) => void;
  onCreateTemplateForDay: (index: number) => void;
  onDurationChange: (value: string) => void;
  onTitleChange: (value: string) => void;
  onSubmit: () => void;
}) {
  return (
    <View style={styles.editor} testID="coach-product-editor">
      <View style={styles.editorHeader}>
        <View style={styles.editorHeaderCopy}>
          <Text style={styles.panelEyebrow}>{editingProductId ? "EDITAR PRODUTO" : "NOVO PRODUTO"}</Text>
          <Text style={styles.editorTitle}>{editingProductId ? "Ajuste os detalhes." : "Transforme um treino em programa."}</Text>
        </View>
        <Ionicons color={colors.purple400} name="create-outline" size={25} />
      </View>

      <Field label="Título">
        <TextInput accessibilityLabel="Título do produto" onChangeText={onTitleChange} placeholder="Ex.: Base de Força" placeholderTextColor={colors.textSecondary} style={styles.input} value={form.title} />
      </Field>
      <Field label={`Slug · ${form.slug || "gerado a partir do título"}`}>
        <TextInput editable={false} style={[styles.input, styles.inputDisabled]} value={form.slug} />
      </Field>
      <Field label="Resumo curto">
        <TextInput accessibilityLabel="Resumo curto do produto" maxLength={180} multiline onChangeText={(value) => onChange("shortDescription", value)} placeholder="Uma frase para a vitrine" placeholderTextColor={colors.textSecondary} style={[styles.input, styles.textAreaSmall]} value={form.shortDescription} />
      </Field>
      <Field label="Descrição completa">
        <TextInput accessibilityLabel="Descrição completa do produto" multiline onChangeText={(value) => onChange("description", value)} placeholder="Explique a proposta, rotina e para quem é" placeholderTextColor={colors.textSecondary} style={[styles.input, styles.textArea]} value={form.description} />
      </Field>
      <Field label="URL da capa · opcional">
        <TextInput autoCapitalize="none" autoCorrect={false} onChangeText={(value) => onChange("coverImageUrl", value)} placeholder="https://..." placeholderTextColor={colors.textSecondary} style={styles.input} value={form.coverImageUrl} />
      </Field>
      <Field label="Preço">
        <TextInput keyboardType="decimal-pad" onChangeText={(value) => onChange("price", value)} placeholder="300,00" placeholderTextColor={colors.textSecondary} style={styles.input} value={form.price} />
      </Field>
      <Field label="Objetivo do programa">
        <TextInput accessibilityLabel="Objetivo do programa" onChangeText={(value) => onChange("objective", value)} placeholder="Ex.: construir força e consistência" placeholderTextColor={colors.textSecondary} style={styles.input} value={form.objective} />
      </Field>
      <Field label="Duração em semanas">
        <TextInput accessibilityLabel="Duração em semanas" keyboardType="number-pad" onChangeText={(value) => onDurationChange(value.replace(/[^0-9]/g, ""))} placeholder="Ex.: 4" placeholderTextColor={colors.textSecondary} style={styles.input} value={form.durationWeeks} />
      </Field>

      <OptionGroup label="Categoria" options={categories} selected={form.category} getLabel={describeProductCategory} onChange={(value) => onChange("category", value)} />
      <OptionGroup label="Nível" options={levels} selected={form.level} getLabel={describeProductLevel} onChange={(value) => onChange("level", value)} />

      <ProgramScheduleEditor
        days={form.schedule}
        templates={templates.filter((template) => template.status === "published")}
        onChange={(schedule) => onChange("schedule", schedule)}
        onCreateTemplateForDay={onCreateTemplateForDay}
      />

      <View style={styles.editorActions}>
        {editingProductId && <ActionButton label="Cancelar edição" onPress={onCancel} />}
        <ActionButton disabled={isSaving} label={isSaving ? "Salvando…" : editingProductId ? "Salvar produto" : "Criar rascunho"} onPress={onSubmit} primary />
      </View>
    </View>
  );
}

function ProgramScheduleEditor({
  days,
  templates,
  onChange,
  onCreateTemplateForDay
}: {
  days: StoreProgramScheduleDay[];
  templates: SessionTemplateSummary[];
  onChange: (days: StoreProgramScheduleDay[]) => void;
  onCreateTemplateForDay: (index: number) => void;
}) {
  function update(index: number, patch: Partial<StoreProgramScheduleDay>) {
    onChange(days.map((day, dayIndex) => dayIndex === index ? { ...day, ...patch } : day));
  }

  function setDayType(index: number, dayType: ProgramDayType) {
    const day = days[index];
    const selectedTemplate = templates.find((template) => template.id === day.session_template_id) ?? templates[0];
    update(index, {
      day_type: dayType,
      session_template_id: dayType === "training" ? selectedTemplate?.id ?? null : null,
      session_title: dayType === "training" ? selectedTemplate?.title ?? null : null
    });
  }

  const weeks = days.reduce<Array<{ weekNumber: number; days: Array<{ day: StoreProgramScheduleDay; index: number }> }>>((result, day, index) => {
    const current = result[result.length - 1];
    if (!current || current.weekNumber !== day.week_number) result.push({ weekNumber: day.week_number, days: [{ day, index }] });
    else current.days.push({ day, index });
    return result;
  }, []);

  return (
    <View style={styles.field} testID="program-schedule-editor">
      <Text style={styles.fieldLabel}>ESTRUTURA DO PROGRAMA</Text>
      {days.length === 0 ? <Text style={styles.helperText}>Informe a duração para gerar o calendário relativo de semanas e dias.</Text> : (
        <>
          {templates.length === 0 && <Text style={styles.helperText}>Publique treinos na Biblioteca antes de atribuir dias do tipo Treino.</Text>}
          {weeks.map((week) => (
            <View key={week.weekNumber} style={styles.scheduleWeek}>
              <Text style={styles.scheduleWeekTitle}>SEMANA {week.weekNumber}</Text>
              {week.days.map(({ day, index }) => (
                <View key={`${day.week_number}-${day.day_number}`} style={styles.scheduleRow}>
                  <Text style={styles.scheduleDayLabel}>Dia {day.day_number}</Text>
                  <View style={styles.scheduleTypes}>
                    {programDayTypes.map((dayType) => (
                      <ChoiceRow
                        key={dayType}
                        compact
                        label={describeProgramDayType(dayType)}
                        selected={day.day_type === dayType}
                        onPress={() => setDayType(index, dayType)}
                      />
                    ))}
                  </View>
                  {day.day_type === "training" && (
                    <>
                      <View style={styles.scheduleTemplates}>
                        {templates.map((template) => (
                          <ChoiceRow
                            key={template.id}
                            compact
                            label={template.title}
                            selected={day.session_template_id === template.id}
                            onPress={() => update(index, { session_template_id: template.id, session_title: template.title })}
                          />
                        ))}
                      </View>
                      <SmallButton label="Montar novo treino" onPress={() => onCreateTemplateForDay(index)} />
                    </>
                  )}
                </View>
              ))}
            </View>
          ))}
          <Text style={styles.helperText}>Dias são relativos: a data real é calculada para cada aluno a partir da data inicial. A publicação congela o conteúdo.</Text>
        </>
      )}
    </View>
  );
}

function ProductRow({ product, busy, onEdit, onSubmit, onArchive }: { product: CoachStoreProductRecord; busy: boolean; onEdit: () => void; onSubmit: () => void; onArchive: () => void }) {
  const canSubmit = product.status === "draft";
  const canArchive = product.status !== "archived";
  return (
    <View style={styles.productRow} testID={`coach-product-${product.id}`}>
      <View style={styles.productRowCopy}>
        <Text style={styles.productRowTitle}>{product.title}</Text>
        <Text style={styles.productRowMeta}>{describeProductStatus(product.status)} · {formatBRL(product.price_cents)}</Text>
      </View>
      <View style={styles.rowActions}>
        {product.status !== "archived" && <SmallButton label="Editar" onPress={onEdit} />}
        {canSubmit && <SmallButton disabled={busy} label="Enviar análise" onPress={onSubmit} primary />}
        {canArchive && <SmallButton disabled={busy} label="Arquivar" onPress={onArchive} />}
      </View>
    </View>
  );
}

function ReviewQueue({ products, busyProductId, rejectionReasons, schedules, scheduleLoadingProductId, onReasonChange, onReview, onLoadSchedule }: { products: StoreReviewProductRecord[]; busyProductId: string | null; rejectionReasons: Record<string, string>; schedules: Record<string, StoreProgramScheduleDay[]>; scheduleLoadingProductId: string | null; onReasonChange: (productId: string, value: string) => void; onReview: (productId: string, action: "approve" | "reject") => void; onLoadSchedule: (productId: string) => void }) {
  return (
    <View style={styles.panel} testID="store-review-queue">
      <PanelHeading eyebrow="MODERAÇÃO" title="Produtos aguardando análise" />
      {products.length === 0 ? <Text style={styles.helperText}>A fila está vazia.</Text> : products.map((product) => (
        <View key={product.id} style={styles.reviewRow}>
          <View style={styles.productRowCopy}>
            <Text style={styles.productRowTitle}>{product.title}</Text>
            <Text style={styles.productRowMeta}>por {product.seller_display_name} · {formatBRL(product.price_cents)}</Text>
            <Text style={styles.productRowMeta}>
              {describeProductCategory(product.category)} · Objetivo: {product.objective} · {describeProductLevel(product.level)} · {product.duration_weeks} semanas
            </Text>
            <Text style={styles.productRowMeta}>{product.description || product.short_description}</Text>
            {schedules[product.id] && (
              <Text style={styles.productRowMeta}>
                {schedules[product.id].map((day) => `${day.day_type === "training" ? day.session_title ?? "Treino" : describeProgramDayType(day.day_type)} (S${day.week_number} · D${day.day_number})`).join(" · ")}
              </Text>
            )}
          </View>
          <View style={styles.reviewActions}>
            <SmallButton disabled={scheduleLoadingProductId === product.id} label={schedules[product.id] ? "Atualizar estrutura" : "Ver estrutura"} onPress={() => onLoadSchedule(product.id)} />
            <SmallButton disabled={busyProductId === product.id || !schedules[product.id]} label={schedules[product.id] ? "Aprovar" : "Veja a estrutura primeiro"} onPress={() => onReview(product.id, "approve")} primary />
            <TextInput accessibilityLabel={`Motivo da rejeição de ${product.title}`} onChangeText={(value) => onReasonChange(product.id, value)} placeholder="Motivo para devolver" placeholderTextColor={colors.textSecondary} style={styles.reasonInput} value={rejectionReasons[product.id] ?? ""} />
            <SmallButton disabled={busyProductId === product.id} label="Devolver" onPress={() => onReview(product.id, "reject")} />
          </View>
        </View>
      ))}
    </View>
  );
}

function SalesPanel({ sales, grossSales, isLoading }: { sales: StoreSaleRecord[]; grossSales: number; isLoading: boolean }) {
  return (
    <View style={styles.panel} testID="coach-products-sales">
      <PanelHeading eyebrow="VENDAS" title={formatBRL(grossSales)} />
      {isLoading ? <Text style={styles.helperText}>Carregando vendas…</Text> : sales.length === 0 ? <Text style={styles.helperText}>As vendas aprovadas aparecem aqui.</Text> : sales.map((sale) => (
        <View key={sale.product_id} style={styles.saleRow}>
          <View style={styles.productRowCopy}>
            <Text style={styles.productRowTitle}>{sale.product_title}</Text>
            <Text style={styles.productRowMeta}>{sale.sales_count} {sale.sales_count === 1 ? "venda" : "vendas"} · {sale.buyer_count} compradores</Text>
          </View>
          <Text style={styles.saleAmount}>{formatBRL(sale.gross_amount_cents)}</Text>
        </View>
      ))}
    </View>
  );
}

function DeliveryPanel({
  busy,
  date,
  productId,
  products,
  target,
  teamId,
  teams,
  athleteId,
  members,
  onCreate,
  onDateChange,
  onProductChange,
  onTargetChange,
  onTeamChange,
  onAthleteChange
}: {
  busy: boolean;
  date: string;
  productId: string;
  products: Array<{ id: string; title: string }>;
  target: "team" | "athlete";
  teamId: string;
  teams: Array<{ id: string; name: string }>;
  athleteId: string;
  members: TeamMemberRecord[];
  onCreate: () => void;
  onDateChange: (value: string) => void;
  onProductChange: (value: string) => void;
  onTargetChange: (value: "team" | "athlete") => void;
  onTeamChange: (value: string) => void;
  onAthleteChange: (value: string) => void;
}) {
  return (
    <View style={styles.panel} testID="program-delivery-panel">
      <PanelHeading eyebrow="ENTREGA PERSONALIZADA" title="Leve um programa para sua equipe." />
      {products.length === 0 || teams.length === 0 ? (
        <Text style={styles.helperText}>Publique um programa e tenha uma equipe disponível para criar uma entrega.</Text>
      ) : (
        <>
          <Field label="Programa publicado">
            {products.map((product) => <ChoiceRow key={product.id} compact label={product.title} selected={productId === product.id} onPress={() => onProductChange(product.id)} />)}
          </Field>
          <Field label="Equipe">
            {teams.map((team) => <ChoiceRow key={team.id} compact label={team.name} selected={teamId === team.id} onPress={() => onTeamChange(team.id)} />)}
          </Field>
          <Field label="Destino">
            <View style={styles.optionWrap}>
              <ChoiceRow compact label="Equipe inteira" selected={target === "team"} onPress={() => onTargetChange("team")} />
              <ChoiceRow compact label="Um atleta" selected={target === "athlete"} onPress={() => onTargetChange("athlete")} />
            </View>
          </Field>
          {target === "athlete" && (
            <Field label="Atleta">
              {members.length === 0 ? <Text style={styles.helperText}>A equipe não possui atletas disponíveis.</Text> : members.map((member) => (
                <ChoiceRow key={member.user_id} compact label={member.email} selected={athleteId === member.user_id} onPress={() => onAthleteChange(member.user_id)} />
              ))}
            </Field>
          )}
          <Field label="Data inicial">
            <TextInput accessibilityLabel="Data inicial da entrega" onChangeText={onDateChange} style={styles.input} value={date} />
          </Field>
          <SmallButton disabled={busy || !productId || !teamId || (target === "athlete" && !athleteId)} label={busy ? "Entregando…" : "Criar entrega"} onPress={onCreate} primary />
        </>
      )}
    </View>
  );
}

function PanelHeading({ eyebrow, title }: { eyebrow: string; title: string }) {
  return <View style={styles.panelHeading}><Text style={styles.panelEyebrow}>{eyebrow}</Text><Text style={styles.panelTitle}>{title}</Text></View>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <View style={styles.field}><Text style={styles.fieldLabel}>{label}</Text>{children}</View>;
}

function OptionGroup<T extends string>({ label, options, selected, getLabel, onChange }: { label: string; options: T[]; selected: T; getLabel: (value: T) => string; onChange: (value: T) => void }) {
  return <View style={styles.field}><Text style={styles.fieldLabel}>{label}</Text><View style={styles.optionWrap}>{options.map((option) => <ChoiceRow key={option} compact label={getLabel(option)} selected={selected === option} onPress={() => onChange(option)} />)}</View></View>;
}

function ChoiceRow({ label, selected, onPress, compact = false }: { label: string; selected: boolean; onPress: () => void; compact?: boolean }) {
  return <Pressable accessibilityRole="radio" accessibilityState={{ selected }} onPress={onPress} style={({ pressed }) => [styles.choice, compact && styles.choiceCompact, selected && styles.choiceSelected, pressed && styles.pressed]}><View style={[styles.choiceDot, selected && styles.choiceDotSelected]} /><Text style={[styles.choiceText, selected && styles.choiceTextSelected]}>{label}</Text></Pressable>;
}

function ActionButton({ label, onPress, primary = false, disabled = false }: { label: string; onPress: () => void; primary?: boolean; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.actionButton, primary && styles.actionButtonPrimary, disabled && styles.actionButtonDisabled, pressed && styles.pressed]}><Text style={[styles.actionButtonText, primary && styles.actionButtonTextPrimary]}>{label}</Text></Pressable>;
}

function SmallButton({ label, onPress, primary = false, disabled = false }: { label: string; onPress: () => void; primary?: boolean; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.smallButton, primary && styles.smallButtonPrimary, disabled && styles.actionButtonDisabled, pressed && styles.pressed]}><Text style={[styles.smallButtonText, primary && styles.smallButtonTextPrimary]}>{label}</Text></Pressable>;
}

function Message({ text, tone }: { text: string; tone: "error" | "success" }) {
  const isError = tone === "error";
  return <View accessibilityRole="alert" style={[styles.message, isError ? styles.messageError : styles.messageSuccess]}><Ionicons color={isError ? colors.danger : colors.success} name={isError ? "alert-circle-outline" : "checkmark-circle-outline"} size={18} /><Text style={styles.messageText}>{text}</Text></View>;
}

const styles = StyleSheet.create({
  page: { gap: spacing[5] },
  intro: { alignItems: "flex-end", flexDirection: "row", gap: spacing[5], justifyContent: "space-between" },
  introNarrow: { alignItems: "flex-start", flexDirection: "column" },
  introCopy: { flex: 1, gap: spacing[2] },
  eyebrow: { color: colors.purple400, fontFamily: fontFamilies.interfaceBold, fontSize: 11, letterSpacing: 1.4 },
  heading: { color: colors.textPrimary, fontFamily: fontFamilies.display, fontSize: typeScale.displaySection, lineHeight: typeScale.displaySection },
  lede: { color: colors.textSecondary, fontFamily: fontFamilies.interface, fontSize: 16, lineHeight: 24, maxWidth: 700 },
  introMark: { alignItems: "flex-end", borderLeftColor: colors.borderPurple, borderLeftWidth: 1, gap: spacing[2], paddingLeft: spacing[4] },
  introMarkText: { color: colors.textSecondary, fontFamily: fontFamilies.interfaceBold, fontSize: 10, letterSpacing: 1.2, lineHeight: 14, textAlign: "right" },
  contentGrid: { alignItems: "flex-start", flexDirection: "row", gap: spacing[5] },
  contentGridNarrow: { flexDirection: "column" },
  editor: { backgroundColor: colors.surface02, borderColor: colors.borderPurple, borderRadius: radius.xl, borderWidth: 1, flex: 1, gap: spacing[4], minWidth: 300, padding: spacing[5] },
  composerPanel: { backgroundColor: colors.surface02, borderColor: colors.borderPurple, borderRadius: radius.xl, borderWidth: 1, gap: spacing[4], padding: spacing[5] },
  editorHeader: { alignItems: "flex-start", flexDirection: "row", justifyContent: "space-between" },
  composerHeader: { alignItems: "flex-start", flexDirection: "row", gap: spacing[3], justifyContent: "space-between" },
  editorHeaderCopy: { flex: 1, gap: spacing[2] },
  editorTitle: { color: colors.textPrimary, fontFamily: fontFamilies.display, fontSize: 25, lineHeight: 29 },
  sideColumn: { flex: 1, gap: spacing[4], minWidth: 300 },
  panel: { backgroundColor: colors.surface02, borderColor: colors.border, borderRadius: radius.xl, borderWidth: 1, gap: spacing[4], padding: spacing[5] },
  panelHeading: { gap: spacing[2] },
  panelEyebrow: { color: colors.purple400, fontFamily: fontFamilies.interfaceBold, fontSize: 10, letterSpacing: 1.2 },
  panelTitle: { color: colors.textPrimary, fontFamily: fontFamilies.display, fontSize: 25, lineHeight: 29 },
  field: { gap: spacing[2] },
  fieldLabel: { color: colors.textSecondary, fontFamily: fontFamilies.interfaceBold, fontSize: 10, letterSpacing: 0.8, textTransform: "uppercase" },
  input: { backgroundColor: colors.surface01, borderColor: colors.border, borderRadius: radius.md, borderWidth: 1, color: colors.textPrimary, fontFamily: fontFamilies.interface, fontSize: 14, minHeight: 44, paddingHorizontal: spacing[3], paddingVertical: spacing[2] },
  inputDisabled: { color: colors.textSecondary },
  textAreaSmall: { minHeight: 68, textAlignVertical: "top" },
  textArea: { minHeight: 100, textAlignVertical: "top" },
  optionWrap: { flexDirection: "row", flexWrap: "wrap", gap: spacing[2] },
  choice: { alignItems: "center", backgroundColor: colors.surface01, borderColor: colors.border, borderRadius: radius.md, borderWidth: 1, flexDirection: "row", gap: spacing[2], minHeight: 44, paddingHorizontal: spacing[3] },
  choiceCompact: { borderRadius: radius.pill, minHeight: 44 },
  choiceSelected: { backgroundColor: colors.purple500, borderColor: colors.purple500 },
  choiceDot: { borderColor: colors.textSecondary, borderRadius: radius.pill, borderWidth: 1, height: 9, width: 9 },
  choiceDotSelected: { backgroundColor: colors.white, borderColor: colors.white },
  choiceText: { color: colors.textSecondary, fontFamily: fontFamilies.interface, fontSize: 12 },
  choiceTextSelected: { color: colors.white, fontFamily: fontFamilies.interfaceBold },
  editorActions: { alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: spacing[3], justifyContent: "flex-end", marginTop: spacing[2] },
  scheduleWeek: { borderTopColor: colors.border, borderTopWidth: 1, gap: spacing[2], paddingTop: spacing[3] },
  scheduleWeekTitle: { color: colors.textPrimary, fontFamily: fontFamilies.interfaceBold, fontSize: 13, letterSpacing: 0.8 },
  scheduleRow: { alignItems: "flex-start", borderColor: colors.border, borderRadius: radius.md, borderWidth: 1, gap: spacing[2], padding: spacing[3] },
  scheduleDayLabel: { color: colors.purple400, fontFamily: fontFamilies.interfaceBold, fontSize: 12 },
  scheduleTypes: { flexDirection: "row", flexWrap: "wrap", gap: spacing[2] },
  scheduleTemplates: { flexDirection: "row", flexWrap: "wrap", gap: spacing[2] },
  actionButton: { alignItems: "center", borderColor: colors.border, borderRadius: radius.pill, borderWidth: 1, justifyContent: "center", minHeight: 44, paddingHorizontal: spacing[4] },
  actionButtonPrimary: { backgroundColor: colors.purple500, borderColor: colors.purple500 },
  actionButtonDisabled: { opacity: 0.5 },
  actionButtonText: { color: colors.textPrimary, fontFamily: fontFamilies.interfaceBold, fontSize: 12 },
  actionButtonTextPrimary: { color: colors.white },
  productRow: { alignItems: "flex-start", borderBottomColor: colors.border, borderBottomWidth: 1, gap: spacing[3], paddingVertical: spacing[3] },
  productRowCopy: { flex: 1, gap: spacing[1] },
  productRowTitle: { color: colors.textPrimary, fontFamily: fontFamilies.interfaceBold, fontSize: 14 },
  productRowMeta: { color: colors.textSecondary, fontFamily: fontFamilies.interface, fontSize: 12 },
  rowActions: { flexDirection: "row", flexWrap: "wrap", gap: spacing[2] },
  smallButton: { alignItems: "center", borderColor: colors.border, borderRadius: radius.pill, borderWidth: 1, justifyContent: "center", minHeight: 36, paddingHorizontal: spacing[3] },
  smallButtonPrimary: { backgroundColor: colors.purple500, borderColor: colors.purple500 },
  smallButtonText: { color: colors.textSecondary, fontFamily: fontFamilies.interfaceBold, fontSize: 11 },
  smallButtonTextPrimary: { color: colors.white },
  saleRow: { alignItems: "center", borderBottomColor: colors.border, borderBottomWidth: 1, flexDirection: "row", gap: spacing[3], paddingVertical: spacing[3] },
  saleAmount: { color: colors.success, fontFamily: fontFamilies.interfaceBold, fontSize: 13 },
  reviewRow: { borderBottomColor: colors.border, borderBottomWidth: 1, gap: spacing[3], paddingVertical: spacing[3] },
  reviewActions: { alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: spacing[2] },
  reasonInput: { backgroundColor: colors.surface01, borderColor: colors.border, borderRadius: radius.pill, borderWidth: 1, color: colors.textPrimary, flexBasis: 180, flexGrow: 1, fontFamily: fontFamilies.interface, fontSize: 12, minHeight: 36, paddingHorizontal: spacing[3] },
  helperText: { color: colors.textSecondary, fontFamily: fontFamilies.interface, fontSize: 13, lineHeight: 20 },
  message: { alignItems: "center", borderRadius: radius.lg, borderWidth: 1, flexDirection: "row", gap: spacing[3], padding: spacing[4] },
  messageError: { backgroundColor: colors.surface01, borderColor: colors.danger },
  messageSuccess: { backgroundColor: colors.surface01, borderColor: colors.success },
  messageText: { color: colors.textPrimary, flex: 1, fontFamily: fontFamilies.interface, fontSize: 14, lineHeight: 21 },
  pressed: { opacity: 0.8 }
});
