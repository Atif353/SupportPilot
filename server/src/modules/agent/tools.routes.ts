import { Router } from "express";
import { randomUUID } from "node:crypto";
import { requireAuth } from "../auth/auth.middleware.js";
import { asRecord, objectId, oneOf } from "../../common/validation.js";
import { AgentTrace } from "../models/agent-trace.model.js";
import { supportTools } from "./tools/support.tools.js";

const toolNames = [
  "getCustomer",
  "getCustomerOrders",
  "getOrder",
  "getOrderTracking",
  "searchKnowledgeBase",
  "updateShippingAddress",
  "cancelOrder",
  "createReturnRequest",
  "createRefundRequest",
  "createSupportTicket",
  "escalateToHuman",
] as const;

export const toolsRouter = Router();
toolsRouter.post("/:tool", requireAuth, async (req, res) => {
  const tool = oneOf(req.params.tool, "tool", toolNames);
  const input = asRecord(req.body);
  const startedAt = new Date();
  const userId = req.auth?.sub ?? "";
  const role = req.auth?.role ?? "CUSTOMER";
  const idempotencyKey = req.get("Idempotency-Key");
  const withKey = idempotencyKey ? { ...input, idempotencyKey } : input;
  let result: unknown;
  const trace = await AgentTrace.create({
    runId: randomUUID(),
    user: userId,
    agentType: "ToolExecutor",
    input: JSON.stringify({ tool }),
    status: "RUNNING",
    startedAt,
    toolCalls: [tool],
  });
  try {
    switch (tool) {
      case "getCustomer":
        result = await supportTools.getCustomer(userId, role);
        break;
      case "getCustomerOrders":
        result = await supportTools.getCustomerOrders(userId, role);
        break;
      case "getOrder":
        result = await supportTools.getOrder(userId, role, withKey);
        break;
      case "getOrderTracking":
        result = await supportTools.getOrderTracking(userId, role, withKey);
        break;
      case "searchKnowledgeBase":
        result = await supportTools.searchKnowledgeBase(withKey);
        break;
      case "updateShippingAddress":
        result = await supportTools.updateShippingAddress(userId, role, withKey);
        break;
      case "cancelOrder":
        result = await supportTools.cancelOrder(userId, role, withKey);
        break;
      case "createReturnRequest":
        result = await supportTools.createReturnRequest(userId, role, withKey);
        break;
      case "createRefundRequest":
        result = await supportTools.createRefundRequest(userId, role, withKey);
        break;
      case "createSupportTicket":
        result = await supportTools.createSupportTicket(userId, role, withKey);
        break;
      case "escalateToHuman":
        result = await supportTools.escalateToHuman(
          userId,
          objectId(input.conversationId, "conversationId"),
          role,
        );
        break;
    }
    await AgentTrace.updateOne(
      { _id: trace._id },
      {
        user: userId,
        agentType: "ToolExecutor",
        input: JSON.stringify({ tool, input }),
        output: JSON.stringify(result),
        toolCalls: [tool],
        latencyMs: Date.now() - startedAt.getTime(),
        status: "COMPLETED",
        startedAt,
        completedAt: new Date(),
        sources: tool === "searchKnowledgeBase" ? [JSON.stringify(result)] : [],
        tokenUsage: {},
      },
    );
    res.json({ success: true, data: { tool, result, traceId: trace.id } });
  } catch (error) {
    await AgentTrace.updateOne(
      { _id: trace._id },
      {
        status: "FAILED",
        error: error instanceof Error ? error.message : "Tool failed",
        completedAt: new Date(),
        latencyMs: Date.now() - startedAt.getTime(),
      },
    );
    throw error;
  }
});
