import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { supabaseConfig } from "./env";

/**
 * Quem está chamando a função.
 *
 * A identidade vem do JWT assinado pelo Supabase, nunca do corpo da requisição: um `coach_id`
 * enviado pelo cliente é apenas uma afirmação, e aqui ela decidiria em qual conta o dinheiro cai.
 */
export type AuthenticatedUser = {
  id: string;
  email: string | null;
};

export function serviceRoleClient(): SupabaseClient {
  const { url, serviceRoleKey } = supabaseConfig();

  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

export async function authenticate(request: Request): Promise<AuthenticatedUser | null> {
  const header = request.headers.get("authorization");

  if (!header?.toLowerCase().startsWith("bearer ")) return null;

  const token = header.slice(7).trim();

  if (token.length === 0) return null;

  const { url, anonKey } = supabaseConfig();
  // A anon key valida o token; a service role só entra depois, para o acesso privilegiado.
  const client = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  const { data, error } = await client.auth.getUser(token);

  if (error || !data.user) return null;

  return { id: data.user.id, email: data.user.email ?? null };
}

/**
 * Confirma que o usuário é coach de alguma equipe. Sem isto, qualquer autenticado conseguiria
 * conectar uma conta de recebimento à plataforma.
 */
export async function isCoach(client: SupabaseClient, userId: string): Promise<boolean> {
  const { data, error } = await client
    .from("team_members")
    .select("id")
    .eq("user_id", userId)
    .eq("role", "coach")
    .limit(1);

  if (error) throw error;

  return (data ?? []).length > 0;
}
