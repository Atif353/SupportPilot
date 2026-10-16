import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ connect: vi.fn(), disconnect: vi.fn(), command: vi.fn() }));
vi.mock("mongoose", () => ({
  default: {
    connect: mocks.connect,
    disconnect: mocks.disconnect,
    connection: { db: { admin: () => ({ command: mocks.command }) } },
  },
}));

import { connectDatabase } from "../../src/config/database.js";

beforeEach(() => {
  vi.resetAllMocks();
  mocks.connect.mockResolvedValue(undefined);
  mocks.disconnect.mockResolvedValue(undefined);
});

describe("database startup", () => {
  it.each([{ setName: "rs0" }, { msg: "isdbgrid" }])(
    "accepts transactional topology %j",
    async (topology) => {
      mocks.command.mockResolvedValue(topology);
      await expect(connectDatabase()).resolves.toBeUndefined();
      expect(mocks.disconnect).not.toHaveBeenCalled();
    },
  );

  it("disconnects from standalone MongoDB and explains how to configure local development", async () => {
    mocks.command.mockResolvedValue({ isWritablePrimary: true });
    await expect(connectDatabase()).rejects.toThrow("run pnpm db:start");
    expect(mocks.disconnect).toHaveBeenCalledOnce();
  });

  it("cleans up when topology inspection fails without hiding the original error", async () => {
    const error = new Error("Topology inspection failed");
    mocks.command.mockRejectedValue(error);
    await expect(connectDatabase()).rejects.toBe(error);
    expect(mocks.disconnect).toHaveBeenCalledOnce();
  });
});
