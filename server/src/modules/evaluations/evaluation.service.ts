import { EvaluationRun } from "../models/evaluation-run.model.js";
import { evaluationCases } from "./evaluation.cases.js";
import { createSupportGraph } from "../agent/graph/support.graph.js";

const fixtureSource = {
  documentId: "fixture-policy",
  title: "Fixture returns policy",
  content: "Returns must be requested within 30 days of delivery. Refunds require staff approval.",
  source: "fixture://returns",
  score: 1,
};
export async function evaluateFixtureCases() {
  const results = [];
  for (const testCase of evaluationCases) {
    const startedAt = Date.now();
    const executedTools: string[] = [];
    const graph = createSupportGraph({
      execute: async (name) => {
        executedTools.push(name);
        if (name === "getCustomerOrders")
          return [{ _id: "fixture-order", orderNumber: "TEST-001", status: "DELIVERED" }];
        if (name === "searchKnowledgeBase") return [fixtureSource];
        throw new Error("Unexpected fixture tool: " + name);
      },
      generate: async () => null,
      classify: async () => null,
      escalate: async () => {
        executedTools.push("escalateToHuman");
        return { status: "WAITING" };
      },
    });
    try {
      const result = await graph.invoke({
        message: testCase.prompt,
        userId: "fixture-user",
        role: "CUSTOMER",
        conversationId: "fixture-conversation",
      });
      const routingPassed = result.specialist === testCase.expectedRoute;
      const toolsPassed =
        testCase.expectedTools.length === executedTools.length &&
        testCase.expectedTools.every((tool) => executedTools.includes(tool));
      const citationsPassed =
        !testCase.expectsCitation ||
        result.sources.some(
          (source) => (source as { documentId: string }).documentId === fixtureSource.documentId,
        );
      const safetyPassed = !executedTools.some((name) =>
        [
          "cancelOrder",
          "createReturnRequest",
          "createRefundRequest",
          "updateShippingAddress",
        ].includes(name),
      );
      results.push({
        id: testCase.id,
        prompt: testCase.prompt,
        expectedRoute: testCase.expectedRoute,
        actualRoute: result.specialist,
        toolCalls: executedTools,
        response: result.response,
        routingPassed,
        toolsPassed,
        citationsPassed,
        safetyPassed,
        expectsCitation: testCase.expectsCitation,
        passed: routingPassed && toolsPassed && citationsPassed && safetyPassed,
        latencyMs: Date.now() - startedAt,
      });
    } catch (error) {
      results.push({
        id: testCase.id,
        prompt: testCase.prompt,
        expectedRoute: testCase.expectedRoute,
        actualRoute: "FAILED",
        toolCalls: executedTools,
        response: "",
        routingPassed: false,
        toolsPassed: false,
        citationsPassed: false,
        safetyPassed: false,
        expectsCitation: testCase.expectsCitation,
        passed: false,
        latencyMs: Date.now() - startedAt,
        error: error instanceof Error ? error.message : "Case failed",
      });
    }
  }
  const ratio = (values: boolean[]) =>
    values.length ? values.filter(Boolean).length / values.length : 0;
  const metrics = {
    cases: results.length,
    passRate: ratio(results.map((item) => item.passed)),
    routingAccuracy: ratio(results.map((item) => item.routingPassed)),
    toolAccuracy: ratio(results.map((item) => item.toolsPassed)),
    citationCoverage: ratio(
      results.filter((item) => item.expectsCitation).map((item) => item.citationsPassed),
    ),
    actionSafety: ratio(results.map((item) => item.safetyPassed)),
  };
  return { results, metrics };
}

export async function runEvaluation() {
  const run = await EvaluationRun.create({
    name: "Offline agent regression",
    dataset: "supportpilot-fixtures-v2",
    mode: "FIXTURE",
    status: "RUNNING",
    startedAt: new Date(),
  });
  try {
    const outcome = await evaluateFixtureCases();
    run.set({ ...outcome, status: "COMPLETED", completedAt: new Date() });
    return await run.save();
  } catch (error) {
    run.set({
      status: "FAILED",
      error: error instanceof Error ? error.message : "Evaluation failed",
      completedAt: new Date(),
    });
    await run.save();
    throw error;
  }
}
