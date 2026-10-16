import { randomUUID } from "node:crypto";
import type { Request, Response } from "express";
import { asRecord, objectId, requiredString } from "../../common/validation.js";
import { AppError } from "../../common/errors/AppError.js";
import { AgentTrace } from "../models/agent-trace.model.js";
import { runSupportGraph } from "./graph/support.graph.js";
import { redactSensitive } from "./guardrails/sensitive.js";
import { Conversation } from "../models/conversation.model.js";
import { Message } from "../models/message.model.js";
import { assertConversationAccess } from "../conversations/conversation.service.js";
import { notifyAgentEvent, notifyConversation } from "../conversations/conversation.events.js";

export async function runAgent(req: Request, res: Response): Promise<void> {
  const body = asRecord(req.body);
  const redaction = redactSensitive(requiredString(body.message, "message", { max: 4000 }));
  const message = redaction.text;
  const conversationId = objectId(body.conversationId, "conversationId");
  const { sub: userId, role } = req.auth!;
  await assertConversationAccess(userId, role, conversationId);
  const leaseUntil = new Date(Date.now() + 120000);
  const locked = await Conversation.findOneAndUpdate(
    {
      _id: conversationId,
      status: "OPEN",
      assignedTo: null,
      $or: [{ agentLeaseUntil: null }, { agentLeaseUntil: { $lt: new Date() } }],
    },
    { agentLeaseUntil: leaseUntil },
  );
  if (!locked)
    throw new AppError({
      message: "This conversation is closed, handled by staff, or already processing a message.",
      code: "CONFLICT",
      statusCode: 409,
    });
  let traceId: string | undefined;
  const startedAt = new Date();
  try {
    const trace = await AgentTrace.create({
      runId: randomUUID(),
      conversation: conversationId,
      user: userId,
      agentType: "Supervisor",
      input: message,
      status: "RUNNING",
      startedAt,
    });
    traceId = trace.id;
    const history = (
      await Message.find({ conversation: conversationId })
        .sort({ createdAt: -1, _id: -1 })
        .limit(12)
        .select("senderType content")
        .lean()
    ).reverse();
    await Message.create({
      conversation: conversationId,
      senderType: role === "CUSTOMER" ? "CUSTOMER" : "AGENT",
      sender: userId,
      content: message,
    });
    notifyConversation(conversationId);
    const result = await runSupportGraph(
      { message, conversationId, userId, role, history, guardrails: redaction.flags },
      {
        onEvent: (event) => notifyAgentEvent(conversationId, event),
        onTool: async (span) => {
          await AgentTrace.updateOne({ _id: traceId }, { $push: { spans: span } });
        },
      },
    );
    await Message.create({
      conversation: conversationId,
      senderType: "AI",
      content: result.response,
      citations: result.sources,
      metadata: {
        agent: result.specialist,
        traceId: String(traceId),
        ...(result.guardrails.length
          ? { guardrails: [...new Set(result.guardrails.map((flag) => flag.guard))].join(",") }
          : {}),
      },
    });
    await AgentTrace.updateOne(
      { _id: traceId },
      {
        agentType: result.specialist,
        output: result.response,
        toolCalls: result.toolCalls,
        graphNodes: result.graphNodes,
        routing: result.routing,
        guardrails: result.guardrails,
        model: result.model,
        tokenUsage: result.tokenUsage,
        sources: result.sources.map((source) => JSON.stringify(source)),
        status: "COMPLETED",
        latencyMs: Date.now() - startedAt.getTime(),
        completedAt: new Date(),
      },
    );
    res.json({
      success: true,
      data: {
        response: result.response,
        agent: result.specialist,
        sources: result.sources,
        result: result.result,
        traceId: String(traceId),
      },
    });
  } catch (error) {
    if (traceId)
      await AgentTrace.updateOne(
        { _id: traceId },
        {
          status: "FAILED",
          error: error instanceof Error ? error.message : "Agent run failed",
          latencyMs: Date.now() - startedAt.getTime(),
          completedAt: new Date(),
        },
      );
    throw error;
  } finally {
    await Conversation.updateOne(
      { _id: conversationId, agentLeaseUntil: leaseUntil },
      { $unset: { agentLeaseUntil: 1 }, $set: { lastMessageAt: new Date() } },
    );
    notifyConversation(conversationId);
  }
}
