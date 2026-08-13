import { render, waitFor } from "@testing-library/react-native";
import { StoreScreen } from "@/components/store-screen";

const mockRepository = {
  listProducts: jest.fn(),
  getProduct: jest.fn(),
  listMyOrders: jest.fn()
};

jest.mock("@fitblock/backend", () => ({
  createStoreRepository: () => mockRepository
}));

jest.mock("@/lib/supabase", () => ({
  getSupabaseConfigurationError: () => null,
  supabase: {
    auth: { getSession: jest.fn() }
  }
}));

const product = {
  id: "product-1",
  seller_coach_id: "coach-1",
  seller_display_name: "Coach FitBlock",
  type: "training_program" as const,
  title: "Base de Força",
  slug: "base-de-forca",
  short_description: "Um ciclo de força para começar.",
  cover_image_url: null,
  price_cents: 19900,
  category: "strength" as const,
  level: "beginner" as const,
  duration_weeks: 8,
  status: "published" as const,
  created_at: "2026-08-13T12:00:00.000Z"
};

describe("StoreScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRepository.listProducts.mockResolvedValue([product]);
    mockRepository.listMyOrders.mockResolvedValue([]);
  });

  it("lista um programa publicado na vitrine", async () => {
    const screen = render(<StoreScreen />);

    await waitFor(() => expect(screen.getByTestId("store-product-product-1")).toBeTruthy());
    expect(screen.getByText("Base de Força")).toBeTruthy();
    expect(screen.getByText("R$ 199,00")).toBeTruthy();
  });
});
