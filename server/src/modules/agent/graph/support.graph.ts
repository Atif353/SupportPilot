import { setTimeout as pause } from "node:timers/promises";
import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import {
  generateGroundedResponse,
  type AgentGeneration,
  type HistoryMessage,
  type ReadTool,
  type ToolExecutor,
  type ToolSpan,
} from "../providers/chat.provider.js";
import { logger } from "../../../config/logger.js";
import { composeAnswer, composeOrderSection, summarizeOrders } from "../answers/compose.js";
import { checkInput, sensitiveDataNotice } from "../guardrails/input.guard.js";
import { checkOutput } from "../guardrails/output.guard.js";
import type { GuardFlag } from "../guardrails/types.js";
import { routeIntent, type IntentClassifier, type RoutingDecision } from "../routing/llm.router.js";
import type { AgentIntent } from "../routing/rules.js";
import { callSupportTool } from "../tools/catalog.js";
import { supportTools } from "../tools/support.tools.js";

export type { GuardFlag } from "../guardrails/types.js";

/** Live progress emitted while a run executes, for streaming to the client. */
export type AgentEvent =
  | { type: "step"; label: string }
  | { type: "token"; text: string }
  | { type: "replace"; text: string }
  | { type: "reset" };

const stepLabels = {
  inputGuard: "Checking your message",
  supervisor: "Understanding your request",
  orderAgent: "Checking your orders",
  knowledgeAgent: "Searching store policies",
  resolutionAgent: "Reviewing your options",
  humanAgent: "Contacting a support agent",
  responseAgent: "Writing your answer",
  outputGuard: "Checking the answer for safety",
} as const;

/** Order questions that also need policy evidence (damage, loss, delays, refunds, returns). */
const needsPolicy =
  /\b(damag\w*|broken|defect\w*|faulty|missing|lost|not (?:arrive|turn)\w*|never (?:arrive|came)|turned up|late|delay\w*|refund\w*|return\w*|warrant\w*|polic\w+|replace\w*)\b/i;

const SupportState = Annotation.Root({
  message: Annotation<string>,
  userId: Annotation<string>,
  role: Annotation<string>,
  conversationId: Annotation<string | undefined>,
  history: Annotation<HistoryMessage[]>,
  intent: Annotation<AgentIntent>,
  routing: Annotation<string>,
  specialist: Annotation<string>,
  blocked: Annotation<boolean>({ reducer: (_a, b) => b, default: () => false }),
  guardrails: Annotation<GuardFlag[]>({ reducer: (a, b) => [...a, ...b], default: () => [] }),
  streamed: Annotation<string>({ reducer: (_a, b) => b, default: () => "" }),
  orders: Annotation<unknown[]>({ reducer: (_a, b) => b, default: () => [] }),
  sources: Annotation<unknown[]>({ reducer: (_a, b) => b, default: () => [] }),
  result: Annotation<unknown>,
  toolCalls: Annotation<string[]>({ reducer: (a, b) => [...a, ...b], default: () => [] }),
  graphNodes: Annotation<string[]>({ reducer: (a, b) => [...a, ...b], default: () => [] }),
  response: Annotation<string>,
  tokenUsage: Annotation<Record<string, number>>,
  model: Annotation<string>,
});
export type GraphInput = {
  message: string;
  userId: string;
  role: string;
  conversationId?: string;
  history?: HistoryMessage[];
  /** Flags raised before the graph started, for example redaction done at the API boundary. */
  guardrails?: GuardFlag[];
};
type Dependencies = {
  execute?: (
    name: ReadTool,
    context: { userId: string; role: string },
    input: Record<string, unknown>,
  ) => Promise<unknown>;
  generate?: (
    question: string,
    context: unknown,
    execute: ToolExecutor,
    history: HistoryMessage[],
    onToken?: (text: string) => void,
    onReset?: () => void,
  ) => Promise<AgentGeneration | null>;
  classify?: IntentClassifier;
  escalate?: (userId: string, conversationId: string, role: string) => Promise<unknown>;
  onTool?: (span: ToolSpan) => Promise<void>;
  onEvent?: (event: AgentEvent) => void;
  /** Delay between streamed chunks of template answers; 0 disables pacing. */
  streamPaceMs?: number;
};

const specialistFor = (intent: AgentIntent): string =>
  intent === "HUMAN"
    ? "HumanEscalation"
    : intent === "POLICY"
      ? "KnowledgeAgent"
      : intent === "ORDER"
        ? "OrderAgent"
        : ["RETURN", "REFUND", "CANCEL"].includes(intent)
          ? "ResolutionAgent"
          : "Supervisor";

const sensitiveGuards = new Set(["payment_card", "government_id", "api_secret"]);

export function createSupportGraph(deps: Dependencies = {}) {
  type State = typeof SupportState.State;
  const pace = deps.streamPaceMs ?? (deps.onEvent ? 18 : 0);
  const announce = (node: keyof typeof stepLabels) =>
    deps.onEvent?.({ type: "step", label: stepLabels[node] });
  /** Streams a finished answer in small chunks so template answers feel like model output. */
  const streamText = async (text: string) => {
    if (!deps.onEvent) return;
    deps.onEvent({ type: "reset" });
    for (const chunk of text.match(/\S+\s*/g)?.reduce<string[]>((groups, word, index) => {
      if (index % 3 === 0) groups.push(word);
      else groups[groups.length - 1] += word;
      return groups;
    }, []) ?? [text]) {
      deps.onEvent({ type: "token", text: chunk });
      if (pace) await pause(pace);
    }
  };
  const execute = async (state: State, name: ReadTool, input: Record<string, unknown> = {}) => {
    const started = Date.now();
    try {
      const result = await (deps.execute ?? callSupportTool)(
        name,
        { userId: state.userId, role: state.role },
        input,
      );
      await deps.onTool?.({ name, latencyMs: Date.now() - started, status: "COMPLETED" });
      return result;
    } catch (error) {
      await deps.onTool?.({
        name,
        latencyMs: Date.now() - started,
        status: "FAILED",
        error: error instanceof Error ? error.message : "Tool failed",
      });
      throw error;
    }
  };
  return new StateGraph(SupportState)
    .addNode("inputGuard", async (state) => {
      announce("inputGuard");
      const verdict = checkInput(state.message);
      if (!verdict.allowed && verdict.refusal) {
        await streamText(verdict.refusal);
        return {
          message: verdict.message,
          blocked: true,
          guardrails: verdict.flags,
          intent: "GENERAL" as AgentIntent,
          specialist: "Guardrail",
          routing: "guardrail",
          response: verdict.refusal,
          model: "guardrail",
          tokenUsage: {},
          graphNodes: ["inputGuard"],
        };
      }
      return { message: verdict.message, guardrails: verdict.flags, graphNodes: ["inputGuard"] };
    })
    .addNode("supervisor", async (state) => {
      announce("supervisor");
      const decision: RoutingDecision = await routeIntent(state.message, deps.classify);
      return {
        intent: decision.intent,
        routing: decision.method,
        specialist: specialistFor(decision.intent),
        graphNodes: ["supervisor"],
      };
    })
    .addNode("orderAgent", async (state) => {
      announce("orderAgent");
      return {
        orders: (await execute(state, "getCustomerOrders")) as unknown[],
        toolCalls: ["getCustomerOrders"],
        graphNodes: ["orderAgent"],
      };
    })
    .addNode("knowledgeAgent", async (state) => {
      announce("knowledgeAgent");
      return {
        sources: (await execute(state, "searchKnowledgeBase", {
          query: state.message,
        })) as unknown[],
        toolCalls: ["searchKnowledgeBase"],
        graphNodes: ["knowledgeAgent"],
      };
    })
    .addNode("resolutionAgent", () => {
      announce("resolutionAgent");
      return { graphNodes: ["resolutionAgent"], result: { requiresConfirmation: true } };
    })
    .addNode("humanAgent", async (state) => {
      announce("humanAgent");
      return {
        result: state.conversationId
          ? await (deps.escalate ?? supportTools.escalateToHuman)(
              state.userId,
              state.conversationId,
              state.role,
            )
          : { requiresConversation: true },
        response: state.conversationId
          ? "Your conversation is waiting for a support agent."
          : "Start a conversation to request a support agent.",
        toolCalls: state.conversationId ? ["escalateToHuman"] : [],
        graphNodes: ["humanAgent"],
        model: "deterministic",
        tokenUsage: {},
      };
    })
    .addNode("responseAgent", async (state) => {
      announce("responseAgent");
      const extraTools: string[] = [];
      const sources = [...state.sources];
      const orders = summarizeOrders(state.orders);
      let generated: AgentGeneration | null = null;
      let modelFailed = false;
      let streamed = "";
      try {
        generated = await (deps.generate ?? generateGroundedResponse)(
          state.message,
          {
            orders,
            sources: sources.map((entry) => {
              const { title, content } = entry as { title: string; content: string };
              return { title, content };
            }),
            intent: state.intent,
            safetyNotes: state.guardrails.map((flag) => flag.guard),
          },
          async (name, input) => {
            extraTools.push(name);
            const result = await execute(state, name, input);
            if (name === "searchKnowledgeBase" && Array.isArray(result)) sources.push(...result);
            return result;
          },
          state.history ?? [],
          (text) => {
            streamed += text;
            deps.onEvent?.({ type: "token", text });
          },
          () => {
            streamed = "";
            deps.onEvent?.({ type: "reset" });
          },
        );
      } catch (error) {
        modelFailed = true;
        streamed = "";
        deps.onEvent?.({ type: "reset" });
        logger.warn({ error }, "Model generation failed; using the deterministic answer");
      }
      const fallback = composeAnswer({
        intent: state.intent,
        specialist: state.specialist,
        message: state.message,
        orders,
        sources: sources as { title: string; content: string }[],
      });
      return {
        response: generated?.response ?? fallback,
        model: generated?.model ?? (modelFailed ? "deterministic-fallback" : "deterministic"),
        tokenUsage: generated?.tokenUsage ?? {},
        sources,
        streamed: generated ? streamed : "",
        toolCalls: extraTools,
        graphNodes: ["responseAgent"],
      };
    })
    .addNode("outputGuard", async (state) => {
      announce("outputGuard");
      const verdict = checkOutput(state.response, {
        intent: state.intent,
        sourceCount: state.sources.length,
      });
      const redactedInput = state.guardrails.some(
        (flag) => flag.action === "redacted" && sensitiveGuards.has(flag.guard),
      );
      const flags = [...verdict.flags];
      let answer = verdict.text;
      // Grounding: an order question must be answered with the customer's real orders, whichever
      // model wrote the answer. If it never mentions one, the verified order details lead.
      const orders = summarizeOrders(state.orders);
      if (
        state.intent === "ORDER" &&
        orders.length &&
        !orders.some((order) => order.orderNumber && answer.includes(order.orderNumber))
      ) {
        answer = `${composeOrderSection(orders, state.message)}\n\n${answer}`;
        flags.push({
          guard: "order_grounding",
          action: "rewritten",
          detail: "Added the customer's order details",
        });
      }
      const text = redactedInput ? `${sensitiveDataNotice}\n\n${answer}` : answer;
      if (state.model.startsWith("deterministic")) await streamText(text);
      else if (text !== state.streamed) deps.onEvent?.({ type: "replace", text });
      return {
        response: text,
        guardrails: flags,
        graphNodes: ["outputGuard"],
      };
    })
    .addEdge(START, "inputGuard")
    .addConditionalEdges("inputGuard", (state) => (state.blocked ? END : "supervisor"))
    .addConditionalEdges("supervisor", (state) =>
      state.intent === "HUMAN"
        ? "humanAgent"
        : state.intent === "POLICY"
          ? "knowledgeAgent"
          : state.intent === "ORDER"
            ? "orderAgent"
            : state.specialist === "ResolutionAgent"
              ? "resolutionAgent"
              : "responseAgent",
    )
    .addConditionalEdges("orderAgent", (state) =>
      needsPolicy.test(state.message) ? "knowledgeAgent" : "responseAgent",
    )
    .addEdge("resolutionAgent", "knowledgeAgent")
    .addEdge("knowledgeAgent", "responseAgent")
    .addEdge("responseAgent", "outputGuard")
    .addEdge("outputGuard", END)
    .addEdge("humanAgent", END)
    .compile();
}
export const runSupportGraph = (input: GraphInput, deps: Dependencies = {}) =>
  createSupportGraph(deps).invoke(input, { recursionLimit: 14 });
