import type { FitBlockSupabaseClient } from "./supabase";

export type StoreProductType = "physical" | "training_program";
export type StoreProductStatus = "draft" | "review" | "published" | "archived";
export type StoreProductCategory =
  | "strength"
  | "hybrid"
  | "running"
  | "gymnastics"
  | "weightlifting"
  | "conditioning"
  | "other";
export type StoreProductLevel = "beginner" | "intermediate" | "advanced" | "all";
export type StoreOrderStatus = "pending" | "paid" | "refunded" | "cancelled";
export type StoreProgramDayType = "training" | "rest" | "recovery" | "assessment" | "unprogrammed";

export type StoreProgramSession = {
  id: string;
  week_number: number;
  day_number: number;
  session_template_id?: string;
  session_instance_id?: string | null;
  day_type?: StoreProgramDayType;
  scheduled_date?: string | null;
  title: string;
};

export type StoreProgramScheduleDay = {
  week_number: number;
  day_number: number;
  day_type: StoreProgramDayType;
  session_template_id: string | null;
  session_title?: string | null;
  session_status?: "draft" | "published" | null;
};

export type StoreProductRecord = {
  id: string;
  seller_coach_id: string;
  seller_display_name: string;
  type: StoreProductType;
  title: string;
  slug: string;
  short_description: string;
  cover_image_url: string | null;
  price_cents: number;
  category: StoreProductCategory;
  objective: string;
  level: StoreProductLevel;
  duration_weeks: number;
  status: StoreProductStatus;
  created_at: string;
};

export type StoreProductDetail = StoreProductRecord & {
  description: string;
  sessions: StoreProgramSession[];
};

export type CoachStoreProductRecord = Omit<StoreProductRecord, "seller_display_name"> & {
  description: string;
  session_template_id: string | null;
  updated_at: string;
};

export type StoreReviewProductRecord = {
  id: string;
  seller_coach_id: string;
  seller_display_name: string;
  title: string;
  slug: string;
  description: string;
  short_description: string;
  price_cents: number;
  category: StoreProductCategory;
  objective: string;
  level: StoreProductLevel;
  duration_weeks: number;
  status: "review";
  updated_at: string;
};

export type StoreOrderRecord = {
  order_id: string;
  product_id: string;
  product_title: string;
  seller_coach_id: string;
  seller_display_name: string;
  total_amount_cents: number;
  status: StoreOrderStatus;
  created_at: string;
  paid_at: string | null;
};

export type TrainingProgramRecord = {
  access_id: string;
  product_id: string;
  order_id: string;
  title: string;
  seller_coach_id: string;
  seller_display_name: string;
  duration_weeks: number;
  granted_at: string;
  sessions: StoreProgramSession[];
};

export type StoreSaleRecord = {
  product_id: string;
  product_title: string;
  sales_count: number;
  gross_amount_cents: number;
  buyer_count: number;
};

export type CreateStoreTrainingProductRequest = {
  title: string;
  slug: string;
  description: string;
  shortDescription: string;
  coverImageUrl?: string | null;
  priceCents: number;
  category: StoreProductCategory;
  objective: string;
  level: StoreProductLevel;
  durationWeeks: number;
  sessionTemplateId: string;
};

export type CreateStoreTrainingProgramRequest = Omit<CreateStoreTrainingProductRequest, "sessionTemplateId"> & {
  schedule: StoreProgramScheduleDay[];
};

export type UpdateStoreTrainingProgramRequest = CreateStoreTrainingProgramRequest & {
  productId: string;
};

export type StoreProgramDeliveryRecord = {
  id: string;
  product_id: string;
  version_id: string;
  coach_id: string;
  team_id: string;
  athlete_id: string | null;
  start_date: string;
  status: "active" | "archived";
};

export type UpdateStoreTrainingProductRequest = CreateStoreTrainingProductRequest & {
  productId: string;
};

export class StoreBackendError extends Error {
  constructor(message: string, public readonly operation: string) {
    super(message);
    this.name = "StoreBackendError";
  }
}

function throwStoreError(error: { message: string } | null, operation: string): void {
  if (error) throw new StoreBackendError(error.message, operation);
}

function parseSessions(value: unknown): StoreProgramSession[] {
  if (!Array.isArray(value)) return [];

  return value.filter((item): item is StoreProgramSession => {
    if (!item || typeof item !== "object") return false;
    const record = item as Record<string, unknown>;
    return ["id", "week_number", "day_number", "title"].every(
      (key) => key in record
    );
  });
}

export function createStoreRepository(client: FitBlockSupabaseClient) {
  return {
    async listProducts(category: StoreProductCategory | null = null): Promise<StoreProductRecord[]> {
      const { data, error } = await client.rpc("list_store_products", { p_category: category });
      throwStoreError(error, "listProducts");
      return (data ?? []) as StoreProductRecord[];
    },

    async getProduct(slug: string): Promise<StoreProductDetail | null> {
      const { data, error } = await client.rpc("get_store_product", { p_slug: slug }).maybeSingle();
      throwStoreError(error, "getProduct");
      if (!data) return null;

      return {
        ...(data as Omit<StoreProductDetail, "sessions"> & { sessions: unknown }),
        sessions: parseSessions((data as { sessions?: unknown }).sessions)
      };
    },

    async listCoachProducts(): Promise<CoachStoreProductRecord[]> {
      const { data, error } = await client.rpc("list_coach_store_products");
      throwStoreError(error, "listCoachProducts");
      return (data ?? []) as CoachStoreProductRecord[];
    },

    async listProductsForReview(): Promise<StoreReviewProductRecord[]> {
      const { data, error } = await client.rpc("list_store_products_for_review");
      throwStoreError(error, "listProductsForReview");
      return (data ?? []) as StoreReviewProductRecord[];
    },

    async listMyOrders(): Promise<StoreOrderRecord[]> {
      const { data, error } = await client.rpc("list_my_store_orders");
      throwStoreError(error, "listMyOrders");
      return (data ?? []) as StoreOrderRecord[];
    },

    async listMyTrainingPrograms(): Promise<TrainingProgramRecord[]> {
      const { data, error } = await client.rpc("list_my_training_programs");
      throwStoreError(error, "listMyTrainingPrograms");

      return ((data ?? []) as Array<Omit<TrainingProgramRecord, "sessions"> & { sessions: unknown }>).map(
        (program) => ({ ...program, sessions: parseSessions(program.sessions) })
      );
    },

    async listCoachSales(): Promise<StoreSaleRecord[]> {
      const { data, error } = await client.rpc("list_coach_store_sales");
      throwStoreError(error, "listCoachSales");
      return (data ?? []) as StoreSaleRecord[];
    },

    async createTrainingProduct(input: CreateStoreTrainingProductRequest): Promise<CoachStoreProductRecord> {
      const { data, error } = await client
        .rpc("create_store_training_product", {
          p_title: input.title,
          p_slug: input.slug,
          p_description: input.description,
          p_short_description: input.shortDescription,
          p_cover_image_url: input.coverImageUrl ?? null,
          p_price_cents: input.priceCents,
          p_category: input.category,
          p_level: input.level,
          p_duration_weeks: input.durationWeeks,
          p_session_template_id: input.sessionTemplateId
        })
        .single();
      throwStoreError(error, "createTrainingProduct");
      return data as CoachStoreProductRecord;
    },

    async getCoachProductSchedule(productId: string): Promise<StoreProgramScheduleDay[]> {
      const { data, error } = await client.rpc("get_coach_store_product_schedule", {
        p_product_id: productId
      });
      throwStoreError(error, "getCoachProductSchedule");
      return (data ?? []) as StoreProgramScheduleDay[];
    },

    async createTrainingProgram(input: CreateStoreTrainingProgramRequest): Promise<CoachStoreProductRecord> {
      const { data, error } = await client
        .rpc("create_store_training_program", {
          p_title: input.title,
          p_slug: input.slug,
          p_description: input.description,
          p_short_description: input.shortDescription,
          p_cover_image_url: input.coverImageUrl ?? null,
          p_price_cents: input.priceCents,
          p_category: input.category,
          p_objective: input.objective,
          p_level: input.level,
          p_duration_weeks: input.durationWeeks,
          p_schedule: input.schedule.map((day) => ({
            week_number: day.week_number,
            day_number: day.day_number,
            day_type: day.day_type,
            session_template_id: day.day_type === "training" ? day.session_template_id : null
          }))
        })
        .single();
      throwStoreError(error, "createTrainingProgram");
      return data as CoachStoreProductRecord;
    },

    async updateTrainingProgram(input: UpdateStoreTrainingProgramRequest): Promise<CoachStoreProductRecord> {
      const { data, error } = await client
        .rpc("update_store_training_program", {
          p_product_id: input.productId,
          p_title: input.title,
          p_slug: input.slug,
          p_description: input.description,
          p_short_description: input.shortDescription,
          p_cover_image_url: input.coverImageUrl ?? null,
          p_price_cents: input.priceCents,
          p_category: input.category,
          p_objective: input.objective,
          p_level: input.level,
          p_duration_weeks: input.durationWeeks,
          p_schedule: input.schedule.map((day) => ({
            week_number: day.week_number,
            day_number: day.day_number,
            day_type: day.day_type,
            session_template_id: day.day_type === "training" ? day.session_template_id : null
          }))
        })
        .single();
      throwStoreError(error, "updateTrainingProgram");
      return data as CoachStoreProductRecord;
    },

    async createProgramDelivery(input: {
      productId: string;
      teamId?: string | null;
      athleteId?: string | null;
      startDate?: string;
    }): Promise<StoreProgramDeliveryRecord> {
      const { data, error } = await client
        .rpc("create_training_program_delivery", {
          p_product_id: input.productId,
          p_team_id: input.teamId ?? null,
          p_athlete_id: input.athleteId ?? null,
          p_start_date: input.startDate ?? null
        })
        .single();
      throwStoreError(error, "createProgramDelivery");
      return data as StoreProgramDeliveryRecord;
    },

    async updateTrainingProduct(input: UpdateStoreTrainingProductRequest): Promise<CoachStoreProductRecord> {
      const { data, error } = await client
        .rpc("update_store_training_product", {
          p_product_id: input.productId,
          p_title: input.title,
          p_slug: input.slug,
          p_description: input.description,
          p_short_description: input.shortDescription,
          p_cover_image_url: input.coverImageUrl ?? null,
          p_price_cents: input.priceCents,
          p_category: input.category,
          p_level: input.level,
          p_duration_weeks: input.durationWeeks ?? null,
          p_session_template_id: input.sessionTemplateId
        })
        .single();
      throwStoreError(error, "updateTrainingProduct");
      return data as CoachStoreProductRecord;
    },

    async submitProductReview(productId: string): Promise<void> {
      const { error } = await client.rpc("submit_store_product_review", { p_product_id: productId });
      throwStoreError(error, "submitProductReview");
    },

    async approveProduct(productId: string): Promise<void> {
      const { error } = await client.rpc("approve_store_product", { p_product_id: productId });
      throwStoreError(error, "approveProduct");
    },

    async rejectProduct(productId: string, reason: string): Promise<void> {
      const { error } = await client.rpc("reject_store_product", {
        p_product_id: productId,
        p_reason: reason
      });
      throwStoreError(error, "rejectProduct");
    },

    async archiveProduct(productId: string): Promise<void> {
      const { error } = await client.rpc("archive_store_product", { p_product_id: productId });
      throwStoreError(error, "archiveProduct");
    }
  };
}
