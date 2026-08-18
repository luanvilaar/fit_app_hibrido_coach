import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import {
  createStoreRepository,
  type StoreOrderRecord,
  type TrainingProgramRecord
} from "@fitblock/backend";
import { colors, fontFamilies, radius, spacing, typeScale } from "@fitblock/design-tokens";
import { describeBackendError } from "@/data/backend-error";
import { describeProgramDayType } from "@/data/program-builder";
import { formatBRL } from "@/data/finance/money";
import { getSupabaseConfigurationError, supabase } from "@/lib/supabase";

export function MyTrainingProgramsScreen() {
  const { width } = useWindowDimensions();
  const isNarrow = width < 860;
  const [programs, setPrograms] = useState<TrainingProgramRecord[]>([]);
  const [orders, setOrders] = useState<StoreOrderRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    const client = supabase;
    if (!client) {
      setErrorMessage(getSupabaseConfigurationError() ?? "Seus treinos estão indisponíveis.");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const repository = createStoreRepository(client);
      const [nextPrograms, nextOrders] = await Promise.all([
        repository.listMyTrainingPrograms(),
        repository.listMyOrders()
      ]);
      setPrograms(nextPrograms);
      setOrders(nextOrders);
      setErrorMessage(null);
    } catch (error: unknown) {
      setErrorMessage(describeBackendError(error));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <View style={styles.page} testID="my-training-programs-screen">
      <View style={[styles.intro, isNarrow && styles.introNarrow]}>
        <View style={styles.introCopy}>
          <Text style={styles.eyebrow}>ÁREA DO ATLETA</Text>
          <Text style={styles.heading}>Meus treinos.</Text>
          <Text style={styles.lede}>
            Seus programas liberados ficam aqui, com cada sessão organizada para você seguir o processo.
          </Text>
        </View>
        <View style={styles.introMark}>
          <Ionicons color={colors.purple400} name="barbell-outline" size={27} />
          <Text style={styles.introMarkText}>TREINO{`\n`}COM DIREÇÃO</Text>
        </View>
      </View>

      {errorMessage && <Message text={errorMessage} tone="error" />}

      {isLoading ? (
        <Text style={styles.muted}>Carregando seus programas…</Text>
      ) : programs.length === 0 ? (
        <View style={styles.empty} testID="my-training-programs-empty">
          <Ionicons color={colors.purple400} name="sparkles-outline" size={25} />
          <Text style={styles.emptyTitle}>Seu próximo ciclo começa na Loja.</Text>
          <Text style={styles.emptyText}>
            Quando um pagamento for confirmado, o programa aparece automaticamente nesta área.
          </Text>
        </View>
      ) : (
        <View style={styles.programList}>
          {programs.map((program) => <ProgramCard key={program.access_id} program={program} />)}
        </View>
      )}

      {!isLoading && orders.length > 0 && (
        <View style={styles.ordersSection} testID="my-training-orders">
          <Text style={styles.sectionEyebrow}>HISTÓRICO DE PEDIDOS</Text>
          {orders.map((order) => <OrderRow key={order.order_id} order={order} />)}
        </View>
      )}
    </View>
  );
}

function ProgramCard({ program }: { program: TrainingProgramRecord }) {
  const router = useRouter();
  return (
    <View style={styles.programCard} testID={`training-program-${program.product_id}`}>
      <View style={styles.programHeader}>
        <View style={styles.programHeaderCopy}>
          <Text style={styles.programEyebrow}>PROGRAMA LIBERADO</Text>
          <Text style={styles.programTitle}>{program.title}</Text>
          <Text style={styles.programCoach}>por {program.seller_display_name}</Text>
        </View>
        <View style={styles.programBadge}>
          <Ionicons color={colors.success} name="checkmark-circle" size={18} />
          <Text style={styles.programBadgeText}>ATIVO</Text>
        </View>
      </View>

      <View style={styles.programFacts}>
        <Fact icon="calendar-outline" label={`${program.duration_weeks} semanas`} />
        <Fact icon="list-outline" label={`${program.sessions.length} ${program.sessions.length === 1 ? "sessão" : "sessões"}`} />
        <Fact icon="time-outline" label={`Liberado em ${formatDate(program.granted_at)}`} />
      </View>

      <View style={styles.sessions}>
        <Text style={styles.sessionsTitle}>SESSÕES DO PROGRAMA</Text>
        {program.sessions.length === 0 ? (
          <Text style={styles.helperText}>O coach ainda não adicionou sessões a este programa.</Text>
        ) : (
          program.sessions.map((session) => {
            const dayType = session.day_type ?? "training";
            const canStart = dayType === "training" && Boolean(session.session_instance_id);
            return (
            <Pressable
              key={session.id}
              accessibilityRole={canStart ? "button" : undefined}
              accessibilityLabel={canStart ? `Iniciar ${session.title}` : `${session.title}, ${describeProgramDayType(dayType)}`}
              disabled={!canStart}
              onPress={() => session.session_instance_id && router.push(`/app/treino?sessionId=${session.session_instance_id}`)}
              style={({ pressed }) => [styles.sessionRow, pressed && styles.pressed]}
            >
              <View style={styles.sessionPosition}>
                <Text style={styles.sessionNumber}>S{session.week_number} · D{session.day_number}</Text>
                {session.scheduled_date && <Text style={styles.sessionDate}>{formatScheduledDate(session.scheduled_date)}</Text>}
              </View>
              <Text style={styles.sessionTitle}>{session.title}</Text>
              <Ionicons color={canStart ? colors.success : colors.textSecondary} name={canStart ? "play-circle-outline" : "calendar-outline"} size={16} />
            </Pressable>
            );
          })
        )}
      </View>
    </View>
  );
}

function Fact({ icon, label }: { icon: keyof typeof Ionicons.glyphMap; label: string }) {
  return (
    <View style={styles.fact}>
      <Ionicons color={colors.purple400} name={icon} size={16} />
      <Text style={styles.factText}>{label}</Text>
    </View>
  );
}

function OrderRow({ order }: { order: StoreOrderRecord }) {
  const paid = order.status === "paid";
  return (
    <View style={styles.orderRow}>
      <View style={styles.orderCopy}>
        <Text style={styles.orderTitle}>{order.product_title}</Text>
        <Text style={styles.orderMeta}>{formatDate(order.created_at)} · {formatBRL(order.total_amount_cents)}</Text>
      </View>
      <Text style={[styles.orderStatus, paid ? styles.orderStatusPaid : styles.orderStatusPending]}>
        {paid ? "Pago" : order.status === "pending" ? "Aguardando PIX" : "Cancelado"}
      </Text>
    </View>
  );
}

function Message({ text, tone }: { text: string; tone: "error" | "success" }) {
  const isError = tone === "error";
  return (
    <View accessibilityRole="alert" style={[styles.message, isError ? styles.messageError : styles.messageSuccess]}>
      <Ionicons color={isError ? colors.danger : colors.success} name={isError ? "alert-circle-outline" : "checkmark-circle-outline"} size={18} />
      <Text style={styles.messageText}>{text}</Text>
    </View>
  );
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "data não informada";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium" }).format(date);
}

function formatScheduledDate(value: string): string {
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("pt-BR", { weekday: "short", day: "2-digit", month: "short" }).format(date);
}

const styles = StyleSheet.create({
  page: { gap: spacing[5] },
  intro: { alignItems: "flex-end", flexDirection: "row", gap: spacing[5], justifyContent: "space-between" },
  introNarrow: { alignItems: "flex-start", flexDirection: "column" },
  introCopy: { flex: 1, gap: spacing[2] },
  eyebrow: { color: colors.purple400, fontFamily: fontFamilies.interfaceBold, fontSize: 11, letterSpacing: 1.4 },
  heading: { color: colors.textPrimary, fontFamily: fontFamilies.display, fontSize: typeScale.displaySection, lineHeight: typeScale.displaySection },
  lede: { color: colors.textSecondary, fontFamily: fontFamilies.interface, fontSize: 16, lineHeight: 24, maxWidth: 650 },
  introMark: { alignItems: "flex-end", borderLeftColor: colors.borderPurple, borderLeftWidth: 1, gap: spacing[2], paddingLeft: spacing[4] },
  introMarkText: { color: colors.textSecondary, fontFamily: fontFamilies.interfaceBold, fontSize: 10, letterSpacing: 1.2, lineHeight: 14, textAlign: "right" },
  message: { alignItems: "center", borderRadius: radius.lg, borderWidth: 1, flexDirection: "row", gap: spacing[3], padding: spacing[4] },
  messageError: { backgroundColor: colors.surface01, borderColor: colors.danger },
  messageSuccess: { backgroundColor: colors.surface01, borderColor: colors.success },
  messageText: { color: colors.textPrimary, flex: 1, fontFamily: fontFamilies.interface, fontSize: 14, lineHeight: 21 },
  programList: { gap: spacing[4] },
  programCard: { backgroundColor: colors.surface02, borderColor: colors.border, borderRadius: radius.xl, borderWidth: 1, gap: spacing[5], padding: spacing[5] },
  programHeader: { alignItems: "flex-start", flexDirection: "row", gap: spacing[4], justifyContent: "space-between" },
  programHeaderCopy: { flex: 1, gap: spacing[2] },
  programEyebrow: { color: colors.purple400, fontFamily: fontFamilies.interfaceBold, fontSize: 10, letterSpacing: 1.2 },
  programTitle: { color: colors.textPrimary, fontFamily: fontFamilies.display, fontSize: 29, lineHeight: 32 },
  programCoach: { color: colors.textSecondary, fontFamily: fontFamilies.interface, fontSize: 13 },
  programBadge: { alignItems: "center", borderColor: colors.success, borderRadius: radius.pill, borderWidth: 1, flexDirection: "row", gap: spacing[2], minHeight: 36, paddingHorizontal: spacing[3] },
  programBadgeText: { color: colors.success, fontFamily: fontFamilies.interfaceBold, fontSize: 10, letterSpacing: 1 },
  programFacts: { flexDirection: "row", flexWrap: "wrap", gap: spacing[4] },
  fact: { alignItems: "center", flexDirection: "row", gap: spacing[2] },
  factText: { color: colors.textSecondary, fontFamily: fontFamilies.interface, fontSize: 13 },
  sessions: { borderTopColor: colors.border, borderTopWidth: 1, gap: spacing[3], paddingTop: spacing[4] },
  sessionsTitle: { color: colors.textSecondary, fontFamily: fontFamilies.interfaceBold, fontSize: 10, letterSpacing: 1.1 },
  sessionRow: { alignItems: "center", borderBottomColor: colors.border, borderBottomWidth: 1, flexDirection: "row", gap: spacing[3], minHeight: 48, paddingVertical: spacing[2] },
  sessionPosition: { gap: 2, width: 94 },
  sessionNumber: { color: colors.purple400, fontFamily: fontFamilies.interfaceBold, fontSize: 11 },
  sessionDate: { color: colors.textSecondary, fontFamily: fontFamilies.interface, fontSize: 10 },
  sessionTitle: { color: colors.textPrimary, flex: 1, fontFamily: fontFamilies.interface, fontSize: 14 },
  pressed: { opacity: 0.8 },
  helperText: { color: colors.textSecondary, fontFamily: fontFamilies.interface, fontSize: 13, lineHeight: 20 },
  ordersSection: { gap: spacing[3], marginTop: spacing[3] },
  sectionEyebrow: { color: colors.textSecondary, fontFamily: fontFamilies.interfaceBold, fontSize: 10, letterSpacing: 1.2 },
  orderRow: { alignItems: "center", borderBottomColor: colors.border, borderBottomWidth: 1, flexDirection: "row", gap: spacing[3], justifyContent: "space-between", minHeight: 58 },
  orderCopy: { flex: 1, gap: spacing[1] },
  orderTitle: { color: colors.textPrimary, fontFamily: fontFamilies.interfaceBold, fontSize: 14 },
  orderMeta: { color: colors.textSecondary, fontFamily: fontFamilies.interface, fontSize: 12 },
  orderStatus: { fontFamily: fontFamilies.interfaceBold, fontSize: 12 },
  orderStatusPaid: { color: colors.success },
  orderStatusPending: { color: colors.warning },
  empty: { alignItems: "flex-start", backgroundColor: colors.surface02, borderColor: colors.border, borderRadius: radius.xl, borderWidth: 1, gap: spacing[3], padding: spacing[7] },
  emptyTitle: { color: colors.textPrimary, fontFamily: fontFamilies.display, fontSize: 27 },
  emptyText: { color: colors.textSecondary, fontFamily: fontFamilies.interface, fontSize: 15, lineHeight: 22, maxWidth: 570 },
  muted: { color: colors.textSecondary, fontFamily: fontFamilies.interface, fontSize: 14 }
});
