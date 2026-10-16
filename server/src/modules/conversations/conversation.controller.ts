import type { Request, Response } from "express";
import { asRecord, objectId, requiredString } from "../../common/validation.js";
import {
  createConversationMessage,
  createConversation,
  getConversationMessages,
  listConversations,
} from "./conversation.service.js";

export const getConversations = async (req: Request, res: Response): Promise<void> => {
  res.json({
    success: true,
    data: await listConversations(req.auth?.sub ?? "", req.auth?.role ?? "CUSTOMER"),
  });
};

export const postConversation = async (req: Request, res: Response): Promise<void> => {
  const title = requiredString(asRecord(req.body).title, "title", { min: 1, max: 120 });
  res
    .status(201)
    .json({ success: true, data: await createConversation(req.auth?.sub ?? "", title) });
};

export const getMessages = async (req: Request, res: Response): Promise<void> => {
  const id = objectId(req.params.id);
  res.json({
    success: true,
    data: await getConversationMessages(req.auth?.sub ?? "", req.auth?.role ?? "CUSTOMER", id),
  });
};

export const postMessage = async (req: Request, res: Response): Promise<void> => {
  const id = objectId(req.params.id);
  const content = requiredString(asRecord(req.body).content, "content", { min: 1, max: 4000 });
  const result = await createConversationMessage(
    req.auth?.sub ?? "",
    req.auth?.role ?? "CUSTOMER",
    id,
    content,
  );
  res.status(201).json({ success: true, data: result });
};
