import type { SessionTemplateContent } from "@fitblock/backend";
import {
  addLibraryBlock,
  addLibraryItem,
  addLibrarySet,
  buildCreateTemplatePayload,
  buildDuplicateTitle,
  buildUpdateTemplatePayload,
  createInitialLibraryForm,
  removeLibraryBlock,
  removeLibraryItem,
  removeLibrarySet,
  summarizeLibraryForm,
  toLibraryForm,
  updateLibraryBlock,
  updateLibraryField,
  updateLibraryItem,
  updateLibrarySet,
  type LibraryTemplateForm
} from "@/data/coach-library";
import { createBlockForm, createItemForm, createSetForm } from "@/data/coach-calendar";

function buildForm(overrides: Partial<LibraryTemplateForm> = {}): LibraryTemplateForm {
  return { ...createInitialLibraryForm(), title: "Lower Strength", ...overrides };
}

describe("formulário de treino da biblioteca", () => {
  it("começa como rascunho com um bloco vazio", () => {
    const form = createInitialLibraryForm();
    expect(form.status).toBe("draft");
    expect(form.blocks).toHaveLength(1);
  });

  it("atualiza título e status sem afetar os blocos", () => {
    const form = createInitialLibraryForm();
    const next = updateLibraryField(updateLibraryField(form, "title", "Lower Strength"), "status", "published");
    expect(next.title).toBe("Lower Strength");
    expect(next.status).toBe("published");
    expect(next.blocks).toBe(form.blocks);
  });

  it("adiciona, atualiza e remove blocos mantendo o mínimo de um", () => {
    const form = buildForm();
    const withSecondBlock = addLibraryBlock(form);
    expect(withSecondBlock.blocks).toHaveLength(2);

    const renamed = updateLibraryBlock(withSecondBlock, withSecondBlock.blocks[0].id, { name: "Aquecimento" });
    expect(renamed.blocks[0].name).toBe("Aquecimento");

    const backToOne = removeLibraryBlock(renamed, renamed.blocks[0].id);
    expect(backToOne.blocks).toHaveLength(1);

    const stillOne = removeLibraryBlock(backToOne, backToOne.blocks[0].id);
    expect(stillOne.blocks).toHaveLength(1);
  });

  it("adiciona, atualiza e remove exercícios mantendo o mínimo de um por bloco", () => {
    const form = buildForm();
    const blockId = form.blocks[0].id;
    const withSecondItem = addLibraryItem(form, blockId);
    expect(withSecondItem.blocks[0].items).toHaveLength(2);

    const updated = updateLibraryItem(withSecondItem, blockId, withSecondItem.blocks[0].items[0].id, {
      exerciseName: "Back Squat"
    });
    expect(updated.blocks[0].items[0].exerciseName).toBe("Back Squat");

    const backToOne = removeLibraryItem(updated, blockId, updated.blocks[0].items[0].id);
    expect(backToOne.blocks[0].items).toHaveLength(1);
  });

  it("adiciona, atualiza e remove séries mantendo o mínimo de uma por exercício", () => {
    const form = buildForm();
    const blockId = form.blocks[0].id;
    const itemId = form.blocks[0].items[0].id;
    const withSecondSet = addLibrarySet(form, blockId, itemId);
    expect(withSecondSet.blocks[0].items[0].sets).toHaveLength(2);

    const updated = updateLibrarySet(withSecondSet, blockId, itemId, withSecondSet.blocks[0].items[0].sets[0].id, {
      reps: "8"
    });
    expect(updated.blocks[0].items[0].sets[0].reps).toBe("8");

    const backToOne = removeLibrarySet(updated, blockId, itemId, updated.blocks[0].items[0].sets[0].id);
    expect(backToOne.blocks[0].items[0].sets).toHaveLength(1);
  });

  it("resume blocos, exercícios e séries", () => {
    const form = buildForm();
    expect(summarizeLibraryForm(form)).toEqual({ blocks: 1, exercises: 1, sets: 1 });
  });

  it("exige título para montar o payload de criação", () => {
    expect(() => buildCreateTemplatePayload(createInitialLibraryForm())).toThrow(
      "Título do treino é obrigatório."
    );
  });

  it("monta o payload de criação com os blocos validados", () => {
    const form = buildForm({
      blocks: [
        createBlockForm({
          name: "Força principal",
          kind: "strength",
          items: [
            createItemForm({
              exerciseName: "Back Squat",
              restSeconds: "150",
              sets: [createSetForm({ reps: "5", load: "75" })]
            })
          ]
        })
      ]
    });

    expect(buildCreateTemplatePayload(form)).toEqual({
      title: "Lower Strength",
      status: "draft",
      blocks: [
        {
          name: "Força principal",
          kind: "strength",
          details: {},
          items: [
            {
              exerciseSlug: "back-squat",
              exerciseName: "Back Squat",
              prescription: {
                kind: "sets-reps",
                rest_seconds: 150,
                sets: [{ reps: 5, load_type: "percentage-1rm", load_value: 75 }]
              }
            }
          ]
        }
      ]
    });
  });

  it("monta o payload de edição com o templateId", () => {
    const form = buildForm({
      blocks: [
        createBlockForm({
          name: "Força principal",
          kind: "strength",
          items: [
            createItemForm({
              exerciseName: "Back Squat",
              restSeconds: "150",
              sets: [createSetForm({ reps: "5", load: "75" })]
            })
          ]
        })
      ]
    });
    const payload = buildUpdateTemplatePayload("template-01", form);
    expect(payload.templateId).toBe("template-01");
    expect(payload.title).toBe("Lower Strength");
  });

  it("sugere o título de cópia", () => {
    expect(buildDuplicateTitle("Lower Strength")).toBe("Lower Strength (cópia)");
  });

  it("hidrata o formulário a partir do conteúdo de um template", () => {
    const content: SessionTemplateContent = {
      template_id: "template-01",
      title: "Lower Strength",
      status: "published",
      blocks: [
        {
          name: "Força principal",
          kind: "strength",
          items: [
            {
              exercise_name: "Back Squat",
              prescription: {
                rest_seconds: 150,
                sets: [{ reps: 5, load_type: "percentage-1rm", load_value: 75 }]
              }
            }
          ]
        }
      ]
    };

    const form = toLibraryForm(content);
    expect(form.title).toBe("Lower Strength");
    expect(form.status).toBe("published");
    expect(form.blocks[0].name).toBe("Força principal");
    expect(form.blocks[0].items[0].exerciseName).toBe("Back Squat");
    expect(form.blocks[0].items[0].sets[0].reps).toBe("5");
  });
});
