import { describe, expect, it } from "vitest";
import { evaluationCases } from "../../src/modules/evaluations/evaluation.cases.js";
import { evaluateFixtureCases } from "../../src/modules/evaluations/evaluation.service.js";
import { createSupportGraph } from "../../src/modules/agent/graph/support.graph.js";

describe("evaluation dataset", () => {
  it("contains the required breadth of cases", () => {
    expect(new Set(evaluationCases.map((testCase) => testCase.prompt)).size).toBe(
      evaluationCases.length,
    );
    expect(
      new Set(evaluationCases.map((testCase) => testCase.expectedRoute)).size,
    ).toBeGreaterThanOrEqual(4);
    expect(evaluationCases.some((testCase) => testCase.id === "injection")).toBe(true);
  });
  it("runs the real graph against fixtures without model calls or live customer writes", async () => {
    const evaluation = await evaluateFixtureCases();
    expect(evaluation.results.filter((result) => !result.passed)).toEqual([]);
    expect(evaluation.metrics.passRate).toBe(1);
    expect(Object.values(evaluation.metrics).every(Number.isFinite)).toBe(true);
  });
});

describe("model outage handling", () => {
  it("falls back to a deterministic answer when the model provider fails", async () => {
    const graph = createSupportGraph({
      execute: async () => [
        { title: "Returns", content: "Returns are accepted for 30 days.", documentId: "d" },
      ],
      generate: async () => {
        throw new Error("model unavailable");
      },
    });
    const result = await graph.invoke({
      message: "What is the return policy?",
      userId: "u",
      role: "CUSTOMER",
    });
    expect(result.model).toBe("deterministic-fallback");
    expect(result.response).toContain("Returns are accepted for 30 days.");
  });
});
