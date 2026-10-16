import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { findPackageDirectory, loadEnvironmentFiles } from "./loadEnvironment.js";
import { envPositiveInteger, envString } from "../common/validation.js";

loadEnvironmentFiles(findPackageDirectory(dirname(fileURLToPath(import.meta.url))));

export type AppEnv = {
  NODE_ENV: "development" | "test" | "production";
  PORT: number;
  CLIENT_URL: string;
  MONGODB_URI: string;
  JWT_ACCESS_SECRET: string;
  JWT_REFRESH_SECRET: string;
  JWT_ACCESS_EXPIRES_IN: string;
  JWT_REFRESH_EXPIRES_IN: string;
  GEMINI_API_KEY: string | undefined;
  GEMINI_CHAT_MODEL: string;
  GEMINI_ROUTER_MODEL: string;
  GEMINI_ROUTER_TIMEOUT_MS: number;
  GEMINI_EMBEDDING_MODEL: string;
  KNOWLEDGE_SEARCH_MODE: "lexical" | "hybrid";
  TRUST_PROXY: number;
};

const nodeEnv = envString(process.env.NODE_ENV, "development", "NODE_ENV");
if (!("development test production" as string).split(" ").includes(nodeEnv))
  throw new Error("NODE_ENV must be development, test, or production.");

export const env: AppEnv = {
  NODE_ENV: nodeEnv as AppEnv["NODE_ENV"],
  PORT: envPositiveInteger(process.env.PORT, 4000, "PORT"),
  CLIENT_URL: envString(process.env.CLIENT_URL, "http://localhost:5173", "CLIENT_URL"),
  MONGODB_URI: envString(process.env.MONGODB_URI, undefined, "MONGODB_URI"),
  JWT_ACCESS_SECRET: envString(process.env.JWT_ACCESS_SECRET, undefined, "JWT_ACCESS_SECRET"),
  JWT_REFRESH_SECRET: envString(process.env.JWT_REFRESH_SECRET, undefined, "JWT_REFRESH_SECRET"),
  JWT_ACCESS_EXPIRES_IN: envString(
    process.env.JWT_ACCESS_EXPIRES_IN,
    "15m",
    "JWT_ACCESS_EXPIRES_IN",
  ),
  JWT_REFRESH_EXPIRES_IN: envString(
    process.env.JWT_REFRESH_EXPIRES_IN,
    "7d",
    "JWT_REFRESH_EXPIRES_IN",
  ),
  GEMINI_API_KEY: process.env.GEMINI_API_KEY,
  GEMINI_CHAT_MODEL: envString(
    process.env.GEMINI_CHAT_MODEL,
    "gemini-flash-latest,gemini-2.5-flash-lite",
    "GEMINI_CHAT_MODEL",
  ),
  GEMINI_ROUTER_MODEL: envString(
    process.env.GEMINI_ROUTER_MODEL,
    "gemini-flash-lite-latest,gemini-2.5-flash-lite",
    "GEMINI_ROUTER_MODEL",
  ),
  GEMINI_ROUTER_TIMEOUT_MS: envPositiveInteger(
    process.env.GEMINI_ROUTER_TIMEOUT_MS,
    12000,
    "GEMINI_ROUTER_TIMEOUT_MS",
  ),
  GEMINI_EMBEDDING_MODEL: envString(
    process.env.GEMINI_EMBEDDING_MODEL,
    "gemini-embedding-001",
    "GEMINI_EMBEDDING_MODEL",
  ),
  KNOWLEDGE_SEARCH_MODE: process.env.KNOWLEDGE_SEARCH_MODE === "hybrid" ? "hybrid" : "lexical",
  TRUST_PROXY: process.env.TRUST_PROXY
    ? envPositiveInteger(process.env.TRUST_PROXY, 1, "TRUST_PROXY")
    : 0,
};

if (
  process.env.KNOWLEDGE_SEARCH_MODE &&
  !["lexical", "hybrid"].includes(process.env.KNOWLEDGE_SEARCH_MODE)
)
  throw new Error("KNOWLEDGE_SEARCH_MODE must be lexical or hybrid.");
if (env.KNOWLEDGE_SEARCH_MODE === "hybrid" && !env.GEMINI_API_KEY)
  throw new Error("Hybrid search requires GEMINI_API_KEY and a vector search index.");
for (const [name, value] of [
  ["JWT_ACCESS_SECRET", env.JWT_ACCESS_SECRET],
  ["JWT_REFRESH_SECRET", env.JWT_REFRESH_SECRET],
]) {
  if (!value || value.length < 24) throw new Error(`${name} must contain at least 24 characters.`);
}
if (env.JWT_ACCESS_SECRET === env.JWT_REFRESH_SECRET)
  throw new Error("Access and refresh secrets must differ.");
if (!/^mongodb(?:\+srv)?:\/\//.test(env.MONGODB_URI))
  throw new Error("MONGODB_URI must be a MongoDB connection string.");
if (!["http:", "https:"].includes(new URL(env.CLIENT_URL).protocol))
  throw new Error("CLIENT_URL must be an HTTP URL.");
