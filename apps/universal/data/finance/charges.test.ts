import type { AthleteChargeRecord, CoachChargeRecord } from "@fitblock/backend";
import {
  chargeTone,
  describeChargeStatus,
  describeDueDate,
  describePaymentMethod,
  describeReferenceMonth,
  filterCharges,
  matchesFilter,
  matchesSearch,
  referenceMonthOf,
  shiftReferenceMonth,
  summarizeAthleteCharges
} from "@/data/finance/charges";

function charge(patch: Partial<CoachChargeRecord> = {}): CoachChargeRecord {
  return {
    id: "charge-1",
    athlete_id: "athlete-1",
    athlete_display_name: "Márcio Andrade",
    reference_month: "2026-08-01",
    description: "Mensalidade",
    due_date: "2026-08-10",
    original_amount_cents: 30000,
    paid_amount_cents: 0,
    forgiven_amount_cents: 0,
    outstanding_amount_cents: 30000,
    status: "pending",
    is_overdue: false,
    last_payment_method: null,
    last_paid_at: null,
    ...patch
  };
}

describe("selo da cobrança", () => {
  it("traduz cada status para o que o coach lê", () => {
    expect(describeChargeStatus(charge({ status: "pending" }))).toBe("Em aberto");
    expect(describeChargeStatus(charge({ status: "paid" }))).toBe("Pago");
    expect(describeChargeStatus(charge({ status: "forgiven" }))).toBe("Perdoado");
    expect(describeChargeStatus(charge({ status: "cancelled" }))).toBe("Cancelado");
  });

  it("diz que é parcial E vencida quando as duas coisas são verdade", () => {
    const partial = charge({ status: "partially_paid", is_overdue: true });

    expect(describeChargeStatus(partial)).toBe("Parcial · em atraso");
  });

  it("não grita atraso quando a parcial ainda está no prazo", () => {
    const partial = charge({ status: "partially_paid", is_overdue: false });

    expect(describeChargeStatus(partial)).toBe("Parcial");
  });

  it("dá tom de perigo para qualquer cobrança vencida, mesmo parcial", () => {
    expect(chargeTone(charge({ status: "overdue", is_overdue: true }))).toBe("danger");
    expect(chargeTone(charge({ status: "partially_paid", is_overdue: true }))).toBe("danger");
  });

  it("apaga o tom da cobrança que não é mais para cobrar", () => {
    expect(chargeTone(charge({ status: "cancelled" }))).toBe("muted");
    expect(chargeTone(charge({ status: "forgiven" }))).toBe("muted");
  });

  it("marca como positiva só a que foi paga", () => {
    expect(chargeTone(charge({ status: "paid" }))).toBe("positive");
  });
});

describe("filtro da lista", () => {
  it("em aberto reúne pendente, vencida e parcial", () => {
    expect(matchesFilter(charge({ status: "pending" }), "open")).toBe(true);
    expect(matchesFilter(charge({ status: "overdue" }), "open")).toBe(true);
    expect(matchesFilter(charge({ status: "partially_paid" }), "open")).toBe(true);
    expect(matchesFilter(charge({ status: "paid" }), "open")).toBe(false);
  });

  it("em atraso pergunta pelo prazo, não pelo status", () => {
    // É este caso que um filtro por status === "overdue" deixaria escapar.
    const partialOverdue = charge({ status: "partially_paid", is_overdue: true });

    expect(matchesFilter(partialOverdue, "overdue")).toBe(true);
    expect(matchesFilter(charge({ status: "pending", is_overdue: false }), "overdue")).toBe(false);
  });

  it("todas não esconde nem a cancelada", () => {
    expect(matchesFilter(charge({ status: "cancelled" }), "all")).toBe(true);
  });
});

describe("busca por aluno", () => {
  it("encontra sem acento e sem caixa", () => {
    expect(matchesSearch(charge(), "marcio")).toBe(true);
    expect(matchesSearch(charge(), "MÁRCIO")).toBe(true);
    expect(matchesSearch(charge(), "andrade")).toBe(true);
  });

  it("também procura na descrição da cobrança", () => {
    expect(matchesSearch(charge({ description: "Plano trimestral" }), "trimestral")).toBe(true);
  });

  it("termo vazio não esconde ninguém", () => {
    expect(matchesSearch(charge(), "   ")).toBe(true);
  });

  it("não inventa correspondência", () => {
    expect(matchesSearch(charge(), "joana")).toBe(false);
  });

  it("combina filtro e busca na mesma passada", () => {
    const list = [
      charge({ id: "a", athlete_display_name: "Márcio", status: "overdue", is_overdue: true }),
      charge({ id: "b", athlete_display_name: "Joana", status: "overdue", is_overdue: true }),
      charge({ id: "c", athlete_display_name: "Márcio", status: "paid" })
    ];

    expect(filterCharges(list, "overdue", "marcio").map((item) => item.id)).toEqual(["a"]);
  });
});

describe("competência", () => {
  it("normaliza qualquer data para o primeiro dia do mês", () => {
    expect(referenceMonthOf(new Date(2026, 7, 31))).toBe("2026-08-01");
    expect(referenceMonthOf(new Date(2026, 0, 1))).toBe("2026-01-01");
  });

  it("anda para trás e para frente atravessando o ano", () => {
    expect(shiftReferenceMonth("2026-08-01", -1)).toBe("2026-07-01");
    expect(shiftReferenceMonth("2026-01-01", -1)).toBe("2025-12-01");
    expect(shiftReferenceMonth("2026-12-01", 1)).toBe("2027-01-01");
  });

  it("não escorrega de mês ao andar a partir de um mês curto", () => {
    // O bug clássico: somar mês num Date de dia 31 pula fevereiro inteiro.
    expect(shiftReferenceMonth("2026-01-01", 1)).toBe("2026-02-01");
    expect(shiftReferenceMonth("2026-03-01", -1)).toBe("2026-02-01");
  });

  it("escreve a competência como o coach fala", () => {
    expect(describeReferenceMonth("2026-08-01")).toBe("agosto de 2026");
    expect(describeReferenceMonth("2026-03-01")).toBe("março de 2026");
  });

  it("escreve o vencimento sem o ano, que já está na competência", () => {
    expect(describeDueDate("2026-08-10")).toBe("10 de agosto");
  });
});

describe("resumo do atleta", () => {
  function athleteCharge(patch: Partial<AthleteChargeRecord> = {}): AthleteChargeRecord {
    return {
      id: "charge-1",
      coach_display_name: "Luan",
      reference_month: "2026-08-01",
      description: "Mensalidade",
      due_date: "2026-08-10",
      original_amount_cents: 30000,
      paid_amount_cents: 0,
      outstanding_amount_cents: 30000,
      status: "pending",
      is_overdue: false,
      ...patch
    };
  }

  it("soma só o que continua em aberto", () => {
    const summary = summarizeAthleteCharges([
      athleteCharge({ id: "a" }),
      athleteCharge({ id: "b", outstanding_amount_cents: 0, status: "paid" })
    ]);

    expect(summary.openCents).toBe(30000);
  });

  it("separa o que já venceu do total em aberto", () => {
    const summary = summarizeAthleteCharges([
      athleteCharge({ id: "a", due_date: "2026-07-10", is_overdue: true, status: "overdue" }),
      athleteCharge({ id: "b", due_date: "2026-09-10" })
    ]);

    expect(summary.overdueCents).toBe(30000);
    expect(summary.openCents).toBe(60000);
  });

  it("aponta o vencimento mais próximo, não o primeiro da lista", () => {
    // A lista chega da mais recente para a mais antiga; o que vence antes está no fim.
    const summary = summarizeAthleteCharges([
      athleteCharge({ id: "setembro", due_date: "2026-09-10" }),
      athleteCharge({ id: "agosto", due_date: "2026-08-10" })
    ]);

    expect(summary.nextDue?.id).toBe("agosto");
  });

  it("ignora cobrança cancelada", () => {
    const summary = summarizeAthleteCharges([
      athleteCharge({ id: "a", status: "cancelled" })
    ]);

    expect(summary.openCents).toBe(0);
    expect(summary.nextDue).toBeNull();
  });

  it("conta só o saldo restante da parcial, não o valor cheio", () => {
    const summary = summarizeAthleteCharges([
      athleteCharge({
        paid_amount_cents: 20000,
        outstanding_amount_cents: 10000,
        status: "partially_paid"
      })
    ]);

    expect(summary.openCents).toBe(10000);
  });

  it("não aponta vencimento quando está tudo quitado", () => {
    const summary = summarizeAthleteCharges([
      athleteCharge({ outstanding_amount_cents: 0, status: "paid" })
    ]);

    expect(summary.nextDue).toBeNull();
    expect(summary.openCents).toBe(0);
  });
});

describe("forma de pagamento", () => {
  it("traduz o que veio do banco", () => {
    expect(describePaymentMethod("pix")).toBe("PIX");
    expect(describePaymentMethod("bank_transfer")).toBe("Transferência");
    expect(describePaymentMethod("external_card")).toBe("Cartão externo");
  });
});
