import { describe, expect, it } from "vitest";
import {
  createAccessToken,
  hashPassword,
  verifyPassword,
  verifyToken,
} from "../../src/modules/auth/auth.service.js";

describe("authentication primitives", () => {
  it("hashes and verifies passwords without storing plaintext", () => {
    const hash = hashPassword("demo-password");
    expect(hash).not.toContain("demo-password");
    expect(verifyPassword("demo-password", hash)).toBe(true);
    expect(verifyPassword("wrong-password", hash)).toBe(false);
    expect(verifyPassword("password", "salt:bad-hash")).toBe(false);
  });

  it("rejects malformed access tokens", () => {
    const token = createAccessToken({ sub: "507f1f77bcf86cd799439011", role: "CUSTOMER" });
    expect(verifyToken(token, "access")?.role).toBe("CUSTOMER");
    expect(verifyToken(`${token}broken`, "access")).toBeNull();
    expect(verifyToken(`${token}.extra`, "access")).toBeNull();
  });
});
