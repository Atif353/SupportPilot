import { createHash } from "node:crypto";
import mongoose from "mongoose";
import { readFile, readdir } from "node:fs/promises";
import { basename, extname, join, resolve } from "node:path";
import { existsSync } from "node:fs";
import { env } from "../../config/env.js";
import { KnowledgeDocument } from "../models/knowledge-document.model.js";
import { PolicyChunk } from "../models/policy-chunk.model.js";

export const embeddingDimensions = 768;
const knowledgeDirectory = process.env.KNOWLEDGE_DIRECTORY
  ? resolve(process.env.KNOWLEDGE_DIRECTORY)
  : ([resolve("docs/knowledge"), resolve("../docs/knowledge")].find((directory) =>
      existsSync(directory),
    ) ?? resolve("docs/knowledge"));
export function splitIntoChunks(content: string, size = 1600, overlap = 200): string[] {
  if (size < 1 || overlap < 0 || overlap >= size) throw new Error("Invalid chunk settings.");
  const chunks: string[] = [];
  let start = 0;
  while (start < content.length) {
    let end = Math.min(start + size, content.length);
    if (end < content.length) {
      const boundary = content.lastIndexOf("\n", end);
      if (boundary > start + size / 2) end = boundary;
    }
    const chunk = content.slice(start, end).trim();
    if (chunk) chunks.push(chunk);
    if (end === content.length) break;
    start = end - overlap;
  }
  return chunks;
}

export async function createEmbedding(
  text: string,
  taskType: "RETRIEVAL_QUERY" | "RETRIEVAL_DOCUMENT" = "RETRIEVAL_QUERY",
): Promise<number[]> {
  if (!env.GEMINI_API_KEY) throw new Error("Embedding provider is not configured.");
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${env.GEMINI_EMBEDDING_MODEL}:embedContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": env.GEMINI_API_KEY },
      signal: AbortSignal.timeout(20000),
      body: JSON.stringify({
        model: `models/${env.GEMINI_EMBEDDING_MODEL}`,
        content: { parts: [{ text }] },
        taskType,
        outputDimensionality: embeddingDimensions,
      }),
    },
  );
  if (!response.ok) throw new Error(`Embedding request failed (HTTP ${response.status}).`);
  const payload = (await response.json()) as { embedding?: { values?: number[] } };
  const vector = payload.embedding?.values;
  if (!vector || vector.length !== embeddingDimensions || !vector.every(Number.isFinite))
    throw new Error("Embedding response has invalid dimensions or values.");
  const norm = Math.hypot(...vector);
  if (!norm) throw new Error("Embedding response contains a zero vector.");
  return vector.map((value) => value / norm);
}

export async function queueDocument(input: {
  title: string;
  content: string;
  sourceType: string;
  sourceUrl?: string;
}) {
  return KnowledgeDocument.create({
    ...input,
    status: "DRAFT",
    indexStatus: "QUEUED",
    contentHash: createHash("sha256").update(input.content).digest("hex"),
  });
}

// One leased document per worker; chunk writes are restartable and publication is last.
export async function processNextDocument(): Promise<boolean> {
  let lease = new Date(Date.now() + 120000);
  const document = await KnowledgeDocument.findOneAndUpdate(
    {
      status: { $ne: "ARCHIVED" },
      $or: [
        { indexStatus: "QUEUED" },
        { indexStatus: "INDEXING", indexLeaseUntil: { $lt: new Date() } },
      ],
    },
    { indexStatus: "INDEXING", indexLeaseUntil: lease, $unset: { indexError: 1 } },
    { sort: { createdAt: 1 }, new: true },
  );
  if (!document) return false;
  try {
    const chunks = splitIntoChunks(document.content);
    for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex += 1) {
      const content = chunks[chunkIndex]!;
      const embedding =
        env.KNOWLEDGE_SEARCH_MODE === "hybrid"
          ? await createEmbedding(content, "RETRIEVAL_DOCUMENT")
          : [];
      if (Date.now() >= lease.getTime())
        throw new Error("Indexing lease expired. Retry this document.");
      const nextLease = new Date(Date.now() + 120000);
      const renewed = await KnowledgeDocument.updateOne(
        { _id: document._id, indexLeaseUntil: lease, status: { $ne: "ARCHIVED" } },
        { indexLeaseUntil: nextLease },
      );
      if (!renewed.matchedCount) throw new Error("Indexing lease lost. Retry this document.");
      lease = nextLease;
      await PolicyChunk.updateOne(
        { document: document._id, version: document.version, chunkIndex },
        {
          content,
          embedding,
          published: false,
          embeddingModel:
            env.KNOWLEDGE_SEARCH_MODE === "hybrid" ? env.GEMINI_EMBEDDING_MODEL : "none",
          tokenCount: Math.ceil(content.length / 4),
        },
        { upsert: true, runValidators: true },
      );
    }
    await mongoose.connection.transaction(async (session) => {
      const published = await KnowledgeDocument.updateOne(
        { _id: document._id, indexLeaseUntil: lease, status: { $ne: "ARCHIVED" } },
        {
          status: "PUBLISHED",
          indexStatus: "READY",
          chunkCount: chunks.length,
          embeddingModel:
            env.KNOWLEDGE_SEARCH_MODE === "hybrid" ? env.GEMINI_EMBEDDING_MODEL : "none",
          $unset: { indexLeaseUntil: 1 },
        },
        { session },
      );
      if (!published.matchedCount) throw new Error("Document publication lease lost.");
      await PolicyChunk.updateMany({ document: document._id }, { published: false }, { session });
      await PolicyChunk.updateMany(
        { document: document._id, version: document.version },
        { published: true },
        { session },
      );
    });
  } catch (error) {
    await KnowledgeDocument.updateOne(
      { _id: document._id, indexLeaseUntil: lease },
      {
        indexStatus: "FAILED",
        indexError: error instanceof Error ? error.message : "Indexing failed",
        $unset: { indexLeaseUntil: 1 },
      },
    );
  }
  return true;
}

export async function ingestKnowledge(): Promise<{ documents: number; chunks: number }> {
  const files = (await readdir(knowledgeDirectory)).filter((file) => extname(file) === ".md");
  for (const file of files) {
    const sourceUrl = `docs/knowledge/${file}`;
    if (await KnowledgeDocument.exists({ sourceUrl, indexStatus: "READY" })) continue;
    if (!(await KnowledgeDocument.exists({ sourceUrl }))) {
      const content = await readFile(join(knowledgeDirectory, file), "utf8");
      await queueDocument({
        title:
          /^#\s+(.+)$/m.exec(content)?.[1]?.trim() ?? basename(file, ".md").replaceAll("-", " "),
        content,
        sourceType: "POLICY",
        sourceUrl,
      });
    } else
      await KnowledgeDocument.updateOne(
        { sourceUrl, indexStatus: { $ne: "INDEXING" } },
        { indexStatus: "QUEUED" },
      );
  }
  while (await processNextDocument()) {
    /* Drain the CLI import queue. */
  }
  return { documents: files.length, chunks: await PolicyChunk.countDocuments() };
}
