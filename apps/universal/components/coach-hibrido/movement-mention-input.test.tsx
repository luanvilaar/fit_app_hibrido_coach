import { useState } from "react";
import { StyleSheet, Text, type TextStyle, type ViewStyle } from "react-native";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import type { CreateExerciseRequest, ExerciseRecord } from "@fitblock/backend";
import { colors } from "@fitblock/design-tokens";
import { withMovement } from "@/data/coach-hibrido/movement-bank";
import { MovementMentionInput, PANEL_ELEVATION } from "@/components/coach-hibrido/movement-mention-input";

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
  },
  {
    id: "ex-3",
    slug: "thruster",
    name: "Thruster",
    video_url: "https://youtu.be/def",
    category: "forca-acessorios",
    created_by: null,
    created_at: "2026-08-11T00:00:00.000Z"
  }
];

type CreateMovement = (input: CreateExerciseRequest) => Promise<ExerciseRecord>;

/** O que o backend devolveria para o movimento recém-inserido. */
function saved(input: CreateExerciseRequest): ExerciseRecord {
  return {
    id: `ex-${input.slug}`,
    slug: input.slug,
    name: input.name,
    video_url: input.videoUrl,
    category: input.category,
    created_by: "coach-1",
    created_at: "2026-08-13T00:00:00.000Z"
  };
}

/** Espelha a tela real: o catálogo em memória recebe o movimento cadastrado. */
function Harness({
  initial = "",
  onCreateMovement,
  onPanelOpenChange
}: {
  initial?: string;
  onCreateMovement?: CreateMovement;
  onPanelOpenChange?: (isOpen: boolean) => void;
}) {
  const [value, setValue] = useState(initial);
  const [bank, setBank] = useState(catalog);

  return (
    <MovementMentionInput
      accessibilityLabel="Treino do bloco A"
      catalog={bank}
      onChangeText={setValue}
      onCreateMovement={
        onCreateMovement &&
        (async (input) => {
          const created = await onCreateMovement(input);
          setBank((current) => withMovement(current, created));
          return created;
        })
      }
      onPanelOpenChange={onPanelOpenChange}
      placeholder="Escreva o treino"
      testID="body"
      value={value}
    />
  );
}

/** O campo é transparente; quem carrega o texto lido na tela é o espelho colorido. */
function mirrorText(): string {
  const [mirror] = screen.UNSAFE_getAllByType(Text);
  return flattenText(mirror.props.children);
}

function flattenText(node: unknown): string {
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(flattenText).join("");
  if (node && typeof node === "object" && "props" in node) {
    return flattenText((node as { props: { children?: unknown } }).props.children);
  }
  return "";
}

function focusWithCursor(value: string) {
  fireEvent(screen.getByTestId("body"), "focus");
  fireEvent(screen.getByTestId("body"), "selectionChange", {
    nativeEvent: { selection: { start: value.length, end: value.length } }
  });
}

function pressKey(key: string) {
  fireEvent(screen.getByTestId("body"), "keyPress", { nativeEvent: { key }, preventDefault: jest.fn() });
}

/**
 * O espelho é deliberadamente invisível para a acessibilidade — o leitor de tela lê o campo,
 * não a cópia colorida — e por isso as queries precisam pedir para enxergar o que está oculto.
 */
function mirrorNode(testID: string) {
  return screen.getByTestId(testID, { includeHiddenElements: true });
}

/** O layout não roda no ambiente de teste; a medida do texto entra por aqui. */
function measure(testID: string, height: number) {
  fireEvent(mirrorNode(testID), "layout", {
    nativeEvent: { layout: { height, width: 320, x: 0, y: 0 } }
  });
}

function panelTop(): number | undefined {
  return (StyleSheet.flatten(screen.getByTestId("body-panel").props.style) as ViewStyle).top as
    | number
    | undefined;
}

function formError(): string {
  return flattenText(screen.getByTestId("body-form-error").props.children);
}

function canvasZIndex(): number | undefined {
  return (StyleSheet.flatten(screen.getByTestId("body-canvas").props.style) as ViewStyle).zIndex as
    | number
    | undefined;
}

describe("campo de menção de movimento", () => {
  it("espelha o texto do campo caractere por caractere, com o @ que o atleta não vê", () => {
    render(<Harness initial={"@Front Squat\n4 x 3-5"} />);

    expect(mirrorText()).toContain("@Front Squat\n4 x 3-5");
  });

  it("pinta a menção com a cor de link assim que o nome fecha", () => {
    render(<Harness initial="@Front Squat" />);

    const mention = mirrorNode("body-before-mention-front-squat");
    expect(StyleSheet.flatten(mention.props.style as TextStyle).color).toBe(colors.mentionLink);
  });

  it("não promete link para movimento sem vídeo cadastrado", () => {
    render(<Harness initial="@Front Squat Machine" />);

    const mention = mirrorNode("body-before-mention-front-squat-machine");
    expect(StyleSheet.flatten(mention.props.style as TextStyle).color).toBe(colors.mentionDraft);
  });

  it("marca a menção em digitação sem prometer que já virou link", () => {
    render(<Harness initial="@thrus" />);
    focusWithCursor("@thrus");

    const draft = mirrorNode("body-draft");
    expect(flattenText(draft.props.children)).toBe("@thrus");
    expect(StyleSheet.flatten(draft.props.style as TextStyle).color).toBe(colors.mentionDraft);
  });

  it("insere a sugestão ativa com Enter em vez de quebrar a linha", () => {
    render(<Harness initial="@thrus" />);
    focusWithCursor("@thrus");

    expect(screen.getByTestId("body-suggestions")).toBeTruthy();
    pressKey("Enter");

    expect(screen.getByTestId("body").props.value).toBe("@Thruster ");
  });

  it("percorre as sugestões com a seta para baixo antes de inserir", () => {
    render(<Harness initial="@front" />);
    focusWithCursor("@front");

    pressKey("ArrowDown");
    pressKey("Enter");

    expect(screen.getByTestId("body").props.value).toBe("@Front Squat Machine ");
  });

  it("fecha a lista com Esc sem apagar o que o coach escreveu", () => {
    render(<Harness initial="@front" />);
    focusWithCursor("@front");

    pressKey("Escape");

    expect(screen.queryByTestId("body-suggestions")).toBeNull();
    expect(screen.getByTestId("body").props.value).toBe("@front");
  });

  it("não abre a lista enquanto o coach escreve as séries depois do movimento", () => {
    render(<Harness initial="@Front Squat 4 x" />);
    focusWithCursor("@Front Squat 4 x");

    expect(screen.queryByTestId("body-suggestions")).toBeNull();
  });

  it("cala a lista quando o nome digitado já é um movimento inteiro", () => {
    render(<Harness initial="@Thruster" onCreateMovement={async (input) => saved(input)} />);
    focusWithCursor("@Thruster");

    expect(screen.queryByTestId("body-panel")).toBeNull();
  });
});

describe("ancoragem do painel", () => {
  const body = "linha um\nlinha dois\n@thrus";

  it("abre logo abaixo da linha onde o @ está, e não no fim do bloco", () => {
    render(<Harness initial={body} />);
    focusWithCursor(body);

    // Texto até o @: três linhas de 22 entre os 12 de recheio de cima e de baixo.
    measure("body-ruler", 12 + 3 * 22 + 12);

    // Base da linha (90 − 12) mais um terço de linha de respiro.
    expect(panelTop()).toBe(78 + 7);
  });

  it("sobe para cima da linha quando não cabe abaixo dela", () => {
    render(<Harness initial={body} />);
    focusWithCursor(body);

    measure("body-ruler", 200);
    measure("body-panel", 120);
    measure("body-canvas", 210);

    // Topo da linha do @ (188 − 22) menos o respiro e a altura do painel.
    expect(panelTop()).toBe(166 - 7 - 120);
  });
});

describe("cadastro de movimento pelo painel", () => {
  it("oferece o cadastro quando o catálogo não tem o movimento", () => {
    render(<Harness initial="@Bulgarian Squat" onCreateMovement={async (input) => saved(input)} />);
    focusWithCursor("@Bulgarian Squat");

    expect(screen.getByTestId("body-no-suggestions")).toBeTruthy();
    expect(screen.getByTestId("body-create")).toBeTruthy();
  });

  it("não oferece cadastro quando a tela não sabe cadastrar", () => {
    render(<Harness initial="@Bulgarian Squat" />);
    focusWithCursor("@Bulgarian Squat");

    expect(screen.queryByTestId("body-create")).toBeNull();
    expect(screen.getByTestId("body-no-suggestions")).toBeTruthy();
  });

  it("alcança o cadastro pelo teclado, depois das sugestões", () => {
    render(<Harness initial="@front" onCreateMovement={async (input) => saved(input)} />);
    focusWithCursor("@front");

    pressKey("ArrowDown");
    pressKey("ArrowDown");
    pressKey("Enter");

    expect(screen.getByTestId("body-form")).toBeTruthy();
    expect(screen.getByTestId("body-form-name").props.value).toBe("front");
  });

  it("salva o movimento e insere a menção já vinculada ao texto", async () => {
    const create = jest.fn<Promise<ExerciseRecord>, [CreateExerciseRequest]>(async (input) =>
      saved(input)
    );
    render(<Harness initial="@Bulgarian Squat" onCreateMovement={create} />);
    focusWithCursor("@Bulgarian Squat");

    fireEvent.press(screen.getByTestId("body-create"));
    fireEvent.press(screen.getByTestId("body-form-category-forca-lpo"));
    fireEvent.changeText(screen.getByTestId("body-form-video"), "https://youtu.be/xyz");
    fireEvent.press(screen.getByTestId("body-form-save"));

    await waitFor(() =>
      expect(screen.getByTestId("body").props.value).toBe("@Bulgarian Squat ")
    );

    expect(create).toHaveBeenCalledWith({
      slug: "bulgarian-squat",
      name: "Bulgarian Squat",
      category: "forca-lpo",
      videoUrl: "https://youtu.be/xyz"
    });
    expect(screen.queryByTestId("body-form")).toBeNull();
    // O movimento entrou no catálogo: a menção acende como link no espelho.
    expect(mirrorNode("body-before-mention-bulgarian-squat")).toBeTruthy();
  });

  it("cobra o link antes de aceitar um movimento sem vídeo", async () => {
    const create = jest.fn<Promise<ExerciseRecord>, [CreateExerciseRequest]>(async (input) =>
      saved(input)
    );
    render(<Harness initial="@Bulgarian Squat" onCreateMovement={create} />);
    focusWithCursor("@Bulgarian Squat");

    fireEvent.press(screen.getByTestId("body-create"));
    fireEvent.press(screen.getByTestId("body-form-save"));

    expect(create).not.toHaveBeenCalled();
    expect(formError()).toMatch(/sem link/i);

    fireEvent.press(screen.getByTestId("body-form-save"));

    await waitFor(() => expect(create).toHaveBeenCalledTimes(1));
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ videoUrl: null }));
  });

  it("recusa link que o banco recusaria, sem chegar a chamar o banco", () => {
    const create = jest.fn<Promise<ExerciseRecord>, [CreateExerciseRequest]>(async (input) =>
      saved(input)
    );
    render(<Harness initial="@Bulgarian Squat" onCreateMovement={create} />);
    focusWithCursor("@Bulgarian Squat");

    fireEvent.press(screen.getByTestId("body-create"));
    fireEvent.changeText(screen.getByTestId("body-form-video"), "youtu.be/xyz");
    fireEvent.press(screen.getByTestId("body-form-save"));

    expect(create).not.toHaveBeenCalled();
    expect(formError()).toMatch(/https:\/\//);
  });

  it("traduz o erro do banco em vez de repetir a violação de constraint", async () => {
    const create = jest.fn<Promise<ExerciseRecord>, [CreateExerciseRequest]>(async () => {
      throw new Error('duplicate key value violates unique constraint "exercises_slug_key"');
    });
    render(<Harness initial="@Bulgarian Squat" onCreateMovement={create} />);
    focusWithCursor("@Bulgarian Squat");

    fireEvent.press(screen.getByTestId("body-create"));
    fireEvent.changeText(screen.getByTestId("body-form-video"), "https://youtu.be/xyz");
    fireEvent.press(screen.getByTestId("body-form-save"));

    await waitFor(() => expect(formError()).toMatch(/já está no banco/));
    expect(screen.getByTestId("body-form")).toBeTruthy();
  });

  it("fecha o cadastro quando o coach volta a escrever o treino", () => {
    render(<Harness initial="@Bulgarian Squat" onCreateMovement={async (input) => saved(input)} />);
    focusWithCursor("@Bulgarian Squat");

    fireEvent.press(screen.getByTestId("body-create"));
    expect(screen.getByTestId("body-form")).toBeTruthy();

    fireEvent.changeText(screen.getByTestId("body"), "@Bulgarian Squats");

    expect(screen.queryByTestId("body-form")).toBeNull();
  });
});

describe("camada do painel", () => {
  it("sobe de zIndex enquanto a lista de sugestões está aberta, e volta ao fechar", () => {
    render(<Harness initial="@front" />);
    expect(canvasZIndex()).toBeUndefined();

    focusWithCursor("@front");
    expect(canvasZIndex()).toBe(PANEL_ELEVATION);

    pressKey("Escape");
    expect(canvasZIndex()).toBeUndefined();
  });

  it("sobe de zIndex enquanto o formulário de cadastro está aberto", () => {
    render(<Harness initial="@Bulgarian Squat" onCreateMovement={async (input) => saved(input)} />);
    focusWithCursor("@Bulgarian Squat");

    fireEvent.press(screen.getByTestId("body-create"));

    expect(canvasZIndex()).toBe(PANEL_ELEVATION);
  });

  it("avisa o bloco pai quando o painel abre e fecha", () => {
    const onPanelOpenChange = jest.fn();
    render(<Harness initial="@front" onPanelOpenChange={onPanelOpenChange} />);

    expect(onPanelOpenChange).toHaveBeenLastCalledWith(false);

    focusWithCursor("@front");
    expect(onPanelOpenChange).toHaveBeenLastCalledWith(true);

    pressKey("Escape");
    expect(onPanelOpenChange).toHaveBeenLastCalledWith(false);
  });
});
