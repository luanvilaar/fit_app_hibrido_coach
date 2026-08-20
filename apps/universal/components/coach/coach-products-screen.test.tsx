import { fireEvent, render, waitFor } from "@testing-library/react-native";
import type { CoachStoreProductRecord } from "@fitblock/backend";
import { CoachProductsScreen } from "@/components/coach/coach-products-screen";

const mockPush = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush })
}));

const mockStoreRepository = {
  listCoachProducts: jest.fn(),
  listCoachSales: jest.fn(),
  listProductsForReview: jest.fn(),
  getCoachProductSchedule: jest.fn(),
  deleteProduct: jest.fn(),
  submitProductReview: jest.fn()
};
const mockCoachRepository = {
  listCoachTeams: jest.fn(),
  listTeamMembers: jest.fn()
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

function coachProduct(overrides: Partial<CoachStoreProductRecord> = {}): CoachStoreProductRecord {
  return {
    id: "product-1",
    seller_coach_id: "coach-1",
    type: "training_program",
    title: "Base de Força",
    slug: "base-de-forca",
    description: "Programa completo de força.",
    short_description: "Força em quatro semanas.",
    cover_image_url: null,
    session_template_id: "template-1",
    price_cents: 19900,
    category: "strength",
    objective: "Ganhar força",
    level: "beginner",
    duration_weeks: 1,
    status: "draft",
    has_history: false,
    created_at: "2026-08-17T12:00:00.000Z",
    updated_at: "2026-08-17T12:00:00.000Z",
    ...overrides
  };
}

describe("CoachProductsScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsOwner = false;
    mockStoreRepository.listCoachProducts.mockResolvedValue([]);
    mockStoreRepository.listCoachSales.mockResolvedValue([]);
    mockStoreRepository.getCoachProductSchedule.mockResolvedValue([]);
    mockStoreRepository.deleteProduct.mockResolvedValue(undefined);
    mockCoachRepository.listCoachTeams.mockResolvedValue([]);
    mockCoachRepository.listTeamMembers.mockResolvedValue([]);
  });

  it("apresenta o hub de produtos sem duplicar o editor", async () => {
    const screen = render(<CoachProductsScreen />);

    await waitFor(() => expect(screen.getByTestId("coach-products-list")).toBeTruthy());
    expect(screen.queryByTestId("coach-product-editor")).toBeNull();
    expect(screen.queryByTestId("program-week-grid")).toBeNull();
    expect(screen.queryByTestId("program-session-composer")).toBeNull();
    expect(screen.getByText("Crie o primeiro produto usando um treino da biblioteca.")).toBeTruthy();
  });

  it("direciona a criação para o workspace dedicado", async () => {
    const screen = render(<CoachProductsScreen />);

    await waitFor(() => expect(screen.getByTestId("create-new-program-btn")).toBeTruthy());
    fireEvent.press(screen.getByTestId("create-new-program-btn"));
    expect(mockPush).toHaveBeenCalledWith("/app/coach/produtos/novo");
  });

  it("oferece uma única ação Excluir e nenhuma ação de arquivar, em qualquer status", async () => {
    mockStoreRepository.listCoachProducts.mockResolvedValue([
      coachProduct(),
      coachProduct({ id: "product-2", title: "Corrida Base", slug: "corrida-base", status: "published", has_history: true }),
      // Produto legado que ficou como 'archived' antes da migration desta entrega.
      coachProduct({ id: "product-3", title: "Programa Antigo", slug: "programa-antigo", status: "archived", has_history: true })
    ]);

    const screen = render(<CoachProductsScreen />);

    await waitFor(() => expect(screen.getByTestId("coach-product-product-1")).toBeTruthy());
    expect(screen.queryByText("Arquivar")).toBeNull();
    expect(screen.getAllByText("Excluir")).toHaveLength(3);
    expect(screen.getAllByText("Abrir produto")).toHaveLength(3);
    // O produto legado continua legível e acionável, sem estado travado.
    expect(screen.getByText(/Arquivado/)).toBeTruthy();
  });

  it("avisa sobre o histórico apenas quando o produto tem vendas, entregas ou versões", async () => {
    mockStoreRepository.listCoachProducts.mockResolvedValue([
      coachProduct(),
      coachProduct({ id: "product-2", title: "Corrida Base", slug: "corrida-base", status: "published", has_history: true })
    ]);

    const screen = render(<CoachProductsScreen />);

    await waitFor(() => expect(screen.getByTestId("coach-product-product-1")).toBeTruthy());

    fireEvent.press(screen.getAllByText("Excluir")[0]);
    expect(screen.getByTestId("delete-confirm-product-1")).toBeTruthy();
    expect(screen.queryByTestId("delete-history-warning-product-1")).toBeNull();

    fireEvent.press(screen.getByText("Manter"));
    expect(screen.queryByTestId("delete-confirm-product-1")).toBeNull();

    fireEvent.press(screen.getAllByText("Excluir")[1]);
    expect(screen.getByTestId("delete-history-warning-product-2")).toBeTruthy();
  });

  it("exclui o produto por uma única chamada depois da confirmação", async () => {
    mockStoreRepository.listCoachProducts.mockResolvedValue([coachProduct()]);

    const screen = render(<CoachProductsScreen />);

    await waitFor(() => expect(screen.getByTestId("coach-product-product-1")).toBeTruthy());
    fireEvent.press(screen.getByText("Excluir"));
    fireEvent.press(screen.getByText("Sim, excluir"));

    await waitFor(() => expect(mockStoreRepository.deleteProduct).toHaveBeenCalledWith("product-1"));
    await waitFor(() => expect(screen.getByText("Produto excluído.")).toBeTruthy());
  });

  it("direciona a edição para a página dedicada", async () => {
    const published = coachProduct({ status: "published", has_history: true });
    mockStoreRepository.listCoachProducts.mockResolvedValue([published]);

    const screen = render(<CoachProductsScreen />);

    await waitFor(() => expect(screen.getByTestId("coach-product-product-1")).toBeTruthy());
    fireEvent.press(screen.getByText("Abrir produto"));

    expect(mockPush).toHaveBeenCalledWith("/app/coach/produtos/product-1");
    expect(mockStoreRepository.getCoachProductSchedule).not.toHaveBeenCalled();
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
