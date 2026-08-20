import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View, useWindowDimensions } from "react-native";
import type {
  CoachStoreProductRecord,
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
import { formatBRL } from "@/data/finance/money";
import { describeProductCategory, describeProductLevel, describeProductStatus } from "@/data/store";
import { describeProgramDayType } from "@/data/program-builder";
import { getSupabaseConfigurationError, supabase } from "@/lib/supabase";

export function CoachProductsScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { hasRole } = useUserRoles();
  const isNarrow = width < 980;
  const isCoach = hasRole("coach");
  const isOwner = hasRole("owner");
  const [products, setProducts] = useState<CoachStoreProductRecord[]>([]);
  const [reviewProducts, setReviewProducts] = useState<StoreReviewProductRecord[]>([]);
  const [sales, setSales] = useState<StoreSaleRecord[]>([]);
  const [teams, setTeams] = useState<TrainingGroupRecord[]>([]);
  const [deliveryMembers, setDeliveryMembers] = useState<TeamMemberRecord[]>([]);
  const [deliveryTarget, setDeliveryTarget] = useState<"team" | "athlete">("team");
  const [deliveryAthleteId, setDeliveryAthleteId] = useState<string>("");
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const [rejectionReasons, setRejectionReasons] = useState<Record<string, string>>({});
  const [reviewSchedules, setReviewSchedules] = useState<Record<string, StoreProgramScheduleDay[]>>({});
  const [scheduleLoadingProductId, setScheduleLoadingProductId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
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
      const [nextProducts, nextSales, nextTeams, nextReviewProducts] = await Promise.all([
        storeRepository.listCoachProducts(),
        storeRepository.listCoachSales(),
        createCoachFlowRepository(client).listCoachTeams(),
        isOwner ? storeRepository.listProductsForReview() : Promise.resolve([])
      ]);
      setProducts(nextProducts);
      setSales(nextSales);
      setTeams(nextTeams);
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

  async function submitProduct(productId: string) {
    const client = supabase;
    if (!client || busyProductId) return;
    setBusyProductId(productId);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      await createStoreRepository(client).submitProductReview(productId);
      setSuccessMessage("Produto enviado para análise.");
      await load();
    } catch (error: unknown) {
      setErrorMessage(describeBackendError(error));
    } finally {
      setBusyProductId(null);
    }
  }

  // Só existe "Excluir": o banco decide entre apagar de vez e preservar o histórico
  // de quem já comprou. A tela não conhece — nem oferece — um estado intermediário.
  async function deleteProduct(productId: string) {
    const client = supabase;
    if (!client || busyProductId) return;
    setBusyProductId(productId);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      await createStoreRepository(client).deleteProduct(productId);
      setConfirmingDeleteId(null);
      setSuccessMessage("Produto excluído.");
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
          <Pressable
            accessibilityLabel="Criar novo programa"
            accessibilityRole="button"
            onPress={() => router.push("/app/coach/produtos/novo")}
            style={({ pressed }) => [styles.newProgramBtn, pressed && styles.pressed]}
            testID="create-new-program-btn"
          >
            <Ionicons color={colors.white} name="add-circle-outline" size={18} />
            <Text style={styles.newProgramBtnText}>Novo programa</Text>
          </Pressable>
        </View>
      </View>

      {errorMessage && <Message text={errorMessage} tone="error" />}
      {successMessage && <Message text={successMessage} tone="success" />}

      <View style={styles.hubContent}>
          <View style={styles.panel} testID="coach-products-list">
            <PanelHeading eyebrow="SEUS PRODUTOS" title={`${products.length} ${products.length === 1 ? "produto" : "produtos"}`} />
            {isLoading ? <Text style={styles.helperText}>Carregando produtos…</Text> : products.length === 0 ? (
              <Text style={styles.helperText}>Crie o primeiro produto usando um treino da biblioteca.</Text>
            ) : products.map((product) => (
              <ProductRow
                key={product.id}
                busy={busyProductId === product.id}
                isConfirmingDelete={confirmingDeleteId === product.id}
                onCancelDelete={() => setConfirmingDeleteId(null)}
                onConfirmDelete={() => void deleteProduct(product.id)}
                onOpen={() => router.push(`/app/coach/produtos/${product.id}`)}
                onRequestDelete={() => setConfirmingDeleteId(product.id)}
                onSubmit={() => void submitProduct(product.id)}
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

function ProductRow({
  product,
  busy,
  isConfirmingDelete,
  onCancelDelete,
  onConfirmDelete,
  onOpen,
  onRequestDelete,
  onSubmit
}: {
  product: CoachStoreProductRecord;
  busy: boolean;
  isConfirmingDelete: boolean;
  onCancelDelete: () => void;
  onConfirmDelete: () => void;
  onOpen: () => void;
  onRequestDelete: () => void;
  onSubmit: () => void;
}) {
  const canSubmit = product.status === "draft";
  return (
    <View style={styles.productRow} testID={`coach-product-${product.id}`}>
      <View style={styles.productRowCopy}>
        <Text style={styles.productRowTitle}>{product.title}</Text>
        <Text style={styles.productRowMeta}>{describeProductStatus(product.status)} · {formatBRL(product.price_cents)}</Text>
      </View>
      <View style={styles.rowActions}>
        <SmallButton disabled={busy} label="Abrir produto" onPress={onOpen} />
        {canSubmit && <SmallButton disabled={busy} label="Enviar análise" onPress={onSubmit} primary />}
        <SmallButton disabled={busy} label="Excluir" onPress={onRequestDelete} />
      </View>
      {isConfirmingDelete && (
        <View accessibilityRole="alert" style={styles.confirm} testID={`delete-confirm-${product.id}`}>
          <Text style={styles.confirmTitle}>Excluir “{product.title}”?</Text>
          <Text style={styles.confirmText}>O produto sai do seu catálogo e da Loja. Não dá para desfazer.</Text>
          {/* O aviso só aparece quando existe histórico: sem venda, entrega ou versão o produto é apagado de vez. */}
          {product.has_history && (
            <Text style={styles.confirmText} testID={`delete-history-warning-${product.id}`}>
              Este produto já tem vendas, entregas ou versões publicadas registradas. Esse histórico é preservado para
              quem já comprou e para os seus relatórios.
            </Text>
          )}
          <View style={styles.rowActions}>
            <SmallButton
              disabled={busy}
              label={busy ? "Excluindo…" : "Sim, excluir"}
              onPress={onConfirmDelete}
              primary
            />
            <SmallButton disabled={busy} label="Manter" onPress={onCancelDelete} />
          </View>
        </View>
      )}
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
            <View accessibilityLabel="Programa publicado" accessibilityRole="radiogroup" style={styles.optionWrap}>
              {products.map((product) => <ChoiceRow key={product.id} compact label={product.title} selected={productId === product.id} onPress={() => onProductChange(product.id)} />)}
            </View>
          </Field>
          <Field label="Equipe">
            <View accessibilityLabel="Equipe" accessibilityRole="radiogroup" style={styles.optionWrap}>
              {teams.map((team) => <ChoiceRow key={team.id} compact label={team.name} selected={teamId === team.id} onPress={() => onTeamChange(team.id)} />)}
            </View>
          </Field>
          <Field label="Destino">
            <View accessibilityLabel="Destino" accessibilityRole="radiogroup" style={styles.optionWrap}>
              <ChoiceRow compact label="Equipe inteira" selected={target === "team"} onPress={() => onTargetChange("team")} />
              <ChoiceRow compact label="Um atleta" selected={target === "athlete"} onPress={() => onTargetChange("athlete")} />
            </View>
          </Field>
          {target === "athlete" && (
            <Field label="Atleta">
              {members.length === 0 ? <Text style={styles.helperText}>A equipe não possui atletas disponíveis.</Text> : (
                <View accessibilityLabel="Atleta" accessibilityRole="radiogroup" style={styles.optionWrap}>
                  {members.map((member) => (
                    <ChoiceRow key={member.user_id} compact label={member.email} selected={athleteId === member.user_id} onPress={() => onAthleteChange(member.user_id)} />
                  ))}
                </View>
              )}
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

function ChoiceRow({ label, selected, onPress, compact = false }: { label: string; selected: boolean; onPress: () => void; compact?: boolean }) {
  return <Pressable accessibilityRole="radio" accessibilityState={{ selected }} onPress={onPress} style={({ pressed }) => [styles.choice, compact && styles.choiceCompact, selected && styles.choiceSelected, pressed && styles.pressed]}><View style={[styles.choiceDot, selected && styles.choiceDotSelected]} /><Text style={[styles.choiceText, selected && styles.choiceTextSelected]}>{label}</Text></Pressable>;
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
  hubContent: { gap: spacing[4] },
  panel: { backgroundColor: colors.surface02, borderColor: colors.border, borderRadius: radius.xl, borderWidth: 1, gap: spacing[4], padding: spacing[5] },
  panelHeading: { gap: spacing[2] },
  panelEyebrow: { color: colors.purple400, fontFamily: fontFamilies.interfaceBold, fontSize: 10, letterSpacing: 1.2 },
  panelTitle: { color: colors.textPrimary, fontFamily: fontFamilies.display, fontSize: 25, lineHeight: 29 },
  field: { gap: spacing[2] },
  fieldLabel: { color: colors.textSecondary, fontFamily: fontFamilies.interfaceBold, fontSize: 10, letterSpacing: 0.8, textTransform: "uppercase" },
  input: { backgroundColor: colors.surface01, borderColor: colors.border, borderRadius: radius.md, borderWidth: 1, color: colors.textPrimary, fontFamily: fontFamilies.interface, fontSize: 14, minHeight: 44, paddingHorizontal: spacing[3], paddingVertical: spacing[2] },
  optionWrap: { flexDirection: "row", flexWrap: "wrap", gap: spacing[2] },
  choice: { alignItems: "center", backgroundColor: colors.surface01, borderColor: colors.border, borderRadius: radius.md, borderWidth: 1, flexDirection: "row", gap: spacing[2], minHeight: 44, paddingHorizontal: spacing[3] },
  choiceCompact: { borderRadius: radius.pill, minHeight: 44 },
  choiceSelected: { backgroundColor: colors.purple500, borderColor: colors.purple500 },
  choiceDot: { borderColor: colors.textSecondary, borderRadius: radius.pill, borderWidth: 1, height: 9, width: 9 },
  choiceDotSelected: { backgroundColor: colors.white, borderColor: colors.white },
  choiceText: { color: colors.textSecondary, fontFamily: fontFamilies.interface, fontSize: 12 },
  choiceTextSelected: { color: colors.white, fontFamily: fontFamilies.interfaceBold },
  actionButtonDisabled: { opacity: 0.5 },
  productRow: { alignItems: "flex-start", borderBottomColor: colors.border, borderBottomWidth: 1, gap: spacing[3], paddingVertical: spacing[3] },
  confirm: { alignSelf: "stretch", backgroundColor: colors.surface02, borderColor: colors.danger, borderRadius: radius.lg, borderWidth: 1, gap: spacing[2], padding: spacing[4] },
  confirmTitle: { color: colors.textPrimary, fontFamily: fontFamilies.interfaceBold, fontSize: 15 },
  confirmText: { color: colors.textSecondary, fontFamily: fontFamilies.interface, fontSize: 13, lineHeight: 20 },
  productRowCopy: { flex: 1, gap: spacing[1] },
  productRowTitle: { color: colors.textPrimary, fontFamily: fontFamilies.interfaceBold, fontSize: 14 },
  productRowMeta: { color: colors.textSecondary, fontFamily: fontFamilies.interface, fontSize: 12 },
  rowActions: { flexDirection: "row", flexWrap: "wrap", gap: spacing[2] },
  smallButton: { alignItems: "center", borderColor: colors.border, borderRadius: radius.pill, borderWidth: 1, justifyContent: "center", minHeight: 44, paddingHorizontal: spacing[3] },
  smallButtonPrimary: { backgroundColor: colors.purple500, borderColor: colors.purple500 },
  smallButtonText: { color: colors.textSecondary, fontFamily: fontFamilies.interfaceBold, fontSize: 11 },
  smallButtonTextPrimary: { color: colors.white },
  saleRow: { alignItems: "center", borderBottomColor: colors.border, borderBottomWidth: 1, flexDirection: "row", gap: spacing[3], paddingVertical: spacing[3] },
  saleAmount: { color: colors.success, fontFamily: fontFamilies.interfaceBold, fontSize: 13 },
  reviewRow: { borderBottomColor: colors.border, borderBottomWidth: 1, gap: spacing[3], paddingVertical: spacing[3] },
  reviewActions: { alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: spacing[2] },
  reasonInput: { backgroundColor: colors.surface01, borderColor: colors.border, borderRadius: radius.pill, borderWidth: 1, color: colors.textPrimary, flexBasis: 180, flexGrow: 1, fontFamily: fontFamilies.interface, fontSize: 12, minHeight: 44, paddingHorizontal: spacing[3] },
  helperText: { color: colors.textSecondary, fontFamily: fontFamilies.interface, fontSize: 13, lineHeight: 20 },
  message: { alignItems: "center", borderRadius: radius.lg, borderWidth: 1, flexDirection: "row", gap: spacing[3], padding: spacing[4] },
  messageError: { backgroundColor: colors.surface01, borderColor: colors.danger },
  messageSuccess: { backgroundColor: colors.surface01, borderColor: colors.success },
  messageText: { color: colors.textPrimary, flex: 1, fontFamily: fontFamilies.interface, fontSize: 14, lineHeight: 21 },
  newProgramBtn: {
    backgroundColor: colors.purple500,
    borderColor: colors.purple400,
    borderWidth: 1,
    borderRadius: radius.pill,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[2],
    minHeight: 44,
    paddingHorizontal: spacing[4],
    justifyContent: "center"
  },
  newProgramBtnText: {
    color: colors.white,
    fontFamily: fontFamilies.interfaceBold,
    fontSize: 12
  },
  pressed: { opacity: 0.8 }
});
