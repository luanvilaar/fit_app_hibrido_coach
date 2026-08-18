export type ProgramScheduleDay = {
  week_number: number;
  day_number: number;
  day_type: ProgramDayType;
  session_template_id: string | null;
  session_title?: string | null;
  session_status?: "draft" | "published" | null;
};

export const programDayTypes = [
  "training",
  "rest",
  "recovery",
  "assessment",
  "unprogrammed"
] as const;

export type ProgramDayType = (typeof programDayTypes)[number];

export function describeProgramDayType(dayType: ProgramDayType): string {
  return {
    training: "Treino",
    rest: "Descanso",
    recovery: "Recuperação",
    assessment: "Avaliação",
    unprogrammed: "Sem programação"
  }[dayType];
}

export function isTrainingDay(day: Pick<ProgramScheduleDay, "day_type">): boolean {
  return day.day_type === "training";
}

/** Espelha a fórmula usada na instância SQL, sem colocar data no programa-base. */
export function resolveProgramDayDate(startDate: string, day: Pick<ProgramScheduleDay, "week_number" | "day_number">): string {
  const date = new Date(`${startDate}T12:00:00`);
  if (Number.isNaN(date.getTime())) throw new Error("Data inicial inválida.");
  date.setDate(date.getDate() + ((day.week_number - 1) * 7) + (day.day_number - 1));
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/**
 * O calendário do produto é relativo. Sempre contém todos os dias de cada semana,
 * e só recebe uma data real quando a compra/entrega cria uma instância do aluno.
 */
export function createProgramSchedule(
  durationWeeks: number,
  existingDays: ProgramScheduleDay[] = [],
  initialTemplateId: string | null = null
): ProgramScheduleDay[] {
  if (!Number.isInteger(durationWeeks) || durationWeeks < 1) return [];

  const existingByPosition = new Map(
    existingDays
      .filter((day) => day.week_number >= 1 && day.week_number <= durationWeeks && day.day_number >= 1 && day.day_number <= 7)
      .map((day) => [`${day.week_number}:${day.day_number}`, day])
  );

  return Array.from({ length: durationWeeks }, (_, weekIndex) =>
    Array.from({ length: 7 }, (_, dayIndex) => {
      const week_number = weekIndex + 1;
      const day_number = dayIndex + 1;
      const current = existingByPosition.get(`${week_number}:${day_number}`);

      if (current) return current;

      const isFirstDay = week_number === 1 && day_number === 1 && initialTemplateId !== null;
      return {
        week_number,
        day_number,
        day_type: (isFirstDay ? "training" : "unprogrammed") as ProgramDayType,
        session_template_id: isFirstDay ? initialTemplateId : null
      };
    })
  ).flat();
}

export function sortProgramSchedule(days: ProgramScheduleDay[]): ProgramScheduleDay[] {
  return [...days].sort((left, right) =>
    left.week_number - right.week_number || left.day_number - right.day_number
  );
}

export function validateProgramSchedule(days: ProgramScheduleDay[], durationWeeks: number): string | null {
  if (!Number.isInteger(durationWeeks) || durationWeeks < 1) {
    return "A duração precisa ser um número inteiro positivo de semanas.";
  }
  if (days.length !== durationWeeks * 7) {
    return "A duração precisa gerar todos os 7 dias de cada semana.";
  }

  const seen = new Set<string>();
  let activeDays = 0;

  for (const day of days) {
    if (!Number.isInteger(day.week_number) || day.week_number < 1 || day.week_number > durationWeeks) {
      return "A semana precisa estar dentro da duração do programa.";
    }
    if (!Number.isInteger(day.day_number) || day.day_number < 1 || day.day_number > 7) {
      return "O dia precisa estar entre 1 e 7.";
    }

    const key = `${day.week_number}:${day.day_number}`;
    if (seen.has(key)) return "Não é possível repetir a mesma semana e dia.";
    seen.add(key);

    if (!programDayTypes.includes(day.day_type)) return "O tipo de dia é inválido.";

    if (isTrainingDay(day)) {
      if (!day.session_template_id) return "Cada dia de treino precisa de um template.";
      activeDays += 1;
    } else if (day.session_template_id !== null) {
      return `${describeProgramDayType(day.day_type)} não pode ter treino vinculado.`;
    }
  }

  return activeDays > 0 ? null : "O programa precisa ter ao menos uma sessão de treino.";
}

export function scheduleToRpc(days: ProgramScheduleDay[]): Array<{
  week_number: number;
  day_number: number;
  day_type: ProgramDayType;
  session_template_id: string | null;
}> {
  return sortProgramSchedule(days).map((day) => ({
    week_number: day.week_number,
    day_number: day.day_number,
    day_type: day.day_type,
    session_template_id: isTrainingDay(day) ? day.session_template_id : null
  }));
}
