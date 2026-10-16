import mongoose from "mongoose";
import { env } from "./env.js";
import { logger } from "./logger.js";

export const connectDatabase = async (): Promise<void> => {
  try {
    await mongoose.connect(env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
    const topology = await mongoose.connection.db!.admin().command({ hello: 1 });
    if (!topology.setName && topology.msg !== "isdbgrid") {
      throw new Error(
        "MongoDB is reachable but running standalone. Transactions require a replica set or sharded cluster. " +
          "For a separate local database, run pnpm db:start and use the MONGODB_URI it prints. " +
          "Adding replicaSet to the URI alone does not configure MongoDB. See README.md.",
      );
    }
  } catch (error) {
    await mongoose.disconnect().catch(() => undefined);
    throw error;
  }
  logger.info("MongoDB connection established");
};

export const disconnectDatabase = async (): Promise<void> => {
  await mongoose.disconnect();
};
