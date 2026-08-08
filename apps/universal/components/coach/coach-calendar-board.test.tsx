import { fireEvent, render } from "@testing-library/react-native";
import type { CalendarSessionRecord } from "@fitblock/backend";
import { CoachCalendarBoard } from "@/components/coach/coach-calendar-board";

function buildSession(overrides: Partial<CalendarSessionRecord> & { id: string }): CalendarSessionRecord {
  return {
    template_id: "template-01",
    team_id: "team-01",
    scheduled_date: "2026-08-10",
    status: "published",
    state: "available",
    coach_note: "",
    created_by: "coach-01",
    created_at: "2026-08-06T12:00:00.000Z",
    updated_at: "2026-08-06T12:00:00.000Z",
    snapshot: { title: "Sessão" },
    ...overrides
  };
}

// Semana de 27/jul a 02/ago (a que contém o dia 1º de agosto), cruzando a virada do mês.
const august = new Date(2026, 7, 1);

describe("CoachCalendarBoard", () => {
  it("mostra todas as sessões do mesmo dia, não apenas a primeira", async () => {
    const sessions = [
      buildSession({ id: "instance-01", scheduled_date: "2026-08-01", snapshot: { title: "Manhã" } }),
      buildSession({ id: "instance-02", scheduled_date: "2026-08-01", snapshot: { title: "Tarde" } })
    ];

    const screen = await render(
      <CoachCalendarBoard
        anchor={august}
        sessions={sessions}
        selectedSessionId={null}
        isLoading={false}
        onSelectSession={jest.fn()}
        onShiftPeriod={jest.fn()}
      />
    );

    expect(screen.getByTestId("calendar-session-instance-01")).toBeTruthy();
    expect(screen.getByTestId("calendar-session-instance-02")).toBeTruthy();
    expect(screen.getByTestId("session-list-instance-01")).toBeTruthy();
    expect(screen.getByTestId("session-list-instance-02")).toBeTruthy();
  });

  it("abre a sessão selecionada tanto pelo calendário quanto pela lista", async () => {
    const onSelectSession = jest.fn();
    const session = buildSession({ id: "instance-01", scheduled_date: "2026-08-01" });

    const screen = await render(
      <CoachCalendarBoard
        anchor={august}
        sessions={[session]}
        selectedSessionId="instance-01"
        isLoading={false}
        onSelectSession={onSelectSession}
        onShiftPeriod={jest.fn()}
      />
    );

    await fireEvent.press(screen.getByTestId("calendar-session-instance-01"));
    await fireEvent.press(screen.getByTestId("session-list-instance-01"));

    expect(onSelectSession).toHaveBeenCalledTimes(2);
    expect(onSelectSession).toHaveBeenCalledWith(session);
    expect(screen.getByTestId("session-list-instance-01").props.accessibilityState).toMatchObject({ selected: true });
  });

  it("distingue rascunho de publicado na lista", async () => {
    const screen = await render(
      <CoachCalendarBoard
        anchor={august}
        sessions={[buildSession({ id: "instance-01", status: "draft" })]}
        selectedSessionId={null}
        isLoading={false}
        onSelectSession={jest.fn()}
        onShiftPeriod={jest.fn()}
      />
    );

    expect(screen.getByText("Rascunho")).toBeTruthy();
  });

  it("mostra sempre a visão semanal, com os 7 dias e detalhe por sessão", async () => {
    const sessions = [buildSession({ id: "instance-01", scheduled_date: "2026-07-30", status: "draft" })];

    const screen = await render(
      <CoachCalendarBoard
        anchor={august}
        sessions={sessions}
        selectedSessionId={null}
        isLoading={false}
        onSelectSession={jest.fn()}
        onShiftPeriod={jest.fn()}
      />
    );

    expect(screen.getByText("27 de jul a 02 de agosto de 2026")).toBeTruthy();
    expect(screen.getByTestId("calendar-session-instance-01")).toBeTruthy();
    // "Rascunho" aparece tanto no card do dia (visão semanal) quanto na lista "SESSÕES DO PERÍODO".
    expect(screen.getAllByText("Rascunho")).toHaveLength(2);
    expect(screen.queryByTestId("calendar-view-month")).toBeNull();
    expect(screen.queryByTestId("calendar-view-week")).toBeNull();
  });

  it("navega entre semanas", async () => {
    const onShiftPeriod = jest.fn();
    const screen = await render(
      <CoachCalendarBoard
        anchor={august}
        sessions={[]}
        selectedSessionId={null}
        isLoading={false}
        onSelectSession={jest.fn()}
        onShiftPeriod={onShiftPeriod}
      />
    );

    await fireEvent.press(screen.getByTestId("previous-week"));
    await fireEvent.press(screen.getByTestId("next-week"));

    expect(onShiftPeriod).toHaveBeenNthCalledWith(1, -1);
    expect(onShiftPeriod).toHaveBeenNthCalledWith(2, 1);
    expect(screen.getByText("Nenhuma sessão encontrada nesta semana.")).toBeTruthy();
  });

  it("filtra as sessões exibidas por categoria do bloco", async () => {
    const strengthSession = buildSession({
      id: "instance-strength",
      scheduled_date: "2026-08-01",
      snapshot: { title: "Força", blocks: [{ name: "Bloco", kind: "strength", items: [] }] }
    });
    const enduranceSession = buildSession({
      id: "instance-endurance",
      scheduled_date: "2026-08-02",
      snapshot: { title: "Corrida", blocks: [{ name: "Bloco", kind: "endurance", items: [] }] }
    });

    const screen = await render(
      <CoachCalendarBoard
        anchor={august}
        sessions={[strengthSession, enduranceSession]}
        selectedSessionId={null}
        isLoading={false}
        onSelectSession={jest.fn()}
        onShiftPeriod={jest.fn()}
      />
    );

    expect(screen.getByTestId("session-list-instance-strength")).toBeTruthy();
    expect(screen.getByTestId("session-list-instance-endurance")).toBeTruthy();

    await fireEvent.press(screen.getByTestId("calendar-filter-kind-strength"));

    expect(screen.getByTestId("session-list-instance-strength")).toBeTruthy();
    expect(screen.queryByTestId("session-list-instance-endurance")).toBeNull();

    await fireEvent.press(screen.getByTestId("calendar-filter-all"));

    expect(screen.getByTestId("session-list-instance-strength")).toBeTruthy();
    expect(screen.getByTestId("session-list-instance-endurance")).toBeTruthy();
  });
});
