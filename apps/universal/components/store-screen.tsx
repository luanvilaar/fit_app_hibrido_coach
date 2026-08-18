import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions
} from "react-native";
import {
  createStoreRepository,
  type StoreProductCategory,
  type StoreProductDetail,
  type StoreProductRecord
} from "@fitblock/backend";
import { colors, fontFamilies, radius, spacing, typeScale } from "@fitblock/design-tokens";
import { Dialog, DialogButton } from "@/components/ui/dialog";
import { describeBackendError } from "@/data/backend-error";
import {
  describeProductCategory,
  describeProductLevel,
  filterStoreProducts,
  storeCategoryOptions
} from "@/data/store";
import { formatBRL } from "@/data/finance/money";
import { getSupabaseConfigurationError, supabase } from "@/lib/supabase";

const PAYMENT_POLL_INTERVAL_MS = 5_000;
const PAYMENT_POLL_TIMEOUT_MS = 3 * 60_000;

function todayCalendarDate(): string {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

type StorePayment = {
  order_id: string;
  payment_id: string;
  status: string;
  amount_cents: number;
  qr_code: string | null;
  qr_code_base64: string | null;
  expires_at: string | null;
  timedOut: boolean;
};

type CheckoutResponse = Omit<StorePayment, "timedOut">;

export function StoreScreen() {
  const { width } = useWindowDimensions();
  const isNarrow = width < 860;
  const [products, setProducts] = useState<StoreProductRecord[]>([]);
  const [category, setCategory] = useState<StoreProductCategory | null>(null);
  const [search, setSearch] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<StoreProductDetail | null>(null);
  const [programStartDate, setProgramStartDate] = useState(todayCalendarDate);
  const [activePayment, setActivePayment] = useState<StorePayment | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isOpeningProduct, setIsOpeningProduct] = useState(false);
  const [isCreatingPayment, setIsCreatingPayment] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  const pollingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadProducts = useCallback(async () => {
    if (!supabase) {
      setErrorMessage(getSupabaseConfigurationError() ?? "Loja indisponível.");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const nextProducts = await createStoreRepository(supabase).listProducts(null);
      setProducts(nextProducts);
      setErrorMessage(null);
    } catch (error: unknown) {
      setErrorMessage(describeBackendError(error));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProducts();
    return () => {
      if (pollingTimeout.current) clearTimeout(pollingTimeout.current);
    };
  }, [loadProducts]);

  const visibleProducts = filterStoreProducts(products, category, search);

  async function openProduct(slug: string) {
    if (!supabase || isOpeningProduct) return;

    setIsOpeningProduct(true);
    setErrorMessage(null);

    try {
      const product = await createStoreRepository(supabase).getProduct(slug);
      if (!product) throw new Error("Programa não encontrado ou indisponível.");
      setSelectedProduct(product);
    } catch (error: unknown) {
      setErrorMessage(describeBackendError(error));
    } finally {
      setIsOpeningProduct(false);
    }
  }

  async function createPayment() {
    if (!supabase || !selectedProduct || isCreatingPayment) return;

    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;

    if (!token) {
      setPaymentError("Sua sessão expirou. Entre novamente.");
      return;
    }

    setIsCreatingPayment(true);
    setPaymentError(null);

    try {
      const response = await fetch("/api/store/checkout", {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json"
        },
        body: JSON.stringify({ product_id: selectedProduct.id, method: "pix", start_date: programStartDate })
      });
      const payload: unknown = await response.json().catch(() => null);

      if (!response.ok) throw new Error(readApiError(payload, "Não foi possível iniciar a compra."));

      const payment = payload as Partial<CheckoutResponse>;
      if (
        typeof payment.order_id !== "string"
        || typeof payment.payment_id !== "string"
        || typeof payment.amount_cents !== "number"
        || (typeof payment.qr_code !== "string" && typeof payment.qr_code_base64 !== "string")
      ) {
        throw new Error("O servidor não devolveu os dados do PIX.");
      }

      setSelectedProduct(null);
      const active: StorePayment = {
        order_id: payment.order_id,
        payment_id: payment.payment_id,
        status: typeof payment.status === "string" ? payment.status : "pending",
        amount_cents: payment.amount_cents,
        qr_code: typeof payment.qr_code === "string" ? payment.qr_code : null,
        qr_code_base64: typeof payment.qr_code_base64 === "string" ? payment.qr_code_base64 : null,
        expires_at: typeof payment.expires_at === "string" ? payment.expires_at : null,
        timedOut: false
      };
      setActivePayment(active);
      pollOrder(active.order_id);
    } catch (error: unknown) {
      setPaymentError(error instanceof Error ? error.message : "Não foi possível iniciar a compra.");
    } finally {
      setIsCreatingPayment(false);
    }
  }

  function pollOrder(orderId: string) {
    const client = supabase;
    if (!client) return;

    const startedAt = Date.now();
    const poll = async () => {
      const orders = await createStoreRepository(client).listMyOrders().catch(() => []);
      const order = orders.find((item) => item.order_id === orderId);

      if (order?.status === "paid") {
        if (pollingTimeout.current) clearTimeout(pollingTimeout.current);
        setActivePayment(null);
        setPaymentError(null);
        return;
      }

      if (Date.now() - startedAt >= PAYMENT_POLL_TIMEOUT_MS) {
        setActivePayment((current) =>
          current?.order_id === orderId ? { ...current, timedOut: true } : current
        );
        return;
      }

      pollingTimeout.current = setTimeout(() => void poll(), PAYMENT_POLL_INTERVAL_MS);
    };

    pollingTimeout.current = setTimeout(() => void poll(), PAYMENT_POLL_INTERVAL_MS);
  }

  function closePayment() {
    if (pollingTimeout.current) clearTimeout(pollingTimeout.current);
    setActivePayment(null);
    setIsCopied(false);
  }

  async function copyPixCode() {
    if (
      Platform.OS !== "web"
      || !activePayment?.qr_code
      || typeof navigator === "undefined"
      || !navigator.clipboard
    ) {
      return;
    }

    await navigator.clipboard.writeText(activePayment.qr_code);
    setIsCopied(true);
  }

  return (
    <View style={styles.page} testID="store-screen">
      <View style={[styles.intro, isNarrow && styles.introNarrow]}>
        <View style={styles.introCopy}>
          <Text style={styles.eyebrow}>LOJA FITBLOCK</Text>
          <Text style={styles.heading}>Treine com direção.</Text>
          <Text style={styles.lede}>
            Programas construídos por coaches para você sair do improviso e seguir um processo.
          </Text>
        </View>
        <View style={styles.introMark}>
          <Ionicons color={colors.purple400} name="arrow-up-outline" size={24} />
          <Text style={styles.introMarkText}>PROGRAMAS{`\n`}ORIGINAIS</Text>
        </View>
      </View>

      {errorMessage && <Banner text={errorMessage} tone="error" />}
      {paymentError && <Banner text={paymentError} tone="error" />}

      <View style={styles.toolbar}>
        <View style={styles.categories}>
          {storeCategoryOptions.map((option) => (
            <CategoryChip
              key={option.label}
              label={option.label}
              onPress={() => setCategory(option.value)}
              selected={category === option.value}
            />
          ))}
        </View>
        <TextInput
          accessibilityLabel="Buscar programas"
          onChangeText={setSearch}
          placeholder="Buscar programa ou coach"
          placeholderTextColor={colors.textSecondary}
          style={styles.search}
          testID="store-search"
          value={search}
        />
      </View>

      {isLoading ? (
        <Text style={styles.muted}>Carregando programas…</Text>
      ) : visibleProducts.length === 0 ? (
        <EmptyStore hasSearch={search.trim().length > 0 || category !== null} />
      ) : (
        <View style={[styles.grid, isNarrow && styles.gridNarrow]}>
          {visibleProducts.map((product) => (
            <ProductCard key={product.id} onOpen={() => void openProduct(product.slug)} product={product} />
          ))}
        </View>
      )}

      <Dialog
        description={selectedProduct?.short_description}
        onDismiss={() => setSelectedProduct(null)}
        testID="store-product-dialog"
        title={selectedProduct?.title ?? "Programa"}
        visible={selectedProduct !== null}
      >
        {selectedProduct && <ProductDetail product={selectedProduct} />}
        <View style={styles.startDateField}>
          <Text style={styles.fieldLabel}>Quando você quer começar?</Text>
          <TextInput
            accessibilityLabel="Data inicial do programa, no formato ano-mês-dia"
            onChangeText={setProgramStartDate}
            placeholder="2026-08-24"
            placeholderTextColor={colors.textSecondary}
            style={styles.startDateInput}
            value={programStartDate}
          />
          <Text style={styles.helperText}>O Dia 1 será esta data; as próximas sessões seguem a sequência do programa.</Text>
        </View>
        <View style={styles.dialogActions}>
          <DialogButton label="Fechar" onPress={() => setSelectedProduct(null)} testID="store-product-close" />
          <DialogButton
            disabled={isCreatingPayment}
            label={isCreatingPayment ? "Gerando PIX…" : "Comprar com PIX"}
            onPress={() => void createPayment()}
            testID="store-product-buy"
            tone="primary"
          />
        </View>
      </Dialog>

      <Dialog
        description="Abra o app do seu banco e pague usando o QR ou o código abaixo."
        onDismiss={closePayment}
        testID="store-payment-dialog"
        title="Pagar programa"
        visible={activePayment !== null}
      >
        {activePayment?.qr_code_base64 && (
          <Image
            accessibilityLabel="QR Code do PIX do programa"
            source={{ uri: `data:image/png;base64,${activePayment.qr_code_base64}` }}
            style={styles.qrCode}
            testID="store-payment-qr"
          />
        )}
        <Text style={styles.paymentAmount}>{formatBRL(activePayment?.amount_cents ?? 0)}</Text>
        {activePayment?.qr_code && (
          <>
            <Text style={styles.fieldLabel}>PIX copia e cola</Text>
            <TextInput
              editable={false}
              multiline
              selectTextOnFocus
              style={styles.pixCode}
              testID="store-payment-code"
              value={activePayment.qr_code}
            />
            {Platform.OS === "web" && (
              <DialogButton
                label={isCopied ? "Copiado" : "Copiar código"}
                onPress={() => void copyPixCode()}
                testID="store-payment-copy"
                tone="primary"
              />
            )}
          </>
        )}
        {activePayment?.timedOut ? (
          <Text style={styles.helperText} testID="store-payment-timeout">
            Ainda não recebemos a confirmação. Você pode fechar e consultar Meus Treinos em alguns instantes.
          </Text>
        ) : (
          <Text style={styles.helperText} testID="store-payment-polling">
            Aguardando a confirmação do pagamento…
          </Text>
        )}
      </Dialog>
    </View>
  );
}

function ProductCard({ product, onOpen }: { product: StoreProductRecord; onOpen: () => void }) {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <Pressable
      accessibilityLabel={`Abrir ${product.title}, por ${formatBRL(product.price_cents)}`}
      accessibilityRole="button"
      onBlur={() => setIsFocused(false)}
      onFocus={() => setIsFocused(true)}
      onPress={onOpen}
      style={({ pressed }) => [styles.productCard, isFocused && styles.focused, pressed && styles.pressed]}
      testID={`store-product-${product.id}`}
    >
      {product.cover_image_url ? (
        <Image
          accessible={false}
          resizeMode="cover"
          source={{ uri: product.cover_image_url }}
          style={styles.productImage}
        />
      ) : (
        <View style={styles.productImageFallback}>
          <Text style={styles.productImageFallbackText}>FITBLOCK</Text>
        </View>
      )}
      <View style={styles.productBody}>
        <View style={styles.productMetaRow}>
          <Text style={styles.productEyebrow}>{describeProductCategory(product.category)}</Text>
          <Text style={styles.productLevel}>{describeProductLevel(product.level)}</Text>
        </View>
        <Text numberOfLines={2} style={styles.productTitle}>{product.title}</Text>
        <Text numberOfLines={2} style={styles.productDescription}>{product.short_description}</Text>
        <View style={styles.productFooter}>
          <View>
            <Text style={styles.productCoach}>por {product.seller_display_name}</Text>
            <Text style={styles.productPrice}>{formatBRL(product.price_cents)}</Text>
          </View>
          <View style={styles.openIcon}>
            <Ionicons color={colors.textPrimary} name="arrow-forward" size={17} />
          </View>
        </View>
      </View>
    </Pressable>
  );
}

function ProductDetail({ product }: { product: StoreProductDetail }) {
  return (
    <View style={styles.detail}>
      <View style={styles.detailFacts}>
        <Fact label="Coach" value={product.seller_display_name} />
        <Fact label="Nível" value={describeProductLevel(product.level)} />
        <Fact label="Objetivo" value={product.objective} />
        <Fact label="Duração" value={product.duration_weeks ? `${product.duration_weeks} semanas` : "Flexível"} />
        <Fact label="Formato" value="Programa digital" />
      </View>
      <Text style={styles.detailDescription}>{product.description || product.short_description}</Text>
      <Text style={styles.detailSectionTitle}>O que você recebe</Text>
      {product.sessions.map((session) => (
        <View key={session.id} style={styles.sessionRow}>
          <Text style={styles.sessionWeek}>S{session.week_number} · D{session.day_number}</Text>
          <Text style={styles.sessionTitle}>{session.title}</Text>
        </View>
      ))}
    </View>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.fact}>
      <Text style={styles.factLabel}>{label}</Text>
      <Text style={styles.factValue}>{value}</Text>
    </View>
  );
}

function CategoryChip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [styles.categoryChip, selected && styles.categoryChipSelected, pressed && styles.pressed]}
    >
      <Text style={[styles.categoryChipText, selected && styles.categoryChipTextSelected]}>{label}</Text>
    </Pressable>
  );
}

function EmptyStore({ hasSearch }: { hasSearch: boolean }) {
  return (
    <View style={styles.empty} testID="store-empty">
      <Ionicons color={colors.purple400} name="bag-handle-outline" size={24} />
      <Text style={styles.emptyTitle}>{hasSearch ? "Nenhum programa encontrado" : "A vitrine está sendo montada"}</Text>
      <Text style={styles.emptyText}>
        {hasSearch
          ? "Tente outra busca ou remova os filtros para ver todos os programas publicados."
          : "Assim que um programa for aprovado, ele aparece aqui para você."}
      </Text>
    </View>
  );
}

function Banner({ text, tone }: { text: string; tone: "error" | "success" }) {
  const isError = tone === "error";
  return (
    <View accessibilityRole="alert" style={[styles.banner, isError ? styles.bannerError : styles.bannerSuccess]}>
      <Ionicons color={isError ? colors.danger : colors.success} name={isError ? "alert-circle-outline" : "checkmark-circle-outline"} size={18} />
      <Text style={styles.bannerText}>{text}</Text>
    </View>
  );
}

function readApiError(payload: unknown, fallback: string): string {
  if (typeof payload === "object" && payload !== null && "error" in payload) {
    const message = (payload as Record<string, unknown>).error;
    if (typeof message === "string" && message.trim()) return message;
  }
  return fallback;
}

const styles = StyleSheet.create({
  page: { gap: spacing[5] },
  intro: { alignItems: "flex-end", flexDirection: "row", justifyContent: "space-between", gap: spacing[5] },
  introNarrow: { alignItems: "flex-start", flexDirection: "column" },
  introCopy: { flex: 1, gap: spacing[2] },
  eyebrow: { color: colors.purple400, fontFamily: fontFamilies.interfaceBold, fontSize: 11, letterSpacing: 1.4 },
  heading: { color: colors.textPrimary, fontFamily: fontFamilies.display, fontSize: typeScale.displaySection, lineHeight: typeScale.displaySection },
  lede: { color: colors.textSecondary, fontFamily: fontFamilies.interface, fontSize: 16, lineHeight: 24, maxWidth: 650 },
  introMark: { alignItems: "flex-end", borderLeftColor: colors.borderPurple, borderLeftWidth: 1, gap: spacing[2], paddingLeft: spacing[4] },
  introMarkText: { color: colors.textSecondary, fontFamily: fontFamilies.interfaceBold, fontSize: 10, letterSpacing: 1.2, lineHeight: 14, textAlign: "right" },
  banner: { alignItems: "center", borderRadius: radius.lg, borderWidth: 1, flexDirection: "row", gap: spacing[3], padding: spacing[4] },
  bannerError: { backgroundColor: colors.surface01, borderColor: colors.danger },
  bannerSuccess: { backgroundColor: colors.surface01, borderColor: colors.success },
  bannerText: { color: colors.textPrimary, flex: 1, fontFamily: fontFamilies.interface, fontSize: 14, lineHeight: 21 },
  toolbar: { alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: spacing[3], justifyContent: "space-between" },
  categories: { flexDirection: "row", flexWrap: "wrap", gap: spacing[2] },
  categoryChip: { alignItems: "center", borderColor: colors.border, borderRadius: radius.pill, borderWidth: 1, minHeight: 44, justifyContent: "center", paddingHorizontal: spacing[4] },
  categoryChipSelected: { backgroundColor: colors.purple500, borderColor: colors.purple500 },
  categoryChipText: { color: colors.textSecondary, fontFamily: fontFamilies.interfaceBold, fontSize: 12 },
  categoryChipTextSelected: { color: colors.white },
  search: { backgroundColor: colors.surface02, borderColor: colors.border, borderRadius: radius.pill, borderWidth: 1, color: colors.textPrimary, fontFamily: fontFamilies.interface, minHeight: 44, minWidth: 230, paddingHorizontal: spacing[4] },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing[4] },
  gridNarrow: { flexDirection: "column" },
  productCard: { backgroundColor: colors.surface02, borderColor: colors.border, borderRadius: radius.xl, borderWidth: 1, flexBasis: 280, flexGrow: 1, maxWidth: 390, minWidth: 260, overflow: "hidden" },
  focused: { borderColor: colors.purple400, shadowColor: colors.purple500, shadowOpacity: 0.22, shadowRadius: 8 },
  pressed: { opacity: 0.82 },
  productImage: { backgroundColor: colors.surface04, height: 150, width: "100%" },
  productImageFallback: { alignItems: "center", backgroundColor: colors.surface04, height: 150, justifyContent: "center", width: "100%" },
  productImageFallbackText: { color: colors.purple400, fontFamily: fontFamilies.display, fontSize: 28, letterSpacing: 2 },
  productBody: { gap: spacing[3], padding: spacing[4] },
  productMetaRow: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  productEyebrow: { color: colors.purple400, fontFamily: fontFamilies.interfaceBold, fontSize: 10, letterSpacing: 1.2, textTransform: "uppercase" },
  productLevel: { color: colors.textSecondary, fontFamily: fontFamilies.interface, fontSize: 11 },
  productTitle: { color: colors.textPrimary, fontFamily: fontFamilies.display, fontSize: 25, lineHeight: 27 },
  productDescription: { color: colors.textSecondary, fontFamily: fontFamilies.interface, fontSize: 13, lineHeight: 19, minHeight: 38 },
  productFooter: { alignItems: "flex-end", flexDirection: "row", justifyContent: "space-between", marginTop: spacing[2] },
  productCoach: { color: colors.textSecondary, fontFamily: fontFamilies.interface, fontSize: 11 },
  productPrice: { color: colors.textPrimary, fontFamily: fontFamilies.interfaceBold, fontSize: 18, marginTop: 3 },
  openIcon: { alignItems: "center", backgroundColor: colors.purple500, borderRadius: radius.pill, height: 36, justifyContent: "center", width: 36 },
  empty: { alignItems: "flex-start", backgroundColor: colors.surface02, borderColor: colors.border, borderRadius: radius.xl, borderWidth: 1, gap: spacing[3], padding: spacing[7] },
  emptyTitle: { color: colors.textPrimary, fontFamily: fontFamilies.display, fontSize: 26 },
  emptyText: { color: colors.textSecondary, fontFamily: fontFamilies.interface, fontSize: 15, lineHeight: 22, maxWidth: 520 },
  muted: { color: colors.textSecondary, fontFamily: fontFamilies.interface, fontSize: 14 },
  detail: { gap: spacing[4] },
  detailFacts: { flexDirection: "row", flexWrap: "wrap", gap: spacing[4] },
  fact: { minWidth: 110 },
  factLabel: { color: colors.textSecondary, fontFamily: fontFamilies.interface, fontSize: 11 },
  factValue: { color: colors.textPrimary, fontFamily: fontFamilies.interfaceBold, fontSize: 14, marginTop: 3 },
  detailDescription: { color: colors.textSecondary, fontFamily: fontFamilies.interface, fontSize: 14, lineHeight: 21 },
  detailSectionTitle: { color: colors.textPrimary, fontFamily: fontFamilies.interfaceBold, fontSize: 13, letterSpacing: 0.5, marginTop: spacing[2], textTransform: "uppercase" },
  sessionRow: { alignItems: "center", borderBottomColor: colors.border, borderBottomWidth: 1, flexDirection: "row", gap: spacing[3], paddingVertical: spacing[3] },
  sessionWeek: { color: colors.purple400, fontFamily: fontFamilies.interfaceBold, fontSize: 11, width: 58 },
  sessionTitle: { color: colors.textPrimary, flex: 1, fontFamily: fontFamilies.interface, fontSize: 14 },
  dialogActions: { flexDirection: "row", flexWrap: "wrap", gap: spacing[3], justifyContent: "flex-end", marginTop: spacing[4] },
  qrCode: { alignSelf: "center", height: 220, width: 220 },
  paymentAmount: { color: colors.textPrimary, fontFamily: fontFamilies.display, fontSize: 32, textAlign: "center" },
  fieldLabel: { color: colors.textSecondary, fontFamily: fontFamilies.interfaceBold, fontSize: 12, marginTop: spacing[3] },
  startDateField: { gap: spacing[2] },
  startDateInput: { backgroundColor: colors.surface01, borderColor: colors.border, borderRadius: radius.md, borderWidth: 1, color: colors.textPrimary, fontFamily: fontFamilies.interface, fontSize: 14, minHeight: 44, paddingHorizontal: spacing[3] },
  pixCode: { backgroundColor: colors.surface01, borderColor: colors.border, borderRadius: radius.md, borderWidth: 1, color: colors.textPrimary, fontFamily: fontFamilies.interface, fontSize: 12, minHeight: 74, padding: spacing[3] },
  helperText: { color: colors.textSecondary, fontFamily: fontFamilies.interface, fontSize: 13, lineHeight: 19, marginTop: spacing[3] }
});
