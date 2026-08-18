import { render, waitFor } from "@testing-library/react-native";
import { MyTrainingProgramsScreen } from "@/components/my-training-programs-screen";

const mockRepository = {
  listMyTrainingPrograms: jest.fn(),
  listMyOrders: jest.fn()
};

jest.mock("@fitblock/backend", () => ({
  createStoreRepository: () => mockRepository
}));

jest.mock("@/lib/supabase", () => ({
  getSupabaseConfigurationError: () => null,
  supabase: {}
}));

describe("MyTrainingProgramsScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRepository.listMyTrainingPrograms.mockResolvedValue([{
      access_id: "access-1",
      product_id: "product-1",
      order_id: "order-1",
      title: "Base de Força",
      seller_coach_id: "coach-1",
      seller_display_name: "Coach FitBlock",
      duration_weeks: 8,
      granted_at: "2026-08-13T12:00:00.000Z",
      sessions: [
        { id: "session-1", week_number: 1, day_number: 1, session_template_id: "template-1", session_instance_id: "instance-1", day_type: "training", scheduled_date: "2026-08-17", title: "Treino A" },
        { id: "session-2", week_number: 1, day_number: 2, day_type: "recovery", scheduled_date: "2026-08-18", title: "Recuperação" }
      ]
    }]);
    mockRepository.listMyOrders.mockResolvedValue([]);
  });

  it("mostra o programa liberado e as sessões vinculadas", async () => {
    const screen = render(<MyTrainingProgramsScreen />);

    await waitFor(() => expect(screen.getByTestId("training-program-product-1")).toBeTruthy());
    expect(screen.getByText("PROGRAMA LIBERADO")).toBeTruthy();
    expect(screen.getByText("Treino A")).toBeTruthy();
    expect(screen.getByText("Recuperação")).toBeTruthy();
    expect(screen.getByText(/17 de ago/i)).toBeTruthy();
  });
});
