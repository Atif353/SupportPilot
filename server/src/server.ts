import { createServer } from "node:http";
import { createApp } from "./app.js";
import { connectDatabase, disconnectDatabase } from "./config/database.js";
import { env } from "./config/env.js";
import { logger } from "./config/logger.js";
import { createSocketServer } from "./config/socket.js";
import { runDelayedOrderSweep } from "./modules/proactive/proactive.service.js";
import { recoverInterruptedRuns } from "./modules/agent/run.recovery.js";
import { processNextDocument } from "./modules/knowledge/knowledge.ingest.js";

const app = createApp();
const httpServer = createServer(app);
const io = createSocketServer(httpServer);
let proactiveInterval: NodeJS.Timeout | undefined;
let knowledgeInterval: NodeJS.Timeout | undefined;
let recoveryInterval: NodeJS.Timeout | undefined;
let indexing = false;

io.on("connection", (socket) => logger.info({ socketId: socket.id }, "Socket connected"));

const startServer = async (): Promise<void> => {
  await connectDatabase();
  await recoverInterruptedRuns().catch((error) => logger.error({ error }, "Run recovery failed"));
  recoveryInterval = setInterval(
    () =>
      void recoverInterruptedRuns().catch((error) =>
        logger.error({ error }, "Run recovery failed"),
      ),
    60_000,
  );
  proactiveInterval = setInterval(
    () =>
      void runDelayedOrderSweep().catch((error) =>
        logger.error({ error }, "Proactive sweep failed"),
      ),
    15 * 60 * 1000,
  );
  knowledgeInterval = setInterval(() => {
    if (indexing) return;
    indexing = true;
    void processNextDocument()
      .catch((error) => logger.error({ error }, "Knowledge worker failed"))
      .finally(() => {
        indexing = false;
      });
  }, 2000);

  httpServer.listen(env.PORT, () => {
    logger.info({ port: env.PORT }, "SupportPilot API listening");
  });
};

const shutdown = async (): Promise<void> => {
  logger.info("Shutting down SupportPilot API");
  io.close();
  if (proactiveInterval) clearInterval(proactiveInterval);
  if (knowledgeInterval) clearInterval(knowledgeInterval);
  if (recoveryInterval) clearInterval(recoveryInterval);
  httpServer.close();
  await disconnectDatabase();
  process.exit(0);
};

process.on("SIGINT", () => {
  void shutdown();
});

process.on("SIGTERM", () => {
  void shutdown();
});

void startServer().catch((error) => {
  logger.error({ error }, "Server startup failed");
  process.exit(1);
});
