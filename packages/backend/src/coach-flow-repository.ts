import type { FitBlockSupabaseClient } from "./supabase";
import type { CalendarSessionRecord } from "./calendar-repository";
import type { TeamMemberRole } from "./roles-repository";

export type CreateTrainingGroupRequest = {
  name: string;
  description: string;
  level: "iniciante" | "intermediário" | "avançado";
  objective: string;
};

export type TrainingGroupRecord = CreateTrainingGroupRequest & {
  id: string;
  created_by: string;
  created_at: string;
};

export type UpdateTrainingGroupRequest = CreateTrainingGroupRequest & {
  teamId: string;
};

/** Equipe com contagem de membros, para a tela de lista de gestão de grupos. */
export type TrainingGroupSummary = TrainingGroupRecord & {
  coach_count: number;
  athlete_count: number;
};

/** Membro de equipe com e-mail resolvido via RPC — auth.users não é acessível ao client. */
export type TeamMemberRecord = {
  id: string;
  user_id: string;
  email: string;
  role: TeamMemberRole;
  created_at: string;
};

export type AddTeamMemberByEmailRequest = {
  teamId: string;
  email: string;
  role: TeamMemberRole;
};

export type ApplySessionToTeamRequest = {
  templateId: string;
  teamId: string;
  scheduledDate: string;
  status?: "draft" | "published";
  coachNote?: string;
};

/** Categorias oferecidas no editor, por modalidade de treino. */
export type SessionBlockKind = "strength" | "conditioning" | "lpo" | "endurance" | "gymnastics-skill";

/**
 * Categoria do movimento no catálogo: decide o formato de prescrição do exercício
 * (reps + carga para as duas de Força, texto livre para Ginástica).
 */
export type ExerciseCategory = "forca-acessorios" | "forca-lpo" | "ginastica";

/**
 * Categorias criadas antes das modalidades. Continuam aceitas pelo banco porque os snapshots
 * congelados em `session_instances.snapshot` mantêm esses valores para sempre.
 */
export type LegacySessionBlockKind = "warm-up" | "cooldown" | "custom";

export type CreateSessionTemplateRequest = {
  title: string;
  status?: "draft" | "published";
  blocks: Array<{
    name: string;
    kind: SessionBlockKind;
    /**
     * Conteúdo específico da categoria: texto livre, config de ranking, séries de LPO e volumes
     * de endurance. Vazio nas categorias baseadas em lista de exercícios.
     */
    details?: Record<string, unknown>;
    /** Vazio nas categorias de texto livre (Condicionamento, LPO, Endurance). */
    items: Array<{
      exerciseSlug: string;
      exerciseName: string;
      /** Só usado quando o exercício ainda não existe no catálogo; ignorado se já existir. */
      exerciseCategory?: ExerciseCategory;
      prescription: Record<string, unknown>;
    }>;
  }>;
};

export type SessionTemplateRecord = {
  id: string;
  title: string;
  status: "draft" | "published";
  created_by: string;
  created_at: string;
};

/** Metadados de um treino da biblioteca, sem o conteúdo dos blocos. */
export type SessionTemplateSummary = {
  id: string;
  title: string;
  status: "draft" | "published";
  created_at: string;
  updated_at: string;
};

/** Conteúdo completo de um treino da biblioteca, no mesmo formato do snapshot congelado nas instâncias. */
export type SessionTemplateContent = {
  template_id: string;
  title: string;
  status: "draft" | "published";
  blocks: Record<string, unknown>[];
};

export type UpdateSessionTemplateRequest = {
  templateId: string;
  title: string;
  status?: "draft" | "published";
  blocks: CreateSessionTemplateRequest["blocks"];
};

export type SessionInstanceRecord = {
  id: string;
  template_id: string;
  team_id: string;
  scheduled_date: string;
  status: "draft" | "published";
  snapshot: Record<string, unknown>;
  coach_note: string;
  created_by: string;
  created_at: string;
};

export type PrescribeSessionRequest = {
  title: string;
  teamId: string;
  scheduledDate: string;
  blocks: CreateSessionTemplateRequest["blocks"];
  status?: "draft" | "published";
  coachNote?: string;
};

export type UpdateSessionRequest = {
  sessionId: string;
  title: string;
  scheduledDate: string;
  blocks: CreateSessionTemplateRequest["blocks"];
  status?: "draft" | "published";
  coachNote?: string;
};

/** Movimento do catálogo; `created_by` nulo identifica catálogo oficial FitBlock. */
export type ExerciseRecord = {
  id: string;
  slug: string;
  name: string;
  video_url: string | null;
  /** Null em movimentos legados/criados fora do app; o editor trata como Força (reps + carga). */
  category: ExerciseCategory | null;
  created_by: string | null;
  created_at: string;
};

export class CoachFlowBackendError extends Error {
  constructor(message: string, public readonly operation: string) {
    super(message);
    this.name = "CoachFlowBackendError";
  }
}

function toBlocksPayload(blocks: CreateSessionTemplateRequest["blocks"]) {
  return blocks.map((block) => ({
    name: block.name,
    kind: block.kind,
    details: block.details ?? {},
    items: block.items.map((item) => ({
      exercise_slug: item.exerciseSlug,
      exercise_name: item.exerciseName,
      exercise_category: item.exerciseCategory,
      prescription: item.prescription
    }))
  }));
}

export function createCoachFlowRepository(client: FitBlockSupabaseClient) {
  return {
    async listCoachTeams(): Promise<TrainingGroupRecord[]> {
      const { data, error } = await client.rpc("list_coach_teams");

      if (error) {
        throw new CoachFlowBackendError(error.message, "listCoachTeams");
      }

      return (data ?? []) as TrainingGroupRecord[];
    },

    /** Mesmas equipes de listCoachTeams, com contagem de coaches/atletas para a tela de lista. */
    async listCoachTeamsWithMemberCounts(): Promise<TrainingGroupSummary[]> {
      const { data, error } = await client.rpc("list_coach_teams_with_member_counts");

      if (error) {
        throw new CoachFlowBackendError(error.message, "listCoachTeamsWithMemberCounts");
      }

      return (data ?? []) as TrainingGroupSummary[];
    },

    async listCoachCalendar(range: { from: string; to: string }): Promise<CalendarSessionRecord[]> {
      const { data, error } = await client.rpc("list_coach_calendar", {
        p_from: range.from,
        p_to: range.to
      });

      if (error) {
        throw new CoachFlowBackendError(error.message, "listCoachCalendar");
      }

      return (data ?? []) as CalendarSessionRecord[];
    },

    /** Movimentos já cadastrados (catálogo oficial + criados por coaches), para sugestão no editor. */
    async listExercises(): Promise<ExerciseRecord[]> {
      const { data, error } = await client
        .from("exercises")
        .select("id,slug,name,video_url,category,created_by,created_at")
        .order("name");

      if (error) {
        throw new CoachFlowBackendError(error.message, "listExercises");
      }

      return (data ?? []) as ExerciseRecord[];
    },

    async createTrainingGroup(input: CreateTrainingGroupRequest): Promise<TrainingGroupRecord> {
      const { data, error } = await client
        .from("teams")
        .insert({
          name: input.name,
          description: input.description,
          level: input.level,
          objective: input.objective
        })
        .select("id,name,description,level,objective,created_by,created_at")
        .single();

      if (error) {
        throw new CoachFlowBackendError(error.message, "createTrainingGroup");
      }

      return data as TrainingGroupRecord;
    },

    /** Uma equipe específica, para a tela de detalhe; RLS ("team members can read their teams") autoriza. */
    async getTrainingGroup(teamId: string): Promise<TrainingGroupRecord> {
      const { data, error } = await client
        .from("teams")
        .select("id,name,description,level,objective,created_by,created_at")
        .eq("id", teamId)
        .single();

      if (error) {
        throw new CoachFlowBackendError(error.message, "getTrainingGroup");
      }

      return data as TrainingGroupRecord;
    },

    /** RLS ("team coaches can update teams") autoriza a operação; sem RPC dedicada. */
    async updateTrainingGroup(input: UpdateTrainingGroupRequest): Promise<TrainingGroupRecord> {
      const { data, error } = await client
        .from("teams")
        .update({
          name: input.name,
          description: input.description,
          level: input.level,
          objective: input.objective
        })
        .eq("id", input.teamId)
        .select("id,name,description,level,objective,created_by,created_at")
        .single();

      if (error) {
        throw new CoachFlowBackendError(error.message, "updateTrainingGroup");
      }

      return data as TrainingGroupRecord;
    },

    /** Exclusão em cascata: apaga membros e sessões da equipe (RLS "team coaches can archive teams"). */
    async deleteTrainingGroup(teamId: string): Promise<void> {
      const { error } = await client.from("teams").delete().eq("id", teamId);

      if (error) {
        throw new CoachFlowBackendError(error.message, "deleteTrainingGroup");
      }
    },

    async listTeamMembers(teamId: string): Promise<TeamMemberRecord[]> {
      const { data, error } = await client.rpc("list_team_members", { p_team_id: teamId });

      if (error) {
        throw new CoachFlowBackendError(error.message, "listTeamMembers");
      }

      return (data ?? []) as TeamMemberRecord[];
    },

    async addTeamMemberByEmail(input: AddTeamMemberByEmailRequest): Promise<TeamMemberRecord> {
      const { data, error } = await client
        .rpc("add_team_member_by_email", {
          p_team_id: input.teamId,
          p_email: input.email,
          p_role: input.role
        })
        .single();

      if (error) {
        throw new CoachFlowBackendError(error.message, "addTeamMemberByEmail");
      }

      return data as TeamMemberRecord;
    },

    /** RLS ("team coaches can remove membership") autoriza a operação; guard_team_last_coach protege o último coach. */
    async removeTeamMember(memberId: string): Promise<void> {
      const { error } = await client.from("team_members").delete().eq("id", memberId);

      if (error) {
        throw new CoachFlowBackendError(error.message, "removeTeamMember");
      }
    },

    async createSessionTemplate(input: CreateSessionTemplateRequest): Promise<SessionTemplateRecord> {
      const { data, error } = await client
        .rpc("create_session_template_with_content", {
          p_title: input.title,
          p_blocks: toBlocksPayload(input.blocks),
          p_status: input.status ?? "draft"
        })
        .single();

      if (error) {
        throw new CoachFlowBackendError(error.message, "createSessionTemplate");
      }

      return data as SessionTemplateRecord;
    },

    /** Treinos da biblioteca do coach autenticado; RLS ("coaches can manage owned templates") já filtra por dono. */
    async listSessionTemplates(): Promise<SessionTemplateSummary[]> {
      const { data, error } = await client
        .from("session_templates")
        .select("id,title,status,created_at,updated_at")
        .order("updated_at", { ascending: false });

      if (error) {
        throw new CoachFlowBackendError(error.message, "listSessionTemplates");
      }

      return (data ?? []) as SessionTemplateSummary[];
    },

    /** Carrega título, status e blocos de um treino da biblioteca, para editar ou duplicar. */
    async getSessionTemplateContent(templateId: string): Promise<SessionTemplateContent> {
      const { data, error } = await client.rpc("get_session_template_content", {
        p_template_id: templateId
      });

      if (error) {
        throw new CoachFlowBackendError(error.message, "getSessionTemplateContent");
      }

      return data as SessionTemplateContent;
    },

    /** Reescreve o conteúdo do próprio template; sessões já aplicadas mantêm o snapshot congelado. */
    async updateSessionTemplateContent(input: UpdateSessionTemplateRequest): Promise<SessionTemplateRecord> {
      const { data, error } = await client
        .rpc("update_session_template_content", {
          p_template_id: input.templateId,
          p_title: input.title,
          p_blocks: toBlocksPayload(input.blocks),
          p_status: input.status ?? null
        })
        .single();

      if (error) {
        throw new CoachFlowBackendError(error.message, "updateSessionTemplateContent");
      }

      return data as SessionTemplateRecord;
    },

    /** RLS ("coaches can manage owned templates") autoriza; falha com FK se o treino já foi aplicado a alguma sessão. */
    async deleteSessionTemplate(templateId: string): Promise<void> {
      const { error } = await client.from("session_templates").delete().eq("id", templateId);

      if (error) {
        throw new CoachFlowBackendError(error.message, "deleteSessionTemplate");
      }
    },

    async applySessionToTeam(input: ApplySessionToTeamRequest): Promise<SessionInstanceRecord> {
      const { data, error } = await client
        .rpc("apply_session_template_to_team", {
          p_template_id: input.templateId,
          p_team_id: input.teamId,
          p_scheduled_date: input.scheduledDate,
          p_status: input.status ?? "draft",
          p_coach_note: input.coachNote ?? ""
        })
        .single();

      if (error) {
        throw new CoachFlowBackendError(error.message, "applySessionToTeam");
      }

      return data as SessionInstanceRecord;
    },

    async prescribeSession(input: PrescribeSessionRequest): Promise<SessionInstanceRecord> {
      const { data, error } = await client
        .rpc("create_and_apply_session_to_team", {
          p_title: input.title,
          p_blocks: toBlocksPayload(input.blocks),
          p_team_id: input.teamId,
          p_scheduled_date: input.scheduledDate,
          p_status: input.status ?? "published",
          p_coach_note: input.coachNote ?? ""
        })
        .single();

      if (error) {
        throw new CoachFlowBackendError(error.message, "prescribeSession");
      }

      return data as SessionInstanceRecord;
    },

    async updateSession(input: UpdateSessionRequest): Promise<SessionInstanceRecord> {
      const { data, error } = await client
        .rpc("update_session_instance", {
          p_session_id: input.sessionId,
          p_title: input.title,
          p_blocks: toBlocksPayload(input.blocks),
          p_scheduled_date: input.scheduledDate,
          p_status: input.status ?? "published",
          p_coach_note: input.coachNote ?? ""
        })
        .single();

      if (error) {
        throw new CoachFlowBackendError(error.message, "updateSession");
      }

      return data as SessionInstanceRecord;
    },

    async deleteSession(sessionId: string): Promise<void> {
      const { error } = await client.rpc("delete_session_instance", {
        p_session_id: sessionId
      });

      if (error) {
        throw new CoachFlowBackendError(error.message, "deleteSession");
      }
    }
  };
}
