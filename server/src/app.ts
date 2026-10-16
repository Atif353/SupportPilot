import cors from "cors";
import express from "express";
import helmet from "helmet";
import { pinoHttp } from "pino-http";
import { apiVersion } from "./config/constants.js";
import { env } from "./config/env.js";
import { logger } from "./config/logger.js";
import { errorHandler } from "./common/errors/errorHandler.js";
import { AppError } from "./common/errors/AppError.js";
import { errorCodes } from "./common/errors/errorCodes.js";
import { apiRateLimit } from "./common/middleware/rateLimit.js";
import { requestId } from "./common/middleware/requestId.js";
import { healthRouter } from "./modules/health/health.routes.js";
import { authRouter } from "./modules/auth/auth.routes.js";
import { orderRouter } from "./modules/orders/order.routes.js";
import { conversationRouter } from "./modules/conversations/conversation.routes.js";
import { knowledgeRouter } from "./modules/knowledge/knowledge.routes.js";
import { agentRouter } from "./modules/agent/agent.routes.js";
import { adminRouter } from "./modules/admin/admin.routes.js";
import { proactiveRouter } from "./modules/proactive/proactive.routes.js";
import { evaluationRouter } from "./modules/evaluations/evaluation.routes.js";
import { customerRouter } from "./modules/customer/customer.routes.js";
import { toolsRouter } from "./modules/agent/tools.routes.js";

export const createApp = (): express.Express => {
  const app = express();
  if (env.TRUST_PROXY > 0) app.set("trust proxy", env.TRUST_PROXY);

  app.use(requestId);
  app.use(
    pinoHttp({
      logger,
      autoLogging: { ignore: (req) => req.method === "OPTIONS" },
      serializers: {
        req: (req: { id: unknown; method: string; url: string }) => ({
          id: req.id,
          method: req.method,
          url: req.url,
        }),
        res: (res: { statusCode: number }) => ({ statusCode: res.statusCode }),
      },
    }),
  );
  app.use(helmet());
  app.use(
    cors({
      origin: env.CLIENT_URL,
      credentials: true,
    }),
  );
  app.use(express.json({ limit: "1mb" }));
  app.use(apiRateLimit);

  app.use(`${apiVersion}/health`, healthRouter);
  app.use(`${apiVersion}/auth`, authRouter);
  app.use(`${apiVersion}/orders`, orderRouter);
  app.use(`${apiVersion}/conversations`, conversationRouter);
  app.use(`${apiVersion}/knowledge`, knowledgeRouter);
  app.use(`${apiVersion}/agent`, agentRouter);
  app.use(`${apiVersion}/admin`, adminRouter);
  app.use(`${apiVersion}/proactive`, proactiveRouter);
  app.use(`${apiVersion}/evaluations`, evaluationRouter);
  app.use(`${apiVersion}/customer`, customerRouter);
  app.use(`${apiVersion}/tools`, toolsRouter);

  app.use((_req, _res, next) => {
    next(
      new AppError({
        message: "Route not found.",
        code: errorCodes.NOT_FOUND,
        statusCode: 404,
      }),
    );
  });

  app.use(errorHandler);

  return app;
};
