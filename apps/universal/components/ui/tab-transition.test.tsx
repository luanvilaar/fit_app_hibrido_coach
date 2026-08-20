import { fireEvent, render } from "@testing-library/react-native";
import { Animated, StyleSheet, Text } from "react-native";
import { motion } from "@fitblock/design-tokens";
import { AnimatedTabBar, TabTransitionPanel } from "@/components/ui/tab-transition";

describe("transição de abas", () => {
  const options = [
    { label: "Atletas", testID: "tab-athletes", value: "athletes" },
    { label: "Equipes", testID: "tab-teams", value: "teams" }
  ] as const;

  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("atualiza a seleção imediatamente e não reinicia a aba já ativa", () => {
    const onChange = jest.fn();
    const screen = render(<AnimatedTabBar onChange={onChange} options={options} testID="tab-bar" value="athletes" />);

    expect(screen.getByTestId("tab-athletes").props.accessibilityState.selected).toBe(true);
    fireEvent.press(screen.getByTestId("tab-athletes"));
    expect(onChange).not.toHaveBeenCalled();

    fireEvent.press(screen.getByTestId("tab-teams"));
    expect(onChange).toHaveBeenCalledWith("teams");
  });

  it("mantém o conteúdo acessível durante a troca e centraliza o orçamento de movimento", () => {
    const screen = render(
      <TabTransitionPanel activeKey="athletes" order={["athletes", "teams"]} testID="tab-panel">
        <Text>Atletas</Text>
      </TabTransitionPanel>
    );

    expect(screen.getByTestId("tab-panel")).toBeTruthy();
    expect(screen.getByText("Atletas")).toBeTruthy();
    expect(motion.tab).toMatchObject({ enterMs: 220, exitMs: 140, offset: 8, pressMs: 120 });
  });

  it("dimensiona o indicador pela largura disponível, sem deslocar o layout", () => {
    const screen = render(<AnimatedTabBar onChange={jest.fn()} options={options} testID="tab-bar" value="athletes" />);

    fireEvent(screen.getByTestId("tab-bar"), "layout", { nativeEvent: { layout: { width: 240 } } });
    const indicator = screen.getByTestId("tab-bar-indicator");
    expect(StyleSheet.flatten(indicator.props.style).width).toBe(120);
  });

  it("restaura os valores finais quando reduzir movimento muda durante uma transição", () => {
    const setValue = jest.spyOn(Animated.Value.prototype, "setValue");
    const screen = render(
      <TabTransitionPanel activeKey="athletes" order={["athletes", "teams"]} reducedMotion={false} testID="tab-panel">
        <Text>Atletas</Text>
      </TabTransitionPanel>
    );

    screen.rerender(<TabTransitionPanel activeKey="teams" order={["athletes", "teams"]} reducedMotion={false} testID="tab-panel"><Text>Equipes</Text></TabTransitionPanel>);
    setValue.mockClear();
    screen.rerender(<TabTransitionPanel activeKey="teams" order={["athletes", "teams"]} reducedMotion testID="tab-panel"><Text>Equipes</Text></TabTransitionPanel>);

    expect(setValue).toHaveBeenCalledWith(1);
    expect(setValue).toHaveBeenCalledWith(0);
    setValue.mockRestore();
  });

  it("mantém somente o último painel em trocas rápidas A→B→A e remove a animação ao desabilitar", () => {
    const screen = render(
      <TabTransitionPanel activeKey="athletes" order={["athletes", "teams"]} reducedMotion={false} testID="tab-panel">
        <Text>Atletas</Text>
      </TabTransitionPanel>
    );

    screen.rerender(<TabTransitionPanel activeKey="teams" order={["athletes", "teams"]} reducedMotion={false} testID="tab-panel"><Text>Equipes</Text></TabTransitionPanel>);
    screen.rerender(<TabTransitionPanel activeKey="athletes" order={["athletes", "teams"]} reducedMotion testID="tab-panel"><Text>Atletas</Text></TabTransitionPanel>);
    expect(screen.getByText("Atletas")).toBeTruthy();

    screen.rerender(<TabTransitionPanel activeKey="athletes" enabled={false} order={["athletes", "teams"]} reducedMotion={false} testID="tab-panel"><Text>Atletas</Text></TabTransitionPanel>);
    expect(screen.queryByTestId("tab-panel")).toBeNull();
    expect(screen.getByText("Atletas")).toBeTruthy();
  });
});
