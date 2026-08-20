import { fireEvent, render } from "@testing-library/react-native";
import { Dimensions } from "react-native";
import { ProgramWeekGrid } from "@/components/coach/program-week-grid";
import type { StoreProgramScheduleDay } from "@fitblock/backend";

jest.mock("@expo/vector-icons", () => ({
  Ionicons: () => null
}));

describe("ProgramWeekGrid", () => {
  const mockDays: StoreProgramScheduleDay[] = [
    {
      week_number: 1,
      day_number: 1,
      day_type: "training",
      session_template_id: "tpl-1",
      session_title: "Treino Superior"
    },
    {
      week_number: 1,
      day_number: 2,
      day_type: "rest",
      session_template_id: null,
      session_title: null
    },
    {
      week_number: 1,
      day_number: 3,
      day_type: "recovery",
      session_template_id: null,
      session_title: null
    },
    {
      week_number: 1,
      day_number: 4,
      day_type: "assessment",
      session_template_id: null,
      session_title: null
    },
    {
      week_number: 1,
      day_number: 5,
      day_type: "unprogrammed",
      session_template_id: null,
      session_title: null
    },
    {
      week_number: 1,
      day_number: 6,
      day_type: "unprogrammed",
      session_template_id: null,
      session_title: null
    },
    {
      week_number: 1,
      day_number: 7,
      day_type: "unprogrammed",
      session_template_id: null,
      session_title: null
    }
  ];

  it("renderiza o estado vazio quando a duração não foi definida", () => {
    const screen = render(
      <ProgramWeekGrid
        days={[]}
        onChange={jest.fn()}
        onOpenDayComposer={jest.fn()}
        templates={[]}
      />
    );

    expect(screen.getByTestId("program-week-grid-empty")).toBeTruthy();
    expect(screen.getByText("GRADE DE TREINOS")).toBeTruthy();
  });

  it("renderiza os cabeçalhos das 7 colunas (DIA 1 ao DIA 7) e a linha da semana", () => {
    const screen = render(
      <ProgramWeekGrid
        days={mockDays}
        onChange={jest.fn()}
        onOpenDayComposer={jest.fn()}
        templates={[]}
      />
    );

    expect(screen.getByTestId("program-week-grid")).toBeTruthy();
    expect(screen.getByTestId("grid-header-day-1")).toBeTruthy();
    expect(screen.getByTestId("grid-header-day-7")).toBeTruthy();
    expect(screen.getByText("DIA 1")).toBeTruthy();
    expect(screen.getByText("DIA 7")).toBeTruthy();
    expect(screen.getByText("S1")).toBeTruthy();
    expect(screen.getByText("Treino Superior")).toBeTruthy();
  });

  it("dispara onOpenDayComposer ao clicar na célula do dia", () => {
    const onOpen = jest.fn();
    const screen = render(
      <ProgramWeekGrid
        days={mockDays}
        onChange={jest.fn()}
        onOpenDayComposer={onOpen}
        templates={[]}
      />
    );

    fireEvent.press(screen.getByLabelText("Semana 1 Dia 1: Treino"));
    expect(onOpen).toHaveBeenCalledWith(0, 1, 1);
  });

  it("usa planejador vertical com seletor acessível no mobile", () => {
    jest.spyOn(Dimensions, "get").mockReturnValue({ width: 390, height: 844, scale: 3, fontScale: 1 });
    const onChange = jest.fn();
    const onOpen = jest.fn();
    const screen = render(
      <ProgramWeekGrid
        days={mockDays}
        mobilePresentation="weekly-planner"
        onChange={onChange}
        onOpenDayComposer={onOpen}
        templates={[]}
      />
    );

    expect(screen.queryByTestId("grid-header-day-1")).toBeNull();
    fireEvent.press(screen.getByLabelText("Abrir treino da Semana 1, Dia 1"));
    expect(onOpen).toHaveBeenCalledWith(0, 1, 1);
    fireEvent.press(screen.getByLabelText("Abrir treino da Semana 1, Dia 2"));
    expect(onOpen).toHaveBeenCalledWith(1, 1, 2);
    fireEvent.press(screen.getByLabelText("Alterar tipo do Dia 1: Treino"));
    fireEvent.press(screen.getByLabelText("Definir Dia 1 como Descanso"));
    expect(onChange).toHaveBeenCalledWith(expect.arrayContaining([expect.objectContaining({ day_number: 1, day_type: "rest" })]));
  });

  it("preserva a grade horizontal legada em telas compactas sem opt-in", () => {
    jest.spyOn(Dimensions, "get").mockReturnValue({ width: 390, height: 844, scale: 3, fontScale: 1 });
    const screen = render(<ProgramWeekGrid days={mockDays} onChange={jest.fn()} onOpenDayComposer={jest.fn()} templates={[]} />);

    expect(screen.getByTestId("program-week-grid-horizontal-scroll")).toBeTruthy();
    expect(screen.getByTestId("grid-header-day-1")).toBeTruthy();
  });

  it("mantém a programação ao alternar entre os layouts compacto e desktop", () => {
    const dimensions = jest.spyOn(Dimensions, "get");
    dimensions.mockReturnValue({ width: 390, height: 844, scale: 3, fontScale: 1 });
    const schedule = mockDays.map((day) => ({ ...day }));
    const screen = render(
      <ProgramWeekGrid
        days={schedule}
        mobilePresentation="weekly-planner"
        onChange={jest.fn()}
        onOpenDayComposer={jest.fn()}
        templates={[]}
      />
    );

    expect(screen.getByText("Dia 2")).toBeTruthy();
    dimensions.mockReturnValue({ width: 1200, height: 900, scale: 1, fontScale: 1 });
    screen.unmount();
    const desktopScreen = render(
      <ProgramWeekGrid
        days={schedule}
        mobilePresentation="weekly-planner"
        onChange={jest.fn()}
        onOpenDayComposer={jest.fn()}
        templates={[]}
      />
    );

    expect(desktopScreen.getByTestId("grid-header-day-1")).toBeTruthy();
    expect(desktopScreen.getByText("Treino Superior")).toBeTruthy();
  });

  it("permite alterar o tipo de dia através do seletor rápido", () => {
    const onChange = jest.fn();
    const screen = render(
      <ProgramWeekGrid
        days={mockDays}
        onChange={onChange}
        onOpenDayComposer={jest.fn()}
        templates={[]}
      />
    );

    // Clica no botão rápido "D" (Descanso) no Dia 1
    fireEvent.press(screen.getByTestId("cell-type-btn-1-1-rest"));
    expect(onChange).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          week_number: 1,
          day_number: 1,
          day_type: "rest"
        })
      ])
    );
  });
});
  beforeEach(() => jest.spyOn(Dimensions, "get").mockReturnValue({ width: 1200, height: 900, scale: 1, fontScale: 1 }));
