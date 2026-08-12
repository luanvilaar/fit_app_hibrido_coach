import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { PublicHome } from "@/components/public-home";

const mockPush = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush })
}));

describe("PublicHome", () => {
  beforeEach(() => {
    mockPush.mockClear();
  });

  it("renders the Dark Performance home and links the app CTA to the athlete area", async () => {
    const screen = await render(<PublicHome />);

    expect(screen.getByTestId("public-home-dark-performance")).toBeTruthy();
    expect(screen.getByTestId("public-home-hero")).toBeTruthy();
    expect(screen.getByText("TREINE")).toBeTruthy();
    expect(screen.getByText("COM INTENÇÃO.")).toBeTruthy();
    expect(screen.getByText("Método Híbrido")).toBeTruthy();
    expect(screen.getByText("FitBlock Training Camp")).toBeTruthy();
    expect(screen.getByText("29 AGO 2026")).toBeTruthy();
    expect(screen.getByText("PulseFit · João Pessoa")).toBeTruthy();
    expect(screen.getAllByLabelText("Conhecer programas FitBlock").length).toBeGreaterThan(0);

    fireEvent.press(screen.getByTestId("public-home-app-cta"));

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/entrar");
    });
  });

  it("toggles the mobile menu control without losing the home content", async () => {
    const screen = await render(<PublicHome />);
    const menuToggle = screen.queryByTestId("public-menu-toggle");

    if (menuToggle) {
      fireEvent.press(menuToggle);
      expect(screen.getByText("Programas")).toBeTruthy();
      fireEvent.press(menuToggle);
      expect(screen.getByTestId("public-home-hero")).toBeTruthy();
    } else {
      expect(screen.getByText("Acompanhamento")).toBeTruthy();
    }
  });
});
