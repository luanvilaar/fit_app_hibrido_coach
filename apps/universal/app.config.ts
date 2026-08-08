import { parseProjectEnv } from "@expo/env";
import type { ExpoConfig } from "expo/config";
import { resolve } from "node:path";
import appJson from "./app.json";

type RuntimeEnv = {
  process?: {
    env?: Record<string, string | undefined>;
  };
};

const rootEnv = parseProjectEnv(resolve(__dirname, "../.."), { silent: true }).env;
const env = {
  ...rootEnv,
  ...((globalThis as RuntimeEnv).process?.env ?? {})
};
const baseConfig = appJson.expo as ExpoConfig;

const config: ExpoConfig = {
  ...baseConfig,
  extra: {
    ...baseConfig.extra,
    supabaseUrl: env.EXPO_PUBLIC_SUPABASE_URL ?? env.SUPABASE_URL,
    supabaseAnonKey: env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? env.SUPABASE_ANON_KEY
  }
};

export default config;
