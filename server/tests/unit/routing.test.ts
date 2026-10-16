import { describe, expect, it, vi } from "vitest";
import { routeIntent } from "../../src/modules/agent/routing/llm.router.js";
import { classifyIntent, matchIntent } from "../../src/modules/agent/routing/rules.js";
import {
  createSupportGraph,
  type AgentEvent,
} from "../../src/modules/agent/graph/support.graph.js";
import { routingCases, scoreRouting } from "../../src/modules/evaluations/routing.cases.js";

describe("intent routing cascade", () => {
  it("decides clear intents with rules and never calls the model", async () => {
    const classify = vi.fn().mockResolvedValue("GENERAL");
    expect(await routeIntent("Where is my order?", classify)).toEqual({
      intent: "ORDER",
      method: "rules",
    });
    expect(classify).not.toHaveBeenCalled();
  });

  it("asks the model only when no rule matches", async () => {
    const classify = vi.fn().mockResolvedValue("ORDER");
    expect(await routeIntent("has my stuff gone out yet", classify)).toEqual({
      intent: "ORDER",
      method: "llm",
    });
    expect(classify).toHaveBeenCalledOnce();
  });

  it("degrades to GENERAL when the model fails or abstains", async () => {
    const fallback = { intent: "GENERAL", method: "fallback" };
    expect(await routeIntent("has my stuff gone out yet", async () => null)).toEqual(fallback);
    expect(
      await routeIntent("has my stuff gone out yet", async () => {
        throw new Error("timeout");
      }),
    ).toEqual(fallback);
  });

  it("documents the rules-only baseline the model improves on", () => {
    const rulesOnly = routingCases.map((testCase) => classifyIntent(testCase.prompt));
    const score = scoreRouting(rulesOnly);
    expect(score.accuracy).toBeGreaterThan(0.4);
    expect(score.accuracy).toBeLessThan(1);
    expect(routingCases.filter((testCase) => !matchIntent(testCase.prompt)).length).toBeGreaterThan(
      5,
    );
  });
});

describe("agent run events", () => {
  it("emits ordered step events and streams tokens from the answer node", async () => {
    const events: AgentEvent[] = [];
    const graph = createSupportGraph({
      execute: async () => [{ title: "Returns", content: "30 days.", documentId: "d" }],
      classify: async () => null,
      generate: async (_q, _c, _e, _h, onToken) => {
        onToken?.("Returns ");
        onToken?.("take 30 days.");
        return { response: "Returns take 30 days.", tokenUsage: {}, model: "fake" };
      },
      onEvent: (event) => events.push(event),
    });
    const result = await graph.invoke({
      message: "What is the return policy?",
      userId: "u",
      role: "CUSTOMER",
    });
    expect(result.routing).toBe("rules");
    expect(events.filter((event) => event.type === "step").map((event) => event.label)).toEqual([
      "Checking your message",
      "Understanding your request",
      "Searching store policies",
      "Writing your answer",
      "Checking the answer for safety",
    ]);
    expect(events.filter((event) => event.type === "token")).toHaveLength(2);
  });

  it("routes a paraphrase through the model and records the routing method", async () => {
    const graph = createSupportGraph({
      execute: async (name) =>
        name === "getCustomerOrders"
          ? [{ _id: "o", orderNumber: "TEST-1", status: "SHIPPED", trackingNumber: "TRK9" }]
          : [],
      classify: async () => "ORDER",
      generate: async () => null,
    });
    const result = await graph.invoke({
      message: "has my stuff gone out yet",
      userId: "u",
      role: "CUSTOMER",
    });
    expect(result.routing).toBe("llm");
    expect(result.specialist).toBe("OrderAgent");
    expect(result.response).toContain("TEST-1");
  });
});
