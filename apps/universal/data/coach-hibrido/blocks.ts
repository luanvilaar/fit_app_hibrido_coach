/**
 * Catálogo de blocos do Coach Híbrido.
 *
 * Cada bloco é uma folha de texto livre. O que muda entre categorias não é o formato
 * da escrita — é qual metadado a categoria cobra do coach: volume, protocolo ou ranking.
 */

export const blockKinds = [
  "warm-up",
  "strength",
  "lpo",
  "conditioning",
  "metcon",
  "endurance",
  "gymnastics-skill",
  "gymnastics-conditioning",
  "cooldown"
] as const;

export type BlockKind = (typeof blockKinds)[number];

export function isBlockKind(value: string): value is BlockKind {
  return (blockKinds as readonly string[]).includes(value);
}

/** Exigência de ranking da categoria: obrigatório, opcional ou inexistente. */
export type RankingRule = "required" | "optional" | "none";

export type BlockDefinition = {
  kind: BlockKind;
  label: string;
  /** Uma linha explicando quando o coach escolhe esta categoria. */
  purpose: string;
  /** Texto de exemplo dentro da caixa de escrita. */
  placeholder: string;
  /** Soma séries e repetições a partir do texto (Força e LPO). */
  strengthVolume: boolean;
  /** Controle de volume por modalidade: corrida, remo e bike. */
  enduranceVolume: boolean;
  /** Dinâmica de tempo: for time, AMRAP, EMOM ou intervalado. */
  protocol: boolean;
  ranking: RankingRule;
};

const definitions: Record<BlockKind, BlockDefinition> = {
  "warm-up": {
    kind: "warm-up",
    label: "Aquecimento",
    purpose: "Preparação antes do trabalho principal",
    placeholder: "2 rounds\n10 Air Squat\n10 Band Pull Apart\n200m de corrida leve",
    strengthVolume: false,
    enduranceVolume: false,
    protocol: false,
    ranking: "none"
  },
  strength: {
    kind: "strength",
    label: "Força & Acessórios",
    purpose: "Séries e repetições com carga, e o volume total da sessão",
    placeholder:
      "@Front Squat\n4 x 3-5\ntrabalhe com cargas pesadas.\ndescanse 90seg entre as séries.",
    strengthVolume: true,
    enduranceVolume: false,
    protocol: false,
    ranking: "optional"
  },
  lpo: {
    kind: "lpo",
    label: "Levantamento Olímpico",
    purpose: "Arranco, arremesso e derivados, em percentual ou carga fixa",
    placeholder: "@Snatch\n5 x 2 @ 75%\ncada série a cada 90seg.",
    strengthVolume: true,
    enduranceVolume: false,
    protocol: false,
    ranking: "optional"
  },
  conditioning: {
    kind: "conditioning",
    label: "Condicionamento",
    purpose: "Trabalho contínuo ou intervalado com ranking da equipe",
    placeholder: "3 rounds\n400m de corrida\n15 @Wall Ball\n10 @Burpee Over Bar",
    strengthVolume: false,
    enduranceVolume: false,
    protocol: true,
    ranking: "required"
  },
  metcon: {
    kind: "metcon",
    label: "Metcon",
    purpose: "Condicionamento metabólico curto e intenso, sempre pontuado",
    placeholder: "21-15-9\n@Thruster 43/30kg\n@Pull Up",
    strengthVolume: false,
    enduranceVolume: false,
    protocol: true,
    ranking: "required"
  },
  endurance: {
    kind: "endurance",
    label: "Endurance",
    purpose: "Motor aeróbico com volume controlado de corrida, remo e bike",
    placeholder: "5km em ritmo confortável\nmantenha o pace abaixo de 5:30/km.",
    strengthVolume: false,
    enduranceVolume: true,
    protocol: false,
    ranking: "required"
  },
  "gymnastics-skill": {
    kind: "gymnastics-skill",
    label: "Skill Ginástico",
    purpose: "Técnica ginástica sem pressa e sem pontuação obrigatória",
    placeholder: "@Strict Handstand Push Up\n5 x 3\nqualidade acima de velocidade.",
    strengthVolume: false,
    enduranceVolume: false,
    protocol: false,
    ranking: "optional"
  },
  "gymnastics-conditioning": {
    kind: "gymnastics-conditioning",
    label: "Condicionamento Ginástico",
    purpose: "Volume ginástico sob fadiga, com ranking da equipe",
    placeholder: "AMRAP 10min\n5 @Chest To Bar\n10 @Toes To Bar\n15 @Push Up",
    strengthVolume: false,
    enduranceVolume: false,
    protocol: true,
    ranking: "required"
  },
  cooldown: {
    kind: "cooldown",
    label: "Mobilidade & Recovery",
    purpose: "Volta à calma, alongamento e trabalho respiratório",
    placeholder: "2 min de respiração nasal\n1 min por lado de @Couch Stretch",
    strengthVolume: false,
    enduranceVolume: false,
    protocol: false,
    ranking: "none"
  }
};

export function blockDefinition(kind: BlockKind): BlockDefinition {
  return definitions[kind];
}

export const blockDefinitions: readonly BlockDefinition[] = blockKinds.map((kind) => definitions[kind]);

export function blockLabel(kind: BlockKind): string {
  return definitions[kind].label;
}

export function supportsRanking(kind: BlockKind): boolean {
  return definitions[kind].ranking !== "none";
}

export function rankingRequired(kind: BlockKind): boolean {
  return definitions[kind].ranking === "required";
}

/* ------------------------------------------------------------------ protocolo */

export const protocolTypes = ["for-time", "amrap", "emom", "intervals"] as const;
export type ProtocolType = (typeof protocolTypes)[number];

export const protocolLabels: Record<ProtocolType, string> = {
  "for-time": "For time",
  amrap: "AMRAP",
  emom: "EMOM",
  intervals: "Intervalado"
};

/* -------------------------------------------------------------------- ranking */

export const scoreTypes = ["time", "rounds-reps", "reps", "load"] as const;
export type ScoreType = (typeof scoreTypes)[number];

export const scoreTypeLabels: Record<ScoreType, string> = {
  time: "Menor tempo",
  "rounds-reps": "Rounds + reps",
  reps: "Mais repetições",
  load: "Maior carga"
};

export const scoreTypeHints: Record<ScoreType, string> = {
  time: "Vence quem terminar primeiro",
  "rounds-reps": "Vence quem completar mais voltas",
  reps: "Vence quem somar mais repetições",
  load: "Vence quem levantar mais peso"
};

export function isScoreType(value: string): value is ScoreType {
  return (scoreTypes as readonly string[]).includes(value);
}

/** O protocolo determina o placar natural; o coach ainda pode trocar. */
export function suggestedScoreType(kind: BlockKind, protocol: ProtocolType | null): ScoreType {
  if (protocol === "amrap" || protocol === "emom") return "rounds-reps";
  if (protocol === "intervals") return "reps";
  if (protocol === "for-time") return "time";
  if (kind === "strength" || kind === "lpo") return "load";
  return "time";
}

/* ------------------------------------------------------------------ endurance */

export const enduranceModalities = ["run", "row", "bike"] as const;
export type EnduranceModality = (typeof enduranceModalities)[number];

export const enduranceModalityLabels: Record<EnduranceModality, string> = {
  run: "Corrida",
  row: "Remo",
  bike: "Bike"
};

export const volumeUnits = ["m", "km", "min"] as const;
export type VolumeUnit = (typeof volumeUnits)[number];

export function defaultVolumeUnit(modality: EnduranceModality): VolumeUnit {
  return modality === "bike" ? "min" : "m";
}
