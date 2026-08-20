import { fireEvent, render, waitFor } from "@testing-library/react-native";
import type { CoachStoreProductRecord } from "@fitblock/backend";
import CoachProductDayBuilderRoute from "@/app/app/coach/produtos/[productId]/semana/[week]/dia/[day]";

const mockRouterBack = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: () => ({
    back: mockRouterBack,
    push: jest.fn()
  }),
  useLocalSearchParams: () => ({
    productId: "prod-1",
    week: "2",
    day: "3"
  })
}));

const mockStoreRepository = {
  listCoachProducts: jest.fn(),
  getCoachProductSchedule: jest.fn(),
  updateTrainingProgram: jest.fn()
};

const mockCoachRepository = {
  listExercises: jest.fn(),
  listCoachTeams: jest.fn(),
  getSessionTemplateContent: jest.fn(),
  createSessionTemplate: jest.fn(),
  updateSessionTemplateContent: jest.fn()
};

jest.mock("@fitblock/backend", () => ({
  createStoreRepository: () => mockStoreRepository,
  createCoachFlowRepository: () => mockCoachRepository
}));

jest.mock("@/auth/roles-provider", () => ({
  useUserRoles: () => ({ hasRole: (role: string) => role === "coach" })
}));

jest.mock("@/components/athlete-shell", () => ({
  AthleteShell: ({ children }: { children: React.ReactNode }) => children
}));

jest.mock("@/lib/supabase", () => ({
  getSupabaseConfigurationError: () => null,
  supabase: {}
}));

function mockProduct(overrides: Partial<CoachStoreProductRecord> = {}): CoachStoreProductRecord {
  return {
    id: "prod-1",
    seller_coach_id: "coach-1",
    type: "training_program",
    title: "Hipertrofia 8 Semanas",
    slug: "hipertrofia-8-semanas",
    description: "Programa focado em hipertrofia.",
    short_description: "Hipertrofia rápida.",
    cover_image_url: null,
    session_template_id: null,
    price_cents: 25000,
    category: "strength",
    objective: "Ganho de massa muscular",
    level: "intermediate",
    duration_weeks: 8,
    status: "draft",
    has_history: false,
    created_at: "2026-08-19T10:00:00.000Z",
    updated_at: "2026-08-19T10:00:00.000Z",
    ...overrides
  };
}

describe("CoachProductDayBuilderRoute", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockStoreRepository.listCoachProducts.mockResolvedValue([mockProduct()]);
    mockStoreRepository.getCoachProductSchedule.mockResolvedValue([
      {
        week_number: 2,
        day_number: 3,
        day_type: "training",
        session_template_id: null,
        session_title: null
      }
    ]);
    mockStoreRepository.updateTrainingProgram.mockResolvedValue(mockProduct());
    mockCoachRepository.listExercises.mockResolvedValue([]);
    mockCoachRepository.listCoachTeams.mockResolvedValue([]);
    mockCoachRepository.createSessionTemplate.mockResolvedValue({
      id: "tpl-new",
      title: "Treino Costas e Bíceps",
      status: "published"
    });
  });

  it("carrega os dados do dia e exibe cabeçalho com badges de semana e dia", async () => {
    const screen = render(<CoachProductDayBuilderRoute />);

    await waitFor(() => expect(screen.getByTestId("coach-product-day-screen")).toBeTruthy());
    expect(screen.getByText("Hipertrofia 8 Semanas")).toBeTruthy();
    expect(screen.getByText("SEMANA 2 · DIA 3")).toBeTruthy();
    expect(screen.getByText("Montagem da Sessão")).toBeTruthy();
  });

  it("permite voltar para a tela do produto ao clicar no botão de voltar", async () => {
    const screen = render(<CoachProductDayBuilderRoute />);

    await waitFor(() => expect(screen.getByTestId("back-to-products-btn")).toBeTruthy());
    fireEvent.press(screen.getByTestId("back-to-products-btn"));
    expect(mockRouterBack).toHaveBeenCalledTimes(1);
  });

  it("permite mudar o tipo para Descanso e confirmar sem montar blocos", async () => {
    const screen = render(<CoachProductDayBuilderRoute />);

    await waitFor(() => expect(screen.getByTestId("day-type-option-rest")).toBeTruthy());
    fireEvent.press(screen.getByTestId("day-type-option-rest"));

    expect(screen.getByText("Dia marcado como Descanso")).toBeTruthy();
    fireEvent.press(screen.getByText("Confirmar Dia no Programa"));

    await waitFor(() =>
      expect(mockStoreRepository.updateTrainingProgram).toHaveBeenCalledWith(
        expect.objectContaining({
          productId: "prod-1",
          schedule: expect.arrayContaining([
            expect.objectContaining({
              week_number: 2,
              day_number: 3,
              day_type: "rest",
              session_template_id: null
            })
          ])
        })
      )
    );
  });
});
