export type AuthUser = {
  id: string;
  email: string;
  role: "CUSTOMER" | "SUPPORT" | "ADMIN";
  firstName: string;
  lastName: string;
};

export type AuthSession = {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
  customerId?: string;
};

const sessionKey = "supportpilot.session";

export const readSession = (): AuthSession | null => {
  const raw = window.localStorage.getItem(sessionKey);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthSession;
  } catch {
    window.localStorage.removeItem(sessionKey);
    return null;
  }
};

export const writeSession = (session: AuthSession): void => {
  window.localStorage.setItem(sessionKey, JSON.stringify(session));
};

export const clearSession = (): void => window.localStorage.removeItem(sessionKey);
