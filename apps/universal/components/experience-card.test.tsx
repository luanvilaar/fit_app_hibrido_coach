import { fireEvent, render } from "@testing-library/react-native";
import { ExperienceCard } from "@/components/experience-card";
import { trainingCampExperience } from "@/data/home";
import { track } from "@/lib/analytics";

jest.mock("@/lib/analytics", () => ({
  track: jest.fn()
}));

jest.mock("expo-linking", () => ({
  openURL: jest.fn(() => Promise.resolve())
}));

describe("ExperienceCard", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders the official Training Camp data and tracks the external destination", async () => {
    const screen = await render(<ExperienceCard experience={trainingCampExperience} />);

    expect(screen.getByText("29 AGO 2026")).toBeTruthy();
    expect(screen.getByText("FitBlock Training Camp")).toBeTruthy();
    expect(screen.getByText("PulseFit · João Pessoa")).toBeTruthy();
    expect(screen.getByText("Inscrições abertas")).toBeTruthy();
    expect(screen.getByText("CAMP")).toBeTruthy();
    expect(screen.getByTestId("experience-cover-fitblock-training-camp-2026")).toBeTruthy();
    expect(
      screen.getByLabelText(
        "Abrir FitBlock Training Camp, 29 AGO 2026, PulseFit · João Pessoa. Inscrições abertas"
      )
    ).toBeTruthy();

    fireEvent.press(screen.getByTestId("experience-card-fitblock-training-camp-2026"));

    expect(track).toHaveBeenCalledWith(
      "training_camp_card_click",
      expect.objectContaining({
        destination: trainingCampExperience.href,
        event_name: trainingCampExperience.title
      })
    );
    expect(screen.getByRole("link")).toBeTruthy();
  });
});
