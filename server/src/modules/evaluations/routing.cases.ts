import type { AgentIntent } from "../agent/routing/rules.js";

export type RoutingCase = { prompt: string; expected: AgentIntent };

/** Labeled intents, including paraphrases that contain none of the rule keywords. */
export const routingCases: RoutingCase[] = [
  { prompt: "Where is my latest order?", expected: "ORDER" },
  { prompt: "Track my delivery", expected: "ORDER" },
  { prompt: "Where is my package? It was meant to be here already", expected: "ORDER" },
  { prompt: "My parcel hasn't turned up yet", expected: "ORDER" },
  { prompt: "Has my stuff shipped?", expected: "ORDER" },
  { prompt: "What is the return policy?", expected: "POLICY" },
  { prompt: "How long is the warranty on electronics?", expected: "POLICY" },
  { prompt: "Do you charge for shipping?", expected: "POLICY" },
  { prompt: "How many days do I get to change my mind?", expected: "POLICY" },
  { prompt: "I want to return my headphones", expected: "RETURN" },
  { prompt: "I'd like to send these back, they don't fit", expected: "RETURN" },
  { prompt: "Can I swap this for a different size?", expected: "RETURN" },
  { prompt: "Refund my order please", expected: "REFUND" },
  { prompt: "I want my money back", expected: "REFUND" },
  { prompt: "Please reimburse me for the broken item", expected: "REFUND" },
  { prompt: "Cancel my order", expected: "CANCEL" },
  { prompt: "I changed my mind, stop my purchase", expected: "CANCEL" },
  { prompt: "I don't want it anymore, call off the order", expected: "CANCEL" },
  { prompt: "I want to talk to a human", expected: "HUMAN" },
  { prompt: "Can I speak to someone?", expected: "HUMAN" },
  { prompt: "This is ridiculous, get me a real agent now", expected: "HUMAN" },
  { prompt: "Hello", expected: "GENERAL" },
  { prompt: "Thanks, that's all!", expected: "GENERAL" },
  { prompt: "What can you help me with?", expected: "GENERAL" },
];

export type RoutingScore = { total: number; correct: number; accuracy: number };

export function scoreRouting(predictions: AgentIntent[], cases = routingCases): RoutingScore {
  const correct = cases.filter(
    (testCase, index) => predictions[index] === testCase.expected,
  ).length;
  return { total: cases.length, correct, accuracy: cases.length ? correct / cases.length : 0 };
}
