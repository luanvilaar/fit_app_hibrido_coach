import { render, waitFor } from "@testing-library/react-native";
import { CoachProductsScreen } from "@/components/coach/coach-products-screen";

const mockStoreRepository = {
  listCoachProducts: jest.fn(),
  listCoachSales: jest.fn(),
  listProductsForReview: jest.fn()
};
const mockCoachRepository = {
  listSessionTemplates: jest.fn(),
  listCoachTeams: jest.fn()
};

jest.mock("@fitblock/backend", () => ({
  createStoreRepository: () => mockStoreRepository,
  createCoachFlowRepository: () => mockCoachRepository
}));

jest.mock("@/auth/roles-provider", () => ({
  useUserRoles: () => ({ hasRole: (role: string) => role === "coach" })
}));

jest.mock("@/lib/supabase", () => ({
  getSupabaseConfigurationError: () => null,
  supabase: {}
}));

describe("CoachProductsScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockStoreRepository.listCoachProducts.mockResolvedValue([]);
    mockStoreRepository.listCoachSales.mockResolvedValue([]);
    mockCoachRepository.listSessionTemplates.mockResolvedValue([]);
    mockCoachRepository.listCoachTeams.mockResolvedValue([]);
  });

  it("apresenta o editor e o estado vazio dos produtos do coach", async () => {
    const screen = render(<CoachProductsScreen />);

    await waitFor(() => expect(screen.getByTestId("coach-product-editor")).toBeTruthy());
    expect(screen.getByText("Transforme um treino em programa.")).toBeTruthy();
    expect(screen.getByText("Crie o primeiro produto usando um treino da biblioteca.")).toBeTruthy();
  });
});
