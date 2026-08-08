import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export type FitBlockSupabaseClient = SupabaseClient;

export type SupabaseClientConfig = {
  url: string;
  anonKey: string;
};

export function createFitBlockSupabaseClient(config: SupabaseClientConfig): FitBlockSupabaseClient {
  if (!config.url.trim() || !config.anonKey.trim()) {
    throw new Error("SUPABASE_URL e SUPABASE_ANON_KEY são obrigatórios.");
  }

  return createClient(config.url, config.anonKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true
    }
  });
}
