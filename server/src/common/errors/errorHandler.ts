import type { ErrorRequestHandler } from "express";
import { env } from "../../config/env.js";
import { logger } from "../../config/logger.js";
import { AppError } from "./AppError.js";
import { errorCodes } from "./errorCodes.js";

export const errorHandler: ErrorRequestHandler = (error, req, res, _next) => {
  if (error instanceof AppError) {
    res.status(error.statusCode).json({
      success: false,
      error: {
        code: error.code,
        message: error.message,
        requestId: req.requestId,
        details: error.details,
      },
    });
    return;
  }

  logger.error({ error, requestId: req.requestId }, "Unhandled API error");

  res.status(500).json({
    success: false,
    error: {
      code: errorCodes.INTERNAL_SERVER_ERROR,
      message:
        env.NODE_ENV === "production"
          ? "An unexpected error occurred."
          : error instanceof Error
            ? error.message
            : "An unexpected error occurred.",
      requestId: req.requestId,
    },
  });
};
