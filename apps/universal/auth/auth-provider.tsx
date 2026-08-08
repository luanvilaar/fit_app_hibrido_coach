import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { getAuthRedirect } from "@/auth/auth-redirect";
import { getSupabaseConfigurationError, supabase } from "@/lib/supabase";
import { loginRateLimiter } from "@/auth/rate-limiter";

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  isLoading: boolean;
  isConfigured: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<{ needsEmailConfirmation: boolean }>;
  resetPassword: (email: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function getAuthErrorMessage(error: { code?: string; message?: string }): string {
  switch (error.code) {
    case "invalid_credentials":
      return "E-mail ou senha inválidos.";
    case "email_exists":
    case "user_already_exists":
      return "Já existe uma conta com este e-mail.";
    case "weak_password":
      return "Escolha uma senha mais forte, com pelo menos 12 caracteres (maiúsculas, minúsculas, números e símbolos).";
    case "email_not_confirmed":
      return "Confirme seu e-mail antes de entrar. Verifique sua caixa de entrada ou pasta de spam.";
    case "session_not_found":
      return "Sua sessão expirou. Faça login novamente.";
    case "user_not_found":
      return "Usuário não encontrado.";
    default:
      // Generic message to avoid information disclosure
      return "Não foi possível concluir a operação. Tente novamente mais tarde.";
  }
}

function requireSupabase() {
  if (!supabase) {
    throw new Error(getSupabaseConfigurationError() ?? "Autenticação indisponível.");
  }

  return supabase;
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!supabase) {
      setIsLoading(false);
      return undefined;
    }

    let mounted = true;

    void supabase.auth.getSession().then(({ data, error }) => {
      if (!mounted) return;
      if (error) console.warn("FitBlock auth session restore failed", error.message);
      setSession(data.session);
      setIsLoading(false);
    });

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!mounted) return;
      setSession(nextSession);
      setIsLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      isLoading,
      isConfigured: Boolean(supabase),
      async signIn(email, password) {
        const email_normalized = email.trim().toLowerCase();
        const client = requireSupabase();

        // Check rate limiting
        const blocked = loginRateLimiter.isBlocked(email_normalized);
        if (blocked.blocked) {
          throw new Error(
            `Muitas tentativas de login. Tente novamente em ${blocked.minutesLeft} minuto(s).`
          );
        }

        const { error } = await client.auth.signInWithPassword({
          email: email_normalized,
          password
        });

        if (error) {
          // Record failed attempt for rate limiting
          const rateLimitResult = loginRateLimiter.recordFailedAttempt(email_normalized);

          if (rateLimitResult.shouldBlock) {
            throw new Error(
              `Muitas tentativas de login. Sua conta foi bloqueada por ${rateLimitResult.minutesLeft} minuto(s). Tente novamente mais tarde.`
            );
          }

          throw new Error(getAuthErrorMessage(error));
        }

        // Clear rate limiting on successful login
        loginRateLimiter.clearAttempts(email_normalized);
      },
      async signUp(email, password) {
        const client = requireSupabase();
        const { data, error } = await client.auth.signUp({
          email: email.trim().toLowerCase(),
          password,
          options: { emailRedirectTo: getAuthRedirect("entrar") }
        });
        if (error) throw new Error(getAuthErrorMessage(error));

        return { needsEmailConfirmation: !data.session };
      },
      async resetPassword(email) {
        const client = requireSupabase();
        const { error } = await client.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
          redirectTo: getAuthRedirect("recuperar-senha")
        });
        if (error) throw new Error(getAuthErrorMessage(error));
      },
      async updatePassword(password) {
        const client = requireSupabase();

        // Verify user is authenticated
        const {
          data: { user },
          error: userError
        } = await client.auth.getUser();

        if (userError || !user) {
          throw new Error("Sua sessão expirou. Faça login novamente para atualizar sua senha.");
        }

        if (!user.id || !user.email) {
          throw new Error("Identificação de usuário inválida. Tente fazer login novamente.");
        }

        const { error } = await client.auth.updateUser({ password });
        if (error) throw new Error(getAuthErrorMessage(error));
      },
      async signOut() {
        const client = requireSupabase();
        const { error } = await client.auth.signOut();
        if (error) throw new Error(getAuthErrorMessage(error));
      }
    }),
    [isLoading, session]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth precisa estar dentro de AuthProvider.");
  return context;
}

export { getAuthErrorMessage };
