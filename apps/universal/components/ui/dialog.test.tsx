import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { useEffect } from "react";
import { StyleSheet, Text } from "react-native";
import { lightColors } from "@fitblock/design-tokens";
import { cycleDialogFocus, Dialog } from "@/components/ui/dialog";
import { ThemeProvider, useAppTheme } from "@/theme/theme-provider";

function LightDialog({ onDismiss }: { onDismiss: () => void }) {
  const { setPreference } = useAppTheme();
  useEffect(() => {
    void setPreference("light");
  }, [setPreference]);
  return (
    <Dialog onDismiss={onDismiss} testID="sample-dialog" title="Confirmação" visible>
      <Text>Conteúdo de operação</Text>
    </Dialog>
  );
}

describe("Dialog", () => {
  it("usa a superfície compartilhada clara e mantém fechamento explícito", async () => {
    const onDismiss = jest.fn();
    const screen = render(
      <ThemeProvider>
        <LightDialog onDismiss={onDismiss} />
      </ThemeProvider>
    );

    const dialog = screen.getByTestId("sample-dialog");
    expect(dialog.props.accessibilityViewIsModal).toBe(true);
    await waitFor(() => {
      expect(StyleSheet.flatten(screen.getByTestId("sample-dialog").props.style).backgroundColor)
        .toBe(lightColors.glassStrong);
    });
    fireEvent.press(screen.getByTestId("sample-dialog-close"));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("cicla Tab dentro do diálogo no web", () => {
    const first = { focus: jest.fn() };
    const last = { focus: jest.fn() };
    const preventDefault = jest.fn();

    cycleDialogFocus([first, last], last, false, preventDefault);
    expect(preventDefault).toHaveBeenCalledTimes(1);
    expect(first.focus).toHaveBeenCalledTimes(1);

    cycleDialogFocus([first, last], first, true, preventDefault);
    expect(last.focus).toHaveBeenCalledTimes(1);
  });
});
