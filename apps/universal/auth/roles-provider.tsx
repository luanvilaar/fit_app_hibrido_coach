import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren
} from "react";
import { createRolesRepository } from "@fitblock/backend";
import { useAuth } from "@/auth/auth-provider";
import {
  emptyUserRoles,
  hasRole as hasRoleIn,
  normalizeUserRoles,
  type AppRole,
  type UserRoles
} from "@/auth/roles";
import { getSupabaseConfigurationError, supabase } from "@/lib/supabase";

type RolesContextValue = {
  userRoles: UserRoles;
  isLoading: boolean;
  error: string | null;
  hasRole: (role: AppRole) => boolean;
  refresh: () => void;
};

/** Resultado da última leitura concluída, carimbado com a requisição que o produziu. */
type RolesSnapshot = {
  requestKey: string;
  userRoles: UserRoles;
  error: string | null;
};

const initialSnapshot: RolesSnapshot = {
  requestKey: "",
  userRoles: emptyUserRoles,
  error: null
};

const RolesContext = createContext<RolesContextValue | null>(null);

export function RolesProvider({ children }: PropsWithChildren) {
  const { isLoading: isAuthLoading, user } = useAuth();
  const [reloadToken, setReloadToken] = useState(0);
  const [snapshot, setSnapshot] = useState<RolesSnapshot>(initialSnapshot);

  const userId = user?.id ?? null;
  const isSignedIn = Boolean(userId);
  const canQuery = isSignedIn && Boolean(supabase);
  // Muda a cada usuário e a cada refresh: descarta resposta atrasada de uma leitura anterior.
  const requestKey = `${userId ?? "anonymous"}:${reloadToken}`;
  const isCurrent = snapshot.requestKey === requestKey;

  useEffect(() => {
    if (isAuthLoading || !canQuery || !supabase) return undefined;

    let mounted = true;
    const repository = createRolesRepository(supabase);

    void repository
      .getCurrentUserRoles()
      .then((record) => {
        if (!mounted) return;
        setSnapshot({ requestKey, userRoles: normalizeUserRoles(record), error: null });
      })
      .catch((cause: unknown) => {
        if (!mounted) return;
        setSnapshot({
          requestKey,
          userRoles: emptyUserRoles,
          error: cause instanceof Error ? cause.message : "Não foi possível carregar suas permissões."
        });
      });

    return () => {
      mounted = false;
    };
  }, [canQuery, isAuthLoading, requestKey]);

  const refresh = useCallback(() => {
    setReloadToken((current) => current + 1);
  }, []);

  const value = useMemo<RolesContextValue>(() => {
    const userRoles = isCurrent ? snapshot.userRoles : emptyUserRoles;
    const configurationError =
      isSignedIn && !supabase
        ? getSupabaseConfigurationError() ?? "Permissões indisponíveis neste ambiente."
        : null;

    return {
      userRoles,
      isLoading: isAuthLoading || (canQuery && !isCurrent),
      error: configurationError ?? (isCurrent ? snapshot.error : null),
      hasRole: (role: AppRole) => hasRoleIn(userRoles, role),
      refresh
    };
  }, [canQuery, isAuthLoading, isCurrent, isSignedIn, refresh, snapshot]);

  return <RolesContext.Provider value={value}>{children}</RolesContext.Provider>;
}

export function useUserRoles(): RolesContextValue {
  const context = useContext(RolesContext);
  if (!context) throw new Error("useUserRoles precisa estar dentro de RolesProvider.");
  return context;
}
