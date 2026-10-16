import { spawn, type ChildProcess } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { createConnection } from "node:net";
import { dirname, join, resolve } from "node:path";
import { setTimeout as pause } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import mongoose from "mongoose";
import { findPackageDirectory } from "../config/loadEnvironment.js";
import { findMongoBinary } from "./mongoBinary.js";

const port = 27018;
const replicaSet = "supportpilotRs";
const serverDirectory = findPackageDirectory(dirname(fileURLToPath(import.meta.url)));
const dataDirectory = resolve(serverDirectory, "../.runtime-mongo-dev");
const localUri = `mongodb://127.0.0.1:${port}/supportpilot-ai?directConnection=true`;
const applicationUri = `${localUri}&replicaSet=${replicaSet}`;

function isListening(): Promise<boolean> {
  return new Promise((done) => {
    const socket = createConnection({ host: "127.0.0.1", port });
    const finish = (listening: boolean) => {
      socket.destroy();
      done(listening);
    };
    socket.once("connect", () => finish(true));
    socket.once("error", () => finish(false));
    socket.setTimeout(500, () => finish(false));
  });
}

async function run(): Promise<void> {
  const action = process.argv[2];
  if (action !== "start" && action !== "stop") throw new Error("Use db:start or db:stop.");
  const listening = await isListening();
  if (action === "stop" && !listening) {
    console.log("SupportPilot's local database is already stopped.");
    return;
  }

  let child: ChildProcess | undefined;
  let spawnError: Error | undefined;
  const client = new mongoose.mongo.MongoClient(localUri, {
    serverSelectionTimeoutMS: 1000,
    connectTimeoutMS: 1000,
    socketTimeoutMS: 5000,
  });
  try {
    if (!listening) {
      await mkdir(dataDirectory, { recursive: true });
      child = spawn(
        await findMongoBinary(),
        [
          "--dbpath",
          dataDirectory,
          "--port",
          String(port),
          "--bind_ip",
          "127.0.0.1",
          "--replSet",
          replicaSet,
          "--logpath",
          join(dataDirectory, "mongo.log"),
          "--logappend",
        ],
        { detached: true, windowsHide: true, stdio: "ignore" },
      );
      child.on("error", (error) => {
        spawnError = error;
      });
      const deadline = Date.now() + 30000;
      while (!(await isListening())) {
        if (spawnError)
          throw new Error("Could not launch mongod. Install MongoDB or set MONGOD_BINARY.", {
            cause: spawnError,
          });
        if (child.exitCode !== null || Date.now() > deadline)
          throw new Error(`MongoDB did not start. Check ${join(dataDirectory, "mongo.log")}.`);
        await pause(250);
      }
    }

    await client.connect();
    const admin = client.db("admin");
    const options = await admin.command({ getCmdLineOpts: 1 });
    const dbPath = options.parsed?.storage?.dbPath;
    const configuredReplicaSet =
      options.parsed?.replication?.replSetName ?? options.parsed?.replication?.replSet;
    // Never initialize or stop an unrelated MongoDB process occupying our port.
    if (
      typeof dbPath !== "string" ||
      resolve(dbPath) !== dataDirectory ||
      configuredReplicaSet !== replicaSet
    ) {
      throw new Error(`Port ${port} belongs to another database. Nothing was changed.`);
    }

    if (action === "stop") {
      try {
        await admin.command({ shutdown: 1 });
      } catch (error) {
        if (!(error instanceof mongoose.mongo.MongoNetworkError)) throw error;
      }
      const deadline = Date.now() + 15000;
      while (await isListening()) {
        if (Date.now() > deadline)
          throw new Error("Database shutdown is still pending. Check mongo.log.");
        await pause(250);
      }
      console.log("SupportPilot's local database stopped. Its data has been preserved.");
      return;
    }

    try {
      await admin.command({ replSetGetStatus: 1 });
    } catch (error) {
      if (!(error instanceof mongoose.mongo.MongoServerError) || error.code !== 94) throw error;
      await admin.command({
        replSetInitiate: { _id: replicaSet, members: [{ _id: 0, host: `127.0.0.1:${port}` }] },
      });
    }
    const deadline = Date.now() + 30000;
    while (true) {
      const topology = await admin.command({ hello: 1 });
      if (topology.setName === replicaSet && topology.isWritablePrimary) break;
      if (Date.now() > deadline)
        throw new Error("Replica set did not elect a primary. Check mongo.log.");
      await pause(250);
    }
    child?.unref();
    console.log(`SupportPilot's local replica set is ready on port ${port}.`);
    console.log(`MONGODB_URI=${applicationUri}`);
    console.log("Data persists in .runtime-mongo-dev. Use pnpm db:stop to stop it.");
  } catch (error) {
    child?.kill();
    throw error;
  } finally {
    await client.close();
  }
}

void run().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Local database setup failed.");
  process.exitCode = 1;
});
