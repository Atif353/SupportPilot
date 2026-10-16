import type { RequestHandler } from "express";

export const getHealth: RequestHandler = (_req, res) => {
  res.status(200).json({
    success: true,
    data: {
      service: "supportpilot-api",
      status: "ok",
      timestamp: new Date().toISOString(),
    },
  });
};
