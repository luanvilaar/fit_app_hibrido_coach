import { fireEvent, render } from "@testing-library/react-native";
import { Linking, Platform } from "react-native";
import { BlockBodyText, MovementList } from "@/components/coach-hibrido/block-body-text";
import type { BlockMovement } from "@/data/coach-hibrido/mentions";

const mockUseWindowDimensions = jest.fn(() => ({
  width: 1024,
  height: 768,
  scale: 1,
  fontScale: 1
}));

jest.mock("react-native/Libraries/Utilities/useWindowDimensions", () => ({
  __esModule: true,
  default: () => mockUseWindowDimensions()
}));

jest.mock("@expo/vector-icons", () => {
  const React = require("react");
  const { Text } = require("react-native");
  return { Ionicons: ({ name }: { name: string }) => React.createElement(Text, null, name) };
});

const squatMovement: BlockMovement = {
  slug: "back-squat",
  name: "Back Squat",
  videoUrl: "https://youtube.com/watch?v=abc",
  category: null,
  itemId: "item-1"
};

const noVideoMovement: BlockMovement = {
  slug: "air-squat",
  name: "Air Squat",
  videoUrl: null,
  category: null,
  itemId: "item-2"
};

describe("MovementList video links", () => {
  const originalPlatformOS = Platform.OS;
  let windowOpenSpy: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    windowOpenSpy = jest.fn();
    (window as unknown as { open: jest.Mock }).open = windowOpenSpy;
  });

  afterEach(() => {
    Platform.OS = originalPlatformOS;
  });

  it("opens the video in a new tab on desktop web", () => {
    Platform.OS = "web";
    mockUseWindowDimensions.mockReturnValue({ width: 1280, height: 800, scale: 1, fontScale: 1 });

    const screen = render(<MovementList movements={[squatMovement]} testID="movements" />);
    fireEvent.press(screen.getByTestId("movements-back-squat"));

    expect(windowOpenSpy).toHaveBeenCalledWith(squatMovement.videoUrl, "_blank", "noopener,noreferrer");
  });

  it("opens the video in the same tab on mobile web, avoiding the blank-tab left behind by the app handoff", () => {
    Platform.OS = "web";
    mockUseWindowDimensions.mockReturnValue({ width: 375, height: 812, scale: 2, fontScale: 1 });

    const screen = render(<MovementList movements={[squatMovement]} testID="movements" />);
    fireEvent.press(screen.getByTestId("movements-back-squat"));

    expect(windowOpenSpy).toHaveBeenCalledWith(squatMovement.videoUrl, "_self");
  });

  it("uses Linking.openURL on native, bypassing window.open entirely", () => {
    Platform.OS = "ios";
    mockUseWindowDimensions.mockReturnValue({ width: 375, height: 812, scale: 2, fontScale: 1 });
    const openURLSpy = jest.spyOn(Linking, "openURL").mockResolvedValue(undefined);

    const screen = render(<MovementList movements={[squatMovement]} testID="movements" />);
    fireEvent.press(screen.getByTestId("movements-back-squat"));

    expect(openURLSpy).toHaveBeenCalledWith(squatMovement.videoUrl);
    expect(windowOpenSpy).not.toHaveBeenCalled();
  });

  it("preserva as menções no texto com semântica acessível de vídeo", () => {
    const screen = render(
      <BlockBodyText
        body="@Back Squat\n@Air Squat"
        movements={[squatMovement, noVideoMovement]}
        testID="prescription"
        tone="dark"
      />
    );

    expect(screen.getByTestId("prescription")).toBeTruthy();
    expect(screen.getByLabelText("Ver vídeo de Back Squat")).toBeTruthy();
    expect(screen.getByLabelText("Air Squat. Vídeo não cadastrado.")).toBeTruthy();
  });
});
