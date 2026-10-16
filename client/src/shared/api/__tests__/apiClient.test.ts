import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiClient } from "../apiClient";

const session = {
  accessToken: "old-access",
  refreshToken: "refresh-1",
  user: {
    id: "user-1",
    role: "CUSTOMER",
    email: "test@example.test",
    firstName: "Test",
    lastName: "User",
  },
};
let storage = "";
const dispatchEvent = vi.fn();
beforeEach(() => {
  storage = JSON.stringify(session);
  vi.stubGlobal("window", {
    localStorage: {
      getItem: () => storage || null,
      setItem: (_key: string, value: string) => {
        storage = value;
      },
      removeItem: () => {
        storage = "";
      },
    },
    dispatchEvent,
  });
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});
const response = (data: unknown, status = 200) =>
  new Response(
    JSON.stringify(
      status === 200
        ? { success: true, data }
        : { success: false, error: { code: "UNAUTHORIZED", message: "Expired" } },
    ),
    { status, headers: { "Content-Type": "application/json" } },
  );

describe("API session handling", () => {
  it("keeps authorization when callers supply idempotency headers", async () => {
    const fetchMock = vi.fn().mockResolvedValue(response({ saved: true }));
    vi.stubGlobal("fetch", fetchMock);
    await apiClient("/tools/cancelOrder", {
      method: "POST",
      headers: new Headers({ "Idempotency-Key": "request-1" }),
      body: "{}",
    });
    const init = fetchMock.mock.calls[0]![1] as RequestInit;
    expect(new Headers(init.headers).get("authorization")).toBe("Bearer old-access");
    expect(new Headers(init.headers).get("idempotency-key")).toBe("request-1");
  });
  it("refreshes an expired access token and retries the original request once", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response(null, 401))
      .mockResolvedValueOnce(response({ accessToken: "fresh-access", refreshToken: "refresh-2" }))
      .mockResolvedValueOnce(response({ saved: true }));
    vi.stubGlobal("fetch", fetchMock);
    expect(
      await apiClient("/tools/cancelOrder", {
        method: "POST",
        headers: { "Idempotency-Key": "request-1" },
        body: "{}",
      }),
    ).toEqual({ saved: true });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(JSON.parse(storage).refreshToken).toBe("refresh-2");
    const init = fetchMock.mock.calls[2]![1] as RequestInit;
    expect(init.method).toBe("POST");
    expect(new Headers(init.headers).get("authorization")).toBe("Bearer fresh-access");
    expect(new Headers(init.headers).get("idempotency-key")).toBe("request-1");
  });
  it("expires the UI session when refresh is rejected", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce(response(null, 401)).mockResolvedValueOnce(response(null, 401)),
    );
    await expect(apiClient("/orders")).rejects.toThrow("Session expired");
    expect(dispatchEvent.mock.calls[0]![0].type).toBe("auth:expired");
  });
  it("discards an in-flight response after the signed-in account changes", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(async () => {
        storage = JSON.stringify({ ...session, user: { ...session.user, id: "user-2" } });
        return response([{ privateOrder: "old-user" }]);
      }),
    );
    await expect(apiClient("/orders")).rejects.toThrow("Session changed");
  });
});
