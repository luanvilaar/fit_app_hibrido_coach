export type TrainingGroupLevel = "iniciante" | "intermediário" | "avançado";

export type TrainingGroup = {
  id: string;
  name: string;
  description: string;
  level: TrainingGroupLevel;
  objective: string;
  coachIds: string[];
  athleteIds: string[];
};

export type SessionBlockKind = "warm-up" | "strength" | "conditioning" | "cooldown" | "custom";

export type LoadPrescription =
  | { type: "fixed"; value: number; unit: "kg" }
  | { type: "percentage-1rm"; value: number; unit: "%" };

export type EffortPrescription = { type: "rpe" | "rir"; value: number };

export type SetsAndRepsPrescription = {
  kind: "sets-reps";
  sets: number;
  reps: number | { min: number; max: number };
  load?: LoadPrescription;
  effort?: EffortPrescription;
  restSeconds?: number;
  notes?: string;
};

export type TimedPrescription = {
  kind: "timed";
  seconds: number;
  restSeconds?: number;
  notes?: string;
};

export type AmrapPrescription = {
  kind: "amrap";
  minutes: number;
  notes?: string;
};

export type Prescription = SetsAndRepsPrescription | TimedPrescription | AmrapPrescription;

export type SessionItem = {
  id: string;
  exerciseId: string;
  exerciseName: string;
  prescription: Prescription;
};

export type SessionBlock = {
  id: string;
  name: string;
  kind: SessionBlockKind;
  items: SessionItem[];
};

export type SessionTemplate = {
  id: string;
  title: string;
  blocks: SessionBlock[];
  status: "draft" | "published";
};

export type SessionInstance = {
  id: string;
  templateId: string;
  groupId: string;
  athleteIds: string[];
  scheduledDate: string;
  status: "draft" | "published";
  blocks: SessionBlock[];
};

type CreateTrainingGroupInput = Omit<TrainingGroup, "coachIds" | "athleteIds">;

type AddGroupMembersInput = {
  coachIds?: string[];
  athleteIds?: string[];
};

type CreateSessionTemplateInput = Omit<SessionTemplate, "status"> & {
  status?: SessionTemplate["status"];
};

type ApplySessionInput = {
  id: string;
  scheduledDate: string;
  status?: SessionInstance["status"];
};

function requireText(value: string, field: string): string {
  const normalized = value.trim();

  if (!normalized) {
    throw new Error(`${field} é obrigatório.`);
  }

  return normalized;
}

function normalizeIds(ids: string[]): string[] {
  if (ids.some((id) => !id.trim())) {
    throw new Error("Membros precisam ter um identificador válido.");
  }

  return [...new Set(ids)];
}

function clonePrescription(prescription: Prescription): Prescription {
  return {
    ...prescription,
    ...(prescription.kind === "sets-reps" && typeof prescription.reps === "object"
      ? { reps: { ...prescription.reps } }
      : {}),
    ...(prescription.kind === "sets-reps" && prescription.load ? { load: { ...prescription.load } } : {}),
    ...(prescription.kind === "sets-reps" && prescription.effort
      ? { effort: { ...prescription.effort } }
      : {})
  };
}

function cloneBlocks(blocks: SessionBlock[]): SessionBlock[] {
  return blocks.map((block) => ({
    ...block,
    items: block.items.map((item) => ({
      ...item,
      prescription: clonePrescription(item.prescription)
    }))
  }));
}

function validateBlocks(blocks: SessionBlock[]): void {
  if (blocks.length === 0) {
    throw new Error("A sessão precisa ter pelo menos um bloco.");
  }

  blocks.forEach((block) => {
    requireText(block.id, "ID do bloco");
    requireText(block.name, "Nome do bloco");

    if (block.items.length === 0) {
      throw new Error(`O bloco ${block.name} precisa ter pelo menos um exercício.`);
    }

    block.items.forEach((item) => {
      requireText(item.id, "ID do exercício");
      requireText(item.exerciseId, "Exercício");
      requireText(item.exerciseName, "Nome do exercício");
    });
  });
}

export function createTrainingGroup(input: CreateTrainingGroupInput): TrainingGroup {
  return {
    id: requireText(input.id, "ID da equipe"),
    name: requireText(input.name, "Nome da equipe"),
    description: requireText(input.description, "Descrição da equipe"),
    level: input.level,
    objective: requireText(input.objective, "Objetivo da equipe"),
    coachIds: [],
    athleteIds: []
  };
}

export function addGroupMembers(group: TrainingGroup, input: AddGroupMembersInput): TrainingGroup {
  return {
    ...group,
    coachIds: normalizeIds([...group.coachIds, ...(input.coachIds ?? [])]),
    athleteIds: normalizeIds([...group.athleteIds, ...(input.athleteIds ?? [])])
  };
}

export function createSessionTemplate(input: CreateSessionTemplateInput): SessionTemplate {
  requireText(input.id, "ID da sessão");
  requireText(input.title, "Título da sessão");
  validateBlocks(input.blocks);

  return {
    id: input.id,
    title: input.title.trim(),
    blocks: cloneBlocks(input.blocks),
    status: input.status ?? "draft"
  };
}

export function applySessionToGroup(
  group: TrainingGroup,
  template: SessionTemplate,
  input: ApplySessionInput
): SessionInstance {
  if (group.athleteIds.length === 0) {
    throw new Error("Adicione pelo menos um atleta antes de aplicar a sessão.");
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.scheduledDate)) {
    throw new Error("A sessão precisa de uma data no formato AAAA-MM-DD.");
  }

  return {
    id: requireText(input.id, "ID da instância"),
    templateId: template.id,
    groupId: group.id,
    athleteIds: [...group.athleteIds],
    scheduledDate: input.scheduledDate,
    status: input.status ?? "draft",
    blocks: cloneBlocks(template.blocks)
  };
}

export function updateSessionInstancePrescription(
  instance: SessionInstance,
  blockId: string,
  itemId: string,
  prescription: Prescription
): SessionInstance {
  let itemUpdated = false;
  const blocks = instance.blocks.map((block) => {
    if (block.id !== blockId) {
      return block;
    }

    return {
      ...block,
      items: block.items.map((item) => {
        if (item.id !== itemId) {
          return item;
        }

        itemUpdated = true;
        return { ...item, prescription: clonePrescription(prescription) };
      })
    };
  });

  if (!itemUpdated) {
    throw new Error("Exercício não encontrado na instância da sessão.");
  }

  return { ...instance, blocks };
}
