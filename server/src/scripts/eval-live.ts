import { setTimeout as pause } from "node:timers/promises";
import { env } from "../config/env.js";
import { routeIntent } from "../modules/agent/routing/llm.router.js";
import { classifyIntent, type AgentIntent } from "../modules/agent/routing/rules.js";
import { routingCases, scoreRouting } from "../modules/evaluations/routing.cases.js";

/**
 * Measures intent-routing accuracy with the real model: rules alone versus the rules+model
 * cascade. Needs GEMINI_API_KEY. Paced to stay inside free-tier rate limits (EVAL_PACE_MS).
 */
async function run(): Promise<void> {
  if (!env.GEMINI_API_KEY) throw new Error("Set GEMINI_API_KEY to run the live evaluation.");
  const pace = Number(process.env.EVAL_PACE_MS ?? 13000);
  const minimum = Number(process.env.EVAL_MIN_ACCURACY ?? 0.8);
  const cascade: AgentIntent[] = [];
  console.log(`Router model: ${env.GEMINI_ROUTER_MODEL}\n`);
  for (const testCase of routingCases) {
    const decision = await routeIntent(testCase.prompt);
    cascade.push(decision.intent);
    const mark = decision.intent === testCase.expected ? "ok  " : "MISS";
    console.log(
      `${mark} ${decision.method.padEnd(8)} ${testCase.expected.padEnd(8)} -> ${decision.intent.padEnd(8)} ${testCase.prompt}`,
    );
    if (decision.method !== "rules") await pause(pace);
  }
  const rulesOnly = scoreRouting(routingCases.map((testCase) => classifyIntent(testCase.prompt)));
  const withModel = scoreRouting(cascade);
  console.log(
    `\nRules only:        ${rulesOnly.correct}/${rulesOnly.total} (${(rulesOnly.accuracy * 100).toFixed(0)}%)`,
  );
  console.log(
    `Rules + ${env.GEMINI_ROUTER_MODEL}: ${withModel.correct}/${withModel.total} (${(withModel.accuracy * 100).toFixed(0)}%)`,
  );
  if (withModel.accuracy < minimum) {
    console.error(`Accuracy is below the ${minimum} threshold.`);
    process.exitCode = 1;
  }
}

run().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
