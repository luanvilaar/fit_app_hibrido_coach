import Constants from "expo-constants";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

type ExpoExtra = {
  supabaseUrl?: string;
  supabaseAnonKey?: string;
};

const extra = (Constants.expoConfig?.extra ?? {}) as ExpoExtra;
const publicEnv = {
  url: process.env.EXPO_PUBLIC_SUPABASE_URL,
  anonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
};

export const supabaseConfig = {
  url: publicEnv.url ?? extra.supabaseUrl ?? "",
  anonKey: publicEnv.anonKey ?? extra.supabaseAnonKey ?? ""
};

export const supabase: SupabaseClient | null =
  supabaseConfig.url && supabaseConfig.anonKey
    ? createClient(supabaseConfig.url, supabaseConfig.anonKey, {
        auth: {
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: true
        }
      })
    : null;

export function getSupabaseConfigurationError(): string | null {
  if (supabase) return null;

  return "A autenticação ainda não foi configurada neste ambiente.";
}
