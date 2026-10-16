import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { requestIdHeader } from "../../config/constants.js";

export const requestId = (req: Request, res: Response, next: NextFunction): void => {
  const incomingRequestId = req.header(requestIdHeader);
  const currentRequestId = incomingRequestId?.trim() || randomUUID();
  req.requestId = currentRequestId;
  res.setHeader(requestIdHeader, currentRequestId);
  next();
};
