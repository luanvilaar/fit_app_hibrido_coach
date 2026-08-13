import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions
} from "react-native";
import type {
  BillingRosterRecord,
  CoachChargeRecord,
  ChargePaymentMethod,
  FinanceSummaryRecord
} from "@fitblock/backend";
import { createBillingRepository } from "@fitblock/backend";
import { colors, fontFamilies, radius, spacing, typeScale } from "@fitblock/design-tokens";
import { describeBackendError } from "@/data/backend-error";
import {
  chargeFilterOptions,
  chargeTone,
  describeChargeStatus,
  describeDueDate,
  describePaymentMethod,
  describeReferenceMonth,
  filterCharges,
  manualPaymentMethodOptions,
  referenceMonthOf,
  shiftReferenceMonth,
  type ChargeFilter,
  type ChargeTone
} from "@/data/finance/charges";
import { MoneyParseError, formatAmountInput, formatBRL, parseBRL } from "@/data/finance/money";
import { Chip } from "@/components/coach-hibrido/block-fields";
import { MercadoPagoConnectionCard } from "@/components/coach/mercadopago-connection-card";
import { Dialog, DialogActions, DialogButton } from "@/components/ui/dialog";
import { getSupabaseConfigurationError, supabase } from "@/lib/supabase";

type BillingRepository = ReturnType<typeof createBillingRepository>;

type FinanceView = "charges" | "plans" | "settings";

/** O diálogo aberto no momento; um de cada vez, porque todos confirmam dinheiro. */
type ActiveDialog =
  | { kind: "payment"; charge: CoachChargeRecord }
  | { kind: "forgive"; charge: CoachChargeRecord }
  | { kind: "plan"; athlete: BillingRosterRecord }
  | null;

export function FinanceScreen() {
  const { width } = useWindowDimensions();
  const isNarrow = width < 900;

  const [view, setView] = useState<FinanceView>("charges");
  const [referenceMonth, setReferenceMonth] = useState(() => referenceMonthOf(new Date()));

  const [charges, setCharges] = useState<CoachChargeRecord[]>([]);
  const [summary, setSummary] = useState<FinanceSummaryRecord | null>(null);
  const [roster, setRoster] = useState<BillingRosterRecord[]>([]);

  const [filter, setFilter] = useState<ChargeFilter>("all");
  const [search, setSearch] = useState("");

  const [dialog, setDialog] = useState<ActiveDialog>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const load = useCallback(async (month: string) => {
    if (!supabase) {
      setIsLoading(false);
      setErrorMessage(getSupabaseConfigurationError() ?? "Financeiro indisponível.");
      return;
    }

    const repository = createBillingRepository(supabase);

    const [nextCharges, nextSummary, nextRoster] = await Promise.all([
      repository.listCoachCharges(month),
      repository.getFinanceSummary(month),
      repository.listBillingRoster()
    ]);

    setCharges(nextCharges);
    setSummary(nextSummary);
    setRoster(nextRoster);
  }, []);

  useEffect(() => {
    let mounted = true;

    setIsLoading(true);
    setErrorMessage(null);

    void load(referenceMonth)
      .catch((error: unknown) => {
        if (!mounted) return;
        setErrorMessage(describeBackendError(error));
      })
      .finally(() => {
        if (mounted) setIsLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [load, referenceMonth]);

  /**
   * Toda escrita termina relendo a competência: o saldo é derivado no banco, e recalcular na
   * memória do cliente seria uma segunda aritmética para divergir da primeira.
   */
  async function runOperation(
    operation: (repository: BillingRepository) => Promise<string>
  ) {
    if (!supabase || isSaving) return;

    setIsSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const message = await operation(createBillingRepository(supabase));
      await load(referenceMonth);
      setDialog(null);
      setSuccessMessage(message);
    } catch (error: unknown) {
      setErrorMessage(describeBackendError(error));
    } finally {
      setIsSaving(false);
    }
  }

  function generateCharges() {
    void runOperation(async (repository) => {
      const result = await repository.generateMonthCharges(referenceMonth);

      if (result.created === 0) {
        return `Nada a gerar — as ${result.skipped} cobranças de ${describeReferenceMonth(referenceMonth)} já existiam.`;
      }

      return result.skipped > 0
        ? `${result.created} cobranças criadas. ${result.skipped} já existiam.`
        : `${result.created} cobranças criadas para ${describeReferenceMonth(referenceMonth)}.`;
    });
  }

  const visibleCharges = filterCharges(charges, filter, search);

  // Estreitado uma vez: os handlers abaixo não precisam reabrir a união para achar o alvo.
  const paymentCharge = dialog?.kind === "payment" ? dialog.charge : null;
  const forgiveCharge = dialog?.kind === "forgive" ? dialog.charge : null;
  const planAthlete = dialog?.kind === "plan" ? dialog.athlete : null;

  return (
    <View style={styles.page} testID="finance-screen">
      <View style={[styles.headline, isNarrow && styles.headlineStacked]}>
        <View style={styles.headlineCopy}>
          <Text style={styles.eyebrow}>FINANCEIRO</Text>
          <Text style={styles.title}>Mensalidades e recebimentos</Text>
        </View>

        {/* Competência não diz nada na aba de recebimento: a conexão não é mensal. */}
        {view !== "settings" && (
          <MonthStepper
            referenceMonth={referenceMonth}
            onChange={(next) => {
              setSuccessMessage(null);
              setReferenceMonth(next);
            }}
          />
        )}
      </View>

      <View style={styles.viewSwitch}>
        <Chip
          label="Cobranças"
          onPress={() => setView("charges")}
          selected={view === "charges"}
          testID="finance-view-charges"
        />
        <Chip
          label="Mensalidades"
          onPress={() => setView("plans")}
          selected={view === "plans"}
          testID="finance-view-plans"
        />
        <Chip
          label="Recebimento"
          onPress={() => setView("settings")}
          selected={view === "settings"}
          testID="finance-view-settings"
        />
      </View>

      {errorMessage && <Banner testID="finance-error" text={errorMessage} tone="error" />}
      {successMessage && <Banner testID="finance-success" text={successMessage} tone="success" />}

      {view === "settings" ? (
        <MercadoPagoConnectionCard />
      ) : isLoading ? (
        <Text style={styles.muted}>Carregando…</Text>
      ) : view === "charges" ? (
        <>
          <SummaryCards isNarrow={isNarrow} summary={summary} />

          <View style={styles.toolbar}>
            <View style={styles.filters}>
              {chargeFilterOptions.map((option) => (
                <Chip
                  key={option.value}
                  label={option.label}
                  onPress={() => setFilter(option.value)}
                  selected={filter === option.value}
                  testID={`finance-filter-${option.value}`}
                />
              ))}
            </View>

            <TextInput
              accessibilityLabel="Buscar aluno"
              onChangeText={setSearch}
              placeholder="Buscar aluno"
              placeholderTextColor={colors.textSecondary}
              style={styles.search}
              testID="finance-search"
              value={search}
            />
          </View>

          {charges.length === 0 ? (
            <EmptyCharges
              isSaving={isSaving}
              hasPlans={roster.some((entry) => entry.plan_id !== null)}
              referenceMonth={referenceMonth}
              onGenerate={generateCharges}
              onOpenPlans={() => setView("plans")}
            />
          ) : (
            <>
              <View style={styles.listActions}>
                <Text style={styles.listCount} testID="finance-count">
                  {visibleCharges.length} de {charges.length}{" "}
                  {charges.length === 1 ? "cobrança" : "cobranças"}
                </Text>
                <ActionButton
                  accessibilityLabel={`Gerar cobranças de ${describeReferenceMonth(referenceMonth)}`}
                  disabled={isSaving}
                  icon="repeat-outline"
                  label="Gerar cobranças do mês"
                  onPress={generateCharges}
                  testID="finance-generate"
                />
              </View>

              {visibleCharges.length === 0 ? (
                <Text style={styles.muted} testID="finance-no-results">
                  Nenhuma cobrança com esse filtro. Ajuste a busca ou volte para “Todas”.
                </Text>
              ) : (
                <View style={styles.list}>
                  {visibleCharges.map((charge) => (
                    <ChargeRow
                      charge={charge}
                      isNarrow={isNarrow}
                      key={charge.id}
                      onForgive={() => setDialog({ kind: "forgive", charge })}
                      onRegisterPayment={() => setDialog({ kind: "payment", charge })}
                    />
                  ))}
                </View>
              )}
            </>
          )}
        </>
      ) : (
        <PlansSection
          isNarrow={isNarrow}
          roster={roster}
          onEdit={(athlete) => setDialog({ kind: "plan", athlete })}
        />
      )}

      <ManualPaymentDialog
        charge={paymentCharge}
        isSaving={isSaving}
        onDismiss={() => setDialog(null)}
        onSubmit={(amountCents, method, notes) => {
          if (!paymentCharge) return;

          void runOperation(async (repository) => {
            await repository.registerManualPayment({
              chargeId: paymentCharge.id,
              amountCents,
              paymentMethod: method,
              notes
            });

            return `Recebimento de ${formatBRL(amountCents)} registrado.`;
          });
        }}
      />

      <ForgiveDebtDialog
        charge={forgiveCharge}
        isSaving={isSaving}
        onDismiss={() => setDialog(null)}
        onSubmit={(amountCents, reason) => {
          if (!forgiveCharge) return;

          void runOperation(async (repository) => {
            await repository.forgiveCharge({ chargeId: forgiveCharge.id, amountCents, reason });

            return `${formatBRL(amountCents)} perdoados. O valor não entra no faturamento.`;
          });
        }}
      />

      <BillingPlanDialog
        athlete={planAthlete}
        isSaving={isSaving}
        onDismiss={() => setDialog(null)}
        onSubmit={(amountCents, dueDay, description) => {
          if (!planAthlete) return;

          void runOperation(async (repository) => {
            await repository.upsertBillingPlan({
              athleteId: planAthlete.athlete_id,
              teamId: planAthlete.team_id,
              amountCents,
              dueDay,
              description
            });

            return `Mensalidade de ${planAthlete.athlete_display_name} definida em ${formatBRL(amountCents)}.`;
          });
        }}
      />
    </View>
  );
}

function MonthStepper({
  referenceMonth,
  onChange
}: {
  referenceMonth: string;
  onChange: (next: string) => void;
}) {
  return (
    <View style={styles.monthStepper}>
      <StepperButton
        accessibilityLabel="Mês anterior"
        icon="chevron-back"
        onPress={() => onChange(shiftReferenceMonth(referenceMonth, -1))}
        testID="finance-month-previous"
      />
      <Text style={styles.monthLabel} testID="finance-month">
        {describeReferenceMonth(referenceMonth)}
      </Text>
      <StepperButton
        accessibilityLabel="Próximo mês"
        icon="chevron-forward"
        onPress={() => onChange(shiftReferenceMonth(referenceMonth, 1))}
        testID="finance-month-next"
      />
    </View>
  );
}

function SummaryCards({
  summary,
  isNarrow
}: {
  summary: FinanceSummaryRecord | null;
  isNarrow: boolean;
}) {
  if (!summary) return null;

  const cards = [
    { label: "Recebido", value: formatBRL(summary.received_cents), testID: "summary-received" },
    { label: "A receber", value: formatBRL(summary.outstanding_cents), testID: "summary-outstanding" },
    { label: "Em atraso", value: formatBRL(summary.overdue_cents), testID: "summary-overdue" },
    {
      label: summary.overdue_count === 1 ? "Aluno em atraso" : "Alunos em atraso",
      value: String(summary.overdue_count),
      testID: "summary-overdue-count"
    }
  ];

  return (
    <View style={[styles.summaryRow, isNarrow && styles.summaryRowStacked]}>
      {cards.map((card) => (
        <View key={card.testID} style={styles.summaryCard} testID={card.testID}>
          <Text style={styles.summaryLabel}>{card.label}</Text>
          <Text style={styles.summaryValue}>{card.value}</Text>
        </View>
      ))}
    </View>
  );
}

const toneIcons: Record<ChargeTone, React.ComponentProps<typeof Ionicons>["name"]> = {
  positive: "checkmark-circle-outline",
  danger: "alert-circle-outline",
  warning: "time-outline",
  muted: "remove-circle-outline",
  neutral: "ellipse-outline"
};

const toneColors: Record<ChargeTone, string> = {
  positive: colors.success,
  danger: colors.danger,
  warning: colors.warning,
  muted: colors.textSecondary,
  neutral: colors.textSecondary
};

function ChargeRow({
  charge,
  isNarrow,
  onRegisterPayment,
  onForgive
}: {
  charge: CoachChargeRecord;
  isNarrow: boolean;
  onRegisterPayment: () => void;
  onForgive: () => void;
}) {
  const tone = chargeTone(charge);
  const isSettled = charge.outstanding_amount_cents === 0 || charge.status === "cancelled";

  return (
    <View style={[styles.row, isNarrow && styles.rowStacked]} testID={`charge-${charge.id}`}>
      <View style={styles.rowIdentity}>
        <Text style={styles.rowName}>{charge.athlete_display_name}</Text>
        <Text style={styles.rowMeta}>
          {charge.description} · vence {describeDueDate(charge.due_date)}
        </Text>
      </View>

      <View style={styles.rowAmounts}>
        <Text style={styles.rowAmount}>{formatBRL(charge.original_amount_cents)}</Text>
        {charge.paid_amount_cents > 0 && charge.outstanding_amount_cents > 0 && (
          <Text style={styles.rowMeta} testID={`charge-${charge.id}-partial`}>
            {formatBRL(charge.paid_amount_cents)} recebidos · falta{" "}
            {formatBRL(charge.outstanding_amount_cents)}
          </Text>
        )}
        {charge.last_payment_method && charge.outstanding_amount_cents === 0 && (
          <Text style={styles.rowMeta}>{describePaymentMethod(charge.last_payment_method)}</Text>
        )}
      </View>

      {/* Ícone e texto acompanham a cor: o selo precisa se sustentar em preto e branco. */}
      <View style={styles.rowStatus} testID={`charge-${charge.id}-status`}>
        <Ionicons color={toneColors[tone]} name={toneIcons[tone]} size={15} />
        <Text style={[styles.rowStatusText, { color: toneColors[tone] }]}>
          {describeChargeStatus(charge)}
        </Text>
      </View>

      <View style={styles.rowActions}>
        {!isSettled && (
          <>
            <ActionButton
              accessibilityLabel={`Registrar pagamento de ${charge.athlete_display_name}`}
              icon="cash-outline"
              label="Registrar"
              onPress={onRegisterPayment}
              testID={`charge-${charge.id}-pay`}
            />
            <ActionButton
              accessibilityLabel={`Perdoar dívida de ${charge.athlete_display_name}`}
              icon="heart-outline"
              label="Perdoar"
              onPress={onForgive}
              testID={`charge-${charge.id}-forgive`}
            />
          </>
        )}
      </View>
    </View>
  );
}

function PlansSection({
  roster,
  isNarrow,
  onEdit
}: {
  roster: BillingRosterRecord[];
  isNarrow: boolean;
  onEdit: (athlete: BillingRosterRecord) => void;
}) {
  if (roster.length === 0) {
    return (
      <Text style={styles.muted} testID="finance-no-athletes">
        Nenhum aluno nas suas equipes ainda. Adicione atletas em Equipes para definir mensalidades.
      </Text>
    );
  }

  return (
    <View style={styles.list} testID="finance-plans">
      {roster.map((athlete) => (
        <View
          key={athlete.athlete_id}
          style={[styles.row, isNarrow && styles.rowStacked]}
          testID={`plan-${athlete.athlete_id}`}
        >
          <View style={styles.rowIdentity}>
            <Text style={styles.rowName}>{athlete.athlete_display_name}</Text>
            <Text style={styles.rowMeta}>{athlete.team_name}</Text>
          </View>

          <View style={styles.rowAmounts}>
            {athlete.plan_id ? (
              <>
                <Text style={styles.rowAmount}>{formatBRL(athlete.amount_cents ?? 0)}</Text>
                <Text style={styles.rowMeta}>vence dia {athlete.due_day}</Text>
              </>
            ) : (
              <Text style={styles.rowMeta} testID={`plan-${athlete.athlete_id}-empty`}>
                Sem mensalidade definida
              </Text>
            )}
          </View>

          <View style={styles.rowActions}>
            <ActionButton
              accessibilityLabel={`${athlete.plan_id ? "Editar" : "Definir"} mensalidade de ${athlete.athlete_display_name}`}
              icon={athlete.plan_id ? "create-outline" : "add-circle-outline"}
              label={athlete.plan_id ? "Editar" : "Definir"}
              onPress={() => onEdit(athlete)}
              testID={`plan-${athlete.athlete_id}-edit`}
            />
          </View>
        </View>
      ))}
    </View>
  );
}

function EmptyCharges({
  hasPlans,
  referenceMonth,
  isSaving,
  onGenerate,
  onOpenPlans
}: {
  hasPlans: boolean;
  referenceMonth: string;
  isSaving: boolean;
  onGenerate: () => void;
  onOpenPlans: () => void;
}) {
  return (
    <View style={styles.empty} testID="finance-empty">
      <Text style={styles.emptyTitle}>
        Nenhuma cobrança em {describeReferenceMonth(referenceMonth)}.
      </Text>
      <Text style={styles.emptyText}>
        {hasPlans
          ? "Os planos já estão definidos — gere as cobranças desta competência para começar a acompanhar."
          : "Primeiro defina quanto cada aluno paga em Mensalidades. Depois volte aqui e gere o mês."}
      </Text>

      {hasPlans ? (
        <ActionButton
          accessibilityLabel={`Gerar cobranças de ${describeReferenceMonth(referenceMonth)}`}
          disabled={isSaving}
          icon="repeat-outline"
          label="Gerar cobranças do mês"
          onPress={onGenerate}
          testID="finance-generate"
        />
      ) : (
        <ActionButton
          accessibilityLabel="Definir mensalidades dos alunos"
          icon="pricetag-outline"
          label="Definir mensalidades"
          onPress={onOpenPlans}
          testID="finance-open-plans"
        />
      )}
    </View>
  );
}

function ManualPaymentDialog({
  charge,
  isSaving,
  onDismiss,
  onSubmit
}: {
  charge: CoachChargeRecord | null;
  isSaving: boolean;
  onDismiss: () => void;
  onSubmit: (amountCents: number, method: ChargePaymentMethod, notes: string | null) => void;
}) {
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<ChargePaymentMethod>("pix");
  const [notes, setNotes] = useState("");
  const [validation, setValidation] = useState<string | null>(null);

  // Reabrir para outra cobrança precisa começar limpo, com o saldo dela já preenchido: o caso
  // comum é receber o valor cheio, e redigitar o que o sistema já sabe é só chance de errar.
  useEffect(() => {
    if (!charge) return;
    setAmount(formatAmountInput(charge.outstanding_amount_cents));
    setMethod("pix");
    setNotes("");
    setValidation(null);
  }, [charge]);

  function submit() {
    if (!charge) return;

    let amountCents: number;

    try {
      amountCents = parseBRL(amount);
    } catch (error: unknown) {
      setValidation(error instanceof MoneyParseError ? error.message : "Valor inválido.");
      return;
    }

    if (amountCents > charge.outstanding_amount_cents) {
      setValidation(
        `O saldo em aberto é ${formatBRL(charge.outstanding_amount_cents)}. Registre no máximo esse valor.`
      );
      return;
    }

    setValidation(null);
    onSubmit(amountCents, method, notes.trim() || null);
  }

  return (
    <Dialog
      description={
        charge
          ? `${charge.athlete_display_name} · saldo em aberto de ${formatBRL(charge.outstanding_amount_cents)}`
          : undefined
      }
      onDismiss={onDismiss}
      testID="payment-dialog"
      title="Registrar pagamento"
      visible={charge !== null}
    >
      <Text style={styles.fieldLabel}>Valor recebido</Text>
      <TextInput
        accessibilityLabel="Valor recebido"
        autoFocus
        inputMode="decimal"
        onChangeText={(next) => {
          setAmount(next);
          setValidation(null);
        }}
        placeholder="300,00"
        placeholderTextColor={colors.textSecondary}
        style={styles.fieldInput}
        testID="payment-amount"
        value={amount}
      />

      <Text style={styles.fieldLabel}>Forma de pagamento</Text>
      <View accessibilityRole="radiogroup" style={styles.fieldChips}>
        {manualPaymentMethodOptions.map((option) => (
          <Chip
            key={option.value}
            label={option.label}
            onPress={() => setMethod(option.value)}
            selected={option.value === method}
            testID={`payment-method-${option.value}`}
          />
        ))}
      </View>

      <Text style={styles.fieldLabel}>Observação</Text>
      <TextInput
        accessibilityLabel="Observação sobre o pagamento"
        onChangeText={setNotes}
        placeholder="Opcional"
        placeholderTextColor={colors.textSecondary}
        style={styles.fieldInput}
        testID="payment-notes"
        value={notes}
      />

      {validation && (
        <Text style={styles.fieldError} testID="payment-validation">
          {validation}
        </Text>
      )}

      <DialogActions>
        <DialogButton label="Cancelar" onPress={onDismiss} testID="payment-cancel" />
        <DialogButton
          disabled={isSaving}
          label={isSaving ? "Registrando…" : "Confirmar recebimento"}
          onPress={submit}
          testID="payment-submit"
          tone="primary"
        />
      </DialogActions>
    </Dialog>
  );
}

function ForgiveDebtDialog({
  charge,
  isSaving,
  onDismiss,
  onSubmit
}: {
  charge: CoachChargeRecord | null;
  isSaving: boolean;
  onDismiss: () => void;
  onSubmit: (amountCents: number, reason: string) => void;
}) {
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [validation, setValidation] = useState<string | null>(null);

  useEffect(() => {
    if (!charge) return;
    setAmount(formatAmountInput(charge.outstanding_amount_cents));
    setReason("");
    setValidation(null);
  }, [charge]);

  function submit() {
    if (!charge) return;

    let amountCents: number;

    try {
      amountCents = parseBRL(amount);
    } catch (error: unknown) {
      setValidation(error instanceof MoneyParseError ? error.message : "Valor inválido.");
      return;
    }

    if (amountCents > charge.outstanding_amount_cents) {
      setValidation(`O saldo em aberto é ${formatBRL(charge.outstanding_amount_cents)}.`);
      return;
    }

    if (reason.trim().length < 3) {
      setValidation("Descreva o motivo do perdão. Ele fica registrado no histórico.");
      return;
    }

    setValidation(null);
    onSubmit(amountCents, reason.trim());
  }

  return (
    <Dialog
      description={
        charge
          ? `${charge.athlete_display_name} · o valor perdoado não entra no faturamento`
          : undefined
      }
      onDismiss={onDismiss}
      testID="forgive-dialog"
      title="Perdoar dívida"
      visible={charge !== null}
    >
      <Text style={styles.fieldLabel}>Valor a perdoar</Text>
      <TextInput
        accessibilityLabel="Valor a perdoar"
        autoFocus
        inputMode="decimal"
        onChangeText={(next) => {
          setAmount(next);
          setValidation(null);
        }}
        placeholder="300,00"
        placeholderTextColor={colors.textSecondary}
        style={styles.fieldInput}
        testID="forgive-amount"
        value={amount}
      />

      <Text style={styles.fieldLabel}>Motivo</Text>
      <TextInput
        accessibilityLabel="Motivo do perdão"
        onChangeText={(next) => {
          setReason(next);
          setValidation(null);
        }}
        placeholder="Ex.: acordo com o aluno"
        placeholderTextColor={colors.textSecondary}
        style={styles.fieldInput}
        testID="forgive-reason"
        value={reason}
      />

      {validation && (
        <Text style={styles.fieldError} testID="forgive-validation">
          {validation}
        </Text>
      )}

      <DialogActions>
        <DialogButton label="Cancelar" onPress={onDismiss} testID="forgive-cancel" />
        <DialogButton
          disabled={isSaving}
          label={isSaving ? "Perdoando…" : "Confirmar perdão"}
          onPress={submit}
          testID="forgive-submit"
          tone="danger"
        />
      </DialogActions>
    </Dialog>
  );
}

function BillingPlanDialog({
  athlete,
  isSaving,
  onDismiss,
  onSubmit
}: {
  athlete: BillingRosterRecord | null;
  isSaving: boolean;
  onDismiss: () => void;
  onSubmit: (amountCents: number, dueDay: number, description: string | null) => void;
}) {
  const [amount, setAmount] = useState("");
  const [dueDay, setDueDay] = useState("10");
  const [description, setDescription] = useState("");
  const [validation, setValidation] = useState<string | null>(null);

  useEffect(() => {
    if (!athlete) return;
    setAmount(athlete.amount_cents === null ? "" : formatAmountInput(athlete.amount_cents));
    setDueDay(String(athlete.due_day ?? 10));
    setDescription(athlete.description ?? "");
    setValidation(null);
  }, [athlete]);

  function submit() {
    let amountCents: number;

    try {
      amountCents = parseBRL(amount);
    } catch (error: unknown) {
      setValidation(error instanceof MoneyParseError ? error.message : "Valor inválido.");
      return;
    }

    const day = Number(dueDay);

    // O limite de 28 é o mesmo da constraint: fevereiro não tem dia 30.
    if (!Number.isInteger(day) || day < 1 || day > 28) {
      setValidation("O dia de vencimento precisa ser um número entre 1 e 28.");
      return;
    }

    setValidation(null);
    onSubmit(amountCents, day, description.trim() || null);
  }

  return (
    <Dialog
      description={athlete ? `${athlete.athlete_display_name} · ${athlete.team_name}` : undefined}
      onDismiss={onDismiss}
      testID="plan-dialog"
      title="Mensalidade do aluno"
      visible={athlete !== null}
    >
      <Text style={styles.fieldLabel}>Valor por mês</Text>
      <TextInput
        accessibilityLabel="Valor da mensalidade"
        autoFocus
        inputMode="decimal"
        onChangeText={(next) => {
          setAmount(next);
          setValidation(null);
        }}
        placeholder="300,00"
        placeholderTextColor={colors.textSecondary}
        style={styles.fieldInput}
        testID="plan-amount"
        value={amount}
      />

      <Text style={styles.fieldLabel}>Dia do vencimento</Text>
      <TextInput
        accessibilityLabel="Dia do vencimento, entre 1 e 28"
        inputMode="numeric"
        onChangeText={(next) => {
          setDueDay(next);
          setValidation(null);
        }}
        placeholder="10"
        placeholderTextColor={colors.textSecondary}
        style={styles.fieldInput}
        testID="plan-due-day"
        value={dueDay}
      />

      <Text style={styles.fieldLabel}>Descrição</Text>
      <TextInput
        accessibilityLabel="Descrição da mensalidade"
        onChangeText={setDescription}
        placeholder="Opcional. Ex.: Plano trimestral"
        placeholderTextColor={colors.textSecondary}
        style={styles.fieldInput}
        testID="plan-description"
        value={description}
      />

      {validation && (
        <Text style={styles.fieldError} testID="plan-validation">
          {validation}
        </Text>
      )}

      <DialogActions>
        <DialogButton label="Cancelar" onPress={onDismiss} testID="plan-cancel" />
        <DialogButton
          disabled={isSaving}
          label={isSaving ? "Salvando…" : "Salvar mensalidade"}
          onPress={submit}
          testID="plan-submit"
          tone="primary"
        />
      </DialogActions>
    </Dialog>
  );
}

function StepperButton({
  accessibilityLabel,
  icon,
  testID,
  onPress
}: {
  accessibilityLabel: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  testID: string;
  onPress: () => void;
}) {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      onBlur={() => setIsFocused(false)}
      onFocus={() => setIsFocused(true)}
      onPress={onPress}
      style={({ pressed }) => [
        styles.stepperButton,
        isFocused && styles.focusRing,
        pressed && styles.pressed
      ]}
      testID={testID}
    >
      <Ionicons color={colors.textPrimary} name={icon} size={17} />
    </Pressable>
  );
}

function ActionButton({
  label,
  icon,
  accessibilityLabel,
  testID,
  disabled = false,
  onPress
}: {
  label: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  accessibilityLabel: string;
  testID: string;
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
        styles.actionButton,
        disabled && styles.disabled,
        isFocused && styles.focusRing,
        pressed && styles.pressed
      ]}
      testID={testID}
    >
      <Ionicons color={colors.textPrimary} name={icon} size={15} />
      <Text style={styles.actionButtonText}>{label}</Text>
    </Pressable>
  );
}

function Banner({
  text,
  tone,
  testID
}: {
  text: string;
  tone: "error" | "success";
  testID: string;
}) {
  return (
    <View
      accessibilityRole="alert"
      style={[styles.banner, tone === "success" && styles.bannerSuccess]}
      testID={testID}
    >
      <Ionicons
        color={tone === "success" ? colors.success : colors.danger}
        name={tone === "success" ? "checkmark-circle-outline" : "alert-circle-outline"}
        size={17}
      />
      <Text style={styles.bannerText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    gap: spacing[5]
  },
  headline: {
    alignItems: "flex-end",
    flexDirection: "row",
    gap: spacing[4],
    justifyContent: "space-between"
  },
  headlineStacked: {
    alignItems: "flex-start",
    flexDirection: "column"
  },
  headlineCopy: { gap: spacing[1] },
  eyebrow: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.interfaceSemiBold,
    fontSize: 11,
    letterSpacing: 1.4
  },
  title: {
    color: colors.textPrimary,
    fontFamily: fontFamilies.display,
    fontSize: typeScale.displaySection
  },
  monthStepper: {
    alignItems: "center",
    backgroundColor: colors.surface01,
    borderColor: colors.border,
    borderRadius: radius.pill,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing[2],
    paddingHorizontal: spacing[2]
  },
  monthLabel: {
    color: colors.textPrimary,
    fontFamily: fontFamilies.interfaceBold,
    fontSize: 13,
    minWidth: 132,
    textAlign: "center"
  },
  stepperButton: {
    alignItems: "center",
    borderRadius: radius.pill,
    height: 44,
    justifyContent: "center",
    width: 44
  },
  viewSwitch: {
    flexDirection: "row",
    gap: spacing[2]
  },
  summaryRow: {
    flexDirection: "row",
    gap: spacing[3]
  },
  summaryRowStacked: {
    flexWrap: "wrap"
  },
  summaryCard: {
    backgroundColor: colors.surface02,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    flexGrow: 1,
    gap: spacing[1],
    minWidth: 150,
    padding: spacing[4]
  },
  summaryLabel: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.interfaceSemiBold,
    fontSize: 11,
    letterSpacing: 0.6,
    textTransform: "uppercase"
  },
  summaryValue: {
    color: colors.textPrimary,
    fontFamily: fontFamilies.displayBold,
    fontSize: 26
  },
  toolbar: {
    gap: spacing[3]
  },
  filters: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing[2]
  },
  search: {
    backgroundColor: colors.surface01,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    color: colors.textPrimary,
    fontFamily: fontFamilies.interface,
    fontSize: 14,
    minHeight: 44,
    paddingHorizontal: spacing[3]
  },
  listActions: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing[3],
    justifyContent: "space-between"
  },
  listCount: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.interface,
    fontSize: 12
  },
  list: {
    gap: spacing[2]
  },
  row: {
    alignItems: "center",
    backgroundColor: colors.surface02,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing[4],
    padding: spacing[4]
  },
  rowStacked: {
    alignItems: "flex-start",
    flexDirection: "column",
    gap: spacing[2]
  },
  rowIdentity: { flex: 2, gap: 2, minWidth: 0 },
  rowName: {
    color: colors.textPrimary,
    fontFamily: fontFamilies.interfaceBold,
    fontSize: 15
  },
  rowMeta: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.interface,
    fontSize: 12
  },
  rowAmounts: { flex: 1, gap: 2, minWidth: 0 },
  rowAmount: {
    color: colors.textPrimary,
    fontFamily: fontFamilies.mono,
    fontSize: 15
  },
  rowStatus: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[1],
    minWidth: 0
  },
  rowStatusText: {
    fontFamily: fontFamilies.interfaceBold,
    fontSize: 12
  },
  rowActions: {
    flexDirection: "row",
    gap: spacing[2]
  },
  actionButton: {
    alignItems: "center",
    borderColor: colors.border,
    borderRadius: radius.pill,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing[2],
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: spacing[3]
  },
  actionButtonText: {
    color: colors.textPrimary,
    fontFamily: fontFamilies.interfaceBold,
    fontSize: 12
  },
  empty: {
    alignItems: "flex-start",
    backgroundColor: colors.surface01,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: spacing[3],
    padding: spacing[5]
  },
  emptyTitle: {
    color: colors.textPrimary,
    fontFamily: fontFamilies.interfaceBold,
    fontSize: 15
  },
  emptyText: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.interface,
    fontSize: 13,
    lineHeight: 19
  },
  fieldLabel: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.interfaceBold,
    fontSize: 11,
    letterSpacing: 0.4
  },
  fieldInput: {
    backgroundColor: colors.surface01,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    color: colors.textPrimary,
    fontFamily: fontFamilies.interface,
    fontSize: 14,
    minHeight: 44,
    paddingHorizontal: spacing[3]
  },
  fieldChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing[2]
  },
  fieldError: {
    color: colors.danger,
    fontFamily: fontFamilies.interface,
    fontSize: 12,
    lineHeight: 18
  },
  banner: {
    alignItems: "center",
    backgroundColor: colors.surface01,
    borderColor: colors.danger,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing[2],
    padding: spacing[3]
  },
  bannerSuccess: {
    borderColor: colors.success
  },
  bannerText: {
    color: colors.textPrimary,
    flex: 1,
    fontFamily: fontFamilies.interface,
    fontSize: 13
  },
  muted: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.interface,
    fontSize: 13
  },
  disabled: { opacity: 0.45 },
  focusRing: {
    borderColor: colors.purple400,
    borderWidth: 2
  },
  pressed: { opacity: 0.72 }
});
