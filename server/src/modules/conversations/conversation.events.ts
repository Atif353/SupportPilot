import { EventEmitter } from "node:events";
import type { AgentEvent } from "../agent/graph/support.graph.js";

export const conversationEvents = new EventEmitter();
export const notifyConversation = (id: string) => conversationEvents.emit("updated", id);
export const notifyAgentEvent = (conversationId: string, event: AgentEvent) =>
  conversationEvents.emit("agent", { conversationId, ...event });
