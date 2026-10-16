import { describe, expect, it } from "vitest";
import { composeAnswer, summarizeOrders } from "../../src/modules/agent/answers/compose.js";
import {
  createSupportGraph,
  type AgentEvent,
} from "../../src/modules/agent/graph/support.graph.js";

const order = {
  orderNumber: "ORD-000051",
  status: "SHIPPED",
  createdAt: "2026-09-27T10:00:00Z",
  estimatedDeliveryAt: "2026-10-02T10:00:00Z",
  trackingNumber: "TRK123",
  carrier: "FastShip",
  items: [{ name: "Wireless Headphones", quantity: 3 }],
};
const sources = [
  {
    title: "NovaStore Shipping and Delivery Policy",
    content:
      "# NovaStore Shipping and Delivery Policy\n\nIf a parcel has not moved for 5 business days, contact support and we will open a carrier investigation. Delivery addresses can be changed only before processing.",
  },
  {
    title: "NovaStore Damaged and Defective Items Policy",
    content:
      "If an item arrives damaged, report it within 14 days with photos. Defective items get a free replacement or refund.",
  },
];

describe("deterministic answers", () => {
  it("gives order details, relevant policy and next steps for a mixed question", () => {
    const answer = composeAnswer({
      intent: "ORDER",
      specialist: "OrderAgent",
      message: "My parcel has not turned up yet, what can I do about damaged or missing items?",
      orders: summarizeOrders([order]),
      sources,
    });
    expect(answer).toContain("**ORD-000051**");
    expect(answer).toContain("tracking TRK123 (FastShip)");
    expect(answer).toContain("estimated delivery");
    expect(answer).toContain("5 business days");
    expect(answer).toContain("14 days");
    expect(answer).toContain("Request an agent");
    expect(answer).not.toContain("# NovaStore");
  });

  it("explains how to start a return without claiming to have done it", () => {
    const answer = composeAnswer({
      intent: "RETURN",
      specialist: "ResolutionAgent",
      message: "I want to return my headphones",
      orders: [],
      sources,
    });
    expect(answer).toContain("can't start a return from chat");
    expect(answer).toContain("Nothing has been changed");
  });

  it("ignores malformed sources instead of crashing", () => {
    const answer = composeAnswer({
      intent: "POLICY",
      specialist: "KnowledgeAgent",
      message: "What is the policy?",
      orders: [],
      sources: [{ nonsense: true } as unknown as { title: string; content: string }],
    });
    expect(answer).toContain("couldn't find a published policy");
  });
});

describe("the reported scenario end to end", () => {
  it("answers fully and streams when every model is down", async () => {
    const events: AgentEvent[] = [];
    const calls: string[] = [];
    const result = await createSupportGraph({
      classify: async () => "ORDER",
      streamPaceMs: 0,
      execute: async (name) => {
        calls.push(name);
        return name === "getCustomerOrders" ? [order] : sources;
      },
      generate: async () => {
        throw new Error("503 high demand");
      },
      onEvent: (event) => events.push(event),
    }).invoke({
      message: "My parcel has not turned up yet, what can I do about damaged or missing items?",
      userId: "u",
      role: "CUSTOMER",
    });
    expect(calls).toEqual(["getCustomerOrders", "searchKnowledgeBase"]);
    expect(result.model).toBe("deterministic-fallback");
    expect(result.response).toContain("TRK123");
    expect(result.response).toContain("carrier investigation");
    const streamed = events
      .filter((event): event is Extract<AgentEvent, { type: "token" }> => event.type === "token")
      .map((event) => event.text)
      .join("");
    expect(streamed.replace(/\s+/g, " ").trim()).toBe(result.response.replace(/\s+/g, " ").trim());
  });
});
