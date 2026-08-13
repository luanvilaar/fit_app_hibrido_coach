import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import type { AthleteChargeRecord } from "@fitblock/backend";
import { createBillingRepository } from "@fitblock/backend";
import { colors, fontFamilies, radius, spacing } from "@fitblock/design-tokens";
import { Dialog, DialogButton } from "@/components/ui/dialog";
import { describeBackendError } from "@/data/backend-error";
import {
  chargeTone,
  describeChargeStatus,
  describeDueDate,
  describeReferenceMonth,
  summarizeAthleteCharges,
  type ChargeTone
} from "@/data/finance/charges";
import { formatBRL } from "@/data/finance/money";
import { supabase } from "@/lib/supabase";

const PAYMENT_POLL_INTERVAL_MS = 5_000;
const PAYMENT_POLL_TIMEOUT_MS = 3 * 60_000;

type CreatePaymentResponse = {
  payment_id: string;
  status: string;
  qr_code: string | null;
  qr_code_base64: string | null;
  expires_at: string | null;
  amount_cents: number;
};

type ActivePayment = CreatePaymentResponse & {
  chargeId: string;
  initialOutstandingCents: number;
  timedOut: boolean;
};

function apiErrorMessage(payload: unknown, fallback: string): string {
  if (typeof payload === "object" && payload !== null && "error" in payload) {
    const message = (payload as Record<string, unknown>).error;

    if (typeof message === "string" && message.trim()) return message;
  }

  return fallback;
}

/**
 * A mensalidade do ponto de vista do atleta, dentro do Perfil — que é a "Minha conta" do produto.
 *
 * A receita só entra no saldo depois do webhook confirmado. O QR exibido aqui é uma tentativa de
 * pagamento; enquanto o provedor não confirmar, a cobrança continua exatamente como estava.
 */
export function AthleteChargesCard() {
  const [charges, setCharges] = useState<AthleteChargeRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [isCreatingPayment, setIsCreatingPayment] = useState<string | null>(null);
  const [activePayment, setActivePayment] = useState<ActivePayment | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  const pollingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mounted = useRef(true);

  const loadCharges = useCallback(async (showLoading = false): Promise<AthleteChargeRecord[] | null> => {
    if (!supabase) return null;

    if (showLoading) setIsLoading(true);

    try {
      const records = await createBillingRepository(supabase).listMyCharges();

      if (mounted.current) {
        setCharges(records);
        setErrorMessage(null);
      }

      return records;
    } catch (error: unknown) {
      if (mounted.current) setErrorMessage(describeBackendError(error));
      return null;
    } finally {
      if (mounted.current && showLoading) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    void loadCharges(true);

    return () => {
      mounted.current = false;

      if (pollingTimeout.current) {
        clearTimeout(pollingTimeout.current);
        pollingTimeout.current = null;
      }
    };
  }, [loadCharges]);

  const stopPolling = useCallback(() => {
    if (pollingTimeout.current) {
      clearTimeout(pollingTimeout.current);
      pollingTimeout.current = null;
    }
  }, []);

  const pollPayment = useCallback(
    (payment: ActivePayment) => {
      const startedAt = Date.now();

      const poll = async () => {
        if (!mounted.current) return;

        const records = await loadCharges();

        if (!mounted.current) return;

        const charge = records?.find((record) => record.id === payment.chargeId);
        const wasApproved =
          charge !== undefined
          && (charge.outstanding_amount_cents < payment.initialOutstandingCents
            || charge.status === "paid");

        if (wasApproved) {
          stopPolling();
          setActivePayment(null);
          setIsCopied(false);
          setPaymentError(null);
          return;
        }

        if (Date.now() - startedAt >= PAYMENT_POLL_TIMEOUT_MS) {
          setActivePayment((current) =>
            current?.payment_id === payment.payment_id ? { ...current, timedOut: true } : current
          );
          stopPolling();
          return;
        }

        pollingTimeout.current = setTimeout(() => void poll(), PAYMENT_POLL_INTERVAL_MS);
      };

      pollingTimeout.current = setTimeout(() => void poll(), PAYMENT_POLL_INTERVAL_MS);
    },
    [loadCharges, stopPolling]
  );

  async function createPixPayment(charge: AthleteChargeRecord) {
    if (!supabase || isCreatingPayment) return;

    setIsCreatingPayment(charge.id);
    setPaymentError(null);

    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;

      if (!token) throw new Error("Sua sessão expirou. Entre novamente.");

      const response = await fetch("/api/payments/create", {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json"
        },
        body: JSON.stringify({ charge_id: charge.id, method: "pix" })
      });
      const payload: unknown = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(apiErrorMessage(payload, "Não foi possível gerar o PIX."));
      }

      const payment = payload as Partial<CreatePaymentResponse>;

      if (
        typeof payment.payment_id !== "string"
        || typeof payment.amount_cents !== "number"
        || (typeof payment.qr_code !== "string" && typeof payment.qr_code_base64 !== "string")
      ) {
        throw new Error("O servidor não devolveu os dados do PIX.");
      }

      const active: ActivePayment = {
        payment_id: payment.payment_id,
        status: typeof payment.status === "string" ? payment.status : "pending",
        qr_code: typeof payment.qr_code === "string" ? payment.qr_code : null,
        qr_code_base64: typeof payment.qr_code_base64 === "string" ? payment.qr_code_base64 : null,
        expires_at: typeof payment.expires_at === "string" ? payment.expires_at : null,
        amount_cents: payment.amount_cents,
        chargeId: charge.id,
        initialOutstandingCents: charge.outstanding_amount_cents,
        timedOut: false
      };

      setActivePayment(active);
      pollPayment(active);
    } catch (error: unknown) {
      setPaymentError(error instanceof Error ? error.message : "Não foi possível gerar o PIX.");
    } finally {
      setIsCreatingPayment(null);
    }
  }

  function closePayment() {
    stopPolling();
    setActivePayment(null);
    setIsCopied(false);
  }

  async function copyPixCode() {
    const code = activePayment?.qr_code;

    if (Platform.OS !== "web" || !code || typeof navigator === "undefined" || !navigator.clipboard) {
      return;
    }

    await navigator.clipboard.writeText(code);
    setIsCopied(true);
  }

  // Sem cobrança e sem erro, o treinador não cobra por aqui: um card vazio só geraria dúvida.
  if (!isLoading && charges.length === 0 && !errorMessage) return null;

  const summary = summarizeAthleteCharges(charges);

  return (
    <>
      <View style={styles.card} testID="athlete-charges-card">
        <Text style={styles.eyebrow}>MENSALIDADE</Text>
        <Text style={styles.title}>Seus pagamentos</Text>

        {isLoading ? (
          <Text style={styles.helperText}>Carregando...</Text>
        ) : errorMessage ? (
          <Text style={styles.helperText} testID="athlete-charges-error">
            {errorMessage}
          </Text>
        ) : (
          <>
            <Headline summary={summary} />

            <View style={styles.history} testID="athlete-charges-history">
              {charges.map((charge) => (
                <ChargeLine
                  charge={charge}
                  isBusy={isCreatingPayment === charge.id}
                  key={charge.id}
                  onPay={() => void createPixPayment(charge)}
                />
              ))}
            </View>

            <Text style={styles.footnote}>
              Após o pagamento, o saldo é atualizado quando o Mercado Pago confirmar a transação.
            </Text>
          </>
        )}

        {paymentError && (
          <Text accessibilityRole="alert" style={styles.error} testID="athlete-payment-error">
            {paymentError}
          </Text>
        )}
      </View>

      <Dialog
        description="Abra o app do seu banco e pague usando o QR ou o código abaixo."
        onDismiss={closePayment}
        testID="athlete-payment-dialog"
        title="Pagar com PIX"
        visible={activePayment !== null}
      >
        {activePayment?.qr_code_base64 && (
          <Image
            accessibilityLabel="QR Code do PIX"
            source={{ uri: `data:image/png;base64,${activePayment.qr_code_base64}` }}
            style={styles.qrCode}
            testID="athlete-payment-qr"
          />
        )}

        {activePayment?.qr_code && (
          <>
            <Text style={styles.codeLabel}>PIX copia e cola</Text>
            <TextInput
              editable={false}
              multiline
              selectTextOnFocus
              style={styles.pixCode}
              testID="athlete-payment-code"
              value={activePayment.qr_code}
            />
            {Platform.OS === "web" && (
              <DialogButton
                label={isCopied ? "Copiado" : "Copiar código"}
                onPress={() => void copyPixCode()}
                testID="athlete-payment-copy"
                tone="primary"
              />
            )}
          </>
        )}

        {activePayment?.timedOut ? (
          <Text style={styles.helperText} testID="athlete-payment-timeout">
            Ainda não recebemos a confirmação. Você pode fechar e consultar o saldo novamente em
            alguns instantes.
          </Text>
        ) : (
          <Text style={styles.helperText} testID="athlete-payment-polling">
            Aguardando a confirmação do pagamento...
          </Text>
        )}
      </Dialog>
    </>
  );
}

function Headline({ summary }: { summary: ReturnType<typeof summarizeAthleteCharges> }) {
  if (summary.overdueCents > 0) {
    return (
      <View style={[styles.headline, styles.headlineDanger]} testID="athlete-charges-overdue">
        <Ionicons color={colors.danger} name="alert-circle-outline" size={19} />
        <View style={styles.headlineCopy}>
          <Text style={styles.headlineValue}>{formatBRL(summary.overdueCents)} em atraso</Text>
          <Text style={styles.headlineMeta}>
            {summary.openCents > summary.overdueCents
              ? `${formatBRL(summary.openCents)} em aberto no total.`
              : "Procure seu treinador para acertar."}
          </Text>
        </View>
      </View>
    );
  }

  if (summary.nextDue) {
    return (
      <View style={styles.headline} testID="athlete-charges-next">
        <Ionicons color={colors.textSecondary} name="calendar-outline" size={19} />
        <View style={styles.headlineCopy}>
          <Text style={styles.headlineValue}>{formatBRL(summary.openCents)} em aberto</Text>
          <Text style={styles.headlineMeta}>
            Vence {describeDueDate(summary.nextDue.due_date)}.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.headline} testID="athlete-charges-clear">
      <Ionicons color={colors.success} name="checkmark-circle-outline" size={19} />
      <View style={styles.headlineCopy}>
        <Text style={styles.headlineValue}>Tudo em dia</Text>
        <Text style={styles.headlineMeta}>Nenhuma mensalidade em aberto.</Text>
      </View>
    </View>
  );
}

const toneColors: Record<ChargeTone, string> = {
  positive: colors.success,
  danger: colors.danger,
  warning: colors.warning,
  muted: colors.textSecondary,
  neutral: colors.textSecondary
};

function ChargeLine({
  charge,
  isBusy,
  onPay
}: {
  charge: AthleteChargeRecord;
  isBusy: boolean;
  onPay: () => void;
}) {
  const tone = chargeTone(charge);
  const canPay = charge.outstanding_amount_cents > 0 && charge.status !== "cancelled";

  return (
    <View style={styles.line} testID={`athlete-charge-${charge.id}`}>
      <View style={styles.lineCopy}>
        <Text style={styles.lineMonth}>{describeReferenceMonth(charge.reference_month)}</Text>
        {charge.paid_amount_cents > 0 && charge.outstanding_amount_cents > 0 && (
          <Text style={styles.lineMeta}>
            {formatBRL(charge.paid_amount_cents)} pagos · falta{" "}
            {formatBRL(charge.outstanding_amount_cents)}
          </Text>
        )}
      </View>

      <View style={styles.lineValues}>
        <Text style={styles.lineAmount}>{formatBRL(charge.original_amount_cents)}</Text>
        <Text style={[styles.lineStatus, { color: toneColors[tone] }]}>
          {describeChargeStatus(charge)}
        </Text>
      </View>

      {canPay && (
        <Pressable
          accessibilityLabel={`Pagar ${describeReferenceMonth(charge.reference_month)}`}
          accessibilityRole="button"
          accessibilityState={{ disabled: isBusy }}
          disabled={isBusy}
          onPress={onPay}
          style={({ pressed }) => [styles.payButton, isBusy && styles.disabled, pressed && styles.pressed]}
          testID={`athlete-charge-pay-${charge.id}`}
        >
          <Text style={styles.payButtonText}>{isBusy ? "Gerando…" : "Pagar agora"}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface02,
    borderColor: colors.border,
    borderRadius: radius.card,
    borderWidth: 1,
    gap: spacing[3],
    padding: spacing[5]
  },
  eyebrow: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.interfaceSemiBold,
    fontSize: 11,
    letterSpacing: 1.4
  },
  title: {
    color: colors.textPrimary,
    fontFamily: fontFamilies.interfaceBold,
    fontSize: 19
  },
  helperText: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.interface,
    fontSize: 13,
    lineHeight: 19
  },
  headline: {
    alignItems: "center",
    backgroundColor: colors.surface01,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing[3],
    padding: spacing[4]
  },
  headlineDanger: { borderColor: colors.danger },
  headlineCopy: { flex: 1, gap: 2, minWidth: 0 },
  headlineValue: {
    color: colors.textPrimary,
    fontFamily: fontFamilies.interfaceBold,
    fontSize: 16
  },
  headlineMeta: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.interface,
    fontSize: 12,
    lineHeight: 18
  },
  history: { gap: spacing[1] },
  line: {
    alignItems: "center",
    borderTopColor: colors.border,
    borderTopWidth: 1,
    flexDirection: "row",
    gap: spacing[3],
    minHeight: 58,
    paddingVertical: spacing[2]
  },
  lineCopy: { flex: 1, gap: 2, minWidth: 0 },
  lineMonth: {
    color: colors.textPrimary,
    fontFamily: fontFamilies.interfaceMedium,
    fontSize: 14,
    textTransform: "capitalize"
  },
  lineMeta: { color: colors.textSecondary, fontFamily: fontFamilies.interface, fontSize: 11 },
  lineValues: { alignItems: "flex-end", gap: 2 },
  lineAmount: { color: colors.textPrimary, fontFamily: fontFamilies.mono, fontSize: 14 },
  lineStatus: { fontFamily: fontFamilies.interfaceBold, fontSize: 12, textAlign: "right" },
  payButton: {
    alignItems: "center",
    backgroundColor: colors.purple500,
    borderRadius: radius.pill,
    justifyContent: "center",
    minHeight: 40,
    paddingHorizontal: spacing[3]
  },
  payButtonText: { color: colors.white, fontFamily: fontFamilies.interfaceBold, fontSize: 12 },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.72 },
  footnote: {
    color: colors.textMutedAccessible,
    fontFamily: fontFamilies.interface,
    fontSize: 12,
    lineHeight: 18
  },
  error: {
    color: colors.danger,
    fontFamily: fontFamilies.interface,
    fontSize: 12,
    lineHeight: 18
  },
  qrCode: { alignSelf: "center", height: 220, width: 220 },
  codeLabel: {
    color: colors.textPrimary,
    fontFamily: fontFamilies.interfaceSemiBold,
    fontSize: 12
  },
  pixCode: {
    backgroundColor: colors.surface01,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    color: colors.textPrimary,
    fontFamily: fontFamilies.mono,
    fontSize: 11,
    minHeight: 84,
    padding: spacing[3]
  }
});
