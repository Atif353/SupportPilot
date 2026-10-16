import pino from "pino";
import { env } from "./env.js";

const environmentOptions: pino.LoggerOptions =
  env.NODE_ENV === "development"
    ? {
        level: "info",
        transport: {
          target: "pino-pretty",
          options: {
            colorize: true,
            translateTime: "SYS:standard",
          },
        },
      }
    : {
        level: env.NODE_ENV === "test" ? "silent" : "info",
      };

/** Keeps type, message and stack only; DOMException would otherwise dump dozens of constants. */
export const serializeError = (error: unknown): unknown =>
  error instanceof Error
    ? {
        type: error.constructor.name,
        message: error.message,
        ...(env.NODE_ENV === "production" ? {} : { stack: error.stack }),
      }
    : error;

export const loggerOptions: pino.LoggerOptions = {
  ...environmentOptions,
  serializers: { error: serializeError },
  redact: ["req.headers.authorization", "req.headers.cookie", "res.headers.set-cookie"],
};

export const logger = pino(loggerOptions);
