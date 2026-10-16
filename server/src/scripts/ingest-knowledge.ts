import { connectDatabase, disconnectDatabase } from "../config/database.js";
import { ingestKnowledge } from "../modules/knowledge/knowledge.ingest.js";

const run = async (): Promise<void> => {
  await connectDatabase();
  console.log(JSON.stringify(await ingestKnowledge()));
};

run()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectDatabase();
  });
