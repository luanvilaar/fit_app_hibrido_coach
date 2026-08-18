import { render, waitFor } from "@testing-library/react-native";
import { CalendarScreen } from "@/components/calendar-screen";

const mockCalendarRepository = {
  listCalendarEntries: jest.fn()
};

jest.mock("@fitblock/backend", () => ({
  createCalendarRepository: () => mockCalendarRepository,
  createTodayRepository: () => ({ startSession: jest.fn() }),
  isCalendarSessionEntry: (entry: { entry_type?: string }) => entry.entry_type !== "program_day"
}));

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: jest.fn() })
}));

jest.mock("@/lib/supabase", () => ({
  getSupabaseConfigurationError: () => null,
  supabase: {}
}));

describe("CalendarScreen", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-08-17T12:00:00.000Z"));
    mockCalendarRepository.listCalendarEntries.mockResolvedValue([
      { id: "rest", scheduled_date: "2026-08-18", entry_type: "program_day", day_type: "rest", title: "Descanso", session_instance_id: null },
      { id: "training", scheduled_date: "2026-08-17", entry_type: "session", state: "available", snapshot: { title: "Treino A", blocks: [] } },
      { id: "recovery", scheduled_date: "2026-08-19", entry_type: "program_day", day_type: "recovery", title: "Recuperação", session_instance_id: null },
      { id: "assessment", scheduled_date: "2026-08-20", entry_type: "program_day", day_type: "assessment", title: "Avaliação", session_instance_id: null },
      { id: "empty", scheduled_date: "2026-08-21", entry_type: "program_day", day_type: "unprogrammed", title: "Sem programação", session_instance_id: null }
    ]);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("exibe os cinco tipos na agenda e não cria ação de iniciar para dias não executáveis", async () => {
    const screen = render(<CalendarScreen />);

    await waitFor(() => expect(screen.getByText("Descanso")).toBeTruthy());
    expect(screen.getByText("Treino A")).toBeTruthy();
    expect(screen.getAllByText("Recuperação").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Avaliação").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Sem programação").length).toBeGreaterThan(0);

    // A agenda só expõe o botão de execução para uma sessão de treino real.
    expect(screen.queryByTestId("calendar-start-session")).toBeNull();
    expect(screen.getByTestId("calendar-program-day")).toBeTruthy();
  });
});
