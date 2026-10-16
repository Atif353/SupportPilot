import { clientEnv } from "../../app/config/env";
import { readSession, writeSession, type AuthSession } from "../auth/auth";

type ApiSuccess<TData> = {
  success: true;
  data: TData;
};

type ApiFailure = {
  success: false;
  error: {
    code: string;
    message: string;
    requestId?: string;
  };
};

type ApiResponse<TData> = ApiSuccess<TData> | ApiFailure;

export class ApiClientError extends Error {
  public readonly code: string;
  public readonly requestId: string | undefined;

  public constructor(params: { code: string; message: string; requestId?: string }) {
    super(params.message);
    this.name = "ApiClientError";
    this.code = params.code;
    this.requestId = params.requestId;
  }
}

const sameAccount = (session: AuthSession): boolean => readSession()?.user.id === session.user.id;

let refreshInFlight: Promise<void> | undefined;
async function refreshAccess(session: AuthSession): Promise<void> {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      const response = await fetch(`${clientEnv.VITE_API_URL}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken: session.refreshToken }),
      });
      if (!response.ok) throw new Error("Session expired. Please sign in again.");
      const payload = (await response.json()) as ApiResponse<
        Pick<AuthSession, "accessToken" | "refreshToken">
      >;
      if (!payload.success) throw new ApiClientError(payload.error);
      if (!sameAccount(session)) throw new Error("Session changed. Please retry.");
      writeSession({ ...session, ...payload.data });
    })().finally(() => {
      refreshInFlight = undefined;
    });
  }
  await refreshInFlight;
}

export const apiClient = async <TData>(
  path: string,
  init?: RequestInit,
  retry = true,
): Promise<TData> => {
  const headers = new Headers(init?.headers);
  headers.set("Content-Type", "application/json");
  const session = readSession();
  const token = session?.accessToken;
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(`${clientEnv.VITE_API_URL}${path}`, {
    ...init,
    headers,
  });
  if (response.status === 401 && retry && session && !path.startsWith("/auth/")) {
    try {
      await refreshAccess(session);
    } catch (error) {
      if (sameAccount(session)) window.dispatchEvent(new Event("auth:expired"));
      throw error;
    }
    if (!sameAccount(session)) throw new Error("Session changed. Please retry.");
    return apiClient<TData>(path, init, false);
  }

  if (!response.headers.get("content-type")?.includes("application/json"))
    throw new ApiClientError({
      code: "INVALID_RESPONSE",
      message: "The server returned an unexpected response. Please try again.",
    });
  const payload = (await response.json()) as ApiResponse<TData>;

  if (!payload.success) {
    throw new ApiClientError(payload.error);
  }
  if (!response.ok)
    throw new ApiClientError({
      code: "HTTP_ERROR",
      message: `Request failed (${response.status}).`,
    });

  if (session && !path.startsWith("/auth/") && !sameAccount(session))
    throw new Error("Session changed. Please retry.");
  return payload.data;
};
