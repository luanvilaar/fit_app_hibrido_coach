import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { CoachProductsScreen } from "@/components/coach/coach-products-screen";

const mockStoreRepository = {
  listCoachProducts: jest.fn(),
  listCoachSales: jest.fn(),
  listProductsForReview: jest.fn(),
  getCoachProductSchedule: jest.fn()
};
const mockCoachRepository = {
  listSessionTemplates: jest.fn(),
  listCoachTeams: jest.fn(),
  listExercises: jest.fn()
};
let mockIsOwner = false;

jest.mock("@fitblock/backend", () => ({
  createStoreRepository: () => mockStoreRepository,
  createCoachFlowRepository: () => mockCoachRepository
}));

jest.mock("@/auth/roles-provider", () => ({
  useUserRoles: () => ({ hasRole: (role: string) => role === "coach" || (mockIsOwner && role === "owner") })
}));

jest.mock("@/lib/supabase", () => ({
  getSupabaseConfigurationError: () => null,
  supabase: {}
}));

describe("CoachProductsScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsOwner = false;
    mockStoreRepository.listCoachProducts.mockResolvedValue([]);
    mockStoreRepository.listCoachSales.mockResolvedValue([]);
    mockStoreRepository.getCoachProductSchedule.mockResolvedValue([]);
    mockCoachRepository.listSessionTemplates.mockResolvedValue([]);
    mockCoachRepository.listCoachTeams.mockResolvedValue([]);
    mockCoachRepository.listExercises.mockResolvedValue([]);
  });

  it("apresenta o editor e o estado vazio dos produtos do coach", async () => {
    const screen = render(<CoachProductsScreen />);

    await waitFor(() => expect(screen.getByTestId("coach-product-editor")).toBeTruthy());
    expect(screen.getByText("Transforme um treino em programa.")).toBeTruthy();
    expect(screen.getByText("Crie o primeiro produto usando um treino da biblioteca.")).toBeTruthy();
  });

  it("gera os sete dias relativos para cada semana definida", async () => {
    const screen = render(<CoachProductsScreen />);

    await waitFor(() => expect(screen.getByLabelText("Duração em semanas")).toBeTruthy());
    fireEvent.changeText(screen.getByLabelText("Duração em semanas"), "2");

    expect(screen.getByText("SEMANA 1")).toBeTruthy();
    expect(screen.getByText("SEMANA 2")).toBeTruthy();
    expect(screen.getAllByText("Dia 7")).toHaveLength(2);
    expect(screen.getAllByText("Sem programação")).toHaveLength(14);
  });

  it("dá ao moderador os dados comerciais e a estrutura antes da aprovação", async () => {
    mockIsOwner = true;
    mockStoreRepository.listProductsForReview.mockResolvedValue([{
      id: "review-1",
      seller_coach_id: "coach-1",
      seller_display_name: "Coach FitBlock",
      title: "Base de Força",
      slug: "base-de-forca",
      description: "Programa completo de força para construir consistência.",
      short_description: "Força em quatro semanas.",
      price_cents: 19900,
      category: "strength",
      objective: "Ganhar força",
      level: "beginner",
      duration_weeks: 4,
      status: "review",
      updated_at: "2026-08-17T12:00:00.000Z"
    }]);
    mockStoreRepository.getCoachProductSchedule.mockResolvedValue([
      { week_number: 1, day_number: 1, day_type: "training", session_template_id: "template-1", session_title: "Treino A" },
      { week_number: 1, day_number: 2, day_type: "rest", session_template_id: null, session_title: "Descanso" }
    ]);

    const screen = render(<CoachProductsScreen />);

    await waitFor(() => expect(screen.getByTestId("store-review-queue")).toBeTruthy());
    expect(screen.getByText(/Objetivo: Ganhar força.*Iniciante.*4.*semanas/)).toBeTruthy();
    expect(screen.getByText("Programa completo de força para construir consistência.")).toBeTruthy();
    expect(screen.getByText("Veja a estrutura primeiro")).toBeTruthy();
    fireEvent.press(screen.getByText("Ver estrutura"));
    await waitFor(() => expect(screen.getByText(/Treino A \(S1 · D1\)/)).toBeTruthy());
    expect(screen.getByText("Aprovar")).toBeTruthy();
  });
});
