import { afterEach, describe, expect, it, vi } from "vitest";
import { createEmbedding, splitIntoChunks } from "../../src/modules/knowledge/knowledge.ingest.js";
import { env } from "../../src/config/env.js";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
describe("knowledge indexing", () => {
  it("splits text without losing the end or looping on invalid settings", () => {
    expect(splitIntoChunks("a".repeat(2000), 900, 100)).toHaveLength(3);
    expect(splitIntoChunks("tail")).toEqual(["tail"]);
    expect(() => splitIntoChunks("text", 100, 100)).toThrow();
  });
  it("reads singular Gemini embedding and requests matching dimensions and task type", async () => {
    const previous = env.GEMINI_API_KEY;
    env.GEMINI_API_KEY = "fixture-key";
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ embedding: { values: Array(768).fill(1) } }), {
        status: 200,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    try {
      const vector = await createEmbedding("policy text", "RETRIEVAL_DOCUMENT");
      expect(vector).toHaveLength(768);
      expect(Math.hypot(...vector)).toBeCloseTo(1);
      const request = fetchMock.mock.calls[0]?.[1] as RequestInit;
      expect(JSON.parse(String(request.body))).toMatchObject({
        outputDimensionality: 768,
        taskType: "RETRIEVAL_DOCUMENT",
      });
    } finally {
      env.GEMINI_API_KEY = previous;
    }
  });
  it("rejects malformed vectors rather than silently storing empty embeddings", async () => {
    const previous = env.GEMINI_API_KEY;
    env.GEMINI_API_KEY = "fixture-key";
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ embeddings: [{ values: [1] }] }), { status: 200 }),
        ),
    );
    try {
      await expect(createEmbedding("test")).rejects.toThrow("invalid dimensions");
    } finally {
      env.GEMINI_API_KEY = previous;
    }
  });
});
