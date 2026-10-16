import { existsSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { join } from "node:path";

export async function findMongoBinary(): Promise<string> {
  if (process.env.MONGOD_BINARY) return process.env.MONGOD_BINARY;
  if (process.platform !== "win32") return "mongod";
  const installDirectory = join(process.env.ProgramFiles ?? "C:\\Program Files", "MongoDB/Server");
  const versions = (await readdir(installDirectory).catch(() => [])).sort((left, right) =>
    right.localeCompare(left, undefined, { numeric: true }),
  );
  for (const version of versions) {
    const binary = join(installDirectory, version, "bin/mongod.exe");
    if (existsSync(binary)) return binary;
  }
  return "mongod";
}
