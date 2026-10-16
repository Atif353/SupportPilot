import { env } from "../../../config/env.js";
import { PolicyChunk } from "../../models/policy-chunk.model.js";
import { createEmbedding } from "../knowledge.ingest.js";
import { publishedStages, hitProjection, type RetrievalHit } from "./lexical.retriever.js";
export async function vectorSearch(query: string, limit = 10): Promise<RetrievalHit[]> {
  if (env.KNOWLEDGE_SEARCH_MODE !== "hybrid") return [];
  const queryVector = await createEmbedding(query);
  return PolicyChunk.aggregate<RetrievalHit>([
    {
      $vectorSearch: {
        filter: { published: true, embeddingModel: env.GEMINI_EMBEDDING_MODEL },
        index: "policy_chunks_vector",
        path: "embedding",
        queryVector,
        numCandidates: 400,
        limit: 50,
      },
    },
    { $set: { score: { $meta: "vectorSearchScore" } } },
    ...publishedStages,
    { $limit: limit },
    { $project: hitProjection },
  ]).option({ maxTimeMS: 5000 });
}
