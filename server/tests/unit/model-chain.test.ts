import { describe, expect, it, vi } from "vitest";
import {
  isProviderFailure,
  modelChain,
  withModelFallback,
} from "../../src/modules/agent/providers/model.chain.js";

describe("model fallback chain", () => {
  it("parses comma-separated model lists", () => {
    expect(modelChain(" a , b,,c ")).toEqual(["a", "b", "c"]);
  });

  it("recognises provider outages but not logic errors", () => {
    expect(isProviderFailure(new Error("[503 Service Unavailable] high demand"))).toBe(true);
    expect(isProviderFailure(new Error("429 Too Many Requests quota"))).toBe(true);
    expect(isProviderFailure(new DOMException("The operation timed out", "TimeoutError"))).toBe(
      true,
    );
    expect(isProviderFailure(new Error("Agent tool budget exceeded."))).toBe(false);
  });

  it("moves to the next model after an outage and reports the failed one", async () => {
    const attempt = vi
      .fn()
      .mockRejectedValueOnce(new Error("503 high demand"))
      .mockResolvedValueOnce("answer");
    const onFallback = vi.fn();
    expect(
      await withModelFallback(["primary", "backup"], { deadlineMs: 5000 }, attempt, onFallback),
    ).toBe("answer");
    expect(attempt.mock.calls.map((call) => call[0])).toEqual(["primary", "backup"]);
    expect(onFallback).toHaveBeenCalledWith("primary", expect.any(Error));
  });

  it("does not retry logic errors on another model", async () => {
    const attempt = vi.fn().mockRejectedValue(new Error("Agent tool budget exceeded."));
    await expect(withModelFallback(["a", "b"], { deadlineMs: 5000 }, attempt)).rejects.toThrow(
      "budget",
    );
    expect(attempt).toHaveBeenCalledTimes(1);
  });

  it("rethrows the last outage when every model fails", async () => {
    const attempt = vi.fn().mockRejectedValue(new Error("503 unavailable"));
    await expect(
      withModelFallback(["a", "b"], { deadlineMs: 5000, rounds: 1 }, attempt),
    ).rejects.toThrow("503");
    expect(attempt).toHaveBeenCalledTimes(2);
  });
});

describe("transient overload", () => {
  it("retries the chain for a second round before giving up", async () => {
    const attempt = vi
      .fn()
      .mockRejectedValueOnce(new Error("503 high demand"))
      .mockRejectedValueOnce(new Error("503 high demand"))
      .mockResolvedValueOnce("answer");
    expect(await withModelFallback(["a", "b"], { deadlineMs: 5000 }, attempt)).toBe("answer");
    expect(attempt.mock.calls.map((call) => call[0])).toEqual(["a", "b", "a"]);
  });
});

describe("hanging models", () => {
  it("caps each attempt so a hung model cannot starve the next one", async () => {
    const attempt = vi.fn(async (model: string, signal: AbortSignal) => {
      if (model === "hung")
        await new Promise((_, reject) =>
          signal.addEventListener("abort", () => reject(new Error("The operation timed out"))),
        );
      return `${model} answered`;
    });
    const started = Date.now();
    const result = await withModelFallback(
      ["hung", "healthy"],
      { deadlineMs: 5000, perAttemptMs: 200 },
      attempt,
    );
    expect(result).toBe("healthy answered");
    expect(Date.now() - started).toBeLessThan(1500);
  });
});
