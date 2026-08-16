export type ProgramScheduleDay = {
  week_number: number;
  day_number: number;
  is_rest_day: boolean;
  session_template_id: string | null;
  session_title?: string | null;
  session_status?: "draft" | "published" | null;
};

export function createInitialProgramSchedule(templateId: string | null = null): ProgramScheduleDay[] {
  return [{
    week_number: 1,
    day_number: 1,
    is_rest_day: templateId === null,
    session_template_id: templateId
  }];
}

export function sortProgramSchedule(days: ProgramScheduleDay[]): ProgramScheduleDay[] {
  return [...days].sort((left, right) =>
    left.week_number - right.week_number || left.day_number - right.day_number
  );
}

export function validateProgramSchedule(days: ProgramScheduleDay[]): string | null {
  if (days.length === 0) return "Adicione ao menos um dia ao programa.";

  const seen = new Set<string>();
  let activeDays = 0;

  for (const day of days) {
    if (!Number.isInteger(day.week_number) || day.week_number < 1) {
      return "A semana precisa ser um número inteiro positivo.";
    }
    if (!Number.isInteger(day.day_number) || day.day_number < 1 || day.day_number > 7) {
      return "O dia precisa estar entre 1 e 7.";
    }

    const key = `${day.week_number}:${day.day_number}`;
    if (seen.has(key)) return "Não é possível repetir a mesma semana e dia.";
    seen.add(key);

    if (day.is_rest_day) {
      if (day.session_template_id !== null) return "Dia de descanso não pode ter treino vinculado.";
    } else {
      if (!day.session_template_id) return "Cada dia de treino precisa de um template.";
      activeDays += 1;
    }
  }

  return activeDays > 0 ? null : "O programa precisa ter ao menos uma sessão de treino.";
}

export function scheduleToRpc(days: ProgramScheduleDay[]): Array<{
  week_number: number;
  day_number: number;
  is_rest_day: boolean;
  session_template_id: string | null;
}> {
  return sortProgramSchedule(days).map((day) => ({
    week_number: day.week_number,
    day_number: day.day_number,
    is_rest_day: day.is_rest_day,
    session_template_id: day.is_rest_day ? null : day.session_template_id
  }));
}
