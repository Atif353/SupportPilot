import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { findPackageDirectory, loadEnvironmentFiles } from "../../src/config/loadEnvironment.js";
import { envPositiveInteger, envString } from "../../src/common/validation.js";

let workspace: string;
let serverDirectory: string;
beforeEach(() => {
  workspace = mkdtempSync(join(tmpdir(), "supportpilot-env-test-"));
  serverDirectory = join(workspace, "server");
  mkdirSync(serverDirectory);
  writeFileSync(join(serverDirectory, "package.json"), JSON.stringify({ name: "server" }));
});
afterEach(() => rmSync(workspace, { recursive: true, force: true }));

describe("environment configuration", () => {
  it("loads a workspace .env when server/.env does not exist", () => {
    writeFileSync(
      join(workspace, ".env"),
      "MONGODB_URI=mongodb://localhost/test\nJWT_ACCESS_SECRET=fixture-access\n",
    );
    const target: NodeJS.ProcessEnv = {};
    loadEnvironmentFiles(serverDirectory, target);
    expect(target.MONGODB_URI).toBe("mongodb://localhost/test");
    expect(target.JWT_ACCESS_SECRET).toBe("fixture-access");
  });
  it("preserves shell values and gives the server file precedence over the workspace file", () => {
    writeFileSync(
      join(workspace, ".env"),
      "PORT=4000\nCLIENT_URL=http://localhost:5173\nGEMINI_API_KEY=root-key\n",
    );
    writeFileSync(
      join(serverDirectory, ".env"),
      "PORT=4001\nCLIENT_URL=http://localhost:5174\nGEMINI_API_KEY=\n",
    );
    const target: NodeJS.ProcessEnv = { PORT: "4002" };
    loadEnvironmentFiles(serverDirectory, target);
    expect(target.PORT).toBe("4002");
    expect(target.CLIENT_URL).toBe("http://localhost:5174");
    expect(target.GEMINI_API_KEY).toBe("");
  });
  it("finds the same package for source and compiled modules independently of cwd", () => {
    expect(findPackageDirectory(join(serverDirectory, "src/config"))).toBe(serverDirectory);
    expect(findPackageDirectory(join(serverDirectory, "dist/src/config"))).toBe(serverDirectory);
  });
  it("supports deployments with shell variables and no .env file", () => {
    const target: NodeJS.ProcessEnv = { PORT: "4000" };
    loadEnvironmentFiles(serverDirectory, target);
    expect(target).toEqual({ PORT: "4000" });
  });
  it("identifies invalid settings without disclosing their values", () => {
    expect(() => envString(undefined, undefined, "MONGODB_URI")).toThrow(
      "Missing required environment variable: MONGODB_URI",
    );
    expect(() => envString("   ", undefined, "JWT_ACCESS_SECRET")).toThrow("JWT_ACCESS_SECRET");
    expect(() => envPositiveInteger("secret-value", 4000, "PORT")).toThrow(
      "PORT must be a positive integer.",
    );
  });
});
