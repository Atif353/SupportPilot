import { PolicyChunk } from "../../models/policy-chunk.model.js";
import type { PipelineStage } from "mongoose";
export type RetrievalHit = {
  documentId: string;
  title: string;
  content: string;
  source: string;
  score: number;
  rank?: number;
};
export const publishedStages: PipelineStage[] = [
  {
    $lookup: {
      from: "knowledgedocuments",
      localField: "document",
      foreignField: "_id",
      as: "documentInfo",
    },
  },
  { $unwind: "$documentInfo" },
  {
    $match: {
      "documentInfo.status": "PUBLISHED",
      "documentInfo.indexStatus": "READY",
      $expr: { $eq: ["$version", "$documentInfo.version"] },
    },
  },
];
export const hitProjection = {
  _id: 0,
  documentId: { $toString: "$document" },
  title: "$documentInfo.title",
  content: 1,
  source: { $concat: ["knowledge://", { $toString: "$document" }] },
  score: 1,
};
export async function lexicalSearch(query: string, limit = 10): Promise<RetrievalHit[]> {
  return PolicyChunk.aggregate<RetrievalHit>([
    { $match: { $text: { $search: query }, published: true } },
    { $set: { score: { $meta: "textScore" } } },
    ...publishedStages,
    { $sort: { score: -1, _id: 1 } },
    { $limit: limit },
    { $project: hitProjection },
  ]).option({ maxTimeMS: 5000 });
}
