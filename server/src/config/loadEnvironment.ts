import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { config } from "dotenv";

export function findPackageDirectory(startDirectory: string): string {
  let directory = resolve(startDirectory);
  while (!existsSync(join(directory, "package.json"))) {
    const parent = dirname(directory);
    if (parent === directory) throw new Error("Cannot locate the server package directory.");
    directory = parent;
  }
  return directory;
}

export function loadEnvironmentFiles(
  serverDirectory: string,
  target: NodeJS.ProcessEnv = process.env,
): void {
  // Shell values win, followed by server/.env, then the workspace .env.
  const paths = [join(serverDirectory, ".env"), resolve(serverDirectory, "../.env")].filter(
    existsSync,
  );
  if (!paths.length) return;
  const result = config({ path: paths, processEnv: target, override: false, quiet: true });
  if (result.error)
    throw new Error(
      "Could not read an environment file. Check access to server/.env and the workspace .env.",
    );
}
