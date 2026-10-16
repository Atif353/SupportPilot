import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../../shared/api/apiClient";
import { clearSession, readSession, writeSession, type AuthSession } from "../../shared/auth/auth";

type AuthContextValue = {
  session: AuthSession | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider = ({ children }: { children: React.ReactNode }): React.ReactElement => {
  const queryClient = useQueryClient();
  const [session, setSession] = useState<AuthSession | null>(() => readSession());
  useEffect(() => {
    const expired = () => {
      clearSession();
      queryClient.clear();
      setSession(null);
    };
    window.addEventListener("auth:expired", expired);
    return () => window.removeEventListener("auth:expired", expired);
  }, [queryClient]);
  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      login: async (email, password) => {
        const next = await apiClient<AuthSession>("/auth/login", {
          method: "POST",
          body: JSON.stringify({ email, password }),
        });
        writeSession(next);
        queryClient.clear();
        setSession(next);
      },
      logout: () => {
        const refreshToken = readSession()?.refreshToken;
        if (refreshToken)
          void apiClient("/auth/logout", {
            method: "POST",
            body: JSON.stringify({ refreshToken }),
          }).catch(() => undefined);
        clearSession();
        queryClient.clear();
        setSession(null);
      },
    }),
    [session, queryClient],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider.");
  return context;
};
