import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react-native";
import type { ExerciseRecord, TrainingGroupRecord } from "@fitblock/backend";
import { SessionComposer } from "@/components/coach-hibrido/session-composer";
import { createInitialSessionForm, type SessionForm } from "@/data/coach-hibrido/session-form";

const catalog: ExerciseRecord[] = [
  {
    id: "ex-1",
    slug: "front-squat",
    name: "Front Squat",
    video_url: "https://youtu.be/abc",
    category: "forca-acessorios",
    created_by: null,
    created_at: "2026-08-11T00:00:00.000Z"
  },
  {
    id: "ex-2",
    slug: "front-squat-machine",
    name: "Front Squat Machine",
    video_url: null,
    category: "forca-acessorios",
    created_by: null,
    created_at: "2026-08-11T00:00:00.000Z"
  }
];

const teams: TrainingGroupRecord[] = [
  {
    id: "team-1",
    name: "Strength Base",
    description: "",
    level: "intermediário",
    objective: "Força",
    created_by: "coach-1",
    created_at: "2026-08-11T00:00:00.000Z"
  }
];

const onSubmit = jest.fn();

/** Envolve o compositor num estado real: os reducers são o que está sob teste. */
function Harness({ initial }: { initial?: SessionForm }) {
  const [form, setForm] = useState<SessionForm>(
    () => initial ?? { ...createInitialSessionForm("team-1"), title: "Terça pesada" }
  );

  return (
    <SessionComposer
      catalog={catalog}
      form={form}
      isDeleting={false}
      isSaving={false}
      mode="create"
      onChange={setForm}
      onSubmit={onSubmit}
      submitLabel="Publicar no calendário"
      teams={teams}
    />
  );
}

describe("SessionComposer", () => {
  beforeEach(() => jest.clearAllMocks());

  it("abre vazio convidando a escolher o primeiro bloco", () => {
    render(<Harness />);

    expect(screen.getByText("Comece pelo primeiro bloco")).toBeTruthy();
    expect(screen.getByTestId("session-summary")).toHaveTextContent("0 blocos · 0 movimentos vinculados · 0 blocos pontuados");
  });

  it("oferece as nove categorias de bloco", () => {
    render(<Harness />);

    ["warm-up", "strength", "lpo", "conditioning", "metcon", "endurance", "gymnastics-skill", "gymnastics-conditioning", "cooldown"].forEach(
      (kind) => expect(screen.getByTestId(`add-block-${kind}`)).toBeTruthy()
    );
  });

  it("esconde as categorias atrás de um botão depois do primeiro bloco, e reabre ao tocar", () => {
    render(<Harness />);
    fireEvent.press(screen.getByTestId("add-block-warm-up"));

    expect(screen.queryByTestId("add-block-strength")).toBeNull();
    expect(screen.getByTestId("block-picker-toggle")).toBeTruthy();

    fireEvent.press(screen.getByTestId("block-picker-toggle"));
    expect(screen.getByTestId("add-block-strength")).toBeTruthy();
  });

  it("adiciona um bloco com o rótulo da categoria e a ordem A", () => {
    render(<Harness />);
    fireEvent.press(screen.getByTestId("add-block-strength"));

    expect(screen.getByTestId("block-0-name").props.value).toBe("Força & Acessórios");
    expect(screen.getByText("A")).toBeTruthy();
  });

  it("soma o volume do texto do bloco de força", () => {
    render(<Harness />);
    fireEvent.press(screen.getByTestId("add-block-strength"));
    fireEvent.changeText(screen.getByTestId("block-0-body"), "4 x 3-5\n3 x 10");

    expect(screen.getByTestId("block-0-volume-value")).toHaveTextContent("7 séries · 46 reps");
  });

  it("deixa o coach assumir o volume e voltar ao cálculo", () => {
    render(<Harness />);
    fireEvent.press(screen.getByTestId("add-block-strength"));
    fireEvent.changeText(screen.getByTestId("block-0-body"), "4 x 3-5");

    fireEvent.press(screen.getByTestId("block-0-volume-manual"));
    fireEvent.changeText(screen.getByTestId("block-0-volume-sets"), "14");
    fireEvent.changeText(screen.getByTestId("block-0-volume-reps"), "102");
    expect(screen.getByTestId("block-0-volume-sets").props.value).toBe("14");

    fireEvent.press(screen.getByTestId("block-0-volume-auto"));
    expect(screen.getByTestId("block-0-volume-value")).toHaveTextContent("4 séries · 16 reps");
  });

  it("não mostra volume em categoria que não tem esse controle", () => {
    render(<Harness />);
    fireEvent.press(screen.getByTestId("add-block-metcon"));

    expect(screen.queryByTestId("block-0-volume-value")).toBeNull();
  });

  it("sugere movimentos do catálogo ao digitar @ e insere o nome completo", () => {
    render(<Harness />);
    fireEvent.press(screen.getByTestId("add-block-strength"));

    const body = screen.getByTestId("block-0-body");
    fireEvent(body, "focus");
    fireEvent.changeText(body, "@Fro");
    fireEvent(body, "selectionChange", { nativeEvent: { selection: { start: 4, end: 4 } } });

    expect(screen.getByTestId("block-0-body-suggestion-front-squat")).toBeTruthy();
    fireEvent.press(screen.getByTestId("block-0-body-suggestion-front-squat"));

    expect(screen.getByTestId("block-0-body").props.value).toBe("@Front Squat ");
  });

  it("lista o movimento vinculado e o conta no resumo", () => {
    render(<Harness />);
    fireEvent.press(screen.getByTestId("add-block-strength"));
    fireEvent.changeText(screen.getByTestId("block-0-body"), "@Front Squat\n4 x 5");

    expect(screen.getByTestId("block-0-movements-front-squat")).toBeTruthy();
    expect(screen.getByTestId("session-summary")).toHaveTextContent("1 bloco · 1 movimento vinculado · 0 blocos pontuados");
  });

  it("avisa quando o termo digitado não existe no catálogo", () => {
    render(<Harness />);
    fireEvent.press(screen.getByTestId("add-block-strength"));

    const body = screen.getByTestId("block-0-body");
    fireEvent(body, "focus");
    fireEvent.changeText(body, "@Zercher");
    fireEvent(body, "selectionChange", { nativeEvent: { selection: { start: 8, end: 8 } } });

    expect(screen.getByTestId("block-0-body-no-suggestions")).toBeTruthy();
  });

  it("mostra dinâmica de tempo e ranking obrigatório no metcon", () => {
    render(<Harness />);
    fireEvent.press(screen.getByTestId("add-block-metcon"));

    expect(screen.getByTestId("block-0-protocol-for-time")).toBeTruthy();
    expect(screen.getByTestId("block-0-score-time")).toBeTruthy();
    expect(screen.queryByTestId("block-0-ranking-toggle")).toBeNull();
  });

  it("troca o placar sugerido quando o protocolo vira AMRAP", () => {
    render(<Harness />);
    fireEvent.press(screen.getByTestId("add-block-metcon"));
    fireEvent.press(screen.getByTestId("block-0-protocol-amrap"));

    expect(screen.getByTestId("block-0-score-rounds-reps").props.accessibilityState.selected).toBe(true);
    expect(screen.getByTestId("block-0-protocol-duration")).toBeTruthy();
  });

  it("deixa o ranking opcional desligado no bloco de força", () => {
    render(<Harness />);
    fireEvent.press(screen.getByTestId("add-block-strength"));

    expect(screen.getByTestId("block-0-ranking-toggle")).toBeTruthy();
    expect(screen.queryByTestId("block-0-score-load")).toBeNull();

    fireEvent.press(screen.getByTestId("block-0-ranking-toggle"));
    expect(screen.getByTestId("block-0-score-load")).toBeTruthy();
  });

  it("pede modalidade no bloco de endurance", () => {
    render(<Harness />);
    fireEvent.press(screen.getByTestId("add-block-endurance"));

    expect(screen.getByTestId("block-0-modality-run")).toBeTruthy();
    expect(screen.queryByTestId("block-0-volume-run")).toBeNull();

    fireEvent.press(screen.getByTestId("block-0-modality-run"));
    expect(screen.getByTestId("block-0-volume-run")).toBeTruthy();
  });

  it("reordena e remove blocos preservando a ordem de treino", () => {
    render(<Harness />);
    fireEvent.press(screen.getByTestId("add-block-warm-up"));
    fireEvent.press(screen.getByTestId("block-picker-toggle"));
    fireEvent.press(screen.getByTestId("add-block-strength"));

    expect(screen.getByTestId("block-0-name").props.value).toBe("Aquecimento");
    fireEvent.press(screen.getByTestId("block-1-move-up"));
    expect(screen.getByTestId("block-0-name").props.value).toBe("Força & Acessórios");

    fireEvent.press(screen.getByTestId("block-1-remove"));
    expect(screen.queryByTestId("block-1")).toBeNull();
  });

  it("trocar a categoria preserva o texto já escrito", () => {
    render(<Harness />);
    fireEvent.press(screen.getByTestId("add-block-conditioning"));
    fireEvent.changeText(screen.getByTestId("block-0-body"), "3 rounds\n400m");

    fireEvent.press(screen.getByTestId("block-0-kind"));
    fireEvent.press(screen.getByTestId("block-0-kind-metcon"));

    expect(screen.getByTestId("block-0-body").props.value).toBe("3 rounds\n400m");
    expect(screen.getByTestId("block-0-name").props.value).toBe("Metcon");
  });

  it("aciona o envio pela ação principal", () => {
    render(<Harness />);
    fireEvent.press(screen.getByTestId("session-submit"));

    expect(onSubmit).toHaveBeenCalledTimes(1);
  });
});
