import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useState } from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import type { PaymentConnectionStatus } from "@fitblock/backend";
import { createPaymentConnectionRepository } from "@fitblock/backend";
import { colors, fontFamilies, radius, spacing } from "@fitblock/design-tokens";
import { describeBackendError } from "@/data/backend-error";
import { supabase } from "@/lib/supabase";

/**
 * Conexão da conta de recebimento do coach.
 *
 * O fluxo inteiro de OAuth vive no servidor (`api/mercadopago/*`): daqui só sai um pedido
 * autenticado que devolve para onde mandar o coach. Nenhum segredo do Mercado Pago passa pelo
 * app — a `client_secret` e os tokens do vendedor não têm caminho até o cliente, por construção.
 */
export function MercadoPagoConnectionCard() {
  const [status, setStatus] = useState<PaymentConnectionStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isBusy, setIsBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!supabase) return;
    setStatus(await createPaymentConnectionRepository(supabase).getStatus());
  }, []);

  useEffect(() => {
    let mounted = true;

    void load()
      .catch((error: unknown) => {
        if (mounted) setErrorMessage(describeBackendError(error));
      })
      .finally(() => {
        if (mounted) setIsLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [load]);

  /** As funções de `api/` exigem o JWT: quem afirma quem é o coach é o token, não o corpo. */
  async function callApi(path: string): Promise<Response> {
    const { data } = await supabase!.auth.getSession();
    const token = data.session?.access_token;

    if (!token) throw new Error("Sua sessão expirou. Entre novamente.");

    return fetch(path, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }
    });
  }

  async function connect() {
    if (!supabase || isBusy) return;

    setIsBusy(true);
    setErrorMessage(null);

    try {
      const response = await callApi("/api/mercadopago/connect");
      const payload: unknown = await response.json();

      if (!response.ok) {
        const message =
          typeof payload === "object" && payload !== null && "error" in payload
            ? String((payload as Record<string, unknown>).error)
            : "Não foi possível iniciar a conexão.";
        throw new Error(message);
      }

      const url = (payload as { authorization_url?: string }).authorization_url;

      if (!url) throw new Error("Resposta inesperada do servidor.");

      await Linking.openURL(url);
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message : "Não foi possível conectar.");
    } finally {
      setIsBusy(false);
    }
  }

  async function disconnect() {
    if (!supabase || isBusy) return;

    setIsBusy(true);
    setErrorMessage(null);

    try {
      const response = await callApi("/api/mercadopago/disconnect");

      if (!response.ok) throw new Error("Não foi possível desconectar a conta.");

      await load();
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message : "Não foi possível desconectar.");
    } finally {
      setIsBusy(false);
    }
  }

  const isConnected = status?.connected === true;

  return (
    <View style={styles.card} testID="mercadopago-card">
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>PAGAMENTOS</Text>
          <Text style={styles.title}>Mercado Pago</Text>
        </View>

        {isConnected && (
          <View style={styles.badge} testID="mercadopago-connected">
            <Ionicons color={colors.success} name="checkmark-circle-outline" size={15} />
            <Text style={styles.badgeText}>Conectado</Text>
          </View>
        )}
      </View>

      {isLoading ? (
        <Text style={styles.body}>Carregando…</Text>
      ) : isConnected ? (
        <>
          <Text style={styles.body}>
            {status?.account_email
              ? `Recebendo na conta ${status.account_email}.`
              : "Sua conta está conectada e pronta para receber."}
          </Text>

          {status?.live_mode === false && (
            <Warning testID="mercadopago-sandbox">
              Conta de teste. Nenhum pagamento aqui é dinheiro real — troque as credenciais para
              produção quando terminar de validar.
            </Warning>
          )}

          {status?.needs_reconnect && (
            <Warning testID="mercadopago-expired">
              A autorização venceu. Reconecte para voltar a receber pagamentos pelo app.
            </Warning>
          )}

          <View style={styles.actions}>
            <Action
              accessibilityLabel="Reconectar conta do Mercado Pago"
              disabled={isBusy}
              label="Reconectar"
              onPress={() => void connect()}
              testID="mercadopago-reconnect"
            />
            <Action
              accessibilityLabel="Desconectar conta do Mercado Pago"
              danger
              disabled={isBusy}
              label="Desconectar"
              onPress={() => void disconnect()}
              testID="mercadopago-disconnect"
            />
          </View>
        </>
      ) : (
        <>
          <Text style={styles.body}>
            Conecte sua conta para o aluno pagar a mensalidade dentro do app. O dinheiro cai
            direto na sua conta do Mercado Pago — a FitBlock não fica com ele no caminho.
          </Text>

          <View style={styles.actions}>
            <Action
              accessibilityLabel="Conectar conta do Mercado Pago"
              disabled={isBusy}
              label={isBusy ? "Abrindo…" : "Conectar Mercado Pago"}
              onPress={() => void connect()}
              primary
              testID="mercadopago-connect"
            />
          </View>
        </>
      )}

      {errorMessage && (
        <Text accessibilityRole="alert" style={styles.error} testID="mercadopago-error">
          {errorMessage}
        </Text>
      )}
    </View>
  );
}

function Warning({ children, testID }: { children: string; testID: string }) {
  return (
    <View style={styles.warning} testID={testID}>
      <Ionicons color={colors.warning} name="alert-circle-outline" size={15} />
      <Text style={styles.warningText}>{children}</Text>
    </View>
  );
}

function Action({
  label,
  accessibilityLabel,
  testID,
  primary = false,
  danger = false,
  disabled = false,
  onPress
}: {
  label: string;
  accessibilityLabel: string;
  testID: string;
  primary?: boolean;
  danger?: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onBlur={() => setIsFocused(false)}
      onFocus={() => setIsFocused(true)}
      onPress={onPress}
      style={({ pressed }) => [
        styles.action,
        primary && styles.actionPrimary,
        danger && styles.actionDanger,
        disabled && styles.disabled,
        isFocused && styles.focusRing,
        pressed && styles.pressed
      ]}
      testID={testID}
    >
      <Text
        style={[
          styles.actionText,
          primary && styles.actionTextPrimary,
          danger && styles.actionTextDanger
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface02,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: spacing[3],
    padding: spacing[5]
  },
  header: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: spacing[3],
    justifyContent: "space-between"
  },
  headerCopy: { flex: 1, gap: 2, minWidth: 0 },
  eyebrow: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.interfaceSemiBold,
    fontSize: 11,
    letterSpacing: 1.4
  },
  title: {
    color: colors.textPrimary,
    fontFamily: fontFamilies.interfaceBold,
    fontSize: 17
  },
  badge: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[1]
  },
  badgeText: {
    color: colors.success,
    fontFamily: fontFamilies.interfaceBold,
    fontSize: 12
  },
  body: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.interface,
    fontSize: 13,
    lineHeight: 19
  },
  warning: {
    alignItems: "flex-start",
    backgroundColor: colors.surface01,
    borderColor: colors.warning,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing[2],
    padding: spacing[3]
  },
  warningText: {
    color: colors.textPrimary,
    flex: 1,
    fontFamily: fontFamilies.interface,
    fontSize: 12,
    lineHeight: 18
  },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing[2]
  },
  action: {
    alignItems: "center",
    borderColor: colors.border,
    borderRadius: radius.pill,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: spacing[4]
  },
  actionPrimary: {
    backgroundColor: colors.purple500,
    borderColor: colors.purple500
  },
  actionDanger: { borderColor: colors.danger },
  actionText: {
    color: colors.textPrimary,
    fontFamily: fontFamilies.interfaceBold,
    fontSize: 13
  },
  actionTextPrimary: { color: colors.white },
  actionTextDanger: { color: colors.danger },
  error: {
    color: colors.danger,
    fontFamily: fontFamilies.interface,
    fontSize: 12,
    lineHeight: 18
  },
  disabled: { opacity: 0.45 },
  focusRing: {
    borderColor: colors.purple400,
    borderWidth: 2
  },
  pressed: { opacity: 0.72 }
});
