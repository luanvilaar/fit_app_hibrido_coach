import type {
  AthleteChargeRecord,
  ChargePaymentMethod,
  ChargeStatus,
  CoachChargeRecord
} from "@fitblock/backend";

/**
 * Derivações da lista de cobranças. Tudo aqui é puro: o saldo e o status vêm calculados do banco
 * (view `charge_balances`), e esta camada só traduz, filtra e agrupa para a tela.
 */

/**
 * O filtro do painel não espelha o enum do banco um-para-um: "Em atraso" atravessa dois status
 * (`overdue` e `partially_paid` já vencida) porque a pergunta do coach é "quem me deve e passou
 * do prazo", não "qual o valor do campo status".
 */
export type ChargeFilter =
  | "all"
  | "open"
  | "overdue"
  | "paid"
  | "forgiven"
  | "cancelled";

export const chargeFilterOptions: Array<{ value: ChargeFilter; label: string }> = [
  { value: "all", label: "Todas" },
  { value: "open", label: "Em aberto" },
  { value: "overdue", label: "Em atraso" },
  { value: "paid", label: "Pagas" },
  { value: "forgiven", label: "Perdoadas" },
  { value: "cancelled", label: "Canceladas" }
];

const statusLabels: Record<ChargeStatus, string> = {
  pending: "Em aberto",
  overdue: "Em atraso",
  paid: "Pago",
  partially_paid: "Parcial",
  forgiven: "Perdoado",
  cancelled: "Cancelado"
};

export function describeChargeStatus(charge: Pick<CoachChargeRecord, "status" | "is_overdue">): string {
  const label = statusLabels[charge.status];

  // Parcial e vencida ao mesmo tempo: o selo precisa dizer as duas coisas, senão o coach lê
  // "Parcial" e não percebe que o prazo já passou.
  if (charge.status === "partially_paid" && charge.is_overdue) {
    return "Parcial · em atraso";
  }

  return label;
}

/** Tom visual do selo. A cor nunca vai sozinha — a tela sempre acompanha com ícone e texto. */
export type ChargeTone = "neutral" | "positive" | "warning" | "danger" | "muted";

export function chargeTone(charge: Pick<CoachChargeRecord, "status" | "is_overdue">): ChargeTone {
  if (charge.status === "cancelled") return "muted";
  if (charge.status === "paid") return "positive";
  if (charge.status === "forgiven") return "muted";
  if (charge.is_overdue) return "danger";
  if (charge.status === "partially_paid") return "warning";
  return "neutral";
}

const paymentMethodLabels: Record<ChargePaymentMethod, string> = {
  pix: "PIX",
  cash: "Dinheiro",
  bank_transfer: "Transferência",
  external_card: "Cartão externo",
  credit_card: "Cartão de crédito",
  debit_card: "Cartão de débito",
  other: "Outro"
};

export function describePaymentMethod(method: ChargePaymentMethod): string {
  return paymentMethodLabels[method];
}

/** Os métodos que o coach escolhe ao registrar dinheiro recebido fora da plataforma. */
export const manualPaymentMethodOptions: Array<{ value: ChargePaymentMethod; label: string }> = [
  { value: "pix", label: "PIX" },
  { value: "cash", label: "Dinheiro" },
  { value: "bank_transfer", label: "Transferência" },
  { value: "external_card", label: "Cartão externo" },
  { value: "other", label: "Outro" }
];

export function matchesFilter(charge: CoachChargeRecord, filter: ChargeFilter): boolean {
  switch (filter) {
    case "all":
      return true;
    case "open":
      return charge.status === "pending"
        || charge.status === "overdue"
        || charge.status === "partially_paid";
    case "overdue":
      return charge.is_overdue;
    case "paid":
      return charge.status === "paid";
    case "forgiven":
      return charge.status === "forgiven";
    case "cancelled":
      return charge.status === "cancelled";
  }
}

/** Busca por nome do aluno, sem acento e sem caixa — o coach digita como lembra. */
export function matchesSearch(charge: CoachChargeRecord, term: string): boolean {
  const normalized = normalize(term);

  if (normalized.length === 0) return true;

  return normalize(charge.athlete_display_name).includes(normalized)
    || normalize(charge.description).includes(normalized);
}

function normalize(value: string): string {
  return value
    .normalize("NFD")
    // Faixa dos diacríticos combinantes: "Márcio" e "Marcio" precisam bater um com o outro.
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function filterCharges(
  charges: CoachChargeRecord[],
  filter: ChargeFilter,
  search: string
): CoachChargeRecord[] {
  return charges.filter((charge) => matchesFilter(charge, filter) && matchesSearch(charge, search));
}

/** Competência no formato que a RPC espera: primeiro dia do mês. */
export function referenceMonthOf(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}-01`;
}

export function shiftReferenceMonth(referenceMonth: string, months: number): string {
  const [year, month] = referenceMonth.split("-").map(Number);
  // Dia 1 fixo: o Date de um dia 31 ao trocar de mês escorrega para o mês seguinte.
  const shifted = new Date(year, month - 1 + months, 1);
  return referenceMonthOf(shifted);
}

const monthNames = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"
];

export function describeReferenceMonth(referenceMonth: string): string {
  const [year, month] = referenceMonth.split("-").map(Number);
  const name = monthNames[month - 1];

  if (!name) return referenceMonth;

  return `${name} de ${year}`;
}

/**
 * O que o atleta precisa saber de imediato: quanto está em aberto, quanto já venceu e qual é o
 * próximo vencimento. Só isso encabeça a tela dele — o resto é histórico.
 */
export type AthleteChargeSummary = {
  openCents: number;
  overdueCents: number;
  /** A cobrança em aberto que vence primeiro; nula quando não há nada em aberto. */
  nextDue: AthleteChargeRecord | null;
};

export function summarizeAthleteCharges(charges: AthleteChargeRecord[]): AthleteChargeSummary {
  const open = charges.filter(
    (charge) => charge.status !== "cancelled" && charge.outstanding_amount_cents > 0
  );

  // A lista chega da mais recente para a mais antiga; o que importa aqui é o vencimento mais
  // próximo, que costuma ser justamente o mais antigo ainda em aberto.
  const nextDue = open.reduce<AthleteChargeRecord | null>(
    (earliest, charge) =>
      earliest === null || charge.due_date < earliest.due_date ? charge : earliest,
    null
  );

  return {
    openCents: open.reduce((total, charge) => total + charge.outstanding_amount_cents, 0),
    overdueCents: open
      .filter((charge) => charge.is_overdue)
      .reduce((total, charge) => total + charge.outstanding_amount_cents, 0),
    nextDue
  };
}

/** "10 de agosto" — o vencimento como o coach fala dele. */
export function describeDueDate(dueDate: string): string {
  const [, month, day] = dueDate.split("-").map(Number);
  const name = monthNames[month - 1];

  if (!name) return dueDate;

  return `${day} de ${name}`;
}
