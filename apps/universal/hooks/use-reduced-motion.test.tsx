import { act, render, waitFor } from "@testing-library/react-native";
import { AccessibilityInfo, Text } from "react-native";
import { useReducedMotion } from "@/hooks/use-reduced-motion";

let onReducedMotionChanged: ((enabled: boolean) => void) | undefined;

function MotionProbe() {
  const reducedMotion = useReducedMotion();
  return <Text testID="reduced-motion">{reducedMotion ? "reduced" : "full"}</Text>;
}

describe("useReducedMotion", () => {
  beforeEach(() => {
    onReducedMotionChanged = undefined;
    jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(false);
    jest.spyOn(AccessibilityInfo, "addEventListener").mockImplementation((_event, listener) => {
      onReducedMotionChanged = listener as unknown as (enabled: boolean) => void;
      return { remove: jest.fn() } as never;
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("acompanha a preferência durante o uso, sem atrasar o estado funcional", async () => {
    const screen = render(<><MotionProbe /><MotionProbe /></>);
    await waitFor(() => expect(screen.getAllByTestId("reduced-motion").every((node) => node.props.children === "full")).toBe(true));

    expect(AccessibilityInfo.addEventListener).toHaveBeenCalledTimes(1);

    act(() => onReducedMotionChanged?.(true));
    expect(screen.getAllByTestId("reduced-motion")).toHaveLength(2);
    expect(screen.getAllByTestId("reduced-motion").every((node) => node.props.children === "reduced")).toBe(true);
  });

  it("não deixa a leitura inicial atrasada sobrescrever um evento mais recente", async () => {
    let resolveInitialProbe: (enabled: boolean) => void = () => undefined;
    jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockReturnValue(
      new Promise((resolve) => {
        resolveInitialProbe = resolve;
      })
    );

    const screen = render(<MotionProbe />);

    act(() => onReducedMotionChanged?.(true));
    expect(screen.getByTestId("reduced-motion").props.children).toBe("reduced");

    await act(async () => {
      resolveInitialProbe(false);
    });

    expect(screen.getByTestId("reduced-motion").props.children).toBe("reduced");
  });

  it("ignora a leitura inicial de uma inscrição desmontada antes de novo consumidor montar", async () => {
    let resolveFirstProbe: (enabled: boolean) => void = () => undefined;
    let resolveSecondProbe: (enabled: boolean) => void = () => undefined;
    jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled")
      .mockReturnValueOnce(
        new Promise((resolve) => {
          resolveFirstProbe = resolve;
        })
      )
      .mockReturnValueOnce(
        new Promise((resolve) => {
          resolveSecondProbe = resolve;
        })
      );

    const firstScreen = render(<MotionProbe />);
    firstScreen.unmount();
    const secondScreen = render(<MotionProbe />);

    await act(async () => {
      resolveFirstProbe(true);
      resolveSecondProbe(false);
    });

    expect(secondScreen.getByTestId("reduced-motion").props.children).toBe("full");
  });
});
