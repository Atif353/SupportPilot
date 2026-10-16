import { Router } from "express";
import { requireAuth } from "../auth/auth.middleware.js";
import {
  getConversations,
  getMessages,
  postConversation,
  postMessage,
} from "./conversation.controller.js";

export const conversationRouter = Router();
conversationRouter.use(requireAuth);
conversationRouter.get("/", getConversations);
conversationRouter.post("/", postConversation);
conversationRouter.get("/:id/messages", getMessages);
conversationRouter.post("/:id/messages", postMessage);
