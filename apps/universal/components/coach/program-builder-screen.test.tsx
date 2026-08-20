import { fireEvent, render, waitFor } from "@testing-library/react-native";
import type { CoachStoreProductRecord } from "@fitblock/backend";
import { ProgramBuilderScreen } from "@/components/coach/program-builder-screen";

jest.mock("@/hooks/use-reduced-motion", () => ({ useReducedMotion: () => true }));

const mockPush = jest.fn();
const mockReplace = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
    back: jest.fn()
  })
}));

const mockStoreRepository = {
  listCoachProducts: jest.fn(),
  getCoachProductSchedule: jest.fn(),
  createTrainingProgram: jest.fn(),
  updateTrainingProgram: jest.fn(),
  deleteProduct: jest.fn(),
  submitProductReview: jest.fn()
};

const mockCoachRepository = {
  listSessionTemplates: jest.fn(),
  listCoachTeams: jest.fn(),
  listExercises: jest.fn()
};

let mockIsCoach = true;

jest.mock("@fitblock/backend", () => ({
  createStoreRepository: () => mockStoreRepository,
  createCoachFlowRepository: () => mockCoachRepository
}));

jest.mock("@/auth/roles-provider", () => ({
  useUserRoles: () => ({ hasRole: (role: string) => (mockIsCoach && role === "coach") || role === "owner" })
}));

jest.mock("@/lib/supabase", () => ({
  getSupabaseConfigurationError: () => null,
  supabase: {}
}));

function dummyProduct(overrides: Partial<CoachStoreProductRecord> = {}): CoachStoreProductRecord {
  return {
    id: "product-123",
    seller_coach_id: "coach-1",
    type: "training_program",
    title: "Hipertrofia Avançada",
    slug: "hipertrofia-avancada",
    description: "Programa de 6 semanas de hipertrofia muscular.",
    short_description: "Hipertrofia em 6 semanas.",
    cover_image_url: "https://example.com/cover.jpg",
    session_template_id: null,
    price_cents: 29900,
    category: "strength",
    objective: "Ganhar massa muscular",
    level: "advanced",
    duration_weeks: 2,
    status: "draft",
    has_history: false,
    created_at: "2026-08-17T12:00:00.000Z",
    updated_at: "2026-08-17T12:00:00.000Z",
    ...overrides
  };
}

describe("ProgramBuilderScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsCoach = true;
    mockStoreRepository.listCoachProducts.mockResolvedValue([]);
    mockStoreRepository.getCoachProductSchedule.mockResolvedValue([]);
    mockStoreRepository.createTrainingProgram.mockResolvedValue(dummyProduct());
    mockStoreRepository.updateTrainingProgram.mockResolvedValue(dummyProduct());
    mockStoreRepository.deleteProduct.mockResolvedValue(undefined);
    mockStoreRepository.submitProductReview.mockResolvedValue(undefined);
    mockCoachRepository.listSessionTemplates.mockResolvedValue([]);
    mockCoachRepository.listCoachTeams.mockResolvedValue([]);
    mockCoachRepository.listExercises.mockResolvedValue([]);
  });

  it("organiza a criação em Base, Público e Plano", async () => {
    const screen = render(<ProgramBuilderScreen guidedWorkspace />);

    await waitFor(() => expect(screen.getByTestId("program-builder-screen")).toBeTruthy());
    expect(screen.getByText("Crie um programa que dá direção.")).toBeTruthy();
    expect(screen.getByTestId("program-builder-stages")).toBeTruthy();
    expect(screen.getByTestId("program-builder-stage-panel")).toBeTruthy();
    expect(screen.getByLabelText("Etapa 1: Base").props.accessibilityState).toEqual({ selected: true });
    fireEvent.changeText(screen.getByLabelText("Título do produto"), "Força Essencial");
    fireEvent.press(screen.getByLabelText("Etapa 2: Público"));
    fireEvent.press(screen.getByLabelText("Etapa 1: Base"));
    expect(screen.getByDisplayValue("Força Essencial")).toBeTruthy();
    fireEvent.press(screen.getByLabelText("Etapa 3: Plano"));
    expect(screen.getByTestId("program-week-grid")).toBeTruthy();
    expect(screen.getByText("Salvar Rascunho")).toBeTruthy();
  });

  it("carrega e exibe um produto existente quando productId é fornecido", async () => {
    mockStoreRepository.listCoachProducts.mockResolvedValue([dummyProduct()]);
    mockStoreRepository.getCoachProductSchedule.mockResolvedValue([
      { week_number: 1, day_number: 1, day_type: "training", session_template_id: "tpl-1", session_title: "Supino & Tríceps" }
    ]);

    const screen = render(<ProgramBuilderScreen productId="product-123" />);

    await waitFor(() => expect(screen.getByText("Hipertrofia Avançada")).toBeTruthy());
    expect(screen.getByDisplayValue("Hipertrofia em 6 semanas.")).toBeTruthy();
    expect(screen.getByText("Salvar Alterações")).toBeTruthy();
    expect(screen.queryByLabelText("Etapa 1: Base")).toBeNull();
    expect(screen.queryByText("Crie um programa que dá direção.")).toBeNull();
  });

  it("atualiza a duração e expõe o planejador semanal após avançar ao plano", async () => {
    const screen = render(<ProgramBuilderScreen guidedWorkspace />);

    await waitFor(() => expect(screen.getByLabelText("Duração em semanas")).toBeTruthy());
    fireEvent.changeText(screen.getByLabelText("Duração em semanas"), "3");

    fireEvent.press(screen.getByLabelText("Etapa 3: Plano"));
    expect(screen.getByText("Semana 1")).toBeTruthy();
    fireEvent.press(screen.getByLabelText("Próxima semana"));
    expect(screen.getByText("Semana 2")).toBeTruthy();
  });

  it("permite salvar as alterações de um produto existente", async () => {
    mockStoreRepository.listCoachProducts.mockResolvedValue([dummyProduct()]);
    mockStoreRepository.getCoachProductSchedule.mockResolvedValue([
      { week_number: 1, day_number: 1, day_type: "training", session_template_id: "tpl-1", session_title: "Supino & Tríceps" }
    ]);

    const screen = render(<ProgramBuilderScreen productId="product-123" />);

    await waitFor(() => expect(screen.getByTestId("program-builder-save-btn")).toBeTruthy());
    fireEvent.press(screen.getByTestId("program-builder-save-btn"));

    await waitFor(() => expect(mockStoreRepository.updateTrainingProgram).toHaveBeenCalledWith(
      expect.objectContaining({
        productId: "product-123",
        title: "Hipertrofia Avançada"
      })
    ));
    await waitFor(() => expect(screen.getByText("Programa atualizado com sucesso!")).toBeTruthy());
  });

  it("permite excluir o programa com confirmação", async () => {
    mockStoreRepository.listCoachProducts.mockResolvedValue([dummyProduct()]);
    mockStoreRepository.getCoachProductSchedule.mockResolvedValue([]);

    const screen = render(<ProgramBuilderScreen productId="product-123" />);

    await waitFor(() => expect(screen.getByTestId("program-builder-delete-btn")).toBeTruthy());
    fireEvent.press(screen.getByTestId("program-builder-delete-btn"));

    expect(screen.getByTestId("program-builder-confirm-delete")).toBeTruthy();
    fireEvent.press(screen.getByText("Sim, Excluir"));

    await waitFor(() => expect(mockStoreRepository.deleteProduct).toHaveBeenCalledWith("product-123"));
    expect(mockReplace).toHaveBeenCalledWith("/app/coach/produtos");
  });
});
